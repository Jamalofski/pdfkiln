"""Dump the outline (bookmarks) of a PDF as JSON, with where each entry points.

    python -I bench/toc.py file.pdf

For each entry: level, title, target page, target y in mm from the top of the
page, and the y of the first line on that page whose text starts like the
title (None if not found), to check where the bookmark lands.
"""

import json
import sys

import pymupdf

PT_TO_MM = 25.4 / 72


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # titles hold emoji; Windows defaults to cp1252
    doc = pymupdf.open(sys.argv[1])
    out = []
    for level, title, page, dest in doc.get_toc(simple=False):
        y = None
        to = dest.get("to")
        if to is not None and page >= 1:
            # PyMuPDF gives an explicit destination from the top of the page,
            # a named one (wkhtmltopdf's) in PDF coordinates, from the bottom.
            top = doc[page - 1].rect.height - to.y if dest.get("nameddest") else to.y
            y = round(top * PT_TO_MM, 1)
        found = None
        if page >= 1:
            first = title.split()[0] if title.split() else ""
            for line in doc[page - 1].get_text("dict")["blocks"]:
                for l in line.get("lines", []):
                    text = "".join(s["text"] for s in l["spans"]).strip()
                    if first and text.startswith(first):
                        found = round(l["bbox"][1] * PT_TO_MM, 1)
                        break
                if found is not None:
                    break
        out.append({"level": level, "title": title, "page": page, "y": y, "text_y": found})
    json.dump({"pages": doc.page_count, "outline": out, "tagged": doc.pdf_catalog() and "StructTreeRoot" in doc.xref_object(doc.pdf_catalog())}, sys.stdout, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
