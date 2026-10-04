# Changelog

Semua perubahan penting di project ini dicatat di sini. Format mengikuti
[Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added
- Halaman `/dev/changelog` untuk membaca riwayat perubahan langsung dari konsol, lengkap dengan filter jenis perubahan, pencarian, dan peringatan bila versi yang berjalan belum tercatat.
- Dev server menjalankan migrasi database otomatis saat boot, sehingga database lokal yang baru atau tertinggal tidak lagi memicu error `relation does not exist`.
- Tautan landing page kini tampil sebagai kartu bergambar saat dibagikan (WhatsApp, X, Slack, dll) lewat meta Open Graph/Twitter, gambar `/og.png`, dan URL `canonical`.
- `/robots.txt` dan `/sitemap.xml` untuk mesin pencari, dibangun dari `APP_URL`; halaman login, konsol, dan API tidak diindeks.
- Ikon home-screen iOS (`/apple-touch-icon.png`), web manifest, dan warna tema browser.
- Env `TRUSTED_PROXIES` (daftar IP/CIDR IPv4 & IPv6, dipisah koma) untuk menentukan proxy mana yang boleh menyampaikan IP klien lewat `X-Forwarded-For`. Default kosong: header itu diabaikan dan IP koneksi langsung dipakai. Entri yang tidak valid membuat server gagal start dengan pesan yang jelas.

### Changed
- **Perlu tindakan saat deploy:** bila app berjalan di belakang reverse proxy, load balancer, atau Cloudflare, set `TRUSTED_PROXIES` ke IP/CIDR proxy tersebut. Tanpa itu semua pengunjung terlihat memakai IP proxy, sehingga berbagi satu batas rate limit dan satu batas login, dan log mencatat IP proxy.
- Respons 429 rate limit kini memakai format error API standar `{ error, code: "RATE_LIMITED", status, requestId, retryAfterSeconds }` dengan pesan berbahasa Indonesia ("Terlalu banyak request. Coba lagi dalam N detik.") serta header `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, dan `X-Request-Id`.
- Rate Limit Logs kini mencatat satu episode blokir per IP per jendela rate limit (penolakan pertama), bukan setiap request yang ditolak, sehingga klien yang membanjiri API tidak ikut membanjiri database. Angka "diblokir" di konsol berarti jumlah episode pemblokiran.
- Memori limiter kini dibatasi: saat jumlah klien yang dilacak mencapai batas, data yang sudah kedaluwarsa dibuang lebih dulu, lalu yang paling lama.

### Fixed
- Rate limit dan allow-list IP pada API key tidak bisa lagi diakali dengan mengirim header `X-Forwarded-For` atau `X-Real-IP` palsu.
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
