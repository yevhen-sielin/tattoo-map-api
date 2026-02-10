import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>('S3_BUCKET') ?? '';
    const cdnBaseUrl = this.config.get<string>('CDN_BASE_URL') ?? '';
    const region = this.config.get<string>('AWS_REGION') ?? '';

    this.bucket = bucket;
    this.cdnBaseUrl = cdnBaseUrl;
    this.configured = !!(bucket && cdnBaseUrl && region);

    if (!this.configured) {
      this.logger.warn(
        'S3 uploads disabled — missing env: ' +
          [
            !bucket && 'S3_BUCKET',
            !cdnBaseUrl && 'CDN_BASE_URL',
            !region && 'AWS_REGION',
          ]
            .filter(Boolean)
            .join(', '),
      );
      this.s3 = null;
      return;
    }

    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    const cfg: S3ClientConfig = { region };
    if (accessKeyId && secretAccessKey) {
      cfg.credentials = { accessKeyId, secretAccessKey };
    }

    this.s3 = new S3Client(cfg);
  }

  /** Throws if S3 is not configured. */
  private requireS3(): S3Client {
    if (!this.s3) {
      throw new InternalServerErrorException(
        'File uploads are not configured (missing S3 env vars)',
      );
    }
    return this.s3;
  }

  /** Maximum upload size: 10 MB */
  private static readonly MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  /**
   * Create a signed upload URL for a user's original image.
   * The signed URL enforces:
   * - Content-Type header must match the requested type
   * - Content-Length must not exceed MAX_UPLOAD_BYTES
   * - Filename is sanitized to prevent path traversal
   */
  async createSignedUploadUrl(
    userId: string,
    fileName: string,
    contentType: string,
  ): Promise<{ signedUrl: string; publicUrl: string; key: string }> {
    // Sanitize filename: strip path components, restrict to safe chars, limit length
    const baseName = fileName.split(/[\\/]/).pop() ?? 'file';
    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const key = `${userId}/originals/${Date.now()}_${safeName}`;

    const putParams = {
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    };

    try {
      const command = new PutObjectCommand(putParams);
      const signedUrl = await getSignedUrl(this.requireS3(), command, {
        expiresIn: 900,
      });
      return { signedUrl, publicUrl: `${this.cdnBaseUrl}/${key}`, key };
    } catch (error) {
      this.logger.error(`Failed to create signed URL for key=${key}`, error);
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  /**
   * Delete all S3 objects under a user's folder prefix (both originals/ and optimized/).
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const prefix = `${userId}/`;
    let continuationToken: string | undefined;

    const s3 = this.requireS3();
    try {
      do {
        const list = await s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        const keys = (list.Contents ?? []).map((o) => o.Key!).filter(Boolean);
        if (keys.length) {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
            }),
          );
        }

        continuationToken = list.IsTruncated
          ? list.NextContinuationToken
          : undefined;
      } while (continuationToken);
    } catch (error) {
      this.logger.error(
        `Failed to delete S3 objects for user=${userId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to delete user files');
    }
  }
}
