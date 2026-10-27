// Measure 2: one complete call, Chromium start included, against
// wkhtmltopdf 0.12.6, on a two-page invoice of the corpus.
//
//   node dist/bench/startup.js [--runs 15] [--entry odoo17-invoice-long] [--delay ms]
//
// --delay replaces the entry's --javascript-delay. Output:
// bench/out/startup/startup-delay<ms>.json.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch } from '../src/render.js';
import { pageCount, prepare, variants } from './entry.js';
import { renderCall, repoRoot, run, runWkhtmltopdf, writeJson } from './wk.js';

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '15' },
    entry: { type: 'string', default: 'odoo17-invoice-long' },
    delay: { type: 'string' },
  },
});
const runs = Number(values.runs);
const out = join(repoRoot, 'bench', 'out', 'startup');
mkdirSync(out, { recursive: true });

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { runs: s.length, min: s[0]!, median: q(0.5), p90: q(0.9), max: s[s.length - 1]! };
}
const round = (o: object) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Math.round(v) : v)));

const e = await prepare(values.entry!);
let args = e.wkArgs('{out}');
if (values.delay) {
  const i = args.indexOf('--javascript-delay');
  args = i >= 0 ? args.map((a, j) => (j === i + 1 ? values.delay! : a)) : ['--javascript-delay', values.delay, ...args];
}
if (values.delay) e.call.javascriptDelay = Number(values.delay);
const withOut = (f: string) => args.map((a) => (a === '{out}' ? join(out, f) : a));
const replay = join(repoRoot, 'dist', 'bench', 'replay.js');

const times: Record<string, number[]> = { wkhtmltopdf: [], 'pdfkiln plain': [], 'pdfkiln wk': [] };
const steps: Record<string, Record<string, number>[]> = { 'pdfkiln plain': [], 'pdfkiln wk': [] };
for (let i = -2; i < runs; i++) {
  // Two warm-up rounds, then measured ones; the tools alternate.
  const wk = await runWkhtmltopdf(withOut('wk.pdf'), { cwd: e.dir, stdin: e.stdin });
  if (wk.code !== 0) throw new Error(`wkhtmltopdf: ${wk.stderr}`);
  if (i >= 0) times.wkhtmltopdf!.push(wk.ms);
  for (const variant of ['plain', 'wk']) {
    const r = await run(process.execPath, [replay, '--kiln-variant', variant, ...withOut(`ours-${variant}.pdf`)], {
      cwd: e.dir, stdin: e.stdin, env: { ...process.env, PDFKILN_TIMINGS: '1' },
    });
    if (r.code !== 0) throw new Error(`replay: ${r.stderr}`);
    if (i >= 0) {
      times[`pdfkiln ${variant}`]!.push(r.ms);
      steps[`pdfkiln ${variant}`]!.push(JSON.parse(r.stderr.trim().split('\n').pop()!));
    }
  }
}

// A render in an already running Chromium: what a server mode would cost.
const warm: number[] = [];
const v = variants().wk!;
const browser = await launch(v.env);
try {
  for (let i = -2; i < runs; i++) {
    const t0 = performance.now();
    await renderCall(browser, e.call, 0.8, v.opts);
    if (i >= 0) warm.push(performance.now() - t0);
  }
} finally {
  await browser.close();
}

// Fixed costs on their own.
const node = await Promise.all([0, 1, 2, 3, 4].map(() => run(process.execPath, ['-e', '0'])));
const nodePuppeteer = [];
for (let i = 0; i < 5; i++) nodePuppeteer.push((await run(process.execPath, ['--input-type=module', '-e', "await import('puppeteer-core')"], { cwd: repoRoot })).ms);

const median = (rows: Record<string, number>[]) =>
  Object.fromEntries(Object.keys(rows[0] ?? {}).map((k) => [k, stats(rows.map((r) => r[k]!)).median]));
const result = round({
  entry: values.entry,
  args,
  pages: {
    wkhtmltopdf: await pageCount(readFileSync(join(out, 'wk.pdf'))),
    plain: await pageCount(readFileSync(join(out, 'ours-plain.pdf'))),
    wk: await pageCount(readFileSync(join(out, 'ours-wk.pdf'))),
  },
  call: Object.fromEntries(Object.entries(times).map(([k, xs]) => [k, stats(xs)])),
  steps: Object.fromEntries(Object.entries(steps).map(([k, rows]) => [k, median(rows)])),
  warmRender: stats(warm),
  nodeStart: stats(node.map((r) => r.ms)),
  nodeImportPuppeteer: stats(nodePuppeteer),
  platform: `${process.platform}-${process.arch}`,
  node: process.version,
});
writeJson(join(out, `startup-delay${e.call.javascriptDelay}.json`), result);
console.log(JSON.stringify(result, null, 2));
e.close();
