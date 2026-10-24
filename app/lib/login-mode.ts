export type LoginMode = 'signin' | 'signup';

/** Starting mode: `?mode=signup` only when signup is allowed. */
export function initialMode(params: URLSearchParams, signupEnabled: boolean): LoginMode {
  return params.get('mode') === 'signup' && signupEnabled ? 'signup' : 'signin';
}

/** Catatan di bawah tombol Google saat pendaftaran akun baru ditutup. */
export function googleNote(signupEnabled: boolean): string | null {
  return signupEnabled
    ? null
    : 'Pendaftaran akun baru sedang ditutup — masuk dengan akun Google yang sudah terdaftar, atau hubungi administrator.';
}

/** Heading, subtitle, submit label and mode-toggle footer for each mode. */
export function modeCopy(mode: LoginMode, appName: string) {
  return mode === 'signup'
    ? {
        title: 'Buat akun',
        subtitle: `Daftar untuk mulai memakai ${appName}.`,
        submit: 'Buat akun',
        switchPrompt: 'Sudah punya akun?',
        switchAction: 'Masuk',
      }
    : {
        title: 'Masuk ke akunmu',
        subtitle: `Selamat datang kembali di ${appName}.`,
        submit: 'Masuk',
        switchPrompt: 'Belum punya akun?',
        switchAction: 'Daftar',
      };
}
