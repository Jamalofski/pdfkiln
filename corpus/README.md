# Corpus

Real templates built for wkhtmltopdf, used by the comparison bench
(`bench/corpus.ts`). Each entry reproduces one real conversion: the files and
the exact command line an application passed to wkhtmltopdf 0.12.6.

A template is versioned here only if its license allows it; its source and
license are written next to it, in `SOURCE.md` and `manifest.json`.

## Layout of an entry

```
corpus/<id>/
  manifest.json   what to run (below)
  SOURCE.md       where it comes from, its license, how it was captured
  input/          files named on the command line: pages, header-html, footer-html
  www/            files served over HTTP during the bench (CSS, fonts, images)
```

During the bench, `www/` is served at `http://127.0.0.1:<port>/`, and every
occurrence of `http://127.0.0.1:8765` in `input/` and in the text files of
`www/` is replaced by the actual address. `input/` is copied to a temporary
directory whose path has no dot in it: Odoo's header script reads the page
index from the dots of the page's file name.

`manifest.json`:

```json
{
  "id": "odoo17-invoice",
  "title": "Odoo 17 customer invoice, light layout",
  "app": "Odoo 17.0 Community",
  "license": "LGPL-3.0-only",
  "source": "https://github.com/odoo/odoo/blob/17.0/addons/account/views/report_invoice.xml",
  "versioned": true,
  "args": ["--quiet", "--page-size", "A4", "--header-html", "input/header.html", "input/report.body.tmp.0.html", "{out}"],
  "stdin": null,
  "www": ["www", "../_shared/odoo17/www"],
  "httpHeaders": { "/web/assets/": { "Cache-Control": "public, max-age=31536000, immutable" } },
  "notes": "Session cookie argument removed."
}
```

- `args`: the captured argument list; paths are relative to the entry
  directory, the output is `{out}`.
- `stdin`: when the application pipes the page on standard input (pdfkit,
  Frappe), the file to pipe, with `-` left in `args`.
- `www` (optional): the directories served over HTTP, searched in order;
  `["www"]` by default. `corpus/_shared/` holds files common to several entries.
- `httpHeaders` (optional): response headers by path prefix, when the
  application's own headers change the result (Odoo's cache headers do).

## Entries

32 entries; the results of the command come from
`node dist/bench/compat.js` (CI job `compat`).

| Entry | Document | Application | License |
| --- | --- | --- | --- |
| `erpnext15-delivery-note` | ERPNext 15 delivery note, Standard print format, Compact Item Print, no letter head, A4, 3 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-journal-entry` | ERPNext 15 journal entry, Standard print format, Modern print style, Helvetica font, US Letter, 1 page | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-material-request` | ERPNext 15 material request, Standard print format, Classic print style, header and footer not repeated, A4, 2 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-payment-entry` | ERPNext 15 payment entry, Bank and Cash Payment Voucher format, font size 12, letter head in the page, A4, 1 page | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-pos-invoice` | ERPNext 15 POS invoice, POS Invoice format, custom 80 x 200 mm page, no letter head, 3 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-purchase-invoice` | ERPNext 15 purchase invoice, Purchase Auditing Voucher format, Classic print style, letter head in the page, A4, 2 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-purchase-order` | ERPNext 15 purchase order, Standard print format, Monochrome print style, image letter head, US Letter, 3 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-quotation` | ERPNext 15 quotation, Standard print format, Classic print style, US Letter, 1 page | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-request-for-quotation` | ERPNext 15 request for quotation, Standard print format, Monochrome print style, A5, 2 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-sales-invoice` | ERPNext 15 sales invoice, Standard print format, HTML letter head with header and footer, 2 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-sales-invoice-long` | ERPNext 15 sales invoice, Sales Invoice Print format, 32 lines, repeated letter head, A4, 3 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `erpnext15-sales-order` | ERPNext 15 sales order, Standard print format, Modern print style, HTML letter head, A4, 2 pages | Frappe 15.124.0 + ERPNext 15.124.1 | MIT AND GPL-3.0-only AND BSD-3-Clause |
| `odoo17-credit-note` | Odoo 17 credit note with its payment line, Light (standard) layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-delivery-slip` | Odoo 17 delivery slip (validated transfer), Bold layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-inventory-count` | Odoo 17 inventory count sheet, 31 quants (2 pages), Striped layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-invoice` | Odoo 17 customer invoice, 4 lines, Light (standard) layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-invoice-bold-long` | Odoo 17 customer invoice, 38 lines (3 pages), Bold layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-invoice-boxed` | Odoo 17 customer invoice, 4 lines, Boxed layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-invoice-long` | Odoo 17 customer invoice, 30 lines (2 pages), Light (standard) layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-invoices-striped` | Odoo 17 two customer invoices printed together (two body files, 2 pages), Striped layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-payment-receipt` | Odoo 17 payment receipt for two invoices, Striped layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-picking-operations` | Odoo 17 picking operations, 26 lines with barcodes (2 pages), Boxed layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-product-labels` | Odoo 17 product labels, 4 x 7 with price, 32 labels with barcodes (2 pages), A4 label sheet without margins | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-product-labels-dymo` | Odoo 17 Dymo product labels, custom page 57 x 32 mm landscape (3 pages) | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-proforma-landscape` | Odoo 17 pro-forma invoice, A4 landscape, Boxed layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-purchase-order` | Odoo 17 purchase order, 3 lines, Striped layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-quotation-letter` | Odoo 17 quotation, 30 lines with sections and notes (3 pages), US Letter, Light (standard) layout | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-rfq-roboto` | Odoo 17 request for quotation, Bold layout, Roboto font and custom colours | Odoo 17.0 Community | LGPL-3.0-only |
| `odoo17-sale-order` | Odoo 17 sales order, 4 lines, Boxed layout | Odoo 17.0 Community | LGPL-3.0-only |
| `pandoc-node-path` | Node.js v24 path module documentation, pandoc HTML to PDF | pandoc 3.1.3, --pdf-engine=wkhtmltopdf | MIT AND BSD-3-Clause |
| `sylius-credit-memo` | Sylius RefundPlugin credit memo (English), 3 lines | Sylius RefundPlugin (commit 0ca6789a), through knp-snappy | MIT |
| `sylius-invoice` | Sylius InvoicingPlugin invoice (French), 10 lines | Sylius InvoicingPlugin 2.3 (commit 2049602a), through knp-snappy | MIT |
