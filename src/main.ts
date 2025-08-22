import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';

// В dev используем локальный .env поверх системных переменных
dotenv.config({ override: process.env.NODE_ENV !== 'production' });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Если за ALB/CloudFront/NGINX — корректная работа secure cookies и X-Forwarded-Proto
  app.set('trust proxy', 1);

  // Общий префикс API
  app.setGlobalPrefix('api');

  // Безопасные заголовки
  app.use(
    helmet({
      // В dev отключаем CSP, чтобы не мешала, в проде — включится по умолчанию
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // Куки
  app.use(cookieParser());

  // Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ---------- CORS ----------
  const isProd = process.env.NODE_ENV === 'production';

  const rawList =
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000,http://localhost:3001';

  const allowlist = rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const vercelWildcard = /\.vercel\.app$/i;

  app.enableCors({
    origin: (origin, callback) => {
      // Для SSR/CLI/health‑checks без Origin — пропускаем
      if (!origin) return callback(null, true);

      let hostname: string;
      try {
        hostname = new URL(origin).hostname;
      } catch {
        return callback(new Error('CORS: invalid Origin'), false);
      }

      const allowed =
        allowlist.includes(origin) || (isProd && vercelWildcard.test(hostname)); // опционально: *.vercel.app только в проде

      if (allowed) return callback(null, true);
      return callback(
        new Error(`CORS: Origin not allowed -> ${origin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // --------------------------

  // Health‑check для ALB/ECS/K8s
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: Request, res: Response) => {
    res.status(200).send('ok');
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0'); // важно для Docker/ECS

  const appUrl = await app.getUrl();
  console.log(`[BOOT] NODE_ENV=${process.env.NODE_ENV}  PORT=${port}`);
  console.log(`[BOOT] API: ${appUrl}/api  HEALTH: ${appUrl}/health`);
  console.log(`[BOOT] CORS allowlist: ${allowlist.join(', ')}`);
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
