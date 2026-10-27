// Before a pdfkiln version: reads the Stable version of Chrome for Testing;
// when it is newer than chromium.json's, downloads every archive of the pin,
// records its size and SHA-256, and moves chromium.json and
// src/version.ts to it.
//
//   node dist/scripts/update-chromium.js [--dry-run]
//
// Prints the new version, or nothing when the pin is current. --dry-run
// prints the Stable version and changes nothing.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readPin, repoRoot } from '../src/chromium.js';

const KNOWN_GOOD = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';

interface KnownGood {
  channels: Record<string, { version: string; downloads: Record<string, { platform: string; url: string }[]> }>;
}

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' } } });
const pin = readPin();
const response = await fetch(KNOWN_GOOD);
if (!response.ok) throw new Error(`${KNOWN_GOOD}: HTTP ${response.status}`);
const channel = ((await response.json()) as KnownGood).channels[pin.channel];
if (!channel) throw new Error(`${KNOWN_GOOD}: no ${pin.channel} channel`);

const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 4; i++) if (x![i] !== y![i]) return x![i]! > y![i]!;
  return false;
};
if (values['dry-run']) {
  console.log(channel.version);
  process.exit(0);
}
if (!newer(channel.version, pin.version)) process.exit(0);

const downloads = channel.downloads[pin.product] ?? [];
for (const [key, archive] of Object.entries(pin.archives)) {
  const url = `${pin.source}/${channel.version}/${key}/${archive.file}`;
  if (!downloads.some((d) => d.platform === key && d.url === url)) throw new Error(`${channel.version}: no ${url} in ${KNOWN_GOOD}`);
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`${url}: HTTP ${r.status}`);
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of r.body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    size += chunk.length;
  }
  archive.size = size;
  archive.sha256 = hash.digest('hex');
  console.error(`${url} ${size} ${archive.sha256}`);
}
pin.version = channel.version;
writeFileSync(join(repoRoot, 'chromium.json'), `${JSON.stringify(pin, null, 2)}\n`);
const versionFile = join(repoRoot, 'src', 'version.ts');
writeFileSync(versionFile, readFileSync(versionFile, 'utf8').replace(/chromiumVersion = '[^']*'/, `chromiumVersion = '${channel.version}'`));
console.log(channel.version);
