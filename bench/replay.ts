// Takes a wkhtmltopdf command line and runs it with the prototype, as the
// compatibility mode will: one process, Chromium started and stopped.
//
//   node dist/bench/replay.js [--kiln-scale 0.8] [--kiln-variant wk] <wkhtmltopdf arguments>
//
// Variants are those of bench/entry.ts. PDFKILN_TIMINGS=1 prints the steps'
// durations in milliseconds as JSON on stderr.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../src/render.js';
import { variants } from './entry.js';
import { parseWkArgs, renderCall } from './wk.js';

const t0 = performance.now();
let args = process.argv.slice(2);
let scale = 0.8;
let variant = 'wk';
for (;;) {
  if (args[0] === '--kiln-scale') { scale = Number(args[1]); args = args.slice(2); }
  else if (args[0] === '--kiln-variant') { variant = args[1]!; args = args.slice(2); }
  else break;
}
const call = parseWkArgs(args);
// A page on standard input is loaded from a temporary file, as wkhtmltopdf does.
call.pages = call.pages.map((p) => {
  if (p !== '-') return p;
  const file = join(mkdtempSync(join(tmpdir(), 'pdfkiln')), 'stdin.html');
  writeFileSync(file, readFileSync(0));
  return file;
});
const v = variants()[variant];
if (!v) throw new Error(`unknown variant ${variant}`);

const ms: Record<string, number> = { startup: performance.now() - t0 };
let t = performance.now();
const browser = await launch(v.env);
ms.launch = performance.now() - t;
try {
  const r = await renderCall(browser, call, scale, v.opts);
  Object.assign(ms, r.ms);
  t = performance.now();
  writeFileSync(call.output, r.pdf);
  ms.write = performance.now() - t;
} finally {
  t = performance.now();
  await browser.close();
  ms.close = performance.now() - t;
}
ms.total = performance.now() - t0;
if (process.env.PDFKILN_TIMINGS) process.stderr.write(JSON.stringify(ms) + '\n');
