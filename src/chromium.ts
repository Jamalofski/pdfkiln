// Where chrome-headless-shell is: next to the program once installed,
// in the repository's .cache when developing (npm run fetch:chromium), in
// the user's cache for the npm package, which downloads it on first use.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { extractZip } from './engine/unzip.js';
import { chromiumVersion } from './version.js';

export interface ChromiumPin {
  product: string;
  channel: string;
  version: string;
  source: string;
  archives: Record<string, { file: string; size: number; sha256: string }>;
}

// dist/src when compiled, dist/bundle when bundled: two levels below the
// repository either way.
const here = typeof __dirname === 'string' ? __dirname : import.meta.dirname;
export const repoRoot = resolve(here, '..', '..');

export function readPin(): ChromiumPin {
  return JSON.parse(readFileSync(join(repoRoot, 'chromium.json'), 'utf8')) as ChromiumPin;
}

// Chrome for Testing platform names.
export function platformKey(): string {
  const { platform, arch } = process;
  if (platform === 'linux' && arch === 'x64') return 'linux64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (platform === 'win32') return arch === 'ia32' ? 'win32' : 'win64';
  throw new Error(`No chrome-headless-shell build for ${platform}-${arch}`);
}

export function installDir(version = chromiumVersion): string {
  return join(repoRoot, '.cache', 'chromium', version);
}

const exeName = () => (process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');

// The single executable: Node's sea module says so.
function isSea(): boolean {
  try {
    return typeof require === 'function' && (require('node:sea') as { isSea(): boolean }).isSea();
  } catch {
    return false;
  }
}

// PDFKILN_CACHE_DIR, or the platform's cache folder.
export function userCacheDir(): string {
  if (process.env.PDFKILN_CACHE_DIR) return process.env.PDFKILN_CACHE_DIR;
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'pdfkiln');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'pdfkiln');
  return join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'pdfkiln');
}

const userInstall = () => join(userCacheDir(), 'chromium', chromiumVersion, `chrome-headless-shell-${platformKey()}`, exeName());

export function executablePath(): string {
  if (process.env.PDFKILN_CHROMIUM) return process.env.PDFKILN_CHROMIUM;
  const app = join(isSea() ? dirname(process.execPath) : here, 'chromium', exeName());
  const dev = join(installDir(), `chrome-headless-shell-${platformKey()}`, exeName());
  for (const c of [app, dev]) if (existsSync(c)) return c;
  // The user's cache only now: an account without a profile, such as an
  // IIS application pool's, may have no home folder Node can read.
  const user = userInstall();
  return existsSync(user) || !isSea() ? user : app;
}

// The executable, downloaded first when the program has none: the npm
// package, which ships chromium.json only. The archive is checked against
// its SHA-256 and unpacked aside, then moved in place: two first calls at
// once both succeed.
export async function ensureChromium(): Promise<string> {
  const exe = executablePath();
  if (existsSync(exe) || process.env.PDFKILN_CHROMIUM || isSea()) return exe;
  const pin = readPin();
  const key = platformKey();
  const archive = pin.archives[key];
  if (!archive) throw new Error(`chromium.json has no archive for ${key}`);
  const url = `${pin.source}/${pin.version}/${key}/${archive.file}`;
  const target = join(userCacheDir(), 'chromium', pin.version);
  process.stderr.write(`pdfkiln: first use, downloading Chromium ${pin.version} (${Math.round(archive.size / 1e6)} MB) into ${target}\n`);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = mkdtempSync(join(dirname(target), '.download-'));
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
    const zip = join(tmp, archive.file);
    const hash = createHash('sha256');
    const out = createWriteStream(zip);
    for await (const chunk of Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)) {
      hash.update(chunk as Buffer);
      if (!out.write(chunk)) await new Promise<void>((ok) => out.once('drain', () => ok()));
    }
    out.end();
    await finished(out);
    const sha = hash.digest('hex');
    if (sha !== archive.sha256) throw new Error(`${url}: SHA-256 mismatch, expected ${archive.sha256}, got ${sha}`);
    extractZip(zip, join(tmp, 'chromium'));
    try {
      renameSync(join(tmp, 'chromium'), target);
    } catch (e) {
      if (!existsSync(exe)) throw e;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return exe;
}
