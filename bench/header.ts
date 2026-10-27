// Measure 3: cost of stamping a header-html loaded with wkhtmltopdf's URL
// parameters, on a document of about 100 pages.
//
//   node dist/bench/header.js [--sections 113] [--runs 3]
//
// Output: bench/out/header/ (PDFs, header.json).
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { launch, printPage } from '../src/render.js';
import { measureHeight, renderBatch, renderParallel, renderSequential, stamp, withParams, type PageParams } from '../src/headerfooter.js';
import { pageCount, variants } from './entry.js';
import { parseWkArgs, renderCall, repoRoot, run, runWkhtmltopdf, writeJson } from './wk.js';

const { values } = parseArgs({ options: { sections: { type: 'string', default: '113' }, runs: { type: 'string', default: '3' } } });
const out = join(repoRoot, 'bench', 'out', 'header');
mkdirSync(out, { recursive: true });
const runs = Number(values.runs);

// A long report: sections (h1), subsections (h2), plain paragraphs.
function longDocument(sections: number): string {
  const words = 'invoice amount customer delivery payment order total tax quantity product service period account balance report section company address date number price line terms due'.split(' ');
  let seed = 42;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const sentence = () => {
    const n = 8 + (next() % 12);
    const w = Array.from({ length: n }, () => words[next() % words.length]!);
    return w.join(' ').replace(/^./, (c) => c.toUpperCase()) + '.';
  };
  const para = () => `<p>${Array.from({ length: 4 + (next() % 4) }, sentence).join(' ')}</p>`;
  let body = '';
  for (let s = 1; s <= sections; s++) {
    body += `<h1>Section ${s}</h1>${para()}`;
    for (let t = 1; t <= 3; t++) body += `<h2>Subsection ${s}.${t}</h2>${para()}${para()}${para()}`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Long report</title>
<style>body { font-family: Arial, sans-serif; font-size: 12pt } p { text-align: justify }</style></head><body>${body}</body></html>`;
}

const doc = join(out, 'long.html');
writeFileSync(doc, longDocument(Number(values.sections)));
const header = join(repoRoot, 'bench', 'fixtures', 'header.html');
const common = ['--margin-top', '20', '--header-spacing', '5'];
const argsWith = (o: string) => [...common, '--header-html', header, doc, o];
const argsWithout = (o: string) => [...common, doc, o];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const timeIt = async (f: () => Promise<unknown>) => {
  const xs: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await f();
    xs.push(performance.now() - t0);
  }
  return median(xs);
};

// wkhtmltopdf, with and without the header.
const wk = {
  withHeader: await timeIt(() => runWkhtmltopdf(argsWith(join(out, 'wk-header.pdf')))),
  without: await timeIt(() => runWkhtmltopdf(argsWithout(join(out, 'wk-plain.pdf')))),
  pages: await pageCount(readFileSync(join(out, 'wk-header.pdf'))),
};

// The prototype, full call (Chromium started per call), with and without.
const replay = join(repoRoot, 'dist', 'bench', 'replay.js');
const full = {
  withHeader: await timeIt(() => run(process.execPath, [replay, ...argsWith(join(out, 'ours-header.pdf'))])),
  without: await timeIt(() => run(process.execPath, [replay, ...argsWithout(join(out, 'ours-plain.pdf'))])),
  pages: await pageCount(readFileSync(join(out, 'ours-header.pdf'))),
};

// Header strategies on their own, in a running Chromium, on the same body.
const v = variants().wk!;
const browser = await launch(v.env);
const strategies: Record<string, { render: number; stamp: number; bytes: number; steps?: Record<string, number> }> = {};
let bodyPages = 0;
try {
  const call = parseWkArgs(argsWithout(join(out, 'unused.pdf')));
  const body = (await renderCall(browser, call, 0.8, v.opts)).pdf;
  bodyPages = await pageCount(body);
  const box = { width: 190, scale: 0.8, media: 'screen' as const };
  const page = await browser.newPage();
  const m = await measureHeight(page, pathToFileURL(header).href, box);
  await page.close();
  const now = new Date();
  const params = (i: number): PageParams => ({
    page: i + 1, frompage: 1, topage: bodyPages, webpage: doc, section: '', subsection: '', subsubsection: '',
    sitepage: i + 1, sitepages: bodyPages, doctitle: 'Long report', title: 'Long report',
    date: now.toLocaleDateString(), isodate: now.toISOString().slice(0, 10), time: now.toLocaleTimeString(),
  });
  const urls = Array.from({ length: bodyPages }, (_, i) => withParams(pathToFileURL(header).href, params(i)));
  const place = () => ({ left: 10, top: 20 - 5 - m.box, width: box.width, height: m.extent });
  const run1 = async (name: string, render: (steps: Record<string, number>) => Promise<Uint8Array[] | Uint8Array>) => {
    const steps: Record<string, number> = {};
    const t0 = performance.now();
    const stamps = await render(steps);
    const t1 = performance.now();
    const pdf = await stamp(body, [{ stamps, place }]);
    const t2 = performance.now();
    writeFileSync(join(out, `stamped-${name}.pdf`), pdf);
    strategies[name] = { render: t1 - t0, stamp: t2 - t1, bytes: pdf.length, ...(Object.keys(steps).length ? { steps } : {}) };
  };
  await run1('sequential', () => renderSequential(browser, urls, box, m.extent));
  await run1('parallel4', () => renderParallel(browser, urls, box, m.extent, 4));
  await run1('parallel8', () => renderParallel(browser, urls, box, m.extent, 8));
  await run1('batch', (steps) => renderBatch(browser, urls, box, m.extent, steps));
  // The same with the wkhtmltopdf emulations applied to each header frame.
  const emulation = { ...v.opts, truncateTopMargin: false };
  await run1('batch+emulation', (steps) => renderBatch(browser, urls, { ...box, emulation }, m.extent, steps));
  // Reference: the body alone, printed again, for scale.
  const page2 = await browser.newPage();
  const t0 = performance.now();
  await printPage(page2, pathToFileURL(doc).href, { ...v.opts, scale: 0.8, margin: { top: 20 } });
  strategies.bodyOnly = { render: performance.now() - t0, stamp: 0, bytes: body.length };
  await page2.close();
} finally {
  await browser.close();
}

const result = {
  pages: { wkhtmltopdf: wk.pages, pdfkiln: full.pages, body: bodyPages },
  wkhtmltopdf: wk,
  pdfkilnFullCall: full,
  strategies,
  sizes: {
    wkhtmltopdf: statSync(join(out, 'wk-header.pdf')).size,
    pdfkiln: statSync(join(out, 'ours-header.pdf')).size,
  },
  platform: `${process.platform}-${process.arch}`,
};
writeJson(join(out, 'header.json'), JSON.parse(JSON.stringify(result, (_k, x) => (typeof x === 'number' ? Math.round(x) : x))));
console.log(JSON.stringify(result, null, 2));
