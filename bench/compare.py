"""Compare two PDFs: page count and size, text position page by page, image gap.

    python -I bench/compare.py reference.pdf candidate.pdf [--diff-dir DIR]

Prints one JSON object. Lengths are in millimetres.

Text position: the words of page i in both files are aligned in reading
order (difflib on the word strings); for each matched word, the gap is the
distance between the top-left corners of its two boxes. A page's gap is the
90th percentile of its words' gaps.

Image gap: both pages are rendered in grey at DPI dots per inch; the gap is
the share of pixels whose grey level differs by more than THRESHOLD (0-255).
"""

import argparse
import difflib
import json
import math
import sys

import numpy as np
import pymupdf

PT_TO_MM = 25.4 / 72
DPI = 50
THRESHOLD = 64


def words(page):
    # (x0, y0, x1, y1, text, block, line, word)
    return page.get_text("words", sort=True)


def percentile(values, q):
    return float(np.percentile(values, q)) if values else None


def text_gap(page_a, page_b):
    wa, wb = words(page_a), words(page_b)
    sm = difflib.SequenceMatcher(None, [w[4] for w in wa], [w[4] for w in wb], autojunk=False)
    gaps, dxs, dys, ratios = [], [], [], []
    for block in sm.get_matching_blocks():
        for k in range(block.size):
            a, b = wa[block.a + k], wb[block.b + k]
            gaps.append(math.hypot(a[0] - b[0], a[1] - b[1]) * PT_TO_MM)
            dxs.append((b[0] - a[0]) * PT_TO_MM)
            dys.append((b[1] - a[1]) * PT_TO_MM)
            ha, hb = a[3] - a[1], b[3] - b[1]
            if hb > 0:
                ratios.append(ha / hb)
    return {
        "words": [len(wa), len(wb)],
        "matched": len(gaps),
        "median": percentile(gaps, 50),
        "p90": percentile(gaps, 90),
        "max": max(gaps) if gaps else None,
        # Signed median offsets of the candidate against the reference.
        "dx": percentile(dxs, 50),
        "dy": percentile(dys, 50),
        "height_ratio": percentile(ratios, 50),
    }


def same_page_share(doc_a, doc_b):
    """Share of the words found in both documents that sit on the same page number."""
    wa = [(i, w[4]) for i, p in enumerate(doc_a) for w in words(p)]
    wb = [(i, w[4]) for i, p in enumerate(doc_b) for w in words(p)]
    sm = difflib.SequenceMatcher(None, [w[1] for w in wa], [w[1] for w in wb], autojunk=False)
    same = total = 0
    for block in sm.get_matching_blocks():
        for k in range(block.size):
            total += 1
            same += wa[block.a + k][0] == wb[block.b + k][0]
    return {"matched": total, "words": [len(wa), len(wb)], "same_page": same / total if total else None}


def grey(page):
    pix = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)


def image_gap(page_a, page_b, diff_path=None):
    a, b = grey(page_a), grey(page_b)
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    a, b = a[:h, :w], b[:h, :w]
    diff = np.abs(a.astype(np.int16) - b.astype(np.int16))
    if diff_path:
        # Reference in red, candidate in cyan: grey where they agree.
        rgb = np.stack([a, b, b], axis=2).astype(np.uint8)
        pymupdf.Pixmap(pymupdf.csRGB, w, h, rgb.tobytes(), False).save(diff_path)
    return {"share": float((diff > THRESHOLD).mean()), "mean": float(diff.mean())}


def compare(path_a, path_b, diff_dir=None):
    doc_a, doc_b = pymupdf.open(path_a), pymupdf.open(path_b)
    pages = []
    for i in range(min(doc_a.page_count, doc_b.page_count)):
        pa, pb = doc_a[i], doc_b[i]
        diff_path = f"{diff_dir}/page-{i + 1}.png" if diff_dir else None
        pages.append({
            "page": i + 1,
            "size_a": [round(pa.rect.width * PT_TO_MM, 2), round(pa.rect.height * PT_TO_MM, 2)],
            "size_b": [round(pb.rect.width * PT_TO_MM, 2), round(pb.rect.height * PT_TO_MM, 2)],
            "text": text_gap(pa, pb),
            "image": image_gap(pa, pb, diff_path),
        })
    return {
        "a": path_a,
        "b": path_b,
        "pages": [doc_a.page_count, doc_b.page_count],
        "same_page": same_page_share(doc_a, doc_b),
        "per_page": pages,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("a")
    parser.add_argument("b")
    parser.add_argument("--diff-dir")
    args = parser.parse_args()
    json.dump(compare(args.a, args.b, args.diff_dir), sys.stdout)
    print()


if __name__ == "__main__":
    main()
