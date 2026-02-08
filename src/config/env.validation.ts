import * as Joi from 'joi';

/**
 * Joi schema that validates required environment variables at startup.
 *
 * Only DATABASE_URL and JWT_SECRET are truly required — everything else
 * defaults to empty/safe values so the container can always start.
 * Missing optional vars are logged as warnings in `main.ts`.
 */
export const envValidationSchema = Joi.object({
  // ── Core ──────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // ── Database (critical — server cannot function without it) ──
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required (PostgreSQL connection string)',
  }),

  // ── Auth: JWT (critical — auth routes will crash without it) ─
  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_SECRET is required (min 16 characters)',
    'string.min': 'JWT_SECRET must be at least 16 characters',
  }),

  // ── Auth: Google OAuth (optional — OAuth flow will fail) ─────
  GOOGLE_CLIENT_ID: Joi.string().default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().default(''),

  // ── AWS / S3 (optional — uploads will fail) ──────────────────
  AWS_REGION: Joi.string().default(''),
  S3_BUCKET: Joi.string().default(''),
  CDN_BASE_URL: Joi.string().default(''),

  // ── Optional (validated but not required) ─────────────────────
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  FRONTEND_URL: Joi.string().optional(),
  FRONTEND_URLS: Joi.string().optional(),
  FRONTEND_SUCCESS_PATH: Joi.string().optional(),
  COOKIE_DOMAIN: Joi.string().optional(),
  GOOGLE_CALLBACK_URL: Joi.string().optional(),
  BACKEND_PUBLIC_URL: Joi.string().optional(),
  ALLOW_ALL_CORS: Joi.string().optional(),
  DATABASE_SSL: Joi.string().optional(),
  PGSSLMODE: Joi.string().optional(),
}).options({
  // Allow env vars not listed here (e.g. PATH, HOME, etc.)
  allowUnknown: true,
});
