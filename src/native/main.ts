// The native interface, called as pdfkiln: Chromium's own rendering, with
// modern defaults:
// - pdfkiln <input>... <output>: files, URLs or - (standard input), merged
//   in order; - as output is the standard output;
// - print media; paper size and margins from the page's @page rule (A4 and
//   1 cm otherwise), headers and footers from its @page margin boxes;
// - --tagged keeps the structure tree; --outline adds bookmarks;
// - the JavaScript delay of the compatible mode, cut short once nothing
//   can change the page, 1000 ms at most by default;
// - the security settings of the compatible mode, without prefix.
import { mkdtempSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { deadline, launch, LaunchError, removeQuietly, type Session } from '../engine/browser.js';
import { openPage, type Reporter } from '../engine/loader.js';
import { startRelay, type Relay } from '../engine/relay.js';
import { fixDests, merge, moveDest, prune, readOutline, writeOutline, type FinalItem, type OutlineItem } from '../pdf/assemble.js';
import { chromiumVersion, version } from '../version.js';
import { defaultObject } from '../wk/settings.js';
import { guessUrlFromString } from '../wk/urls.js';

const HELP = `Usage: pdfkiln [options] <input>... <output>

Converts HTML to PDF with Chromium. Inputs are files, URLs, or - for the
standard input; they are merged in order. The output is a file, or - for the
standard output. Paper size, margins, headers and footers come from the
page's CSS (@page and its margin boxes); A4 with 1 cm margins otherwise.

Options:
  --tagged                  Tagged PDF, readable by screen readers (one input)
  --outline                 Bookmarks from the headings
  --javascript-delay <ms>   Wait up to this long after loading (default 1000,
                            0: none), less once nothing can change the page
  --allow <path>            Let local pages read files under this path (repeatable)
  --enable-local-file-access  Let local pages read any local file
  --block-private-network   Refuse loopback, private and link-local addresses
  --timeout <seconds>       Stop after this many seconds (default 120, 0: none)
  --no-sandbox              Run Chromium without its sandbox (not recommended)
  -q, --quiet               No warnings
  -V, --version             Show the version
  -h, --help                Show this help

Called as wkhtmltopdf or wkhtmltoimage, or as "pdfkiln wkhtmltopdf <options>"
or "pdfkiln wkhtmltoimage <options>", pdfkiln is compatible with wkhtmltopdf
and wkhtmltoimage 0.12.6 instead. "pdfkiln serve" keeps Chromium open for
their conversions (pdfkiln serve --help).
`;

const stderr = (s: string) => writeSync(2, s);
// The 1 cm margins in points; an @page margin of the page moves its
// internal links' targets by the difference.
const CM_PT = 72 / 2.54;

function writeAll(fd: number, data: Uint8Array): void {
  for (let off = 0; off < data.length;) off += writeSync(fd, data, off);
}

export async function nativeMain(args: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        tagged: { type: 'boolean' },
        outline: { type: 'boolean' },
        'javascript-delay': { type: 'string' },
        allow: { type: 'string', multiple: true },
        'enable-local-file-access': { type: 'boolean' },
        'block-private-network': { type: 'boolean' },
        timeout: { type: 'string' },
        'no-sandbox': { type: 'boolean' },
        quiet: { type: 'boolean', short: 'q' },
        version: { type: 'boolean', short: 'V' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    stderr(`pdfkiln: ${(e as Error).message}\n\n${HELP}`);
    return 1;
  }
  const { values: v, positionals } = parsed;
  if (v.help) {
    writeSync(1, HELP);
    return 0;
  }
  if (v.version) {
    writeSync(1, `pdfkiln ${version}, Chromium ${chromiumVersion}\n`);
    return 0;
  }
  if (positionals.length < 2) {
    stderr(`pdfkiln: give at least one input and the output\n\n${HELP}`);
    return 1;
  }
  const timeout = v.timeout === undefined ? 120 : Number(v.timeout);
  if (!Number.isFinite(timeout) || timeout < 0) {
    stderr(`pdfkiln: --timeout takes a number of seconds\n`);
    return 1;
  }
  const jsdelay = v['javascript-delay'] === undefined ? 1000 : Number(v['javascript-delay']);
  if (!Number.isInteger(jsdelay) || jsdelay < 0) {
    stderr(`pdfkiln: --javascript-delay takes a number of milliseconds\n`);
    return 1;
  }
  const inputs = positionals.slice(0, -1);
  const output = positionals[positionals.length - 1]!;
  if (v.tagged && inputs.length > 1) {
    stderr('pdfkiln: --tagged takes one input: the structure trees of several documents are not merged yet\n');
    return 1;
  }

  const out: Reporter = {
    warning: (m) => {
      if (!v.quiet) stderr(`pdfkiln: warning: ${m}\n`);
    },
    error: (m) => stderr(`pdfkiln: error: ${m}\n`),
  };
  const work = mkdtempSync(join(tmpdir(), 'pdfkiln-'));
  let session: Session | undefined;
  let relay: Relay | undefined;
  let stop = () => {};
  try {
    if (v['block-private-network']) relay = await startRelay();
    if (v['no-sandbox']) out.warning("Chromium's sandbox is off (--no-sandbox)");
    session = await launch({ dir: work, noSandbox: v['no-sandbox'], proxyServer: relay?.url, proxyBypassList: relay ? '<-loopback>' : undefined });
    stop = deadline(session, timeout, () => {
      removeQuietly(work);
      stderr(`pdfkiln: error: the conversion took longer than ${timeout} s (--timeout)\n`);
      process.exit(1);
    });
    const context = session.browser.defaultBrowserContext();
    const base = defaultObject();
    base.load.jsdelay = jsdelay;
    base.load.blockLocalFileAccess = !v['enable-local-file-access'];
    base.load.allowed = v.allow ?? [];
    let stdin: Buffer | undefined;
    const parts: { doc: PDFDocument; outline: OutlineItem[] }[] = [];
    for (const [i, input] of inputs.entries()) {
      let url: string;
      if (input === '-') {
        stdin ??= readFileSync(0);
        const file = join(work, `stdin-${i}.html`);
        writeFileSync(file, stdin);
        url = pathToFileURL(file).href;
      } else url = guessUrlFromString(input);
      const lp = await openPage(context, {
        url,
        web: base.web,
        load: base.load,
        isMain: true,
        media: 'print',
        viewport: { width: 794, height: 1123 },
        blockPrivateNetwork: Boolean(v['block-private-network']),
      }, out);
      if (!lp.ok) {
        out.error(`could not load ${input}`);
        return 1;
      }
      const pdf = await lp.page.pdf({
        format: 'A4',
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        preferCSSPageSize: true,
        printBackground: true,
        tagged: Boolean(v.tagged || v.outline),
        outline: Boolean(v.outline),
      });
      await lp.page.close();
      const doc = await PDFDocument.load(pdf, { updateMetadata: false });
      fixDests(doc, CM_PT, CM_PT, 1);
      parts.push({ doc, outline: v.outline ? readOutline(doc) : [] });
    }
    const merged = await merge(parts, Boolean(v.tagged));
    prune(merged.doc);
    if (v.outline) {
      const toFinal = (items: OutlineItem[], k: number): FinalItem[] => items
        .filter((it) => it.dest && it.page >= 0)
        .map((it) => ({ title: it.title, dest: moveDest(merged.doc, it.dest!, merged.pages[merged.offsets[k]! + it.page]!), children: toFinal(it.children, k) }));
      writeOutline(merged.doc, parts.flatMap((p, k) => toFinal(p.outline, k)));
    }
    merged.doc.setCreator('pdfkiln');
    merged.doc.setProducer('pdfkiln.org');
    const bytes = await merged.doc.save();
    if (output === '-') writeAll(1, bytes);
    else writeFileSync(output, bytes);
    return 0;
  } catch (e) {
    if (e instanceof LaunchError) {
      out.error(e.message);
      return 1;
    }
    out.error(e instanceof Error ? e.message : String(e));
    return 1;
  } finally {
    stop();
    await session?.close();
    await relay?.close();
    removeQuietly(work);
  }
}
