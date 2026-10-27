# Odoo 17 customer invoice, 4 lines, Light (standard) layout

## Origin

- Application: **Odoo 17.0 Community** (`odoo/release.py`: `version_info = (17, 0, 0, FINAL, 0, '')`),
  branch `17.0` of https://github.com/odoo/odoo at commit `dca5cd22d40f25066919d722bf687be48c51b0ec`
  (committed 2026-10-23T14:40:20Z, "[FIX] mail: truncate long reaction content"), cloned 2026-10-23.
- Python 3.12.13 venv with `requirements.txt` (psycopg2-binary instead of psycopg2), PostgreSQL 16,
  Ubuntu 24.04. Database created **with demo data**; modules installed: `account`, `sale_management`,
  `stock`, `purchase` (and their dependencies, 66 modules).
- Document: Customer invoice **INV/2026/00005** (`account.move` id 25), posted, 4 product lines, customer *Acme Corporation*, payment terms 30 days, 15% tax.
  Created with `odoo shell` from demo records (demo customer `base.res_partner_2` and the first demo products by internal reference), then posted with `action_post()`. The demo invoices INV/2026/00001-00004 only have 2 lines each.
- Report action: `account.account_invoices` (report `account.report_invoice_with_payments`, the Print button of an invoice).
- Templates: `account.report_invoice_with_payments` → `account.report_invoice` → `account.report_invoice_document` → `web.external_layout` → `web.external_layout_standard` ("Light"), plus `web.html_container`, `web.report_layout`, `web.address_layout`, `account.document_tax_totals`; header, footer and body pages wrapped by `web.minimal_layout`.
- Sources: <https://github.com/odoo/odoo/blob/dca5cd22d40f25066919d722bf687be48c51b0ec/addons/account/views/report_invoice.xml>, <https://github.com/odoo/odoo/blob/dca5cd22d40f25066919d722bf687be48c51b0ec/addons/account/views/account_report.xml>,
  <https://github.com/odoo/odoo/blob/dca5cd22d40f25066919d722bf687be48c51b0ec/addons/web/views/report_templates.xml> (external layouts, `web.minimal_layout` with the `subst()` script),
  <https://github.com/odoo/odoo/blob/dca5cd22d40f25066919d722bf687be48c51b0ec/odoo/addons/base/models/ir_actions_report.py> (`_build_wkhtmltopdf_args`, `_run_wkhtmltopdf`).
- Company settings: demo company "My Company (San Francisco)", demo placeholder logo ("Your logo", embedded by Odoo as a
  `data:` URI), font Lato, no custom colours, layout background "Blank", report layout `web.external_layout_standard` ("Light", the layout Odoo uses when none is chosen) set on
  `res.company.external_report_layout_id`. Paper format: demo default "A4" (`base.paperformat_euro`):
  margins top 40 / bottom 32 / left 7 / right 7 mm, header spacing 35, dpi 90.

## Capture

- The Odoo server (threaded mode, `workers = 0`, 127.0.0.1:8069, `web.base.url` and `report.url` =
  `http://127.0.0.1:8069`) ran with `bench/capture/wkhtmltopdf-shim.py` first on `PATH` under the name
  `wkhtmltopdf`, in front of the official wkhtmltopdf 0.12.6-1 build ("0.12.6 (with patched qt)").
  At start-up Odoo logged `Will use the Wkhtmltopdf binary at ...` and reported state `ok`.
- The report was printed the way the web client does it: log in as `admin` over HTTP, set the company layout with a
  JSON-RPC `write` on `res.company`, then `GET /report/pdf/account.report_invoice_with_payments/25`.
  Odoo itself rendered the QWeb templates, wrote the temporary files and called wkhtmltopdf.
- `args` in `manifest.json` is the captured argument list, unchanged and in order, except:
  - the pair `--cookie-jar /tmp/report.cookie_jar.tmp.<random>.txt` is removed. Odoo 17 passes the session cookie as a
    cookie-jar file (not `--cookie session_id <value>`) whenever the print comes through an HTTP request;
  - `/tmp/report.header.tmp.<random>.html`, `/tmp/report.footer.tmp.<random>.html` and
    `/tmp/report.body.tmp.0.<random>.html` became `input/report.header.tmp.html`, `input/report.footer.tmp.html` and
    `input/report.body.tmp.0.html` (only the random part is dropped: `subst()` reads the record index with
    `webpage.split('.', 4)[3]`);
  - the output `/tmp/report.tmp.<random>.pdf` became `{out}`.
- In the three HTML files, `<base href="http://127.0.0.1:8069?debug=0"/>` became `http://127.0.0.1:8765?debug=0`
  (the only absolute server URL; stylesheets are root-relative). No `www/` file contained the origin.
- `www/` was fetched from the Odoo server right after the print, before the next layout change: every
  same-origin `href`/`src` of the HTML files, then every `url()` of the CSS bundles (all formats listed in each
  `@font-face src`). The CSS bundle depends on the company layout (`web.styles_company_report`), and Odoo gives it a
  new hash at each layout change and redirects the old hash with a 303, so it cannot be re-fetched later.
  Bundles: `/web/assets/414e890/web.report_assets_pdf.min.css`, `/web/assets/f73654f/web.report_assets_common.min.css`. 57 files, 4.0 MB.
- Left out of `www/` (none of them is requested when this document is rendered):
  90 `https://fonts.odoocdn.com/fonts/noto/...` URLs (family "Odoo Unicode Support Noto",
  restricted by `unicode-range` to non-Latin scripts; external host); 154 dynamic
  `/web_editor/shape/...svg?c1=...` URLs (website section backgrounds); `/base/static/src/img/layout/play-button.png` and
  `play-button-over.png`, which answer 404 on the Odoo server itself.
- Calls and JavaScript: no `<script src>`; the header and footer carry Odoo's inline `subst()` script
  (`<body onload="subst()">`), which fills `.page` / `.topage` and keeps the header/footer of record `index`.
  `--javascript-delay 1000` comes from the `report.print_delay` default.
- After wkhtmltopdf: Odoo then embeds a `factur-x.xml` file into the PDF it returns (module `account_edi_ubl_cii`); that step happens after wkhtmltopdf and is not part of this entry.
- `reference-capture.pdf` is the PDF the real wkhtmltopdf wrote during the capture: **1 page**.

## Serving `www/`: cache headers matter

Odoo serves `/web/assets/...` with `Cache-Control: public, max-age=31536000, immutable` and `/web/static/...` with
`Cache-Control: public, max-age=604800`. wkhtmltopdf 0.12.6 loads the body first, then the header and footer pages;
with those headers it takes the CSS and fonts from its memory cache. Served **without** cache headers
(`python3 -m http.server`), wkhtmltopdf fetches the fonts again for the header and footer and draws them before the
fonts arrive: the logo and rules appear but every text of the header and footer is missing (company address,
"Page: 1 / 1"). With Odoo's two `Cache-Control` values the replay is identical to the capture.

## Offline check (2026-10-23)

Entry copied to a directory without dots, `127.0.0.1:8765` replaced by the port, `www/` served by a logging static
server sending the two `Cache-Control` values above, Odoo stopped, real wkhtmltopdf 0.12.6 run from the entry
directory with the manifest `args`: exit code 0, no 404, 1 page as in the capture, same
extracted text, pages identical pixel for pixel to `reference-capture.pdf` (PyMuPDF, 100 dpi). Requested files:
`/web/assets/414e890/web.report_assets_pdf.min.css`, `/web/assets/f73654f/web.report_assets_common.min.css`, `/web/static/fonts/lato/Lato-Bla-webfont.woff`, `/web/static/fonts/lato/Lato-Bol-webfont.woff`, `/web/static/fonts/lato/Lato-Hai-webfont.woff`, `/web/static/fonts/lato/Lato-Lig-webfont.woff`, `/web/static/fonts/lato/Lato-Reg-webfont.woff`.

## License

- Odoo Community is published under the **LGPL-3.0** (`LICENSE`, `COPYRIGHT` of the repository); the templates, the
  CSS compiled from Odoo's SCSS, the demo data (company, partners, products, placeholder logo) and the Odoo images
  in `www/` (`empty_folder.svg`, `openhand.cur`, `curved_arrow.svg`) fall under it. Redistribution is allowed.
- Third-party parts bundled in `web.report_assets_common.min.css` or served from `www/`:
  - Bootstrap 5 SCSS (`web/static/lib/bootstrap`): MIT. Odoo's bundler drops the license comments of Bootstrap and
    Font Awesome from the minified CSS (only `/* /path */` markers remain); this file names them.
  - Font Awesome 4.7 (`web/static/src/libs/fontawesome`): font SIL OFL 1.1, CSS MIT.
  - Lato (`web/static/fonts/lato`, eot/woff/ttf/svg): SIL OFL 1.1, Łukasz Dziedzic (license file next to the fonts in Odoo).
  - Montserrat, Oswald, Raleway, Tajawal (`web/static/fonts/google`): SIL OFL 1.1 (`OFL.txt` next to them in Odoo).
  - Open Sans, Roboto (`web/static/fonts/google`): Apache-2.0 (`LICENSE.txt` next to them in Odoo).
  - odoo_ui_icons (`web/static/lib/odoo_ui_icons`, made with Fontello): Apache-2.0 (`LICENSE.md` in Odoo).
  - `tiktok_only.woff` ("Copyright (c) 2023, GDI") and `twitter_x_only.woff` (Fontello) from `web/static/fonts`:
    no license of their own in the file or next to it, so they come under Odoo's repository terms; not requested
    when this document is rendered.
- `versioned: true`: every component allows redistribution, with the reservation above on the two small icon fonts.

## Layout in the repository

The files of `www/` that are the same in the five Odoo entries (fonts, images, `web.report_assets_pdf`) were moved to
`corpus/_shared/odoo17/www/`; only the layout's `web.report_assets_common` bundle stays in this entry's `www/`. The bench
serves both directories, this one first. `tiktok_only.woff` and `twitter_x_only.woff` were dropped: they carry no license
of their own and no document requests them.
