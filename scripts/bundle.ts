// Bundles the command into one ESM file per entry point: Node loads one
// file instead of the hundreds of modules of puppeteer-core and pdf-lib,
// which halves the start-up time, and the single executable embeds it.
//
//   node dist/scripts/bundle.js   ->  dist/bundle/pdfkiln.cjs, wkhtmltopdf.cjs, wkhtmltoimage.cjs
//
// CommonJS, the format of Node's single executable applications.
import { build } from 'esbuild';
import { join } from 'node:path';
import { repoRoot } from '../src/chromium.js';

await build({
  entryPoints: {
    pdfkiln: join(repoRoot, 'src', 'bin', 'pdfkiln.ts'),
    wkhtmltopdf: join(repoRoot, 'src', 'bin', 'wkhtmltopdf.ts'),
    wkhtmltoimage: join(repoRoot, 'src', 'bin', 'wkhtmltoimage.ts'),
  },
  outdir: join(repoRoot, 'dist', 'bundle'),
  outExtension: { '.js': '.cjs' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  legalComments: 'linked',
  // Optional native modules of ws, and WebDriver BiDi, never used with a pipe.
  external: ['bufferutil', 'utf-8-validate', 'chromium-bidi', 'chromium-bidi/*'],
  logLevel: 'warning',
  // src/chromium.ts falls back on __dirname in CommonJS.
  logOverride: { 'empty-import-meta': 'silent' },
});
