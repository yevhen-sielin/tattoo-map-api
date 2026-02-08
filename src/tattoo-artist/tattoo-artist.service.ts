import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { Prisma } from '@prisma/client';
import { decimalToNumber, numberToDecimal6 } from '../common/utils/decimal.util';
import { mapArtistToDto } from '../common/mappers/artist.mapper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchParams = {
  styles: string[];
  countryCode: string | null;
  regionCode: string | null;
  city: string | null;
  q: string | null;
  beginner?: boolean;
  color?: boolean;
  blackAndGray?: boolean;
  coverups?: boolean;
  centerLat: number | null;
  centerLon: number | null;
  radiusKm: number | null;
  limit: number;
  skip?: number;
};

interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface SearchFiltersResult {
  where: Prisma.ArtistWhereInput;
  needsClientSideFilter: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TattooArtistService {
  private readonly logger = new Logger(TattooArtistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Clamp limit to a safe range */
  private clampLimit(n: number | undefined, min = 1, max = 2000): number {
    const v = Number.isFinite(n as number) ? (n as number) : 20;
    return Math.max(min, Math.min(max, v));
  }

  // ── queries ──────────────────────────────────────────────────────────────

  async findAll() {
    const artists = await this.prisma.artist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return artists.map(mapArtistToDto);
  }

  async findByUserId(userId: string) {
    const [a, count] = await Promise.all([
      this.prisma.artist.findUnique({ where: { userId } }),
      this.prisma.like.count({ where: { artistId: userId } }),
    ]);
    return a ? { ...mapArtistToDto(a), likes: count } : null;
  }

  // ── search ───────────────────────────────────────────────────────────────

  async search(params: SearchParams) {
    const limit = this.clampLimit(params.limit);
    const skip = params.skip && params.skip > 0 ? params.skip : 0;

    this.logSearchType(params);

    const { where, needsClientSideFilter } = this.buildSearchFilters(params);

    const artists = await this.prisma.artist.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    const normalized = artists.map(mapArtistToDto);

    // Client-side radius filtering (more accurate than bbox)
    if (needsClientSideFilter) {
      return this.applyRadiusFilter(normalized, params);
    }

    return this.attachLikeCounts(normalized);
  }

  /** Construct the Prisma `where` clause from search parameters. */
  private buildSearchFilters(params: SearchParams): SearchFiltersResult {
    const where: Prisma.ArtistWhereInput = {};
    const AND: Prisma.ArtistWhereInput[] = [];
    const OR: Prisma.ArtistWhereInput[] = [];

    // Normalize country code
    const cc =
      params.countryCode && params.countryCode.trim()
        ? params.countryCode.trim().toUpperCase()
        : null;

    // ── location filters (hierarchical) ──
    if (cc) {
      AND.push({ countryCode: { in: [cc, cc.toLowerCase()] } });
    }
    if (params.regionCode?.trim()) {
      AND.push({
        regionCodeFull: { contains: params.regionCode.trim(), mode: 'insensitive' },
      });
    }
    if (params.city?.trim()) {
      AND.push({ city: { contains: params.city.trim(), mode: 'insensitive' } });
    }

    // ── style filters ──
    if (params.styles?.length) {
      const toTitle = (s: string) =>
        s.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const styleVariants = Array.from(
        new Set(params.styles.flatMap((s) => [s, s.toLowerCase(), s.toUpperCase(), toTitle(s)])),
      );
      AND.push({ styles: { hasSome: styleVariants } });
    }

    // ── free-text search ──
    if (params.q?.trim()) {
      const q = params.q.trim();
      OR.push(
        { nickname: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      );
    }

    // ── boolean filters ──
    if (params.beginner === true) AND.push({ beginner: true });
    if (params.color === true) AND.push({ color: true });
    if (params.blackAndGray === true) AND.push({ blackAndGray: true });
    if (params.coverups === true) AND.push({ coverups: true });

    // ── radius / bbox filter ──
    let needsClientSideFilter = false;

    if (params.centerLat != null && params.centerLon != null && params.radiusKm != null) {
      const bbox = this.radiusToBbox(params.centerLat, params.centerLon, params.radiusKm);
      AND.push({ lat: { not: null }, lon: { not: null } });
      AND.push({ lat: { gte: numberToDecimal6(bbox.south)!, lte: numberToDecimal6(bbox.north)! } });

      if (bbox.east >= bbox.west) {
        AND.push({ lon: { gte: numberToDecimal6(bbox.west)!, lte: numberToDecimal6(bbox.east)! } });
      } else {
        // Wraps around the antimeridian
        AND.push({
          OR: [
            { lon: { gte: numberToDecimal6(bbox.west)! } },
            { lon: { lte: numberToDecimal6(bbox.east)! } },
          ],
        });
      }
      needsClientSideFilter = true;
    }

    if (AND.length) where.AND = AND;
    if (OR.length) where.OR = OR;

    return { where, needsClientSideFilter };
  }

  /** Post-filter artists by exact Haversine distance (more accurate than bbox). */
  private applyRadiusFilter<T extends { lat: number | null; lon: number | null }>(
    artists: T[],
    params: SearchParams,
  ): T[] {
    if (params.centerLat == null || params.centerLon == null || params.radiusKm == null) {
      return artists;
    }
    return artists.filter((a) => {
      if (a.lat == null || a.lon == null) return false;
      return this.calculateDistance(params.centerLat!, params.centerLon!, a.lat, a.lon) <= params.radiusKm!;
    });
  }

  /** Attach aggregated like counts to a list of mapped artists. */
  private async attachLikeCounts<T extends { userId: string }>(artists: T[]) {
    if (!artists.length) return artists.map((a) => ({ ...a, likes: 0 }));

    const counts = await this.prisma.like.groupBy({
      by: ['artistId'],
      _count: { artistId: true },
      where: { artistId: { in: artists.map((a) => a.userId) } },
    });
    const mapCount = new Map(counts.map((c) => [c.artistId, c._count.artistId]));
    return artists.map((a) => ({ ...a, likes: mapCount.get(a.userId) ?? 0 }));
  }

  // ── top by likes ─────────────────────────────────────────────────────────

  async topByLikes(limit?: number) {
    const take = this.clampLimit(limit ?? 100);
    const artists = await this.prisma.artist.findMany({
      take,
      orderBy: { likes: { _count: 'desc' } },
      include: { _count: { select: { likes: true } } },
    });
    return artists.map((a) => ({
      ...mapArtistToDto(a),
      likes: (a as unknown as { _count?: { likes?: number } })._count?.likes ?? 0,
    }));
  }

  // ── likes ────────────────────────────────────────────────────────────────

  async likeArtist(userId: string, artistId: string) {
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
    try {
      await this.prisma.like.delete({
        where: { userId_artistId: { userId, artistId } },
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code !== 'P2025') throw error;
    }
    const count = await this.prisma.like.count({ where: { artistId } });
    return { artistId, likes: count };
  }

  async isLikedBy(userId: string, artistId: string) {
    const like = await this.prisma.like.findUnique({
      where: { userId_artistId: { userId, artistId } },
    });
    return { artistId, liked: Boolean(like) };
  }

  // ── upsert / delete ─────────────────────────────────────────────────────

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
      regionName?: string | null;
      regionCode?: string | null;
      regionCodeFull?: string | null;
      postcode?: string | null;
      streetName?: string | null;
      addressNumber?: string | null;
      routableLat?: number | null;
      routableLon?: number | null;
      geoRaw?: Record<string, unknown>;
    },
  ) {
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
      lat: numberToDecimal6(data.lat),
      lon: numberToDecimal6(data.lon),
      regionName: data.regionName ?? null,
      regionCode: data.regionCode ?? null,
      regionCodeFull: data.regionCodeFull ?? null,
      postcode: data.postcode ?? null,
      streetName: data.streetName ?? null,
      addressNumber: data.addressNumber ?? null,
      routableLat: numberToDecimal6(data.routableLat),
      routableLon: numberToDecimal6(data.routableLon),
      geoRaw: data.geoRaw
        ? (data.geoRaw as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return this.prisma.artist.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload, avatar: user?.avatar ?? '' },
    });
  }

  async deleteForCurrentUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.like.deleteMany({ where: { artistId: userId } }),
      this.prisma.artist.deleteMany({ where: { userId } }),
    ]);
    await this.uploads.deleteAllForUser(userId);
    return { success: true };
  }

  // ── geo helpers ──────────────────────────────────────────────────────────

  private radiusToBbox(lat: number, lon: number, radiusKm: number): BoundingBox {
    const dLat = radiusKm / 111;
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const dLon = radiusKm / (111 * cosLat);
    return { west: lon - dLon, south: lat - dLat, east: lon + dLon, north: lat + dLat };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private logSearchType(params: SearchParams): void {
    const cc = params.countryCode?.trim().toUpperCase() ?? null;
    const type =
      params.centerLat && params.centerLon && params.radiusKm ? 'radius' :
      params.city ? 'city' :
      params.regionCode ? 'region' :
      params.countryCode ? 'country' :
      'global';
    this.logger.debug(
      `Search type=${type} cc=${cc ?? '-'} region=${params.regionCode ?? '-'} city=${params.city ?? '-'} radius=${!!(params.centerLat && params.centerLon && params.radiusKm)}`,
    );
  }
}
