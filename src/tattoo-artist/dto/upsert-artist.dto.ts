import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertArtistDto {
  @IsString()
  @MaxLength(200)
  city!: string;

  @IsString()
  @MaxLength(200)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string | null;

  @IsString()
  @MaxLength(500)
  address!: string;

  @IsString()
  @MaxLength(100)
  nickname!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsArray()
  @IsString({ each: true })
  styles!: string[];

  @IsString()
  @MaxLength(100)
  instagram!: string;

  @IsOptional()
  @IsBoolean()
  beginner?: boolean;

  @IsOptional()
  @IsBoolean()
  coverups?: boolean;

  @IsOptional()
  @IsBoolean()
  color?: boolean;

  @IsOptional()
  @IsBoolean()
  blackAndGray?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl()
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tiktok?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  facebook?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wechat?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  snapchat?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  regionName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCodeFull?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  streetName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  addressNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  routableLat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  routableLon?: number | null;

  @IsOptional()
  geoRaw?: Record<string, unknown>;
}
