// The corpus as images: wkhtmltoimage 0.12.6 against pdfkiln's, the first
// page of each entry captured as PNG. Prints, per entry, the sizes and the
// share of pixels that differ.
//   npm run build && node dist/bench/image.js [--entry odoo17-invoice]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { corpusIds, prepare, python } from './entry.js';
import { repoRoot, run, wkhtmltopdfEnv, wkhtmltopdfPath } from './wk.js';

const { values } = parseArgs({ options: { entry: { type: 'string', multiple: true } } });
const outRoot = join(repoRoot, 'bench', 'out', 'image');
const wkImage = wkhtmltopdfPath().replace(/wkhtmltopdf(\.exe)?$/, 'wkhtmltoimage$1');
const ours = join(repoRoot, 'dist', 'src', 'bin', 'wkhtmltoimage.js');

// Sizes, and the pixels whose luminance differs by more than 64 out of 255
// on the area both images cover.
const script = `import sys, json, pymupdf
a, b = pymupdf.Pixmap(sys.argv[1]), pymupdf.Pixmap(sys.argv[2])
w, h = min(a.width, b.width), min(a.height, b.height)
def lum(p, x, y):
    c = p.pixel(x, y)
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
n = d = 0
for y in range(0, h, 2):
    for x in range(0, w, 2):
        n += 1
        d += abs(lum(a, x, y) - lum(b, x, y)) > 64
print(json.dumps({"wk": [a.width, a.height], "kiln": [b.width, b.height], "differ": d / max(n, 1)}))`;

const rows: unknown[] = [];
for (const id of values.entry ?? corpusIds()) {
  const p = await prepare(id);
  try {
    const page = p.call.pages[0]!;
    const out = join(outRoot, id);
    mkdirSync(out, { recursive: true });
    const args = ['-q', '--enable-local-file-access', '-f', 'png', page];
    const wkPng = join(out, 'wkhtmltoimage.png');
    if (!existsSync(wkPng)) await run(wkImage, [...args, wkPng], { cwd: p.dir, env: wkhtmltopdfEnv() });
    const kilnPng = join(out, 'pdfkiln.png');
    const r = await run(process.execPath, [ours, ...args, kilnPng], { cwd: p.dir });
    if (r.code !== 0) console.log(`${id}: pdfkiln exit ${r.code} ${r.stderr.trim()}`);
    const c = JSON.parse((await run(python(), ['-I', '-c', script, wkPng, kilnPng])).stdout.toString('utf8'));
    rows.push({ id, ...c });
    console.log(`${id}: wkhtmltoimage ${c.wk.join('x')}, pdfkiln ${c.kiln.join('x')}, ${(c.differ * 100).toFixed(1)} % of pixels differ`);
  } finally {
    p.close();
  }
}
writeFileSync(join(outRoot, 'summary.json'), JSON.stringify(rows, null, 2));
