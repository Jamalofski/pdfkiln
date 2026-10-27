// What the JavaScript delay of the native interface costs: the pages of
// each corpus entry through the bundled pdfkiln with --javascript-delay 0,
// then with the default (1000 ms at most, less once the page is still),
// alternating, median of the runs.
//
//   npm run bundle && node dist/bench/native-delay.js [--runs 3]
//
// Output: bench/out/native-delay.json.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { corpusIds, prepare } from './entry.js';
import { repoRoot, run, writeJson } from './wk.js';

const { values } = parseArgs({ options: { runs: { type: 'string', default: '3' } } });
const cli = join(repoRoot, 'dist', 'bundle', 'pdfkiln.cjs');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

const rows: { id: string; none: number; delay: number; difference: number }[] = [];
for (const id of corpusIds()) {
  const e = await prepare(id);
  const time = async (args: string[]) => {
    const r = await run(process.execPath, [cli, '-q', ...args, ...e.call.pages, join(e.dir, 'native.pdf')], { cwd: e.dir });
    if (r.code !== 0) throw new Error(`${id}: ${r.stderr}`);
    return r.ms;
  };
  const none: number[] = [];
  const delay: number[] = [];
  // One warm-up round.
  for (let i = -1; i < Number(values.runs); i++) {
    const a = await time(['--javascript-delay', '0']);
    const b = await time([]);
    if (i < 0) continue;
    none.push(a);
    delay.push(b);
  }
  e.close();
  const row = { id, none: Math.round(median(none)), delay: Math.round(median(delay)), difference: 0 };
  row.difference = row.delay - row.none;
  rows.push(row);
  console.log(`${id.padEnd(36)} ${String(row.none).padStart(6)} ${String(row.delay).padStart(6)} ${String(row.difference).padStart(6)}`);
}
const d = rows.map((r) => r.difference).sort((a, b) => a - b);
const result = { runs: Number(values.runs), difference: { median: median(d), min: d[0], max: d.at(-1) }, entries: rows };
mkdirSync(join(repoRoot, 'bench', 'out'), { recursive: true });
writeJson(join(repoRoot, 'bench', 'out', 'native-delay.json'), result);
console.log(`\n${rows.length} entries: difference median ${result.difference.median} ms, from ${result.difference.min} to ${result.difference.max} ms`);
