# CLAUDE.md — makuro-template

Aturan project ini menambah/override global `~/.claude/CLAUDE.md`.

## UI Framework — Mantine Wajib Dipakai

Project ini menggunakan **Mantine** (`@mantine/core`, `@mantine/hooks`, `@mantine/modals`) sebagai UI framework utama.

**Wajib pakai Mantine untuk semua UI element:**
- Konfirmasi/dialog → `modals.openConfirmModal()` dari `@mantine/modals` — **bukan** `window.confirm()`
- Alert/notifikasi → Mantine `notifications.show()` — **bukan** `window.alert()`
- Semua input, button, badge, tooltip, loader, modal, dll → pakai komponen Mantine

**Setup yang sudah ada di project:**
- `ModalsProvider` sudah wrap app di `app/root.tsx`
- Style modals sudah tercakup dalam `@mantine/core/styles.css` — **jangan** import `@mantine/modals/styles.css` (tidak ada di package ini)
- Gunakan `import { modals } from '@mantine/modals'` untuk confirm dialog

**Blocker:** memakai `window.confirm`/`window.alert`/native HTML element yang sudah di-cover Mantine → STOP sebelum commit; ganti dengan komponen Mantine.

## UX Production-Ready — Wajib Dipatuhi Agent

Ini adalah standar kualitas UX yang membuat app terasa selesai dan layak produksi. Agent wajib menerapkan ini secara **proaktif** tanpa menunggu user mengingatkan.

### 1. Konfirmasi untuk Aksi Destruktif / Irreversible
Setiap aksi yang menghapus data, mengakhiri sesi, atau susah dibatalkan **wajib** tampilkan confirm dialog via `modals.openConfirmModal()` sebelum dieksekusi.

Contoh yang **wajib** ada confirm:
- Sign out / logout → confirm "Kamu akan keluar dari akun ini"
- Hapus item (row, post, user) → confirm "Data ini akan dihapus permanen"
- Purge / bulk delete → confirm dengan deskripsi dampak
- Perubahan role user (escalate/demote) → confirm
- Ban / unban user → confirm

**Blocker:** aksi destruktif tanpa confirm dialog → STOP sebelum commit.

### 2. Loading State pada Setiap Aksi Async
Button yang memicu request async **wajib** punya `loading` prop / spinner selama request berlangsung. User tidak boleh dibiarkan tanpa feedback.

### 3. Feedback Sukses / Gagal
Setelah aksi async selesai:
- Sukses → tampilkan notifikasi singkat atau update UI secara visible (refresh data, badge berubah, dll)
- Gagal → tampilkan pesan error yang jelas (bukan diam-diam gagal)
- Gunakan Mantine `notifications.show()` jika feedback perlu muncul di luar konteks form/button

### 4. Empty State yang Informatif
Tabel / list kosong → jangan biarkan blank. Tampilkan pesan bermakna seperti "Belum ada data" dengan ikon atau deskripsi singkat.

### 5. Disabled State yang Kontekstual
Button yang tidak bisa dipakai (misal: "Purge" saat tidak ada data) → `disabled` dengan alasan yang jelas dari konteks UI (tooltip atau label).

### 6. Konsistensi Bahasa UI
- Label tombol: imperatif dan spesifik — "Hapus Visit Log", bukan "OK" atau "Submit"
- Pesan confirm: jelaskan dampak nyata — "Semua log lebih dari 30 hari akan dihapus permanen"
- Pesan error: actionable — "Gagal menyimpan. Coba lagi." bukan "Error"

**Cara agent menerapkan:** Setiap kali menulis fitur baru yang mengandung aksi async, delete, atau state change penting → langsung terapkan standar di atas tanpa menunggu instruksi. Ini bukan optional — ini adalah definisi "fitur selesai" di project ini.

## Mobile-Friendly — Standar Minimum Wajib

App ini harus dapat diakses dengan baik di perangkat mobile, bukan hanya desktop. Admin console tetap primary desktop, namun **tidak boleh rusak di mobile**. Agent wajib menerapkan ini secara proaktif pada setiap halaman yang ditulis atau dimodifikasi.

### 1. Layout Responsif
- Gunakan Mantine `Grid`, `SimpleGrid`, `Stack`, `Group` dengan breakpoints — **bukan** fixed-width atau pixel hardcode.
- Hindari `width: 800px` atau sejenisnya; gunakan `maxWidth` dan `100%` agar menyesuaikan layar.
- Kolom yang tidak muat di mobile → ubah ke single column via `cols={{ base: 1, sm: 2, md: 3 }}`.

### 2. Tabel Lebar
- Setiap tabel **wajib** dibungkus `<Box style={{ overflowX: 'auto' }}>` agar bisa discroll horizontal di mobile, bukan overflow keluar layar.
- Pertimbangkan `truncate` + `maw` untuk kolom teks panjang.

### 3. Touch Targets
- Tombol aksi utama minimum `size="sm"`. Hindari `size="xs"` untuk elemen yang jadi target utama tap.
- `ActionIcon` kecil (ikon hapus, edit di tabel) boleh `size="xs"` karena di dalam tabel yang sudah scroll.
- Jangan menempatkan dua touch target yang sangat berdekatan tanpa jarak (`gap` minimal `xs`).

### 4. Navigasi & Sidebar
- Sidebar/nav wajib collapsible di mobile — gunakan Mantine `AppShell` dengan `navbar.breakpoint` yang tepat.
- Jangan hardcode sidebar selalu terbuka tanpa toggle.

### 5. Form & Input
- Set `inputMode` yang sesuai: `inputMode="email"` untuk email, `inputMode="numeric"` untuk angka — agar keyboard mobile muncul yang tepat.
- Input tidak boleh menyebabkan zoom otomatis browser mobile (pastikan `font-size` minimal 16px di input, atau gunakan Mantine default yang sudah handle ini).

### 6. Padding & Spacing di Mobile
- Halaman wajib punya padding minimal `p="md"` atau `p="sm"` — tidak boleh nempel ke pinggir layar.
- Gunakan breakpoint spacing: `p={{ base: 'sm', md: 'md' }}` bila perlu.

**Cara agent menerapkan:** Setiap halaman baru atau yang dimodifikasi → cek apakah layout masih masuk akal di layar 375px lebar (iPhone SE). Jika ada elemen yang overflow atau terlalu kecil untuk di-tap → perbaiki sebelum commit. Ini bukan opsional.

**Blocker:** Layout overflow horizontal tanpa `overflowX: 'auto'`, atau fixed-width yang melampaui 375px → STOP sebelum commit.

## Binary Build — Catatan Penting untuk Agent

Saat bekerja dengan `bun build --compile --asset`:

- `Bun.isStandaloneExecutable` — API resmi untuk deteksi binary mode (boolean). **Jangan** gunakan regex pada `Bun.main`.
- `--asset ./build/client` meng-embed files sebagai `client/` di VFS (**strip satu level direktori induk** — `build/` dihapus).
- `import.meta.dir` dalam compiled binary = `/$bunfs/root` (bukan path disk tempat binary berada).
- `Bun.file(path).exists()` bekerja normal untuk embedded VFS files.
- Path CLIENT_DIR yang benar:
  ```ts
  const CLIENT_DIR = Bun.isStandaloneExecutable
    ? path.join(import.meta.dir, 'client') + '/'          // binary: /$bunfs/root/client/
    : path.join(import.meta.dir, '../build/client') + '/'; // script: ../build/client/
  ```
- SSR bundle di-embed via **static import** (`import * as ssrBuild from '../build/server/index.js'`) — Bun mengikuti static import dan mem-bundle seluruh deps ke binary.
- `Bun.embeddedFiles` berguna untuk debug: menampilkan path dan ukuran semua file yang di-embed.

## Stack

- **Runtime:** Bun
- **Server:** Elysia
- **Frontend:** React Router v8 SSR, Mantine v9
- **DB:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth
- **Test runner:** `bun test server` (bun:test)

## Test

- Jalankan: `bun test server` (otomatis set `NODE_ENV=test`)
- File test: `server/**/*.test.ts`
- **Test database:** set `DATABASE_URL_TEST` di `.env` — ketika `NODE_ENV=test`, `server/db/index.ts` otomatis pakai `DATABASE_URL_TEST` bukan `DATABASE_URL`. Jika tidak di-set, fallback ke `DATABASE_URL` (berbahaya untuk data produksi).
- Migrasi test DB: `DATABASE_URL=<url_test> bun run db:migrate`
- Guard bypass di integration test: `mock.module('../guard', () => ({ requireRole: async () => ({}) }))` — bun:test otomatis hoist `mock.module` di atas static imports
- Cleanup: gunakan `beforeEach`/`afterEach` untuk insert/delete row test spesifik (bukan `DELETE FROM table` global)
