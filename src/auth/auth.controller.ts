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
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { User as JwtUser } from './types';

type DecimalLike = { toNumber: () => number };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user,
);

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

  private toNum(v: unknown): number | null {
    if (v == null) return null;

    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
      return (v as DecimalLike).toNumber();
    }

    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }

    return null;
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
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  // ==== Google OAuth ====
  @Get('google')
  @Throttle({ short: { limit: 5, ttl: 1_000 }, medium: { limit: 20, ttl: 60_000 } })
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {}

  /** Callback от Google: ставим httpOnly cookie и редиректим на фронт */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const userWithToken = req.user as { accessToken?: string } | undefined;
    const token = userWithToken?.accessToken;
    this.setAuthCookie(res, token);
    return res.redirect(302, this.buildRedirectTarget(req));
  }

  // ==== Me / Logout ====
  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtUser) {
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
          city: dbUser.artist.city,
          country: dbUser.artist.country,
          countryCode: dbUser.artist.countryCode,
          address: dbUser.artist.address,
          nickname: dbUser.artist.nickname,
          description: dbUser.artist.description,
          styles: dbUser.artist.styles,
          instagram: dbUser.artist.instagram,
          beginner: dbUser.artist.beginner,
          coverups: dbUser.artist.coverups,
          color: dbUser.artist.color,
          blackAndGray: dbUser.artist.blackAndGray,
          email: dbUser.artist.email,
          website: dbUser.artist.website,
          tiktok: dbUser.artist.tiktok,
          facebook: dbUser.artist.facebook,
          telegram: dbUser.artist.telegram,
          whatsapp: dbUser.artist.whatsapp,
          wechat: dbUser.artist.wechat,
          snapchat: dbUser.artist.snapchat,
          avatar: dbUser.artist.avatar,
          photos: dbUser.artist.photos,
          lat: this.toNum(dbUser.artist.lat),
          lon: this.toNum(dbUser.artist.lon),
          geoRaw: dbUser.artist.geoRaw,
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

  /** Выход — очищаем JWT cookie */
  @Get('logout')
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
