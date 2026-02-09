// ---------------------------------------------------------------------------
// Application-wide constants
// Extracted from inline magic numbers / strings across the codebase.
// ---------------------------------------------------------------------------

/** Auth session lifetime: 7 days */
export const AUTH_TTL_DAYS = 7;

/** Cookie time-to-live: 7 days in milliseconds */
export const AUTH_COOKIE_TTL_MS = AUTH_TTL_DAYS * 24 * 60 * 60 * 1000;

/** JWT token expiry — must match the cookie TTL to avoid silent 401s */
export const JWT_EXPIRY = `${AUTH_TTL_DAYS}d`;

/** Default port when PORT env var is not set */
export const DEFAULT_PORT = 3000;

/** Default query limit for artist search (sidebar / list views) */
export const DEFAULT_SEARCH_LIMIT = 50;

/** Max query limit for artist search (sidebar / list views) */
export const MAX_SEARCH_LIMIT = 500;

/** Production domain origins that are always allowed via CORS */
export const PRODUCTION_ORIGINS = [
  'https://tattmap.com',
  'https://www.tattmap.com',
] as const;

/** Fallback CORS origins for local development */
export const LOCAL_ORIGINS = 'http://localhost:3000,http://localhost:3001';
