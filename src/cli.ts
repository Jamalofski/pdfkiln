// One program, two names: the name it is called by, or "pdfkiln
// wkhtmltopdf", picks the mode; never the options.
import { basename } from 'node:path';
import { nativeMain } from './native/main.js';
import { serveMain } from './native/serve.js';
import { wkImageMain, wkMain } from './wk/main.js';

export function modeOf(name: string): 'wkhtmltopdf' | 'wkhtmltoimage' | 'native' {
  const n = basename(name).replace(/\.exe$/i, '').toLowerCase();
  return n === 'wkhtmltopdf' || n === 'wkhtmltoimage' ? n : 'native';
}

export async function main(name: string, args: string[]): Promise<number> {
  const mode = modeOf(name);
  if (mode === 'wkhtmltopdf') return wkMain(['wkhtmltopdf', ...args]);
  if (mode === 'wkhtmltoimage') return wkImageMain(['wkhtmltoimage', ...args]);
  if (args[0] === 'wkhtmltopdf') return wkMain(['wkhtmltopdf', ...args.slice(1)]);
  if (args[0] === 'wkhtmltoimage') return wkImageMain(['wkhtmltoimage', ...args.slice(1)]);
  if (args[0] === 'serve') return serveMain(args.slice(1));
  return nativeMain(args);
}
