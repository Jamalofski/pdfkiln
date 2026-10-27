# ERPNext 15 delivery note, Standard print format, Compact Item Print, no letter head, A4, 3 pages

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
- No letter head: "No Letterhead" chosen in the print view (`no_letterhead=1`).
- Document: **Delivery Note MAT-DN-2026-00001**, made from Sales Order SAL-ORD-2026-00001
  (`erpnext.selling.doctype.sales_order.sales_order.make_delivery_note`, the "Create > Delivery Note" button) and
  submitted; posting date 2026-10-23 09:30, customer *Hôtel-Restaurant Le Cèdre*, transporter "Géodis Lyon", LR number
  GEO-LY-558120, the same 6 lines (net 5 854.00 EUR, VAT 1 170.80, total 7 024.80), billing and shipping address,
  company address block, terms.
- Print Settings: print style *Redesign*, PDF page size A4, **Compact Item Print** on; other settings as the defaults.

## Print format and templates

Print format **Standard** (ERPNext ships no print format for Delivery Note).

- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/utils/print_utils.py` (`get_print`),
  `frappe/www/printview.py` and `printview.html`, `frappe/templates/print_formats/standard.html` and
  `standard_macros.html`, `frappe/templates/styles/standard.css`, the *Redesign* Print Style
  (`frappe/printing/print_style/redesign/redesign.json`), `frappe/utils/pdf.py` (`prepare_options`,
  `prepare_header_footer`, `get_pdf`) with `frappe/templates/print_formats/pdf_header_footer.html` for the header and
  footer pages, and the print CSS `print.bundle.css` built from `frappe/public/scss/print.bundle.scss`.
- ERPNext (GPL-3.0): `erpnext/controllers/print_settings.py` (*Compact Item Print*: item details moved into the
  description cell) with `erpnext/templates/print_formats/includes/items.html`, `item_table_description.html`,
  `item_table_qty.html`, `total.html` and `taxes.html`; the Delivery Note DocType layout.
- Pinned sources:
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>,
  <https://github.com/frappe/erpnext/blob/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/controllers/print_settings.py>,
  <https://github.com/frappe/erpnext/tree/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/templates/print_formats/includes>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Delivery Note&name=MAT-DN-2026-00001&format=Standard&no_letterhead=1&letterhead=No Letterhead&settings={}&_lang=en`
  (URL-encoded). Frappe rendered the print view and called wkhtmltopdf once.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; `/tmp/frappe-pdf-<random>.html` after `--header-html` and `--footer-html` became
  `input/header.html` and `input/footer.html`; the page piped on stdin is `input/page.html` (`-` kept); the final `-`
  (PDF written to stdout) became `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html` and `input/header.html`;
  `input/footer.html` (print CSS inlined) and the `www/` files did not contain it. The site name never appears.
- `www`: fetched from the Frappe server right after the print (every same-origin stylesheet and image of the HTML files,
  then every `url()` and `@import` of the CSS); the files are exactly the requests wkhtmltopdf made during the capture
  (server log): `/assets/frappe/dist/css/print.bundle.7DKZWKDD.css`. It is in `corpus/_shared/erpnext15/www`, shared by
  the entries of this batch; the entry has no `www/` of its own. `bench start` runs `bench watch`, which rebuilt the
  assets at start-up: the print CSS is now named `print.bundle.7DKZWKDD.css` and differs from
  `print.bundle.H34JAH53.css` of the first two entries only in three comments (two build directory paths and the
  `sourceMappingURL`). `httpHeaders` is what the Frappe server sent (`Cache-Control: max-age=43200, public`).
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **3 pages**, A4.
  Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- Header and footer pages without a letter head: the header page holds only the print heading "Delivery Note /
  MAT-DN-2026-00001" and links the print CSS (no image), the footer page only "Page {page} of {topage}"; the body starts
  about 44 mm from the top.
- *Compact Item Print*: 5 columns (Sr, Description, Quantity, Rate, Amount), each description cell stacks the item code,
  name, UOM, rate of stock UOM, "Grant Commission" and "Use Serial No / Batch Fields" lines.
- Rows are not split across pages: rows 1-4 on page 1, rows 5-6 on page 2. Row 5, the first row of page 2, is drawn
  about 37 mm taller than the other rows (row spacing 229 pt against 124 pt on page 1).
- Fonts: Inter; the PDF embeds Inter-Medium, Inter-SemiBold and Inter-Bold.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, only the print CSS requested, 3
pages as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100 dpi).
Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, Standard format, header/footer template, Print Style CSS
  and the print CSS bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the item, description, quantity, totals and taxes templates, the compact item print code and the
  Delivery Note layout that shaped `input/page.html`. Redistribution is allowed; this entry keeps the license notice
  here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`) and inlined in
  `input/footer.html`, identified by its banners (hence `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT),
  normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The company, customer, items and amounts were written for the corpus.
