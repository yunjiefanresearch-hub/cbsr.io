#!/usr/bin/env python3
"""
Regenerate og-card.png: the social preview card.

Why this exists as a script and not a hand-made PNG: the card states a dated legal
claim. When the GENIUS Act's effective date resolves (it commences on the EARLIER of
2027-01-18 or 120 days after final rules issue), the card is wrong until it is redrawn.
This makes that a one-line command instead of a design task.

    # default: the corrected, cap-aware line
    python tools/make_og_card.py

    # the day final rules issue, e.g. effective 2026-11-14:
    python tools/make_og_card.py --gate-line "-> Category II on 14 Nov 2026, when GENIUS Act 18 commences"

    # writes both copies at once
    python tools/make_og_card.py --out og-card.png --also ../cbsr-mapper/public/og-card.png

FONTS: uses IBM Plex Sans / IBM Plex Mono when installed (matching the site), and falls
back to DejaVu otherwise. For pixel-fidelity with the original design, install IBM Plex:
    Debian/Ubuntu:  sudo apt-get install fonts-ibm-plex
    macOS:          brew install --cask font-ibm-plex
    or download:    https://github.com/IBM/plex/releases
Then re-run. The layout is identical either way; only the letterforms differ.
"""
from __future__ import annotations
import argparse, sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG        = "#EDEFEB"
INK       = "#191B17"
NAVY      = "#1F3A5F"
GREEN     = "#2E7D46"
AMBER     = "#B26B12"
GREY      = "#6E7370"
GREY_DIM  = "#8A8F8B"
CARD_BG   = "#FBFCFA"
RULE      = "#D8DCD6"

FONT_CANDIDATES = {
    "sans_bold": ["IBMPlexSans-Bold.ttf", "IBMPlexSans-SemiBold.ttf", "DejaVuSans-Bold.ttf"],
    "sans":      ["IBMPlexSans-Regular.ttf", "DejaVuSans.ttf"],
    "mono_bold": ["IBMPlexMono-Bold.ttf", "IBMPlexMono-SemiBold.ttf", "DejaVuSansMono-Bold.ttf"],
    "mono":      ["IBMPlexMono-Regular.ttf", "DejaVuSansMono.ttf"],
}
SEARCH_DIRS = [
    "/usr/share/fonts/truetype/ibm-plex/", "/usr/share/fonts/opentype/ibm-plex/",
    "/usr/share/fonts/truetype/dejavu/", "/Library/Fonts/", "/System/Library/Fonts/",
    "./fonts/",
]

_used_plex = {"v": False}

def load(kind: str, size: int):
    import os
    for name in FONT_CANDIDATES[kind]:
        for d in SEARCH_DIRS:
            p = os.path.join(d, name)
            if os.path.exists(p):
                if "Plex" in name:
                    _used_plex["v"] = True
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def tw(d, text, font):
    return d.textbbox((0, 0), text, font=font)[2]

def fit(d, text, kind, start, max_w, floor=11):
    """Shrink until the string fits: so a longer, more accurate legal line never overflows."""
    for s in range(start, floor - 1, -1):
        f = load(kind, s)
        if tw(d, text, f) <= max_w:
            return f
    return load(kind, floor)

def tracked(d, xy, text, font, fill, track=1.6):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += tw(d, ch, font) + track

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-line", default="-> Category II on the earlier of 18 Jan 2027 or 120 days after final rules",
                    help="the dated claim under EU -> US. Uses '->' which is drawn as an arrow.")
    ap.add_argument("--version", default="v0.10.1")
    ap.add_argument("--doi", default="DOI 10.5281/zenodo.20730358")
    ap.add_argument("--stats", default="12 jurisdictions  ·  15 dimensions  ·  152 records  ·  46 citable  ·  132 directed corridors")
    ap.add_argument("--out", default="og-card.png")
    ap.add_argument("--also", default=None, help="write a second identical copy here")
    a = ap.parse_args()

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, 7, H], fill=INK)                       # left spine

    tracked(d, (74, 56), "CROSS-BORDER STABLECOIN REGISTER", load("mono", 15), GREY, 1.7)

    d.text((72, 100), "Same border. Two answers.", font=load("sans_bold", 46), fill=INK)
    d.text((72, 163), "One of them has a date.",   font=load("sans_bold", 46), fill=NAVY)

    d.rounded_rectangle([75, 252, 1127, 471], radius=10, fill=CARD_BG, outline=RULE, width=1)

    mono_b26 = load("mono_bold", 26)
    mono_b24 = load("mono_bold", 24)
    sans17   = load("sans", 17)

    # --- row 1: US -> EU
    d.text((110, 283), "US", font=mono_b26, fill=INK)
    d.text((163, 286), "\u2192", font=load("sans", 22), fill=GREY_DIM)
    d.text((196, 283), "EU", font=mono_b26, fill=INK)
    d.ellipse([358, 294, 372, 308], fill=GREEN)
    d.text((385, 283), "Category I", font=mono_b24, fill=GREEN)
    d.text((385, 322), "clears today", font=sans17, fill=GREY)

    d.line([100, 357, 1102, 357], fill=RULE, width=1)

    # --- row 2: EU -> US
    d.text((110, 381), "EU", font=mono_b26, fill=INK)
    d.text((163, 384), "\u2192", font=load("sans", 22), fill=GREY_DIM)
    d.text((196, 381), "US", font=mono_b26, fill=INK)
    d.ellipse([358, 392, 372, 406], fill=GREY_DIM)
    d.text((385, 381), "Category T", font=mono_b24, fill=GREY)
    d.text((385, 420), "in transition today", font=sans17, fill=GREY)

    # --- the dated claim (auto-fits; amber head, grey tail)
    line = a.gate_line.strip()
    if line.startswith("->"):
        line = "\u2192" + line[2:]
    head, tail = (line, "")
    for marker in (" on ", " when ", ", "):
        if marker in line:
            i = line.index(marker)
            head, tail = line[:i], line[i:]
            break
    f = fit(d, head + tail, "sans", 17, 1102 - 385)
    d.text((385, 450), head, font=f, fill=AMBER)
    d.text((385 + tw(d, head, f), 450), tail, font=f, fill=GREY)

    # --- footer
    d.line([74, 528, 1127, 528], fill=RULE, width=1)
    d.text((74, 546), a.stats, font=fit(d, a.stats, "mono", 15, 1053), fill=GREY)
    foot2 = f"{a.version}  ·  open data, CC-BY-4.0  ·  {a.doi}"
    d.text((74, 576), foot2, font=fit(d, foot2, "mono", 15, 1053), fill=GREY)

    img.save(a.out, "PNG", optimize=True)
    outs = [a.out]
    if a.also:
        img.save(a.also, "PNG", optimize=True)
        outs.append(a.also)
    print("wrote: " + ", ".join(outs))
    if not _used_plex["v"]:
        print("NOTE: IBM Plex not found: rendered with a fallback face. Install fonts-ibm-plex "
              "and re-run for typography matching the site.", file=sys.stderr)

if __name__ == "__main__":
    main()
