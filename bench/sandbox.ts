// Checks that Chromium starts with its sandbox and that the sandbox is on:
// on Linux, renderers run under seccomp-bpf (Seccomp: 2) in their own PID
// namespace. Exits 1 otherwise. Never pass --no-sandbox to make it pass.
//
//   node dist/bench/sandbox.js
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { launch } from '../src/render.js';

let browser;
try {
  browser = await launch();
} catch (e) {
  console.error(`Chromium did not start with its sandbox: ${(e as Error).message.split('\n').slice(0, 3).join(' ')}`);
  process.exit(1);
}
const page = await browser.newPage();
await page.goto('data:text/html,<p>sandbox</p>');
const report: Record<string, unknown> = { platform: process.platform, version: await browser.version() };
if (process.platform === 'linux') {
  // Renderers started by this browser: descendants of its process.
  const root = browser.process()!.pid!;
  const parent = (p: string) => Number(readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1]!.split(' ')[1]);
  const descends = (p: string) => {
    for (let q = Number(p); q > 1; q = parent(String(q))) if (q === root) return true;
    return false;
  };
  const renderers = readdirSync('/proc')
    .filter((p) => /^\d+$/.test(p))
    .filter((p) => {
      try { return readFileSync(`/proc/${p}/cmdline`, 'utf8').includes('--type=renderer') && descends(p); } catch { return false; }
    });
  const status = (p: string, key: string) => /\n?([^\n]*)/.exec(readFileSync(`/proc/${p}/status`, 'utf8').split('\n').find((l) => l.startsWith(key)) ?? '')![1]!.split(':')[1]?.trim();
  report.renderers = renderers.map((p) => {
    let ownPidNamespace: boolean | string = 'unknown';
    try { ownPidNamespace = readlinkSync(`/proc/${p}/ns/pid`) !== readlinkSync('/proc/self/ns/pid'); } catch { /* not ours to read */ }
    return { pid: p, seccomp: status(p, 'Seccomp'), ownPidNamespace };
  });
  report.sandboxed = (report.renderers as { seccomp?: string }[]).length > 0 && (report.renderers as { seccomp?: string }[]).every((r) => r.seccomp === '2');
} else {
  report.sandboxed = 'started without --no-sandbox';
}
await browser.close();
console.log(JSON.stringify(report));
if (report.sandboxed === false) process.exit(1);
