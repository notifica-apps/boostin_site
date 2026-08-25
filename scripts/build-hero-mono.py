"""Maakt src/assets/images/hero-bg-mono.jpg uit hero-bg.png.

De originele hero-bg.png is een rode duotone die maar 55..99 van het 0-255
grijsbereik gebruikt; daardoor blijft de foto onder elke overlay onzichtbaar.
Dit script pakt de luminantie, rekt die uit naar 25..165, zet lokaal contrast
erbij en trekt de transparante rechterrand/afgeronde hoek dicht. De kleur komt
in CSS uit --np-plum via background-blend-mode: luminosity.

Draaien vanuit de projectroot:  python scripts/build-hero-mono.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "assets" / "images" / "hero-bg.png"
DST = ROOT / "src" / "assets" / "images" / "hero-bg-mono.jpg"

arr = np.asarray(Image.open(SRC).convert("RGBA")).astype(float)
rgb, alpha = arr[..., :3], arr[..., 3]
lum = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]

# transparante rand en afgeronde hoek: laatste dekkende pixel doortrekken
opaque = alpha >= 250
for y in range(lum.shape[0]):
    idx = np.where(opaque[y])[0]
    if len(idx) == 0:
        continue
    lum[y, idx.max() + 1:] = lum[y, idx.max()]
    if idx.min() > 0:
        lum[y, :idx.min()] = lum[y, idx.min()]

out = 25 + np.clip((lum - 55) / (99 - 55), 0, 1) * (165 - 25)
blur = np.asarray(Image.fromarray(out.astype("uint8")).filter(ImageFilter.GaussianBlur(24))).astype(float)
out = np.clip(out + 1.1 * (out - blur), 0, 255)

Image.fromarray(out.astype("uint8"), mode="L").convert("RGB").save(
    DST, quality=88, optimize=True, progressive=True
)
print(f"{DST.relative_to(ROOT)} geschreven ({DST.stat().st_size // 1024} kB)")
