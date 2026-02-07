# Tattoo Map API

Backend service for [Tattoo Map](https://tattmap.com) — a platform that helps people discover tattoo artists on an interactive map.

## Tech Stack

- **Runtime:** Node.js 20, TypeScript
- **Framework:** NestJS 11
- **Database:** PostgreSQL 16, Prisma 7
- **Auth:** Google OAuth 2.0, JWT (httpOnly cookies)
- **Storage:** AWS S3 + CloudFront CDN
- **Hosting:** AWS ECS Fargate

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/auth/google` | — | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | — | OAuth callback |
| `GET` | `/auth/me` | JWT | Current user profile |
| `GET` | `/auth/logout` | — | Clear auth cookie |
| `GET` | `/tattoo-artist` | — | Search/filter artists |
| `GET` | `/tattoo-artist/top` | — | Top artists by likes |
| `GET` | `/tattoo-artist/:id` | — | Artist by ID |
| `POST` | `/tattoo-artist` | JWT | Create/update artist profile |
| `DELETE` | `/tattoo-artist` | JWT | Delete artist profile |
| `POST` | `/tattoo-artist/:id/like` | JWT | Like artist |
| `DELETE` | `/tattoo-artist/:id/like` | JWT | Unlike artist |
| `GET` | `/tattoo-artist/:id/like` | JWT | Check if liked |
| `POST` | `/uploads/signed-url` | JWT | Get S3 presigned upload URL |

### Search Parameters

`GET /tattoo-artist` supports:

- `styles` — filter by tattoo styles
- `countryCode`, `regionCode`, `city` — location filters
- `q` — text search (nickname)
- `beginner`, `color`, `blackAndGray`, `coverups` — boolean filters
- `centerLat`, `centerLon`, `radiusKm` — geo-radius search
- `limit` — result limit

## Database Schema

**Models:** User, Artist, Like

- **User** — Google OAuth profile (email, name, avatar, role)
- **Artist** — tattoo artist profile with location, styles, contacts, photos, geo coordinates
- **Like** — user-to-artist like (unique per pair)

## Local Development

Recommended: use [tattoo-map-infra](https://github.com/yevhen-sielin/tattoo-map-infra) for Docker Compose orchestration.

Standalone:

```bash
pnpm install
cp .env.dev .env
pnpm start:dev
```

### Database

```bash
pnpm prisma migrate dev    # apply migrations
pnpm prisma studio          # visual DB browser on :5555
pnpm db:seed                # seed sample data
pnpm db:reset:seed          # reset + seed
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct DB connection (migrations) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token TTL (default: `7d`) |
| `FRONTEND_URLS` | Allowed CORS origins (comma-separated) |
| `S3_BUCKET` | AWS S3 bucket for uploads |
| `CDN_BASE_URL` | CloudFront CDN base URL |
| `AWS_REGION` | AWS region |
| `COOKIE_DOMAIN` | Cookie domain (optional) |

## CI/CD

- **Push to `main`** — auto-deploy to dev (`api.dev.tattmap.com`)
- **Manual trigger** — deploy to prod (`api.tattmap.com`)

See `.github/workflows/` for details.

## Scripts

```bash
pnpm start:dev       # dev with watch mode
pnpm build           # production build
pnpm start:prod      # run production
pnpm test            # unit tests
pnpm test:e2e        # e2e tests
pnpm lint            # ESLint
pnpm format          # Prettier
```
