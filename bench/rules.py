"""Horizontal rules of each page of a PDF (the borders of a table), in CSS
pixels from the top of the content, as JSON: one list per page.

    python -I bench/rules.py file.pdf <top margin in mm>
"""
import json
import sys

import pymupdf

top = float(sys.argv[2]) / 25.4 * 72
out = []
for page in pymupdf.open(sys.argv[1]):
    ys = set()
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l" and abs(item[1].y - item[2].y) < 0.01 and abs(item[1].x - item[2].x) > 100:
                ys.add(round(item[1].y, 2))
            if item[0] == "re" and item[1].height < 2 and item[1].width > 100:
                ys.add(round(item[1].y0, 2))
    ys = sorted(ys)
    # The two edges of one border are one rule.
    merged = [y for i, y in enumerate(ys) if not i or y - ys[i - 1] > 1.5]
    out.append([round((y - top) * 96 / 72) for y in merged])
json.dump(out, sys.stdout)
