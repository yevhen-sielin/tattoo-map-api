// src/uploads/uploads.controller.ts
import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class SignedUrlDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('signed-url')
  @UseGuards(JwtAuthGuard)
  async createSignedUrl(@Req() req: any, @Body() body: SignedUrlDto) {
    const userId: string = req.user.sub;
    const { fileName, contentType } = body;
    return this.uploads.createSignedUploadUrl(userId, fileName, contentType);
  }
}
