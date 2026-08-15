#!/usr/bin/env python3
"""Generate mahjong tile PNG sprites (2x resolution: 96x128) for the Godot client.

Output: apps/player-client/assets/tiles/{wan,tong,tiao}_{1..9}.png,
        honor_{dong,nan,xi,bei,zhong,fa,bai}.png,
        flower_{mei,lan,zhu,ju,chun,xia,qiu,dong}.png, back.png

Uses the bundled Noto Sans CJK TC font so Chinese glyphs render crisply.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO, "apps", "player-client", "assets", "tiles")
FONT_PATH = os.path.join(REPO, "apps", "player-client", "assets", "fonts",
                         "NotoSansCJKtc-Regular.otf")

W, H = 96, 128          # 2x of 48x64
MARGIN = 6              # outer ivory margin
RAD = 12                # corner radius (2x)
IVORY = (250, 248, 245, 255)
IVORY_EDGE = (214, 208, 196, 255)
BORDER = (176, 138, 44, 255)      # gold
NAVY = (16, 42, 74, 255)          # tile back
NAVY_DEEP = (10, 30, 56, 255)

# Colors for pips / characters
RED = (190, 30, 30, 255)
GREEN = (20, 110, 60, 255)
BLUE = (24, 60, 130, 255)
BLACK = (40, 34, 28, 255)

_FONT_CACHE = {}

def font(size: int):
    if size not in _FONT_CACHE:
        _FONT_CACHE[size] = ImageFont.truetype(FONT_PATH, size)
    return _FONT_CACHE[size]


def rounded_tile(draw, box, fill=IVORY, outline=BORDER, outline_w=3, radius=RAD):
    draw.rounded_rectangle(box, radius=radius, fill=fill,
                           outline=outline, width=outline_w)


def text_centered(draw, cx, cy, s, size, fill, dy=0):
    f = font(size)
    bbox = draw.textbbox((0, 0), s, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = cx - tw / 2 - bbox[0]
    y = cy - th / 2 - bbox[1] + dy
    draw.text((x, y), s, font=f, fill=fill)


def draw_circles(img, pattern):
    """pattern: list of (col, row) in a 3x4 grid (col 0-2, row 0-3)."""
    d = ImageDraw.Draw(img)
    r = 10
    for col, row in pattern:
        cx = W / 2 + (col - 1) * 17
        cy = H / 2 + (row - 1.5) * 17
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)
        d.ellipse([cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3],
                  fill=(240, 210, 200, 255))


CIRCLE_PATTERNS = {
    1: [(1, 2)],
    2: [(0, 1), (2, 3)],
    3: [(0, 1), (1, 2), (2, 3)],
    4: [(0, 1), (2, 1), (0, 3), (2, 3)],
    5: [(0, 1), (2, 1), (1, 2), (0, 3), (2, 3)],
    6: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3)],
    7: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3), (1, 1)],
    8: [(0, 1), (0, 2), (0, 3), (0, 4), (2, 1), (2, 2), (2, 3), (2, 4)],
    9: [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
}


def draw_bamboo(img, pattern):
    """pattern: list of (col, row) — each is a bamboo stick."""
    d = ImageDraw.Draw(img)
    for col, row in pattern:
        cx = W / 2 + (col - 1) * 17
        cy = H / 2 + (row - 1.5) * 17
        # stick
        d.rounded_rectangle([cx - 4, cy - 12, cx + 4, cy + 12], radius=4,
                            fill=GREEN)
        # leaf notches
        d.line([cx - 4, cy - 8, cx - 10, cy - 2], fill=GREEN, width=3)
        d.line([cx + 4, cy - 4, cx + 10, cy + 4], fill=GREEN, width=3)


BAMBOO_PATTERNS = {
    1: [(1, 2)],
    2: [(0, 1), (2, 3)],
    3: [(0, 1), (1, 2), (2, 3)],
    4: [(0, 1), (2, 1), (0, 3), (2, 3)],
    5: [(0, 1), (2, 1), (1, 2), (0, 3), (2, 3)],
    6: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3)],
    7: [(0, 1), (0, 2), (0, 3), (2, 1), (2, 2), (2, 3), (1, 1)],
    8: [(0, 1), (0, 2), (0, 3), (0, 4), (2, 1), (2, 2), (2, 3), (2, 4)],
    9: [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
}


def make_face(tile_id, n, kind):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN])
    # subtle inner frame
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(226, 220, 206, 255), outline_w=2, radius=RAD - 4)

    if kind == "wan":
        cn = "一二三四五六七八九"[n - 1]
        text_centered(d, W / 2, H / 2 - 14, cn, 52, BLUE)
        text_centered(d, W / 2, H / 2 + 26, "萬", 30, RED)
    elif kind == "tong":
        draw_circles(img, CIRCLE_PATTERNS[n])
    elif kind == "tiao":
        draw_bamboo(img, BAMBOO_PATTERNS[n])
    return img


def make_honor(key):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN])
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(226, 220, 206, 255), outline_w=2, radius=RAD - 4)
    char, color = {
        "dong": ("東", GREEN),
        "nan": ("南", RED),
        "xi": ("西", GREEN),
        "bei": ("北", BLUE),
        "zhong": ("中", RED),
        "fa": ("發", GREEN),
        "bai": ("白", BLUE),
    }[key]
    text_centered(d, W / 2, H / 2, char, 58, color)
    if key == "bai":
        # 白板：藍色方框框住「白」字
        d.rectangle([W / 2 - 26, H / 2 - 32, W / 2 + 26, H / 2 + 32],
                    outline=BLUE, width=5)
    return img


def make_flower(key):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN],
                 fill=(252, 246, 238, 255))
    rounded_tile(d, [MARGIN + 6, MARGIN + 6, W - MARGIN - 6, H - MARGIN - 6],
                 outline=(232, 170, 60, 255), outline_w=3, radius=RAD - 4)
    char = {"mei": "梅", "lan": "蘭", "zhu": "竹", "ju": "菊",
            "chun": "春", "xia": "夏", "qiu": "秋", "dong": "冬"}[key]
    text_centered(d, W / 2, H / 2, char, 58, RED)
    return img


def make_back():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded_tile(d, [MARGIN, MARGIN, W - MARGIN, H - MARGIN], fill=NAVY,
                 outline=BORDER, outline_w=4)
    rounded_tile(d, [MARGIN + 10, MARGIN + 10, W - MARGIN - 10, H - MARGIN - 10],
                 outline=(212, 175, 55, 255), outline_w=2, radius=RAD - 6)
    # gold diagonal lattice in the middle band (雀魂-style tile back)
    band_top, band_bot = H / 2 - 16, H / 2 + 16
    for i in range(-3, 4):
        x = W / 2 + i * 16
        d.line([x, band_top, x, band_bot], fill=(60, 96, 140, 255), width=2)
        d.line([x + 8, band_top, x - 8, band_bot],
               fill=(40, 70, 110, 255), width=2)
    d.rounded_rectangle([W / 2 - 12, H / 2 - 12, W / 2 + 12, H / 2 + 12],
                        radius=4, outline=(212, 175, 55, 255), width=3)
    d.rectangle([W / 2 - 5, H / 2 - 5, W / 2 + 5, H / 2 + 5], fill=(212, 175, 55, 255))
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    n = 0
    for kind in ("wan", "tong", "tiao"):
        for num in range(1, 10):
            img = make_face(f"{kind}:{num}", num, kind)
            img.save(os.path.join(OUT_DIR, f"{kind}_{num}.png"))
            n += 1
    for key in ("dong", "nan", "xi", "bei", "zhong", "fa", "bai"):
        img = make_honor(key)
        img.save(os.path.join(OUT_DIR, f"honor_{key}.png"))
        n += 1
    for key in ("mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"):
        img = make_flower(key)
        img.save(os.path.join(OUT_DIR, f"flower_{key}.png"))
        n += 1
    make_back().save(os.path.join(OUT_DIR, "back.png"))
    n += 1
    print(f"Generated {n} tiles -> {OUT_DIR}")


if __name__ == "__main__":
    main()
