import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  getCorsOptions,
  getEffectiveCorsAllowlist,
} from './config/cors.config';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { DEFAULT_PORT } from './config/constants';

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

  app.useGlobalFilters(new PrismaExceptionFilter());

  // ---------- CORS ----------
  app.enableCors(getCorsOptions());
  const allowlist = getEffectiveCorsAllowlist();
  // --------------------------

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  const appUrl = await app.getUrl();
  logger.log(`NODE_ENV=${process.env.NODE_ENV}  PORT=${port}`);
  logger.log(`API base: ${appUrl}  HEALTH: ${appUrl}/health`);
  logger.log(`CORS allowlist: ${allowlist.join(', ')}`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Error during bootstrap', err);
  process.exit(1);
});
