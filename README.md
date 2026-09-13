# Makuro ⚡

Fullstack template dengan **satu port, tanpa CORS, siap production**. Frontend dan backend berjalan dalam satu proses Elysia — tidak ada proxy, tidak ada CORS config, cookies langsung bekerja.

```
Browser  →  Bun/Node :3005
              /api/auth/*  →  Better Auth
              /api/*       →  Elysia API (Eden Treaty)
              /assets/*    →  static Vite (immutable, prod)
              /*           →  React Router v8 SSR
```

## Apa yang sudah ada

| Fitur | Detail |
|---|---|
| **Single-port** | API + SSR dalam satu Elysia server, dev dan prod identik |
| **Type safety end-to-end** | Eden Treaty: tipe client diekstrak dari route Elysia, tanpa codegen |
| **Auth lengkap** | Better Auth: Google OAuth, email+password, multi-session, sistem role |
| **SSR tanpa waterfall** | React Router v8 loader berjalan server-side, session tersedia di loader |
| **ORM type-safe** | Drizzle ORM + PostgreSQL, schema-as-code, migration files, Drizzle Studio |
| **UI kit terkonfigurasi** | Mantine v9, TanStack Query, Zustand, Biome — semua sudah terhubung |

## Stack

| Layer | Tech | Versi |
|---|---|---|
| Runtime | Bun | 1.4.x |
| Backend | Elysia + Eden Treaty | 1.4.x |
| Auth | Better Auth (Drizzle adapter) | 1.7.x |
| ORM / DB | Drizzle ORM + PostgreSQL | 0.45 / PG 16 |
| Frontend | React Router v8 SSR + React | 8.x / 19.x |
| UI | Mantine + @mantine/form | 9.6.x |
| Data fetching | TanStack Query | 5.x |
| Client state | Zustand | 5.x |
| Validation | TypeBox (API) + Zod (env) | 0.34 / 4.x |
| Tooling | Biome, Pino, TypeScript, Vite | 2.5 / 10 / 7 / 8 |

## Quick start

```bash
# 1. Install
bun install

# 2. Konfigurasi env
cp .env.example .env
# Wajib: DATABASE_URL, BETTER_AUTH_SECRET (openssl rand -base64 32)
# Opsional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 3. Buat database dan jalankan migrasi
# Opsi A — pakai Postgres yang sudah ada:
#   psql -c "CREATE DATABASE makuro;"
# Opsi B — spin up lokal dengan Docker:
#   docker compose --profile local-db up -d
bun run db:migrate

# 4. Dev server (single port, HMR)
bun run dev   # → http://localhost:3005

# 5. Production
bun run build
bun run start
```

## Scripts

| Script | Fungsi |
|---|---|
| `bun run dev` | Dev server satu port (Elysia + Vite HMR + RR SSR) |
| `bun run build` | Build client + server bundle |
| `bun run start` | Production server (`server/prod.ts`) |
| `bun run build:binary` | Build binary native (platform saat ini) |
| `bun run build:binary:linux` | Cross-compile ke Linux x64 glibc |
| `bun run build:binary:linux-musl` | Cross-compile ke Linux x64 musl (Alpine/Docker) |
| `bun run typecheck` | `react-router typegen` + `tsc --noEmit` |
| `bun run lint` | Biome check |
| `bun run format` | Biome format --write |
| `bun run db:generate` | Generate SQL migration dari Drizzle schema |
| `bun run db:migrate` | Apply migration |
| `bun run db:push` | Push schema langsung (interaktif) |
| `bun run db:studio` | Drizzle Studio |
| `bun run test` | Test suite (bun:test, `tests/`, pakai DATABASE_URL_TEST) |

## Binary distribution (tanpa Bun di server)

```bash
# Build binary untuk platform saat ini
bun run build:binary          # → ./makuro

# Cross-compile ke Linux (dari Mac atau mana saja)
bun run build:binary:linux      # → ./makuro-linux-x64     (Ubuntu/Debian)
bun run build:binary:linux-musl # → ./makuro-linux-musl    (Alpine, Docker)

# Jalankan di server — satu file, tanpa perlu install Bun atau build/ folder
./makuro-linux-x64
```

**Satu file, tidak ada dependensi eksternal:**

```
makuro-linux-x64   ← binary ~130 MB — semua embedded:
                     • Bun runtime (JavaScriptCore)
                     • Server code (Elysia, Better Auth, Drizzle)
                     • React Router SSR bundle
                     • Seluruh static assets (CSS, JS, favicon, dll)
```

Seperti Go binary: copy satu file ke server, langsung jalan. Tidak perlu `build/`, tidak perlu Node/Bun, tidak perlu `npm install`.

> **Teknik:** SSR bundle di-embed via static `import * as ssrBuild from '../build/server/index.js'` — Bun bundler mengikuti static import dan mem-bundle seluruh dependensi (`@react-router/node`, `react-dom`, dll) ke dalam binary. `--asset ./build/client` embed seluruh direktori client ke VFS (tersedia di runtime sebagai `client/` — satu level parent directory di-strip). `inlineDynamicImports: true` di Vite memastikan SSR bundle adalah satu file tunggal tanpa dynamic chunk splits.

> **Catatan:** Binary lebih besar (~130 MB) karena embed Bun runtime (JavaScriptCore). Trade-off yang sama dengan semua single-binary JS runtimes (Deno, Node SEA).

## Struktur project

```
app/                   React Router app (SSR)
  root.tsx             Provider: Mantine, TanStack Query, ModalsProvider
  routes.ts            Konfigurasi route (per-role layout guards)
  routes/
    home.tsx           Landing page
    login.tsx          Login / signup (Google OAuth + email)
    go.tsx             Post-auth resolver (arahkan ke home role)
    user/              Area user: /profile
    admin/             Area admin: /dashboard
    super/             Area super-admin: /dev, /dev/settings, dll
  components/
    AppFrame.tsx       Shell sidebar yang dipakai semua layout
    UserMenu.tsx       Avatar + account switcher + sign out
  lib/
    eden.ts            Eden Treaty client (type-safe ke Elysia API)
    auth-client.ts     Better Auth client
server/
  env.ts               Env vars divalidasi Zod
  auth.ts              Better Auth config (Drizzle adapter, plugins)
  guard.ts             requireRole / requireAnyRole
  permissions.ts       ROLES, homeFor(role), canBan(actor, target)
  api/
    index.ts           Elysia app, mount semua sub-router
    admin.ts           Admin API (list users, ban, role change)
    settings.ts        App settings API (GET public, PUT super-admin)
  db/
    schema.ts          Drizzle schema (user, session, account, app_setting, ...)
    migrations/        SQL migration files
  settings.ts          getSettings / upsertSettings
  http-bridge.ts       Node ↔ Fetch Request/Response bridge
  dev.ts               Dev server (Elysia + Vite middleware mode)
  prod.ts              Production server (Bun.serve)
```

## Cara single-port bekerja

**Dev** (`server/dev.ts`): Node `http` server di satu port. `/api/*` ke Elysia; sisanya ke Vite dev middleware (assets + HMR), lalu ke React Router SSR handler (`virtual:react-router/server-build`).

**Prod** (`server/prod.ts`): `Bun.serve` di satu port. `/api/*` → Elysia, static assets dari `build/client` dengan immutable cache, sisanya → compiled React Router server build.

Karena FE dan BE satu origin: Eden client dan Better Auth client pakai relative URL — tanpa CORS, cookies langsung bekerja.

## Auth & roles

Sistem role: `user` → `admin` → `super-admin`. Role tersimpan di tabel `user` via Better Auth admin plugin.

| Role | Home | Area |
|---|---|---|
| `user` | `/profile` | Profile, settings akun |
| `admin` | `/dashboard` | Dashboard, manajemen user (ban, role change) |
| `super-admin` | `/dev` | Users, DB schema, visit log, login log, rate limit, app settings |

Google OAuth: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Authorized redirect URI di Google Console: `${BETTER_AUTH_URL}/api/auth/callback/google`.

## Visitor analytics

Setiap page navigation (bukan `/api/*`, aset, atau loader `.data`) dicatat ke `visit_log` oleh `server/middleware/visitor.ts` dan ditampilkan di `/dev/visits` (super-admin): statistik, breakdown negara/perangkat/browser/OS/halaman/referer, filter, detail per kunjungan, hapus massal, dan export CSV.

Data yang dikumpulkan per kunjungan: IP, path, referer (query string dibuang), user login, tipe bot (`isbot`), browser/OS/versi dan jenis perangkat (parser in-house + Client Hints di `visitor-ua.ts`), bahasa (`Accept-Language`), serta negara/wilayah/kota.

**Negara & kota dibaca dari header proxy** — tidak ada database GeoIP atau lookup pihak ketiga. Pastikan app berjalan di belakang salah satu:

| Proxy | Header yang dibaca |
|---|---|
| Cloudflare | `CF-IPCountry` (default), `CF-Region-Code`, `CF-IPCity` (aktifkan *Managed Transforms → Add visitor location headers*) |
| Vercel | `X-Vercel-IP-Country`, `X-Vercel-IP-Country-Region`, `X-Vercel-IP-City` |
| CloudFront | `CloudFront-Viewer-Country`, `-Country-Region`, `-City` |
| nginx + geoip2 | `X-Country-Code`, `X-Region`, `X-City` |

Tanpa header tersebut kolom geo bernilai `null`; UI menampilkan "Lokal" untuk IP privat/loopback dan "Tidak diketahui" untuk sisanya.

Login log (`/dev/login-logs`) memakai enrichment yang sama plus kolom `method` (email / provider OAuth / impersonation / switch) dari endpoint Better Auth yang membuat sesi; API `/api/analytics/login-logs` punya bentuk yang sama (`search`, `country`, `device`, `method`, `userId`, `days`, `/stats`, `/export`, `DELETE` massal).

API (`/api/analytics/visits`, super-admin): `GET` list dengan query `page`, `limit`, `sort`, `search`, `type=human|bot`, `country`, `device`, `browser`, `os`, `days`; `GET /stats`; `GET /export` (CSV, maks. 10.000 baris, filter sama); `DELETE /:id`; `DELETE` body `{ ids: string[] }` (maks. 100).

## Testing

```bash
# Pastikan DATABASE_URL_TEST di .env
bun run test
```

Semua test ada di root `tests/` (mirror struktur `server/`). Gunakan `bun run test` — script inilah yang men-set `NODE_ENV=test`; menjalankan `bun test tests` langsung tidak akan memakai test database. Test database dipisah dari dev/prod (`DATABASE_URL_TEST`). Guard bisa di-bypass di integration test dengan `mock.module('../../server/guard', ...)` — bun:test otomatis hoist mock di atas static import.

## Catatan teknis

- **SSR di Bun**: import `react-dom/server.node` bukan bare `react-dom/server` (bare specifier resolve ke web-streams build tanpa `renderToPipeableStream`).
- **No FOUC**: `ColorSchemeScript` + inline `<style>` blocking di `<head>` di `root.tsx` — background warna yang benar dirender sebelum Mantine CSS dimuat.
- **Multiple Set-Cookie**: `http-bridge.ts` pakai `Headers.getSetCookie()` (WinterCG) untuk kumpulkan semua Set-Cookie header, lalu set sekaligus sebagai array ke Node.js response. Ini kritis untuk multi-session Better Auth.
- **Sidebar collapsed state**: disimpan di cookie `mk-sidebar-collapsed`, dibaca server-side di layout loader — tidak ada flash saat hard reload.

## Lisensi

MIT
