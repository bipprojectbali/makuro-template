# Makuro ⚡

Fullstack template dengan **satu port, tanpa CORS, siap production**. Frontend dan backend berjalan dalam satu proses Elysia — tidak ada proxy, tidak ada CORS config, cookies langsung bekerja.

```
Browser  →  Bun/Node :3005
              /api/auth/*  →  Better Auth
              /api/*       →  Elysia API (Eden Treaty)
              /assets/*    →  static Vite (immutable, prod)
              /*           →  React Router v8 SSR
```

## Untuk AI agent

Dokumentasi ini adalah satu-satunya sumber dan bisa dibaca tanpa JavaScript:

- `GET /README.md` — file ini apa adanya (`text/markdown`), juga `/llms-full.txt` (`text/plain`).
- `GET /llms.txt` — indeks singkat (judul, ringkasan, daftar bagian, endpoint untuk agent), dibangkitkan dari heading README.
- `GET /api/version` — `{ name, version, env, bun }`, publik.
- `GET /api/openapi.json` — spec OpenAPI 3 untuk API REST, butuh API key apa pun yang valid (tanpa key → `401 API_KEY_REQUIRED`). Isinya hanya endpoint yang boleh dipanggil key tersebut; scope tiap operasi ada di field `x-required-scope`.
- API dipakai dengan header `X-API-Key: mk_live_…` atau `Authorization: Bearer mk_live_…`; scope per route ada di bagian **API keys**. Semua error API berbentuk JSON `{ error, code, status, requestId }`.
- Fitur produk dibangun di area `/app` (halaman) dan `/api/app/*` (endpoint), keduanya butuh login — lihat **Membangun fitur produk (`/app`)**. `/dev` khusus operasional, `/dashboard` khusus admin.
- Server MCP di `/api/mcp` (Streamable HTTP) menerima API key ber-scope `mcp`; katalog tool ada di bagian **Dev console → Tools & MCP**.

Untuk mesin pencari: `/robots.txt` (area login, konsol, dan API ditutup) dan `/sitemap.xml` dibangun dari `APP_URL`, sedangkan landing punya meta Open Graph/Twitter, `og:image` (`/og.png`, 1200×630), dan `canonical` — jadi set `APP_URL` ke origin publik di produksi.

Ketiga URL dokumentasi dilayani sebelum SSR, ber-ETag (`304` bila tidak berubah), tidak dihitung sebagai kunjungan, dan tetap tersedia saat mode maintenance.

## Apa yang sudah ada

| Fitur | Detail |
|---|---|
| **Single-port** | API + SSR dalam satu Elysia server, dev dan prod identik |
| **Type safety end-to-end** | Eden Treaty: tipe client diekstrak dari route Elysia, tanpa codegen |
| **Auth lengkap** | Better Auth: Google OAuth, email+password, multi-session, sistem role |
| **SSR tanpa waterfall** | React Router v8 loader berjalan server-side, session tersedia di loader |
| **ORM type-safe** | Drizzle ORM + PostgreSQL, schema-as-code, migration files, Drizzle Studio |
| **UI kit terkonfigurasi** | Mantine v9, TanStack Query, Zustand, Biome — semua sudah terhubung |
| **Dev console `/dev`** | 14 halaman operasional: users, sessions, posts, API keys, DB schema, log pengunjung/login/rate-limit/server/audit, file health, tools, settings — badge hidup di sidebar |
| **API keys** | Kunci `mk_live_…` ber-scope, kedaluwarsa, rotasi dengan masa tenggang, IP allow-list, rate limit per kunci, jejak pemakaian + rollup harian, kunci pribadi per user |
| **Observability** | Visitor/login/rate-limit log dengan geo & perangkat, audit trail semua aksi admin, buffer log server, retensi otomatis, mode maintenance, feature flags |
| **Error yang konsisten** | Halaman 404/401/403/5xx bermerek (sidebar tetap tampil di konsol), error API selalu `{ error, code, status, requestId }`, fallback HTML bila SSR gagal |
| **Ramah AI agent** | `/README.md` + `/llms.txt` teks polos, server MCP ber-API-key, tool file health agar konteks agent tidak meledak |

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
# Wajib: BETTER_AUTH_SECRET (openssl rand -base64 32)
# DATABASE_URL: isi untuk Postgres sendiri, atau KOSONGKAN untuk Postgres lokal otomatis
# Opsional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# Wajib di belakang reverse proxy/LB/Cloudflare: TRUSTED_PROXIES (IP/CIDR proxy, lihat "Rate limiting")

# 3. Database (pilih satu)
# Opsi A — tanpa Postgres: biarkan DATABASE_URL kosong, unduh runtime sekali
#   (migrasi otomatis saat boot, lihat "Database: dari lokal ke produksi"):
#   bun run cli init --db=local
# Opsi B — pakai Postgres yang sudah ada:
#   psql -c "CREATE DATABASE makuro;" && bun run db:migrate
# Opsi C — spin up lokal dengan Docker:
#   docker compose --profile local-db up -d && bun run db:migrate

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
| `bun run start` | Production server (`server/prod.ts`, NODE_ENV=production) |
| `bun run smoke:prod` | Build lalu boot `server/prod.ts` di port bebas dan jalankan 23 pemeriksaan black-box (`scripts/smoke-server.ts`) |
| `bun run smoke:binary` | Sama, tetapi terhadap binary hasil `build:binary` |
| `bun run smoke:coldboot` | Boot binary dari folder kosong dengan Postgres lokal (init → migrasi → start) |
| `bun run build:binary` | Build binary platform saat ini → `./makuro-template`; `-- --all` → `dist/` 4 target + `checksums.txt` |
| `bun run cli <cmd>` | CLI dari source: `init`, `doctor`, `version`, `backup`, `start` |
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
# Pasang dari GitHub Release (deteksi OS/arch, verifikasi sha256, → ~/.local/bin)
curl -fsSL https://raw.githubusercontent.com/bipprojectbali/makuro-template/main/install.sh | sh
#   MAKURO_VERSION=v0.1.0   pin versi (default: rilis terbaru)
#   MAKURO_INSTALL_DIR=…    folder tujuan (default: ~/.local/bin)
#   MAKURO_REPO=owner/repo  untuk fork

# Di folder app (jadi direktori kerja: .env, data/, backups/)
makuro-template init      # buat .env (secret acak), unduh runtime Postgres, initdb + migrasi
makuro-template doctor    # periksa kesiapan
makuro-template           # = start
```

Build sendiri: `bun run build:binary` → `./makuro-template` (platform saat ini), `bun run build:binary -- --all` → `dist/makuro-template-<os>-<arch>` untuk linux-x64, linux-arm64, darwin-arm64, darwin-x64 + `checksums.txt`. Push tag `v*` menjalankan `.github/workflows/release.yml` yang membangun dan mempublikasikan aset yang sama ke GitHub Release.

| Perintah | Fungsi |
|---|---|
| `start` (default) | Jalankan server. Mode Postgres lokal: start PG + migrasi otomatis dulu; gagal dengan petunjuk `init` bila runtime belum diunduh |
| `version [--json]` | Nama, versi, platform |
| `init [--yes] [--db=local\|external] [--database-url=…] [--pg-archive=file.tgz] [--systemd] [--force]` | Siapkan `.env`, runtime PG (atau `--pg-archive` untuk offline), database, dan opsional unit systemd |
| `doctor [--json]` | Cek lingkungan, `.env`, koneksi DB, runtime PG, migrasi pending, disk, port, umur backup; exit 1 bila ada ❌ |
| `backup [--out=dir] [--keep=7]` | Backup cold folder data PG lokal (hentikan server dulu), simpan N terakhir |
| `upgrade [--version=vX.Y.Z] [--check]` | Self-update dari GitHub Release dengan verifikasi sha256 |

Dari source: `bun run cli <perintah>`.

**systemd:** `makuro-template init --systemd` menulis `./makuro-template.service` (`User=` user saat ini, bukan root — Postgres menolak berjalan sebagai root) lalu mencetak langkah `sudo cp … /etc/systemd/system/` dan `sudo systemctl enable --now makuro-template`.

**Satu file, tidak ada dependensi eksternal:**

```
makuro-template   ← binary ~130 MB — semua embedded:
                     • Bun runtime (JavaScriptCore)
                     • Server code (Elysia, Better Auth, Drizzle)
                     • React Router SSR bundle
                     • Seluruh static assets (CSS, JS, favicon, dll)
                     • Migrasi database
                    (runtime Postgres lokal tidak di-embed — diunduh saat init)
```

Seperti Go binary: copy satu file ke server, langsung jalan. Tidak perlu `build/`, tidak perlu Node/Bun, tidak perlu `npm install`.

**Verifikasi sebelum deploy:** `bun run smoke:binary` membangun binary, menjalankannya di port acak dengan `NODE_ENV=production`, lalu memeriksa versi, SSR landing/login, redirect guard, favicon, probe, halaman 404, JSON 404 API, Better Auth, penolakan API key palsu dan MCP anonim, `/README.md`, `/llms.txt`, meta OG landing, `/robots.txt`, `/sitemap.xml`, gambar OG, apple-touch-icon, header rate limit, `X-Forwarded-For`/`X-Real-IP` palsu dari klien tak tepercaya yang diabaikan, dan aset client ber-cache immutable. `bun run smoke:prod` melakukan hal yang sama untuk mode skrip (`bun run start`). Keduanya keluar dengan kode ≠ 0 bila ada yang gagal.

**NODE_ENV:** binary men-default `NODE_ENV=production`, tetapi Bun otomatis memuat `.env` dari direktori kerja — bila file itu berisi `NODE_ENV=development`, binary berjalan dalam mode development (detail error API terbuka, tanpa log file) dan mencetak peringatan saat start. Di server, gunakan `.env` tanpa `NODE_ENV` atau set `production`.

> **Teknik:** SSR bundle di-embed via static `import * as ssrBuild from '../build/server/index.js'` — Bun bundler mengikuti static import dan mem-bundle seluruh dependensi (`@react-router/node`, `react-dom`, dll) ke dalam binary. `--asset ./build/client` embed seluruh direktori client ke VFS (tersedia di runtime sebagai `client/` — satu level parent directory di-strip). `inlineDynamicImports: true` di Vite memastikan SSR bundle adalah satu file tunggal tanpa dynamic chunk splits.

> **Catatan:** Binary lebih besar (~130 MB) karena embed Bun runtime (JavaScriptCore). Trade-off yang sama dengan semua single-binary JS runtimes (Deno, Node SEA).

## Database: dari lokal ke produksi

Satu dialect (PostgreSQL) di semua tahap — yang berganti hanya siapa yang menjalankan Postgres.

**Postgres lokal otomatis** aktif bila `DATABASE_URL` kosong atau `LOCAL_PG_DIR` diset. Bila `DATABASE_URL` diisi, perilaku sama seperti biasa.

- Runtime PostgreSQL 18.4 dari paket npm `@embedded-postgres/<os>-<arch>` (MIT), diunduh sekali saat `init`, hash sha512 di-pin di binary. Disimpan di cache global `~/.cache/makuro-template/pg/18.4.0/<platform>` (`XDG_CACHE_HOME` dihormati), dipakai bersama semua folder app.
- Data di `./data/pg` (`LOCAL_PG_DIR`), port `54329` (`LOCAL_PG_PORT`). Tanpa listener TCP: koneksi hanya lewat unix socket di direktori 0700 milik user (`/tmp/makuro_template-pg-<uid>`, ubah dengan `LOCAL_PG_SOCKET_DIR`), sehingga user lain di mesin yang sama tidak bisa masuk. Zona waktu database selalu UTC. Postmaster yatim dari proses yang di-`kill -9` dihentikan otomatis saat start berikutnya. Migrasi berjalan otomatis saat boot (dev, `start`, binary).
- Platform: linux-x64, linux-arm64 (glibc), darwin-arm64, darwin-x64. musl/Alpine tidak didukung untuk mode lokal.
- Postgres menolak berjalan sebagai root — jalankan app sebagai user biasa.

**Tangga pertumbuhan:**

1. **Dev** — `bun run dev` dengan `DATABASE_URL` kosong: PG lokal start sendiri.
2. **Produksi kecil** — satu VPS: binary + PG lokal + `init --systemd`, `backup` terjadwal (cold: hentikan service sebentar).
3. **Membesar** — Postgres Docker atau terkelola: pindahkan data, isi `DATABASE_URL`, selesai.

**Pindah ke Postgres Docker/terkelola** — pakai `pg_dump` dengan versi mayor yang sama (18), jangan salin folder data mentah (locale/glibc bisa berbeda):

```bash
# Saat PG lokal berjalan (app aktif)
PGSOCK=/tmp/makuro_template-pg-$(id -u)   # atau nilai LOCAL_PG_SOCKET_DIR
docker run --rm --user "$(id -u)" -v "$PGSOCK:$PGSOCK" postgres:18 \
  pg_dump -h "$PGSOCK" -p 54329 -U postgres makuro_template > dump.sql
# Restore ke tujuan, lalu set DATABASE_URL di .env dan restart
psql "$DATABASE_URL" < dump.sql
```

**Docker:** image runtime berjalan sebagai `USER bun` dengan `VOLUME /app/data`; default tetap memakai `DATABASE_URL` eksternal.

## Struktur project

```
app/                    React Router app (SSR)
  root.tsx              Provider (Mantine, TanStack Query, Modals) + ErrorBoundary root
  entry.server.tsx      Streaming SSR + handleError (404 senyap, sisanya ke pino)
  routes.ts             Konfigurasi route (per-role layout guards)
  routes/
    home.tsx            Landing page (angka hidup dari server/landing-stats.ts)
    login.tsx  go.tsx   Login/signup, post-auth resolver ke home role
    app/  admin/        Area /app + /profile dan /dashboard (layout + ErrorBoundary ber-sidebar)
    super/              Area /dev: 14 halaman konsol super-admin
  components/
    AppFrame.tsx frame/ Shell sidebar (nav model, badge, brand header)
    errors/             ErrorPage (standalone), ErrorPanel, AreaErrorBoundary
    logs/               Komponen bersama halaman log: StatTile, BreakdownPanel, LogCells, DetailParts
    api-keys/ users/ sessions/ posts/ settings/ profile/ … komponen per halaman
  lib/                  Klien API bertipe per domain (*-api.ts), error-page.ts, theme, query
server/
  env.ts                Env vars divalidasi Zod
  auth.ts               Better Auth (Drizzle adapter, admin + apiKey plugin)
  guard.ts              requireRole / requireAnyRole / resolveActor (sesi atau API key)
  permissions.ts roles  ROLES, homeFor(role), rekonsiliasi super-admin dari env
  api/
    index.ts            Elysia app: error plugin → rate limit → maintenance → api key → router
    *.ts  *.query.ts    Route handler (≤150 baris) dan query per domain
  api-keys/             scopes, plugin (onRequest), service/query, usage + rollup harian
  api-error.ts          Bentuk JSON error seragam + requestId
  error-page.ts         HTML fallback 500/503 tanpa React
  readme.ts             /README.md, /llms.txt, /llms-full.txt dari satu sumber
  http-probes.ts        favicon.ico, .well-known, apple-touch-icon sebelum SSR
  seo.ts                /robots.txt dan /sitemap.xml dari APP_URL sebelum SSR
  sidebar-badges.ts     Counter badge sidebar /dev (cache 15 dtk)
  settings*.ts          app_setting: auth, rate limit, retensi, maintenance, flags, branding
  middleware/           client-ip, visitor (+geo, UA), rate-limiter, maintenance
  mcp/                  Server MCP + tool (status, log, DB, file health)
  file-health/          Pemindai ukuran file / risiko konteks agent
  db/
    schema.*.ts         Drizzle schema per concern (auth, app, logs, keys)
    migrations/         SQL migration idempotent (0001…0012)
  http-bridge.ts        Node ↔ Fetch Request/Response bridge
  dev.ts  prod.ts       Dev server (Vite middleware) dan Bun.serve produksi
tests/                  bun:test, mirror struktur server/ (DATABASE_URL_TEST)
```

## Cara single-port bekerja

**Dev** (`server/dev.ts`): Node `http` server di satu port. `/api/*` ke Elysia; sisanya ke Vite dev middleware (assets + HMR), lalu ke React Router SSR handler (`virtual:react-router/server-build`).

**Prod** (`server/prod.ts`): `Bun.serve` di satu port. `/api/*` → Elysia, static assets dari `build/client` dengan immutable cache, sisanya → compiled React Router server build.

Karena FE dan BE satu origin: Eden client dan Better Auth client pakai relative URL — tanpa CORS, cookies langsung bekerja.

## Auth & roles

Sistem role: `user` → `admin` → `super-admin`. Role tersimpan di tabel `user` via Better Auth admin plugin.

| Role | Home | Area |
|---|---|---|
| `user` | `/app` | Fitur produk (`/app`), profil, keamanan akun, sesi perangkat, API key pribadi |
| `admin` | `/dashboard` | Dashboard, manajemen user (ban, role change), API key pribadi |
| `super-admin` | `/dev` | Overview, users, sessions, posts, DB schema, visitor/login/rate-limit/server/audit logs, file health, tools & MCP, settings |

Area `/app` dan `/profile` terbuka untuk semua role yang sudah masuk; admin dan super-admin membukanya lewat tautan **App** di sidebar.

Google OAuth: set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Authorized redirect URI di Google Console: `${BETTER_AUTH_URL}/api/auth/callback/google`.

**Ban & hapus akun — apa yang dilihat user.** Better Auth sendiri hanya menolak *pembuatan sesi baru* untuk user yang diblokir; template ini melengkapinya:

- Saat admin memblokir (`POST /api/admin/users/:id/ban`), semua sesi aktif user itu dicabut seketika (tercatat di audit). Request berikutnya dari perangkat user diarahkan ke `/login?notice=session` dengan pesan bahwa sesi berakhir.
- Bila user yang diblokir masih memegang sesi (misalnya diblokir lewat jalur lain), guard (`server/guard.ts`) menolaknya dan mengarahkan ke **`/banned`**: halaman yang menampilkan alasan, apakah permanen atau sampai kapan (dengan hitung mundur), langkah yang bisa dilakukan, tautan dukungan dari branding, tombol keluar, dan ke beranda. Ban yang sudah lewat waktunya diperlakukan sebagai dicabut.
- Saat mencoba masuk lagi, halaman login menerjemahkan kode Better Auth (`BANNED_USER`, `INVALID_EMAIL_OR_PASSWORD`, `USER_NOT_FOUND`, …) ke pesan bahasa Indonesia yang actionable; login Google yang ditolak kembali ke `/login?error=<kode>` (bukan halaman error mentah Better Auth) berkat `errorCallbackURL`.
- User yang **dihapus permanen** kehilangan sesinya (cascade), sehingga perangkatnya mendapat notice "sesi berakhir" di login; mencoba masuk dengan email lama menghasilkan "akun tidak ditemukan", dan login Google akan membuat akun baru yang bersih. Tidak ada jejak yang disimpan tentang akun yang dihapus (selain audit log admin).

## Membangun fitur produk (`/app`)

Template ini dipakai sebagai dasar project lain, jadi fitur produk punya satu tempat default:

- **Halaman** — `app/routes/app/<nama>.tsx`, didaftarkan sebagai child layout `routes/app/layout.tsx` di `app/routes.ts`, plus item `NAV` di layout itu. Setiap loader **wajib** memanggil `requireUser(request)` (`server/guard.ts`), atau `requireAnyRole(request, [...])` bila fitur khusus role tertentu — loader layout dan halaman berjalan paralel, jadi guard layout saja tidak melindungi data halaman. `tests/app-routes.test.ts` memeriksa ini.
- **Endpoint** — tambahkan ke `server/api/app.ts` (prefix `/api/app`); semua route di sana otomatis menolak pemanggil tanpa sesi dengan `401 UNAUTHORIZED`. Contoh: `GET /api/app/whoami` → `{ userId, name, role }`. Batasan per role: cek `actor.role` di handler dan kembalikan 403. Dari client pakai Eden: `client.api.app.whoami.get()` (`app/lib/eden.ts`).
- **API key** — `/api/app/*` dipetakan ke scope `app:read` (GET/HEAD) dan `app:write` (lainnya), tersedia untuk semua role.
- `/dev` untuk operasional dan `/dashboard` untuk admin — jangan taruh fitur produk di sana.

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

Di belakang proxy mana pun, **set `TRUSTED_PROXIES`** ke IP/CIDR proxy tersebut — tanpa itu IP klien yang tercatat (dan dipakai rate limit) adalah IP proxy. Lihat [IP klien & `TRUSTED_PROXIES`](#ip-klien--trusted_proxies).

Login log (`/dev/login-logs`) memakai enrichment yang sama plus kolom `method` (email / provider OAuth / impersonation / switch) dari endpoint Better Auth yang membuat sesi; API `/api/analytics/login-logs` punya bentuk yang sama (`search`, `country`, `device`, `method`, `userId`, `days`, `/stats`, `/export`, `DELETE` massal).

API (`/api/analytics/visits`, super-admin): `GET` list dengan query `page`, `limit`, `sort`, `search`, `type=human|bot`, `country`, `device`, `browser`, `os`, `days`; `GET /stats`; `GET /export` (CSV, maks. 10.000 baris, filter sama); `DELETE /:id`; `DELETE` body `{ ids: string[] }` (maks. 100).

## Dev console (`/dev`)

Konsol super-admin dengan pola yang sama di tiap halaman: loader SSR (data lengkap di paint pertama), KPI, filter, tabel + kartu mobile, drawer detail, konfirmasi aksi destruktif, notifikasi, dan audit.

- **Overview** — angka utama, peringatan (maintenance, retensi belum diatur, user banned, API key hampir kedaluwarsa, file berbahaya), aktivitas terbaru.
- **Sidebar** — tiap menu punya badge hidup dari `server/sidebar-badges.ts` (cache 15 detik, gagal lunak): nada *perhatian* berwarna (user diblokir, impersonasi aktif, migrasi tertunda, request diblokir, error server, kunci hampir habis, masalah konfigurasi) atau nada *informasi* abu-abu (jumlah user, sesi aktif, kunjungan/login/aksi 24 jam). Hover menampilkan fungsi menu dan arti angkanya.
- **Kelola**: Users (role, ban dengan alasan/durasi, impersonasi, hapus), Sessions (cabut sesi lintas user), Posts (konten contoh; pemilik atau admin), API Keys (lihat bagian di bawah), DB Schema (ERD + statistik nyata + status migrasi).
- **Log & monitoring**: Visitor Logs, Login Logs, Rate Limits, Server Logs (buffer pino di memori, `GET /api/logs`; live lewat SSE `GET /api/logs/stream`, resume via `Last-Event-ID`), Audit Log (`audit_log`: semua aksi berhak istimewa, read-only, `GET /api/audit`), File Health.
- **Tools & MCP**: status proses, katalog tool MCP + contoh `.mcp.json` (auth lewat API key ber-scope `mcp`, tombol "Buat kunci MCP"), ringkasan API, reset cache/limiter (`POST /api/ops/reset/:target`, teraudit).
- **Changelog** — `CHANGELOG.md` (Keep a Changelog) dirender sebagai timeline per versi dengan filter jenis dan pencarian. Badge sidebar kuning bila versi di `package.json` belum punya entry, abu-abu untuk jumlah perubahan di `[Unreleased]`. Dev membaca file langsung; `bun run start`/binary memakai salinan yang ter-embed saat build.
- **Settings** (`app_setting`, semua perubahan teraudit): autentikasi, rate limit, **retensi log** (usia maksimum per tabel, job harian + jalankan manual), **mode maintenance** (503 untuk semua kecuali role yang diizinkan; login tetap terbuka), **feature flags** (`isFeatureEnabled(key)` di server, `GET /api/settings` → `features` di client), **branding** (nama, tagline, URL dukungan → sidebar, meta, login).

Migrasi yang dibutuhkan fitur-fitur ini: 0008 (audit_log), 0009 (settings), 0010 (post.updated_at), 0011 (apikey, api_key_usage), 0012 (api_key_usage_daily) — semuanya idempotent.

Menambah halaman `/dev` baru berarti menyentuh lima tempat sekaligus: `app/routes.ts`, `NAV` di `app/routes/super/layout.tsx`, `QuickLinks` overview, `CONSOLE_PAGES` di landing (test menjaga jumlahnya sama dengan route), dan badge di `server/sidebar-badges.ts`.

## Halaman & respons error

Semua kegagalan punya wajah yang konsisten, di UI maupun API:

- **Halaman** — `ErrorBoundary` root (`app/components/errors/ErrorPage.tsx`) merender 404/401/403/5xx dengan judul, penjelasan, langkah berikutnya, path, kode referensi, dan aksi yang relevan (kembali, muat ulang, beranda, masuk). Di dalam area ber-sidebar (`/dev`, `/dashboard`, `/app`, `/profile`) halaman yang gagal tetap menampilkan sidebar (boundary di tiap layout). Detail teknis hanya tampil di development. Judul tab ikut kode status (`404 Halaman tidak ditemukan — Makuro`) dan `noindex`.
- **API** — `server/api-error.ts` menyeragamkan semua error `/api/*` menjadi `{ error, code, status, requestId, method, path }`: 404 JSON untuk route/method tak dikenal (termasuk yang tadinya ditelan mount Better Auth), 422 dengan `issues[{ path, message }]` untuk validasi (tanpa dump skema), 400 body tak terbaca, 500 dengan pesan generik di produksi. Handler cukup `return status(4xx, { error, code? })`: bentuknya dilengkapi otomatis (`code` diturunkan dari status bila kosong, mis. 401 → `UNAUTHORIZED`, 403 → `FORBIDDEN`; field tambahan dipertahankan). Setiap 5xx dicatat sekali ke log dengan `requestId` yang sama seperti header `X-Request-Id`, jadi laporan user bisa langsung dicocokkan.
- **Fallback tanpa React** — bila SSR sendiri gagal, `server/error-page.ts` mengirim HTML statis (500/503, dark-mode aware, dengan kode referensi) baik di dev maupun prod; halaman pemeliharaan (503) memakai pola yang sama.

## Versi

Versi aplikasi punya satu sumber: `version` di `package.json` (dibaca `server/app-info.ts`). Nilai yang sama tampil di header sidebar konsol, halaman Tools, statistik landing, dan `GET /api/version` (publik, tanpa auth) yang mengembalikan `{ name, version, env, bun }` — cocok untuk probe deploy/uptime. Naikkan versi lewat `package.json` saja.

## API keys

Akses terprogram ke `/api/*` tanpa cookie sesi. Dikelola super-admin di `/dev/api-keys`; dibangun di atas plugin `@better-auth/api-key` (kunci di-hash, hanya prefix yang disimpan terbaca).

- **Format & header** — kunci `mk_live_…`, dikirim lewat `X-API-Key: <key>` atau `Authorization: Bearer <key>`. Nilai asli hanya ditampilkan **sekali** saat dibuat/dirotasi.
- **Scope** — tiap route memetakan ke satu scope (`server/api-keys/scopes.ts`, mis. `users:read`, `analytics:write`, `me:read`, `app:read`). Kunci tidak pernah melebihi role pemiliknya: scope di atas role ditolak saat dibuat, dan jika role pemilik turun belakangan request mendapat `403 ROLE_TOO_LOW`. Route auth dan manajemen kunci tidak bisa diakses dengan kunci; MCP butuh scope `mcp`.
- **Kedaluwarsa & rotasi** — default 90 hari, maksimum 1 tahun; tanpa kedaluwarsa hanya untuk pemilik super-admin. Rotasi membuat kunci baru dengan pengaturan sama dan memberi kunci lama masa tenggang 24 jam. Cabut = permanen tapi riwayat tetap; hapus = baris dan riwayatnya hilang.
- **Pembatasan** — rate limit per kunci (opsional, `429 RATE_LIMITED`), daftar IP/prefix yang diizinkan (`403 IP_NOT_ALLOWED`, dicocokkan dengan IP klien hasil `TRUSTED_PROXIES` sehingga tidak bisa dipalsukan lewat `X-Forwarded-For`), nonaktifkan sementara (`401 KEY_DISABLED`).
- **Jejak pemakaian** — tiap request dicatat ke `api_key_usage` (method, path, status, IP, negara, UA, durasi) secara batch, lalu digulung per hari ke `api_key_usage_daily` (job tiap jam, upsert monoton) sehingga grafik 90 hari dan total seumur kunci tetap murah dan tidak hilang saat retensi menghapus baris mentah. Halaman detail menampilkan total, harian 90 hari, endpoint/IP/negara tersering, request terakhir, dan penanda anomali (negara baru, lonjakan 4xx/5xx). Tab **Log penggunaan** di `/dev/api-keys` menampilkan log lintas kunci dengan filter dan export CSV. Retensi baris mentah diatur di Settings → Retensi log.
- **Kunci pribadi** — setiap user yang masuk bisa membuat kunci sendiri di `/profile` (maks. 10 aktif) lewat `/api/me/api-keys`; scope dibatasi role-nya, hanya pemiliknya yang bisa mengelola, dan kunci API tidak bisa dipakai untuk mengelola kunci. Overview `/dev` dan sidebar memperingatkan kunci yang berakhir dalam 7 hari.
- **API** (`/api/api-keys`, super-admin, semua aksi teraudit): `GET` list (`page`, `limit`, `search`, `status`, `ownerId`, `scope`), `GET /stats`, `GET /scopes`, `POST` buat (mengembalikan `key` sekali), `GET /:id`, `GET /:id/usage`, `PUT /:id`, `POST /:id/rotate`, `POST /:id/revoke`, `DELETE /:id`; log lintas kunci `GET /api/api-keys/usage` (`keyId`, `status=2xx|4xx|5xx|errors`, `method`, `search`, `days`, `page`, `limit`) dan `GET /api/api-keys/usage/export` (CSV, maks. 10.000 baris). Kunci pribadi: `/api/me/api-keys` dengan operasi yang sama tanpa `ownerId`.
- **Spec OpenAPI** — `GET /api/openapi.json` dengan key apa pun mengembalikan OpenAPI 3 yang dibangkitkan dari validasi route (`@elysia/openapi`), difilter ke scope key dan role pemiliknya, plus endpoint baca publik. MCP, auth, dan manajemen kunci tidak dicantumkan. Skema respons belum ada karena route belum mendeklarasikannya.
- **MCP** — `/api/mcp` menerima API key ber-scope `mcp` (`Authorization: Bearer mk_live_…`, hanya pemilik super-admin), sehingga tiap agent punya kunci sendiri yang bisa dicabut dan terlacak pemakaiannya. `MCP_ADMIN_TOKEN` di env tetap diterima sebagai jalur lama (header Bearer atau `?mcpAdminToken=`); tanpa env itu, hanya API key yang diterima. Contoh `.mcp.json` ada di `.mcp.json.example` (kunci dari env `MAKURO_MCP_KEY`).

## Rate limiting

Setiap request `/api/*` dibatasi per IP klien dengan *sliding-window counter* (hitungan jendela sebelumnya + jendela berjalan, dibobot sisa waktu). IPv4 dihitung per alamat; IPv6 dihitung per prefix **/64** (mis. `2001:db8:1:2::/64`), karena satu pelanggan IPv6 biasanya memegang seluruh /64 dan bisa berganti alamat sesukanya — log tetap mencatat IP lengkap. Default 100 request / 60 detik dari env `RATE_LIMIT_MAX` dan `RATE_LIMIT_WINDOW_MS`; super-admin bisa menimpanya (batas, jendela, path yang dikecualikan, atau mematikan sementara) di `/dev/settings` tanpa restart — nilai tersimpan di `app_setting`, `NULL` berarti pakai default env. `/api/auth/*` (Better Auth) dan `/api/mcp` (API key/token) dikecualikan dari limiter ini. Setiap response membawa `X-RateLimit-Limit` / `X-RateLimit-Remaining`, dan request yang ditolak tidak ikut dihitung. Limiter berjalan di `onRequest`, **sebelum** verifikasi API key dan routing — banjir request dengan `x-api-key` palsu ditolak `429` tanpa menyentuh database, dan path `/api/*` yang tidak ada (404) ikut dihitung. Mengubah lama jendela di settings mereset semua hitungan; mengubah batas saja tidak.

Request yang ditolak mendapat `429` dengan header `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-Request-Id`, dan body berformat error API standar (`Retry-After` = waktu tunggu tepat sampai satu request lagi diterima; dengan batas yang sangat kecil nilainya bisa melebihi lama jendela, paling lama ≈ jendela × (1 + 1/batas)):

```json
{
  "error": "Terlalu banyak request. Coba lagi dalam 42 detik.",
  "code": "RATE_LIMITED",
  "status": 429,
  "requestId": "…",
  "retryAfterSeconds": 42
}
```

**Login** (`/api/auth/*`) dibatasi oleh rate limit bawaan Better Auth, aktif di production (penyimpanan memori, aturan khusus default untuk sign-in). Better Auth membaca IP klien yang sama dengan limiter aplikasi (`advanced.ipAddress.ipAddressHeaders`), sehingga tiap klien punya bucket login sendiri. Respons 429 Better Auth (`{ message }` + header `X-Retry-After`) ditampilkan di halaman login sebagai pesan berbahasa Indonesia.

### IP klien & `TRUSTED_PROXIES`

IP klien dihitung **sekali** di tepi HTTP (`server/dev.ts`, `server/prod.ts`) lalu dipakai oleh rate limit, Better Auth, allow-list IP API key, dan semua log. Header `X-Forwarded-For` / `X-Real-IP` dari luar **tidak dipercaya** kecuali request datang langsung dari proxy yang terdaftar di env `TRUSTED_PROXIES`:

| `TRUSTED_PROXIES` | Perilaku |
|---|---|
| kosong (default) | Tidak ada proxy yang dipercaya. `X-Forwarded-For` / `X-Real-IP` diabaikan; IP socket adalah IP klien. Cocok bila app langsung menerima koneksi dari internet. |
| daftar IP/CIDR | Bila IP socket cocok dengan daftar, `X-Forwarded-For` dibaca dari kanan ke kiri dengan melewati entri yang juga terpercaya; IP valid pertama yang tidak terpercaya adalah klien. Bila semua entri terpercaya, entri paling kiri yang dipakai. `X-Real-IP` hanya dipakai bila `X-Forwarded-For` tidak ada; tanpa keduanya, IP socket. |

Setiap entri `X-Forwarded-For` dinormalisasi dulu: spasi dibuang, port dilepas (`1.2.3.4:5678`, `[2001:db8::1]:80`), kurung siku IPv6 dilepas, dan `::ffff:1.2.3.4` dibaca sebagai `1.2.3.4`. Entri yang **tetap bukan IP valid** (mis. `unknown`) menghentikan pembacaan dan IP socket yang dipakai — entri di kirinya bisa ditulis klien, jadi tidak pernah dipercaya.

> **Proxy harus menimpa header:** proxy terpercaya wajib **menimpa** `X-Real-IP` dan menambahkan IP peer-nya sendiri ke `X-Forwarded-For` (perilaku default nginx `proxy_add_x_forwarded_for`, Caddy, dan load balancer cloud). Proxy yang meneruskan `X-Real-IP` dari klien apa adanya membuat IP bisa dipalsukan saat `X-Forwarded-For` tidak dikirim. Bila proxy menyertakan port, alamat IPv6 wajib dikurung siku (`[2001:db8::1]:443`) — bentuk tanpa kurung bersifat ambigu (`2001:db8::1:443` sendiri adalah IPv6 valid) dan terbaca sebagai alamat lain.

Nilainya dipisah koma, boleh campuran IPv4, IPv6, dan CIDR. Entri yang tidak valid membuat server **gagal boot** dengan pesan yang jelas. `0.0.0.0/0` atau `::/0` diterima tetapi memicu peringatan saat boot: semua peer dianggap proxy, sehingga setiap klien bisa memalsukan IP-nya. Contoh:

```bash
# nginx/Caddy di mesin yang sama
TRUSTED_PROXIES=127.0.0.1,::1

# load balancer di jaringan privat
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

Di belakang Cloudflare (proxy oranye, origin menerima koneksi langsung dari edge), isi dengan rentang IP Cloudflare yang dipublikasikan resmi (IPv4 + IPv6), ditambah proxy lokal bila ada. Lewat **Cloudflare Tunnel** (`cloudflared`), peer origin adalah `cloudflared` itu sendiri: isi dengan IP-nya (`127.0.0.1,::1` bila satu host, atau IP/subnet container bila di Docker) — rentang IP Cloudflare tidak diperlukan.

Cek hasilnya di **`/dev/tools` → Status proses**: "Proxy tepercaya" berwarna oranye bila request datang lewat proxy yang tidak dipercaya (atau ada entri `/0`), dan "IP Anda" harus menampilkan IP publik Anda, bukan IP proxy. Bila konfigurasinya terdeteksi salah, konsol `/dev` menampilkan banner berisi panduan sesuai setup yang terdeteksi (Cloudflare, Cloudflare Tunnel, atau nginx) beserta baris `.env` siap-salin, dan server mencatat warning sekali per proses.

> **Wajib di belakang proxy:** bila app berjalan di belakang reverse proxy, load balancer, atau Cloudflare tanpa `TRUSTED_PROXIES`, semua klien terlihat sebagai IP proxy — semua orang berbagi satu bucket rate limit (dan satu bucket login), allow-list IP API key tidak berguna, dan log mencatat IP proxy.

Server menulis hasilnya ke header internal `x-makuro-client-ip` (selalu ditimpa, tidak pernah dipercaya dari luar); kode server membacanya lewat `resolveClientIp()` di `server/middleware/client-ip.ts`, bukan dari `X-Forwarded-For` langsung.

### Log & batas memori

Plugin `rateLimitPlugin()` harus didaftarkan **sebelum** `apiKeyPlugin()` di `server/api/index.ts` — hook `onRequest` berjalan sesuai urutan pendaftaran, jadi urutan itulah yang membuat limiter menolak sebelum verifikasi API key. Penolakan dicatat ke `rate_limit_log` (method, path, IP, geo, perangkat) per **episode**: paling banyak satu baris per IP per jendela rate limit (penolakan pertama), bukan setiap request yang ditolak — klien yang terus membanjiri API tidak ikut membanjiri database. Log ditampilkan di `/dev/rate-limit-logs` dengan API `/api/analytics/rate-limit-logs` (`search`, `ip`, `path`, `method`, `country`, `device`, `days`, `/stats`, `/export`, `DELETE` massal).

State limiter ada di memori proses: tiap klien hanya menyimpan dua hitungan (O(1), tidak bergantung pada nilai batas), dengan maksimum `MAX_TRACKED_KEYS` (10.000 klien, `server/rate-limit.ts`) sehingga memori terbatas apa pun batas yang diset. Urutan kunci LRU; saat penuh, sekumpulan kunci yang paling lama tidak dipakai (10% kapasitas) dikeluarkan tanpa memindai seluruh map, dan hitungannya ikut ter-reset. Kunci kedaluwarsa juga dibuang berkala. Karena per proses, batas berlaku per instance — untuk multi-instance gunakan store bersama seperti Redis.

## File health & penyelamat konteks agent

`/dev/file-health` (super-admin) memindai seluruh repo (kecuali `node_modules`, `build`, `.git`, cache) dan menilai setiap file teks:

- **Limit baris per peran** — route/handler 150, service 300, repository/query 250, schema 200, types 300, utility 200, config 100, test 400, page/component 300; hard limit global 500 baris / 20.000 karakter. Migration, generated, seed, fixture, lockfile, dan skill vendor (`.agents/`) dikecualikan. Aturan ada di `server/file-health/file-health.rules.ts`.
- **Risiko konteks agent** — estimasi token (≈ 4 karakter/token). ≥ 5.000 token = hati-hati, ≥ 15.000 = bahaya. Tujuannya mencegah AI agent membaca file seperti `bun.lock` secara utuh dan menghabiskan context window.

Agent bisa mengecek sendiri lewat tool MCP `check_file_health` (server `makuro-debug`): tanpa argumen mengembalikan ringkasan, file lewat/hampir limit, dan daftar file berbahaya; dengan `path` mengembalikan metrik + saran cara membaca file itu. REST: `GET /api/file-health` (filter `status`, `kind`, `hazard`, `search`, `sort`, `page`, `limit`, `refresh=true` untuk melewati cache 30 detik) dan `GET /api/file-health/file?path=`.

## Testing

```bash
# Pastikan DATABASE_URL_TEST di .env
bun run test
```

Semua test ada di root `tests/` (mirror struktur `server/`). Gunakan `bun run test` — script inilah yang men-set `NODE_ENV=test`; menjalankan `bun test tests` langsung tidak akan memakai test database. Test database dipisah dari dev/prod (`DATABASE_URL_TEST`); migrasi baru harus dijalankan ke keduanya.

Pola autentikasi di integration test: stub `auth.api.getSession` dan `resolveUserRole` dengan `spyOn` lalu pakai guard asli (lihat `tests/api/posts.test.ts`, `tests/api/me-api-keys.test.ts`). `mock.module('../../server/guard', …)` hanya aman untuk route yang cuma memakai `requireRole`; mock yang mengganti `resolveActor` bocor ke file test lain dalam satu run. Identitas API key bisa disimulasikan dengan `setApiKeyIdentity(request, …)`. Hook `onAfterResponse` (log pemakaian) berjalan setelah `app.handle()` selesai — tunggu sejenak sebelum `flushUsage()`.

## Catatan teknis

- **SSR di Bun**: import `react-dom/server.node` bukan bare `react-dom/server` (bare specifier resolve ke web-streams build tanpa `renderToPipeableStream`).
- **Bundle SSR berisi salinan kode server**: modul `@server/*` yang diimpor dari `app/` (loader, `entry.server.tsx`) ikut dibundel Vite ke `build/server/index.js`, jadi singleton seperti logger akan punya dua instance. `entry.server.tsx` melapor lewat `@server/ssr-log` (jembatan `globalThis` yang diisi `server/logger.ts`), bukan mengimpor logger langsung.
- **pino-roll v4** menerima satu objek opsi (`{ file, frequency: 'daily', size, limit, mkdir }`); bentuk lama `build(path, opts)` melempar "No file name provided" dan membuat `bun run start` gagal boot.
- **No FOUC**: `ColorSchemeScript` + inline `<style>` blocking di `<head>` di `root.tsx` — background warna yang benar dirender sebelum Mantine CSS dimuat.
- **Multiple Set-Cookie**: `http-bridge.ts` pakai `Headers.getSetCookie()` (WinterCG) untuk kumpulkan semua Set-Cookie header, lalu set sekaligus sebagai array ke Node.js response. Ini kritis untuk multi-session Better Auth.
- **Sidebar collapsed state**: disimpan di cookie `mk-sidebar-collapsed`, dibaca server-side di layout loader — tidak ada flash saat hard reload.
- **Urutan hook Elysia**: `derive` di route berjalan pada fase transform, *sebelum* `onBeforeHandle` global mana pun. Plugin yang menyuntik identitas untuk route ber-`derive` (auth API key) harus memakai `onRequest`; hook lain hanya berlaku untuk route yang didaftarkan setelahnya.
- **Mount Better Auth = catch-all**: `.mount(handler)` menangkap semua path `/api/*` yang tidak cocok, jadi `server/api/index.ts` hanya meneruskan `/api/auth/*` ke Better Auth dan mengembalikan JSON 404 untuk sisanya.
- **Better Auth apiKey**: panggilan server-side (`createApiKey`, `updateApiKey`) tidak boleh membawa `headers` (dianggap request klien → `SERVER_ONLY_PROPERTY`); scope kurang dilaporkan sebagai `KEY_NOT_FOUND`, sehingga scope dicek sendiri di `server/api-keys/plugin.ts`; `requestCount` hanya counter jendela rate limit, total pemakaian ada di `api_key_usage`.
- **Tanggal di fragmen `sql` mentah**: fragmen raw tidak mendapat pemetaan tipe kolom — kirim `${d.toISOString()}::timestamp`, bukan objek `Date`.
- **Dev server `--hot`**: plugin Elysia atau hook baru tidak selalu ikut dimuat ulang; restart `bun run dev` setelah menambah plugin. Untuk smoke test jalankan instance kedua dengan `PORT=<lain> bun run server/dev.ts` agar tidak mengganggu server yang sedang berjalan.

## Lisensi

MIT
