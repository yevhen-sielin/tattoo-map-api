import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { Prisma } from '@prisma/client';
import { numberToDecimal6 } from '../common/utils/decimal.util';
import { mapArtistToDto } from '../common/mappers/artist.mapper';
import { MAX_SEARCH_LIMIT } from '../config/constants';

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
  private clampLimit(
    n: number | undefined,
    min = 1,
    max = MAX_SEARCH_LIMIT,
  ): number {
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

  /**
   * Lightweight endpoint for map rendering.
   * Returns only the minimal fields needed for pins / clusters:
   * `{ userId, lat, lon }`.
   *
   * When `bbox` is provided (sw_lng, sw_lat, ne_lng, ne_lat), uses PostGIS
   * `ST_MakeEnvelope` + GiST index for efficient viewport queries.
   * Without bbox, returns all points (≈ 1 MB JSON for 50k rows).
   */
  async findAllPoints(
    bbox?: {
      swLng: number;
      swLat: number;
      neLng: number;
      neLat: number;
    },
    filters?: {
      countryCode?: string;
      regionCode?: string;
      city?: string;
    },
  ): Promise<{ userId: string; lat: number; lon: number }[]> {
    // Build dynamic WHERE clauses for optional filters
    const conditions: string[] = [];
    const params: (number | string)[] = [];
    let paramIdx = 1;

    if (bbox) {
      conditions.push(
        `"location" IS NOT NULL`,
        `"location" && ST_MakeEnvelope($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, 4326)::geography`,
      );
      params.push(bbox.swLng, bbox.swLat, bbox.neLng, bbox.neLat);
      paramIdx += 4;
    } else {
      conditions.push(`"lat" IS NOT NULL AND "lon" IS NOT NULL`);
    }

    if (filters?.countryCode) {
      conditions.push(`UPPER("countryCode") = UPPER($${paramIdx})`);
      params.push(filters.countryCode);
      paramIdx++;
    }
    if (filters?.regionCode) {
      conditions.push(`UPPER("regionCode") = UPPER($${paramIdx})`);
      params.push(filters.regionCode);
      paramIdx++;
    }
    if (filters?.city) {
      conditions.push(`LOWER("city") = LOWER($${paramIdx})`);
      params.push(filters.city);
      paramIdx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT "userId", "lat"::float8 AS lat, "lon"::float8 AS lon FROM "Artist" ${where}`;

    const rows = await this.prisma.$queryRawUnsafe<
      { userId: string; lat: number; lon: number }[]
    >(sql, ...params);
    return rows;
  }

  async findByUserId(userId: string) {
    const [a, count] = await Promise.all([
      this.prisma.artist.findUnique({ where: { userId } }),
      this.prisma.like.count({ where: { artistId: userId } }),
    ]);
    return a ? { ...mapArtistToDto(a), likes: count } : null;
  }

  /**
   * Batch fetch artists by a list of user IDs.
   * Used by the frontend when drilling down into a map cluster.
   */
  async findByUserIds(userIds: string[]) {
    if (!userIds.length) return [];

    const artists = await this.prisma.artist.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
    });

    const normalized = artists.map(mapArtistToDto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.attachLikeCounts(normalized);
  }

  // ── search ───────────────────────────────────────────────────────────────

  async search(params: SearchParams) {
    const limit = this.clampLimit(params.limit);
    const skip = params.skip && params.skip > 0 ? params.skip : 0;

    this.logSearchType(params);

    // PostGIS radius search — delegate entirely to raw SQL for accuracy
    if (
      params.centerLat != null &&
      params.centerLon != null &&
      params.radiusKm != null
    ) {
      return this.searchByRadius(params, limit, skip);
    }

    const { where } = this.buildSearchFilters(params);

    const [artists, total] = await Promise.all([
      this.prisma.artist.findMany({
        where,
        take: limit + 1,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.artist.count({ where }),
    ]);

    const hasMore = artists.length > limit;
    const trimmed = hasMore ? artists.slice(0, limit) : artists;
    const normalized = trimmed.map(mapArtistToDto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const withLikes = await this.attachLikeCounts(normalized);
    return { data: withLikes, total, hasMore };
  }

  /**
   * PostGIS-backed radius search using ST_DWithin.
   * Uses the GiST-indexed `location` geography column for O(log n) performance.
   */
  private async searchByRadius(
    params: SearchParams,
    limit: number,
    skip: number,
  ) {
    const radiusMeters = params.radiusKm! * 1000;
    const center = `ST_SetSRID(ST_MakePoint(${params.centerLon!}, ${params.centerLat!}), 4326)::geography`;

    // Build optional WHERE clauses for non-geo filters
    const clauses: string[] = [
      `"location" IS NOT NULL`,
      `ST_DWithin("location", ${center}, ${radiusMeters})`,
    ];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params.countryCode?.trim()) {
      const cc = params.countryCode.trim().toUpperCase();
      clauses.push(`UPPER("countryCode") = $${paramIdx}`);
      values.push(cc);
      paramIdx++;
    }
    if (params.city?.trim()) {
      clauses.push(`"city" ILIKE $${paramIdx}`);
      values.push(`%${params.city.trim()}%`);
      paramIdx++;
    }
    if (params.q?.trim()) {
      const pattern = `%${params.q.trim()}%`;
      clauses.push(
        `("nickname" ILIKE $${paramIdx} OR "city" ILIKE $${paramIdx} OR "country" ILIKE $${paramIdx})`,
      );
      values.push(pattern);
      paramIdx++;
    }
    if (params.beginner) {
      clauses.push(`"beginner" = true`);
    }
    if (params.color) {
      clauses.push(`"color" = true`);
    }
    if (params.blackAndGray) {
      clauses.push(`"blackAndGray" = true`);
    }
    if (params.coverups) {
      clauses.push(`"coverups" = true`);
    }

    const whereSQL = clauses.join(' AND ');

    // Count + fetch in parallel using raw SQL
    const countQuery = `SELECT COUNT(*)::int AS total FROM "Artist" WHERE ${whereSQL}`;
    const dataQuery = `
      SELECT *,
             ST_Distance("location", ${center}) AS "_distanceMeters"
      FROM "Artist"
      WHERE ${whereSQL}
      ORDER BY "_distanceMeters" ASC
      LIMIT ${limit + 1} OFFSET ${skip}
    `;

    const [countRows, artists] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ total: number }[]>(countQuery, ...values),
      this.prisma.$queryRawUnsafe<
        Array<{
          userId: string;
          lat: unknown;
          lon: unknown;
          [k: string]: unknown;
        }>
      >(dataQuery, ...values),
    ]);

    const total = countRows[0]?.total ?? 0;
    const hasMore = artists.length > limit;
    const trimmed = hasMore ? artists.slice(0, limit) : artists;
    const normalized = trimmed.map(mapArtistToDto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const withLikes = await this.attachLikeCounts(normalized);
    return { data: withLikes, total, hasMore };
  }

  /**
   * Construct the Prisma `where` clause from search parameters.
   * Note: radius/geo queries are handled separately via PostGIS raw SQL
   * in `searchByRadius()`, so this method only handles non-geo filters.
   */
  private buildSearchFilters(params: SearchParams): {
    where: Prisma.ArtistWhereInput;
  } {
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
        regionCodeFull: {
          contains: params.regionCode.trim(),
          mode: 'insensitive',
        },
      });
    }
    if (params.city?.trim()) {
      AND.push({ city: { contains: params.city.trim(), mode: 'insensitive' } });
    }

    // ── style filters ──
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

    if (AND.length) where.AND = AND;
    if (OR.length) where.OR = OR;

    return { where };
  }

  /** Attach aggregated like counts to a list of mapped artists. */
  private async attachLikeCounts<T extends { userId: string }>(artists: T[]) {
    if (!artists.length) return artists.map((a) => ({ ...a, likes: 0 }));

    const counts = await this.prisma.like.groupBy({
      by: ['artistId'],
      _count: { artistId: true },
      where: { artistId: { in: artists.map((a) => a.userId) } },
    });
    const mapCount = new Map<string, number>(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      counts.map((c): [string, number] => [c.artistId, c._count.artistId]),
    );
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
      likes:
        (a as unknown as { _count?: { likes?: number } })._count?.likes ?? 0,
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

    const artist = await this.prisma.artist.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload, avatar: user?.avatar ?? '' },
    });

    // Keep PostGIS `location` column in sync with lat/lon
    await this.syncLocation(userId, data.lat ?? null, data.lon ?? null);

    return artist;
  }

  async deleteForCurrentUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.like.deleteMany({ where: { artistId: userId } }),
      this.prisma.artist.deleteMany({ where: { userId } }),
    ]);
    await this.uploads.deleteAllForUser(userId);
    return { success: true };
  }

  // ── PostGIS helpers ──────────────────────────────────────────────────────

  /**
   * Update the PostGIS `location` geography column for an artist.
   * Uses raw SQL because Prisma doesn't support geography natively.
   */
  private async syncLocation(
    userId: string,
    lat: number | null,
    lon: number | null,
  ): Promise<void> {
    if (lat != null && lon != null) {
      await this.prisma.$executeRaw`
        UPDATE "Artist"
        SET "location" = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
        WHERE "userId" = ${userId}
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE "Artist" SET "location" = NULL WHERE "userId" = ${userId}
      `;
    }
  }

  // ── logging ──────────────────────────────────────────────────────────────

  private logSearchType(params: SearchParams): void {
    const cc = params.countryCode?.trim().toUpperCase() ?? null;
    const type =
      params.centerLat && params.centerLon && params.radiusKm
        ? 'radius'
        : params.city
          ? 'city'
          : params.regionCode
            ? 'region'
            : params.countryCode
              ? 'country'
              : 'global';
    this.logger.debug(
      `Search type=${type} cc=${cc ?? '-'} region=${params.regionCode ?? '-'} city=${params.city ?? '-'} radius=${!!(params.centerLat && params.centerLon && params.radiusKm)}`,
    );
  }
}
