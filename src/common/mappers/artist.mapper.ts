import { Prisma } from '@prisma/client';
import { decimalToNumber } from '../utils/decimal.util';

/** The raw DB artist row (at minimum contains lat/lon as Decimals). */
interface ArtistRow {
  lat: Prisma.Decimal | null;
  lon: Prisma.Decimal | null;
  [key: string]: unknown;
}

/** Artist entity with lat/lon serialised as plain numbers. */
export type MappedArtist<T extends ArtistRow> = Omit<T, 'lat' | 'lon'> & {
  lat: number | null;
  lon: number | null;
};

/**
 * Normalise a DB artist row into a transport-safe shape
 * (replaces `Prisma.Decimal` with `number | null`).
 */
export function mapArtistToDto<T extends ArtistRow>(a: T): MappedArtist<T> {
  return {
    ...a,
    lat: decimalToNumber(a.lat),
    lon: decimalToNumber(a.lon),
  };
}
