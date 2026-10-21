/** Streaming archive download with a throttled, TTY-aware progress line — shared by the local Postgres and RustFS runtime installers (env-free: runs before `.env` is validated). */

/** One-line download status: `42% · 12.3/52.6 MB · 1.5 MB/s · ETA 27s` (drops %/ETA when size is unknown). */
export function progressLine(downloaded: number, total: number, bytesPerSec: number): string {
  const mb = (n: number) => (n / 1_048_576).toFixed(1);
  const speed = `${mb(bytesPerSec)} MB/s`;
  if (total > 0) {
    const pct = Math.min(100, Math.round((downloaded / total) * 100));
    const eta = bytesPerSec > 0 ? Math.max(0, Math.round((total - downloaded) / bytesPerSec)) : 0;
    return `${pct}% · ${mb(downloaded)}/${mb(total)} MB · ${speed} · ETA ${eta}s`;
  }
  return `${mb(downloaded)} MB · ${speed}`;
}

/** Download `url` to `dest`, streaming to disk while writing live progress (percent/MB/speed/ETA) to stderr. */
export async function downloadWithProgress(
  url: string,
  dest: string,
  label: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Gagal mengunduh ${label} ${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const tty = Boolean(process.stderr.isTTY);
  const sink = Bun.file(dest).writer();
  const reader = res.body.getReader();
  const start = Date.now();
  let downloaded = 0;
  let lastTick = 0;
  const render = (final = false): void => {
    const now = Date.now();
    if (!final && now - lastTick < (tty ? 400 : 3000)) return;
    lastTick = now;
    const line = progressLine(
      downloaded,
      total,
      downloaded / Math.max(0.001, (now - start) / 1000),
    );
    process.stderr.write(tty ? `\r  ⬇  ${line}   ` : `  ⬇  ${line}\n`);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sink.write(value);
    downloaded += value.byteLength;
    render();
  }
  await sink.end();
  render(true);
  if (tty) process.stderr.write('\n');
}
