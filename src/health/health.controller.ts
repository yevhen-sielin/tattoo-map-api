import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected';
  error?: string;
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp, database: 'connected' };
    } catch (err) {
      return {
        status: 'error',
        timestamp,
        database: 'disconnected',
        error: err instanceof Error ? err.message : 'Unknown database error',
      };
    }
  }
}
