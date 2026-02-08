import * as Joi from 'joi';

/**
 * Joi schema that validates required environment variables at startup.
 * If any required variable is missing, NestJS will throw immediately
 * instead of crashing later at runtime with an opaque error.
 */
export const envValidationSchema = Joi.object({
  // ── Core ──────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // ── Database ──────────────────────────────────────────────────
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL is required (PostgreSQL connection string)',
  }),

  // ── Auth: JWT ─────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_SECRET is required (min 16 characters)',
    'string.min': 'JWT_SECRET must be at least 16 characters',
  }),

  // ── Auth: Google OAuth ────────────────────────────────────────
  GOOGLE_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_ID is required for Google OAuth',
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_SECRET is required for Google OAuth',
  }),

  // ── AWS / S3 ──────────────────────────────────────────────────
  AWS_REGION: Joi.string().required().messages({
    'any.required': 'AWS_REGION is required for S3 uploads',
  }),
  S3_BUCKET: Joi.string().required().messages({
    'any.required': 'S3_BUCKET is required for file uploads',
  }),
  CDN_BASE_URL: Joi.string().uri().required().messages({
    'any.required': 'CDN_BASE_URL is required (CloudFront distribution URL)',
  }),

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
