#!/usr/bin/env python3
"""Keep the header and footer identical across every page.

There is no build step here: the .html files at the repository root are the source,
and that is deliberate — anyone can open one and read exactly what ships. The cost of
that choice is that the navigation appears ten times, so a new page or a renamed link
has to be made ten times or the site quietly develops two different navigations.

This script removes that cost without introducing a build. It takes the header and
footer from index.html and writes them into every other page, touching nothing else.

    python3 tools/sync-shell.py          # rewrite the other pages
    python3 tools/sync-shell.py --check  # report drift and exit 1, for CI

The block boundaries are the literal <header class="top"> … </header> and
<footer> … </footer> markers, so a page that has been restructured beyond those is
reported rather than repaired.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "index.html"
CHECK = "--check" in sys.argv

HEADER = re.compile(r'<header class="top">.*?</header>', re.S)
FOOTER = re.compile(r"<footer>.*?</footer>", re.S)


def block(pattern, text, what, name):
    m = pattern.search(text)
    if not m:
        print(f"  !! {name}: no {what} block found")
        return None
    return m.group(0)


src = SOURCE.read_text(encoding="utf-8")
head = block(HEADER, src, "header", SOURCE.name)
foot = block(FOOTER, src, "footer", SOURCE.name)
if head is None or foot is None:
    sys.exit(2)

drift, fixed = [], []
for page in sorted(ROOT.glob("*.html")):
    if page.name == SOURCE.name:
        continue
    text = page.read_text(encoding="utf-8")
    cur_head = block(HEADER, text, "header", page.name)
    cur_foot = block(FOOTER, text, "footer", page.name)
    if cur_head is None or cur_foot is None:
        drift.append(page.name)
        continue
    if cur_head == head and cur_foot == foot:
        continue
    if CHECK:
        drift.append(page.name)
        continue
    text = HEADER.sub(lambda _: head, text, count=1)
    text = FOOTER.sub(lambda _: foot, text, count=1)
    page.write_text(text, encoding="utf-8")
    fixed.append(page.name)

if CHECK:
    if drift:
        print("shell drift in: " + ", ".join(drift))
        sys.exit(1)
    print("OK: header and footer are identical on every page.")
else:
    print("synced: " + (", ".join(fixed) if fixed else "nothing to do"))
