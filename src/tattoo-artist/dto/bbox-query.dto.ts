import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BboxQueryDto {
  @ApiPropertyOptional({
    description:
      'ISO 3166-1 alpha-2 country code to filter points (e.g. DE, US)',
    example: 'DE',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Region/state code to filter points (e.g. TX, CA, NRW)',
    example: 'TX',
  })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional({
    description: 'City name to filter points (e.g. Berlin, Houston)',
    example: 'Berlin',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Southwest longitude of the bounding box',
    example: -180,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  swLng?: number;

  @ApiPropertyOptional({
    description: 'Southwest latitude of the bounding box',
    example: -90,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  swLat?: number;

  @ApiPropertyOptional({
    description: 'Northeast longitude of the bounding box',
    example: 180,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-180)
  @Max(180)
  neLng?: number;

  @ApiPropertyOptional({
    description: 'Northeast latitude of the bounding box',
    example: 90,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(-90)
  @Max(90)
  neLat?: number;
}
