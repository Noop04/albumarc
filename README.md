# Albumarc

Personalized song discovery powered by Spotify. Albumarc reads your taste, recommends songs you haven't saved yet, syncs them to a private **albumarc** playlist, and lets you play, skip, and like tracks in the browser.

## Features

- **Spotify OAuth** — taste profile from top artists and tracks
- **Smart recommendations** — excludes liked/top tracks, learns from skips and likes, avoids repeating recent picks
- **Music profile** — `/profile` page with top artists, tracks, and engagement stats
- **In-app playback** — Spotify Web Playback SDK (Premium) with 30-second preview fallback and a clear UX banner
- **albumarc playlist** — auto-synced private Spotify playlist, refreshed daily for active users
- **Analytics** — plays, likes, skips, and syncs stored in PostgreSQL
- **Caching** — Redis-backed recommendation (15 min) and profile (30 min) caches

## Tech Stack

- [Next.js 15](https://nextjs.org) (App Router)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) + Web Playback SDK
- [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team)
- [Upstash Redis](https://upstash.com) — rate limiting and caching (optional locally)
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)

## Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app (Development Mode is fine for personal use)
- PostgreSQL database (optional locally — app runs without it, but analytics and personalization history won't persist)
- Spotify Premium for full-length in-app playback

## Quick Start

```bash
git clone <repo-url>
cd albumarc
npm install
cp .env.example .env.local
```

Fill in `.env.local` — see [Environment variables](#environment-variables) below.

**Spotify Dashboard:**
1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URI: `http://127.0.0.1:3000/api/auth/spotify/callback` (use `127.0.0.1`, not `localhost`)
3. Add your Spotify account to the app's user allowlist (Development Mode)
4. Paste `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` into `.env.local`

```bash
npm run db:push   # if DATABASE_URL is set
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), connect Spotify, and start discovering songs.

## Environment Variables

Copy `.env.example` to `.env.local`. Required for local dev:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (`http://127.0.0.1:3000` locally) |
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret |
| `SESSION_SECRET` | Prod | Encrypts OAuth cookies (32+ chars; `openssl rand -base64 32`) |
| `DATABASE_URL` | Recommended | PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | Prod | Redis for rate limiting and caching |
| `UPSTASH_REDIS_REST_TOKEN` | Prod | Upstash Redis token |
| `CRON_SECRET` | Prod | Auth for daily playlist refresh cron |
| `SENTRY_DSN` | Optional | Error tracking |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run db:push      # Push schema to database
npm run db:studio    # Drizzle Studio (DB browser)
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/spotify` | GET | Start OAuth (`?reconnect=1` to re-approve scopes) |
| `/api/recommend` | GET | Personalized song recommendations |
| `/api/profile` | GET | Cached music taste profile |
| `/api/playlist/sync` | POST | Sync recommendations to albumarc playlist |
| `/api/player/play` | POST | Start playback |
| `/api/library/save` | POST | Save track to Liked Songs |
| `/api/analytics/event` | POST | Client-side playback events |
| `/api/cron/refresh-playlists` | GET | Daily background playlist refresh (cron auth) |
| `/api/health` | GET | Health check |

## Deployment

Deploy to [Vercel](https://vercel.com) or any Node.js host. Set all production env vars, use a **pooled** PostgreSQL connection string, and enable Upstash Redis.

`vercel.json` includes a daily cron (`08:00 UTC`) that refreshes playlists for active users. Set `CRON_SECRET` in Vercel — the platform sends it as `Authorization: Bearer <CRON_SECRET>` automatically.

After deploying, users who connected before the cron feature should hit **Reconnect** once so their refresh token is stored for background sync.

## Spotify Notes

- **Development Mode:** max 5 users, Premium required for the app owner, limited API endpoints
- **Extended Quota Mode:** required before a public launch at scale
- Metadata links back to Spotify; attribution footer shown on all pages
- OAuth scopes are minimal — see `src/lib/spotify/config.ts`

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities responsibly.

## License

[MIT](LICENSE) — see [LICENSE](LICENSE) for details.
