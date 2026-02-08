import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TattooArtistModule } from './tattoo-artist/tattoo-artist.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // report ALL missing vars, not just the first
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1_000, // 1 second
        limit: 10, // 10 requests per second per IP
      },
      {
        name: 'medium',
        ttl: 60_000, // 1 minute
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    TattooArtistModule,
    AuthModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
