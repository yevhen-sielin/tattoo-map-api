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
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { User as JwtUser } from './types';

/**
 * Extracts the current user from req.user (after JwtAuthGuard)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Start Google OAuth flow.
   * This endpoint only triggers Passport redirect to Google.
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {
    // Passport handles the redirect to Google
  }

  /**
   * Callback from Google OAuth.
   * Sets an httpOnly cookie with JWT and redirects to frontend.
   *
   * ENV:
   *  - FRONTEND_URL             (e.g. http://localhost:3001)
   *  - FRONTEND_SUCCESS_PATH    (optional, default "/")
   *  - COOKIE_DOMAIN            (optional, e.g. ".example.com" for prod)
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const isProd = process.env.NODE_ENV === 'production';

    // Frontend origin and success path
    const frontendOrigin =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const successPath = this.config.get<string>('FRONTEND_SUCCESS_PATH') ?? '/';

    // Support returnTo path via OAuth state (e.g. /profile)
    let returnTo: string | undefined;
    const rawState = typeof req.query.state === 'string' ? req.query.state : undefined;
    if (rawState && rawState.startsWith('/')) {
      returnTo = rawState;
    }

    // JWT is attached to req.user by the strategy
    const payload = (req.user ?? {}) as { accessToken?: string };
    const token = payload?.accessToken;

    // Cookie options
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      domain: cookieDomain,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    if (token) {
      res.cookie('accessToken', token, cookieOpts);
    }

    const target = `${frontendOrigin.replace(/\/$/, '')}${
      returnTo ?? successPath
    }`;

    return res.redirect(302, target);
  }

  /**
   * Returns the currently authenticated user (requires JWT)
   */
  @Get('me')
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
            avatar: true,
            photos: true,
            lat: true,
            lon: true,
          },
        },
      },
    });

    const toNum = (v: any) =>
      v == null ? null : typeof v?.toNumber === 'function' ? v.toNumber() : Number(v);

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
          avatar: dbUser.artist.avatar,
          photos: dbUser.artist.photos,
          lat: toNum(dbUser.artist.lat),
          lon: toNum(dbUser.artist.lon),
        }
      : null;

    return {
      sub: dbUser?.id ?? user.sub,
      role: dbUser?.role ?? user.role,
      name: dbUser?.name,
      avatar: dbUser?.avatar,
      artist,
    };
  }

  /**
   * Logout by clearing the JWT cookie
   */
  @Get('logout')
  logout(@Res() res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN') || undefined;

    res.clearCookie('accessToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain: cookieDomain,
      path: '/',
    });

    return res.json({ success: true });
  }
}