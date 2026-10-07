# Changelog

Semua perubahan penting di project ini dicatat di sini. Format mengikuti
[Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added
- Penyimpanan file S3-compatible untuk file, gambar, dan dokumen. Kosongkan `S3_ENDPOINT` dan app menjalankan RustFS sendiri (data di `./data/s3`, hanya `127.0.0.1`, kredensial acak dibuat otomatis), tanpa server storage terpisah. Isi `S3_ENDPOINT`/`S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` untuk memakai AWS S3, Cloudflare R2, atau MinIO.
- Foto profil kini bisa diunggah langsung dari halaman Profil (PNG, JPEG, WEBP, atau GIF, maks 2 MB) dan dihapus kembali, menggantikan isian URL foto. Foto yang tersimpan ikut dihapus saat diganti atau saat akunnya dihapus.
- Server Logs kini punya pagination (50 entri per halaman) dengan total entri yang cocok dengan filter. Halaman 2 dan seterusnya tidak bergeser saat log baru masuk, dan tombol "N log baru" membawa kembali ke halaman pertama yang live.
- Nama database Postgres lokal kini bisa diatur lewat `LOCAL_PG_DB` di `.env` (default tetap nama package, mis. `makuro_template`). Database test ikut menjadi `<nama>_test`.
- Dokumentasi API yang bisa langsung dibaca AI agent dan tool seperti Postman: `GET /api/openapi.json` mengembalikan spec OpenAPI 3 dengan API key apa pun. Isinya hanya endpoint yang boleh dipanggil key tersebut, lengkap dengan scope yang dibutuhkan tiap endpoint. Tautannya juga tercantum di `/llms.txt`.

### Changed
- Halaman Profil tidak lagi punya isian URL foto. Ganti foto dengan mengunggah file. Foto lama dari URL luar (mis. akun Google) tetap tampil dan bisa dihapus.
- `init` kini juga menyiapkan storage lokal (RustFS, unduhan ~88 MB, butuh `unzip`). Bila gagal, `init` tetap selesai dengan peringatan. Server tanpa internet bisa memakai `--s3-archive=<zip>`.
- Workflow rilis kini menolak tag yang tidak sama dengan `v<version>` di `package.json` atau versi yang belum punya entry di CHANGELOG, sebelum build dimulai. Catatan rilis di GitHub Release diambil dari bagian versi tersebut di CHANGELOG, bukan daftar commit otomatis.
- CI dan build binary Linux kini berjalan di runner `ubuntu-24.04` yang dipatok, sehingga tidak ikut berpindah otomatis saat `ubuntu-latest` beralih ke Ubuntu 26.04 (mulai 19 Oktober 2026).
- **Keamanan, Postgres lokal:** Postgres lokal tidak lagi membuka port TCP `127.0.0.1`. Sebelumnya auth `trust` di TCP membuat user lain di mesin yang sama bisa masuk sebagai superuser. Koneksi kini hanya lewat unix socket di direktori 0700 milik user (default `/tmp/makuro_template-pg-<uid>`, bisa diubah dengan `LOCAL_PG_SOCKET_DIR`). Format `DATABASE_URL` lokal berubah menjadi `postgres://postgres@localhost:54329/makuro_template?host=<dir socket>`. Perintah `pg_dump` di README sudah disesuaikan.

### Fixed
- `bun run test` kini menghentikan Postgres lokal yang ia nyalakan sendiri setelah test selesai. Sebelumnya proses Postgres tertinggal dan memegang port `54329`. Postgres milik `bun dev` yang sedang jalan tetap tidak disentuh.
- Variabel `.env` yang dibiarkan kosong (mis. `DATABASE_URL_TEST=` atau `MCP_ADMIN_TOKEN=`) kini dianggap tidak di-set, sehingga `bun run dev` tidak lagi gagal dengan "Invalid environment variables".
- **Keamanan data:** test tidak lagi diam-diam memakai database dev saat `DATABASE_URL_TEST` kosong. Sebelumnya hal itu bisa menghapus data dev. Di mode Postgres lokal, `bun run test` kini otomatis menyiapkan database `<nama>_test` terpisah. Dengan Postgres eksternal, test menolak berjalan sampai `DATABASE_URL_TEST` di-set.
- Postgres lokal kini selalu berjalan dalam zona waktu UTC, berapa pun zona waktu mesinnya.
- Postgres lokal kini bisa start lagi setelah proses app di-`kill -9`. Postmaster yatim dari run sebelumnya dihentikan otomatis, termasuk saat app berjalan di bawah `systemd --user` atau di container dengan tini/dumb-init.
- Postgres lokal dan `backup` tidak lagi salah mengira proses lain yang kebetulan memakai PID lama sebagai Postgres yang masih berjalan.
- Daftar di konsol (visitor, login, rate limit, audit, user, sesi, posts, API key, pemakaian API key, File Health) tidak lagi error 500 saat parameter `page`/`limit` di URL berisi teks, angka negatif, atau pecahan. Nilai yang tidak valid kini kembali ke halaman 1 dan ukuran halaman default.

## [0.2.0] - 2026-10-06

### Added
- Postgres lokal otomatis: kosongkan `DATABASE_URL` dan app menjalankan PostgreSQL 18 sendiri (data di `./data/pg`, hanya `127.0.0.1`), lengkap dengan migrasi otomatis saat boot. Cocok untuk dev dan produksi kecil di satu VPS tanpa memasang Postgres atau Docker.
- CLI pada binary `makuro-template` (dan `bun run cli` dari source): `start` (default), `version`, `init` (buat `.env` dengan secret acak, unduh runtime Postgres terverifikasi, siapkan database), `doctor` (periksa kesiapan, exit 1 bila ada masalah), `backup`, dan `upgrade` (self-update dengan verifikasi sha256).
- Pemasangan satu baris `curl -fsSL …/install.sh | sh` dari GitHub Release, dengan verifikasi checksum dan opsi pin versi `MAKURO_VERSION`. Rilis untuk linux-x64, linux-arm64, darwin-arm64, dan darwin-x64 dibangun otomatis saat push tag `v*`.
- `init --systemd` membuat unit systemd yang berjalan sebagai user biasa (bukan root).
- Bagian README "Database: dari lokal ke produksi" berisi tahapan pertumbuhan dan cara pindah ke Postgres Docker/terkelola lewat `pg_dump`.
- Area `/app` sebagai rumah default fitur produk: terbuka untuk semua user yang sudah masuk, punya halaman panduan cara menambah halaman dan endpoint, serta tautan **App** di sidebar semua role. Endpoint produk tinggal ditambahkan di `/api/app/*` (otomatis butuh login, contoh `GET /api/app/whoami`), dan API key bisa mengaksesnya dengan scope baru `app:read` / `app:write`.
- Banner peringatan di konsol `/dev` saat `TRUSTED_PROXIES` terdeteksi salah (proxy belum dipercaya, IP terbaca sebagai IP Cloudflare, atau ada entri `/0`), lengkap dengan panduan langkah demi langkah untuk Cloudflare, Cloudflare Tunnel, dan nginx beserta baris `.env` siap-salin. Banner bisa disembunyikan sampai server restart; server juga mencatat warning sekali per proses.
- Kartu "Status proses" di `/dev/tools` menampilkan jumlah proxy tepercaya (`TRUSTED_PROXIES`) dan IP Anda menurut server, dengan peringatan bila request datang lewat proxy yang belum dipercaya atau ada entri `/0`.
- Halaman `/dev/changelog` untuk membaca riwayat perubahan langsung dari konsol, lengkap dengan filter jenis perubahan, pencarian, dan peringatan bila versi yang berjalan belum tercatat.
- Dev server menjalankan migrasi database otomatis saat boot, sehingga database lokal yang baru atau tertinggal tidak lagi memicu error `relation does not exist`.
- Tautan landing page kini tampil sebagai kartu bergambar saat dibagikan (WhatsApp, X, Slack, dll) lewat meta Open Graph/Twitter, gambar `/og.png`, dan URL `canonical`.
- `/robots.txt` dan `/sitemap.xml` untuk mesin pencari, dibangun dari `APP_URL`; halaman login, konsol, dan API tidak diindeks.
- Ikon home-screen iOS (`/apple-touch-icon.png`), web manifest, dan warna tema browser.
- Env `TRUSTED_PROXIES` (daftar IP/CIDR IPv4 & IPv6, dipisah koma) untuk menentukan proxy mana yang boleh menyampaikan IP klien lewat `X-Forwarded-For`. Default kosong: header itu diabaikan dan IP koneksi langsung dipakai. Entri yang tidak valid membuat server gagal start dengan pesan yang jelas.
- Workflow CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan lint, typecheck, migrasi, dan seluruh test terhadap Postgres 18 sementara di setiap push ke `main` dan setiap pull request.

### Changed
- Binary kini bernama sesuai `name` di `package.json` (`makuro-template`, sebelumnya `makuro`). `bun run build:binary -- --all` membangun keempat target sekaligus ke `dist/` beserta `checksums.txt`; script `build:binary:linux` dan `build:binary:linux-musl` dihapus.
- Image Docker kini berjalan sebagai user `bun` (bukan root) dengan volume `/app/data`.
- User biasa kini mendarat di `/app` setelah masuk (sebelumnya `/profile`). Halaman profil tetap di `/profile`.
- **Perlu tindakan saat deploy:** bila app berjalan di belakang reverse proxy, load balancer, atau Cloudflare, set `TRUSTED_PROXIES` ke IP/CIDR proxy tersebut. Tanpa itu semua pengunjung terlihat memakai IP proxy, sehingga berbagi satu batas rate limit dan satu batas login, dan log mencatat IP proxy.
- Respons 429 rate limit kini memakai format error API standar `{ error, code: "RATE_LIMITED", status, requestId, retryAfterSeconds }` dengan pesan berbahasa Indonesia ("Terlalu banyak request. Coba lagi dalam N detik.") serta header `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, dan `X-Request-Id`.
- Rate Limit Logs kini mencatat satu episode blokir per IP per jendela rate limit (penolakan pertama), bukan setiap request yang ditolak, sehingga klien yang membanjiri API tidak ikut membanjiri database. Angka "diblokir" di konsol berarti jumlah episode pemblokiran.
- Rate limit aplikasi kini menghitung alamat IPv6 per prefix /64, sehingga satu pengguna IPv6 tidak bisa lolos dengan berganti alamat. IPv4 tetap dihitung per alamat, dan log tetap mencatat IP lengkap.
- Rate limit aplikasi kini diperiksa sebelum verifikasi API key, sehingga banjir request dengan API key palsu langsung ditolak 429 tanpa membebani database. Request ke path `/api/*` yang tidak ada kini juga ikut dihitung.
- Proxy di depan app harus menimpa `X-Real-IP` dan menambahkan IP-nya ke `X-Forwarded-For`. `X-Real-IP` kini hanya dipakai bila `X-Forwarded-For` tidak dikirim, dan bila semua entri `X-Forwarded-For` berasal dari proxy terpercaya, entri paling kiri yang dipakai.
- Bila `TRUSTED_PROXIES` berisi `0.0.0.0/0` atau `::/0`, server kini memberi peringatan saat start karena setiap klien bisa memalsukan IP-nya.

### Fixed
- Di produksi, server kini memakai satu pool koneksi PostgreSQL (maksimal 5 koneksi) untuk seluruh proses. Sebelumnya bagian render halaman membuka pool kedua sehingga satu proses bisa memegang hingga 10 koneksi, yang lebih cepat menghabiskan batas koneksi database.
- Semua respons error 4xx dari endpoint API (misalnya 401 "belum masuk", 403, 404 data tidak ditemukan) kini memakai format standar `{ error, code, status, requestId }` dan header `X-Request-Id`, sama seperti error lain. Sebelumnya sebagian hanya berisi `{ error }` tanpa `code` dan `requestId`, sehingga sulit dicocokkan dengan log saat dilaporkan.
- Rate limit dan allow-list IP pada API key tidak bisa lagi diakali dengan mengirim header `X-Forwarded-For` atau `X-Real-IP` palsu, termasuk di belakang proxy yang menambahkan port (`1.2.3.4:5678`) atau entri bukan IP (`unknown`): port kini dilepas, dan entri yang tetap bukan IP menghentikan pembacaan alih-alih dilewati.
- Klien yang membanjiri API dari banyak IP berbeda tidak lagi bisa memperlambat server atau menghabiskan memori. Tiap klien kini memakai memori tetap berapa pun batas rate limit yang diset, dan saat jumlah klien yang dilacak penuh, klien yang paling lama tidak aktif dikeluarkan.
- Saat login terlalu sering dicoba, halaman masuk kini menampilkan pesan berbahasa Indonesia yang jelas, bukan teks bahasa Inggris dari Better Auth.
- Rate limit login tidak lagi jatuh ke satu bucket bersama untuk semua pengunjung, yang sebelumnya memungkinkan siapa pun mengunci halaman masuk untuk semua orang. Better Auth kini membaca IP klien yang sama dengan rate limit aplikasi.
- Beberapa project turunan template kini bisa menjalankan `bun run dev` bersamaan di port berbeda. HMR memakai port aplikasi itu sendiri, bukan port 24678 bersama, sehingga error `WebSocket server error: Port ... is already in use` hilang dan browser tidak lagi menerima hot reload dari project lain.
- Server Logs tidak lagi menggeser posisi scroll setiap beberapa detik. Log baru kini datang langsung dari server (live, tanpa refresh berkala), dan saat kamu sedang membaca di bawah, daftar ditahan dengan tombol "N log baru" untuk kembali ke atas.
- Layar konsol tidak lagi berkedip dan scroll sidebar tidak lagi melompat ke atas sesaat setelah halaman terbuka. Cache data kini terpisah per request dan per tab, sehingga data seorang user juga tidak bisa ikut terbawa ke render user lain di server.
- Waktu (misalnya "5 menit yang lalu" dan tanggal lengkap) ditampilkan dalam zona waktu browser kamu, sama persis antara render server dan browser, tanpa kedipan.
- Kolom "login terakhir" di `/dev/users` tidak lagi meleset beberapa jam ketika zona waktu server berbeda dengan zona waktu browser.
- `/dev/changelog` tidak lagi error saat dibuka di browser.
- Console browser tidak lagi menampilkan error hydration ketika ekstensi browser (VPN/keamanan) menandai elemen halaman dengan atribut `bis_*`/`__processed_*__`.
- Visitor Logs tidak lagi salah menandai bot monitor (UptimeRobot, Pingdom) dan bot lain berawalan `Mozilla/5.0` sebagai `seo-crawler`. Kunjungan lama yang sudah tercatat tidak berubah.

## [0.1.0] - 2026-09-14

### Added
- Konsol admin `/dev` berbasis role dengan sidebar, overview, dan penghitung di setiap menu.
- Kelola user (role, ban dengan alasan dan durasi, impersonasi), sesi aktif lintas perangkat, dan contoh CRUD posts.
- API key dengan scope, kedaluwarsa, rotasi, jejak pemakaian, key pribadi, dan autentikasi MCP.
- Visitor logs, login logs, rate limit logs, server logs, dan audit log untuk setiap aksi admin.
- File Health untuk memantau ukuran file terhadap limit dan risiko konteks agent.
- DB Schema: ERD interaktif, jumlah baris nyata, dan status migrasi.
- Settings: autentikasi, rate limit, retensi log, maintenance, feature flags, dan branding.
- Server MCP bawaan dan halaman Tools untuk agent.
- Landing page publik.
- Halaman error yang seragam dan format error API `{ error, code, status, requestId }`.
- `/README.md`, `/llms.txt`, dan `/api/version` untuk agent.
- Tampilan yang jelas untuk user yang diblokir atau sesinya berakhir.

### Fixed
- `bun run start` dan binary kini boot dengan benar, dan typecheck bersih tanpa error.
- Probe browser seperti `/favicon.ico` tidak lagi jatuh ke SSR dan menghasilkan 404 bertumpuk.
