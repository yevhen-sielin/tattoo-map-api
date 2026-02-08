import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const sslRequired =
      process.env.PGSSLMODE === 'require' ||
      process.env.DATABASE_SSL === '1' ||
      process.env.NODE_ENV === 'production';
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
    });
    super({ adapter: new PrismaPg(pool) });
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
          console.log('[Prisma] DATABASE_URL →', masked);
        } catch {
          console.log('[Prisma] DATABASE_URL present but could not be parsed');
        }
      } else {
        console.log('[Prisma] DATABASE_URL is not set');
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
        console.log(
          `[Prisma] Connected to db=${db} host=${host ?? 'unknown'} port=${port ?? 'unknown'}`,
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
