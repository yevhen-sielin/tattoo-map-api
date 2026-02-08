import { decimalToNumber } from '../utils/decimal.util';

/** Structural match for Prisma.Decimal without relying on generated types. */
interface DecimalValue {
  toNumber(): number;
}

/** The raw DB artist row (at minimum contains userId + lat/lon as Decimals). */
export interface ArtistRow {
  userId: string;
  lat: DecimalValue | null;
  lon: DecimalValue | null;
  [key: string]: unknown;
}

/** Artist entity with lat/lon serialised as plain numbers. */
export type MappedArtist<T extends ArtistRow> = Omit<T, 'lat' | 'lon'> & {
  userId: string;
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
