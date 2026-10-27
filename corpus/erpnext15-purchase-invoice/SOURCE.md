# ERPNext 15 purchase invoice, Purchase Auditing Voucher format, Classic print style, letter head in the page, A4, 2 pages

## Origin

- Same installation and site as [`erpnext15-sales-invoice`](../erpnext15-sales-invoice/SOURCE.md): **Frappe 15.124.0**
  (commit `f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab`) and **ERPNext 15.124.1** (commit
  `4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e`), branches `version-15`, frappe-bench 5.31.1, Python 3.11.15, MariaDB
  10.11.14, pdfkit 1.0.0; site `erpnext15.local` reached as `http://127.0.0.1:8000`; company *Atelier Kiln SARL*
  (France, EUR, time zone Europe/Paris). Captured in a second session on 2026-10-23, 22:58-23:03 UTC (just after
  midnight on 2026-10-24 in the site's time zone).
- Data added by script for this batch (made up): supplier *Terres & Émaux du Rhône SAS* (Saint-Priest) with address and
  contact, supplier *Fours Céramiques Morel* (Givors); 28 bought stock items (clays, glazes, oxides, kiln supplies,
  spare parts) with prices in "Standard Buying"; tax account "TVA déductible 20%" and the Purchase Taxes and Charges
  Template "TVA déductible 20% - AK"; Terms and Conditions "Conditions générales d'achat"; bank ledger "Crédit Lyonnais
  512100".
- Letter Head *Atelier Kiln* (the default one of `erpnext15-sales-invoice`): HTML header (logo
  `/files/atelier-kiln-logo.png` and company address) and HTML footer (legal mentions, bank details). Only its header is
  printed: this format does not render the letter head footer.
- Document: **Purchase Invoice ACC-PINV-2026-00001**, made from Purchase Order PUR-ORD-2026-00001
  (`erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice`) and submitted; posting date 2026-10-22,
  supplier invoice TER-F-26-08812 of 2026-10-21, the same 8 lines, net 1 850.00 EUR, VAT 370.00, total 2 220.00. It was
  printed before the payment of `erpnext15-payment-entry`. The voucher prints the creation date ("Date: 24/10/2026" in
  the site's time zone) and the due date ERPNext set at submission.
- Print Settings: print style **Classic**, PDF page size A4; other settings as the defaults.

## Print format and templates

Print format **Purchase Auditing Voucher**, shipped by ERPNext (Jinja, module Accounts): `add_header` from Frappe's
standard macros writes the letter head and heading inside the page (no `#header-html`), then two key/value tables, the
item table (SL, Item Code, Item Name, UOM, Received Qty., Rejected Qty, Qty, Basic Rate, Amount), the totals and the GL
entries of the voucher (`frappe.get_list("GL Entry", ...)`).

- ERPNext (GPL-3.0): `erpnext/accounts/print_format/purchase_auditing_voucher/purchase_auditing_voucher.html` and
  `.json`.
- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/utils/print_utils.py` (`get_print`),
  `frappe/www/printview.py` and `printview.html`, `frappe/templates/print_formats/standard_macros.html` (`add_header`),
  `frappe/templates/styles/standard.css`, the *Classic* Print Style
  (`frappe/printing/print_style/classic/classic.json`), `frappe/utils/pdf.py` (`prepare_options`,
  `prepare_header_footer`, `get_pdf`), and the print CSS `print.bundle.css` built from
  `frappe/public/scss/print.bundle.scss`.
- Pinned sources:
  <https://github.com/frappe/erpnext/blob/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/accounts/print_format/purchase_auditing_voucher/purchase_auditing_voucher.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard_macros.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/printing/print_style/classic/classic.json>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Purchase Invoice&name=ACC-PINV-2026-00001&format=Purchase Auditing Voucher&no_letterhead=0&letterhead=Atelier Kiln&settings={}&_lang=en`
  (URL-encoded). Frappe rendered the print view and called wkhtmltopdf once.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; no header or footer page was passed; the page piped on stdin is `input/page.html` (`-`
  kept); the final `-` (PDF written to stdout) became `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html`; the `www/` files did not
  contain it. The site name never appears.
- `www`: fetched from the Frappe server right after the print (every same-origin stylesheet and image of the HTML files,
  then every `url()` and `@import` of the CSS); the files are exactly the requests wkhtmltopdf made during the capture
  (server log): `/assets/frappe/dist/css/print.bundle.7DKZWKDD.css`, `/files/atelier-kiln-logo.png`. Both are in
  `corpus/_shared/erpnext15/www`, shared by the entries of this batch; the entry has no `www/` of its own. `bench start`
  runs `bench watch`, which rebuilt the assets at start-up: the print CSS is now named `print.bundle.7DKZWKDD.css` and
  differs from `print.bundle.H34JAH53.css` of the first two entries only in three comments (two build directory paths
  and the `sourceMappingURL`). `httpHeaders` is what the Frappe server sent (`Cache-Control: max-age=43200, public`).
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **2 pages**, A4.
  Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- No header or footer page: `--margin-top 15mm --margin-bottom 15mm` from Frappe; the letter head is in the flow of page
  1 only.
- *Classic* print style (`font-family: Georgia, serif`): Georgia is not installed on the capture machine; the PDF embeds
  Liberation Sans and Liberation Sans Bold.
- Bootstrap bordered and condensed tables; raw float values (`1.38`, `690.0`) printed by the template.
- The GL entries table moves whole to page 2.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, the two files above requested, 2
pages as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100 dpi).
Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, `add_header` macro, Print Style CSS and the print CSS
  bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the Purchase Auditing Voucher template that shaped `input/page.html`. Redistribution is allowed; this
  entry keeps the license notice here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`), identified by its banners (hence
  `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT), normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css
  (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The letter head HTML, the logo, the company, supplier, items and amounts were written for the corpus.
