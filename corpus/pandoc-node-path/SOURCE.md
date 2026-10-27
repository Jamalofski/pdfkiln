# pandoc-node-path

- **Text**: `doc/api/path.md` of [nodejs/node](https://github.com/nodejs/node), branch
  v24.x, fetched on 23 Oct 2026 (copy in `path.md`). License: MIT (Node.js `LICENSE`,
  "Copyright Node.js contributors").
- **HTML template and CSS**: pandoc 3.1.3's default `html5` template and styles,
  embedded in the HTML by `pandoc -s`. License: the pandoc templates are dual-licensed
  GPL-2.0-or-later and BSD-3-Clause; used here under BSD-3-Clause.
- **How it was captured**: `LANG=C.UTF-8 pandoc path.md -s --pdf-engine=wkhtmltopdf --metadata title="Node.js v24 — path" --toc -o path.pdf`
  with `bench/capture/wkhtmltopdf-shim.py` installed as `wkhtmltopdf`. pandoc wrote the
  page to `toPdfViaTempFile<pid>-0.html` and passed its margin defaults (1.25 in, bottom
  1.2 in) and `--enable-local-file-access`.
- **wkhtmltopdf 0.12.6**: 8 pages.
