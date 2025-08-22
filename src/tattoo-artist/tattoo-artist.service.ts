// tattoo-artist.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type BBox = { west: number; south: number; east: number; north: number };

type SearchParams = {
  bbox: BBox | null;
  styles: string[];
  countryCode: string | null;
  q: string | null;
  hasPhotos: boolean;
  hasAvatar: boolean;
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
    const a = await this.prisma.artist.findUnique({ where: { userId } });
    return a ? this.mapArtist(a) : null;
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
      AND.push({ countryCode: cc });
    }

    if (params.styles?.length) {
      AND.push({ styles: { hasSome: params.styles } });
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

    if (params.hasPhotos) {
      // array is not empty
      NOT.push({ photos: { equals: [] } });
    }

    if (params.hasAvatar) {
      // non-empty and not null
      AND.push({ avatar: { notIn: ['', null] } as any });
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

    return normalized;
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
      avatar: string;
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
      avatar: data.avatar,
      photos: Array.isArray(data.photos) ? data.photos : [],
      lat: this.toDec6(data.lat),
      lon: this.toDec6(data.lon),
    };

    return this.prisma.artist.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
  }
}
