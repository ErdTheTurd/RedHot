#!/usr/bin/env python3
"""Generate unique PNG art for every vehicle, warhead, accessory, and domain crate/key."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VEH = ROOT / "assets" / "vehicles"
GEAR = ROOT / "assets" / "gear"
CASES = ROOT / "assets" / "cases"
KEYS = ROOT / "assets" / "keys"

RARITY_RGB = {
    "consumer": (176, 195, 217),
    "industrial": (94, 152, 217),
    "milspec": (75, 105, 255),
    "restricted": (136, 71, 255),
    "classified": (211, 44, 230),
    "covert": (235, 75, 75),
    "extraordinary": (228, 174, 57),
}

VEHICLES = [
    # id, name, domain, style, color hex int, rarity
    ("scout_tracker", "Scout Tracker", "land", "scout", 0x6B7C3A, "consumer"),
    ("apc_crusher", "APC Crusher", "land", "apc", 0x5A6A40, "industrial"),
    ("mbt_anvil", "MBT Anvil", "land", "mbt", 0x4F5D34, "milspec"),
    ("siege_titan", "Siege Titan", "land", "titan", 0x3D4528, "restricted"),
    ("dune_raider", "Dune Raider", "land", "raider", 0xC2A46B, "milspec"),
    ("frost_plow", "Frost Plow", "land", "frost", 0xD8E2EA, "classified"),
    ("night_fang", "Night Fang", "land", "fang", 0x1A1018, "covert"),
    ("coastal_skiff", "Coastal Skiff", "sea", "skiff", 0x3A6B7C, "consumer"),
    ("patrol_cutter", "Patrol Cutter", "sea", "cutter", 0x2F5F74, "industrial"),
    ("destroyer_hull", "Destroyer Hull", "sea", "destroyer", 0x24566A, "milspec"),
    ("battleship_kronos", "Battleship Kronos", "sea", "battleship", 0x1A3F50, "restricted"),
    ("hydro_lance", "Hydro Lance", "sea", "hydro", 0x3AA0B8, "milspec"),
    ("blackwater_keel", "Blackwater Keel", "sea", "keel", 0x0A2030, "classified"),
    ("leviathan_crown", "Leviathan Crown", "sea", "leviathan", 0x102838, "extraordinary"),
    ("wasp_drone", "Wasp Drone", "air", "wasp", 0x7C6B3A, "consumer"),
    ("falcon_interceptor", "Falcon Interceptor", "air", "falcon", 0x8A7040, "industrial"),
    ("raptor_strike", "Raptor Strike", "air", "raptor", 0x7A5A30, "milspec"),
    ("stealth_bomber", "Stealth Bomber", "air", "stealth", 0x2A2E35, "restricted"),
    ("needle_dart", "Needle Dart", "air", "dart", 0xA0C8FF, "milspec"),
    ("howler_gunship", "Howler Gunship", "air", "gunship", 0x6A4030, "classified"),
    ("eclipse_wing", "Eclipse Wing", "air", "eclipse", 0x101018, "extraordinary"),
]

WARHEADS = [
    ("ammo_belt", "Ammo Belt", "ORD", (200, 160, 96), "consumer"),
    ("mag_crate", "Magazine Crate", "ORD", (94, 152, 217), "industrial"),
    ("bomb_rack", "Bomb Rack", "ORD", (75, 105, 255), "milspec"),
    ("torpedo_rack", "Torpedo Rack", "ORD", (47, 143, 107), "milspec"),
    ("landmine_pack", "Landmine Pack", "ORD", (136, 71, 255), "restricted"),
    ("ap_rounds", "AP Rounds", "ORD", (211, 44, 230), "restricted"),
    ("incendiary_shells", "Incendiary", "ORD", (235, 75, 75), "classified"),
    ("depth_charge", "Depth Charge", "ORD", (29, 155, 240), "classified"),
    ("cluster_bombs", "Cluster Bombs", "ORD", (232, 93, 4), "covert"),
    ("warhead_core", "Warhead Core", "ORD", (228, 174, 57), "extraordinary"),
]

ACCESSORIES = [
    ("mine_detector", "Mine Detector", "MOD", (75, 105, 255), "milspec"),
    ("tuned_engines", "Tuned Engines", "MOD", (29, 155, 240), "milspec"),
    ("reinforced_plating", "Reinforced Plating", "MOD", (136, 71, 255), "restricted"),
    ("quick_loader", "Quick Loader", "MOD", (211, 44, 230), "restricted"),
    ("extended_mag", "Extended Mag", "MOD", (94, 152, 217), "industrial"),
    ("bomb_bay_ext", "Bomb Bay", "MOD", (235, 75, 75), "classified"),
    ("heavy_tubes", "Heavy Tubes", "MOD", (47, 143, 107), "classified"),
    ("targeting_scope", "Targeting Scope", "MOD", (200, 160, 96), "milspec"),
    ("jump_boosters", "Jump Boosters", "MOD", (255, 138, 26), "restricted"),
    ("reactive_shield", "Reactive Shield", "MOD", (228, 174, 57), "covert"),
]


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(v)))

def safe_box(x0, y0, x1, y1):
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]



def rgb_from_int(n: int):
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def shade(c, amount):
    return tuple(clamp(ch + amount) for ch in c)


def noise_hash(i: float) -> float:
    x = math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def try_font(size):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def vignette(img, strength=0.5):
    size = img.size[0]
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i in range(36):
        a = int(strength * 210 * (i / 36) ** 1.4)
        m = int(size * 0.014 * i)
        if size - m <= m:
            break
        d.rectangle([m, m, size - m - 1, size - m - 1], outline=(0, 0, 0, a))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def stamp_label(img, lines, color, y=430):
    draw = ImageDraw.Draw(img)
    font = try_font(26)
    small = try_font(15)
    w, _ = img.size
    for i, line in enumerate(lines):
        f = font if i == 0 else small
        bbox = draw.textbbox((0, 0), line, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw) / 2 + 1, y + i * 26 + 1), line, font=f, fill=(0, 0, 0))
        draw.text(((w - tw) / 2, y + i * 26), line, font=f, fill=color)


def radial_bg(size, inner, outer, cx=0.5, cy=0.42, seed=1):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            dx = x / size - cx
            dy = y / size - cy
            d = math.sqrt(dx * dx + dy * dy) / 0.9
            n = noise_hash(x * 0.07 + y * 0.11 + seed) * 0.1
            t = max(0.0, min(1.0, d + n))
            px[x, y] = mix(inner, outer, t)
    return img


def rarity_rails(draw, size, rarity):
    accent = RARITY_RGB.get(rarity, (176, 195, 217))
    rail = max(6, size // 18)
    draw.rectangle([0, size - rail, size, size], fill=accent)
    draw.rectangle([0, 0, max(4, size // 55), size], fill=accent)
    return accent


# ─── Vehicle silhouettes ─────────────────────────────────────────────────────

def draw_tank(draw, style, body, accent, cx, cy, s):
    dark = shade(body, -40)
    light = shade(body, 35)
    # tracks
    draw.rounded_rectangle([cx - s * 0.38, cy + s * 0.1, cx + s * 0.38, cy + s * 0.28], radius=10, fill=(20, 20, 22), outline=dark, width=2)
    for i in range(6):
        x = cx - s * 0.3 + i * s * 0.12
        draw.ellipse([x - 8, cy + s * 0.14, x + 8, cy + s * 0.24], outline=accent, width=2)

    if style == "scout":
        draw.rounded_rectangle([cx - s * 0.28, cy - s * 0.02, cx + s * 0.28, cy + s * 0.14], radius=8, fill=body, outline=light, width=2)
        draw.ellipse([cx - s * 0.12, cy - s * 0.12, cx + s * 0.12, cy + s * 0.04], fill=light, outline=dark, width=2)
        draw.rectangle(safe_box(cx - 6, cy - s * 0.28, cx + 6, cy - s * 0.08), fill=accent)
        # antenna
        draw.line([(cx + s * 0.1, cy - s * 0.1), (cx + s * 0.18, cy - s * 0.32)], fill=accent, width=3)
    elif style == "apc":
        draw.rounded_rectangle([cx - s * 0.34, cy - s * 0.06, cx + s * 0.34, cy + s * 0.16], radius=6, fill=body, outline=light, width=2)
        draw.rectangle([cx - s * 0.22, cy - s * 0.2, cx + s * 0.22, cy - s * 0.02], fill=dark, outline=accent, width=2)
        for x in (-0.18, -0.06, 0.06, 0.18):
            draw.rectangle([cx + s * x - 6, cy - s * 0.16, cx + s * x + 6, cy - s * 0.08], fill=(30, 30, 34))
        draw.rectangle(safe_box(cx - 5, cy - s * 0.22, cx + 5, cy - s * 0.36), fill=accent)
    elif style == "mbt":
        draw.polygon(
            [(cx - s * 0.34, cy + s * 0.12), (cx - s * 0.3, cy - s * 0.02), (cx + s * 0.3, cy - s * 0.02), (cx + s * 0.34, cy + s * 0.12)],
            fill=body, outline=light,
        )
        draw.ellipse([cx - s * 0.16, cy - s * 0.14, cx + s * 0.16, cy + s * 0.06], fill=dark, outline=accent, width=3)
        draw.rectangle(safe_box(cx - 7, cy - s * 0.34, cx + 7, cy - s * 0.1), fill=accent)
        draw.ellipse([cx - 10, cy - s * 0.38, cx + 10, cy - s * 0.3], fill=light)
    elif style == "titan":
        draw.rounded_rectangle([cx - s * 0.4, cy - s * 0.04, cx + s * 0.4, cy + s * 0.18], radius=4, fill=body, outline=light, width=3)
        draw.ellipse([cx - s * 0.2, cy - s * 0.18, cx + s * 0.2, cy + s * 0.06], fill=dark, outline=accent, width=3)
        draw.rectangle(safe_box(cx - 10, cy - s * 0.4, cx + 10, cy - s * 0.12), fill=accent)
        draw.rectangle([cx - s * 0.28, cy - s * 0.08, cx - s * 0.18, cy + s * 0.04], fill=accent)
        draw.rectangle([cx + s * 0.18, cy - s * 0.08, cx + s * 0.28, cy + s * 0.04], fill=accent)
    elif style == "raider":
        draw.polygon(
            [(cx - s * 0.36, cy + s * 0.14), (cx - s * 0.22, cy - s * 0.1), (cx + s * 0.34, cy - s * 0.02), (cx + s * 0.28, cy + s * 0.16)],
            fill=body, outline=light,
        )
        # big wheels instead of tracks redraw
        draw.ellipse([cx - s * 0.38, cy + s * 0.02, cx - s * 0.12, cy + s * 0.28], fill=(28, 24, 18), outline=accent, width=3)
        draw.ellipse([cx + s * 0.08, cy + s * 0.02, cx + s * 0.34, cy + s * 0.28], fill=(28, 24, 18), outline=accent, width=3)
        draw.polygon([(cx - s * 0.05, cy - s * 0.08), (cx + s * 0.05, cy - s * 0.08), (cx, cy - s * 0.3)], fill=accent)
    elif style == "frost":
        draw.polygon(
            [(cx - s * 0.42, cy + s * 0.14), (cx - s * 0.1, cy - s * 0.22), (cx + s * 0.4, cy + s * 0.1), (cx + s * 0.34, cy + s * 0.2), (cx - s * 0.34, cy + s * 0.2)],
            fill=body, outline=(220, 235, 245),
        )
        draw.rectangle([cx - s * 0.12, cy - s * 0.08, cx + s * 0.18, cy + s * 0.1], fill=dark, outline=accent, width=2)
        draw.rectangle(safe_box(cx + s * 0.05, cy - s * 0.28, cx + s * 0.14, cy - s * 0.06), fill=accent)
        # ice chips
        for i in range(8):
            x = cx - s * 0.3 + i * s * 0.08
            draw.polygon([(x, cy - s * 0.18), (x + 6, cy - s * 0.28), (x + 12, cy - s * 0.18)], fill=(200, 230, 255))
    elif style == "fang":
        draw.rounded_rectangle([cx - s * 0.32, cy + s * 0.0, cx + s * 0.32, cy + s * 0.16], radius=12, fill=body, outline=accent, width=2)
        draw.ellipse([cx - s * 0.14, cy - s * 0.08, cx + s * 0.14, cy + s * 0.1], fill=dark, outline=(80, 40, 50), width=2)
        # long rail lance
        draw.rectangle(safe_box(cx - 4, cy - s * 0.42, cx + 4, cy - s * 0.04), fill=accent)
        draw.polygon([(cx - 10, cy - s * 0.42), (cx + 10, cy - s * 0.42), (cx, cy - s * 0.52)], fill=(255, 80, 90))
    else:
        draw.rounded_rectangle([cx - s * 0.3, cy - s * 0.02, cx + s * 0.3, cy + s * 0.14], radius=8, fill=body, outline=light, width=2)
        draw.ellipse([cx - s * 0.14, cy - s * 0.12, cx + s * 0.14, cy + s * 0.04], fill=dark)
        draw.rectangle(safe_box(cx - 6, cy - s * 0.3, cx + 6, cy - s * 0.08), fill=accent)


def draw_ship(draw, style, body, accent, cx, cy, s):
    dark = shade(body, -35)
    light = shade(body, 40)
    # water reflection
    draw.ellipse([cx - s * 0.42, cy + s * 0.16, cx + s * 0.42, cy + s * 0.32], fill=(*accent[:3], 40) if False else shade(accent, -60))

    if style == "skiff":
        draw.polygon(
            [(cx - s * 0.34, cy + s * 0.12), (cx - s * 0.22, cy - s * 0.02), (cx + s * 0.3, cy + s * 0.02), (cx + s * 0.22, cy + s * 0.14)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - s * 0.06, cy - s * 0.12, cx + s * 0.1, cy + s * 0.04], fill=dark, outline=accent, width=2)
        draw.polygon([(cx + s * 0.02, cy - s * 0.12), (cx + s * 0.02, cy - s * 0.32), (cx + s * 0.16, cy - s * 0.12)], fill=(240, 240, 245))
    elif style == "cutter":
        draw.polygon(
            [(cx - s * 0.38, cy + s * 0.12), (cx - s * 0.28, cy - s * 0.06), (cx + s * 0.36, cy - s * 0.02), (cx + s * 0.28, cy + s * 0.14)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - s * 0.08, cy - s * 0.18, cx + s * 0.14, cy + s * 0.02], fill=dark, outline=accent, width=2)
        draw.rectangle(safe_box(cx + s * 0.0, cy - s * 0.3, cx + s * 0.06, cy - s * 0.16), fill=accent)
        draw.ellipse([cx + s * 0.18, cy - s * 0.02, cx + s * 0.28, cy + s * 0.08], fill=accent)
    elif style == "destroyer":
        draw.polygon(
            [(cx - s * 0.4, cy + s * 0.1), (cx - s * 0.32, cy - s * 0.04), (cx + s * 0.4, cy + s * 0.0), (cx + s * 0.32, cy + s * 0.14)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - s * 0.1, cy - s * 0.2, cx + s * 0.16, cy + s * 0.02], fill=dark)
        draw.rectangle([cx - s * 0.28, cy - s * 0.1, cx - s * 0.14, cy + s * 0.02], fill=shade(body, -20))
        draw.rectangle([cx + s * 0.18, cy - s * 0.12, cx + s * 0.3, cy + s * 0.0], fill=shade(body, -20))
        for x in (-0.2, 0.0, 0.2):
            draw.rectangle(safe_box(cx + s * x - 3, cy - s * 0.28, cx + s * x + 3, cy - s * 0.12), fill=accent)
    elif style == "battleship":
        draw.polygon(
            [(cx - s * 0.44, cy + s * 0.12), (cx - s * 0.34, cy - s * 0.02), (cx + s * 0.42, cy + s * 0.02), (cx + s * 0.34, cy + s * 0.16)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - s * 0.14, cy - s * 0.24, cx + s * 0.18, cy + s * 0.02], fill=dark, outline=accent, width=2)
        draw.rectangle([cx - s * 0.32, cy - s * 0.12, cx - s * 0.16, cy + s * 0.02], fill=shade(body, -15))
        draw.rectangle([cx + s * 0.2, cy - s * 0.14, cx + s * 0.34, cy + s * 0.02], fill=shade(body, -15))
        for i, x in enumerate((-0.24, -0.08, 0.08, 0.24)):
            h = 0.22 + (i % 2) * 0.06
            draw.rectangle(safe_box(cx + s * x - 5, cy - s * h, cx + s * x + 5, cy - s * 0.1), fill=accent)
    elif style == "hydro":
        draw.polygon(
            [(cx - s * 0.32, cy + s * 0.06), (cx - s * 0.1, cy - s * 0.08), (cx + s * 0.34, cy - s * 0.02), (cx + s * 0.2, cy + s * 0.1)],
            fill=body, outline=light,
        )
        # foils
        draw.polygon([(cx - s * 0.28, cy + s * 0.08), (cx - s * 0.4, cy + s * 0.26), (cx - s * 0.12, cy + s * 0.1)], fill=accent)
        draw.polygon([(cx + s * 0.22, cy + s * 0.08), (cx + s * 0.38, cy + s * 0.26), (cx + s * 0.1, cy + s * 0.1)], fill=accent)
        draw.ellipse([cx - s * 0.06, cy - s * 0.16, cx + s * 0.14, cy + s * 0.0], fill=dark, outline=accent, width=2)
    elif style == "keel":
        draw.polygon(
            [(cx - s * 0.36, cy + s * 0.1), (cx - s * 0.2, cy - s * 0.08), (cx + s * 0.36, cy - s * 0.04), (cx + s * 0.28, cy + s * 0.14)],
            fill=body, outline=(40, 90, 120),
        )
        draw.polygon([(cx - s * 0.05, cy + s * 0.1), (cx + s * 0.05, cy + s * 0.1), (cx, cy + s * 0.34)], fill=accent)
        draw.rectangle([cx - s * 0.08, cy - s * 0.2, cx + s * 0.12, cy + s * 0.02], fill=dark)
        draw.ellipse([cx - 8, cy - s * 0.08, cx + 8, cy + s * 0.02], fill=(255, 60, 80))
    elif style == "leviathan":
        draw.polygon(
            [(cx - s * 0.46, cy + s * 0.12), (cx - s * 0.3, cy - s * 0.08), (cx + s * 0.44, cy + s * 0.0), (cx + s * 0.36, cy + s * 0.18)],
            fill=body, outline=(228, 174, 57),
        )
        draw.rounded_rectangle([cx - s * 0.16, cy - s * 0.28, cx + s * 0.22, cy + s * 0.04], radius=10, fill=dark, outline=(228, 174, 57), width=3)
        # crown fins
        for x in (-0.12, 0.0, 0.12, 0.24):
            draw.polygon(
                [(cx + s * x - 8, cy - s * 0.24), (cx + s * x, cy - s * 0.42), (cx + s * x + 8, cy - s * 0.24)],
                fill=(228, 174, 57),
            )
        draw.ellipse([cx - s * 0.36, cy - s * 0.02, cx - s * 0.2, cy + s * 0.1], fill=accent)
    else:
        draw.polygon(
            [(cx - s * 0.36, cy + s * 0.1), (cx - s * 0.24, cy - s * 0.04), (cx + s * 0.34, cy + s * 0.0), (cx + s * 0.26, cy + s * 0.12)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - s * 0.08, cy - s * 0.16, cx + s * 0.12, cy + s * 0.02], fill=dark)


def draw_jet(draw, style, body, accent, cx, cy, s):
    dark = shade(body, -40)
    light = shade(body, 45)

    if style == "wasp":
        draw.ellipse([cx - s * 0.16, cy - s * 0.1, cx + s * 0.16, cy + s * 0.14], fill=body, outline=light, width=2)
        draw.ellipse([cx - s * 0.36, cy - s * 0.18, cx - s * 0.12, cy - s * 0.02], fill=(*accent, ) if False else shade(accent, 20))
        draw.ellipse([cx + s * 0.12, cy - s * 0.18, cx + s * 0.36, cy - s * 0.02], fill=shade(accent, 20))
        draw.ellipse([cx - 10, cy - 6, cx + 10, cy + 8], fill=(255, 220, 80))
        # rotor blur
        draw.arc([cx - s * 0.42, cy - s * 0.24, cx - s * 0.06, cy + s * 0.04], 0, 360, fill=accent, width=2)
        draw.arc([cx + s * 0.06, cy - s * 0.24, cx + s * 0.42, cy + s * 0.04], 0, 360, fill=accent, width=2)
    elif style == "falcon":
        draw.polygon(
            [(cx, cy - s * 0.28), (cx + s * 0.12, cy), (cx + s * 0.4, cy + s * 0.08), (cx + s * 0.08, cy + s * 0.1),
             (cx, cy + s * 0.22), (cx - s * 0.08, cy + s * 0.1), (cx - s * 0.4, cy + s * 0.08), (cx - s * 0.12, cy)],
            fill=body, outline=light,
        )
        draw.polygon([(cx - 8, cy - s * 0.1), (cx + 8, cy - s * 0.1), (cx, cy - s * 0.28)], fill=accent)
        draw.ellipse([cx - 8, cy - 4, cx + 8, cy + 8], fill=(40, 180, 255))
    elif style == "raptor":
        draw.polygon(
            [(cx, cy - s * 0.26), (cx + s * 0.14, cy - s * 0.02), (cx + s * 0.42, cy + s * 0.1), (cx + s * 0.1, cy + s * 0.08),
             (cx, cy + s * 0.2), (cx - s * 0.1, cy + s * 0.08), (cx - s * 0.42, cy + s * 0.1), (cx - s * 0.14, cy - s * 0.02)],
            fill=body, outline=light,
        )
        draw.rectangle([cx - 6, cy - s * 0.08, cx + 6, cy + s * 0.16], fill=dark)
        draw.ellipse([cx - s * 0.08, cy + s * 0.12, cx - s * 0.02, cy + s * 0.22], fill=accent)
        draw.ellipse([cx + s * 0.02, cy + s * 0.12, cx + s * 0.08, cy + s * 0.22], fill=accent)
    elif style == "stealth":
        draw.polygon(
            [(cx, cy - s * 0.14), (cx + s * 0.44, cy + s * 0.12), (cx, cy + s * 0.06), (cx - s * 0.44, cy + s * 0.12)],
            fill=body, outline=(80, 90, 100),
        )
        draw.polygon([(cx - s * 0.1, cy - s * 0.02), (cx + s * 0.1, cy - s * 0.02), (cx, cy - s * 0.14)], fill=dark)
        draw.line([(cx - s * 0.2, cy + s * 0.04), (cx + s * 0.2, cy + s * 0.04)], fill=accent, width=2)
    elif style == "dart":
        draw.polygon(
            [(cx, cy - s * 0.36), (cx + s * 0.1, cy + s * 0.18), (cx, cy + s * 0.1), (cx - s * 0.1, cy + s * 0.18)],
            fill=body, outline=light,
        )
        draw.polygon([(cx - s * 0.22, cy + s * 0.02), (cx - s * 0.06, cy + s * 0.06), (cx - s * 0.08, cy - s * 0.02)], fill=accent)
        draw.polygon([(cx + s * 0.22, cy + s * 0.02), (cx + s * 0.06, cy + s * 0.06), (cx + s * 0.08, cy - s * 0.02)], fill=accent)
        draw.ellipse([cx - 6, cy - s * 0.2, cx + 6, cy - s * 0.1], fill=(180, 230, 255))
    elif style == "gunship":
        draw.ellipse([cx - s * 0.28, cy - s * 0.08, cx + s * 0.28, cy + s * 0.16], fill=body, outline=light, width=2)
        draw.rectangle([cx - s * 0.4, cy - s * 0.02, cx - s * 0.24, cy + s * 0.1], fill=dark)
        draw.rectangle([cx + s * 0.24, cy - s * 0.02, cx + s * 0.4, cy + s * 0.1], fill=dark)
        # rotor mast
        draw.rectangle(safe_box(cx - 4, cy - s * 0.28, cx + 4, cy - s * 0.04), fill=accent)
        draw.ellipse([cx - s * 0.34, cy - s * 0.34, cx + s * 0.34, cy - s * 0.18], outline=accent, width=4)
        draw.line([(cx - s * 0.32, cy - s * 0.26), (cx + s * 0.32, cy - s * 0.26)], fill=light, width=3)
        # chin gun
        draw.rectangle(safe_box(cx - 5, cy + s * 0.12, cx + 5, cy + s * 0.28), fill=(40, 40, 44))
    elif style == "eclipse":
        draw.polygon(
            [(cx, cy - s * 0.16), (cx + s * 0.46, cy + s * 0.14), (cx + s * 0.1, cy + s * 0.04),
             (cx, cy + s * 0.1), (cx - s * 0.1, cy + s * 0.04), (cx - s * 0.46, cy + s * 0.14)],
            fill=body, outline=(122, 92, 255),
        )
        draw.polygon([(cx - s * 0.12, cy - s * 0.02), (cx + s * 0.12, cy - s * 0.02), (cx, cy - s * 0.16)], fill=(40, 20, 60))
        # glow edges
        draw.line([(cx - s * 0.4, cy + s * 0.1), (cx, cy - s * 0.14)], fill=(180, 140, 255), width=3)
        draw.line([(cx + s * 0.4, cy + s * 0.1), (cx, cy - s * 0.14)], fill=(180, 140, 255), width=3)
        draw.ellipse([cx - 10, cy - 6, cx + 10, cy + 8], fill=(228, 174, 57))
    else:
        draw.polygon(
            [(cx, cy - s * 0.24), (cx + s * 0.38, cy + s * 0.1), (cx, cy + s * 0.16), (cx - s * 0.38, cy + s * 0.1)],
            fill=body, outline=light,
        )


def domain_backdrop(img, domain, seed):
    """Subtle domain-specific atmosphere on top of radial bg."""
    size = img.size[0]
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    rng = random.Random(seed)
    if domain == "land":
        for i in range(18):
            y = 360 + i * 6
            a = 18 + (i % 5) * 4
            d.line([(0, y), (size, y - 8)], fill=(40, 50, 30, a), width=2)
        for _ in range(30):
            x, y = rng.randint(20, 490), rng.randint(300, 480)
            d.ellipse([x, y, x + 4, y + 3], fill=(90, 80, 50, 40))
    elif domain == "sea":
        for i in range(16):
            y = 300 + i * 10
            pts = []
            for x in range(0, size, 16):
                pts.append((x, y + math.sin(x * 0.04 + i) * 6))
            if len(pts) > 1:
                d.line(pts, fill=(40, 140, 200, 35), width=2)
    else:
        for _ in range(50):
            x, y = rng.randint(10, 500), rng.randint(10, 280)
            r = rng.randint(1, 2)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rng.randint(30, 90)))
        # contrail
        d.line([(80, 120), (420, 200)], fill=(180, 220, 255, 50), width=3)
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def make_vehicle(vid, name, domain, style, color, rarity):
    size = 512
    body = rgb_from_int(color)
    seed = sum(ord(c) for c in vid) * 17
    if domain == "land":
        inner, outer = shade(body, 30), (10, 14, 10)
        cx_bias, cy_bias = 0.5, 0.4
    elif domain == "sea":
        inner, outer = shade(body, 25), (6, 12, 22)
        cx_bias, cy_bias = 0.48, 0.38
    else:
        inner, outer = shade(body, 20), (8, 10, 18)
        cx_bias, cy_bias = 0.52, 0.36

    img = radial_bg(size, inner, outer, cx=cx_bias, cy=cy_bias, seed=seed)
    img = domain_backdrop(img, domain, seed)
    draw = ImageDraw.Draw(img, "RGBA")
    accent = RARITY_RGB.get(rarity, body)
    cx, cy, s = 256, 230, 220

    if domain == "land":
        draw_tank(draw, style, body, accent, cx, cy, s)
    elif domain == "sea":
        draw_ship(draw, style, body, accent, cx, cy, s)
    else:
        draw_jet(draw, style, body, accent, cx, cy, s)

    rarity_rails(draw, size, rarity)
    # soft highlight
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - 90, cy - 110, cx + 90, cy + 20], fill=(255, 255, 255, 28))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    img = vignette(img, 0.45)
    stamp_label(img, [name.upper(), domain.upper()], accent, y=428)
    path = VEH / f"{vid}.png"
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


# ─── Gear icons ──────────────────────────────────────────────────────────────

def gear_glyph(draw, item_id, accent, cx, cy, s):
    if item_id == "ammo_belt":
        for i in range(5):
            x = cx - s * 0.28 + i * s * 0.14
            draw.rounded_rectangle([x - 12, cy - 28, x + 12, cy + 28], radius=4, fill=accent, outline=(255, 255, 255), width=2)
            draw.ellipse([x - 6, cy - 6, x + 6, cy + 6], fill=(30, 30, 30))
    elif item_id == "mag_crate":
        draw.rounded_rectangle([cx - 50, cy - 40, cx + 50, cy + 40], radius=8, fill=shade(accent, -40), outline=accent, width=3)
        draw.rectangle([cx - 34, cy - 24, cx + 34, cy + 24], fill=accent)
        draw.line([(cx - 20, cy - 10), (cx + 20, cy - 10)], fill=(255, 255, 255), width=3)
        draw.line([(cx - 20, cy + 5), (cx + 10, cy + 5)], fill=(255, 255, 255), width=3)
    elif item_id == "bomb_rack":
        for i, xoff in enumerate((-40, 0, 40)):
            draw.ellipse([cx + xoff - 18, cy - 10, cx + xoff + 18, cy + 40], fill=shade(accent, -30), outline=accent, width=2)
            draw.polygon([(cx + xoff - 10, cy - 10), (cx + xoff + 10, cy - 10), (cx + xoff, cy - 40)], fill=accent)
        draw.rectangle([cx - 55, cy - 48, cx + 55, cy - 36], fill=(40, 40, 48))
    elif item_id == "torpedo_rack":
        for i, yoff in enumerate((-30, 10)):
            draw.rounded_rectangle([cx - 70, cy + yoff - 14, cx + 70, cy + yoff + 14], radius=12, fill=shade(accent, -20), outline=accent, width=2)
            draw.polygon([(cx + 70, cy + yoff - 14), (cx + 70, cy + yoff + 14), (cx + 95, cy + yoff)], fill=accent)
            draw.ellipse([cx - 70, cy + yoff - 10, cx - 50, cy + yoff + 10], fill=(255, 200, 80))
    elif item_id == "landmine_pack":
        draw.ellipse([cx - 48, cy - 20, cx + 48, cy + 40], fill=shade(accent, -40), outline=accent, width=3)
        draw.ellipse([cx - 18, cy - 5, cx + 18, cy + 25], fill=(255, 80, 60))
        for a in range(0, 360, 45):
            rad = math.radians(a)
            x0 = cx + math.cos(rad) * 28
            y0 = cy + 10 + math.sin(rad) * 22
            x1 = cx + math.cos(rad) * 48
            y1 = cy + 10 + math.sin(rad) * 38
            draw.line([(x0, y0), (x1, y1)], fill=accent, width=4)
    elif item_id == "ap_rounds":
        for i in range(3):
            x = cx - 40 + i * 40
            draw.polygon([(x, cy - 50), (x + 16, cy - 20), (x + 16, cy + 40), (x - 16, cy + 40), (x - 16, cy - 20)], fill=accent, outline=(255, 255, 255))
            draw.rectangle([x - 10, cy + 10, x + 10, cy + 28], fill=(30, 30, 34))
    elif item_id == "incendiary_shells":
        draw.ellipse([cx - 40, cy - 10, cx + 40, cy + 50], fill=(40, 20, 10), outline=accent, width=3)
        # flames
        for i, xoff in enumerate((-20, 0, 20)):
            draw.polygon(
                [(cx + xoff - 14, cy), (cx + xoff + 14, cy), (cx + xoff, cy - 55 - (i % 2) * 10)],
                fill=(255, 140 + i * 20, 40),
            )
        draw.polygon([(cx - 10, cy - 20), (cx + 10, cy - 20), (cx, cy - 70)], fill=(255, 230, 120))
    elif item_id == "depth_charge":
        draw.ellipse([cx - 55, cy - 35, cx + 55, cy + 45], fill=shade(accent, -30), outline=accent, width=3)
        draw.ellipse([cx - 25, cy - 10, cx + 25, cy + 25], fill=(20, 40, 60), outline=(255, 255, 255), width=2)
        draw.arc([cx - 70, cy - 50, cx + 70, cy + 60], 200, 340, fill=(100, 200, 255), width=4)
        draw.ellipse([cx - 8, cy + 2, cx + 8, cy + 18], fill=(255, 200, 80))
    elif item_id == "cluster_bombs":
        draw.ellipse([cx - 20, cy - 50, cx + 20, cy - 10], fill=accent, outline=(255, 200, 100), width=2)
        for i in range(6):
            a = i * math.pi / 3
            x = cx + math.cos(a) * 48
            y = cy + 10 + math.sin(a) * 36
            draw.ellipse([x - 14, y - 14, x + 14, y + 14], fill=shade(accent, -20), outline=(255, 160, 40), width=2)
    elif item_id == "warhead_core":
        draw.ellipse([cx - 60, cy - 50, cx + 60, cy + 50], outline=accent, width=5)
        draw.ellipse([cx - 40, cy - 30, cx + 40, cy + 30], fill=shade(accent, -40), outline=(255, 230, 150), width=3)
        draw.ellipse([cx - 18, cy - 14, cx + 18, cy + 14], fill=accent)
        for i in range(8):
            a = i * math.pi / 4
            draw.line(
                [(cx + math.cos(a) * 22, cy + math.sin(a) * 18), (cx + math.cos(a) * 58, cy + math.sin(a) * 48)],
                fill=(255, 220, 120), width=2,
            )
    elif item_id == "mine_detector":
        draw.rounded_rectangle([cx - 16, cy - 10, cx + 16, cy + 50], radius=6, fill=shade(accent, -30), outline=accent, width=2)
        draw.ellipse([cx - 48, cy - 55, cx + 48, cy + 5], outline=accent, width=5)
        draw.ellipse([cx - 20, cy - 30, cx + 20, cy - 5], fill=(255, 80, 80))
        draw.arc([cx - 60, cy - 65, cx + 60, cy + 15], 200, 340, fill=(100, 255, 180), width=3)
    elif item_id == "tuned_engines":
        draw.ellipse([cx - 55, cy - 40, cx + 55, cy + 40], fill=shade(accent, -40), outline=accent, width=4)
        draw.ellipse([cx - 22, cy - 18, cx + 22, cy + 18], fill=(20, 30, 40))
        for i in range(6):
            a = i * math.pi / 3
            draw.polygon(
                [
                    (cx + math.cos(a) * 18, cy + math.sin(a) * 14),
                    (cx + math.cos(a + 0.4) * 50, cy + math.sin(a + 0.4) * 38),
                    (cx + math.cos(a - 0.4) * 50, cy + math.sin(a - 0.4) * 38),
                ],
                fill=accent,
            )
    elif item_id == "reinforced_plating":
        draw.rounded_rectangle([cx - 55, cy - 45, cx + 55, cy + 45], radius=10, fill=shade(accent, -35), outline=accent, width=4)
        draw.rounded_rectangle([cx - 35, cy - 25, cx + 35, cy + 25], radius=6, fill=(40, 40, 50), outline=(200, 200, 220), width=2)
        for x, y in [(-20, -10), (20, -10), (-20, 10), (20, 10), (0, 0)]:
            draw.ellipse([cx + x - 5, cy + y - 5, cx + x + 5, cy + y + 5], fill=accent)
    elif item_id == "quick_loader":
        draw.polygon([(cx - 50, cy + 30), (cx - 20, cy - 40), (cx + 20, cy - 40), (cx + 50, cy + 30)], fill=shade(accent, -30), outline=accent, width=3)
        draw.arc([cx - 30, cy - 25, cx + 30, cy + 25], 40, 300, fill=(255, 255, 255), width=5)
        draw.polygon([(cx + 18, cy - 20), (cx + 38, cy - 28), (cx + 28, cy - 5)], fill=(255, 255, 255))
    elif item_id == "extended_mag":
        draw.rounded_rectangle([cx - 28, cy - 55, cx + 28, cy + 50], radius=8, fill=shade(accent, -25), outline=accent, width=3)
        for y in range(-40, 45, 14):
            draw.rectangle([cx - 18, cy + y, cx + 18, cy + y + 8], fill=(30, 30, 36))
        draw.rectangle([cx - 12, cy + 40, cx + 12, cy + 55], fill=accent)
    elif item_id == "bomb_bay_ext":
        draw.rounded_rectangle([cx - 70, cy - 25, cx + 70, cy + 35], radius=12, fill=shade(accent, -40), outline=accent, width=3)
        for x in (-40, 0, 40):
            draw.ellipse([cx + x - 16, cy - 12, cx + x + 16, cy + 28], fill=(40, 30, 30), outline=(255, 160, 60), width=2)
        draw.rectangle([cx - 60, cy - 40, cx + 60, cy - 28], fill=(60, 60, 70))
    elif item_id == "heavy_tubes":
        for i, y in enumerate((-35, 0, 35)):
            draw.rounded_rectangle([cx - 75, cy + y - 14, cx + 55, cy + y + 14], radius=10, fill=shade(accent, -25), outline=accent, width=2)
            draw.ellipse([cx + 45, cy + y - 14, cx + 75, cy + y + 14], fill=accent)
        draw.rectangle([cx - 85, cy - 50, cx - 70, cy + 50], fill=(40, 50, 55))
    elif item_id == "targeting_scope":
        draw.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], outline=accent, width=5)
        draw.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], outline=(255, 255, 255), width=3)
        draw.line([(cx - 70, cy), (cx - 35, cy)], fill=accent, width=3)
        draw.line([(cx + 35, cy), (cx + 70, cy)], fill=accent, width=3)
        draw.line([(cx, cy - 70), (cx, cy - 35)], fill=accent, width=3)
        draw.line([(cx, cy + 35), (cx, cy + 70)], fill=accent, width=3)
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 80, 80))
    elif item_id == "jump_boosters":
        draw.rounded_rectangle([cx - 50, cy - 20, cx + 50, cy + 40], radius=10, fill=shade(accent, -30), outline=accent, width=3)
        draw.polygon([(cx - 35, cy + 40), (cx - 15, cy + 40), (cx - 25, cy + 75)], fill=(255, 180, 60))
        draw.polygon([(cx + 15, cy + 40), (cx + 35, cy + 40), (cx + 25, cy + 75)], fill=(255, 180, 60))
        draw.polygon([(cx - 10, cy + 40), (cx + 10, cy + 40), (cx, cy + 85)], fill=(255, 220, 120))
        draw.ellipse([cx - 15, cy - 45, cx + 15, cy - 15], fill=accent)
    elif item_id == "reactive_shield":
        draw.ellipse([cx - 60, cy - 50, cx + 60, cy + 50], outline=accent, width=6)
        draw.ellipse([cx - 45, cy - 35, cx + 45, cy + 35], fill=(40, 30, 10, 80) if False else shade(accent, -50), outline=(255, 230, 150), width=2)
        draw.polygon(
            [(cx, cy - 28), (cx + 22, cy - 8), (cx + 14, cy + 22), (cx - 14, cy + 22), (cx - 22, cy - 8)],
            fill=accent,
        )
        draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 255))
    else:
        draw.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=accent)


def make_gear(item_id, name, kind, color, rarity):
    size = 512
    seed = sum(ord(c) for c in item_id) * 13
    if kind == "ORD":
        inner, outer = shade(color, 20), (18, 8, 8)
    else:
        inner, outer = shade(color, 15), (8, 14, 22)
    img = radial_bg(size, inner, outer, seed=seed)
    # panel
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle([70, 80, 442, 380], radius=24, fill=(16, 18, 24, 200), outline=color, width=3)
    draw.rounded_rectangle([95, 105, 417, 320], radius=16, fill=(10, 12, 16, 160), outline=shade(color, 40), width=2)
    gear_glyph(draw, item_id, color, 256, 210, 200)
    rarity_rails(draw, size, rarity)
    # kind chip
    font = try_font(18)
    draw.rounded_rectangle([200, 88, 312, 112], radius=8, fill=color)
    bbox = draw.textbbox((0, 0), kind, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((256 - tw / 2, 90), kind, font=font, fill=(10, 10, 12))
    img = vignette(img, 0.48)
    stamp_label(img, [name.upper(), "WARHEAD" if kind == "ORD" else "ACCESSORY"], color, y=428)
    path = GEAR / f"{item_id}.png"
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


# ─── Domain cases & keys ─────────────────────────────────────────────────────

def draw_bevel_rect(draw, box, fill, edge_light, edge_dark, radius=28, width=4):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=radius, fill=fill)
    draw.rounded_rectangle(box, radius=radius, outline=edge_light, width=width)
    draw.rounded_rectangle([x0 + 6, y0 + 6, x1 - 6, y1 - 6], radius=max(8, radius - 6), outline=edge_dark, width=2)


def make_domain_case(path, domain, title, subtitle, inner, outer, accent):
    size = 512
    img = radial_bg(size, inner, outer, cx=0.5, cy=0.38, seed=hash(domain) % 1000)
    img = domain_backdrop(img, domain, hash(domain) % 1000)
    draw = ImageDraw.Draw(img, "RGBA")
    box = [68, 90, 444, 385]
    draw_bevel_rect(draw, box, fill=shade(inner, -10), edge_light=accent, edge_dark=shade(outer, -5), radius=22)
    draw.rounded_rectangle([100, 125, 412, 300], radius=14, fill=(10, 12, 16, 150), outline=accent, width=2)
    cx, cy, s = 256, 210, 160
    if domain == "land":
        draw_tank(draw, "mbt", accent, shade(accent, 40), cx, cy, s)
    elif domain == "sea":
        draw_ship(draw, "destroyer", accent, shade(accent, 40), cx, cy, s)
    else:
        draw_jet(draw, "raptor", accent, shade(accent, 40), cx, cy, s)
    draw.rounded_rectangle([120, 320, 392, 358], radius=8, fill=(12, 14, 18), outline=accent, width=2)
    img = vignette(img, 0.5)
    stamp_label(img, [title, subtitle], accent, y=420)
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def make_key_blank(inner, outer, accent, seed=1):
    size = 512
    img = radial_bg(size, inner, outer, cx=0.5, cy=0.45, seed=seed)
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    for _ in range(36):
        x, y = rng.randint(0, 500), rng.randint(0, 500)
        r = rng.randint(8, 26)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(*accent, rng.randint(18, 50)))
    return img


def draw_key_shape(draw, accent, metal, tip_color):
    draw.ellipse([168, 70, 344, 246], fill=metal, outline=accent, width=5)
    draw.ellipse([208, 110, 304, 206], fill=(18, 18, 22), outline=accent, width=3)
    draw.rounded_rectangle([236, 220, 276, 420], radius=10, fill=metal, outline=accent, width=3)
    draw.polygon(
        [(276, 360), (330, 360), (330, 380), (300, 380), (300, 400), (330, 400), (330, 420), (276, 420)],
        fill=tip_color, outline=accent,
    )
    draw.arc([180, 82, 300, 200], 200, 320, fill=(255, 255, 255, 90), width=4)


def make_domain_key(path, label, inner, outer, accent, metal, tip, seed, emblem="tank"):
    img = make_key_blank(inner, outer, accent, seed=seed)
    draw = ImageDraw.Draw(img, "RGBA")
    draw_key_shape(draw, accent, metal, tip)
    cx, cy = 256, 158
    if emblem == "tank":
        draw.rectangle([cx - 22, cy - 8, cx + 22, cy + 12], fill=accent)
        draw.ellipse([cx - 10, cy - 16, cx + 10, cy + 2], fill=metal)
        draw.rectangle([cx - 3, cy - 28, cx + 3, cy - 12], fill=tip)
    elif emblem == "ship":
        draw.polygon([(cx - 24, cy + 10), (cx - 14, cy - 8), (cx + 22, cy - 2), (cx + 14, cy + 12)], fill=accent)
        draw.rectangle([cx - 4, cy - 18, cx + 8, cy + 2], fill=metal)
    else:
        draw.polygon([(cx, cy - 22), (cx + 26, cy + 10), (cx, cy + 4), (cx - 26, cy + 10)], fill=accent)
    img = vignette(img, 0.5)
    stamp_label(img, [label], accent, y=445)
    img.save(path, "PNG", optimize=True)
    print("wrote", path)


def main():
    for d in (VEH, GEAR, CASES, KEYS):
        d.mkdir(parents=True, exist_ok=True)

    for row in VEHICLES:
        make_vehicle(*row)

    for row in WARHEADS:
        make_gear(*row)

    for row in ACCESSORIES:
        make_gear(*row)

    # Domain case/key covers are hand-upgraded photoreal assets.
    # Do not regenerate them here — that would downgrade Armory art.
    print("skip domain case/key overwrite (use upgraded assets in assets/cases|keys)")


if __name__ == "__main__":
    main()
