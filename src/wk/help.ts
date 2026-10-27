// --help, --version and --license of the compatible mode. The option list
// comes from the table; the wording is ours.
import { chromiumVersion, version } from '../version.js';
import { ALL_OPTIONS, type Mode, type OptionSpec } from './options.js';

// "wkhtmltopdf 0.12.6" first: wicked_pdf and Odoo read the version from it,
// Frappe looks for "qt" to know that headers and footers work.
export function versionLine(): string {
  return `wkhtmltopdf 0.12.6 (with patched qt), pdfkiln ${version}, Chromium ${chromiumVersion}`;
}

const SECTIONS: [Mode, string][] = [['global', 'Global options'], ['page', 'Page options'], ['toc', 'TOC options']];

function line(o: OptionSpec): string {
  const sw = `${o.short ? `-${o.short}, ` : '    '}--${o.name}${o.args.map((a) => ` <${a}>`).join('')}`;
  return `  ${sw.padEnd(44)} ${o.desc}`;
}

export function usage(): string {
  const out = [
    'Name:',
    `  ${versionLine()}`,
    '',
    'Synopsis:',
    '  wkhtmltopdf [GLOBAL OPTION]... [OBJECT]... <output file>',
    '',
    'Objects:',
    '  A page: a file, a URL, or - for the standard input, followed by its page options.',
    '  "cover <page>" adds a cover: no header, footer or outline entry; "toc" a table of contents.',
    '  The output is a file, or - for the standard output.',
    '',
    'pdfkiln renders with Chromium and reproduces wkhtmltopdf 0.12.6: its options,',
    'its defaults, its messages and its exit codes. Page options given before the',
    'first page apply to every page.',
    '',
  ];
  for (const [mode, title] of SECTIONS) {
    out.push(`${title}:`);
    for (const o of ALL_OPTIONS.filter((x) => x.mode === mode)) out.push(line(o));
    out.push('');
  }
  out.push(
    'Headers and footers:',
    '  In --header-* and --footer-* texts, [page], [frompage], [topage], [webpage], [section],',
    '  [subsection], [subsubsection], [date], [isodate], [time], [title], [doctitle], [sitepage]',
    '  and [sitepages] are replaced. --header-html and --footer-html pages receive them as URL',
    '  parameters.',
    '',
    'pdfkiln is not affiliated with the wkhtmltopdf project.',
    '',
  );
  return out.join('\n');
}

export function license(): string {
  return `${versionLine()}

pdfkiln is free software under the MIT license. It runs Chromium (BSD license
and third parties), Node.js (MIT) and puppeteer-core (Apache-2.0), whose
licenses come with it. It is not affiliated with the wkhtmltopdf project.
`;
}
