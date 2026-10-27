// The compatible command end to end, with Chromium: what the libraries
// rely on (exit codes, stderr, standard input and output), what the
// specification promises (objects, numbering, headers), and the security
// rules. Needs the pinned Chromium (npm run fetch:chromium) and an
// unprivileged user: the sandbox stays on. Text checks use PyMuPDF
// (bench/requirements.txt) and are skipped without it.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { PDFDocument, PDFName } from '@cantoo/pdf-lib';

const root = resolve(import.meta.dirname, '..', '..');
// PDFKILN_TEST_BUNDLE=1: the bundled command. PDFKILN_TEST_WKHTMLTOPDF,
// PDFKILN_TEST_WKHTMLTOIMAGE and PDFKILN_TEST_PDFKILN: the programs of a
// package (the single executable, its links or the Windows launcher).
const bundled = Boolean(process.env.PDFKILN_TEST_BUNDLE);
const cli = bundled ? join(root, 'dist', 'bundle', 'wkhtmltopdf.cjs') : join(root, 'dist', 'src', 'bin', 'wkhtmltopdf.js');
const command = (exe: string | undefined, script: string, args: string[]): [string, string[]] =>
  exe ? [exe, args] : [process.execPath, [script, ...args]];
const dir = mkdtempSync(join(tmpdir(), 'pdfkiln-test-'));
const python = process.env.PDFKILN_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
const hasPyMuPDF = (() => {
  try {
    execFileSync(python, ['-I', '-c', 'import pymupdf'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

interface Run { code: number | null; stdout: Buffer; stderr: string; ms: number }

function run(args: string[], opts: { stdin?: string | Buffer; cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<Run> {
  return new Promise((ok) => {
    const t0 = performance.now();
    const env = { ...process.env, ...opts.env };
    delete env.NODE_EXTRA_CA_CERTS;
    const child = spawn(...command(process.env.PDFKILN_TEST_WKHTMLTOPDF, cli, args), { cwd: opts.cwd ?? dir, env });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => ok({ code, stdout: Buffer.concat(out), stderr: err, ms: performance.now() - t0 }));
    child.stdin.end(opts.stdin ?? '');
  });
}

// Text of each page, with PyMuPDF.
function pagesText(file: string): string[] {
  const script = 'import sys, json, pymupdf\nd = pymupdf.open(sys.argv[1])\nprint(json.dumps([p.get_text() for p in d]))';
  return JSON.parse(execFileSync(python, ['-I', '-c', script, file], { encoding: 'utf8' }));
}

const lastLine = (s: string) => s.trim().split(/[\r\n]+/).pop();
const file = (name: string, content: string) => {
  const p = join(dir, name);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
  return p;
};

let server: Server;
let base = '';
let hangs: (() => void)[] = [];
before(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    const html = (body: string, status = 200) => res.writeHead(status, { 'content-type': 'text/html' }).end(`<!doctype html><html><head><title>T</title></head><body>${body}</body></html>`);
    if (path === '/ok') return html('<h1>Hello</h1>');
    if (path === '/set-cookie') return res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'secret=1; Path=/' }).end('<p>set</p>');
    if (path === '/show-cookie') return html(`<p>Cookie: ${req.headers.cookie ?? 'none'}</p>`);
    if (path === '/post') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => html(`<p>${req.method} ${(req.headers['content-type'] ?? '').split(';')[0]}</p><pre>${body.replace(/</g, '&lt;').replace(/&(?!lt;)/g, '&amp;')}</pre>`));
      return;
    }
    if (path === '/404') return html('missing', 404);
    if (path === '/css404') return html('<link rel="stylesheet" href="/nope.css">styled');
    if (path === '/headers') return html(`<p>X-Test=${req.headers['x-test'] ?? 'none'}</p><img src="/img">`);
    if (path === '/img') return res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text y="10">${req.headers['x-test'] ?? 'none'}</text></svg>`);
    if (path === '/hang') {
      hangs.push(() => res.end());
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
});
after(() => {
  for (const h of hangs) h();
  hangs = [];
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('interface', () => {
  test('--version', async () => {
    const r = await run(['--version']);
    assert.equal(r.code, 0);
    assert.match(r.stdout.toString(), /^wkhtmltopdf 0\.12\.6 \(with patched qt\), pdfkiln /);
  });

  test('an unknown option: exit 1, message, usage', async () => {
    const r = await run(['--bogus', 'a.html', 'out.pdf']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /^Unknown long argument --bogus\n\nName:/);
  });

  test('standard input to standard output, quietly', async () => {
    const r = await run(['-q', '-', '-'], { stdin: '<p>From stdin</p>' });
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.subarray(0, 5).toString(), '%PDF-');
    const doc = await PDFDocument.load(r.stdout);
    assert.deepEqual(doc.getPage(0).getSize(), { width: 595, height: 842 });
  });

  test('phases on stderr, ending with Done', async () => {
    const r = await run([`${base}/ok`, join(dir, 'ok.pdf')]);
    assert.equal(r.code, 0);
    const lines = r.stderr.split(/[\r\n]+/).filter((l) => l.trim() && !l.startsWith('[')).map((l) => l.trimEnd());
    assert.deepEqual(lines, ['Loading pages (1/6)', 'Counting pages (2/6)', 'Resolving links (4/6)', 'Loading headers and footers (5/6)', 'Printing pages (6/6)', 'Done']);
    const doc = await PDFDocument.load(readFileSync(join(dir, 'ok.pdf')));
    assert.equal(doc.getTitle(), 'T');
    assert.ok(doc.catalog.get(PDFName.of('Outlines')), 'outline');
  });

  test('a 404 page: the PDF, and exit 1 as wkhtmltopdf 0.12.6', async () => {
    const out = join(dir, '404.pdf');
    const r = await run(['-q', `${base}/404`, out]);
    assert.equal(r.code, 1);
    assert.equal(lastLine(r.stderr), 'Exit with code 1 due to network error: ContentNotFoundError');
    assert.ok(readFileSync(out).length > 0);
  });

  test('a missing style sheet is only a warning', async () => {
    const r = await run(['--log-level', 'warn', `${base}/css404`, join(dir, 'css.pdf')]);
    assert.equal(r.code, 0);
    assert.equal(r.stderr, `Warning: Failed to load ${base}/nope.css (ignore)\n`);
  });

  test('an unknown host: exit 1, no PDF', async () => {
    const r = await run(['-q', 'http://pdfkiln-nonexistent.invalid/', join(dir, 'none.pdf')]);
    assert.equal(r.code, 1);
    assert.equal(lastLine(r.stderr), 'Exit with code 1 due to network error: HostNotFoundError');
  });

  test('--custom-header goes to the page only, unless propagated', async () => {
    const out = join(dir, 'h.pdf');
    let r = await run(['-q', '--custom-header', 'X-Test', 'yes', `${base}/headers`, out]);
    assert.equal(r.code, 0);
    if (hasPyMuPDF) assert.match(pagesText(out)[0]!, /X-Test=yes/);
    r = await run(['-q', '--custom-header', 'X-Test', 'yes', '--custom-header-propagation', `${base}/headers`, out]);
    assert.equal(r.code, 0);
  });

  test('--read-args-from-stdin: one conversion per line', async () => {
    const a = join(dir, 'ra.pdf');
    const b = join(dir, 'rb.pdf');
    // A backslash escapes the next character, as in wkhtmltopdf: Windows
    // paths are written with slashes.
    const slash = (p: string) => p.replace(/\\/g, '/');
    const r = await run(['-q', '--read-args-from-stdin'], { stdin: `${base}/ok ${slash(a)}\n${base}/ok "${slash(b)}"\n` });
    assert.equal(r.code, 0);
    assert.ok(readFileSync(a).length && readFileSync(b).length);
  });
});

describe('objects and numbering', () => {
  test('cover, pages, page-offset and footer variables', async (t) => {
    const cover = file('obj/cover.html', '<h1>Cover</h1>');
    const one = file('obj/one.html', '<title>One</title><h1>Part one</h1><div style="height:1500px"></div><p>end one</p>');
    const two = file('obj/two.html', '<title>Two</title><h1>Part two</h1>');
    const out = join(dir, 'objects.pdf');
    const r = await run(['-q', '--footer-center', '[page]/[topage] [section] [sitepage]/[sitepages]', '--page-offset', '10', 'cover', cover, one, two, out]);
    assert.equal(r.code, 0, r.stderr);
    const doc = await PDFDocument.load(readFileSync(out));
    assert.equal(doc.getPageCount(), 4);
    assert.equal(doc.getTitle(), 'One');
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    const text = pagesText(out);
    assert.doesNotMatch(text[0]!, /\//, 'no footer on the cover');
    assert.match(text[1]!, /12\/14 Part one 1\/2/);
    assert.match(text[2]!, /13\/14 Part one 2\/2/);
    assert.match(text[3]!, /14\/14 Part two 1\/1/);
  });

  test('--header-html receives the page parameters', async (t) => {
    const header = file('hdr/header.html', `<!doctype html><html><body><span id="o"></span><script>
      const q = new URLSearchParams(location.search);
      document.getElementById('o').textContent = 'Head ' + q.get('page') + ' of ' + q.get('topage') + ' ' + q.get('doctitle');
    </script></body></html>`);
    const page = file('hdr/page.html', `<title>Report</title>${'<p>line</p>'.repeat(120)}`);
    const out = join(dir, 'header.pdf');
    const r = await run(['-q', '--header-html', header, '--margin-top', '20', page, out]);
    assert.equal(r.code, 0, r.stderr);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    const text = pagesText(out);
    assert.ok(text.length >= 2);
    text.forEach((p, i) => assert.match(p, new RegExp(`Head ${i + 1} of ${text.length} Report`)));
    // Headers load with Qt's default settings: their scripts run anyway (Frappe).
    const noJs = join(dir, 'header-nojs.pdf');
    assert.equal((await run(['-q', '--disable-javascript', '--header-html', header, '--margin-top', '20', page, noJs])).code, 0);
    assert.match(pagesText(noJs)[0]!, /Head 1 of/);
  });

  test('toc: the table of contents, its links, the outline dumped as wkhtmltopdf does', async (t) => {
    const a = file('toc/a.html', '<title>Doc A</title><h1>Intro</h1><h2>Sub</h2><div style="height:1500px"></div><h2>Later</h2>');
    const b = file('toc/b.html', '<title>Doc B</title><h1>B head</h1>');
    const out = join(dir, 'toc.pdf');
    const xml = join(dir, 'toc-outline.xml');
    const r = await run(['-q', '--page-offset', '10', '--dump-outline', xml, a, 'toc', '--toc-header-text', 'Contents', b, out]);
    assert.equal(r.code, 0, r.stderr);
    const doc = await PDFDocument.load(readFileSync(out));
    assert.equal(doc.getPageCount(), 4);
    assert.equal(readFileSync(xml, 'utf8'), `<?xml version="1.0" encoding="UTF-8"?>
<outline xmlns="http://wkhtmltopdf.org/outline">
  <item title="Doc A" page="10" link="__WKANCHOR_0" backLink="__WKANCHOR_1">
    <item title="Intro" page="11" link="__WKANCHOR_2" backLink="__WKANCHOR_3">
      <item title="Sub" page="11" link="__WKANCHOR_4" backLink="__WKANCHOR_5"/>
      <item title="Later" page="12" link="__WKANCHOR_6" backLink="__WKANCHOR_7"/>
    </item>
  </item>
  <item title="Contents" page="12" link="__WKANCHOR_c" backLink="__WKANCHOR_c">
    <item title="Contents" page="13" link="__WKANCHOR_e" backLink="__WKANCHOR_e"/>
  </item>
  <item title="Doc B" page="13" link="__WKANCHOR_8" backLink="__WKANCHOR_9">
    <item title="B head" page="14" link="__WKANCHOR_a" backLink="__WKANCHOR_b"/>
  </item>
</outline>
`);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    assert.match(pagesText(out)[2]!.replace(/\s+/g, ' '), /Contents.*Intro.*Sub.*Later.*Contents.*B head/);
    const links = JSON.parse(execFileSync(python, ['-I', '-c', 'import sys, json, pymupdf\nprint(json.dumps([l.get("page") for l in pymupdf.open(sys.argv[1])[2].get_links()]))', out], { encoding: 'utf8' }));
    assert.deepEqual(links, [0, 0, 1, 2, 3]);
  });

  test('toc: --enable-toc-back-links, from the object of the heading', async (t) => {
    const a = file('toc/back.html', '<title>Back</title><h1>First</h1><div style="height:1500px"></div><h2>Second</h2>');
    const out = join(dir, 'toc-back.pdf');
    const r = await run(['-q', '--enable-toc-back-links', 'toc', a, out]);
    assert.equal(r.code, 0, r.stderr);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    // The links of the pages after the table: each back to page 1.
    const script = 'import sys, json, pymupdf\nd = pymupdf.open(sys.argv[1])\nprint(json.dumps([[i, l.get("page")] for i, p in enumerate(d) if i for l in p.get_links()]))';
    assert.deepEqual(JSON.parse(execFileSync(python, ['-I', '-c', script, out], { encoding: 'utf8' })), [[1, 0], [2, 0]]);
  });

  test('toc: --xsl-style-sheet, and the default one dumped', async (t) => {
    const r0 = await run(['--dump-default-toc-xsl']);
    assert.equal(r0.code, 0);
    assert.match(r0.stdout.toString(), /^<\?xml version="1.0" encoding="UTF-8"\?>\n<xsl:stylesheet version="2.0"/);
    const xsl = file('toc/list.xsl', `<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:o="http://wkhtmltopdf.org/outline">
  <xsl:template match="/o:outline"><html><body><p>Custom list</p><xsl:for-each select="o:item/o:item"><p>Entry <xsl:value-of select="@title"/> at <xsl:value-of select="@page"/></p></xsl:for-each></body></html></xsl:template>
</xsl:stylesheet>`);
    const page = file('toc/c.html', '<title>C</title><h1>Only heading</h1>');
    const out = join(dir, 'toc-xsl.pdf');
    const r = await run(['-q', 'toc', '--xsl-style-sheet', xsl, page, out]);
    assert.equal(r.code, 0, r.stderr);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    assert.match(pagesText(out)[0]!, /Custom list[\s\S]*Entry Only heading at 2/);
  });

  test('links: to another object, its elements, the web; and the options that drop them', async (t) => {
    const a = file('links/a.html', `<title>A</title><p><a href="b.html">b</a></p><p><a href="b.html#sec">sec</a></p>
      <p><a href="b.html#gone">gone</a></p><p><a href="#self">self</a></p><p><a href="other.html#x">other</a></p>
      <div style="height:1200px"></div><p id="self">Self target</p>`);
    file('links/b.html', '<title>B</title><p>B top</p><div style="height:1300px"></div><h2 id="sec">B sec</h2>');
    const b = join(dir, 'links', 'b.html');
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    // Each link of the first page: its target page, the target text's
    // distance to the destination, or its URI.
    const script = `import sys, json, pymupdf
d = pymupdf.open(sys.argv[1])
out = []
for l in d[0].get_links():
    if l["kind"] in (1, 4):
        p = d[l["page"]]
        # PyMuPDF gives named destinations in PDF coordinates.
        y = l["to"].y if l["kind"] == 1 else p.rect.height - l["to"].y
        words = [w for w in p.get_text("words") if w[4] in ("Self", "sec", "top")]
        out.append([l["page"], round(min(abs(w[1] - y) for w in words))])
    else:
        out.append(l.get("uri") or l.get("file"))
print(json.dumps(out))`;
    const links = async (...opts: string[]) => {
      const out = join(dir, 'links.pdf');
      const r = await run(['-q', a, ...opts, b, out]);
      assert.equal(r.code, 0, r.stderr);
      return JSON.parse(execFileSync(python, ['-I', '-c', script, out], { encoding: 'utf8' })) as unknown[];
    };
    const all = await links();
    assert.equal(all.length, 4, JSON.stringify(all));
    const [toB, toSec, toSelf, other] = all as [[number, number], [number, number], [number, number], string];
    assert.equal(toB[0], 2);
    assert.equal(toSec[0], 3);
    assert.equal(toSelf[0], 1);
    // The destinations are where the text is (Chromium writes them unscaled).
    for (const [, gap] of [toSec, toSelf]) assert.ok(gap < 25, `destination ${gap} pt away from its target`);
    assert.match(other, /^(file:\/\/)?\/.*\/links\/other\.html/);
    assert.deepEqual(await links('--disable-internal-links'), [other]);
    assert.equal((await links('--disable-external-links')).length, 3);
    assert.match(String((await links('--keep-relative-links'))[3]), /^other\.html/);
  });

  test('--copies: collated, or page by page; links and outline on the last copy', async (t) => {
    const a = file('copies/a.html', '<title>A</title><h1>One</h1><p>Page one</p><div style="height:1500px"></div><p>Page two</p>');
    const out = join(dir, 'copies.pdf');
    for (const [opts, order] of [[[], ['one', 'two', 'one', 'two']], [['--no-collate'], ['one', 'one', 'two', 'two']]] as const) {
      const r = await run(['-q', '--copies', '2', ...opts, a, out]);
      assert.equal(r.code, 0, r.stderr);
      const doc = await PDFDocument.load(readFileSync(out));
      assert.equal(doc.getPageCount(), 4);
      if (!hasPyMuPDF) continue;
      assert.deepEqual(pagesText(out).map((p) => (/Page two/.test(p) ? 'two' : 'one')), order);
      const toc = JSON.parse(execFileSync(python, ['-I', '-c', 'import sys, json, pymupdf\nprint(json.dumps(pymupdf.open(sys.argv[1]).get_toc()))', out], { encoding: 'utf8' }));
      assert.deepEqual(toc, [[1, 'One', opts.length ? 2 : 3]]);
    }
    if (!hasPyMuPDF) t.skip('PyMuPDF missing');
  });

  test('--post and --post-file: the page is requested with the form', async (t) => {
    const out = join(dir, 'post.pdf');
    let r = await run(['-q', `${base}/post`, '--post', 'a', 'x+y z', '--post', 'b', '2', out]);
    assert.equal(r.code, 0, r.stderr);
    const sent = file('post/sent.txt', 'file content');
    if (hasPyMuPDF) assert.match(pagesText(out)[0]!, /POST application\/x-www-form-urlencoded\s+a=x%2By\+z&b=2/);
    r = await run(['-q', `${base}/post`, '--post', 'a', '1', '--post-file', 'f', sent, out]);
    assert.equal(r.code, 0, r.stderr);
    if (hasPyMuPDF) assert.match(pagesText(out)[0]!, /POST multipart\/form-data[\s\S]*name="f"; filename="sent.txt"\s+file content/);
    r = await run([`${base}/post`, '--post-file', 'f', join(dir, 'post', 'missing.txt'), out]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Unable to open file .*missing\.txt/);
    if (!hasPyMuPDF) t.skip('PyMuPDF missing');
  });

  test('--ssl-crt-path, --ssl-key-path, --ssl-key-password: the client certificate', async (t) => {
    const d = join(dir, 'tls');
    mkdirSync(d, { recursive: true });
    const ossl = (...a: string[]) => execFileSync('openssl', a, { cwd: d, stdio: 'ignore' });
    try {
      ossl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '2', '-subj', '/CN=Test CA');
      ossl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost');
      ossl('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '2');
      ossl('req', '-newkey', 'rsa:2048', '-passout', 'pass:secret', '-keyout', 'client.key', '-out', 'client.csr', '-subj', '/CN=Kiln client');
      ossl('x509', '-req', '-in', 'client.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'client.crt', '-days', '2');
    } catch {
      return t.skip('openssl missing');
    }
    const tls = createHttpsServer({
      key: readFileSync(join(d, 'server.key')),
      cert: readFileSync(join(d, 'server.crt')),
      ca: readFileSync(join(d, 'ca.crt')),
      requestCert: true,
      rejectUnauthorized: true,
    }, (req, res) => {
      if (req.url === '/moved') return res.writeHead(302, { location: '/page' }).end();
      if (req.url === '/style.css') return res.writeHead(200, { 'content-type': 'text/css' }).end('p::after { content: " and styled" }');
      const cn = (req.socket as TLSSocket).getPeerCertificate().subject?.CN;
      res.writeHead(200, { 'content-type': 'text/html' })
        .end(`<title>T</title><link rel="stylesheet" href="/style.css"><p>${req.method} by ${cn} with ${req.headers.cookie ?? 'no cookie'}</p>`);
    });
    await new Promise<void>((ok) => tls.listen(0, '127.0.0.1', ok));
    try {
      const url = `https://localhost:${(tls.address() as AddressInfo).port}/moved`;
      const out = join(dir, 'tls.pdf');
      const cert = ['--ssl-crt-path', join(d, 'client.crt'), '--ssl-key-path', join(d, 'client.key'), '--ssl-key-password', 'secret'];
      const r = await run(['-q', '--cookie', 'k', 'v', url, ...cert, out]);
      assert.equal(r.code, 0, r.stderr);
      if (hasPyMuPDF) assert.match(pagesText(out)[0]!, /GET by Kiln client with k=v and styled/);
      // Without it, the server refuses the page.
      assert.equal((await run(['-q', url, out])).code, 1);
    } finally {
      tls.close();
    }
    if (!hasPyMuPDF) t.skip('PyMuPDF missing');
  });

  test('the JavaScript delay waits for what is pending, not more', async (t) => {
    // A change within the delay is printed, one after it is not, as in
    // wkhtmltopdf; a quiet page is printed without waiting the whole delay.
    const page = file('delay/page.html', `<p id="a">start</p><script>
      setTimeout(() => { document.getElementById('a').textContent += ' early'; }, 150);
      setTimeout(() => { document.getElementById('a').textContent += ' late'; }, 900);
    </script>`);
    const out = join(dir, 'delay.pdf');
    assert.equal((await run(['-q', '--javascript-delay', '400', page, out])).code, 0);
    const quiet = file('delay/quiet.html', '<p>quiet</p>');
    const r = await run(['-q', '--javascript-delay', '5000', quiet, join(dir, 'quiet.pdf')]);
    assert.equal(r.code, 0);
    assert.ok(r.ms < 4000, `a quiet page waited ${Math.round(r.ms)} ms`);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    const text = pagesText(out)[0]!;
    assert.match(text, /start early/);
    assert.doesNotMatch(text, /late/);
  });

  test('a paragraph may leave its first line alone at the bottom of a page', async (t) => {
    // No widow or orphan control unless the page asks for it, as WebKit
    // 534: A4 with 10 mm margins holds 1308 px at scale 0.8.
    const lines = Array.from({ length: 4 }, (_, i) => `L${i + 1} ${'word '.repeat(30)}`).join('<br>');
    const page = file('orphan/page.html', `<style>body{margin:0;font:16px/20px sans-serif}p{margin:0}</style><div style="height:1285px"></div><p>${lines}</p>`);
    const out = join(dir, 'orphan.pdf');
    assert.equal((await run(['-q', page, out])).code, 0);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    assert.match(pagesText(out)[0]!, /L1 word/);
  });

  test('a table row that does not fit moves to the next page, whole', async (t) => {
    // As WebKit 534: six rows of 171 px from 145 px down, past the 1122 px
    // of an A4 page without margins by 20 px; Chromium would split the last.
    const rows = Array.from({ length: 6 }, (_, i) => `<tr><td><div style="height:150px">R${i + 1}</div></td></tr>`).join('');
    const page = file('rows/page.html', `<style>body{margin:0;font:16px/20px sans-serif}table{border-collapse:collapse;width:100%}td{border:1px solid;padding:10px}</style><div style="height:115px"></div><table>${rows}</table>`);
    const out = join(dir, 'rows.pdf');
    assert.equal((await run(['-q', '--disable-smart-shrinking', '-T', '0', '-B', '0', page, out])).code, 0);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    const [first, second] = pagesText(out);
    assert.doesNotMatch(first!, /R6/);
    assert.match(second!, /R6/);
  });

  test('bench switches: whole-pixel line heights, margins at the top of the page', async (t) => {
    // Off by default; PDFKILN_EMULATION turns them on for the bench.
    const page = file('whole/page.html', '<style>body{margin:0;font:12px sans-serif}p{margin:0;line-height:1.8}</style>'
      + '<div style="float:left;width:50%"><div style="margin-top:15px"><p>A1</p><p>A2</p><p>A3</p><p>A4</p><p>A5</p><p>A6</p></div></div>');
    const tops = async (env: NodeJS.ProcessEnv) => {
      const out = join(dir, 'whole.pdf');
      assert.equal((await run(['-q', '--disable-smart-shrinking', '-T', '0', '-B', '0', page, out], { env })).code, 0);
      const script = 'import sys, json, pymupdf\nw = pymupdf.open(sys.argv[1])[0].get_text("words")\nprint(json.dumps([round(x[3] / 0.75, 1) for x in sorted(w, key=lambda x: x[3])]))';
      return JSON.parse(execFileSync(python, ['-I', '-c', script, out], { encoding: 'utf8' })) as number[];
    };
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    // Over five pitches: Chromium paints each line on a whole pixel.
    const pitch = (ys: number[]) => (ys[5]! - ys[0]!) / 5;
    const a = await tops({ PDFKILN_EMULATION: '' });
    assert.ok(Math.abs(pitch(a) - 21.6) < 0.3, `pitch ${pitch(a)}`);
    const b = await tops({ PDFKILN_EMULATION: '+wholePixelLineHeights,+pageTopMargins' });
    assert.ok(Math.abs(pitch(b) - 21) < 0.3, `pitch ${pitch(b)}`);
    assert.ok(a[0]! - b[0]! > 14, `margin kept: ${a[0]} -> ${b[0]}`);
  });
});

describe('security', () => {
  test('a local page may not read its neighbours, unless allowed', async () => {
    file('local/s.css', 'p { color: red }');
    const page = file('local/page.html', '<link rel="stylesheet" href="s.css"><p>x</p>');
    let r = await run(['--log-level', 'warn', page, join(dir, 'l.pdf')]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /^Warning: Blocked access to file .*s\.css$/m);
    assert.equal(lastLine(r.stderr), 'Exit with code 1 due to network error: ProtocolUnknownError');
    r = await run(['-q', '--enable-local-file-access', page, join(dir, 'l.pdf')]);
    assert.equal(r.code, 0);
    r = await run(['-q', '--allow', join(dir, 'local'), page, join(dir, 'l.pdf')]);
    assert.equal(r.code, 0);
  });

  test('--allow cannot be left by .. or a symbolic link', async () => {
    file('secret/key.png', 'secret');
    const allowed = join(dir, 'jail');
    mkdirSync(allowed, { recursive: true });
    try {
      symlinkSync(join(dir, 'secret', 'key.png'), join(allowed, 'link.png'));
    } catch {
      // Windows without the right to create links.
    }
    const page = file('jail/page.html', '<img src="../secret/key.png"><img src="link.png"><img src="/etc/passwd">');
    const r = await run(['--log-level', 'warn', '--allow', allowed, page, join(dir, 'j.pdf')]);
    const blocked = r.stderr.split('\n').filter((l) => l.startsWith('Warning: Blocked access to file'));
    assert.ok(blocked.length >= 2, r.stderr);
    assert.equal(r.code, 1);
  });

  test('--kiln-block-private-network refuses loopback, by address and by name', async () => {
    for (const url of [`${base}/ok`, base.replace('127.0.0.1', 'localhost') + '/ok']) {
      const r = await run(['-q', '--kiln-block-private-network', url, join(dir, 'p.pdf')]);
      assert.equal(r.code, 1, url);
    }
    const r = await run(['-q', `${base}/ok`, join(dir, 'p.pdf')]);
    assert.equal(r.code, 0);
  });

  test('--kiln-timeout stops the conversion and Chromium', async () => {
    const r = await run(['-q', '--kiln-timeout', '2', `${base}/hang`, join(dir, 't.pdf')]);
    for (const h of hangs) h();
    hangs = [];
    assert.equal(r.code, 1);
    assert.match(r.stderr, /--kiln-timeout/);
    assert.ok(r.ms < 15000, `${r.ms} ms`);
    if (process.platform !== 'win32') {
      // Killed processes take a moment to disappear from ps.
      const left = () => execFileSync('ps', ['-eo', 'stat,args'], { encoding: 'utf8' }).split('\n')
        .some((l) => !l.startsWith('Z') && l.includes('chrome-headless-shell') && l.includes(tmpdir()) && l.includes('pdfkiln-') && !l.includes('pdfkiln-test'));
      for (let i = 0; i < 20 && left(); i++) await new Promise((r) => setTimeout(r, 100));
      assert.ok(!left(), 'no Chromium left');
    }
  });

  // On Windows, Chromium's profile stays locked until it is gone, which
  // can be seconds after taskkill returns for a page stuck in a script.
  test('--kiln-timeout leaves no temporary folder, a page stuck in a script', async () => {
    const tmp = mkdtempSync(join(dir, 'tmp-'));
    for (let i = 0; i < 3; i++) {
      const r = await run(['-q', '--kiln-timeout', '2', '-', join(dir, 'loop.pdf')], {
        stdin: '<script>while (true) {}</script>',
        env: { TEMP: tmp, TMP: tmp, TMPDIR: tmp },
      });
      assert.equal(r.code, 1);
      assert.deepEqual(readdirSync(tmp).filter((f) => f.startsWith('pdfkiln-')), []);
    }
  });
});

describe('native interface', () => {
  const pdfkiln = bundled ? join(root, 'dist', 'bundle', 'pdfkiln.cjs') : join(root, 'dist', 'src', 'bin', 'pdfkiln.js');
  const native = (args: string[], stdin = ''): Promise<Run> => new Promise((ok) => {
    const t0 = performance.now();
    const child = spawn(...command(process.env.PDFKILN_TEST_PDFKILN, pdfkiln, args), { cwd: dir });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => ok({ code, stdout: Buffer.concat(out), stderr: err, ms: performance.now() - t0 }));
    child.stdin.end(stdin);
  });

  test('@page gives the size; print media', async () => {
    const page = file('native/a5.html', '<style>@page { size: A5 landscape; margin: 0 } @media screen { p { display: none } }</style><p>printed</p>');
    const out = join(dir, 'a5.pdf');
    const r = await native([page, out]);
    assert.equal(r.code, 0, r.stderr);
    const doc = await PDFDocument.load(readFileSync(out));
    const { width, height } = doc.getPage(0).getSize();
    assert.ok(Math.abs(width - 595.3) < 1 && Math.abs(height - 419.5) < 1, `${width} x ${height}`);
  });

  test('standard input and output, several inputs merged', async () => {
    const one = file('native/one.html', '<h1>One</h1>');
    const r = await native(['-', one, '-'], '<h1>Zero</h1>');
    assert.equal(r.code, 0, r.stderr);
    assert.equal((await PDFDocument.load(r.stdout)).getPageCount(), 2);
  });

  test('--tagged keeps the structure, --outline adds bookmarks', async () => {
    const page = file('native/t.html', '<h1>Title</h1><h2>Sub</h2><p>text</p>');
    const out = join(dir, 't.pdf');
    let r = await native(['--tagged', '--outline', page, out]);
    assert.equal(r.code, 0, r.stderr);
    let doc = await PDFDocument.load(readFileSync(out));
    assert.ok(doc.catalog.get(PDFName.of('StructTreeRoot')));
    assert.ok(doc.catalog.get(PDFName.of('Outlines')));
    r = await native([page, out]);
    doc = await PDFDocument.load(readFileSync(out));
    assert.equal(doc.catalog.get(PDFName.of('StructTreeRoot')), undefined);
    assert.equal(doc.catalog.get(PDFName.of('Outlines')), undefined);
  });

  test('the JavaScript delay waits for what is pending, 1000 ms at most', async (t) => {
    // A change after loading is printed; one after the bound is not, though
    // its timer keeps the page busy; a quiet page does not wait the delay.
    const page = file('native/delay.html', `<p id="a">start</p><script>
      setTimeout(() => { document.getElementById('a').textContent += ' early'; }, 300);
      setTimeout(() => { document.getElementById('a').textContent += ' late'; }, 3000);
    </script>`);
    const out = join(dir, 'native-delay.pdf');
    assert.equal((await native([page, out])).code, 0);
    const quiet = file('native/quiet.html', '<p>quiet</p>');
    const r = await native(['--javascript-delay', '5000', quiet, join(dir, 'native-quiet.pdf')]);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(r.ms < 4000, `a quiet page waited ${Math.round(r.ms)} ms`);
    assert.equal((await native(['--javascript-delay', 'soon', quiet, join(dir, 'native-quiet.pdf')])).code, 1);
    if (!hasPyMuPDF) return t.skip('PyMuPDF missing');
    const text = pagesText(out)[0]!;
    assert.match(text, /start early/);
    assert.doesNotMatch(text, /late/);
  });

  test('pdfkiln wkhtmltopdf switches to the compatible mode', async () => {
    const r = await native(['wkhtmltopdf', '--version']);
    assert.match(r.stdout.toString(), /^wkhtmltopdf 0\.12\.6/);
  });

  test('a missing input', async () => {
    const r = await native([join(dir, 'missing.html'), join(dir, 'm.pdf')]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /pdfkiln: error/);
  });
});

describe('wkhtmltoimage', () => {
  const exe = bundled ? join(root, 'dist', 'bundle', 'wkhtmltoimage.cjs') : join(root, 'dist', 'src', 'bin', 'wkhtmltoimage.js');
  const image = (args: string[], stdin = ''): Promise<Run> => new Promise((ok) => {
    const t0 = performance.now();
    const child = spawn(...command(process.env.PDFKILN_TEST_WKHTMLTOIMAGE, exe, args), { cwd: dir });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => ok({ code, stdout: Buffer.concat(out), stderr: err, ms: performance.now() - t0 }));
    child.stdin.end(stdin);
  });
  const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
  const page = file('image/page.html', '<body style="margin:0"><div style="height:240px;background:#336">Image</div></body>');

  test('the screen width, the height of the content; standard output in JPEG', async () => {
    const out = join(dir, 'page.png');
    let r = await image(['-q', page, out]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(pngSize(readFileSync(out)), [1024, 240]);
    r = await image(['-q', '-', '-'], '<p>From stdin</p>');
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual([...r.stdout.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    r = await image(['--version']);
    assert.match(r.stdout.toString(), /^wkhtmltoimage 0\.12\.6 \(with patched qt\), pdfkiln /);
  });

  test('--width, smart width, --height and cropping', async () => {
    const wide = file('image/wide.html', '<body style="margin:0"><div style="width:1500px;height:50px">wide</div></body>');
    const out = join(dir, 'size.png');
    assert.equal((await image(['-q', wide, out])).code, 0);
    const [w] = pngSize(readFileSync(out));
    assert.ok(w! >= 1500 && w! <= 1511, `smart width ${w}`);
    assert.equal((await image(['-q', '--width', '600', '--disable-smart-width', '--height', '300', wide, out])).code, 0);
    assert.deepEqual(pngSize(readFileSync(out)), [600, 300]);
    assert.equal((await image(['-q', '--crop-x', '10', '--crop-y', '5', '--crop-w', '100', '--crop-h', '50', page, out])).code, 0);
    assert.deepEqual(pngSize(readFileSync(out)), [100, 50]);
    const r = await image(['--crop-x', '5000', page, out]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Will not output an empty image/);
  });

  test('formats: from the extension or --format; transparency in PNG', async () => {
    const bmp = join(dir, 'page.bmp');
    assert.equal((await image(['-q', page, bmp])).code, 0);
    const b = readFileSync(bmp);
    assert.equal(b.toString('latin1', 0, 2), 'BM');
    assert.deepEqual([b.readInt32LE(18), b.readInt32LE(22), b.readUInt16LE(28)], [1024, 240, 24]);
    const svg = join(dir, 'page.out');
    assert.equal((await image(['-q', '-f', 'svg', page, svg])).code, 0);
    assert.match(readFileSync(svg, 'utf8'), /<svg [^>]*width="1024" height="240"/);
    const gif = join(dir, 'page.gif');
    const r = await image([page, gif]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /Could not save image/);
    const clear = file('image/clear.html', '<body style="margin:0"><div style="height:20px"></div></body>');
    const png = join(dir, 'clear.png');
    assert.equal((await image(['-q', '--transparent', clear, png])).code, 0);
    const { decodePng } = await import('../src/engine/raster.js');
    assert.equal(decodePng(readFileSync(png)).rgba[3], 0);
  });
});

describe('pdfkiln serve', () => {
  const pdfkiln = bundled ? join(root, 'dist', 'bundle', 'pdfkiln.cjs') : join(root, 'dist', 'src', 'bin', 'pdfkiln.js');

  test('conversions use the Chromium kept open, each in a context of its own', async (t) => {
    const socket = process.platform === 'win32' ? `\\\\.\\pipe\\pdfkiln-test-${process.pid}` : join(dir, 'serve', 'chromium.sock');
    // Killed on Windows, serve cannot remove its folder: it goes in the suite's.
    const tmp = mkdtempSync(join(dir, 'serve-tmp-'));
    const server = spawn(...command(process.env.PDFKILN_TEST_PDFKILN, pdfkiln, ['serve', '--socket', socket]), {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp },
    });
    let log = '';
    await new Promise<void>((ok, fail) => {
      server.stderr.on('data', (d) => {
        log += d;
        if (/serving on/.test(log)) ok();
      });
      server.once('exit', () => fail(new Error(`pdfkiln serve exited: ${log}`)));
    });
    try {
      const env = { PDFKILN_SERVER: socket, PDFKILN_TIMINGS: '1' };
      const [a, b] = await Promise.all([
        run(['-q', `${base}/set-cookie`, join(dir, 'serve-a.pdf')], { env }),
        run(['-q', `${base}/ok`, join(dir, 'serve-b.pdf')], { env }),
      ]);
      assert.equal(a.code, 0, a.stderr);
      assert.equal(b.code, 0, b.stderr);
      assert.match(a.stderr, /"served":1/);
      const c = await run(['-q', `${base}/show-cookie`, join(dir, 'serve-c.pdf')], { env });
      assert.equal(c.code, 0, c.stderr);
      if (hasPyMuPDF) assert.match(pagesText(join(dir, 'serve-c.pdf'))[0]!, /Cookie: none/);
      // No server there: the command starts its own Chromium.
      const d = await run(['-q', `${base}/ok`, join(dir, 'serve-d.pdf')], { env: { PDFKILN_SERVER: join(dir, 'nowhere.sock'), PDFKILN_TIMINGS: '1' } });
      assert.equal(d.code, 0, d.stderr);
      assert.doesNotMatch(d.stderr, /"served"/);
    } finally {
      const exited = new Promise((ok) => server.once('exit', ok));
      // Windows has no SIGTERM: the tree is killed.
      if (process.platform === 'win32') (await import('../src/engine/browser.js')).killTree(server.pid);
      else server.kill('SIGTERM');
      await exited;
      // The killed Chromium holds its files a few seconds more on Windows.
      await (await import('../src/engine/browser.js')).removeWhenFree(tmp, 30000);
    }
    if (process.platform !== 'win32') assert.ok(!existsSync(socket), 'socket removed');
    if (!hasPyMuPDF) t.skip('PyMuPDF missing');
  });
});
