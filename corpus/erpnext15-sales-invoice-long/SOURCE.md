# ERPNext 15 sales invoice, Sales Invoice Print format, 32 lines, repeated letter head, A4, 3 pages

## Origin

- Same installation and site as [`erpnext15-sales-invoice`](../erpnext15-sales-invoice/SOURCE.md): **Frappe 15.124.0**
  (commit `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab`) and **ERPNext 15.124.1** (commit
  `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e`), branches `version-15`, frappe-bench 5.31.1, Python 3.11.15, MariaDB
  10.11.14, pdfkit 1.0.0; site `erpnext15.local` reached as `http://127.0.0.1:8000`; company *Atelier Kiln SARL*
  (France, EUR, time zone Europe/Paris). Captured in a second session on 2026-10-23, 22:58-23:03 UTC (just after
  midnight on 2026-10-24 in the site's time zone).
- Data added by script for this batch (made up): customer *Hôtel-Restaurant Le Cèdre* (Annecy) with address and contact.
  The company's own Address, disabled for `erpnext15-quotation`, was enabled again, so sales documents carry the company
  address block. Items, prices, sales tax template and terms are those of `erpnext15-sales-invoice`.
- Letter Head *Atelier Kiln* (the default one of `erpnext15-sales-invoice`): HTML header (logo
  `/files/atelier-kiln-logo.png` and company address) and HTML footer (legal mentions, bank details).
- Document: **Sales Invoice ACC-SINV-2026-00002**, submitted (Unpaid), posting date 2026-10-23, due 2026-12-31, customer
  *Hôtel-Restaurant Le Cèdre*, customer PO CEDRE-2026-118 of 2026-10-09, 32 lines (every CER- item of the catalogue),
  net 11 548.80 EUR, VAT 20 % 2 309.76, total 13 858.56, terms "Conditions générales de vente".
- Print Settings: the defaults (print style *Redesign*, font Default, PDF page size A4, *Repeat Header and Footer* on,
  *Compact Item Print* off, with letter head).

## Print format and templates

Print format **Sales Invoice Print**, shipped by ERPNext 15 (Jinja, module Accounts): its own header macro (letter head
in `#header-html`, no print heading), a footer block with the letter head footer and "Page {0} of {1}" in
`#footer-html`, customer and invoice blocks, a 5-column item table (Sr, Details, Qty, Rate, Amount), taxes, totals,
payment status and terms. The format's margin and page-number fields are not used on this path.

- ERPNext (GPL-3.0): `erpnext/accounts/print_format/sales_invoice_print/sales_invoice_print.html` and `.json`.
- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/www/printview.py` and `printview.html`,
  `frappe/templates/styles/standard.css`, the *Redesign* Print Style, `frappe/utils/pdf.py` with
  `frappe/templates/print_formats/pdf_header_footer.html`, and the print CSS bundle.
- Pinned sources:
  <https://github.com/frappe/erpnext/blob/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/accounts/print_format/sales_invoice_print/sales_invoice_print.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/pdf_header_footer.html>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Sales Invoice&name=ACC-SINV-2026-00002&format=Sales Invoice Print&no_letterhead=0&letterhead=Atelier Kiln&settings={}&_lang=en`
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
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **3 pages**, A4.
  Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- A long document: 32 item rows over pages 1 and 2, totals and terms on page 3; the header (letter head only) and the
  footer (letter head footer and "Page n of 3") are repeated on every page. The body starts about 37 mm from the top.
- Rows are not split across pages; the item table header is not repeated on page 2.
- Fonts: Inter; the PDF embeds Inter-Medium and Inter-Bold.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, the two files above requested, 3
pages as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100 dpi).
Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, header/footer template, Print Style CSS and the print CSS
  bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the Sales Invoice Print template that shaped `input/page.html`, `input/header.html` and
  `input/footer.html`. Redistribution is allowed; this entry keeps the license notice here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`) and inlined in
  `input/footer.html`, identified by its banners (hence `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT),
  normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The letter head HTML, the logo, the company, customer, items and amounts were written for the corpus.
