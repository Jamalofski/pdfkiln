"""Font metrics of two PDFs of bench/gdi.ts, in CSS pixels.

For each family and size: the pitch of its lines, the font size written
in the PDF, and the size the glyphs are drawn at, from the ink height of
the "H" that starts each line, against its ink in pdfkiln's PDF, whose
glyphs are the font's own (wkhtmltopdf's copy may be scaled).

    python -I bench/gdi.py wk.pdf pdfkiln.pdf
"""
import json
import sys
from collections import defaultdict

import pymupdf

ZOOM = 20  # pixels per point, to measure ink
PT = 0.75  # points per CSS pixel


def median(xs):
    return sorted(xs)[len(xs) // 2]


def lines(path):
    d = pymupdf.open(path)
    found = defaultdict(list)
    for n, page in enumerate(d):
        for t in page.get_texttrace():
            text = "".join(chr(c[0]) for c in t["chars"])
            if not text.startswith("H ") or text.count("|") != 2:
                continue
            family, px, _ = text[2:].split("|")
            found[(family, int(px))].append({"page": n, "h": t["chars"][0], "size": t["size"]})
    for key, ls in found.items():
        # Between lines of one page: a block may straddle a page break.
        pairs = [(a, b) for a, b in zip(ls, ls[1:]) if a["page"] == b["page"]]
        if not pairs:
            continue
        pitch = median([b["h"][2][1] - a["h"][2][1] for a, b in pairs])
        # A line under one of its block: the line above is one pitch away.
        line = pairs[0][1]
        page = d[line["page"]]
        x0, _, x1, _ = line["h"][3]
        base = line["h"][2][1]
        # From the line above to the baseline: the "H" alone.
        clip = pymupdf.Rect(x0, base - 0.95 * pitch, x1, base + 0.3)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip, colorspace=pymupdf.csGRAY)
        rows = [y for y in range(pix.height) if any(pix.pixel(x, y)[0] < 128 for x in range(pix.width))]
        line["pitch"] = pitch
        line["ink"] = (rows[-1] - rows[0] + 1) / ZOOM if rows else 0
        found[key] = line
    return {k: v for k, v in found.items() if isinstance(v, dict)}


wk, kiln = lines(sys.argv[1]), lines(sys.argv[2])
out = []
for key in sorted(wk, key=lambda k: (k[0], k[1])):
    family, px = key
    a, b = wk[key], kiln.get(key)
    if not b:
        continue
    # The drawn size: the cap height measured on the page, over the same
    # ratio measured in pdfkiln's PDF, whose glyphs are the font's own.
    ratio = b["ink"] / b["size"] if b["size"] else 0
    out.append({
        "family": family, "px": px,
        "wkPitch": round(a["pitch"] / PT, 2), "kilnPitch": round(b["pitch"] / PT, 2),
        "wkSize": round(a["size"] / PT, 2), "kilnSize": round(b["size"] / PT, 2),
        "wkDrawn": round(a["ink"] / ratio / PT, 2) if ratio else None,
        "kilnDrawn": round(b["ink"] / ratio / PT, 2) if ratio else None,
    })
json.dump(out, sys.stdout)
