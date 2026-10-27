// Table rows that wkhtmltopdf 0.12.6 makes taller than their content.
// WebKit 534 lays a row's cells out before placing the row, where they
// were in the previous layout, the screen one, unpaginated, at the
// viewport (0 x 0 by default): what pagination pushes there (a line, a
// page-break-inside: avoid block) makes the row taller, and the row keeps
// that height once the cells are back in place
// (RenderTableSection::layoutRows).
//
//   node dist/bench/rows.js
//
// Eight rows whose cells hold six lines of text, after a spacer, on A4 with
// 20 mm margins; Frappe's page-break-inside rules or none; the default
// viewport or one as wide as the paper. Prints the row heights per page.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { python } from './entry.js';
import { repoRoot, run, runWkhtmltopdf, writeJson } from './wk.js';

const out = join(repoRoot, 'bench', 'out', 'rows');
mkdirSync(out, { recursive: true });
const line = '<p>Lorem ipsum dolor sit amet consectetur</p>';
const rows = Array.from({ length: 8 }, (_, i) => `<tr><td>R${i + 1}</td><td><div>${line.repeat(6)}</div></td></tr>`).join('');
const base = 'body { margin: 0; font: 12px sans-serif } table { border-collapse: collapse; width: 100% }'
  + ' td, th { border: 1px solid #000; padding: 10px; vertical-align: top } p { margin: 3px 0; line-height: 21px }';
const frappe = ' tr { page-break-inside: avoid } table td div { page-break-inside: avoid }';
const variants: Record<string, { css: string; args: string[] }> = {
  'Frappe rules, default viewport': { css: base + frappe, args: [] },
  'no rules, default viewport': { css: base, args: [] },
  'Frappe rules, viewport 680 px': { css: base + frappe, args: ['--viewport-size', '680x1000'] },
};
const result: Record<string, Record<number, number[][]>> = {};
for (const [name, v] of Object.entries(variants)) {
  console.log(`== ${name}: row heights per page (rows on top of a page start after the 35 px header)`);
  result[name] = {};
  for (const spacer of [0, 40, 100, 120, 140]) {
    const html = join(out, `rows-${spacer}.html`);
    const pdf = join(out, `rows-${spacer}.pdf`);
    writeFileSync(html, `<!DOCTYPE html><html><head><style>${v.css}</style></head><body><div style="height:${spacer}px"></div>`
      + `<table><thead><tr><th>Sr</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    const w = await runWkhtmltopdf(['-q', ...v.args, '--disable-smart-shrinking', '-T', '20', '-B', '20', '-L', '15', '-R', '15', html, pdf]);
    if (w.code !== 0) throw new Error(`wkhtmltopdf: ${w.stderr}`);
    const r = await run(python(), ['-I', join(repoRoot, 'bench', 'rules.py'), pdf, '20']);
    if (r.code !== 0) throw new Error(`rules.py: ${r.stderr}`);
    const pages = JSON.parse(r.stdout.toString('utf8')) as number[][];
    result[name][spacer] = pages;
    const heights = pages.map((ys) => ys.slice(1).map((y, i) => y - ys[i]!).slice(1));
    console.log(`spacer ${String(spacer).padStart(3)} px: ${heights.map((h) => h.join(' ')).join(' | ')}`);
  }
}
writeJson(join(out, 'rows.json'), result);
