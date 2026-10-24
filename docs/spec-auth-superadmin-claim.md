# Spec — Tutup klaim super-admin lewat sign-up email

Status: **siap dikerjakan.**
Tanggal: 2026-10-24
Lingkup: satu worker, satu branch `fix/auth-superadmin-claim`.

## Masalah

`server/auth.ts` menyetel `emailAndPassword: { enabled: true }` tanpa syarat dan tanpa
`requireEmailVerification`. Sementara itu `reconcileRole` (`server/permissions.ts`)
menjadikan **email** sebagai satu-satunya bukti kepemilikan role super-admin: siapa pun
yang memegang akun dengan email anggota `SUPER_ADMIN_EMAILS` adalah super-admin.

Akibatnya, selama akun untuk email itu belum ada di database, siapa pun yang mengetahui
alamatnya bisa mendaftar memakai alamat itu dengan password pilihannya sendiri dan langsung
menjadi super-admin. Di produksi jendela itu tertutup karena akun pemiliknya sudah ada sejak
hari pertama (pendaftaran duplikat ditolak). Jendela itu terbuka pada: instalasi baru,
instance yang di-wipe berkala (rencana demo), dan database yang di-restore dari backup lama.

Perbaikannya: akun super-admin hanya boleh lahir dari penyedia identitas (Google), bukan
dari kredensial yang dipilih sendiri oleh pendaftar.

## Yang harus dikerjakan

### Berkas yang dimiliki worker ini

- `server/auth.ts` — satu opsi `hooks.before`
- `tests/auth-superadmin-claim.test.ts` — berkas baru
- `CHANGELOG.md` — satu poin di `## [Unreleased]` → `Fixed`

**Jangan sentuh** berkas lain. Jangan `git commit`, `git push`, atau berganti branch.

### API yang sudah terverifikasi (jangan cari alternatif)

better-auth terpasang `1.7.3`.

- `BetterAuthOptions` punya `hooks?: { before?: AuthMiddleware; after?: AuthMiddleware }`
  (`node_modules/@better-auth/core/dist/types/init-options.d.mts:1493`).
- `createAuthMiddleware` dan `APIError` diekspor dari `better-auth/api`
  (`node_modules/better-auth/dist/api/index.d.mts:4053`).
- `superAdminEmails: ReadonlySet<string>` sudah ada di `server/env.ts:59` — himpunan
  lowercase, sudah di-trim, blank dibuang. **Pakai itu**, jangan parse ulang env.
- `opsi disabledPaths` ada tapi **tidak cocok**: ia statis saat config dibuat, tidak bisa
  memeriksa isi body request.

### Perilaku

Pada `hooks.before`, hanya untuk path sign-up email:

- Ambil email dari body request, normalisasi dengan `trim().toLowerCase()` — persis seperti
  `superAdminEmails` dinormalisasi, kalau tidak perbandingannya bisa dilewati dengan
  `Owner@Domain.com`.
- Kalau email itu anggota `superAdminEmails` → tolak dengan `APIError`, status `403`.
- Selain itu → lanjut tanpa mengubah apa pun.

Pesan error bahasa Indonesia dan actionable, tanpa membocorkan apakah akunnya sudah ada:
misalnya `'Alamat ini dikelola sebagai akun pengelola dan hanya bisa masuk lewat Google.'`

Hook ini **inert** saat `SUPER_ADMIN_EMAILS` kosong (himpunan kosong → tidak ada yang
cocok), jadi instalasi yang tidak memakai super-admin tidak berubah perilakunya.

### Test (wajib, `tests/auth-superadmin-claim.test.ts`)

Pola: integration lewat `api.handle(new Request(...))` seperti `tests/auth-flow.test.ts`.
`superAdminEmails` dibaca saat modul dimuat, jadi himpunannya tidak bisa diubah dari dalam
test — pakai `spyOn` pada modul env, atau uji lewat himpunan yang nyata bila test env
mengisinya. Pilih yang paling kecil; yang penting ketiga hal ini diuji:

1. Sign-up dengan email anggota `SUPER_ADMIN_EMAILS` → `403`, dan **tidak ada row user**
   yang tercipta untuk email itu.
2. Perbandingan tidak peka huruf besar/kecil: varian `MiXeDcAsE` dari email yang sama juga
   `403`.
3. Sign-up dengan email biasa → tetap berhasil seperti sebelumnya (regresi).

`bun run test` harus lulus **seluruhnya**, bukan hanya berkas baru ini.

## Di luar lingkup — jangan dikerjakan di branch ini

### `requireEmailVerification`

Menyalakannya butuh pengirim email yang belum ada di project ini. Terpisah.

### Menegakkan `signupEnabled`

Setelan ini (`server/settings.ts`) saat ini **hanya menyembunyikan form** di
`LoginForm.tsx`; endpointnya tetap melayani. Itu bug kontrak tersendiri, dan default-nya
`true` sehingga penegakannya inert bagi instalasi yang ada. Aman dikerjakan, tapi di branch
terpisah agar diff ini tetap satu concern.

### Menegakkan `emailAuthEnabled` — **butuh keputusan user, bukan keputusan worker**

`AUTH_DEFAULTS` menyetel `emailAuthEnabled: false` (`server/settings.ts:51`). Kalau
penegakannya dipasang di jalur sign-in email, konsekuensinya bukan sekadar churn test:

- Klon baru menjadi **Google-only** sampai seseorang menyalakan setelan itu — dan satu-satunya
  jalan menjadi super-admin untuk menyalakannya adalah Google. Instalasi tanpa kredensial
  Google terkunci total.
- Tiga berkas test integrasi akan gagal karena mendaftar/masuk lewat email dengan setelan
  default: `tests/auth-flow.test.ts`, `tests/auth-rate-limit.test.ts`,
  `tests/auth-session-hook.test.ts`.

Pilihannya nanti: balik default-nya menjadi `true`, atau terima bahwa setelan itu memang
hanya mengatur tampilan form dan namanya diperjelas. Bukan bagian dari spec ini.

## Catatan binary

Hook ini perilaku runtime di `server/auth.ts`, yang diimpor statis oleh ketiga jalur
(`bun run dev`, bundle `server/prod.ts`, dan binary). Tidak ada yang spesifik build, jadi
`build:binary` sekarang maupun `build:binary:demo` nanti mewarisinya tanpa pekerjaan
tambahan.

Satu konsekuensi yang spesifik operasional, **bukan bagian dari spec ini**: bila
`SUPER_ADMIN_EMAILS` terisi sementara `GOOGLE_CLIENT_ID`/`SECRET` tidak, pemilik tidak punya
jalan masuk sama sekali — email diblokir hook ini, Google tidak tampil karena
`hasGoogleAuth` false. Tempat yang benar untuk menangkap itu adalah satu pemeriksaan di
`makuro doctor`. Jalan keluar darurat tanpa kode, bagi siapa pun yang punya akses host:
keluarkan email itu dari `SUPER_ADMIN_EMAILS`, daftar dengan password, masukkan kembali —
`reconcileRole` menaikkannya kembali saat resolve berikutnya.
