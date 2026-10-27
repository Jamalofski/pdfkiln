// Measure 1: replays every corpus entry with wkhtmltopdf 0.12.6 and with the
// prototype at a range of scales, then compares the PDFs. The prototype
// prints one page object: entries with several are skipped (the compat
// bench runs them with the command).
//
//   node dist/bench/corpus.js [--scales 0.70:1.00:0.01] [--compare 1,0.8] [--variants plain,wk] [id...]
//
// Output: bench/out/corpus/<id>/ (PDFs, result.json, diff PNGs) and
// bench/out/corpus/summary.json.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser } from 'puppeteer-core';
import { launch } from '../src/render.js';
import { compare, corpusIds, pageCount, prepare, variants } from './entry.js';
import { renderCall, repoRoot, runWkhtmltopdf, writeJson } from './wk.js';

function range(spec: string): number[] {
  const [a, b, step] = spec.split(':').map(Number) as [number, number, number];
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scales: { type: 'string', default: '0.70:1.00:0.01' },
    compare: { type: 'string', default: '1,0.8' },
    variants: { type: 'string', default: 'plain,truncate,wkfonts,wk' },
  },
});

const outRoot = join(repoRoot, 'bench', 'out', 'corpus');
const ids = positionals.length ? positionals : corpusIds();
const scales = range(values.scales!);
const compareAt = values.compare!.split(',').map(Number);

const wanted = values.variants!.split(',');
const variantList = Object.fromEntries(Object.entries(variants()).filter(([k]) => wanted.includes(k)));
const browsers: Record<string, Browser> = {};
for (const [name, v] of Object.entries(variantList)) browsers[name] = await launch(v.env);
const summary: any[] = [];
try {
  for (const id of ids) {
    const out = join(outRoot, id);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const e = await prepare(id);
    const { manifest, call, misses } = e;
    if (call.pages.length !== 1) {
      console.log(`${id}: skipped, ${call.pages.length} page objects`);
      summary.push({ id, skipped: `${call.pages.length} page objects` });
      e.close();
      continue;
    }

    const wkPdf = join(out, 'wk.pdf');
    const wk = await runWkhtmltopdf(e.wkArgs(wkPdf), { cwd: e.dir, stdin: e.stdin });
    const wkMisses = [...misses];
    misses.length = 0;
    if (wk.code !== 0 || !existsSync(wkPdf)) {
      console.error(`${id}: wkhtmltopdf exited with ${wk.code}\n${wk.stderr}`);
      summary.push({ id, error: `wkhtmltopdf exit ${wk.code}` });
      e.close();
      continue;
    }
    const wkPages = await pageCount(readFileSync(wkPdf));

    const sweep: Record<string, Record<string, number>> = {};
    const comparisons: Record<string, any> = {};
    for (const [name, v] of Object.entries(variantList)) {
      sweep[name] = {};
      for (const s of [...new Set([...scales, ...compareAt])].sort()) {
        const r = await renderCall(browsers[name]!, call, s, v.opts);
        sweep[name]![s.toFixed(3)] = await pageCount(r.pdf);
        if (compareAt.includes(s)) {
          const file = join(out, `ours-${name}-${s.toFixed(2)}.pdf`);
          writeFileSync(file, r.pdf);
          comparisons[`${name}@${s.toFixed(2)}`] = await compare(wkPdf, file, join(out, `diff-${name}-${s.toFixed(2)}`));
        }
      }
    }
    const matching = Object.fromEntries(
      Object.entries(sweep).map(([name, counts]) => [name, Object.entries(counts).filter(([, n]) => n === wkPages).map(([s]) => Number(s))]),
    );
    const row = { id, title: manifest.title, license: manifest.license, wkPages, wkMs: wk.ms, wkMisses, oursMisses: [...new Set(misses)], ignored: call.ignored, sweep, matching, comparisons };
    writeJson(join(out, 'result.json'), row);
    summary.push(row);
    console.log(`${id}: wkhtmltopdf ${wkPages} pages; same count at scales ${JSON.stringify(matching)}`);

    e.close();
  }
} finally {
  for (const b of Object.values(browsers)) await b.close();
}
writeJson(join(outRoot, 'summary.json'), summary);
