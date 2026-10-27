// Downloads the pinned chrome-headless-shell for this platform and checks
// its SHA-256 against chromium.json.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { installDir, platformKey, readPin } from '../src/chromium.js';
import { fetchVerified, unzip } from './download.js';

const pin = readPin();
const key = platformKey();
const archive = pin.archives[key];
if (!archive) throw new Error(`chromium.json has no archive for ${key}`);

const exe = join(installDir(pin.version), `chrome-headless-shell-${key}`, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell');
if (!existsSync(exe)) {
  const zip = await fetchVerified(`${pin.source}/${pin.version}/${key}/${archive.file}`, archive.sha256);
  unzip(zip, installDir(pin.version));
}
console.log(exe);
