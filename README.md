# Makuro — Fullstack Base Template (2026)

A batteries-included fullstack template where the **frontend and backend run on
a single port / origin**. Elysia is the HTTP server; it serves the API under
`/api/*` and hands everything else to the React Router v8 SSR handler. One
origin means **no CORS** and **seamless auth cookies**.

```
Bun : Elysia (single port)
  /api/auth/* -> Better Auth
  /api/*      -> Elysia API (+ Eden Treaty typesafe client)
  /assets/*   -> hashed static client assets (prod)
  /*          -> React Router v8 SSR
```

## Stack

| Layer | Tech |
|---|---|
| Runtime | Bun |
| Backend | Elysia + Eden Treaty |
| ORM / DB | Drizzle ORM + PostgreSQL |
| Auth | Better Auth (email + password) |
| Frontend | React Router v8 (SSR) + React 19 |
| UI | Mantine + @mantine/form |
| Data fetching | TanStack Query |
| Client state | Zustand |
| Validation | TypeBox (API) + Zod (env / shared) |
| Tooling | Biome, Pino, TypeScript |

## Quick start

```bash
# 1. Install
bun install

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL + set BETTER_AUTH_SECRET (openssl rand -base64 32)

# 3. Database
#    Option A: use an existing Postgres, just create the db:
#    docker exec <your-postgres> psql -U <user> -d postgres -c "CREATE DATABASE makuro;"
#    Option B: spin up a local one:
#    docker compose --profile local-db up -d

bun run db:generate   # create SQL migration from schema
bun run db:migrate    # apply migrations

# 4. Dev (single port, HMR)
bun run dev           # http://localhost:3005

# 5. Production
bun run build
bun run start
```

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Single-port dev server (Elysia + Vite middleware + RR SSR + HMR) |
| `bun run build` | Build client + server bundles (`react-router build`) |
| `bun run start` | Production single-port server (`server/prod.ts`) |
| `bun run typecheck` | `react-router typegen` + `tsc --noEmit` |
| `bun run lint` | Biome check |
| `bun run format` | Biome format --write |
| `bun run db:generate` | Generate SQL migration from Drizzle schema |
| `bun run db:migrate` | Apply migrations |
| `bun run db:push` | Push schema directly (interactive) |
| `bun run db:studio` | Drizzle Studio |
| `bun run auth:generate` | Regenerate Better Auth tables from config |

## Project layout

```
app/                 React Router app (SSR)
  root.tsx           Providers: Mantine + TanStack Query
  entry.client.tsx   Hydration
  entry.server.tsx   SSR render (react-dom/server.node under Bun)
  routes.ts          Route config
  routes/            home / login / dashboard
  lib/               eden client, query client, auth client
  stores/            Zustand stores
server/
  env.ts             Zod-validated env
  logger.ts          Pino
  auth.ts            Better Auth (Drizzle adapter)
  api/index.ts       Elysia API (TypeBox validation)
  db/                Drizzle client, schema, migrations
  http-bridge.ts     Node <-> Fetch Request/Response bridge
  dev.ts             Dev server (single port + Vite HMR)
  prod.ts            Production server (single port)
```

## How single-port works

- **Dev** (`server/dev.ts`): a Node `http` server on one port. `/api/*` goes to
  Elysia; everything else passes through the Vite dev middleware (assets + HMR),
  then to the React Router SSR handler loaded from
  `virtual:react-router/server-build`.
- **Prod** (`server/prod.ts`): `Bun.serve` on one port. `/api/*` -> Elysia,
  hashed assets served from `build/client` with immutable caching, everything
  else -> the compiled React Router server build.

## Notes

- Because FE + BE share an origin, the Eden client and Better Auth client both
  use relative URLs — no CORS, cookies just work.
- SSR under Bun must import `react-dom/server.node` (the bare specifier resolves
  to the web-streams build which lacks `renderToPipeableStream`).
- Auth session is checked server-side in route `loader`s (see
  `app/routes/dashboard.tsx`) so protected pages never flash.
- **Google OAuth**: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env`;
  the "Continue with Google" button appears automatically (see `server/auth.ts`
  `socialProviders` and `app/routes/login.tsx`). Authorized redirect URI in
  Google Console must be `${BETTER_AUTH_URL}/api/auth/callback/google`.
- **No white flash (FOUC) on hard reload**: `app/root.tsx` puts
  `ColorSchemeScript` (sets `data-mantine-color-scheme` synchronously) plus a
  blocking inline `<style>` in `<head>` that paints the correct light/dark
  background at first paint — before the main Mantine stylesheet loads (in dev
  Vite injects that CSS via JS after paint, which is what caused the flash).
