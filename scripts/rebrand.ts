/**
 * Rebrand this template. Dry run unless `--apply`.
 *
 *   bun scripts/rebrand.ts --name acme-app [--brand Acme] [--owner gh-owner] [--apply]
 *   bun scripts/rebrand.ts --name acme-app --old-brand OldName  → override the heuristic
 *
 * Old tokens come from package.json — name + repository.url, plus the `rebrandToken` field
 * holding the leftover token, so this stays correct when re-run after an earlier rebrand.
 */
import { parseArgs } from 'node:util';

export type Pair = { from: string; to: string };
export type Change = { line: number; before: string; after: string };
type Side = 'old' | 'new';
export type Tokens = Record<`${Side}${'Name' | 'Owner' | 'Brand'}`, string>;
type Pkg = { name?: string; rebrandToken?: string; repository?: { url?: string } };

export const isValidName = (name: string): boolean => /^[a-z][a-z0-9-]*$/.test(name);

/** `acme-app` → `Acme`: the brand defaults to the TitleCased first segment. */
export const brandFrom = (name: string): string =>
  (name.split('-')[0] ?? '').replace(/^./, (c) => c.toUpperCase());

export const ownerFromRepoUrl = (url: string): string | undefined =>
  /github\.com[/:]([^/]+)\/[^/]+/.exec(url)?.[1];

const snake = (s: string) => s.replaceAll('-', '_');

/**
 * One ordering constraint: the `<oldOwner>/<oldName>` slug pair must run before
 * the bare `<oldName>` pair. Otherwise the bare pair rewrites only the second
 * half of every repo slug and leaves the owner half pointing at the old account
 * — `<oldOwner>/<newName>`, a repo that does not exist. The remaining pairs do
 * not overlap, so their order is free.
 */
export function replacements(o: Tokens): Pair[] {
  return [
    { from: `${o.oldOwner}/${o.oldName}`, to: `${o.newOwner}/${o.newName}` },
    { from: o.oldName, to: o.newName },
    { from: snake(o.oldName), to: snake(o.newName) },
    { from: o.oldBrand, to: o.newBrand },
  ];
}

export const rebrandText = (text: string, pairs: Pair[]): string =>
  pairs.reduce((out, p) => out.replaceAll(p.from, p.to), text);

export function rebrandLines(text: string, pairs: Pair[]): { text: string; changed: Change[] } {
  const changed: Change[] = [];
  const lines = text.split('\n').map((line, i) => {
    const after = rebrandText(line, pairs);
    if (after !== line) changed.push({ line: i + 1, before: line, after });
    return after;
  });
  return { text: lines.join('\n'), changed };
}

/**
 * The bare lowercase first segment (`makuro`) is deliberately NOT replaced: it is
 * baked into JavaScript identifiers (`g.__makuroDbClient`, `__makuroLogger`,
 * `__makuroLocalPg`), the internal `x-makuro-client-ip` header, the `makuro-debug`
 * MCP server name, a localStorage key, `MAKURO_*` env var names and example Postgres
 * credentials. Substituting a kebab-case name there yields `__acme-appDbClient` — a
 * syntax error. So we scan for what is left over and hand the list to a human.
 */
export const findLeftovers = (text: string, token: string): Change[] =>
  text
    .split('\n')
    .map((before, i) => ({ line: i + 1, before, after: before }))
    .filter((c) => c.before.toLowerCase().includes(token.toLowerCase()));

/**
 * The leftover token must outlive the first rebrand: by the second run package.json
 * holds the NEW name, so re-deriving it would scan for a token that was replaced
 * everywhere and silently stop reporting the original identifiers still in the tree.
 */
export const leftoverTokenFrom = (name: string, saved?: string): string =>
  saved ?? name.split('-')[0] ?? name;

/** Untracked entries (`??`) are expected in a working checkout and must not block. */
export const isDirty = (porcelain: string): boolean =>
  porcelain.split('\n').some((l) => l.trim() !== '' && !l.startsWith('??'));

export const isBinary = (bytes: Uint8Array): boolean => bytes.includes(0);

/** One report line: `  <lineno>  <content>`, long content truncated. */
const report = (line: number, body: string, max = 120) => {
  const t = body.trim();
  return `  ${String(line).padStart(4)}  ${t.length > max ? `${t.slice(0, max - 3)}...` : t}`;
};

async function git(args: string[]): Promise<string> {
  const r = await Bun.$`git ${args}`.nothrow().quiet();
  if (r.exitCode !== 0)
    throw new Error(`git ${args.join(' ')} gagal (exit ${r.exitCode}): ${r.stderr.toString()}`);
  return r.stdout.toString();
}

async function main(): Promise<number> {
  const str = { type: 'string' } as const;
  const { values } = parseArgs({
    options: { name: str, brand: str, owner: str, 'old-brand': str, apply: { type: 'boolean' } },
  });
  const newName = values.name ?? '';
  if (!isValidName(newName)) {
    console.error(
      '--name wajib dan harus kebab-case (huruf kecil, angka, tanda minus; mulai dengan huruf).\n' +
        'Contoh: bun run rebrand --name acme-app',
    );
    return 2;
  }

  const pkg = (await Bun.file('package.json').json()) as Pkg;
  const oldName = pkg.name;
  const oldOwner = ownerFromRepoUrl(pkg.repository?.url ?? '');
  if (!oldName || !oldOwner)
    throw new Error('package.json: field `name` atau `repository.url` (GitHub) tidak terbaca.');
  const oldBrand = values['old-brand'] ?? brandFrom(oldName);
  const newBrand = values.brand ?? brandFrom(newName);
  const newOwner = values.owner ?? oldOwner;
  const pairs = replacements({ oldName, oldOwner, oldBrand, newName, newOwner, newBrand });
  const leftoverToken = leftoverTokenFrom(oldName, pkg.rebrandToken);

  if (values.apply && isDirty(await git(['status', '--porcelain']))) {
    console.error(`Working tree kotor. \`--apply\` menulis ulang puluhan file, jadi commit atau stash
dulu supaya kamu bisa review dengan \`git diff\` dan membatalkan dengan \`git checkout .\`.`);
    return 1;
  }

  const note = values.owner ? '' : '\n  (owner repo dibiarkan apa adanya; pakai --owner)';
  console.log(`Nama   : ${oldName} → ${newName}\nBrand  : ${oldBrand} → ${newBrand}
Owner  : ${oldOwner} → ${newOwner}${note}
\nMode: ${values.apply ? 'APPLY (menulis ke disk)' : 'dry run'}\n`);

  // bun.lock is regenerated by `bun install`; rewriting it by hand invites a stale lockfile.
  const files = (await git(['ls-files', '-z'])).split('\0').filter((f) => f && f !== 'bun.lock');
  const leftovers = new Map<string, Change[]>();
  let touched = 0;
  let lines = 0;
  let binary = 0;

  for (const file of files) {
    let bytes: Uint8Array;
    try {
      bytes = await Bun.file(file).bytes();
    } catch (err) {
      throw new Error(`gagal membaca ${file}: ${(err as Error).message}`);
    }
    if (isBinary(bytes)) {
      binary++;
      continue;
    }
    const { text, changed } = rebrandLines(new TextDecoder().decode(bytes), pairs);
    const rest = findLeftovers(text, leftoverToken);
    if (rest.length) leftovers.set(file, rest);
    if (!changed.length) continue;
    touched++;
    lines += changed.length;
    console.log(file);
    for (const c of changed) console.log(report(c.line, c.after));
    if (!values.apply) continue;
    try {
      await Bun.write(file, text);
    } catch (err) {
      throw new Error(`gagal menulis ${file}: ${(err as Error).message}`);
    }
  }

  // Written after the loop, which has already rewritten package.json. The replacement
  // pairs never touch the bare lowercase token, so this field survives later rebrands.
  if (values.apply && !pkg.rebrandToken) {
    const after = (await Bun.file('package.json').json()) as Pkg;
    after.rebrandToken = leftoverToken;
    await Bun.write('package.json', `${JSON.stringify(after, null, 2)}\n`);
  }

  const verb = values.apply ? 'diubah' : 'akan diubah';
  console.log(`\n${touched} file, ${lines} baris ${verb} (${binary} biner + bun.lock dilewati).`);

  if (leftovers.size) {
    console.log(`
Sisa yang perlu keputusan manual — token "${leftoverToken}" masih ada di ${leftovers.size} file.
Tidak diganti otomatis karena tertanam di identifier JS, nama header internal, nama server
MCP, nama env var, dan kredensial contoh — penggantian tekstual di situ merusak kode.`);
    for (const [file, rest] of leftovers) {
      console.log(file);
      for (const c of rest) console.log(report(c.line, c.before));
    }
  }

  console.log(
    values.apply
      ? `
Langkah lanjutan:
  1. \`bun install\` — menyegarkan bun.lock (sengaja tidak disentuh script ini).
  2. Review dengan \`git diff\`; batalkan semua dengan \`git checkout .\`.
  3. Nama database PostgreSQL lokal ikut berganti ke "${snake(newName)}"; cluster lama di
     ./data/pg masih memegang database bernama "${snake(oldName)}".
  4. \`.env\` tidak tracked jadi tidak disentuh — periksa manual kalau isinya menyebut
     "${oldName}" atau "${oldBrand}".`
      : '\nTidak ada yang ditulis. Tambahkan --apply untuk menerapkan.',
  );
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
