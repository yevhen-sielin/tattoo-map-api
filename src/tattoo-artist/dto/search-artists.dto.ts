import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SearchArtistsDto {
  // Bounding box: west,south,east,north (lon,lat,lon,lat)
  @IsOptional()
  @IsString()
  bbox?: string;

  // Alternatively as separate params
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;

  // Filters
  @IsOptional()
  @IsString()
  styles?: string; // comma-separated list

  @IsOptional()
  @IsString()
  countryCode?: string; // ISO-2

  @IsOptional()
  @IsString()
  regionCode?: string; // region code

  @IsOptional()
  @IsString()
  city?: string; // city name

  @IsOptional()
  @IsString()
  q?: string; // search by nickname/city

  // Work type flags
  @IsOptional()
  @IsBooleanString()
  beginner?: string;

  @IsOptional()
  @IsBooleanString()
  color?: string;

  @IsOptional()
  @IsBooleanString()
  blackAndGray?: string;

  // Cover-up work flag
  @IsOptional()
  @IsBooleanString()
  coverups?: string;

  // Radius search
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLon?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  radiusKm?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 500))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 500;
}

export function parseBbox(
  dto: SearchArtistsDto,
): { west: number; south: number; east: number; north: number } | null {
  if (dto.bbox) {
    const parts = dto.bbox.split(',').map((v) => Number(v.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [west, south, east, north] = parts;
      return { west, south, east, north };
    }
  }
  if (
    dto.west !== undefined &&
    dto.south !== undefined &&
    dto.east !== undefined &&
    dto.north !== undefined
  ) {
    return {
      west: dto.west,
      south: dto.south,
      east: dto.east,
      north: dto.north,
    };
  }
  return null;
}
