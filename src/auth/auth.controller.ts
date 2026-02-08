import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import type { User as JwtUser } from './types';
import { decimalToNumber } from '../common/utils/decimal.util';
import { AUTH_COOKIE_TTL_MS } from '../config/constants';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user,
);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ==== helpers ====
  private isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private buildRedirectTarget(req: Request): string {
    const origin =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const success = this.config.get<string>('FRONTEND_SUCCESS_PATH') ?? '/';
    const rawState =
      typeof req.query.state === 'string' ? req.query.state : undefined;
    const returnTo = rawState?.startsWith('/') ? rawState : undefined;
    return `${origin.replace(/\/$/, '')}${returnTo ?? success}`;
  }

  private setAuthCookie(res: Response, token?: string) {
    if (!token) return;
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    res.cookie('accessToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd(),
      domain: cookieDomain,
      path: '/',
      maxAge: AUTH_COOKIE_TTL_MS,
    });
  }

  // ==== Google OAuth ====
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @Throttle({
    short: { limit: 5, ttl: 1_000 },
    medium: { limit: 20, ttl: 60_000 },
  })
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {}

  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — sets cookie and redirects',
  })
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const userWithToken = req.user as { accessToken?: string } | undefined;
    const token = userWithToken?.accessToken;
    this.setAuthCookie(res, token);
    return res.redirect(302, this.buildRedirectTarget(req));
  }

  // ==== Me / Logout ====
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile (returns null if not authenticated)',
  })
  @ApiCookieAuth()
  @SkipThrottle()
  @UseGuards(OptionalJwtAuthGuard)
  async getMe(@CurrentUser() user: JwtUser | null) {
    // Not authenticated — return null with 200 (no console error in browser)
    if (!user) return null;
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        role: true,
        name: true,
        avatar: true,
        artist: {
          select: {
            city: true,
            country: true,
            countryCode: true,
            address: true,
            nickname: true,
            description: true,
            styles: true,
            instagram: true,
            beginner: true,
            coverups: true,
            color: true,
            blackAndGray: true,
            email: true,
            website: true,
            tiktok: true,
            facebook: true,
            telegram: true,
            whatsapp: true,
            wechat: true,
            snapchat: true,
            avatar: true,
            photos: true,
            lat: true,
            lon: true,
            geoRaw: true,
          },
        },
      },
    });

    const artist = dbUser?.artist
      ? {
          ...dbUser.artist,
          lat: decimalToNumber(dbUser.artist.lat),
          lon: decimalToNumber(dbUser.artist.lon),
        }
      : null;

    // Collect liked artist IDs for the current user
    const liked = await this.prisma.like.findMany({
      where: { userId: user.sub },
      select: { artistId: true },
    });
    const likedArtistIds = liked.map((l) => l.artistId);

    return {
      sub: dbUser?.id ?? user.sub,
      role: dbUser?.role ?? user.role,
      name: dbUser?.name,
      avatar: dbUser?.avatar,
      artist,
      likedArtistIds,
    };
  }

  @Get('logout')
  @ApiOperation({ summary: 'Clear auth cookie and log out' })
  logout(@Res() res: Response) {
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    res.clearCookie('accessToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProd(),
      domain: cookieDomain,
      path: '/',
    });
    return res.json({ success: true });
  }
}
