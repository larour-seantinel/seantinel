#!/usr/bin/env python3
"""Generate the Seantinel launcher icon: lighthouse with a wave crashing on it.
Writes PNGs into both android-spike/ and android-todo/ res/mipmap-*dpi/ic_launcher.png.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [ROOT / "android-spike" / "res", ROOT / "android-todo" / "res"]
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
HERO = 512  # supersample for antialiasing, then downsample
WEB_OUT = ROOT / "public" / "icon.png"
WEB_PX = 256

def render(size=HERO):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    cx = size // 2
    # Rounded square background (circle-ish) in deep ocean navy
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bgd = ImageDraw.Draw(bg)
    bgd.rounded_rectangle([0, 0, size, size], radius=size // 7,
                          fill=(14, 32, 58, 255))  # #0e203a
    # Horizon gradient hint (lighter top)
    for i in range(size // 2):
        a = int(60 * (1 - i / (size / 2)))
        bgd.rectangle([0, i, size, i + 1], fill=(60, 100, 150, a))
    img = Image.alpha_composite(img, bg)
    d = ImageDraw.Draw(img, "RGBA")

    # ---- light beams (behind lighthouse) ----
    beam_color = (255, 240, 140, 95)
    bx = cx + int(size * 0.05)   # beam origin near lantern
    by = int(size * 0.26)
    for angle_x in (-0.75, -0.35, 0.35, 0.75):
        tip_x = bx + int(angle_x * size)
        tip_y = by - int(size * 0.4)
        d.polygon([(bx - 4, by), (bx + 4, by), (tip_x, tip_y)], fill=beam_color)

    # ---- lighthouse ----
    tower_w = int(size * 0.17)
    tower_x0 = cx + int(size * 0.03) - tower_w // 2
    tower_x1 = tower_x0 + tower_w
    tower_top = int(size * 0.32)
    tower_bot = int(size * 0.70)

    # Rocky base below the tower
    base_h = int(size * 0.08)
    d.ellipse([tower_x0 - int(tower_w * 0.6), tower_bot - base_h // 2,
               tower_x1 + int(tower_w * 0.6), tower_bot + base_h],
              fill=(45, 40, 36, 255))

    # Tower bands: alternating white and red
    bands = 5
    band_h = (tower_bot - tower_top) / bands
    for i in range(bands):
        y0 = int(tower_top + i * band_h)
        y1 = int(tower_top + (i + 1) * band_h)
        color = (240, 240, 236, 255) if i % 2 == 0 else (197, 74, 63, 255)
        d.rectangle([tower_x0, y0, tower_x1, y1], fill=color)

    # Tower outline
    d.rectangle([tower_x0, tower_top, tower_x1, tower_bot],
                outline=(20, 20, 20, 255), width=max(2, size // 160))

    # Gallery (slight overhang above tower)
    gal_h = int(size * 0.025)
    d.rectangle([tower_x0 - int(tower_w * 0.15), tower_top - gal_h,
                 tower_x1 + int(tower_w * 0.15), tower_top],
                fill=(55, 55, 55, 255))

    # Lantern room — glowing yellow box
    lan_h = int(size * 0.07)
    lan_y1 = tower_top - gal_h
    lan_y0 = lan_y1 - lan_h
    lan_x0 = tower_x0 - int(tower_w * 0.05)
    lan_x1 = tower_x1 + int(tower_w * 0.05)
    d.rectangle([lan_x0, lan_y0, lan_x1, lan_y1], fill=(50, 50, 55, 255))
    glow_pad = int(size * 0.012)
    d.rectangle([lan_x0 + glow_pad, lan_y0 + glow_pad,
                 lan_x1 - glow_pad, lan_y1 - glow_pad],
                fill=(255, 230, 110, 255))

    # Dome / roof — red triangle
    dome_h = int(size * 0.055)
    d.polygon([(lan_x0 - int(tower_w * 0.05), lan_y0),
               (lan_x1 + int(tower_w * 0.05), lan_y0),
               ((lan_x0 + lan_x1) // 2, lan_y0 - dome_h)],
              fill=(197, 74, 63, 255))

    # Antenna
    ant_top = lan_y0 - dome_h - int(size * 0.03)
    d.line([(cx + int(size * 0.03), lan_y0 - dome_h),
            (cx + int(size * 0.03), ant_top)],
           fill=(60, 60, 60, 255), width=max(2, size // 180))

    # ---- wave crashing on the base ----
    # A big curl rising from the left, breaking over the lighthouse base.
    # Approximate curl with a polygon + ellipse for crest.
    water_y = int(size * 0.72)
    # Base water fill
    d.rectangle([0, water_y, size, size], fill=(30, 80, 140, 255))

    # Wave crest polygon (hits the base)
    wave_pts = [
        (int(size * 0.02), water_y),
        (int(size * 0.10), int(size * 0.60)),
        (int(size * 0.22), int(size * 0.46)),
        (int(size * 0.34), int(size * 0.40)),
        (int(size * 0.44), int(size * 0.44)),
        (int(size * 0.50), int(size * 0.56)),
        (int(size * 0.42), int(size * 0.66)),
        (int(size * 0.30), int(size * 0.72)),
        (int(size * 0.18), int(size * 0.76)),
        (int(size * 0.02), int(size * 0.80)),
    ]
    d.polygon(wave_pts, fill=(60, 140, 210, 255))

    # Crest highlight
    crest_pts = [
        (int(size * 0.22), int(size * 0.46)),
        (int(size * 0.34), int(size * 0.40)),
        (int(size * 0.44), int(size * 0.44)),
        (int(size * 0.40), int(size * 0.50)),
        (int(size * 0.30), int(size * 0.52)),
        (int(size * 0.22), int(size * 0.52)),
    ]
    d.polygon(crest_pts, fill=(220, 240, 255, 255))

    # Spray drops
    for (sx, sy, sr) in [(0.46, 0.38, 0.013), (0.52, 0.42, 0.009),
                         (0.56, 0.48, 0.011), (0.40, 0.34, 0.010),
                         (0.60, 0.52, 0.008)]:
        r = max(2, int(size * sr))
        d.ellipse([int(size * sx) - r, int(size * sy) - r,
                   int(size * sx) + r, int(size * sy) + r],
                  fill=(230, 245, 255, 230))

    # Front wave sliver (deep foreground)
    d.polygon([(0, size), (size, size), (size, int(size * 0.84)),
               (int(size * 0.70), int(size * 0.80)),
               (int(size * 0.40), int(size * 0.86)),
               (int(size * 0.15), int(size * 0.82)),
               (0, int(size * 0.86))],
              fill=(20, 60, 110, 255))

    # Soft blur to merge seams
    img = img.filter(ImageFilter.SMOOTH)
    return img

def main():
    hero = render(HERO)
    for target in TARGETS:
        for density, px in DENSITIES.items():
            out_dir = target / f"mipmap-{density}"
            out_dir.mkdir(parents=True, exist_ok=True)
            resized = hero.resize((px, px), Image.LANCZOS)
            resized.save(out_dir / "ic_launcher.png")
    WEB_OUT.parent.mkdir(parents=True, exist_ok=True)
    hero.resize((WEB_PX, WEB_PX), Image.LANCZOS).save(WEB_OUT)
    print(f"wrote icons to {len(TARGETS)} apps × {len(DENSITIES)} densities, plus {WEB_OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
