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
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../../config/constants';

export class SearchArtistsDto {
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
  @Transform(({ value }) => (value !== undefined ? Number(value) : DEFAULT_SEARCH_LIMIT))
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit?: number = DEFAULT_SEARCH_LIMIT;
}
