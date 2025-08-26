import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, StrategyOptions } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import type { User } from '@prisma/client';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  avatar: string | undefined;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    // Required Google credentials
    const clientID = config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientID || !clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
    }

    /**
     * Callback URL rules:
     * 1) If GOOGLE_CALLBACK_URL is set, use it (recommended for prod).
     * 2) Else derive from BACKEND_PUBLIC_URL (e.g. https://api.example.com).
     * 3) Else fall back to http://localhost:<PORT or 3000>.
     *
     * IMPORTANT: This must be a BACKEND origin (not the frontend).
     * Make sure the same URL is registered in the Google Console.
     */
    const explicitCallback = config.get<string>('GOOGLE_CALLBACK_URL');
    const backendPublic =
      config.get<string>('BACKEND_PUBLIC_URL') ??
      process.env.BACKEND_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 3000}`;

    const callbackURL =
      explicitCallback ||
      `${backendPublic.replace(/\/$/, '')}/auth/google/callback`;

    const options: StrategyOptions = {
      clientID,
      clientSecret,
      callbackURL,
      passReqToCallback: false, // set to true only if you need req inside validate()
      scope: ['profile', 'email'],
    };

    super(options);
  }

  /**
   * Optionally adjust Google authorization behavior.
   * These are appended to the initial /auth/google redirect.
   * (No req available here; for per-request params you'd need a custom AuthGuard.)
   */
  public authorizationParams(): Record<string, string> {
    return {
      // Force account chooser + consent if you want a predictable flow
      prompt: 'select_account',
      // Request a refresh token in production if needed (only for certain project types)
      // access_type: 'offline',
    };
  }

  /**
   * Called after Google redirects back to the callback with an auth code.
   * We receive the Google profile, then upsert user and create our JWT.
   * Whatever is returned here becomes req.user.
   */
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<{ user: User; accessToken: string }> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Google profile does not contain an email address');
    }

    const googleProfile: GoogleUser = {
      googleId: profile.id,
      email,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
    };

    const { user, accessToken: jwt } =
      await this.authService.validateOrCreateUser(googleProfile);

    // This object will be attached to req.user
    return { user, accessToken: jwt };
  }
}
