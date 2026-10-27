// Gathers the four measures from bench/out into bench/out/summary.md.
//
//   node dist/bench/summarize.js
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './wk.js';

const out = join(repoRoot, 'bench', 'out');
const read = (p: string) => (existsSync(join(out, p)) ? JSON.parse(readFileSync(join(out, p), 'utf8')) : undefined);
const lines: string[] = [`# pdfkiln bench, ${process.platform}-${process.arch}, ${cpus().length} CPUs, ${new Date().toISOString().slice(0, 16)}`, ''];
const pct = (x: number) => `${Math.round(x * 100)} %`;
const f1 = (x: number | null | undefined) => (x === null || x === undefined ? '-' : x.toFixed(1));

// Measure 1.
const corpus = read('corpus/summary.json') as any[] | undefined;
if (corpus) {
  const ok = corpus.filter((r) => !r.error && !r.skipped);
  const failed = corpus.filter((r) => r.error).length;
  const skipped = corpus.filter((r) => r.skipped).map((r) => r.id);
  lines.push('## 1. Scale factor and text position', '');
  lines.push(`${ok.length} entries${failed ? `, ${failed} failed` : ''}${skipped.length ? `, ${skipped.length} skipped (several page objects, which the prototype does not print: ${skipped.join(', ')})` : ''}.`, '');
  const variants = Object.keys(ok[0]?.sweep ?? {});
  const scales = Object.keys(ok[0]?.sweep[variants[0]!] ?? {});
  lines.push(`| Scale | ${variants.join(' | ')} |`, `| --- |${variants.map(() => ' --- |').join('')}`);
  for (const s of scales) {
    lines.push(`| ${s} | ${variants.map((v) => ok.filter((r) => r.sweep[v][s] === r.wkPages).length).join(' | ')} |`);
  }
  lines.push('', 'Entries with the same page count as wkhtmltopdf, by scale and variant.', '');

  const keys = Object.keys(ok[0]?.comparisons ?? {});
  lines.push('| Variant@scale | Same page count | Words on the same page (corpus) | Same, mean of entries | Pages with median gap ≤ 2 mm | Pages with p90 gap ≤ 2 mm | Median gap (median of pages) |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const k of keys) {
    const comps = ok.map((r) => r.comparisons[k]).filter(Boolean);
    const pages = comps.flatMap((c) => c.per_page);
    const same = comps.filter((c) => c.pages[0] === c.pages[1]).length;
    const words = comps.reduce((a, c) => a + (c.same_page.same_page ?? 0), 0) / comps.length;
    // Weighted by the matched words: the share of the corpus's words.
    const matched = comps.reduce((a, c) => a + (c.same_page.matched ?? 0), 0);
    const corpusWords = comps.reduce((a, c) => a + (c.same_page.matched ?? 0) * (c.same_page.same_page ?? 0), 0) / matched;
    const medians = pages.map((p) => p.text.median ?? Infinity).sort((a, b) => a - b);
    lines.push(`| ${k} | ${same}/${comps.length} | ${(corpusWords * 100).toFixed(1)} % | ${(words * 100).toFixed(1)} % | ${pct(pages.filter((p) => (p.text.median ?? Infinity) <= 2).length / pages.length)} | ${pct(pages.filter((p) => (p.text.p90 ?? Infinity) <= 2).length / pages.length)} | ${f1(medians[Math.floor(medians.length / 2)])} mm |`);
  }
  lines.push('', '| Entry | wkhtmltopdf pages | Scales with the same count (wk variant) | Pages at 0.80 (plain / wk) | Median gap per page at 0.80, wk (mm) |', '| --- | --- | --- | --- | --- |');
  for (const r of ok) {
    const m = r.matching.wk ?? r.matching[variants[variants.length - 1]!];
    const span = m.length ? `${Math.min(...m).toFixed(2)}–${Math.max(...m).toFixed(2)}` : 'none';
    const p = (v: string) => r.comparisons[`${v}@0.80`]?.pages[1] ?? '-';
    const gaps = (r.comparisons['wk@0.80']?.per_page ?? []).map((x: any) => f1(x.text.median)).join(', ');
    lines.push(`| ${r.id} | ${r.wkPages} | ${span} | ${p('plain')} / ${p('wk')} | ${gaps} |`);
  }
  lines.push('');
}

// Measure 2.
const startups = existsSync(join(out, 'startup'))
  ? readdirSync(join(out, 'startup')).filter((f) => /^startup-delay\d+\.json$/.test(f)).sort().map((f) => read(`startup/${f}`))
  : [];
for (const startup of startups) {
  lines.push('## 2. Complete call', '', `Entry ${startup.entry}, ${startup.pages.wkhtmltopdf} pages, \`--javascript-delay ${startup.args[startup.args.indexOf('--javascript-delay') + 1]}\`.`, '');
  lines.push('| Tool | Median | p90 | Min |', '| --- | --- | --- | --- |');
  for (const [k, s] of Object.entries(startup.call as Record<string, any>)) lines.push(`| ${k} | ${s.median} ms | ${s.p90} ms | ${s.min} ms |`);
  lines.push(`| render in a running Chromium | ${startup.warmRender.median} ms | ${startup.warmRender.p90} ms | ${startup.warmRender.min} ms |`);
  lines.push('', `Steps (median, ms): ${JSON.stringify(startup.steps['pdfkiln wk'])}. Node start ${startup.nodeStart.median} ms, import puppeteer-core ${startup.nodeImportPuppeteer.median} ms.`, '');
}

// Measure 3.
const header = read('header/header.json');
if (header) {
  lines.push('## 3. header-html on a long document', '', `Pages: wkhtmltopdf ${header.pages.wkhtmltopdf}, pdfkiln ${header.pages.pdfkiln}.`, '');
  lines.push('| | With header | Without | Header cost |', '| --- | --- | --- | --- |');
  lines.push(`| wkhtmltopdf | ${header.wkhtmltopdf.withHeader} ms | ${header.wkhtmltopdf.without} ms | ${header.wkhtmltopdf.withHeader - header.wkhtmltopdf.without} ms |`);
  lines.push(`| pdfkiln, complete call | ${header.pdfkilnFullCall.withHeader} ms | ${header.pdfkilnFullCall.without} ms | ${header.pdfkilnFullCall.withHeader - header.pdfkilnFullCall.without} ms |`);
  lines.push('', '| Strategy (running Chromium) | Render | Stamp | PDF size | Render steps |', '| --- | --- | --- | --- | --- |');
  for (const [k, s] of Object.entries(header.strategies as Record<string, any>)) {
    lines.push(`| ${k} | ${s.render} ms | ${s.stamp} ms | ${Math.round(s.bytes / 1024)} KB | ${s.steps ? JSON.stringify(s.steps) : ''} |`);
  }
  lines.push('', `wkhtmltopdf file: ${Math.round(header.sizes.wkhtmltopdf / 1024)} KB.`, '');
}

// Measure 4.
const outline = read('outline/outline.json');
if (outline) {
  lines.push('## 4. generateDocumentOutline', '');
  lines.push('| Output | Entries | Levels | Print | Size |', '| --- | --- | --- | --- | --- |');
  for (const [k, v] of Object.entries(outline as Record<string, any>)) {
    const levels = [...new Set((v.outline ?? []).map((e: any) => e.level))].sort().join(',');
    lines.push(`| ${k} | ${(v.outline ?? []).length} | ${levels || '-'} | ${v.printMs ? `${Math.round(v.printMs)} ms` : '-'} | ${v.bytes ? `${Math.round(v.bytes / 1024)} KB` : '-'} |`);
  }
  for (const k of ['wkhtmltopdf', 'chromium outline+tagged']) {
    if (!outline[k]) continue;
    lines.push('', `${k}:`, '', '```');
    for (const e of outline[k].outline) lines.push(`${'  '.repeat(e.level - 1)}h${e.level} p${e.page} dest ${e.y} mm (text at ${e.text_y} mm) ${e.title.slice(0, 60)}`);
    lines.push('```');
  }
  lines.push('');
}

const sandbox = read('sandbox.json');
if (sandbox) lines.push('## Sandbox', '', '```', JSON.stringify(sandbox), '```', '');

const md = lines.join('\n');
writeFileSync(join(out, 'summary.md'), md);
console.log(md);
