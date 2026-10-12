/** Copy and preview data for the login showcase panel (decorative, not real metrics). */

export type ShowcaseRange = 'weekly' | 'monthly' | 'yearly';

export const SHOWCASE_RANGES: { value: ShowcaseRange; label: string }[] = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

export const SHOWCASE_DATA: Record<ShowcaseRange, { summary: string; values: number[] }> = {
  weekly: { summary: '+12% dari minggu lalu', values: [18, 32, 24, 40, 30, 52, 46] },
  monthly: { summary: '+28% dari bulan lalu', values: [40, 36, 58, 50, 72, 64, 88] },
  yearly: { summary: '+64% dari tahun lalu', values: [20, 34, 30, 48, 62, 70, 94] },
};

export const SHOWCASE_COPY = {
  analyticsTitle: 'Analitik',
  rangeAriaLabel: 'Rentang data analitik',
  donutTitle: 'Total',
  donutValue: 42,
  heading: 'Cara paling sederhana mengelola aplikasimu',
  defaultTagline: 'Pantau pengguna, aktivitas, dan performa aplikasi dari satu tempat.',
};

/** SVG path ("M x,y L x,y …") scaling `values` to fit a width×height box, max at the top. */
export function linePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const y = range === 0 ? height / 2 : height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${+(i * step).toFixed(2)},${+y.toFixed(2)}`;
    })
    .join(' ');
}
