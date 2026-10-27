// Measure 4: what Chromium's experimental generateDocumentOutline produces,
// against wkhtmltopdf's outline, on a document of tricky headings.
//
//   node dist/bench/outline.js
//
// Output: bench/out/outline/ (PDFs, outline.json).
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, printPage, session } from '../src/render.js';
import { python } from './entry.js';
import { repoRoot, run, runWkhtmltopdf, writeJson } from './wk.js';

const out = join(repoRoot, 'bench', 'out', 'outline');
mkdirSync(out, { recursive: true });

const filler = (n: number) => `<p>${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(n)}</p>`;
const doc = join(out, 'headings.html');
writeFileSync(doc, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Headings</title>
<style>.break { break-before: page } .sr-only { position: absolute; left: -9999px }</style></head><body>
<h1>1 Introduction</h1>${filler(8)}
<h2>1.1 Scope</h2>${filler(8)}
<h3>1.1.1 Detail</h3>${filler(4)}
<h4>1.1.1.1 Deeper</h4>${filler(2)}
<h5>1.1.1.1.1 Level five</h5>${filler(2)}
<h6>1.1.1.1.1.1 Level six</h6>${filler(2)}
<h1 class="break">2 Prices &amp; <em>discounts</em> (inline markup)</h1>${filler(6)}
<h2>2.1 Été 2026 — accents, “quotes” and 📦 emoji</h2>${filler(6)}
<h4>2.1.1 Skipped level (h2 then h4)</h4>${filler(6)}
<h2 style="display:none">2.2 Hidden with display:none</h2>
<h2 class="sr-only">2.3 Visually hidden, off screen</h2>
<div role="heading" aria-level="2">2.4 ARIA heading (div role=heading)</div>${filler(4)}
<h2></h2>
<table><tr><td><h3>2.5 Heading inside a table cell</h3></td></tr></table>${filler(40)}
<h1>3 Lands near a page break</h1>${filler(60)}
<h2>3.1 ${'Very long heading '.repeat(12)}</h2>${filler(4)}
<h1 class="break">4 Last section</h1>${filler(4)}
</body></html>`);

async function toc(pdf: string): Promise<any> {
  const r = await run(python(), ['-I', join(repoRoot, 'bench', 'toc.py'), pdf]);
  if (r.code !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout.toString('utf8'));
}

const results: Record<string, any> = {};

// wkhtmltopdf: its outline is on by default (depth 4).
let r = await runWkhtmltopdf(['--quiet', doc, join(out, 'wk.pdf')]);
results.wkhtmltopdf = { ...(await toc(join(out, 'wk.pdf'))), ms: r.ms, bytes: statSync(join(out, 'wk.pdf')).size };
r = await runWkhtmltopdf(['--quiet', '--outline-depth', '6', doc, join(out, 'wk-depth6.pdf')]);
results['wkhtmltopdf --outline-depth 6'] = await toc(join(out, 'wk-depth6.pdf'));

const browser = await launch();
try {
  const url = pathToFileURL(doc).href;
  const cases: Record<string, { outline: boolean; tagged: boolean }> = {
    'none': { outline: false, tagged: false },
    'tagged': { outline: false, tagged: true },
    'outline+tagged': { outline: true, tagged: true },
  };
  for (const [name, o] of Object.entries(cases)) {
    const page = await browser.newPage();
    const times: number[] = [];
    let pdf: Uint8Array = new Uint8Array();
    for (let i = 0; i < 5; i++) {
      const t: Record<string, number> = {};
      pdf = await printPage(page, url, { scale: 0.8, javascriptDelay: 0, ...o }, t);
      times.push(t.print!);
    }
    await page.close();
    const file = join(out, `ours-${name}.pdf`);
    writeFileSync(file, pdf);
    results[`chromium ${name}`] = { ...(await toc(file)), printMs: times.sort((a, b) => a - b)[2], bytes: pdf.length };
  }

  // Cost on a long document (the 100-page report of bench/header.ts).
  const long = join(repoRoot, 'bench', 'out', 'header', 'long.html');
  if (existsSync(long)) {
    for (const [name, o] of Object.entries(cases)) {
      const page = await browser.newPage();
      const times: number[] = [];
      let bytes = 0;
      for (let i = 0; i < 3; i++) {
        const t: Record<string, number> = {};
        bytes = (await printPage(page, pathToFileURL(long).href, { scale: 0.8, javascriptDelay: 0, ...o }, t)).length;
        times.push(t.print!);
      }
      await page.close();
      results[`long document, chromium ${name}`] = { printMs: times.sort((a, b) => a - b)[1], bytes, outline: [] };
    }
  }

  // Outline without tagging, straight through the protocol: Puppeteer
  // always turns tagging on with the outline (crbug.com/840455#c44).
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const cdp = await session(page);
  const res = (await cdp.send('Page.printToPDF', {
    paperWidth: 210 / 25.4, paperHeight: 297 / 25.4, scale: 0.8,
    generateDocumentOutline: true, generateTaggedPDF: false,
  })) as { data: string };
  const file = join(out, 'ours-outline-untagged.pdf');
  writeFileSync(file, Buffer.from(res.data, 'base64'));
  results['chromium outline without tagged'] = await toc(file);
  await page.close();
} finally {
  await browser.close();
}

writeJson(join(out, 'outline.json'), results);
for (const [k, v] of Object.entries(results)) {
  console.log(`\n## ${k}: ${v.pages} pages, tagged=${v.tagged}${v.printMs ? `, print ${Math.round(v.printMs)} ms` : ''}${v.bytes ? `, ${v.bytes} bytes` : ''}`);
  for (const e of v.outline) console.log(`${'  '.repeat(e.level - 1)}${e.level} p${e.page} y=${e.y} text_y=${e.text_y} ${e.title.slice(0, 70)}`);
}
