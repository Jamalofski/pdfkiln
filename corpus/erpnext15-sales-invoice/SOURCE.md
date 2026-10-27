# ERPNext 15 sales invoice, Standard print format, HTML letter head, 2 pages

## Origin

- Applications: **Frappe 15.124.0**, branch `version-15` of https://github.com/frappe/frappe at commit
  `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab` (2026-10-22, "chore(release): Bumped to Version 15.124.0"), and
  **ERPNext 15.124.1**, branch `version-15` of https://github.com/frappe/erpnext at commit
  `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e` (2026-10-22, "chore(release): Bumped to Version 15.124.1"), cloned 2026-10-23
  by `bench init --frappe-branch version-15` and `bench get-app --branch version-15` (frappe-bench 5.31.1).
- Runtime: Ubuntu 24.04, Python 3.11.15, Node.js 22.22.0, yarn 1.22.22, MariaDB 10.11.14 (utf8mb4 / utf8mb4_unicode_ci),
  Redis from `bench start`. pdfkit 1.0.0 and pypdf 6.19.0 in the bench environment.
- Build-only change: Frappe's `package.json` takes `air-datepicker` from `github:frappe/air-datepicker`, a GitHub tarball the
  capture machine could not download; it was replaced by a tarball made with `git archive` of the same locked commit
  (`ed37b94d95c6`). That package is desk JavaScript and is not part of the print CSS.
- Site `erpnext15.local`, set as the default site and reached as `http://127.0.0.1:8000`. Setup wizard completed by script
  (`frappe.desk.page.setup_wizard.setup_wizard.setup_complete`): language English, country France, time zone
  Europe/Paris, currency EUR, company *Atelier Kiln SARL* (abbreviation AK), chart of accounts "Standard", fiscal year
  2026-01-01 to 2026-12-31, no demo data.
- Data written for this entry (made up, French business): company phone, e-mail and VAT number; tax account
  "TVA collectée 20%" and the Sales Taxes and Charges Template "TVA France 20% - AK" (the wizard creates no French template
  with the Standard chart); Terms and Conditions "Conditions générales de vente"; customer *Boulangerie Dupont & Fils*
  with a billing address in Villeurbanne and a contact; 35 items with prices in the "Standard Selling" price list.
- Letter Head *Atelier Kiln* (default, source "HTML" for both header and footer): the header is a two-cell table with the
  logo `/files/atelier-kiln-logo.png` (public File, 480 x 160 PNG drawn with Pillow for this entry) and the company
  address; the footer is a small centred block with legal mentions and bank details. Their HTML is in
  `input/header.html` and `input/footer.html`.
- Document: **Sales Invoice ACC-SINV-2026-00001**, submitted (status Unpaid), posting date 2026-10-20, due 2026-11-30,
  customer PO BDF-2026-0457 of 2026-10-02, 5 lines (CER-BOL-12 24 x 14.50, CER-BOL-15 24 x 17.90, SRV-PER-01 120 x 4.50,
  SRV-EMB-01 1 x 35.00, SRV-LIV-01 1 x 85.00), net 1 437.60 EUR, VAT 20 % 287.52, total 1 725.12, terms attached.
- Print Settings: the defaults after setup, unchanged: print style *Redesign*, font Default, PDF page size A4,
  *Repeat Header and Footer* on, *Compact Item Print* off, with letter head.
- Why 5 lines: with these defaults the Standard format puts eleven item columns besides "Sr" (Item, Description,
  Quantity, Stock UOM, UOM, Discount Amount, Distributed Discount Amount, Rate, Amount, Rate of Stock UOM, Grant
  Commission); the narrow ones wrap to three or four lines and about five rows fit on an A4 page. Measured with wkhtmltopdf during the capture: 35 lines gave 6 pages, 11 and 6 lines 3 pages,
  5 lines 2 pages. *Compact Item Print* makes rows taller (35 lines: 12 pages).

## Print format and templates

Print format **Standard** (Frappe's generated layout; ERPNext ships no default format for Sales Invoice):

- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/utils/print_utils.py` (`get_print`),
  `frappe/www/printview.py` and `printview.html`, `frappe/templates/print_formats/standard.html` and
  `standard_macros.html`, `frappe/templates/styles/standard.css`, the *Redesign* Print Style
  (`frappe/printing/print_style/redesign/redesign.json`), `frappe/utils/pdf.py` (`prepare_options`,
  `prepare_header_footer`, `get_pdf`) with `frappe/templates/print_formats/pdf_header_footer.html` for the header and
  footer pages, and the print CSS `print.bundle.css` built from `frappe/public/scss/print.bundle.scss`.
- ERPNext (GPL-3.0): `erpnext/controllers/print_settings.py` selects `erpnext/templates/print_formats/includes/items.html`,
  `item_table_qty.html`, `total.html` and `taxes.html`; the Sales Invoice DocType layout decides the fields shown.
- Pinned sources: <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/pdf_header_footer.html>,
  <https://github.com/frappe/erpnext/tree/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/templates/print_formats/includes>.

## Capture

- `bench start` (web server `bench serve --port 8000`, workers, Redis) ran with a directory first on `PATH` holding a
  `wkhtmltopdf` wrapper for `bench/capture/wkhtmltopdf-shim.py`, in front of the official wkhtmltopdf 0.12.6-1 build
  ("0.12.6 (with patched qt)"). pdfkit finds the binary with `which wkhtmltopdf`; Frappe also runs
  `wkhtmltopdf --version` and adds `--disable-smart-shrinking` because the version is above 0.12.3.
- The PDF was requested the way the print view's "PDF" button does it: log in as Administrator over HTTP, then
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Sales Invoice&name=ACC-SINV-2026-00001&format=Standard&no_letterhead=0&letterhead=Atelier Kiln&_lang=en`.
  Frappe rendered the print view, split it and called wkhtmltopdf once.
- How Frappe builds the call (`frappe/utils/pdf.py`): it parses the print view, extracts the first `#header-html` and
  `#footer-html` blocks (letter head, print heading, letter-head footer and "Page {page} of {topage}"), renders each with
  `pdf_header_footer.html` into `/tmp/frappe-pdf-<random>.html`, and pipes the rest of the page to wkhtmltopdf on stdin.
  The header page repeats the `<head>` of the page (link to the print CSS and the print style); the footer page gets the
  whole print CSS inlined in a `<style>` ("link tag does not work in footer in wkhtmltopdf"). Both carry the `subst()`
  script (`<body onload="subst()">`) that fills `.page` and `.topage`.
- `args` in `manifest.json` is the captured argument list, unchanged and in order, except:
  - the pair `--cookie-jar /tmp/<random>.jar` is removed (Frappe writes the session cookie `sid` there whenever the print
    comes through an HTTP request);
  - `/tmp/frappe-pdf-<random>.html` after `--header-html` and `--footer-html` became `input/header.html` and
    `input/footer.html`;
  - the page comes on stdin (`-`, stored as `input/page.html`) and pdfkit reads the PDF from stdout: the final `-` became
    `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html` (print CSS link, and the
  "Get PDF" link of the screen-only banner) and `input/header.html` (print CSS link, logo). The footer and `www/` did not
  contain it. The site name never appears.
- `www/` was fetched from the Frappe server right after the print: every same-origin stylesheet and image of the three
  HTML files, then every `url()` and `@import` of the CSS. The print CSS has no `@font-face` and its only `url()` values are
  `data:` URIs, so `www/` holds two files: `/assets/frappe/dist/css/print.bundle.H34JAH53.css` and
  `/files/atelier-kiln-logo.png`; these are also the only two requests wkhtmltopdf made during the capture.
- `httpHeaders` in the manifest is what the Frappe development server sent for both paths
  (`Cache-Control: max-age=43200, public`). Replayed without them, the output is the same.
- `reference-capture.pdf` is the PDF the real wkhtmltopdf wrote to stdout during the capture: **2 pages**, A4. Frappe
  then rewrites it with pypdf (and can encrypt it with a password); that step is not part of this entry.

## What this entry exercises

- No `--margin-top` and no `--margin-bottom`: wkhtmltopdf 0.12.6 sizes those margins from the header and footer pages.
  The header (letter head plus "Sales Invoice / ACC-SINV-2026-00001") is about 60 mm high; with an explicit
  `--margin-top 10mm` the body starts at 11 mm and runs under the header.
- `--disable-javascript` is passed, yet the footer's `subst()` runs: the page numbers are filled ("Page 1 of 2"). The
  output is the same with or without that option; the page's own `DOMContentLoaded` script changes nothing in print.
- `--disable-local-file-access` with header and footer given as local files; `--print-media-type`, `--background`,
  `--images`, `--encoding UTF-8`, left and right margins 15 mm (Frappe's defaults), `--disable-smart-shrinking`.
- The item table is wider than the content box: the HTML has 12 columns, and with smart shrinking off the last two,
  "Rate of Stock UOM" and "Grant Commission", fall past the right margin and are clipped (only a sliver of their cell
  borders is drawn, at x = 549-592 pt). A renderer that shrinks or wraps the table will not match.
- Fonts: the CSS asks for `Inter, "Helvetica Neue", Helvetica, Arial, "Open Sans", sans-serif` and ships no font file;
  the text depends on the fonts installed on the machine. The capture machine has Inter (package fonts-inter) and the
  reference PDF embeds Inter-Medium, Inter-SemiBold and Inter-Bold.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the port (8767), `www/` served by a logging static
server with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from the entry directory with the manifest
`args` and `input/page.html` on stdin: exit code 0, no 404, the two files above requested, 2 pages as in the capture,
same extracted text, pages identical pixel for pixel to `reference-capture.pdf` (PyMuPDF, 100 dpi). Same result without
the `Cache-Control` headers.

## License

- Frappe is published under the **MIT** license (`LICENSE` of the repository): print view, Standard format, header/footer
  template, Print Style CSS and the print CSS bundle.
- ERPNext is published under the **GNU GPL v3** (`license.txt`, file headers "GNU General Public License v3", no "or later"
  clause, hence `GPL-3.0-only`): the item, quantity, totals and taxes templates and the Sales Invoice layout that shaped
  `input/page.html` and `input/header.html`. Redistribution is allowed; this entry keeps the license notice here.
- Third-party code inside `print.bundle.H34JAH53.css` (also inlined in `input/footer.html`), identified by its banners (hence `BSD-3-Clause` in the manifest license):
  Bootstrap 3.3.1 (MIT), normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The letter head HTML, the logo, the company, customer, items and amounts were written for this entry.
