# ERPNext 15 POS invoice, POS Invoice format, custom 80 x 200 mm page, no letter head, 3 pages

## Origin

- Same installation and site as [`erpnext15-sales-invoice`](../erpnext15-sales-invoice/SOURCE.md): **Frappe 15.124.0**
  (commit `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab`) and **ERPNext 15.124.1** (commit
  `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e`), branches `version-15`, frappe-bench 5.31.1, Python 3.11.15, MariaDB
  10.11.14, pdfkit 1.0.0; site `erpnext15.local` reached as `http://127.0.0.1:8000`; company *Atelier Kiln SARL*
  (France, EUR, time zone Europe/Paris). Captured in a second session on 2026-10-23, 22:58-23:03 UTC (just after
  midnight on 2026-10-24 in the site's time zone).
- Data added by script for this batch (made up): customer "Client comptoir"; POS Profile "Boutique Lyon" (warehouse
  "Stores - AK", Standard Selling, payments Cash and Credit Card) and a POS Opening Entry for 2026-10-23.
- No letter head: "No Letterhead" chosen in the print view (`no_letterhead=1`).
- Document: **POS Invoice ACC-PSINV-2026-00001**, submitted (Paid), 2026-10-23 11:42, customer "Client comptoir", 4
  lines (CER-MUG-35 2 x 16.90, CER-BOL-12 4 x 14.50, CER-COU-14 3 x 8.90, CER-VAS-20 1 x 22.00), net 140.50 EUR, VAT 20
  % 28.10, total 168.60, paid 200.00 in cash, change 31.40.
- Print Settings: PDF page size **Custom**, width **80** mm, height **200** mm (a receipt roll); other settings as the
  defaults.
- A first test printed a Sales Invoice with this format; that pairing is not offered by the print view (the format
  belongs to POS Invoice), so it was cancelled and replaced by a real POS Invoice.

## Print format and templates

Print format **POS Invoice**, shipped by ERPNext (Jinja, module Selling, `doc_type` POS Invoice): a receipt layout with
the company, receipt number, cashier, customer, date and time, a 3-column item table, totals, payments, change and a
closing line. It has no `#header-html` or `#footer-html` block.

- ERPNext (GPL-3.0): `erpnext/selling/print_format/pos_invoice/pos_invoice.json` (the template is in its `html` field).
- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/www/printview.py` and `printview.html`,
  `frappe/templates/styles/standard.css`, the *Redesign* Print Style, `frappe/utils/pdf.py` (`prepare_options` turns the
  custom size into `--page-height` / `--page-width`), and the print CSS bundle.
- Pinned sources:
  <https://github.com/frappe/erpnext/blob/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/selling/print_format/pos_invoice/pos_invoice.json>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=POS Invoice&name=ACC-PSINV-2026-00001&format=POS Invoice&no_letterhead=1&letterhead=No Letterhead&settings={}&_lang=en`
  (URL-encoded). Frappe rendered the print view and called wkhtmltopdf once.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; no header or footer page was passed; the page piped on stdin is `input/page.html` (`-`
  kept); the final `-` (PDF written to stdout) became `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html`; the `www/` files did not
  contain it. The site name never appears.
- `www`: fetched from the Frappe server right after the print (every same-origin stylesheet and image of the HTML files,
  then every `url()` and `@import` of the CSS); the files are exactly the requests wkhtmltopdf made during the capture
  (server log): `/assets/frappe/dist/css/print.bundle.7DKZWKDD.css`. It is in `corpus/_shared/erpnext15/www`, shared by
  the entries of this batch; the entry has no `www/` of its own. `bench start` runs `bench watch`, which rebuilt the
  assets at start-up: the print CSS is now named `print.bundle.7DKZWKDD.css` and differs from
  `print.bundle.H34JAH53.css` of the first two entries only in three comments (two build directory paths and the
  `sourceMappingURL`). `httpHeaders` is what the Frappe server sent (`Cache-Control: max-age=43200, public`).
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **3 pages**, 80 x
  200 mm. Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- A custom page size passed as `--page-height 200.0 --page-width 80.0`: unit-less decimal values, read as millimetres by
  wkhtmltopdf (the PDF pages are 227 x 567 pt).
- Frappe's fixed 15 mm side margins leave a 50 mm content box: names wrap one or two words per line, the item table is
  wider than the box and its "Amount" column is clipped at the right margin; the receipt runs over 3 pages.
- No header or footer page: `--margin-top 15mm --margin-bottom 15mm`, no page numbers.
- Fonts: Inter; the PDF embeds Inter-Medium and Inter-Bold.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, only the print CSS requested, 3
pages as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100 dpi).
Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, Print Style CSS and the print CSS bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the POS Invoice template that shaped `input/page.html`. Redistribution is allowed; this entry keeps
  the license notice here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`), identified by its banners (hence
  `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT), normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css
  (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The company, customer, items and amounts were written for the corpus.
