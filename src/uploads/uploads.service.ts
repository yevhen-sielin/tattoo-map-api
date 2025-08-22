import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class UploadsService {
  private readonly supabase;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    this.bucketName = this.config.get<string>('SUPABASE_BUCKET') || 'artists';
    if (!url || !key) {
      throw new Error('Supabase storage is not configured');
    }
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  async createSignedUploadUrl(path: string, contentType: string) {
    // Use upload signed URL API
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUploadUrl(path, { contentType, upsert: true });
    if (error) throw error;
    return data; // { signedUrl, path, token }
  }

  getPublicUrl(path: string) {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);
    return data.publicUrl;
  }
}


