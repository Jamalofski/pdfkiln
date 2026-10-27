// Font metrics of wkhtmltopdf 0.12.6 against pdfkiln, on a page of
// common fonts at common sizes, without smart shrinking: the line pitch of
// line-height: normal, the font size written in the PDF, and the size the
// glyphs are drawn at (bench/gdi.py). On Windows, wkhtmltopdf's Qt 4.8
// takes its metrics from GDI, rounded to whole pixels with the font's
// hinting (src/gui/text/qfontengine_win.cpp): its text comes out larger
// than on Linux.
//
//   node dist/bench/gdi.js
//
// Output: bench/out/gdi/gdi.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { python } from './entry.js';
import { repoRoot, run, runWkhtmltopdf, writeJson } from './wk.js';

const FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Verdana'];
const SIZES = [10, 12, 13, 16, 24, 48];
const out = join(repoRoot, 'bench', 'out', 'gdi');
mkdirSync(out, { recursive: true });
// Each line starts with its family and size, read back by gdi.py.
const blocks = FAMILIES.flatMap((family) => SIZES.map((px) =>
  `<div style="font-family: '${family}'; font-size: ${px}px; white-space: nowrap">${[0, 1, 2, 3].map((i) => `H ${family}|${px}|${i}`).join('<br>')}</div>`));
const html = join(out, 'gdi.html');
writeFileSync(html, `<!DOCTYPE html><html><body style="margin: 0">${blocks.join('\n')}</body></html>\n`);

const args = (pdf: string) => ['-q', '--disable-smart-shrinking', '-s', 'A3', html, join(out, pdf)];
const wk = await runWkhtmltopdf(args('wk.pdf'));
if (wk.code !== 0) throw new Error(`wkhtmltopdf: ${wk.stderr}`);
const ours = await run(process.execPath, [join(repoRoot, 'dist', 'bundle', 'wkhtmltopdf.cjs'), ...args('pdfkiln.pdf')]);
if (ours.code !== 0) throw new Error(`pdfkiln: ${ours.stderr}`);
const r = await run(python(), ['-I', join(repoRoot, 'bench', 'gdi.py'), join(out, 'wk.pdf'), join(out, 'pdfkiln.pdf')]);
if (r.code !== 0) throw new Error(`gdi.py: ${r.stderr}`);
const rows = JSON.parse(r.stdout.toString('utf8')) as Record<string, number | string>[];
writeJson(join(out, 'gdi.json'), { platform: process.platform, rows });
console.log('font            px   pitch wk  pdfkiln   size in PDF wk  pdfkiln   drawn wk  pdfkiln   (px)');
for (const x of rows) {
  const n = (k: string) => String(x[k]).padStart(7);
  console.log(`${String(x.family).padEnd(16)}${String(x.px).padStart(3)}   ${n('wkPitch')}${n('kilnPitch')}      ${n('wkSize')}${n('kilnSize')}   ${n('wkDrawn')}${n('kilnDrawn')}`);
}
