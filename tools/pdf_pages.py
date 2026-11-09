r"""
pdf_pages.py - render PDF pages to PNG so Claude can LOOK at the report layout.
    .venv\Scripts\python tools\pdf_pages.py round1\doc\report.pdf          -> round1\doc\pages\page01.png ...
"""
import sys
from pathlib import Path

import pymupdf as fitz

pdf = Path(sys.argv[1])
out = pdf.parent / "pages"
out.mkdir(exist_ok=True)
for old in out.glob("page*.png"):
    old.unlink()
doc = fitz.open(pdf)
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=80).save(out / f"page{i:02d}.png")
print(f"OK  {len(doc)} pages -> {out}")
