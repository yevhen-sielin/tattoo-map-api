# Production Deployment Instructions

## Pre-deployment Checklist

### 1. Apply Database Migration (REQUIRED)

Before deploying, run this SQL on the production database:

```sql
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "countryCodeAlpha3" VARCHAR(3);
```

Or use Prisma CLI (from a machine with access to prod DB):

```bash
npx prisma migrate deploy
```

### 2. Verify Changes

Current deployment includes:
- ✅ Add `countryCodeAlpha3` field (optional, nullable)
- ✅ Fix email/website validation (skip empty strings)
- ✅ Improve error logging for validation errors
- ✅ CDN URL configuration (already correct: `cdn.tattmap.com`)

All changes are **backward compatible** and **safe** for production.

## Deployment Steps

1. **Apply migration** (see above)
2. **Deploy backend** via GitHub Actions or AWS ECS
3. **Verify health**: `curl https://api.tattmap.com/health`
4. **Test endpoint**: `curl https://api.tattmap.com/tattoo-artist/top?limit=1`

## Rollback Plan

If issues occur:
1. Revert to previous Docker image in ECS
2. Migration is non-destructive (adds nullable column), no rollback needed
