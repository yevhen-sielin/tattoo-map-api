import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const sslRequired =
      process.env.PGSSLMODE === 'require' ||
      process.env.DATABASE_SSL === '1' ||
      isProd;

    let sslConfig:
      | boolean
      | { rejectUnauthorized: boolean; ca?: string }
      | undefined;

    if (sslRequired) {
      // In production, verify the server certificate against the RDS CA bundle
      // if available; otherwise fall back to rejectUnauthorized: false (AWS RDS
      // uses Amazon-issued certs which may not be in the default OS trust store).
      const caPath =
        process.env.RDS_CA_BUNDLE_PATH ??
        path.join(process.cwd(), 'rds-combined-ca-bundle.pem');
      const caExists = fs.existsSync(caPath);

      if (isProd && caExists) {
        sslConfig = {
          rejectUnauthorized: true,
          ca: fs.readFileSync(caPath, 'utf8'),
        };
      } else {
        // Dev/staging or CA bundle not present — still use SSL but skip verification
        sslConfig = { rejectUnauthorized: false };
      }
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    });
    super({ adapter: new PrismaPg(pool) });

    // Log SSL mode at startup for diagnostics
    if (!sslConfig) {
      this.logger.log('SSL: disabled (local dev)');
    } else if (typeof sslConfig === 'object' && sslConfig.rejectUnauthorized) {
      this.logger.log('SSL: enabled with CA verification (production)');
    } else {
      this.logger.log('SSL: enabled without CA verification');
    }
  }

  async onModuleInit() {
    // Log the DB connection target for diagnostics
    try {
      const dsn = process.env.DATABASE_URL;
      if (dsn) {
        try {
          const url = new URL(dsn);
          // Avoid leaking credentials
          const masked = `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`;
          this.logger.log(`DATABASE_URL → ${masked}`);
        } catch {
          this.logger.log('DATABASE_URL present but could not be parsed');
        }
      } else {
        this.logger.warn('DATABASE_URL is not set');
      }
    } catch {
      // ignore
    }

    await this.$connect();
    // After connection, log server/database values from the session
    try {
      type Row = { db: string; host: string | null; port: number | null };
      const rows = await this.$queryRaw<Row[]>`
        select current_database() as db, inet_server_addr() as host, inet_server_port() as port
      `;
      if (Array.isArray(rows) && rows[0]) {
        const { db, host, port } = rows[0];
        this.logger.log(
          `Connected to db=${db} host=${host ?? 'unknown'} port=${port ?? 'unknown'}`,
        );
      }
    } catch {
      // ignore
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
