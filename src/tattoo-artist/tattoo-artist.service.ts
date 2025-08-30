// tattoo-artist.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type BBox = { west: number; south: number; east: number; north: number };

type SearchParams = {
  bbox: BBox | null;
  styles: string[];
  countryCode: string | null;
  q: string | null;
  beginner?: boolean;
  color?: boolean;
  blackAndGray?: boolean;
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
    return v == null ? null : typeof v.toNumber === 'function' ? v.toNumber() : Number(v);
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

    const where: Prisma.ArtistWhereInput = {};
    const AND: Prisma.ArtistWhereInput[] = [];
    const OR: Prisma.ArtistWhereInput[] = [];
    const NOT: Prisma.ArtistWhereInput[] = [];

    if (cc) {
      // case-insensitive equality without changing existing rows
      AND.push({ countryCode: { in: [cc, cc.toLowerCase()] } as any });
    }

    if (params.styles?.length) {
      const toTitle = (s: string) => s
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const styleVariants = Array.from(new Set(
        params.styles.flatMap((s) => [s, s.toLowerCase(), s.toUpperCase(), toTitle(s)])
      ));
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

    // Bounding box:
    // - Regular case (west <= east): single range on lon.
    // - Antimeridian (east < west): lon in [west, 180] OR lon in [-180, east].
    const bbox = params.bbox;
    const withLatLonNotNull: Prisma.ArtistWhereInput = {
      lat: { not: null },
      lon: { not: null },
    };

    let needsClientSideFilter = false;

    if (bbox) {
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
        // We’ll still run a final client-side filter to be extra safe
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

    if (bbox && needsClientSideFilter) {
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

    // attach likes counts
    const counts = await this.prisma.like.groupBy({ by: ['artistId'], _count: { artistId: true }, where: { artistId: { in: normalized.map(a => a.userId) } } });
    const mapCount = new Map(counts.map(c => [c.artistId, c._count.artistId]));
    return normalized.map(a => ({ ...a, likes: mapCount.get(a.userId) ?? 0 }));
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
      throw new NotFoundException('User not found. Please authenticate to create a like.');
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
    await this.prisma.like.delete({ where: { userId_artistId: { userId, artistId } } }).catch(() => {});
    const count = await this.prisma.like.count({ where: { artistId } });
    return { artistId, likes: count };
  }

  async isLikedBy(userId: string, artistId: string) {
    const like = await this.prisma.like.findUnique({ where: { userId_artistId: { userId, artistId } } });
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
    };

    // Ensure avatar is sourced from the User profile on first create
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return this.prisma.artist.upsert({
      where: { userId },
      update: payload, // do not change avatar on update via this endpoint
      create: { userId, ...payload, avatar: user?.avatar ?? '' },
    });
  }
}
