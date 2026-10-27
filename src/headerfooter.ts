// Prototype of the header-html / footer-html stamping described in the
// specification: the header page is loaded with the same URL parameters as
// wkhtmltopdf, printed with Chromium, then drawn on each page of the body.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import type { Browser, Page } from 'puppeteer-core';
import { allowCrossOriginFonts, emulate, emulateMedia, type RenderOptions } from './render.js';

const PT_PER_MM = 72 / 25.4;
const PX_PER_MM = 96 / 25.4;

// The query parameters wkhtmltopdf 0.12.6 adds to the header and footer URL
// (src/lib/outline.cc fillHeaderFooterParms, pdfconverter.cc fillParms).
export interface PageParams {
  page: number;
  frompage: number;
  topage: number;
  webpage: string;
  section: string;
  subsection: string;
  subsubsection: string;
  sitepage: number;
  sitepages: number;
  doctitle: string;
  title: string;
  date: string;
  isodate: string;
  time: string;
}

export function withParams(url: string, p: PageParams): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(p)) u.searchParams.append(k, String(v));
  // wkhtmltopdf encodes spaces as %20; scripts call unescape(), which keeps '+'.
  return u.href.replace(/\+/g, '%20');
}

export interface Box {
  width: number; // mm, the body's content width
  scale: number; // printToPDF scale, the same as the body
  media: 'screen' | 'print'; // CSS media type, the same as the body
  emulation?: RenderOptions; // wkhtmltopdf emulations, the same as the body
}

export interface Measure {
  box: number; // mm, height of the <body> box: wkhtmltopdf places the header by it
  extent: number; // mm, what must be printed: the box, or its content if taller
  textBottom: number; // mm, bottom of the last line of text
}

// Lays the header out at the box width and measures it. wkhtmltopdf puts the
// bottom of the header's <body> box header-spacing above the content (Odoo
// sets html { height: 0 }, so its header hangs down from there instead), and
// sizes an automatic margin from the header's text only.
export async function measureHeight(page: Page, url: string, box: Box): Promise<Measure> {
  await page.setViewport({ width: Math.round((box.width * PX_PER_MM) / box.scale), height: 100 });
  await emulateMedia(page, box.media);
  const loaded = await emulate(page, box.emulation ?? {});
  await page.goto(url, { waitUntil: 'load' });
  await loaded();
  const px = await page.evaluate(() => {
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let textBottom = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.height > 0) textBottom = Math.max(textBottom, r.bottom - rect.top);
    }
    // From the top of the document: the body's own margin is printed too.
    const extent = Math.max(rect.bottom, ...[...body.children].map((c) => c.getBoundingClientRect().bottom));
    return { box: rect.height, extent, textBottom };
  });
  const mm = (v: number) => (v * box.scale) / PX_PER_MM;
  return { box: mm(px.box), extent: mm(px.extent), textBottom: mm(px.textBottom) };
}

async function printOne(page: Page, url: string, box: Box, height: number): Promise<Uint8Array> {
  await emulateMedia(page, box.media);
  await page.goto(url, { waitUntil: 'load' });
  return page.pdf({
    width: `${box.width}mm`,
    height: `${height}mm`,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
    scale: box.scale,
    pageRanges: '1',
    tagged: false,
  });
}

// Strategy "sequential": one tab, one load and one print per page.
export async function renderSequential(browser: Browser, urls: string[], box: Box, height: number): Promise<Uint8Array[]> {
  const page = await browser.newPage();
  await allowCrossOriginFonts(page);
  const out: Uint8Array[] = [];
  for (const url of urls) out.push(await printOne(page, url, box, height));
  await page.close();
  return out;
}

// Strategy "parallel": the same, spread over `tabs` tabs.
export async function renderParallel(browser: Browser, urls: string[], box: Box, height: number, tabs: number): Promise<Uint8Array[]> {
  const out: Uint8Array[] = new Array(urls.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(tabs, urls.length) }, async () => {
      const page = await browser.newPage();
      await allowCrossOriginFonts(page);
      while (next < urls.length) {
        const i = next++;
        out[i] = await printOne(page, urls[i]!, box, height);
      }
      await page.close();
    }),
  );
  return out;
}

// Strategy "batch": one document holding one iframe per page, printed once;
// page i of the result is the header of page i.
export async function renderBatch(browser: Browser, urls: string[], box: Box, height: number, t: Record<string, number> = {}): Promise<Uint8Array> {
  const page = await browser.newPage();
  await allowCrossOriginFonts(page);
  const w = (box.width * PX_PER_MM) / box.scale;
  const h = (height * PX_PER_MM) / box.scale;
  const frames = urls
    .map((u) => `<iframe src="${u.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`)
    .join('');
  const html = `<!doctype html><style>
    html, body { margin: 0; padding: 0; background: transparent }
    iframe { display: block; border: 0; width: ${w}px; height: ${h}px; break-after: page }
    iframe:last-child { break-after: auto }
  </style>${frames}`;
  // A file: page may frame both file: and http: headers; about:blank may
  // not frame file: ones.
  const dir = mkdtempSync(join(tmpdir(), 'pdfkiln-'));
  const file = join(dir, 'headers.html');
  writeFileSync(file, html);
  await emulateMedia(page, box.media);
  const loaded = await emulate(page, box.emulation ?? {});
  let t0 = performance.now();
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  t.load = performance.now() - t0;
  t0 = performance.now();
  await loaded();
  t.emulate = performance.now() - t0;
  rmSync(dir, { recursive: true });
  t0 = performance.now();
  const pdf = await page.pdf({
    width: `${box.width}mm`,
    height: `${height}mm`,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
    scale: box.scale,
    tagged: false,
  });
  t.print = performance.now() - t0;
  await page.close();
  return pdf;
}

export interface Placement {
  left: number; // mm from the left edge of the page
  top: number; // mm from the top edge of the page, top of the stamped box
  width: number; // mm
  height: number; // mm
}

export interface Layer {
  // One PDF per page, or one PDF with one page per body page.
  stamps: Uint8Array[] | Uint8Array;
  place: (pageIndex: number) => Placement;
}

// Draws, for each layer, stamp i on page i of `body`, in one pass.
export async function stamp(body: Uint8Array, layers: Layer[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(body);
  const pages = doc.getPages();
  for (const layer of layers) {
    const embedded = Array.isArray(layer.stamps)
      ? await Promise.all(layer.stamps.map(async (s) => (await doc.embedPdf(s, [0]))[0]!))
      : await doc.embedPdf(layer.stamps, pages.map((_, i) => i));
    pages.forEach((page, i) => {
      const e = embedded[i];
      if (!e) return;
      const p = layer.place(i);
      page.drawPage(e, {
        x: p.left * PT_PER_MM,
        y: page.getHeight() - (p.top + p.height) * PT_PER_MM,
        width: p.width * PT_PER_MM,
        height: p.height * PT_PER_MM,
      });
    });
  }
  return doc.save();
}
