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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../../config/constants';

export class SearchArtistsDto {
  @ApiPropertyOptional({
    description: 'Comma-separated tattoo styles',
    example: 'Realism,Blackwork',
  })
  @IsOptional()
  @IsString()
  styles?: string;

  @ApiPropertyOptional({ description: 'ISO-2 country code', example: 'DE' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Region code', example: 'BY' })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'Munich' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Search by nickname or city' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter beginner artists',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  beginner?: string;

  @ApiPropertyOptional({ description: 'Filter color work', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Filter black & gray work',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  blackAndGray?: string;

  @ApiPropertyOptional({ description: 'Filter cover-up work', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  coverups?: string;

  @ApiPropertyOptional({
    description: 'Center latitude for radius search',
    example: 48.137,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat?: number;

  @ApiPropertyOptional({
    description: 'Center longitude for radius search',
    example: 11.576,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLon?: number;

  @ApiPropertyOptional({ description: 'Search radius in km', example: 50 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  radiusKm?: number;

  @ApiPropertyOptional({
    description: 'Max results',
    default: DEFAULT_SEARCH_LIMIT,
    maximum: MAX_SEARCH_LIMIT,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? Number(value) : DEFAULT_SEARCH_LIMIT,
  )
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_LIMIT)
  limit?: number = DEFAULT_SEARCH_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of results to skip (offset pagination)',
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
