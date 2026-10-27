"""Details of the corpus entries whose words are not all on the same page:
per page, the median offset and height ratio of the text (bench/compare.py),
and the first and last lines of each PDF. For CI logs, where the PDFs
cannot be looked at.

    python -I bench/detail.py bench/out/compat
"""

import json
import os
import sys

import pymupdf


def median(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if xs else 0


def pages(path):
    """Per page: first and last lines, median font size, median pitch
    between consecutive lines of the same size."""
    out = []
    for page in pymupdf.open(path):
        rows = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if text:
                    rows.append((line["bbox"][1], round(line["spans"][0]["size"], 2), text[:40]))
        rows.sort()
        if not rows:
            out.append(None)
            continue
        pitches = [b[0] - a[0] for a, b in zip(rows, rows[1:]) if a[1] == b[1] and 0 < b[0] - a[0] < 3 * a[1]]
        out.append((rows[0], rows[-1], median([r[1] for r in rows]), median(pitches)))
    return out


root = sys.argv[1]
for entry in sorted(os.listdir(root)):
    result = os.path.join(root, entry, "result.json")
    if not os.path.exists(result):
        continue
    r = json.load(open(result))
    c = r.get("comparison")
    if not c or c["same_page"]["same_page"] >= 0.999:
        continue
    print(f"== {entry}: {100 * c['same_page']['same_page']:.1f} % of the words on the same page, pages {c['pages']}")
    for p in c["per_page"]:
        t = p.get("text") or {}
        print(f"  page {p['page']}: median gap {t.get('median', 0):.1f} mm, dy {t.get('dy', 0):.1f}, height ratio {t.get('height_ratio', 0):.3f}")
    for name in ("a", "b"):
        for i, e in enumerate(pages(c[name])):
            if e:
                first, last, size, pitch = e
                print(f"  {'wk' if name == 'a' else 'kiln'} p{i + 1}: size {size} pt, pitch {pitch:.2f} pt, {first[0]:.0f} {first[2]!r} ... {last[0]:.0f} {last[2]!r}")
