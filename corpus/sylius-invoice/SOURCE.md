# sylius-invoice

- **Template**: `templates/shared/download/pdf.html.twig` and `pdf_layout.html.twig` of
  [Sylius/InvoicingPlugin](https://github.com/Sylius/InvoicingPlugin), branch 2.3,
  commit `2049602a64426f90ea43ebbb0e90cf5d8ebd0d5c` (8 Oct 2026). The plugin generates
  its PDF invoices with wkhtmltopdf through KnpSnappyBundle.
- **License**: MIT, Copyright (c) 2018-present Sylius Sp. z o.o. Applies to the
  template, the French labels (`translations/messages.fr.yml`) and `sylius-logo.png`
  (`assets/sylius-logo.png`).
- **Data**: made up for the corpus (customer, products, prices).
- **How it was made**: `php render.php <dir holding the inv/ and refund/ clones> <out dir>`
  with twig/twig 3.30 and symfony/yaml 7; `render.php` stands in for the plugin's
  `TwigToPdfGenerator` (template, logo path, translations). The Sylius core labels
  (`sylius.ui.name`...) are copied by hand into `render.php`.
- **Command line**: knp-snappy's `Pdf` generator always adds `--lowquality`, then the
  plugin's `allow` option for the logo, then the temporary HTML file and the output.
