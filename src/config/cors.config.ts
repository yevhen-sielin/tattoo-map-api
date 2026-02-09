// src/config/cors.config.ts
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { PRODUCTION_ORIGINS, LOCAL_ORIGINS } from './constants';

/**
 * Returns a normalized allowlist of frontend origins that are permitted to call the API.
 * Combines env-driven values with required production domains.
 */
export function getEffectiveCorsAllowlist(): string[] {
  const rawList =
    process.env.FRONTEND_URLS || process.env.FRONTEND_URL || LOCAL_ORIGINS;

  const allowlist = rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always include primary production domains
  for (const origin of PRODUCTION_ORIGINS) {
    if (!allowlist.includes(origin)) allowlist.push(origin);
  }

  return allowlist;
}

/**
 * Build CORS options for Nest. Allows an allowlist plus optional Vercel wildcard in prod.
 */
export function getCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const allowlist = getEffectiveCorsAllowlist();
  // ALLOW_ALL_CORS is only respected in non-production environments
  const allowAll = !isProd && process.env.ALLOW_ALL_CORS === '1';

  if (allowAll) {
    console.warn(
      '[CORS] ALLOW_ALL_CORS is active — all origins accepted (dev only)',
    );
  }

  return {
    origin: (origin, callback) => {
      // Allow server-side calls or health checks without Origin
      if (!origin) return callback(null, true);

      let hostname: string;
      try {
        hostname = new URL(origin).hostname;
      } catch {
        // Do not throw — just disable CORS for invalid origin to avoid 500s
        return callback(null, false);
      }

      // Explicit subdomain allowlist — prevent dangling CNAME abuse
      const ALLOWED_SUBDOMAINS = [
        'tattmap.com',
        'www.tattmap.com',
        'api.tattmap.com',
        'dev.tattmap.com',
        'staging.tattmap.com',
      ];

      // Only allow Vercel previews matching our project prefix
      const isVercelPreview =
        isProd && /^tattoo-map-[\w-]+\.vercel\.app$/i.test(hostname);

      const isAllowedHostname =
        ALLOWED_SUBDOMAINS.includes(hostname) || isVercelPreview;

      const allowed =
        allowAll || allowlist.includes(origin) || isAllowedHostname;

      if (allowed) return callback(null, true);
      // Important: don't error out — just respond without CORS headers
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    // Some proxies/preflight clients expect 204 instead of default 204/204 fallback
    // Note: this property is supported by the underlying CORS middleware
    optionsSuccessStatus: 204,
  };
}
