// Download helpers shared by the fetch scripts: every archive is checked
// against the SHA-256 pinned in the repository before it is unpacked.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { extractZip } from '../src/engine/unzip.js';

export const repoRoot = resolve(import.meta.dirname, '..', '..');
export const cacheDir = join(repoRoot, '.cache');
const downloadDir = join(cacheDir, 'downloads');

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

// Returns the path of the verified archive, downloading it if needed.
export async function fetchVerified(url: string, sha256: string): Promise<string> {
  mkdirSync(downloadDir, { recursive: true });
  const target = join(downloadDir, `${sha256.slice(0, 12)}-${basename(new URL(url).pathname)}`);
  if (existsSync(target) && (await sha256File(target)) === sha256) return target;

  console.error(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const partial = `${target}.part`;
  await writeFile(partial, Buffer.from(await response.arrayBuffer()));
  const actual = await sha256File(partial);
  if (actual !== sha256) {
    rmSync(partial);
    throw new Error(`${url}: SHA-256 mismatch, expected ${sha256}, got ${actual}`);
  }
  renameSync(partial, target);
  return target;
}

// The extractor the npm package uses at run time, tested here on every
// platform's archive.
export const unzip = extractZip;
