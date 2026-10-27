# ERPNext 15 quotation, Standard print format, Classic print style, US Letter, 1 page

## Origin

- Same installation, site, company, letter head, customer and items as
  [`erpnext15-sales-invoice`](../erpnext15-sales-invoice/SOURCE.md): **Frappe 15.124.0** (commit
  `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab`) and **ERPNext 15.124.1** (commit `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e`),
  branches `version-15`, frappe-bench 5.31.1, Python 3.11.15, MariaDB 10.11.14, pdfkit 1.0.0; company *Atelier Kiln SARL*
  (France, EUR), default Letter Head *Atelier Kiln* with HTML header (logo `/files/atelier-kiln-logo.png` and address)
  and HTML footer (legal mentions, bank details).
- Document: **Quotation SAL-QTN-2026-00001**, submitted (status Open), dated 2026-10-21, valid till 2026-11-20, to
  customer *Boulangerie Dupont & Fils*, 3 lines (CER-BOL-12 24 x 14.50, CER-BOL-15 24 x 17.90, CER-ASS-21 48 x 18.00),
  net 1 641.60 EUR, VAT 20 % 328.32, total 1 969.92, terms "Conditions générales de vente".
- ERPNext ships no print format for Quotation, so this entry uses **Standard** with different Print Settings from the
  invoice: print style **Classic** and PDF page size **Letter** (other settings as the defaults: font Default,
  *Repeat Header and Footer* on, *Compact Item Print* off, with letter head).
- The company's own Address record was disabled before creating the quotation, so the quotation has no company address
  block (the letter head already carries it); with it the terms went to a second page. With 3 lines the page is nearly
  full: the terms end about 20 mm above the footer text.

## Print format and templates

- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/www/printview.py` and `printview.html`,
  `frappe/templates/print_formats/standard.html` and `standard_macros.html`, `frappe/templates/styles/standard.css`,
  the *Classic* Print Style (`frappe/printing/print_style/classic/classic.json`: `font-family: Georgia, serif` on the
  print format's text), `frappe/utils/pdf.py` with `frappe/templates/print_formats/pdf_header_footer.html`, and the print
  CSS bundle `print.bundle.css`.
- ERPNext (GPL-3.0): `erpnext/controllers/print_settings.py` with
  `erpnext/templates/print_formats/includes/items.html`, `item_table_qty.html`, `total.html` and `taxes.html`; the
  Quotation DocType layout.
- Pinned sources: <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/printing/print_style/classic/classic.json>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>,
  <https://github.com/frappe/erpnext/tree/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/templates/print_formats/includes>.

## Capture

- Same set-up as the invoice: `bench start` with `bench/capture/wkhtmltopdf-shim.py` first on `PATH` as `wkhtmltopdf`, in
  front of the official wkhtmltopdf 0.12.6-1 build; logged in as Administrator, then
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Quotation&name=SAL-QTN-2026-00001&format=Standard&no_letterhead=0&letterhead=Atelier Kiln&_lang=en`.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; `/tmp/frappe-pdf-<random>.html` after `--header-html` and `--footer-html` became
  `input/header.html` and `input/footer.html`; the page piped on stdin is `input/page.html` (`-` kept); the final `-`
  (PDF written to stdout) became `{out}`. Compared with the invoice only `--page-size Letter` differs.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html` and `input/header.html`;
  the footer (print CSS inlined) and `www/` did not contain it.
- `www/` holds the only two files wkhtmltopdf requested: `/assets/frappe/dist/css/print.bundle.H34JAH53.css` (no
  `@font-face`, only `data:` URIs in `url()`) and `/files/atelier-kiln-logo.png`. `httpHeaders` is what the Frappe server
  sent (`Cache-Control: max-age=43200, public`).
- `reference-capture.pdf` is the PDF wkhtmltopdf wrote to stdout during the capture: **1 page**, US Letter.

## What this entry exercises

- As in the invoice: no `--margin-top` / `--margin-bottom`, so wkhtmltopdf sizes them from the header and footer pages
  (the body starts 44 mm from the top here); `--disable-javascript` is passed but the footer's `subst()` still writes
  "Page 1 of 1"; `--disable-local-file-access`, `--disable-smart-shrinking`, `--print-media-type`.
- Classic print style: `font-family: Georgia, serif`. Georgia is not installed on the capture machine; the reference PDF
  embeds Liberation Sans (regular and bold). The CSS ships no font file, so the result depends on the installed fonts.
- The 11-column item table fits the Letter width.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the port (8767), `www/` served by a logging static
server with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run with the manifest `args` and
`input/page.html` on stdin: exit code 0, no 404, the two files above requested, 1 page as in the capture, same extracted
text, page identical pixel for pixel to `reference-capture.pdf` (PyMuPDF, 100 dpi).

## License

- Frappe: **MIT** (print view, Standard format, header/footer template, Print Style CSS, print CSS bundle).
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): item, quantity, totals and taxes templates and the Quotation layout. Redistribution is allowed.
- Third-party code inside the print CSS (also inlined in `input/footer.html`; hence `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT), normalize.css 3.0.2
  (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The letter head HTML, the logo, the company, customer, items and amounts were written for this entry.
