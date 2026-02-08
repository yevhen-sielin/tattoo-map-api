// src/uploads/uploads.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, IsIn, MaxLength } from 'class-validator';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/auth.controller';
import type { User as JwtUser } from '../auth/types';

/** Only image MIME types are accepted for uploads */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

class SignedUrlDto {
  @ApiProperty({ description: 'Original file name', example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    description: 'MIME type (images only)',
    example: 'image/jpeg',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType!: string;
}

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('signed-url')
  @ApiOperation({ summary: 'Get a pre-signed S3 upload URL' })
  @ApiCookieAuth()
  @Throttle({
    short: { limit: 5, ttl: 1_000 },
    medium: { limit: 30, ttl: 60_000 },
  })
  @UseGuards(JwtAuthGuard)
  async createSignedUrl(
    @CurrentUser() user: JwtUser,
    @Body() body: SignedUrlDto,
  ) {
    const userId: string = user.sub;
    const { fileName, contentType } = body;
    return this.uploads.createSignedUploadUrl(userId, fileName, contentType);
  }
}
