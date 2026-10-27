// Bench helpers: run the reference wkhtmltopdf, and replay one of its
// command lines with the prototype renderer.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Browser } from 'puppeteer-core';
import { PDFDocument } from '@cantoo/pdf-lib';
import { allowCrossOriginFonts, printPage, toUrl, WKHTMLTOPDF_DEFAULTS, type Margins, type RenderOptions } from '../src/render.js';
import { measureHeight, renderBatch, stamp, withParams, type Layer, type PageParams } from '../src/headerfooter.js';

export const repoRoot = resolve(import.meta.dirname, '..', '..');
const wkRoot = join(repoRoot, '.cache', 'wkhtmltopdf', '0.12.6');

// Both engines see the same fonts, whatever else the machine has
// (bench/fonts.conf); PDFKILN_SYSTEM_FONTS=1 keeps the system's.
if (process.platform === 'linux' && !process.env.PDFKILN_SYSTEM_FONTS) {
  process.env.FONTCONFIG_FILE = join(repoRoot, 'bench', 'fonts.conf');
}

export function wkhtmltopdfPath(): string {
  if (process.env.WKHTMLTOPDF) return process.env.WKHTMLTOPDF;
  return process.platform === 'win32'
    ? join(wkRoot, 'win-x64', 'bin', 'wkhtmltopdf.exe')
    : join(wkRoot, 'linux-x64', 'usr', 'local', 'bin', 'wkhtmltopdf');
}

export function wkhtmltopdfEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const ssl = join(wkRoot, 'linux-x64-libssl', 'usr', 'lib', 'x86_64-linux-gnu');
  if (process.platform === 'linux' && existsSync(ssl)) {
    env.LD_LIBRARY_PATH = [ssl, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  }
  return env;
}

export interface RunResult { code: number | null; ms: number; stdout: Buffer; stderr: string }

export function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; stdin?: string } = {}): Promise<RunResult> {
  return new Promise((ok, fail) => {
    const t0 = performance.now();
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => stdout.push(d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', fail);
    child.on('close', (code) => ok({ code, ms: performance.now() - t0, stdout: Buffer.concat(stdout), stderr }));
    if (opts.stdin) child.stdin.end(readFileSync(opts.stdin));
    else child.stdin.end();
  });
}

export function runWkhtmltopdf(args: string[], opts: { cwd?: string; stdin?: string } = {}): Promise<RunResult> {
  return run(wkhtmltopdfPath(), args, { ...opts, env: wkhtmltopdfEnv() });
}

// The subset of the wkhtmltopdf command line the corpus uses.
export interface WkCall {
  pageWidth: number;
  pageHeight: number;
  margin: Partial<Margins>;
  zoom: number;
  dpi: number;
  smartShrinking: boolean;
  printMediaType: boolean;
  background: boolean;
  javascriptDelay: number;
  headerHtml?: string;
  footerHtml?: string;
  headerSpacing: number;
  footerSpacing: number;
  title?: string;
  pages: string[];
  output: string;
  ignored: string[];
}

const PAGE_SIZES: Record<string, [number, number]> = {
  a3: [297, 420], a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6],
};

// strToUnitReal in src/lib/pdfsettings.cc; millimetres by default.
export function unitToMm(v: string): number {
  const m = /^([0-9.]+)\s*([a-z]*)$/i.exec(v.trim());
  if (!m) throw new Error(`bad length ${v}`);
  const n = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  const factor: Record<string, number> = {
    '': 1, mm: 1, millimeter: 1, cm: 10, centimeter: 10, m: 1000, meter: 1000,
    in: 25.4, inch: 25.4, pt: 25.4 / 72, point: 25.4 / 72, pc: 25.4 / 6, pica: 25.4 / 6, px: 25.4 / 96, pixel: 25.4 / 96,
  };
  const f = factor[unit];
  if (f === undefined) throw new Error(`bad unit in ${v}`);
  return n * f;
}

const WITH_VALUE = new Set([
  '--allow', '--cookie', '--custom-header', '--encoding', '--footer-center', '--footer-font-name', '--footer-font-size',
  '--footer-left', '--footer-right', '--header-center', '--header-font-name', '--header-font-size', '--header-left',
  '--header-right', '--minimum-font-size', '--replace', '--run-script', '--user-style-sheet', '--window-status',
  '--viewport-size', '--image-dpi', '--image-quality', '--load-error-handling', '--load-media-error-handling',
  '--cache-dir', '--cookie-jar', '--post', '--post-file', '--proxy', '--username', '--password', '--log-level',
  '--bypass-proxy-for', '--checkbox-checked-svg', '--checkbox-svg', '--radiobutton-checked-svg', '--radiobutton-svg',
  '--outline-depth', '--page-offset', '--copies', '--dump-outline',
]);
const TWO_VALUES = new Set(['--cookie', '--custom-header', '--replace', '--post', '--post-file']);

export function parseWkArgs(argv: string[]): WkCall {
  const call: WkCall = {
    pageWidth: 210, pageHeight: 297, margin: {}, zoom: 1, dpi: 96, smartShrinking: true,
    printMediaType: false, background: true, javascriptDelay: 200, headerSpacing: 0, footerSpacing: 0,
    pages: [], output: '', ignored: [],
  };
  let landscape = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i] ?? '';
    switch (a) {
      case '-s': case '--page-size': {
        const size = PAGE_SIZES[next().toLowerCase()];
        if (!size) throw new Error(`unsupported page size ${argv[i]}`);
        [call.pageWidth, call.pageHeight] = size;
        break;
      }
      case '--page-width': call.pageWidth = unitToMm(next()); break;
      case '--page-height': call.pageHeight = unitToMm(next()); break;
      case '-O': case '--orientation': landscape = next().toLowerCase() === 'landscape'; break;
      case '-T': case '--margin-top': call.margin.top = unitToMm(next()); break;
      case '-B': case '--margin-bottom': call.margin.bottom = unitToMm(next()); break;
      case '-L': case '--margin-left': call.margin.left = unitToMm(next()); break;
      case '-R': case '--margin-right': call.margin.right = unitToMm(next()); break;
      case '-d': case '--dpi': call.dpi = Number(next()); break;
      case '--zoom': call.zoom = Number(next()); break;
      case '--disable-smart-shrinking': call.smartShrinking = false; break;
      case '--enable-smart-shrinking': call.smartShrinking = true; break;
      case '--print-media-type': call.printMediaType = true; break;
      case '--no-print-media-type': call.printMediaType = false; break;
      case '--no-background': call.background = false; break;
      case '--background': call.background = true; break;
      case '--javascript-delay': call.javascriptDelay = Number(next()); break;
      case '--header-html': call.headerHtml = next(); break;
      case '--footer-html': call.footerHtml = next(); break;
      case '--header-spacing': call.headerSpacing = Number(next()); break;
      case '--footer-spacing': call.footerSpacing = Number(next()); break;
      case '--title': call.title = next(); break;
      case '-q': case '--quiet': case '--disable-local-file-access': case '--enable-local-file-access':
      case '--disable-javascript': case '--enable-javascript': case '--no-outline': case '--outline':
      case '--lowquality': case '-l':
        call.ignored.push(a);
        break;
      default:
        if (a.startsWith('-') && a !== '-') {
          call.ignored.push(a);
          if (TWO_VALUES.has(a)) i += 2;
          else if (WITH_VALUE.has(a)) i += 1;
        } else positional.push(a);
    }
  }
  if (landscape) [call.pageWidth, call.pageHeight] = [call.pageHeight, call.pageWidth];
  call.output = positional.pop() ?? '';
  call.pages = positional;
  return call;
}

export interface OursResult { pdf: Uint8Array; ms: Record<string, number> }

// Replays `call` with the prototype: body printed at `scale` (times
// --zoom), then header-html and footer-html stamped as wkhtmltopdf places
// them (src/lib/pdfconverter.cc, beginConvert and endPage).
export async function renderCall(browser: Browser, call: WkCall, scale: number, extra: RenderOptions = {}): Promise<OursResult> {
  const ms: Record<string, number> = {};
  if (call.pages.length !== 1) throw new Error('the prototype prints one page object');
  const pageArg = call.pages[0]!;
  const d = WKHTMLTOPDF_DEFAULTS;
  const s = (call.smartShrinking ? scale : 1) * call.zoom;
  const left = call.margin.left ?? d.margin.left;
  const right = call.margin.right ?? d.margin.right;
  const box = {
    width: call.pageWidth - left - right,
    scale: s,
    media: call.printMediaType ? 'print' as const : 'screen' as const,
    // WebKit prints the header and footer pages too, dropping their top margin.
    emulation: extra,
  };
  const t0 = performance.now();

  // Measured on wkhtmltopdf 0.12.6 (bench/out/hs-*.pdf). With --margin-top,
  // the content starts there and the header's bottom edge sits
  // header-spacing above it; the footer mirrors this at the bottom. Without
  // it, wkhtmltopdf measures the header page and reserves its height read in
  // points instead of pixels (4/3 too big) plus the spacing; a missing
  // header then means no margin at all. 10 mm when there is neither.
  const measure = async (url?: string) => {
    if (!url) return { box: 0, extent: 0, textBottom: 0 };
    const page = await browser.newPage();
    await allowCrossOriginFonts(page);
    const m = await measureHeight(page, toUrl(url), box);
    await page.close();
    return m;
  };
  const measures = Promise.all([measure(call.headerHtml), measure(call.footerHtml)]);
  const PT_PER_PX = 96 / 72;
  const auto = Boolean(call.headerHtml || call.footerHtml);
  const margins = async () => {
    const [header, footer] = await measures;
    const top = call.margin.top ?? (auto ? (call.headerHtml ? header.textBottom * PT_PER_PX + call.headerSpacing : 0) : 10);
    const bottom = call.margin.bottom ?? (auto ? (call.footerHtml ? footer.textBottom * PT_PER_PX + call.footerSpacing : 0) : 10);
    return { top, bottom };
  };

  // The body, in parallel with the measures when the margins are given.
  const body = (async () => {
    const page = await browser.newPage();
    await allowCrossOriginFonts(page);
    const needMeasures = (call.headerHtml && call.margin.top === undefined) || (call.footerHtml && call.margin.bottom === undefined);
    const { top, bottom } = needMeasures ? await margins() : { top: call.margin.top ?? 10, bottom: call.margin.bottom ?? 10 };
    const t: Record<string, number> = {};
    const pdf = await printPage(page, toUrl(pageArg), {
      ...extra,
      scale: s,
      pageWidth: call.pageWidth,
      pageHeight: call.pageHeight,
      margin: { top, right, bottom, left },
      printMediaType: call.printMediaType,
      background: call.background,
      javascriptDelay: call.javascriptDelay,
    }, t);
    const title = await page.title();
    await page.close();
    return { pdf, title, t };
  })();
  const [{ pdf: bodyPdf, title, t }, [header, footer], { top, bottom }] = await Promise.all([body, measures, margins()]);
  Object.assign(ms, t);
  ms.body = performance.now() - t0;
  let pdf = bodyPdf;

  if (call.headerHtml || call.footerHtml) {
    const t1 = performance.now();
    const count = (await PDFDocument.load(pdf)).getPageCount();
    const now = new Date();
    const params = (i: number): PageParams => ({
      page: i + 1, frompage: 1, topage: count, webpage: pageArg, section: '', subsection: '', subsubsection: '',
      sitepage: i + 1, sitepages: count, doctitle: call.title ?? title, title,
      date: now.toLocaleDateString(), isodate: now.toISOString().slice(0, 10), time: now.toLocaleTimeString(),
    });
    const indices = Array.from({ length: count }, (_, i) => i);
    const layer = async (url: string, height: number, y: number): Promise<Layer> => ({
      stamps: await renderBatch(browser, indices.map((i) => withParams(toUrl(url), params(i))), box, height),
      place: () => ({ left, top: y, width: box.width, height }),
    });
    const layers = await Promise.all([
      call.headerHtml ? layer(call.headerHtml, header.extent, top - call.headerSpacing - header.box) : undefined,
      call.footerHtml ? layer(call.footerHtml, footer.extent, call.pageHeight - bottom + call.footerSpacing) : undefined,
    ]);
    pdf = await stamp(pdf, layers.filter((l): l is Layer => Boolean(l)));
    ms.headerFooter = performance.now() - t1;
  }
  return { pdf, ms };
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
