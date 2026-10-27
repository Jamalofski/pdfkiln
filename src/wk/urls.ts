// How wkhtmltopdf 0.12.6 turns a page argument into a URL
// (src/lib/multipageloader.cc guessUrlFromString, taken from Arora).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parse(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

export function guessUrlFromString(input: string): string {
  let s = input.trim();
  // A host and a port.
  if (/^[a-zA-Z.]+:[0-9]*$/.test(s)) s = `http://${s}`;
  const hasSchema = /^[a-zA-Z]+:\/\/.*/s.test(s);
  if (hasSchema) {
    const u = parse(s);
    if (u) return u.href;
  }
  // A file, relative to the current directory.
  if (existsSync(s)) return pathToFileURL(resolve(s)).href;
  // A short URL: "example.com/page".
  if (!hasSchema) {
    const dot = s.indexOf('.');
    if (dot !== -1) {
      const prefix = s.slice(0, dot).toLowerCase();
      const u = parse(`${prefix === 'ftp' ? 'ftp' : 'http'}://${s}`);
      if (u) return u.href;
    }
  }
  const u = parse(input);
  if (u) return u.href;
  return parse(`http://${input}`)?.href ?? `http://${input}`;
}

// --header-html refuses HTML code instead of a URL (pdfconverter.cc).
export function looksLikeHtmlAndNotAUrl(s: string): boolean {
  return s.split('?')[0]!.includes('<') || s.toLowerCase().startsWith('data:');
}
