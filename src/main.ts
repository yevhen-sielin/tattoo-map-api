import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  getCorsOptions,
  getEffectiveCorsAllowlist,
} from './config/cors.config';

dotenv.config({ override: process.env.NODE_ENV !== 'production' });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ---------- CORS ----------
  app.enableCors(getCorsOptions());
  const allowlist = getEffectiveCorsAllowlist();
  // --------------------------

  // Health‑check для ALB/ECS/K8s
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: Request, res: Response) => {
    res.status(200).send('ok');
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const appUrl = await app.getUrl();
  console.log(`[BOOT] NODE_ENV=${process.env.NODE_ENV}  PORT=${port}`);
  console.log(`[BOOT] API base: ${appUrl}  HEALTH: ${appUrl}/health`);
  console.log(`[BOOT] CORS allowlist: ${allowlist.join(', ')}`);
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
  process.exit(1);
});
