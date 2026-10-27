// Downloads the official wkhtmltopdf 0.12.6 build used as the reference by
// the bench, checks its SHA-256 and unpacks it without installing it.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cacheDir, fetchVerified, repoRoot } from './download.js';

interface Pkg { url: string; sha256: string; binary?: string; libdir?: string }
const pins = JSON.parse(readFileSync(join(repoRoot, 'bench', 'wkhtmltopdf.json'), 'utf8')) as {
  version: string;
  packages: Record<string, Pkg>;
};

const root = join(cacheDir, 'wkhtmltopdf', pins.version);

// Unpacks a .deb without dpkg: it is an ar archive holding data.tar.*.
function extractDeb(deb: string, dest: string): void {
  const tmp = join(dest, '.deb');
  mkdirSync(tmp, { recursive: true });
  execFileSync('ar', ['x', deb], { cwd: tmp });
  const data = readdirSync(tmp).find((f) => f.startsWith('data.tar'));
  if (!data) throw new Error(`${deb}: no data.tar member`);
  execFileSync('tar', ['-xf', join(tmp, data), '-C', dest]);
  rmSync(tmp, { recursive: true });
}

function pkg(name: string): Pkg {
  const p = pins.packages[name];
  if (!p) throw new Error(`bench/wkhtmltopdf.json has no package ${name}`);
  return p;
}

async function main(): Promise<void> {
  if (process.platform === 'linux' && process.arch === 'x64') {
    const main = pkg('linux-x64');
    const ssl = pkg('linux-x64-libssl1.1');
    const exe = join(root, 'linux-x64', main.binary!);
    if (!existsSync(exe)) {
      extractDeb(await fetchVerified(main.url, main.sha256), join(root, 'linux-x64'));
      extractDeb(await fetchVerified(ssl.url, ssl.sha256), join(root, 'linux-x64-libssl'));
    }
    console.log(exe);
  } else if (process.platform === 'win32') {
    const win = pkg('win-x64');
    const exe = join(root, 'win-x64', win.binary!);
    if (!existsSync(exe)) {
      const installer = await fetchVerified(win.url, win.sha256);
      execFileSync('7z', ['x', '-y', `-o${join(root, 'win-x64')}`, installer], { stdio: 'ignore' });
    }
    console.log(exe);
  } else {
    throw new Error(`No reference wkhtmltopdf build for ${process.platform}-${process.arch}`);
  }
}

await main();
