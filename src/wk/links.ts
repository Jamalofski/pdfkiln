// Links between the objects of a conversion, as wkhtmltopdf 0.12.6 makes
// them (src/lib/pdfconverter.cc findLinks): a link to the page of another
// object goes to that object, to the element its fragment names, and is
// dropped when there is none; the other links stay links to the web,
// absolute unless --keep-relative-links.
import type { Page } from 'puppeteer-core';

export interface Anchor {
  href: string; // resolved, as Chromium writes it in the link
  raw: string; // as written
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// The key of a page: its URL without the fragment, percent-decoded
// (QUrl::fromPercentEncoding).
export function pageKey(url: string): string {
  const hash = url.indexOf('#');
  return decode(hash === -1 ? url : url.slice(0, hash));
}

// The fragment, decoded as QUrl::fragment gives it; '' when there is none.
export function fragmentOf(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? '' : decode(url.slice(hash + 1));
}

// The links of the main frame, from <a> elements only.
export async function anchorsOf(page: Page): Promise<Anchor[]> {
  return page.evaluate(() => {
    const out: { href: string; raw: string }[] = [];
    for (const a of Array.from(document.getElementsByTagName('a'))) {
      const raw = a.getAttribute('href') || a.getAttribute('ns0:href') || '';
      if (!raw) continue;
      try {
        out.push({ href: new URL(raw, document.baseURI).href, raw });
      } catch {
        // Not a URL: wkhtmltopdf makes nothing of it either.
      }
    }
    return out;
  }).catch(() => []);
}

// Makes Chromium write a named destination for each element that a link
// of another object points at: a hidden link to it. The element is the
// one wkhtmltopdf finds (a[name], then [id], then [name]); returns the
// name of each destination written, by fragment.
export async function markTargets(page: Page, fragments: string[]): Promise<Map<string, string>> {
  const found = await page.evaluate((list: string[]) => {
    const byAttr = (sel: string, attr: string, v: string) => Array.from(document.querySelectorAll(sel)).find((e) => e.getAttribute(attr) === v) ?? null;
    const box = document.createElement('div');
    box.style.setProperty('display', 'none', 'important');
    const names: [string, string][] = [];
    for (const f of list) {
      const wk = byAttr('a[name]', 'name', f) ?? byAttr('[id]', 'id', f) ?? byAttr('[name]', 'name', f);
      // Chromium's own lookup (Document::FindAnchor) must land on it.
      const chromium = document.getElementById(f) ?? byAttr('a[name]', 'name', f);
      if (!wk || wk !== chromium) continue;
      const a = document.createElement('a');
      a.href = `#${f}`;
      box.appendChild(a);
      names.push([f, new URL(a.href).hash.slice(1)]);
    }
    if (names.length) document.documentElement.appendChild(box);
    return names;
  }, fragments).catch(() => [] as [string, string][]);
  return new Map(found);
}

// --enable-toc-back-links: each heading links back to its entry in the
// table of contents. An <a> styled as nothing, around the heading's
// content, makes Chromium write the link; its href, __WKBACK_<n>, numbers
// the heading among those the outline lists. Returns how many there are.
export async function linkHeadings(page: Page): Promise<number> {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((h) => h.textContent?.trim() && h.getClientRects().length);
    headings.forEach((h, n) => {
      const a = document.createElement('a');
      a.href = `__WKBACK_${n}`;
      a.style.setProperty('all', 'unset');
      while (h.firstChild) a.appendChild(h.firstChild);
      h.appendChild(a);
    });
    return headings.length;
  }).catch(() => 0);
}

// The anchors a table of contents names, <a name="__WKANCHOR_...">.
export async function tocAnchorNames(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('a[name^="__WKANCHOR_"]'), (a) => a.getAttribute('name')!))
    .catch(() => []);
}
