# ERPNext 15 purchase order, Standard print format, Monochrome print style, image letter head, US Letter, 3 pages

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
- Letter Head **Atelier Kiln Achats**, chosen in the print view (the default letter head stays *Atelier Kiln*). Header
  and footer from images (Letter Head `source` and `footer_source` "Image"): the header is
  `/files/atelier-kiln-entete-achats.png` (1400 x 200 PNG drawn with Pillow for this entry, logo, name and purchasing
  address) shown 660 px wide, aligned left; the footer is `/files/atelier-kiln-pied-achats.png` (1400 x 90 PNG, legal
  mentions and delivery hours) shown 660 px wide, centred. Frappe generated the `<img>` HTML of both
  (`LetterHead.set_image_as_html`).
- Document: **Purchase Order PUR-ORD-2026-00001**, submitted, dated 2026-10-14, required by 2026-11-05, supplier *Terres
  & Émaux du Rhône SAS*, target warehouse "Stores - AK", 8 lines (MAT-ARG-25 500 kg x 1.38, MAT-POR-12 100 kg x 3.40,
  MAT-EMA-BLP 10 kg x 18.50, MAT-EMA-CEL 10 kg x 21.00, MAT-EMA-SAB 5 kg x 19.20, MAT-EMA-TRA 15 kg x 12.40, MAT-OXY-COB
  500 g x 0.19, MAT-KAO-25 50 kg x 0.96), net 1 850.00 EUR, VAT 20 % 370.00, total 2 220.00, terms "Conditions générales
  d'achat", supplier address, contact and company billing address blocks.
- Print Settings: print style **Monochrome**, PDF page size **Letter**; other settings as the defaults.

## Print format and templates

Print format **Standard** (ERPNext's only Purchase Order format, "Drop Shipping Format", is for drop shipping).

- Frappe (MIT): `frappe/utils/print_format.py` (`download_pdf`), `frappe/utils/print_utils.py` (`get_print`),
  `frappe/www/printview.py` and `printview.html`, `frappe/templates/print_formats/standard.html` and
  `standard_macros.html`, `frappe/templates/styles/standard.css`, the *Monochrome* Print Style
  (`frappe/printing/print_style/monochrome/monochrome.json`), `frappe/utils/pdf.py` (`prepare_options`,
  `prepare_header_footer`, `get_pdf`) with `frappe/templates/print_formats/pdf_header_footer.html` for the header and
  footer pages, and the print CSS `print.bundle.css` built from `frappe/public/scss/print.bundle.scss`;
  `frappe/printing/doctype/letter_head/letter_head.py` (image letter head HTML).
- ERPNext (GPL-3.0): `erpnext/controllers/print_settings.py` with `erpnext/templates/print_formats/includes/items.html`,
  `item_table_qty.html`, `total.html` and `taxes.html`; the Purchase Order DocType layout.
- Pinned sources:
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/templates/print_formats/standard.html>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/printing/print_style/monochrome/monochrome.json>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/printing/doctype/letter_head/letter_head.py>,
  <https://github.com/frappe/frappe/blob/f1cf50cf9bbc641bb015adb7008bf2ea1c8483ab/frappe/utils/pdf.py>,
  <https://github.com/frappe/erpnext/tree/4e0dce9ea8d351cd7023ad5ed66faf3cdec0680e/erpnext/templates/print_formats/includes>.

## Capture

- `bench start` with the same wrapper as the first entries first on `PATH`: `wkhtmltopdf` runs
  `bench/capture/wkhtmltopdf-shim.py`, which records the call and runs the official wkhtmltopdf 0.12.6-1 build. Print
  Settings were set by script before the print (they are global) and put back afterwards.
- Logged in as Administrator over HTTP (`POST /api/method/login`), then requested the URL the print view's PDF button
  opens (`render_page` in `frappe/printing/page/print/print.js`):
  `GET /api/method/frappe.utils.print_format.download_pdf?doctype=Purchase Order&name=PUR-ORD-2026-00001&format=Standard&no_letterhead=0&letterhead=Atelier Kiln Achats&settings={}&_lang=en`
  (URL-encoded). Frappe rendered the print view and called wkhtmltopdf once.
- `args` is the captured argument list, unchanged and in order, except: the pair `--cookie-jar /tmp/<random>.jar`
  (session cookie) is removed; `/tmp/frappe-pdf-<random>.html` after `--header-html` and `--footer-html` became
  `input/header.html` and `input/footer.html`; the page piped on stdin is `input/page.html` (`-` kept); the final `-`
  (PDF written to stdout) became `{out}`.
- Origin `http://127.0.0.1:8000` rewritten to `http://127.0.0.1:8765` in `input/page.html`, `input/header.html` and
  `input/footer.html`; the `www/` files did not contain it. The site name never appears.
- `www`: fetched from the Frappe server right after the print (every same-origin stylesheet and image of the HTML files,
  then every `url()` and `@import` of the CSS); the files are exactly the requests wkhtmltopdf made during the capture
  (server log): `/assets/frappe/dist/css/print.bundle.7DKZWKDD.css`, `/files/atelier-kiln-pied-achats.png`,
  `/files/atelier-kiln-entete-achats.png`. The letter head images are in the entry's `www/`, the print CSS in
  `corpus/_shared/erpnext15/www`, shared by the entries of this batch. `bench start` runs `bench watch`, which rebuilt
  the assets at start-up: the print CSS is now named `print.bundle.7DKZWKDD.css` and differs from
  `print.bundle.H34JAH53.css` of the first two entries only in three comments (two build directory paths and the
  `sourceMappingURL`). `httpHeaders` is what the Frappe server sent (`Cache-Control: max-age=43200, public`).
- The PDF wkhtmltopdf wrote to stdout during the capture (not versioned, as for the other entries): **3 pages**, US
  Letter. Frappe then rewrites it with pypdf; that step is not part of this entry.

## What this entry exercises

- Images in both the header and the footer page: their loaded heights decide the top and bottom margins (the body starts
  about 50 mm from the top). The header page requests the header image, the footer page the footer image.
- US Letter with the 15 mm side margins; the 13-column item table (with Finished Good Qty and Subcontracted Quantity) is
  wider than the content box and its last column, "Amount", is clipped at the right margin.
- An empty last page: on page 2 the terms end just above the footer, and wkhtmltopdf adds a third page that holds only
  the repeated header (letter head and "Purchase Order / PUR-ORD-2026-00001") and footer ("Page 3 of 3"). The page count
  depends on the body height to within a few millimetres: with only the bench's fonts (`bench/fonts.conf`, Liberation
  and DejaVu, no Inter), wkhtmltopdf gives 2 pages (`node dist/bench/compat.js erpnext15-purchase-order`, 2026-10-23).
- Fonts: Inter; the PDF embeds Inter-Medium and Inter-Bold.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the address of a logging static server serving
the manifest `www` directories with the manifest headers, Frappe stopped, real wkhtmltopdf 0.12.6 run from that
directory with the manifest `args` and `input/page.html` on stdin: exit code 0, no 404, the three files above requested,
3 pages as in the capture, same extracted text, pages identical pixel for pixel to the capture PDF (PyMuPDF 2.0, 100
dpi). Same result without the `Cache-Control` headers.

## License

- Frappe: **MIT** (`LICENSE` of the repository): print view, Standard format, header/footer template, image letter head
  HTML, Print Style CSS and the print CSS bundle.
- ERPNext: **GNU GPL v3** (`license.txt`; file headers say "GNU General Public License v3" without "or later", hence
  `GPL-3.0-only`): the item, quantity, totals and taxes templates and the Purchase Order layout that shaped
  `input/page.html`. Redistribution is allowed; this entry keeps the license notice here.
- Third-party code inside `print.bundle.7DKZWKDD.css` (`corpus/_shared/erpnext15/www`) and inlined in
  `input/footer.html`, identified by its banners (hence `BSD-3-Clause` in the manifest license): Bootstrap 3.3.1 (MIT),
  normalize.css 3.0.2 (MIT), HTML5 Boilerplate main.css (MIT), Quill 2.0.3 CSS (BSD-3-Clause).
- The two letter head images, the company, supplier, items and amounts were written for this entry; the images were
  drawn with Pillow.
