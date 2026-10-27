# ERPNext 15 journal entry, Standard print format, Modern print style, Helvetica font, US Letter, 1 page

## Origin

- Same installation and site as [`erpnext15-sales-invoice`](../erpnext15-sales-invoice/SOURCE.md): **Frappe 15.124.0**
  (commit `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab`) and **ERPNext 15.124.1** (commit
  `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e`), branches `version-15`, frappe-bench 5.31.1, Python 3.11.15, MariaDB
  10.11.14, pdfkit 1.0.0; site `erpnext15.local` reached as `http://127.0.0.1:8000`; company *Atelier Kiln SARL*
  (France, EUR, time zone Europe/Paris). Captured in a second session on 2026-10-23, 22:58-23:03 UTC (just after
  midnight on 2026-10-24 in the site's time zone).
- Data added by script for this batch (made up): bank ledger "Crédit Lyonnais 512100" under "Bank Accounts - AK"; the
  expense accounts are those of ERPNext's Standard chart of accounts.
- Letter Head *Atelier Kiln* (the default one of `erpnext15-sales-invoice`): HTML header (logo
  `/files/atelier-kiln-logo.png` and company address) and HTML footer (legal mentions, bank details).
- Document: **Journal Entry ACC-JV-2026-00001**, submitted, entry type Bank Entry, posting date 2026-10-05, reference
  RLV-2026-10 of 2026-10-05, 6 lines: debits Office Rent 1 450.00, Utility Expenses 386.40, Telephone Expenses 59.90,
  Postal Expenses 42.15, Print and Stationery 68.30, credit "Crédit Lyonnais 512100 - AK" 2 006.75; a user remark.
- Print Settings: print style **Modern**, **font Helvetica** (`font-family: Helvetica, sans-serif` on the print format),
  PDF page size **Letter**; other settings as the defaults.

## Print format and templates

Print format **Standard** (ERPNext's Journal Entry formats are vouchers and cheque layouts; this is the default one).

- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/utils/print_utils.py` (`get_print`),
  `frappe/www/printview.py` and `printview.html`, `frappe/templates/print_formats/standard.html` and
  `standard_macros.html`, `frappe/templates/styles/standard.css`, the *Modern* Print Style
  (`frappe/printing/print_style/modern/modern.json`), `frappe/utils/pdf.py` (`prepare_options`, `prepare_header_footer`,
  `get_pdf`) with `frappe/templates/print_formats/pdf_header_footer.html` for the header and footer pages, and the print
  CSS `print.bundle.css` built from `frappe/public/scss/print.bundle.scss`.
- ERPNext (GPL-3.0): the Journal Entry DocType layout (accounts table, reference and remark fields).
- Pinned sources:
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/printing/print_style/modern/modern.json>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/www/printview.py> (`get_font`),
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Journal Entry&name=ACC-JV-2026-00001&format=Standard&no_letterhead=0&letterhead=Atelier Kiln&settings={}&_lang=en`
  (URL-encoded). Frappe rendered the print view and called wkhtmltopdf once.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; `/tmp/frappe-pdf-<random>.html` after `--header-html` and `--footer-html` became
  `input/header.html` and `input/footer.html`; the page piped on stdin is `input/page.html` (`-` kept); the final `-`
  (PDF written to stdout) became `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html` and `input/header.html`;
  `input/footer.html` (print CSS inlined) and the `www/` files did not contain it. The site name never appears.
- `www`: fetched from the Frappe server right after the print (every same-origin stylesheet and image of the HTML files,
  then every `url()` and `@import` of the CSS); the files are exactly the requests wkhtmltopdf made during the capture
  (server log): `/assets/frappe/dist/css/print.bundle.7DKZWKDD.css`, `/files/atelier-kiln-logo.png`. Both are in
  `corpus/_shared/erpnext15/www`, shared by the entries of this batch; the entry has no `www/` of its own. `bench start`
  runs `bench watch`, which rebuilt the assets at start-up: the print CSS is now named `print.bundle.7DKZWKDD.css` and
  differs from `print.bundle.H34JAH53.css` of the first two entries only in three comments (two build directory paths
  and the `sourceMappingURL`). `httpHeaders` is what the Frappe server sent (`Cache-Control: max-age=43200, public`).
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **1 page**, US
  Letter. Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- Header and footer pages, US Letter; the body starts about 55 mm from the top.
- The Print Settings font: Helvetica, which fontconfig resolves to Liberation Sans; the PDF embeds Liberation Sans and
  Liberation Sans Bold.
- A short table of accounts with right-aligned currency columns.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, the two files above requested, 1
page as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100 dpi).
Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, Standard format, header/footer template, Print Style CSS
  and the print CSS bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the Journal Entry layout that shaped `input/page.html`. Redistribution is allowed; this entry keeps
  the license notice here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`) and inlined in
  `input/footer.html`, identified by its banners (hence `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT),
  normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The letter head HTML, the logo, the company, ledger names added for the corpus and the amounts were written for the
  corpus.
