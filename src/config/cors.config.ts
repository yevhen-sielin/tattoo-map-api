import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Returns a normalized allowlist of frontend origins that are permitted to call the API.
 * Combines env-driven values with required production domains.
 */
export function getEffectiveCorsAllowlist(): string[] {
  const rawList =
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000,http://localhost:3001';

  const allowlist = rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always include primary production domains
  for (const origin of ['https://tattmap.com', 'https://www.tattmap.com']) {
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
  const vercelWildcard = /\.vercel\.app$/i;

  return {
    origin: (origin, callback) => {
      // Allow server-side calls or health checks without Origin
      if (!origin) return callback(null, true);

      let hostname: string;
      try {
        hostname = new URL(origin).hostname;
      } catch {
        return callback(new Error('CORS: invalid Origin'), false);
      }

      const allowed =
        allowlist.includes(origin) || (isProd && vercelWildcard.test(hostname));

      if (allowed) return callback(null, true);
      return callback(
        new Error(`CORS: Origin not allowed -> ${origin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
