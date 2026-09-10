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

## SEO & Meta Tags — Wajib di Setiap Route

Setiap route yang dirender (bukan redirect-only) **wajib** punya `export function meta()`. Ini berlaku untuk route halaman maupun layout route. Tanpa ini, browser tab kosong dan search engine tidak mendapat sinyal apapun.

### Format Wajib

```ts
// Halaman publik (landing, login, dll)
export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Judul Halaman — Makuro' },
    { name: 'description', content: 'Deskripsi singkat halaman ini, 120–160 karakter.' },
  ];
}

// Halaman app/admin (tidak diindex search engine, tapi title tetap wajib)
export function meta() {
  return [{ title: 'Nama Halaman — Makuro' }];
}
```

### Konvensi Title

- Format: `"Nama Halaman — Brand"` — nama halaman di depan, brand di belakang.
- Halaman publik: sertakan `description` (120–160 karakter, deskriptif, tidak duplikat).
- Halaman admin/app: cukup `title`, tidak perlu `description` (tidak diindex).
- Root (`root.tsx`) wajib punya `meta()` sebagai **fallback global** — halaman yang tidak define meta sendiri akan fallback ke sini.

### Favicon

- Favicon didefinisikan secara hardcoded di `root.tsx` `<head>` sebagai `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`.
- File favicon ada di `public/favicon.svg` — jangan ganti tanpa alasan, ini brand identity.
- Jangan duplikasi favicon lewat `meta()` — sudah cukup di hardcoded.

### Halaman Publik — OG Tags (Open Graph)

Untuk halaman yang bisa dishare (home, landing page):

```ts
export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Makuro — Fullstack Template' },
    { name: 'description', content: '...' },
    { property: 'og:title', content: 'Makuro — Fullstack Template' },
    { property: 'og:description', content: '...' },
    { property: 'og:type', content: 'website' },
  ];
}
```

**Blocker:** route yang dirender tanpa `export function meta()` → STOP sebelum commit. Redirect-only routes (tidak punya `default export` komponen) dikecualikan.

## Mobile-Friendly — Standar Ketat Wajib Dipatuhi Agent

App ini harus bisa diakses dengan baik di mobile. Admin console tetap primary desktop, namun **tidak boleh rusak di mobile**. Agent wajib menerapkan semua aturan di bawah ini secara proaktif — bukan menunggu diminta. Standar ini berlaku untuk setiap halaman baru maupun yang dimodifikasi.

### 1. Navigasi — AppShell dengan Mobile Header Wajib

Jangan pernah menempatkan `<Burger>` sebagai elemen `pos="fixed"` floating tanpa `AppShell.Header`. Pola yang wajib dipakai:

```tsx
<AppShell
  header={{ height: { base: 52, sm: 0 } }}  // header hanya muncul di mobile
  navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
>
  <AppShell.Header withBorder={false} hiddenFrom="sm">
    <Group h="100%" px="md" gap="sm">
      <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" aria-label="Toggle navigation" />
      <Text fw={700}>Nama App</Text>
    </Group>
  </AppShell.Header>
  <AppShell.Navbar>...</AppShell.Navbar>
  <AppShell.Main>...</AppShell.Main>
</AppShell>
```

**Blocker:** Burger floating fixed tanpa AppShell.Header → STOP.

### 2. Tabel — Kolom Wajib Responsif

Semua tabel harus scrollable horizontal DAN menyembunyikan kolom tidak esensial di mobile:

```tsx
// Wrapper scroll — wajib ada
<Box style={{ overflowX: 'auto' }}>
  <Table>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Kolom Penting</Table.Th>
        <Table.Th visibleFrom="sm">Kolom Sekunder</Table.Th>  {/* hidden di mobile */}
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>...</Table.Td>
        <Table.Td visibleFrom="sm">...</Table.Td>  {/* hidden di mobile */}
      </Table.Tr>
    </Table.Tbody>
  </Table>
</Box>
```

Alternatif: `<Table.ScrollContainer minWidth={640}>` bila semua kolom harus tampil.

**Prioritas kolom yang wajib tampil di mobile:** kolom identitas utama (nama/path) + status + aksi.
**Kolom yang boleh disembunyikan di mobile:** IP, User Agent, User ID, timestamp sekunder, kolom detail.

**Blocker:** Tabel tanpa `overflowX: 'auto'` wrapper atau `Table.ScrollContainer` → STOP.

### 3. Page Header — Tombol Action Wajib Wrap

Header halaman yang berisi judul + tombol-tombol wajib menggunakan `wrap="wrap"`:

```tsx
// ✅ Benar — buttons wrap ke bawah bila tidak muat
<Group justify="space-between" align="flex-start" wrap="wrap">
  <Title order={3}>Judul Halaman</Title>
  <Group gap="xs" wrap="wrap" justify="flex-end">
    <Button>Clear All</Button>
    <Button>Purge 30d+</Button>
    <Button>Refresh</Button>
  </Group>
</Group>

// ❌ Salah — buttons overflow layar di mobile
<Group justify="space-between" wrap="nowrap">
```

**Blocker:** Header dengan `wrap="nowrap"` yang berisi tombol-tombol → STOP.

### 4. Layout & Spacing

- Gunakan Mantine `Grid`, `SimpleGrid`, `Stack` dengan breakpoints — **bukan** fixed-width pixel.
- `width: 800px`, `minWidth: 600px` pada container utama → gunakan `maw` + `w="100%"` sebagai gantinya.
- Padding halaman: minimal `p="sm"` di mobile — gunakan `p={{ base: 'sm', md: 'md' }}` bila perlu.
- Kolom grid yang tidak muat di mobile → `cols={{ base: 1, sm: 2, md: 3 }}`.

### 5. Touch Targets

- Tombol aksi utama: minimum `size="sm"` (44px touch area).
- `ActionIcon` kecil di dalam tabel: boleh `size="xs"` karena tabel sudah scrollable.
- Jarak antar touch target: minimal `gap="xs"`.
- Hindari link/button berdekatan tanpa jarak yang cukup.

### 6. Form & Input

- Set `inputMode` yang sesuai: `inputMode="email"`, `inputMode="numeric"`, `inputMode="url"`.
- Jangan set `font-size` di bawah 16px pada input — browser mobile akan auto-zoom.
- Mantine input component sudah handle ini secara default, jangan override ke ukuran lebih kecil.

**Cara agent menerapkan:** Bayangkan layar 375px lebar (iPhone SE). Apakah semua elemen visible dan bisa di-tap? Apakah ada overflow horizontal tanpa scroll? Apakah burger tidak menimpa konten? Jika ada masalah → perbaiki sebelum commit.

**Blocker (semua harus dipenuhi sebelum commit):**
- ❌ Burger floating tanpa AppShell.Header
- ❌ Tabel tanpa scroll wrapper
- ❌ Page header `wrap="nowrap"` dengan banyak tombol
- ❌ Container fixed-width melampaui 375px tanpa overflow handling

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
