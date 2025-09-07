// tattoo-artist.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type BBox = { west: number; south: number; east: number; north: number };

type SearchParams = {
  bbox: BBox | null;
  styles: string[];
  countryCode: string | null;
  regionCode: string | null;
  city: string | null;
  q: string | null;
  beginner?: boolean;
  color?: boolean;
  blackAndGray?: boolean;
  centerLat: number | null;
  centerLon: number | null;
  radiusKm: number | null;
  limit: number;
  // optional future-proofing
  skip?: number;
};

@Injectable()
export class TattooArtistService {
  constructor(private readonly prisma: PrismaService) {}

  // --- helpers --------------------------------------------------------------

  /** Convert Prisma.Decimal | null to number | null */
  private decToNum(v: Prisma.Decimal | null): number | null {
    // Prisma.Decimal has toNumber(); keep a safe guard
    // @ts-ignore
    return v == null
      ? null
      : typeof v.toNumber === 'function'
        ? v.toNumber()
        : Number(v);
  }

  /** Normalize DB entity into transport-safe DTO (no Decimal leaks) */
  private mapArtist<T extends { lat: any; lon: any }>(a: T) {
    return {
      ...a,
      lat: this.decToNum(a.lat),
      lon: this.decToNum(a.lon),
    };
  }

  /** Round to 6 decimals as your schema is Decimal(9,6) */
  private toDec6(n?: number | null): Prisma.Decimal | null {
    return n == null ? null : new Prisma.Decimal(Number(n).toFixed(6));
  }

  /** Clamp limit to a safe range */
  private clampLimit(n: number | undefined, min = 1, max = 100): number {
    const v = Number.isFinite(n as number) ? (n as number) : 20;
    return Math.max(min, Math.min(max, v));
  }

  // --- queries --------------------------------------------------------------

  async findAll() {
    const artists = await this.prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return artists.map((a) => this.mapArtist(a));
  }

  async findByUserId(userId: string) {
    const [a, count] = await Promise.all([
      this.prisma.artist.findUnique({ where: { userId } }),
      this.prisma.like.count({ where: { artistId: userId } }),
    ]);
    return a ? { ...this.mapArtist(a), likes: count } : null;
  }

  async search(params: SearchParams) {
    const limit = this.clampLimit(params.limit);
    const skip = params.skip && params.skip > 0 ? params.skip : 0;

    // Normalize country code (ISO-3166-1 alpha-2 expected)
    const cc =
      params.countryCode && params.countryCode.trim()
        ? params.countryCode.trim().toUpperCase()
        : null;

    // Determine search type for logging/debugging
    const searchType = this.determineSearchType(params);
    console.log(`🔍 Search type: ${searchType}`, {
      countryCode: cc,
      regionCode: params.regionCode,
      city: params.city,
      hasRadius: !!(params.centerLat && params.centerLon && params.radiusKm),
      hasBbox: !!params.bbox,
    });

    const where: Prisma.ArtistWhereInput = {};
    const AND: Prisma.ArtistWhereInput[] = [];
    const OR: Prisma.ArtistWhereInput[] = [];
    const NOT: Prisma.ArtistWhereInput[] = [];

    // Location-based filters (hierarchical: country -> region -> city)
    if (cc) {
      // Filter by country code (ISO-3166-1 alpha-2)
      AND.push({ countryCode: { in: [cc, cc.toLowerCase()] } });
    }

    if (params.regionCode?.trim()) {
      // Filter by region code (e.g., "FL" for Flevoland)
      const regionCode = params.regionCode.trim();
      AND.push({
        regionCodeFull: { contains: regionCode, mode: 'insensitive' },
      });
    }

    if (params.city?.trim()) {
      // Filter by city name (most specific location filter)
      const city = params.city.trim();
      AND.push({ city: { contains: city, mode: 'insensitive' } });
    }

    if (params.styles?.length) {
      const toTitle = (s: string) =>
        s
          .toLowerCase()
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      const styleVariants = Array.from(
        new Set(
          params.styles.flatMap((s) => [
            s,
            s.toLowerCase(),
            s.toUpperCase(),
            toTitle(s),
          ]),
        ),
      );
      AND.push({ styles: { hasSome: styleVariants } });
    }

    if (params.q?.trim()) {
      const q = params.q.trim();
      OR.push(
        { nickname: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      );
    }

    if (params.beginner === true) {
      AND.push({ beginner: true } as any);
    }

    if (params.color === true) {
      AND.push({ color: true } as any);
    }

    if (params.blackAndGray === true) {
      AND.push({ blackAndGray: true } as any);
    }

    // Bounding box or radius search:
    // - Regular case (west <= east): single range on lon.
    // - Antimeridian (east < west): lon in [west, 180] OR lon in [-180, east].
    const bbox = params.bbox;
    const withLatLonNotNull: Prisma.ArtistWhereInput = {
      lat: { not: null },
      lon: { not: null },
    };

    let needsClientSideFilter = false;

    // Handle radius search
    if (
      params.centerLat != null &&
      params.centerLon != null &&
      params.radiusKm != null
    ) {
      // Convert radius to bbox for initial DB filtering
      const { west, south, east, north } = this.radiusToBbox(
        params.centerLat,
        params.centerLon,
        params.radiusKm,
      );

      AND.push(withLatLonNotNull);
      AND.push({
        lat: {
          gte: this.toDec6(south)!,
          lte: this.toDec6(north)!,
        },
      });

      if (east >= west) {
        AND.push({
          lon: {
            gte: this.toDec6(west)!,
            lte: this.toDec6(east)!,
          },
        });
      } else {
        AND.push({
          OR: [
            { lon: { gte: this.toDec6(west)! } },
            { lon: { lte: this.toDec6(east)! } },
          ],
        });
      }
      // Always need client-side filtering for accurate radius
      needsClientSideFilter = true;
    } else if (bbox) {
      const { west, south, east, north } = bbox;

      // Always bound latitude in DB
      AND.push(withLatLonNotNull);
      AND.push({
        lat: {
          gte: this.toDec6(south)!, // safe due to not null above
          lte: this.toDec6(north)!,
        },
      });

      if (east >= west) {
        // Normal: one interval on lon
        AND.push({
          lon: {
            gte: this.toDec6(west)!,
            lte: this.toDec6(east)!,
          },
        });
      } else {
        // Antimeridian split — emulate with OR for lon
        AND.push({
          OR: [
            { lon: { gte: this.toDec6(west)! } }, // west .. +180
            { lon: { lte: this.toDec6(east)! } }, // -180 .. east
          ],
        });
        // We'll still run a final client-side filter to be extra safe
        needsClientSideFilter = true;
      }
    }

    if (AND.length) where.AND = AND;
    if (OR.length) where.OR = OR;
    if (NOT.length) where.NOT = NOT;

    const artists = await this.prisma.artist.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    const normalized = artists.map((a) => this.mapArtist(a));

    if (needsClientSideFilter) {
      if (
        params.centerLat != null &&
        params.centerLon != null &&
        params.radiusKm != null
      ) {
        // Radius-based filtering
        return normalized.filter((a) => {
          if (a.lat == null || a.lon == null) return false;
          const distance = this.calculateDistance(
            params.centerLat!,
            params.centerLon!,
            a.lat,
            a.lon,
          );
          return distance <= params.radiusKm!;
        });
      } else if (bbox) {
        // Bbox-based filtering
        const { west, south, east, north } = bbox;
        return normalized.filter((a) => {
          if (a.lat == null || a.lon == null) return false;
          const inLat = a.lat >= south && a.lat <= north;
          const inLon =
            east >= west
              ? a.lon >= west && a.lon <= east
              : a.lon >= west || a.lon <= east; // wrap-around
          return inLat && inLon;
        });
      }
    }

    // attach likes counts
    const counts = await this.prisma.like.groupBy({
      by: ['artistId'],
      _count: { artistId: true },
      where: { artistId: { in: normalized.map((a) => a.userId) } },
    });
    const mapCount = new Map(
      counts.map((c) => [c.artistId, c._count.artistId]),
    );
    return normalized.map((a) => ({
      ...a,
      likes: mapCount.get(a.userId) ?? 0,
    }));
  }

  async likeArtist(userId: string, artistId: string) {
    // Validate inputs
    if (!userId || !artistId) {
      throw new BadRequestException('userId and artistId are required');
    }

    const [user, artist] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.artist.findUnique({ where: { userId: artistId } }),
    ]);
    if (!user) {
      throw new NotFoundException(
        'User not found. Please authenticate to create a like.',
      );
    }
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    await this.prisma.like.upsert({
      where: { userId_artistId: { userId, artistId } },
      create: { userId, artistId },
      update: {},
    });
    const count = await this.prisma.like.count({ where: { artistId } });
    return { artistId, likes: count };
  }

  async unlikeArtist(userId: string, artistId: string) {
    await this.prisma.like
      .delete({ where: { userId_artistId: { userId, artistId } } })
      .catch(() => {});
    const count = await this.prisma.like.count({ where: { artistId } });
    return { artistId, likes: count };
  }

  async isLikedBy(userId: string, artistId: string) {
    const like = await this.prisma.like.findUnique({
      where: { userId_artistId: { userId, artistId } },
    });
    return { artistId, liked: Boolean(like) };
  }

  async upsertForCurrentUser(
    userId: string,
    data: {
      city: string;
      country: string;
      countryCode?: string | null;
      address: string;
      nickname: string;
      description: string;
      styles: string[];
      instagram: string;
      beginner?: boolean;
      coverups?: boolean;
      color?: boolean;
      blackAndGray?: boolean;
      email?: string | null;
      website?: string | null;
      tiktok?: string | null;
      facebook?: string | null;
      telegram?: string | null;
      whatsapp?: string | null;
      wechat?: string | null;
      snapchat?: string | null;
      photos?: string[];
      lat?: number | null;
      lon?: number | null;
      // New location fields
      regionName?: string | null;
      regionCode?: string | null;
      regionCodeFull?: string | null;
      postcode?: string | null;
      streetName?: string | null;
      addressNumber?: string | null;
      routableLat?: number | null;
      routableLon?: number | null;
      geoRaw?: any;
    },
  ) {
    // Normalize inputs
    const countryCode =
      data.countryCode && data.countryCode.trim()
        ? data.countryCode.trim().toUpperCase()
        : null;

    const payload = {
      city: data.city,
      country: data.country,
      countryCode,
      address: data.address,
      nickname: data.nickname,
      description: data.description,
      styles: data.styles,
      instagram: data.instagram,
      beginner: Boolean(data.beginner),
      coverups: Boolean(data.coverups),
      color: Boolean(data.color),
      blackAndGray: Boolean(data.blackAndGray),
      email: data.email ?? null,
      website: data.website ?? null,
      tiktok: data.tiktok ?? null,
      facebook: data.facebook ?? null,
      telegram: data.telegram ?? null,
      whatsapp: data.whatsapp ?? null,
      wechat: data.wechat ?? null,
      snapchat: data.snapchat ?? null,
      photos: Array.isArray(data.photos) ? data.photos : [],
      lat: this.toDec6(data.lat),
      lon: this.toDec6(data.lon),
      // New location fields
      regionName: data.regionName ?? null,
      regionCode: data.regionCode ?? null,
      regionCodeFull: data.regionCodeFull ?? null,
      postcode: data.postcode ?? null,
      streetName: data.streetName ?? null,
      addressNumber: data.addressNumber ?? null,
      routableLat: this.toDec6(data.routableLat),
      routableLon: this.toDec6(data.routableLon),
      geoRaw: data.geoRaw ?? null,
    };

    // Ensure avatar is sourced from the User profile on first create
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return this.prisma.artist.upsert({
      where: { userId },
      update: payload, // do not change avatar on update via this endpoint
      create: { userId, ...payload, avatar: user?.avatar ?? '' },
    });
  }

  // Helper method to convert radius to bounding box
  private radiusToBbox(lat: number, lon: number, radiusKm: number): BBox {
    const dLat = radiusKm / 111; // Approximate km per degree latitude
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const dLon = radiusKm / (111 * cosLat); // Approximate km per degree longitude at this latitude

    return {
      west: lon - dLon,
      south: lat - dLat,
      east: lon + dLon,
      north: lat + dLat,
    };
  }

  // Helper method to calculate distance between two points using Haversine formula
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Determine search type based on provided parameters
  private determineSearchType(params: SearchParams): string {
    if (params.centerLat && params.centerLon && params.radiusKm) {
      return 'radius';
    }
    if (params.bbox) {
      return 'bbox';
    }
    if (params.city) {
      return 'city';
    }
    if (params.regionCode) {
      return 'region';
    }
    if (params.countryCode) {
      return 'country';
    }
    return 'global';
  }
}
