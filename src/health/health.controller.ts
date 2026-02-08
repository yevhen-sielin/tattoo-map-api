import { Controller, Get, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected';
  error?: string;
}

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check with database connectivity' })
  async check(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const isProd = process.env.NODE_ENV === 'production';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp, database: 'connected' };
    } catch (err) {
      // Always log the full error server-side for debugging
      this.logger.error(
        'Health check: database connectivity failed',
        err instanceof Error ? err.stack : err,
      );

      return {
        status: 'error',
        timestamp,
        database: 'disconnected',
        // In production, mask internal details to avoid leaking infra info
        error: isProd
          ? 'Database unavailable'
          : err instanceof Error
            ? err.message
            : 'Unknown database error',
      };
    }
  }
}
