# Changelog

Semua perubahan penting di project ini dicatat di sini. Format mengikuti
[Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added
- Area `/app` sebagai rumah default fitur produk: terbuka untuk semua user yang sudah masuk, punya halaman panduan cara menambah halaman dan endpoint, serta tautan **App** di sidebar semua role. Endpoint produk tinggal ditambahkan di `/api/app/*` (otomatis butuh login, contoh `GET /api/app/whoami`), dan API key bisa mengaksesnya dengan scope baru `app:read` / `app:write`.
- Banner peringatan di konsol `/dev` saat `TRUSTED_PROXIES` terdeteksi salah (proxy belum dipercaya, IP terbaca sebagai IP Cloudflare, atau ada entri `/0`), lengkap dengan panduan langkah demi langkah untuk Cloudflare, Cloudflare Tunnel, dan nginx beserta baris `.env` siap-salin. Banner bisa disembunyikan sampai server restart; server juga mencatat warning sekali per proses.
- Kartu "Status proses" di `/dev/tools` menampilkan jumlah proxy tepercaya (`TRUSTED_PROXIES`) dan IP Anda menurut server, dengan peringatan bila request datang lewat proxy yang belum dipercaya atau ada entri `/0`.
- Halaman `/dev/changelog` untuk membaca riwayat perubahan langsung dari konsol, lengkap dengan filter jenis perubahan, pencarian, dan peringatan bila versi yang berjalan belum tercatat.
- Dev server menjalankan migrasi database otomatis saat boot, sehingga database lokal yang baru atau tertinggal tidak lagi memicu error `relation does not exist`.
- Tautan landing page kini tampil sebagai kartu bergambar saat dibagikan (WhatsApp, X, Slack, dll) lewat meta Open Graph/Twitter, gambar `/og.png`, dan URL `canonical`.
- `/robots.txt` dan `/sitemap.xml` untuk mesin pencari, dibangun dari `APP_URL`; halaman login, konsol, dan API tidak diindeks.
- Ikon home-screen iOS (`/apple-touch-icon.png`), web manifest, dan warna tema browser.
- Env `TRUSTED_PROXIES` (daftar IP/CIDR IPv4 & IPv6, dipisah koma) untuk menentukan proxy mana yang boleh menyampaikan IP klien lewat `X-Forwarded-For`. Default kosong: header itu diabaikan dan IP koneksi langsung dipakai. Entri yang tidak valid membuat server gagal start dengan pesan yang jelas.

### Changed
- User biasa kini mendarat di `/app` setelah masuk (sebelumnya `/profile`). Halaman profil tetap di `/profile`.
- **Perlu tindakan saat deploy:** bila app berjalan di belakang reverse proxy, load balancer, atau Cloudflare, set `TRUSTED_PROXIES` ke IP/CIDR proxy tersebut. Tanpa itu semua pengunjung terlihat memakai IP proxy, sehingga berbagi satu batas rate limit dan satu batas login, dan log mencatat IP proxy.
- Respons 429 rate limit kini memakai format error API standar `{ error, code: "RATE_LIMITED", status, requestId, retryAfterSeconds }` dengan pesan berbahasa Indonesia ("Terlalu banyak request. Coba lagi dalam N detik.") serta header `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, dan `X-Request-Id`.
- Rate Limit Logs kini mencatat satu episode blokir per IP per jendela rate limit (penolakan pertama), bukan setiap request yang ditolak, sehingga klien yang membanjiri API tidak ikut membanjiri database. Angka "diblokir" di konsol berarti jumlah episode pemblokiran.
- Rate limit aplikasi kini menghitung alamat IPv6 per prefix /64, sehingga satu pengguna IPv6 tidak bisa lolos dengan berganti alamat. IPv4 tetap dihitung per alamat, dan log tetap mencatat IP lengkap.
- Rate limit aplikasi kini diperiksa sebelum verifikasi API key, sehingga banjir request dengan API key palsu langsung ditolak 429 tanpa membebani database. Request ke path `/api/*` yang tidak ada kini juga ikut dihitung.
- Proxy di depan app harus menimpa `X-Real-IP` dan menambahkan IP-nya ke `X-Forwarded-For`. `X-Real-IP` kini hanya dipakai bila `X-Forwarded-For` tidak dikirim, dan bila semua entri `X-Forwarded-For` berasal dari proxy terpercaya, entri paling kiri yang dipakai.
- Bila `TRUSTED_PROXIES` berisi `0.0.0.0/0` atau `::/0`, server kini memberi peringatan saat start karena setiap klien bisa memalsukan IP-nya.

### Fixed
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
