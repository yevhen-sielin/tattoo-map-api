import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BboxQueryDto {
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
