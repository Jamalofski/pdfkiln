// The outline of a conversion as wkhtmltopdf 0.12.6 keeps it
// (src/lib/outline.cc): one root per object, named after its page's title,
// its headings below, anchors named __WKANCHOR_<base 36>. --dump-outline
// writes it, the table of contents is made from it.
import type { OutlineItem } from '../pdf/assemble.js';

export interface WkItem {
  title: string;
  page: number; // as dumped: with the pages before and --page-offset
  link: string;
  backLink: string;
  children: WkItem[];
  source?: OutlineItem; // the heading in its own PDF
  doc: number;
}

export interface WkDoc {
  // A cover, an object left out of the outline, or a table of contents
  // not printed yet: an empty root that counts one page (addEmptyWebPage).
  empty: boolean;
  title: string;
  pages: number;
  items: OutlineItem[];
}

// Anchors in the order wkhtmltopdf fills them: the pages once, then each
// table of contents when it is replaced. A table replaced again with the
// same tree keeps its names, and its back links take the forward names (a
// slip of OutlineItem::fillAnchors). Empty roots have none.
export class Anchors {
  private counter = 0;
  private kept = new Map<number, [string, string][]>();

  private next(): string {
    return `__WKANCHOR_${(this.counter++).toString(36)}`;
  }

  forDoc(doc: number, count: number, replaced: boolean): [string, string][] {
    const old = this.kept.get(doc);
    let names: [string, string][];
    if (old && old.length === count) names = replaced ? old.map(([a]) => [a, a]) : old;
    else names = Array.from({ length: count }, () => [this.next(), this.next()]);
    this.kept.set(doc, names);
    return names;
  }
}

const countItems = (items: OutlineItem[]): number => items.reduce((n, i) => n + 1 + countItems(i.children), 0);

export function sameTree(a: OutlineItem[], b: OutlineItem[]): boolean {
  return a.length === b.length && a.every((x, i) => x.title === b[i]!.title && x.page === b[i]!.page && sameTree(x.children, b[i]!.children));
}

// The roots and their headings, numbered as wkhtmltopdf dumps them.
export function buildOutline(docs: WkDoc[], offset: number, anchorsOf: (doc: number, count: number) => [string, string][]): WkItem[] {
  let before = 0;
  return docs.map((d, k) => {
    const names = d.empty ? [] : anchorsOf(k, 1 + countItems(d.items));
    let n = 0;
    const take = () => names[n++] ?? ['', ''];
    const [link, backLink] = take();
    const base = before;
    before += d.empty ? 1 : d.pages;
    const walk = (items: OutlineItem[]): WkItem[] => items.map((it) => {
      const [l, b] = take();
      return { title: it.title, page: it.page + 1 + base + offset, link: l, backLink: b, children: walk(it.children), source: it, doc: k };
    });
    return { title: d.empty ? '' : d.title, page: base + offset, link, backLink, children: d.empty ? [] : walk(d.items), doc: k };
  });
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function outlineXml(roots: WkItem[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<outline xmlns="http://wkhtmltopdf.org/outline">'];
  const dump = (items: WkItem[], level: number) => {
    for (const it of items) {
      const head = `${'  '.repeat(level)}<item title="${escape(it.title)}" page="${it.page}" link="${escape(it.link)}" backLink="${escape(it.backLink)}"`;
      if (!it.children.length) lines.push(`${head}/>`);
      else {
        lines.push(`${head}>`);
        dump(it.children, level + 1);
        lines.push(`${'  '.repeat(level)}</item>`);
      }
    }
  };
  dump(roots, 1);
  lines.push('</outline>');
  return `${lines.join('\n')}\n`;
}
