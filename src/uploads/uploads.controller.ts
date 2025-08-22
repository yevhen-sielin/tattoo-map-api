import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly config: ConfigService,
  ) {}

  @Post('signed-url')
  @UseGuards(JwtAuthGuard)
  async createSignedUrl(
    @Body()
    body: { fileName: string; contentType: string },
  ) {
    const { fileName, contentType } = body;
    const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const envPrefix =
      this.config.get<string>('SUPABASE_PATH_PREFIX') ||
      (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
    const path = `${envPrefix}/${Date.now()}_${safeName}`;
    const data = await this.uploads.createSignedUploadUrl(path, contentType);
    const publicUrl = this.uploads.getPublicUrl(path);
    return { ...data, publicUrl };
  }
}
