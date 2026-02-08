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

type RequiredEnv = 'AWS_REGION' | 'S3_BUCKET' | 'CDN_BASE_URL';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const req = (k: RequiredEnv): string => {
      const v = this.config.get<string>(k);
      if (!v) throw new Error(`Missing env ${k}`);
      return v;
    };

    this.bucket = req('S3_BUCKET');
    this.cdnBaseUrl = req('CDN_BASE_URL');

    const region = req('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    const cfg: S3ClientConfig = { region };
    if (accessKeyId && secretAccessKey) {
      cfg.credentials = { accessKeyId, secretAccessKey };
    }

    this.s3 = new S3Client(cfg);
  }

  /**
   * Create a signed upload URL for a user's original image.
   */
  async createSignedUploadUrl(
    userId: string,
    fileName: string,
    contentType: string,
  ): Promise<{ signedUrl: string; publicUrl: string; key: string }> {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${userId}/originals/${Date.now()}_${safeName}`;

    const putParams = {
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    };

    try {
      const signedUrl = await getSignedUrl(
        this.s3,
        new PutObjectCommand(putParams),
        { expiresIn: 900 },
      );
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

    try {
      do {
        const list = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );

        const keys = (list.Contents ?? []).map((o) => o.Key!).filter(Boolean);
        if (keys.length) {
          await this.s3.send(
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
