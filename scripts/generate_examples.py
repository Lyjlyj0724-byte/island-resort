#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate every demo illustration used by the island-resort website.

The artwork is 100% procedural (Pillow + numpy): flat, layered editorial
illustrations with a warm matte palette.  There are no people, faces, text,
letters, numbers, logos, watermarks or third-party images anywhere, and the
output is deterministic because every scene gets a fixed random seed.

Usage (from the repository root)::

    python scripts/generate_examples.py            # everything
    python scripts/generate_examples.py sabah-surf # one or more single files
    python scripts/generate_examples.py docs       # hero + contact sheet only

Outputs::

    public/examples/*.webp     22 illustrations (exact pixel sizes below)
    docs/artwork-preview.webp  1600x1000 contact sheet
    docs/hero.webp             1600x900 README hero illustration

The script verifies its own output at the end (size, mode, pixel spread) and
exits with a non-zero status if anything is off.
"""

from __future__ import annotations

import math
import random
import sys
import time
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "public" / "examples"
DOCS = ROOT / "docs"

SS = 2  # supersampling factor: draw big, downsample with Lanczos

# --------------------------------------------------------------------------
# palette -- warm matte travel-poster colours shared by the whole series
# --------------------------------------------------------------------------
CREAM = "#f4ecd8"
CREAM_LIGHT = "#faf4e5"
CREAM_DEEP = "#eadfc6"
SAND = "#e2cfa8"
SAND_DEEP = "#cdb488"
SAGE = "#6f8a63"
SAGE_DARK = "#4c6a51"
SAGE_DEEP = "#3d5a45"
TERRACOTTA = "#b57a5e"
TERRACOTTA_DEEP = "#8f5c48"
DUSK_PINK = "#c98a7e"
DUSK_PALE = "#e2b3a4"
DEEP_TEAL = "#2f4f4a"
TEAL_MID = "#4c6a63"
TEAL_SOFT = "#7c9a92"
SKY_BLUE = "#a9c9d1"
SKY_DEEP = "#7fa3ad"
SKY_PALE = "#d3e2e0"
GOLD = "#d9b26a"
GOLD_LIGHT = "#ecd29a"
GOLD_DEEP = "#b98a4e"
BRICK = "#a8705a"
BRICK_DARK = "#7c4c3e"
NIGHT = "#1d3331"
NIGHT_MID = "#27423e"
WOOD = "#8a5a44"
WOOD_DARK = "#6d4636"
STONE = "#cfc7b4"
STONE_DARK = "#a89f8c"
WHITE_WALL = "#f2ead9"
TILE = "#3b4347"
TILE_SOFT = "#565f61"
INK = "#2f4f4a"


# --------------------------------------------------------------------------
# tiny colour / geometry helpers
# --------------------------------------------------------------------------
def rgb(c):
    """'#rrggbb' (or an rgb tuple) -> (r, g, b) ints."""
    if isinstance(c, tuple):
        return c[:3]
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


def rgba(c, a=255):
    return rgb(c) + (int(round(a)),)


def mix(c1, c2, t):
    """Linear blend between two colours (tuples or hex strings)."""
    a, b = rgb(c1), rgb(c2)
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def lighten(c, t):
    return mix(c, CREAM_LIGHT, t)


def darken(c, t):
    return mix(c, NIGHT, t)


def P(pts):
    """Round a float point list so ImageDraw is happy on every Pillow build."""
    return [(int(round(x)), int(round(y))) for x, y in pts]


def rot_pts(pts, angle, ox=0.0, oy=0.0):
    """Rotate local points around the origin then translate."""
    ca, sa = math.cos(angle), math.sin(angle)
    return [(ox + x * ca - y * sa, oy + x * sa + y * ca) for x, y in pts]


def poly(d, pts, fill):
    d.polygon(P(pts), fill=fill)


def ellipse(d, cx, cy, rx, ry, fill):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)


def rounded(d, x0, y0, x1, y1, r, fill):
    d.rounded_rectangle([x0, y0, x1, y1], radius=max(0, r), fill=fill)


def seed_of(name):
    return zlib.crc32(name.encode("utf-8"))


# --------------------------------------------------------------------------
# canvases, gradients and soft light
# --------------------------------------------------------------------------
def vgradient(w, h, stops):
    """Vertical multi-stop gradient -> RGB Image."""
    pos = np.array([p for p, _ in stops], dtype=np.float32)
    cols = np.array([rgb(c) for _, c in stops], dtype=np.float32)
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)
    out = np.empty((h, 3), dtype=np.float32)
    for ch in range(3):
        out[:, ch] = np.interp(ys, pos, cols[:, ch])
    arr = np.repeat(out[:, None, :], w, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def fill_grad(img, y0, y1, stops, x0=0, x1=None):
    """Paint a vertical gradient band in place (full-width by default)."""
    w, h = img.size
    y0 = max(0, min(h, int(round(y0))))
    y1 = max(y0, min(h, int(round(y1))))
    x0 = max(0, min(w, int(round(x0))))
    x1 = w if x1 is None else max(x0, min(w, int(round(x1))))
    if y1 - y0 < 1 or x1 - x0 < 1:
        return img
    img.paste(vgradient(x1 - x0, y1 - y0, stops), (x0, y0))
    return img


def smooth_grid(w, h, cells, seed, octaves=3, persistence=0.55):
    """Smooth value-noise field in [0, 1] with shape (h, w)."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), dtype=np.float32)
    amp, total = 1.0, 0.0
    cw = max(2, int(cells))
    for _ in range(octaves):
        ch = max(2, int(round(cw * h / max(1, w))))
        grid = rng.random((ch, cw), dtype=np.float32)
        up = Image.fromarray(grid).resize((w, h), Image.Resampling.BICUBIC)
        acc += np.asarray(up, dtype=np.float32) * amp
        total += amp
        amp *= persistence
        cw = min(w, cw * 2)
    return acc / total


def as_mask(arr):
    return Image.fromarray((np.clip(arr, 0.0, 1.0) * 255.0).astype(np.uint8), "L")


def comp(base, layer):
    """Alpha-composite an RGBA layer over an RGB/RGBA base, return RGB."""
    if base.mode != "RGBA":
        base = base.convert("RGBA")
    return Image.alpha_composite(base, layer).convert("RGB")


def add_glow(img, cx, cy, radius, color, strength=0.55, blur_frac=0.055):
    """Soft radial glow (concentric translucent discs, then blur)."""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    col = rgb(color)
    steps = 16
    for i in range(steps, 0, -1):
        t = i / steps
        a = int(255.0 * strength * (1.0 - t) ** 1.9)
        if a <= 0:
            continue
        r = radius * t
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (a,))
    if blur_frac > 0:
        layer = layer.filter(ImageFilter.GaussianBlur(radius * blur_frac))
    return comp(img, layer)


def sun(img, cx, cy, r, core=CREAM_LIGHT, halo="#f0c08d", strength=0.8):
    img = add_glow(img, cx, cy, r * 5.0, halo, strength)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgba(core))
    return img


def soft_band(img, y0, y1, color, opacity, seed, cells=5, contrast=2.6,
              thresh=0.42, blur=14, power=0.7):
    """Noisy soft horizontal band: clouds, mist, haze."""
    w, h = img.size
    n = smooth_grid(w, h, cells, seed)
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None] * h
    centre = (y0 + y1) / 2.0
    half = max(1.0, (y1 - y0) / 2.0)
    band = np.clip(1.0 - ((yy - centre) / half) ** 2, 0.0, 1.0) ** power
    a = np.clip((n - thresh) * contrast, 0.0, 1.0) * band * opacity
    mask = as_mask(a).filter(ImageFilter.GaussianBlur(blur))
    layer = Image.new("RGBA", (w, h), rgba(color))
    layer.putalpha(mask)
    return comp(img, layer)


def mist(img, y, height, color=CREAM_LIGHT, opacity=0.55, seed=3):
    return soft_band(img, y - height, y + height, color, opacity, seed,
                     cells=4, contrast=1.8, thresh=0.30, blur=max(3, height * 0.55))


def shimmer(img, y0, y1, color, alpha=100, seed=0, n=80, center=None,
            spread=0.22, blur=1.2, dash=(0.012, 0.07), fade=0.55):
    """Loose horizontal dashes on the water: the flat-poster glitter."""
    w, h = img.size
    rng = np.random.default_rng(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    col = rgb(color)
    y0, y1 = float(y0), float(y1)
    if y1 <= y0:
        return img
    for _ in range(n):
        t = rng.random() ** 1.5
        y = y0 + (y1 - y0) * t
        if center is None:
            x = rng.uniform(0.0, w)
        else:
            x = float(rng.normal(center, spread * w * (0.30 + t)))
        half = rng.uniform(*dash) * w * (0.45 + t)
        a = int(alpha * rng.uniform(0.30, 1.0) * (1.0 - fade * t))
        if a < 2:
            continue
        hgt = max(0.8, (y1 - y0) * rng.uniform(0.0015, 0.005))
        d.rounded_rectangle([x - half, y - hgt, x + half, y + hgt],
                            radius=hgt, fill=col + (a,))
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return comp(img, layer)


def mirror_water(img, horizon, opacity=0.45, wobble=4.0, tint=SKY_BLUE,
                 squash=0.92, seed=1, fade_pow=1.2):
    """Reflect everything above the horizon line into the water below."""
    w, h = img.size
    hz = int(round(horizon))
    hz = max(2, min(h - 2, hz))
    avail = h - hz
    if avail < 2:
        return img
    src = img.crop((0, 0, w, hz))
    target_h = min(avail, max(1, int(hz * squash)))
    if target_h != hz:
        src = src.resize((w, target_h), Image.Resampling.BILINEAR)
    # vertical mirror: the row just above the horizon becomes the row just below it
    src = src.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    th = src.height
    arr = np.asarray(src, dtype=np.int16)
    rng = np.random.default_rng(seed)
    offsets = (np.sin(np.linspace(0.0, 7.0, th)) * wobble
               + rng.normal(0.0, wobble * 0.4, th)).astype(int)
    out = np.empty_like(arr)
    for i in range(th):
        out[i] = np.roll(arr[i], int(offsets[i]), axis=0)
    refl = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    tw = Image.new("RGB", refl.size, rgb(tint))
    refl = Image.blend(refl, tw, 0.35)
    a = (np.linspace(1.0, 0.0, th) ** fade_pow * opacity * 255.0).astype(np.uint8)
    mask = Image.fromarray(np.tile(a[:, None], (1, w)), "L")
    layer = refl.convert("RGBA")
    layer.putalpha(mask)
    base = img.convert("RGBA")
    base.alpha_composite(layer, dest=(0, hz))
    return base.convert("RGB")
def dof_bottom(img, start=0.86, radius=5.0, strength=1.0):
    """Progressive gaussian blur towards the bottom edge (shallow DOF)."""
    w, h = img.size
    blurred = img.filter(ImageFilter.GaussianBlur(radius))
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    t = np.clip((yy - start) / max(1e-4, 1.0 - start), 0.0, 1.0)
    a = (t ** 1.4 * strength * 255.0).astype(np.uint8)
    mask = Image.fromarray(np.tile(a, (1, w)), "L")
    return Image.composite(blurred, img, mask)


def dof_top(img, end=0.14, radius=4.0, strength=1.0):
    w, h = img.size
    blurred = img.filter(ImageFilter.GaussianBlur(radius))
    yy = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    t = np.clip((end - yy) / max(1e-4, end), 0.0, 1.0)
    a = (t ** 1.4 * strength * 255.0).astype(np.uint8)
    mask = Image.fromarray(np.tile(a, (1, w)), "L")
    return Image.composite(blurred, img, mask)


# --------------------------------------------------------------------------
# final paper treatment: mottling + grain + vignette + soft warm tint
# --------------------------------------------------------------------------
def finish(img, seed, grain=5.0, vignette=0.20, mottle=0.030):
    base = img.convert("RGB")
    w, h = base.size
    arr = np.asarray(base, dtype=np.float32)
    rng = np.random.default_rng(seed)
    low = smooth_grid(w, h, max(3, w // 48), seed + 101, octaves=3)
    arr *= (1.0 + (low[..., None] - 0.5) * (2.0 * mottle))
    if grain > 0:
        arr += rng.normal(0.0, grain, (h, w, 1)).astype(np.float32)
        arr += rng.normal(0.0, grain * 0.40, (h, w, 3)).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - (w - 1) / 2.0) / (w / 2.0)
    ny = (yy - (h - 1) / 2.0) / (h / 2.0)
    d = np.sqrt(nx * nx + ny * ny) / 1.4142
    v = 1.0 - vignette * np.clip((d - 0.42) / 0.58, 0.0, 1.0) ** 1.7
    arr *= v[..., None]
    arr[..., 0] *= 1.012
    arr[..., 2] *= 0.986
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------
# scene components: mountains, palms, temples, houses and small props
# --------------------------------------------------------------------------
def ridge(d, w, base_y, height, fill, seed, n=5, spread=0.30, jag=0.05):
    """Soft far mountain ridge (gaussian bumps, maximum merged)."""
    rng = random.Random(seed)
    peaks = []
    for _ in range(n):
        cx = rng.uniform(-0.10, 1.10) * w
        hh = height * rng.uniform(0.35, 1.0)
        sig = w * rng.uniform(spread * 0.45, spread * 1.15)
        peaks.append((cx, hh, sig))
    xs = np.linspace(-0.03 * w, 1.03 * w, 240)
    top = np.zeros_like(xs)
    for cx, hh, sig in peaks:
        top = np.maximum(top, hh * np.exp(-((xs - cx) / sig) ** 2))
    if jag:
        top *= 1.0 + jag * np.sin(xs / max(1.0, w) * 27.0 + rng.random() * 6.28)
    pts = [(-0.04 * w, base_y)] + [(float(x), float(base_y - y)) for x, y in zip(xs, top)]
    pts += [(1.04 * w, base_y)]
    poly(d, pts, fill)


def karst_tower(d, cx, base_y, half_w, height, fill, dome=0.16, steps=26):
    """One tower karst hill: steep tapering sides with a rounded summit."""
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        if t <= 1.0 - dome:
            u = t / max(1e-6, 1.0 - dome)
            wdt = half_w * (1.0 - 0.16 * u + 0.06 * math.sin(math.pi * u))
        else:
            u = (t - (1.0 - dome)) / max(1e-6, dome)
            wdt = half_w * 0.84 * math.sqrt(max(0.0, 1.0 - u * u))
        y = base_y - height * t
        left.append((cx - wdt, y))
        right.append((cx + wdt, y))
    poly(d, left + right[::-1], fill)
def karst_range(d, w, base_y, height, fill, seed, count=5,
                min_w=0.055, max_w=0.15, jitter=0.55):
    """A cluster of rounded karst towers along a horizon line."""
    rng = random.Random(seed)
    for i in range(count):
        cx = w * (i + 0.5) / count + rng.uniform(-jitter, jitter) * w / count
        hw = w * rng.uniform(min_w, max_w)
        hh = height * rng.uniform(0.55, 1.0)
        karst_tower(d, cx, base_y, hw, hh, fill, dome=rng.uniform(0.14, 0.26))


def frond(d, ox, oy, ang, length, droop, width, fill):
    """One palm frond: tapered curved leaf."""
    steps = 14
    centre = []
    for i in range(steps + 1):
        t = i / steps
        centre.append((ox + math.cos(ang) * length * t,
                       oy - math.sin(ang) * length * t + droop * length * t * t))
    left, right = [], []
    for i in range(steps + 1):
        cx, cy = centre[i]
        if i == 0:
            dx, dy = centre[1][0] - cx, centre[1][1] - cy
        elif i == steps:
            dx, dy = cx - centre[i - 1][0], cy - centre[i - 1][1]
        else:
            dx = centre[i + 1][0] - centre[i - 1][0]
            dy = centre[i + 1][1] - centre[i - 1][1]
        ln = math.hypot(dx, dy) or 1.0
        px, py = -dy / ln, dx / ln
        t = i / steps
        wgt = width * (1.0 - t) ** 0.75 * (
            0.35 + 0.65 * math.sin(min(1.0, t * 4.0) * math.pi / 2.0))
        left.append((cx + px * wgt, cy + py * wgt))
        right.append((cx - px * wgt, cy - py * wgt))
    poly(d, left + right[::-1], fill)


def palm(d, x, base_y, height, lean=0.10, trunk=TERRACOTTA_DEEP, leaf=SAGE_DARK,
         seed=0, fronds=7, trunk_w=0.030, leaf_w=0.080, crown_drop=0.0):
    """Coconut palm in flat poster style (trunk + fanned fronds + nuts)."""
    rng = random.Random(seed)
    top_x = x + lean * height

    def center(t):
        bx = (1 - t) ** 2 * x + 2 * (1 - t) * t * (x + lean * height * 0.35) + t * t * top_x
        return bx, base_y - t * height

    left, right = [], []
    steps = 12
    for i in range(steps + 1):
        t = i / steps
        bx, by = center(t)
        wid = trunk_w * height * (1.16 - 0.52 * t) * (1.0 + 0.55 * (1.0 - t) ** 4)
        left.append((bx - wid * 0.5, by))
        right.append((bx + wid * 0.5, by))
    poly(d, left + right[::-1], trunk)
    for i in range(3, steps):
        t = i / steps
        bx, by = center(t)
        wid = trunk_w * height * (1.16 - 0.52 * t) * (1.0 + 0.55 * (1.0 - t) ** 4)
        if wid < 2:
            continue
        d.line(P([(bx - wid * 0.46, by), (bx + wid * 0.46, by + 0.6)]),
               fill=darken(trunk, 0.16), width=max(1, int(wid * 0.09)))

    crown_y = base_y - height + crown_drop * height
    for k in range(fronds):
        ang = math.radians(200.0 - 220.0 * (k / max(1, fronds - 1)))
        ang += rng.uniform(-0.07, 0.07)
        length = height * rng.uniform(0.38, 0.55)
        droop = rng.uniform(0.15, 0.34)
        shade = mix(leaf, SAGE, rng.uniform(0.0, 0.35))
        frond(d, top_x, crown_y, ang, length, droop, leaf_w * height * 0.30, shade)
    for _ in range(3):
        ellipse(d, top_x + rng.uniform(-1, 1) * height * 0.02,
                crown_y + height * rng.uniform(0.010, 0.030),
                height * 0.013, height * 0.012, SAND_DEEP)


def birds(d, x, y, size, fill, n=3, seed=0, spread=2.0):
    rng = random.Random(seed)
    for _ in range(n):
        bx = x + rng.uniform(-spread, spread) * size
        by = y + rng.uniform(-0.5, 0.5) * size
        s = size * rng.uniform(0.65, 1.2)
        d.line(P([(bx - s, by), (bx - s * 0.35, by - s * 0.36),
                  (bx, by - s * 0.10), (bx + s * 0.40, by - s * 0.40),
                  (bx + s, by)]),
               fill=fill, width=max(1, int(s * 0.24)), joint="curve")


def grass_tufts(d, x0, x1, y, height, fill, seed=0, n=14, width=3):
    rng = random.Random(seed)
    for _ in range(n):
        bx = rng.uniform(x0, x1)
        hh = height * rng.uniform(0.30, 1.0)
        bend = rng.uniform(-0.55, 0.55) * hh
        base_w = max(1.5, width * rng.uniform(0.8, 1.5))
        left, right = [], []
        for k in range(6):
            t = k / 5
            cx = bx + bend * t * t
            cy = y - hh * t
            wdt = base_w * (1.0 - t) ** 0.65
            left.append((cx - wdt * 0.5, cy))
            right.append((cx + wdt * 0.5, cy))
        poly(d, left + right[::-1], fill)


def reeds(d, x0, x1, y, height, stem, head, seed=0, n=10):
    rng = random.Random(seed)
    for _ in range(n):
        bx = rng.uniform(x0, x1)
        hh = height * rng.uniform(0.45, 1.0)
        bend = rng.uniform(-0.35, 0.35) * hh
        pts = [(bx, y)]
        for k in range(1, 6):
            t = k / 5
            pts.append((bx + bend * t * t, y - hh * t))
        d.line(P(pts), fill=stem, width=max(1, int(height * 0.012)))
        ellipse(d, pts[-1][0], pts[-1][1], height * 0.018, height * 0.045, head)


def foliage(d, cx, cy, rx, ry, colors, seed=0, n=9):
    rng = random.Random(seed)
    for _ in range(n):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0, 1) ** 0.5
        ex = cx + math.cos(a) * rx * rr
        ey = cy + math.sin(a) * ry * rr
        er = max(rx, ry) * rng.uniform(0.22, 0.44)
        ellipse(d, ex, ey, er, er * rng.uniform(0.72, 1.0),
                colors[rng.randrange(len(colors))])


def banana_leaf(d, x, y, length, angle, fill, rib=None):
    local_a, local_b = [], []
    for i in range(8):
        t = i / 7
        wdt = length * 0.20 * math.sin(math.pi * t) ** 0.75
        local_a.append((length * t, -wdt))
        local_b.append((length * t, wdt))
    pts = rot_pts(local_a + local_b[::-1], angle, x, y)
    poly(d, pts, fill)
    if rib is not None:
        d.line(P(rot_pts([(0, 0), (length, 0)], angle, x, y)), fill=rib,
               width=max(1, int(length * 0.014)))


def tree_trunk(d, x, base_y, height, width, color, lean=0.08, seed=0, branches=3):
    rng = random.Random(seed)
    top_x = x + lean * height
    steps = 10
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        bx = (1 - t) ** 2 * x + 2 * (1 - t) * t * (x + lean * height * 0.5) + t * t * top_x
        by = base_y - t * height
        wid = width * (1.0 - 0.45 * t) * (1.0 + 0.55 * (1.0 - t) ** 5)
        left.append((bx - wid / 2, by))
        right.append((bx + wid / 2, by))
    poly(d, left + right[::-1], color)
    for _ in range(branches):
        tt = rng.uniform(0.45, 0.85)
        bx = (1 - tt) ** 2 * x + 2 * (1 - tt) * tt * (x + lean * height * 0.5) + tt * tt * top_x
        by = base_y - height * tt
        ang = math.radians(rng.choice([-1, 1]) * rng.uniform(25, 60))
        ln = height * rng.uniform(0.20, 0.38)
        ex = bx + math.cos(ang) * ln
        ey = by - math.sin(ang) * ln
        d.line(P([(bx, by), (ex, ey)]), fill=color,
               width=max(2, int(width * 0.30)), joint="curve")
        d.line(P([(ex, ey), (ex + math.cos(ang + 0.7) * ln * 0.4,
                             ey - math.sin(ang + 0.7) * ln * 0.4)]),
               fill=color, width=max(1, int(width * 0.16)))
    return top_x, base_y - height


def horsehead_gable(d, end_x, ridge_y, dirn, width, height, tile):
    """Stepped dark tile gable (huizhou 'horse head' wall)."""
    steps = 3
    step_w = width * 0.075
    step_h = height * 0.075
    for k in range(steps):
        wdt = step_w * (steps - k)
        x_out = end_x + dirn * wdt * (0.2 + 0.8 * k / max(1, steps - 1))
        y_top = ridge_y - step_h * (k + 1)
        x0 = min(end_x, x_out)
        x1 = max(end_x, x_out)
        d.rectangle([x0, y_top, x1, ridge_y - step_h * k + 1], fill=tile)


def huizhou_house(d, x, base_y, width, height, wall=WHITE_WALL, tile=TILE,
                  roof=True, gable=True, window=True):
    """Huizhou house: white plaster wall, pitched dark-tile roof, stepped gables."""
    roof_h = height * 0.24
    eave_y = base_y - height
    d.rectangle([x, eave_y, x + width, base_y], fill=wall)
    if window:
        door_w = width * 0.16
        door_x = x + width * 0.20
        d.rectangle([door_x, base_y - height * 0.34, door_x + door_w, base_y],
                    fill=mix(tile, NIGHT, 0.12))
        win_x = x + width * 0.56
        win_y = base_y - height * 0.66
        d.rectangle([win_x, win_y, win_x + width * 0.18, win_y + height * 0.16],
                    fill=mix(tile, SKY_BLUE, 0.18))
    if roof:
        ridge_y = eave_y - roof_h
        poly(d, [(x - width * 0.05, eave_y + height * 0.015),
                 (x + width * 1.05, eave_y + height * 0.015),
                 (x + width * 0.84, ridge_y),
                 (x + width * 0.16, ridge_y)], tile)
        d.rectangle([x + width * 0.14, ridge_y - height * 0.022,
                     x + width * 0.86, ridge_y], fill=darken(tile, 0.18))
        d.rectangle([x - width * 0.05, eave_y + height * 0.015,
                     x + width * 1.05, eave_y + height * 0.045],
                    fill=mix(tile, wall, 0.50))
        if gable:
            step_w = width * 0.085
            step_h = height * 0.085
            for side in (0, 1):
                gx = x if side == 0 else x + width
                dirn = -1 if side == 0 else 1
                for k in range(3):
                    outer = gx + dirn * step_w * (k + 1)
                    top = eave_y - step_h * (k + 1)
                    d.rectangle([min(gx, outer), top, max(gx, outer), eave_y],
                                fill=wall)
                    d.rectangle([min(gx, outer), top - height * 0.022,
                                 max(gx, outer), top], fill=tile)
                tip = gx + dirn * step_w * 3
                d.rectangle([min(tip, tip + dirn * step_w * 0.7),
                             eave_y - step_h * 3 - height * 0.040,
                             max(tip, tip + dirn * step_w * 0.7),
                             eave_y - step_h * 3], fill=tile)
def white_wall(d, x0, y0, x1, y1, wall=WHITE_WALL, seed=0, stains=True):
    """Huizhou white wall with faint plaster stains and a tile cap."""
    d.rectangle([x0, y0, x1, y1], fill=wall)
    if stains:
        rng = random.Random(seed)
        for _ in range(6):
            cx = rng.uniform(x0, x1)
            cy = rng.uniform(y0, y1)
            rx = (x1 - x0) * rng.uniform(0.05, 0.16)
            ry = (y1 - y0) * rng.uniform(0.03, 0.10)
            ellipse(d, cx, cy, rx, ry, mix(wall, STONE_DARK, rng.uniform(0.06, 0.14)))
    cap_h = (y1 - y0) * 0.05
    d.rectangle([x0 - (x1 - x0) * 0.01, y0 - cap_h, x1 + (x1 - x0) * 0.01, y0], fill=TILE)


def chedi(d, cx, base_y, base_w, height, spire_h):
    """Golden Thai chedi: stepped base, two-tone bell, tapering spire."""
    plat_w = base_w
    y = base_y
    for i in range(3):
        wdt = plat_w * (1.0 - i * 0.10)
        hgt = height * 0.055
        d.rectangle([cx - wdt / 2, y - hgt, cx + wdt / 2, y],
                    fill=GOLD_LIGHT if i % 2 == 0 else GOLD)
        y -= hgt
    bell_h = height * 0.52
    bell_bottom = y
    steps = 18
    left, right = [], []
    for i in range(steps + 1):
        t = i / steps
        wdt = base_w * (0.36 - 0.20 * t + 0.14 * math.sin(math.pi * t) ** 0.8)
        wdt = max(wdt, base_w * 0.045)
        yy = bell_bottom - bell_h * t
        left.append((cx - wdt, yy))
        right.append((cx + wdt, yy))
    poly(d, left + right[::-1], GOLD)
    poly(d, left + [(cx, yy) for _, yy in reversed(right)], GOLD_LIGHT)
    ellipse(d, cx, bell_bottom, base_w * 0.36, base_w * 0.055, GOLD_DEEP)
    # shoulder + spire
    shoulder_y = bell_bottom - bell_h
    d.rectangle([cx - base_w * 0.10, shoulder_y - height * 0.045,
                 cx + base_w * 0.10, shoulder_y], fill=GOLD_DEEP)
    spire_base = shoulder_y - height * 0.045
    top_y = spire_base - spire_h
    poly(d, [(cx - base_w * 0.085, spire_base), (cx + base_w * 0.085, spire_base),
             (cx + base_w * 0.012, top_y), (cx - base_w * 0.012, top_y)], GOLD)
    for i in range(4):
        t = i / 4
        yy = spire_base - spire_h * t * 0.72
        wdt = base_w * (0.085 - 0.065 * t)
        d.line([(cx - wdt, yy), (cx + wdt, yy)], fill=GOLD_DEEP,
               width=max(1, int(base_w * 0.012)))
    ellipse(d, cx, top_y - height * 0.012, base_w * 0.028, base_w * 0.028, GOLD_LIGHT)


def cormorant(d, x, y, s, fill, wings=False, facing=1):
    """Standing cormorant silhouette (dark bird, long neck, hooked beak)."""
    ellipse(d, x, y - s * 0.46, s * 0.56, s * 0.40, fill)
    poly(d, [(x - facing * s * 0.52, y - s * 0.54),
             (x - facing * s * 1.02, y - s * 0.34),
             (x - facing * s * 0.44, y - s * 0.20)], fill)
    nx = x + facing * s * 0.30
    d.line(P([(x + facing * s * 0.10, y - s * 0.72),
              (nx, y - s * 1.02),
              (nx + facing * s * 0.10, y - s * 1.18)]),
           fill=fill, width=max(2, int(s * 0.17)), joint="curve")
    ellipse(d, nx + facing * s * 0.11, y - s * 1.24, s * 0.16, s * 0.14, fill)
    poly(d, [(nx + facing * s * 0.24, y - s * 1.27),
             (nx + facing * s * 0.60, y - s * 1.14),
             (nx + facing * s * 0.23, y - s * 1.16)], fill)
    if wings:
        poly(d, [(x - facing * s * 0.24, y - s * 0.58),
                 (x - facing * s * 0.62, y - s * 1.42),
                 (x - facing * s * 1.18, y - s * 1.82),
                 (x - facing * s * 1.34, y - s * 1.52),
                 (x - facing * s * 0.92, y - s * 0.90),
                 (x - facing * s * 0.58, y - s * 0.32)], fill)
        poly(d, [(x + facing * s * 0.08, y - s * 0.60),
                 (x + facing * s * 0.46, y - s * 1.46),
                 (x + facing * s * 1.02, y - s * 1.86),
                 (x + facing * s * 1.18, y - s * 1.56),
                 (x + facing * s * 0.78, y - s * 0.92),
                 (x + facing * s * 0.50, y - s * 0.34)], fill)
    d.line([(x - s * 0.10, y), (x - s * 0.10, y - s * 0.10)], fill=fill,
           width=max(1, int(s * 0.10)))
    d.line([(x + s * 0.10, y), (x + s * 0.10, y - s * 0.10)], fill=fill,
           width=max(1, int(s * 0.10)))


def bamboo_raft(d, cx, cy, length, width, angle, body=SAND, line=SAND_DEEP):
    ca, sa = math.cos(angle), math.sin(angle)
    pts = rot_pts([(-length / 2, -width / 2), (length / 2, -width * 0.30),
                   (length / 2, width * 0.30), (-length / 2, width / 2)],
                  angle, cx, cy)
    poly(d, pts, body)
    for i in range(7):
        t = (i + 0.5) / 7 - 0.5
        p1 = rot_pts([(-length / 2, t * width * 0.95)], angle, cx, cy)[0]
        p2 = rot_pts([(length / 2, t * width * 0.60)], angle, cx, cy)[0]
        d.line([p1, p2], fill=line, width=max(1, int(width * 0.035)))
    for i in range(5):
        t = (i + 0.5) / 5 - 0.5
        p1 = rot_pts([(t * length * 0.96, -width * 0.5)], angle, cx, cy)[0]
        p2 = rot_pts([(t * length * 0.96, width * 0.5)], angle, cx, cy)[0]
        d.line([p1, p2], fill=line, width=max(1, int(width * 0.05)))


def string_lights(img, p0, p1, sag, color=GOLD_LIGHT, n=9, seed=0):
    """Catenary-ish cord with warm bulbs and a soft glow."""
    w, h = img.size
    d = ImageDraw.Draw(img)
    x0, y0 = p0
    x1, y1 = p1
    pts = []
    for i in range(n * 4 + 1):
        t = i / (n * 4)
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4.0 * t * (1.0 - t)
        pts.append((x, y))
    d.line(P(pts), fill=darken(DEEP_TEAL, 0.28), width=max(1, int(min(w, h) * 0.003)))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    bulbs = []
    for i in range(n):
        t = (i + 0.5) / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4.0 * t * (1.0 - t)
        bulbs.append((x, y))
        r = max(2.0, min(w, h) * 0.006)
        ld.ellipse([x - r * 4, y - r * 4, x + r * 4, y + r * 4], fill=rgba(color, 46))
        ld.ellipse([x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2],
                   fill=rgba(color, 105))
        ld.ellipse([x - r, y - r, x + r, y + r], fill=rgba(CREAM_LIGHT, 235))
    layer = layer.filter(ImageFilter.GaussianBlur(min(w, h) * 0.004))
    img = comp(img, layer)
    d = ImageDraw.Draw(img)
    r = max(1.4, min(w, h) * 0.0035)
    for x, y in bulbs:
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(color))
    return img


def light_shafts(img, x_top, y_top, y_bottom, width_top, width_bottom,
                 color=CREAM_LIGHT, opacity=0.16, seed=0, n=3, spread=0.3,
                 slant=0.12, blur=12):
    w, h = img.size
    rng = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        cx = x_top + rng.uniform(-spread, spread) * w
        tw = width_top * rng.uniform(0.6, 1.25)
        bw = width_bottom * rng.uniform(0.7, 1.3)
        dx = slant * (y_bottom - y_top)
        poly(d, [(cx - tw / 2, y_top), (cx + tw / 2, y_top),
                 (cx + dx + bw / 2, y_bottom), (cx + dx - bw / 2, y_bottom)],
             rgba(color, int(opacity * 255)))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return comp(img, layer)


def ground_shadow(img, cx, cy, rx, ry, color=NIGHT, opacity=0.28, blur=8):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ellipse(d, cx, cy, rx, ry, rgba(color, int(opacity * 255)))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return comp(img, layer)


def lens_pts(length, half_width, n=26, power=0.7):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (t - 0.5) * length
        wdt = half_width * max(0.0, math.sin(math.pi * t)) ** power
        pts.append((x, -wdt))
    for i in range(n, -1, -1):
        t = i / n
        x = (t - 0.5) * length
        wdt = half_width * max(0.0, math.sin(math.pi * t)) ** power
        pts.append((x, wdt))
    return pts


def surfboard(d, cx, cy, length, half_width, angle, body=SAND,
              stripe=TERRACOTTA, fin=DEEP_TEAL):
    poly(d, rot_pts(lens_pts(length, half_width), angle, cx, cy), body)
    poly(d, rot_pts(lens_pts(length * 0.96, half_width * 0.26), angle, cx, cy), stripe)
    tail = rot_pts([(-length * 0.46, half_width * 0.20),
                    (-length * 0.60, half_width * 0.62),
                    (-length * 0.42, half_width * 0.34)], angle, cx, cy)
    poly(d, tail, fin)


def paddle(d, cx, cy, angle, length, blade=TERRACOTTA, handle=WOOD):
    blade_pts = [(math.cos(a) * length * 0.17, -length * 0.28 + math.sin(a) * length * 0.25)
                 for a in np.linspace(0.0, math.tau, 30)]
    poly(d, rot_pts(blade_pts, angle, cx, cy), blade)
    poly(d, rot_pts([(-length * 0.035, -length * 0.08),
                     (length * 0.035, -length * 0.08),
                     (length * 0.030, length * 0.50),
                     (-length * 0.030, length * 0.50)], angle, cx, cy), handle)


def plate(d, cx, cy, rx, ry, rim=TERRACOTTA, inner=CREAM_LIGHT):
    ellipse(d, cx, cy, rx, ry, mix(rim, NIGHT, 0.12))
    ellipse(d, cx, cy, rx * 0.88, ry * 0.88, rim)
    ellipse(d, cx, cy, rx * 0.72, ry * 0.72, inner)


def bowl(d, cx, cy, rx, ry, fill, lip=CREAM_LIGHT):
    ellipse(d, cx, cy, rx, ry, lip)
    d.pieslice([cx - rx, cy - ry * 0.75, cx + rx, cy + ry * 1.35],
               start=0, end=180, fill=fill)
    ellipse(d, cx, cy, rx * 0.92, ry * 0.92, fill)


def glass(d, cx, base_y, wdt, hgt, liquid=GOLD, glass_col=None):
    glass_col = glass_col or mix(CREAM_LIGHT, SKY_BLUE, 0.25)
    poly(d, [(cx - wdt / 2, base_y - hgt), (cx + wdt / 2, base_y - hgt),
             (cx + wdt * 0.36, base_y), (cx - wdt * 0.36, base_y)], glass_col)
    lt = liquid if not isinstance(liquid, tuple) else liquid
    poly(d, [(cx - wdt * 0.40, base_y - hgt * 0.55),
             (cx + wdt * 0.40, base_y - hgt * 0.55),
             (cx + wdt * 0.34, base_y), (cx - wdt * 0.34, base_y)], lt)
    d.line([(cx - wdt * 0.42, base_y - hgt * 0.92),
            (cx - wdt * 0.36, base_y - hgt * 0.20)],
           fill=rgba(CREAM_LIGHT, 210), width=max(1, int(wdt * 0.07)))


def fish(d, x, y, s, body, angle=0.0):
    poly(d, rot_pts(lens_pts(s * 1.7, s * 0.52, power=0.85), angle, x, y), body)
    poly(d, rot_pts([(s * 0.78, 0), (s * 1.30, -s * 0.42),
                     (s * 1.30, s * 0.42)], angle, x, y), body)
    stripe = mix(body, CREAM_LIGHT, 0.28)
    poly(d, rot_pts(lens_pts(s * 0.6, s * 0.16, power=0.9), angle, x, y), stripe)


def blossom(d, x, y, r, petal, heart, petals=5, angle=0.0):
    for k in range(petals):
        a = angle + k * math.tau / petals
        ellipse(d, x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55,
                r * 0.52, r * 0.52, petal)
    ellipse(d, x, y, r * 0.26, r * 0.26, heart)


def blossoms(d, cx, cy, rx, ry, petals, hearts, seed=0, n=70, size=(0.20, 0.42)):
    rng = random.Random(seed)
    for _ in range(n):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0, 1) ** 0.55
        x = cx + math.cos(a) * rx * rr
        y = cy + math.sin(a) * ry * rr
        r = min(rx, ry) * rng.uniform(*size)
        blossom(d, x, y, r, petals[rng.randrange(len(petals))],
                hearts[rng.randrange(len(hearts))],
                angle=rng.uniform(0, math.tau))


def paving(d, x0, y0, x1, y1, base, line, seed=0, rows=7, cols=5, gap=None):
    """Irregular stone slabs (no perspective, flat poster look)."""
    rng = random.Random(seed)
    d.rectangle([x0, y0, x1, y1], fill=base)
    if gap is None:
        gap = max(1.0, (x1 - x0) * 0.004)
    xs = [x0 + (x1 - x0) * i / cols for i in range(cols + 1)]
    for r in range(rows):
        yA = y0 + (y1 - y0) * r / rows
        yB = y0 + (y1 - y0) * (r + 1) / rows
        offset = rng.uniform(-0.35, 0.35) * (x1 - x0) / cols
        for c in range(cols):
            ax = xs[c] + offset + rng.uniform(-0.12, 0.12) * (x1 - x0) / cols
            bx = xs[c + 1] + offset + rng.uniform(-0.12, 0.12) * (x1 - x0) / cols
            ax = max(x0, min(x1, ax))
            bx = max(x0, min(x1, bx))
            if bx - ax < gap * 4:
                continue
            col = mix(base, line, rng.uniform(0.0, 0.22))
            d.rectangle([ax + gap, yA + gap, bx - gap, yB - gap], fill=col)


def check_cloth(d, x0, y0, x1, y1, base, line, cell, alpha=0.55):
    """Gingham table cloth: two sets of soft stripes."""
    d.rectangle([x0, y0, x1, y1], fill=base)
    col = mix(base, line, alpha)
    width = max(1, int((x1 - x0) * 0.008))
    x = x0
    while x <= x1:
        d.rectangle([x, y0, x + width, y1], fill=col)
        x += cell
    y = y0
    while y <= y1:
        d.rectangle([x0, y, x1, y + width], fill=col)
        y += cell


def leaf_clusters(d, cx, cy, rx, ry, colors, seed=0, n=12):
    foliage(d, cx, cy, rx, ry, colors, seed, n)


# --------------------------------------------------------------------------
# extra props + sea helpers used by several scenes
# --------------------------------------------------------------------------
def sailboat(d, x, y, s, sail=CREAM_LIGHT, hull=DEEP_TEAL):
    d.line([(x - s * 0.55, y), (x + s * 0.55, y)], fill=hull, width=max(1, int(s * 0.10)))
    poly(d, [(x, y - s * 1.05), (x, y - s * 0.08), (x - s * 0.44, y - s * 0.08)], sail)
    poly(d, [(x + s * 0.06, y - s * 0.92), (x + s * 0.06, y - s * 0.08),
             (x + s * 0.40, y - s * 0.08)], mix(sail, TERRACOTTA, 0.18))


def spoon(d, x, y, angle, length, fill=STONE):
    ell = [(math.cos(a) * length * 0.13, math.sin(a) * length * 0.20)
           for a in np.linspace(0, math.tau, 20)]
    poly(d, rot_pts(ell, angle, x, y), fill)
    poly(d, rot_pts([(-length * 0.025, length * 0.16),
                     (length * 0.025, length * 0.16),
                     (length * 0.018, length * 0.52),
                     (-length * 0.018, length * 0.52)], angle, x, y),
         mix(fill, NIGHT, 0.12))


def shape_shadow(img, pts, offset=(0, 0), color=NIGHT, opacity=0.30, blur=6):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    poly(d, [(x + offset[0], y + offset[1]) for x, y in pts],
         rgba(color, int(opacity * 255)))
    return comp(img, layer.filter(ImageFilter.GaussianBlur(blur)))


def seascape(w, h, horizon, sky_stops, sea_stops, sun_xy=None, sun_r=0.0,
             sun_core=CREAM_LIGHT, sun_halo="#f0c08d", glow=0.85,
             shimmer_color=CREAM_LIGHT, shimmer_alpha=85, shimmer_seed=1,
             horizon_haze=0.30, haze_seed=2):
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, horizon, sky_stops)
    img = fill_grad(img, horizon, h, sea_stops)
    if sun_xy is not None and sun_r > 0:
        img = sun(img, sun_xy[0], sun_xy[1], sun_r, sun_core, sun_halo, glow)
    if horizon_haze > 0:
        img = soft_band(img, horizon - h * 0.035, horizon + h * 0.030,
                        CREAM_LIGHT, horizon_haze, haze_seed, cells=4,
                        contrast=1.7, thresh=0.34, blur=max(2.0, h * 0.014))
    if shimmer_alpha > 0:
        img = shimmer(img, horizon + h * 0.004,
                      min(h, horizon + (h - horizon) * 0.62),
                      shimmer_color, shimmer_alpha, shimmer_seed,
                      n=max(40, int(w / 14)),
                      center=sun_xy[0] if sun_xy else None, spread=0.16)
    return img


def wave_band(img, y_base, amp, wavelength, phase, color, foam=None):
    w, h = img.size
    d = ImageDraw.Draw(img)
    pts = []
    step = max(2, w // 140)
    for i in range(0, w + step, step):
        t = i / w
        yy = (y_base + amp * math.sin(t * math.tau * wavelength + phase)
              + amp * 0.25 * math.sin(t * math.tau * wavelength * 2.7 + phase * 1.7))
        pts.append((i, yy))
    poly(d, pts + [(w + step, h + 4), (0, h + 4)], color)
    if foam:
        d.line(P(pts), fill=foam, width=max(2, int(h * 0.0055)))
        rng = random.Random(int(phase * 1000) + 7)
        for _ in range(max(8, w // 90)):
            k = rng.randrange(len(pts))
            x, y = pts[k]
            r = max(1.0, h * rng.uniform(0.0015, 0.005))
            ellipse(d, x + rng.uniform(-w * 0.008, w * 0.008),
                    y + rng.uniform(-h * 0.006, h * 0.014), r, r * 0.8, foam)
    return img


def table_cloth(img, cx, cy, rx, ry, bottom, fold_color, rim_color):
    """Table in near-eye view: draped cloth + elliptical top."""
    w, h = img.size
    img = ground_shadow(img, cx, bottom - h * 0.010, rx * 1.04, h * 0.030,
                        opacity=0.28, blur=w * 0.02)
    d = ImageDraw.Draw(img)
    poly(d, [(cx - rx * 0.95, cy), (cx + rx * 0.95, cy),
             (cx + rx * 1.06, bottom + h * 0.02),
             (cx - rx * 1.06, bottom + h * 0.02)], CREAM)
    for i in range(9):
        x = cx - rx + 2.0 * rx * (i + 0.5) / 9.0
        d.line([(x, cy), (x + (i - 4) * rx * 0.035, bottom + h * 0.02)],
               fill=fold_color, width=max(1, int(w * 0.0035)))
    ellipse(d, cx, cy, rx, ry, rim_color)
    ellipse(d, cx, cy, rx * 0.975, ry * 0.960, CREAM_LIGHT)
    return img


# --------------------------------------------------------------------------
# SABAH -- the seaside resort
# --------------------------------------------------------------------------
def draw_sabah_dining_1(w, h):
    """Seaside table at golden hour: two place settings, spoons, dessert."""
    rng = random.Random("sabah-dining-1")
    horizon = h * 0.485
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#4d707a"), (0.26, "#7f9fa7"), (0.58, "#d3b3a2"),
                   (0.85, "#edc6a1"), (1.0, "#f6d8b0")],
        sea_stops=[(0.0, "#f3d3ad"), (0.16, "#d0a996"), (0.52, "#829b93"),
                   (1.0, "#4d6c6c")],
        sun_xy=(w * 0.60, horizon - h * 0.045), sun_r=h * 0.040,
        sun_halo="#f3c692", glow=0.9, shimmer_color="#f8e0c2",
        shimmer_alpha=95, shimmer_seed=21, horizon_haze=0.28, haze_seed=22,
    )
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + h * 0.001, h * 0.05, "#93ada6", seed=3, n=3,
          spread=0.12, jag=0.04)
    sailboat(d, w * 0.845, horizon - h * 0.002, h * 0.042, "#f1e2c6")
    birds(d, w * 0.70, h * 0.16, h * 0.0060, "#5c6f6b", n=4, seed=5, spread=3.0)

    # palms framing the table, softened by distance
    palm(d, -w * 0.05, h * 1.02, h * 0.82, lean=0.18, trunk="#6a7c68",
         leaf="#6f8a63", seed=11, fronds=7, trunk_w=0.024, leaf_w=0.045)
    palm(d, w * 1.05, h * 0.96, h * 0.62, lean=-0.15, trunk="#67796a",
         leaf="#68835e", seed=12, fronds=6, trunk_w=0.021, leaf_w=0.042)

    # table
    tc_x, tc_y = w * 0.50, h * 0.795
    trx, try_ = w * 0.44, h * 0.105
    img = table_cloth(img, tc_x, tc_y, trx, try_, h * 0.985,
                      mix(CREAM, SAND, 0.32), mix(TERRACOTTA, CREAM, 0.55))
    d = ImageDraw.Draw(img)
    settings = [(w * 0.315, h * 0.800), (w * 0.675, h * 0.822)]
    for px, py in settings:
        ellipse(d, px, py, w * 0.128, h * 0.043,
                mix(TERRACOTTA, CREAM, 0.35))
    plate(d, settings[0][0], settings[0][1] - h * 0.004, w * 0.100, h * 0.033)
    plate(d, settings[1][0], settings[1][1] - h * 0.004, w * 0.100, h * 0.033)
    # dessert on the left plate
    cx, cy = settings[0][0], settings[0][1] - h * 0.010
    ellipse(d, cx, cy, w * 0.050, h * 0.019, mix(TERRACOTTA, SAND, 0.40))
    ellipse(d, cx, cy - h * 0.013, w * 0.041, h * 0.014, CREAM_LIGHT)
    berry = mix(DUSK_PINK, "#a84f4a", 0.35)
    for bx, by, br in ((-0.022, -0.020, 0.008), (0.000, -0.026, 0.009),
                       (0.023, -0.018, 0.007), (0.008, -0.013, 0.006)):
        ellipse(d, cx + w * bx, cy + h * by, w * br, h * br * 0.85, berry)
    ellipse(d, cx + w * 0.036, cy - h * 0.032, w * 0.012, h * 0.005,
            mix(SAGE_DARK, CREAM, 0.15))
    # citrus slices on the right plate
    cx2, cy2 = settings[1][0], settings[1][1] - h * 0.008
    for k in (-1, 0, 1):
        ox = cx2 + k * w * 0.030
        oy = cy2 + (abs(k) % 2) * h * 0.004
        ellipse(d, ox, oy, w * 0.027, h * 0.010, mix(GOLD, TERRACOTTA, 0.25))
        ellipse(d, ox, oy, w * 0.020, h * 0.0075, GOLD_LIGHT)
        for j in range(5):
            a = math.pi * (0.15 + 0.7 * j / 4) + math.pi
            d.line([(ox, oy), (ox + math.cos(a) * w * 0.018,
                               oy + math.sin(a) * h * 0.0065)],
                   fill=mix(GOLD, CREAM, 0.15), width=max(1, int(w * 0.0022)))
    # cutlery
    spoon(d, w * 0.415, h * 0.804, math.radians(8), h * 0.085, STONE)
    spoon(d, w * 0.575, h * 0.826, math.radians(-8), h * 0.085, STONE)
    # glasses + little vase
    glass(d, w * 0.455, h * 0.762, w * 0.037, h * 0.050,
          liquid=mix(GOLD, TERRACOTTA, 0.30))
    glass(d, w * 0.548, h * 0.748, w * 0.037, h * 0.050, liquid="#e8c37a")
    ellipse(d, w * 0.502, h * 0.742, w * 0.017, h * 0.012,
            mix(TERRACOTTA, CREAM, 0.35))
    for k in range(3):
        a = math.radians(-115 + k * 38)
        tipx = w * 0.502 + math.cos(a) * w * 0.030
        tipy = h * 0.742 + math.sin(a) * h * 0.026
        d.line([(w * 0.502, h * 0.742), (tipx, tipy)], fill=SAGE,
               width=max(1, int(w * 0.0028)))
        blossom(d, tipx, tipy, w * 0.010, DUSK_PALE, mix(GOLD, TERRACOTTA, 0.3))
    img = add_glow(img, w * 0.52, h * 0.72, w * 0.22, "#f6d7a8", 0.20)
    img = dof_bottom(img, 0.945, radius=h * 0.004)
    return img


def draw_sabah_dining_2(w, h):
    """Sea-view terrace: railing, scalloped parasol, cafe table, far ocean."""
    rng = random.Random("sabah-dining-2")
    horizon = h * 0.395
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#7fa0a8"), (0.30, "#b4c7c3"), (0.68, "#e3dcc4"),
                   (1.0, "#f4e6c8")],
        sea_stops=[(0.0, "#cfe0da"), (0.35, "#a9c9d1"), (1.0, "#7c9a9b")],
        sun_xy=(w * 0.74, h * 0.115), sun_r=h * 0.030, sun_halo="#f2d6b0",
        glow=0.55, shimmer_color=CREAM_LIGHT, shimmer_alpha=55,
        shimmer_seed=31, horizon_haze=0.32, haze_seed=32,
    )
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + h * 0.001, h * 0.060, "#9db3ac", seed=4, n=4,
          spread=0.16, jag=0.05)
    birds(d, w * 0.30, h * 0.16, h * 0.0050, "#5d726d", n=3, seed=6, spread=3.2)
    soft_band(img, h * 0.10, h * 0.30, "#f8f0da", 0.30, 33, cells=5,
              contrast=2.2, thresh=0.46, blur=h * 0.012)
    img = soft_band(img, h * 0.10, h * 0.30, "#f8f0da", 0.25, 33, cells=5,
                    contrast=2.2, thresh=0.46, blur=h * 0.012)
    # terrace floor
    img = fill_grad(img, h * 0.775, h,
                    [(0.0, "#dcc7a0"), (0.55, "#cdb488"), (1.0, "#b9a077")])
    d = ImageDraw.Draw(img)
    vpx, vpy = w * 0.5, h * 0.52
    for i in range(13):
        bx = w * (i / 12.0)
        tx = vpx + (bx - vpx) * 0.30
        d.line([(tx, h * 0.775), (bx, h)], fill=mix(SAND_DEEP, NIGHT, 0.18),
               width=max(1, int(w * 0.0026)))
    for yy in (0.815, 0.873, 0.938):
        d.line([(0, h * yy), (w, h * yy)], fill=mix(SAND_DEEP, NIGHT, 0.12),
               width=max(1, int(h * 0.0022)))
    # railing
    rail_top, rail_bot = h * 0.655, h * 0.760
    rail_col = mix(CREAM_LIGHT, SAND, 0.35)
    d.rectangle([0, rail_top, w, rail_top + h * 0.014], fill=rail_col)
    d.rectangle([0, rail_top + h * 0.014, w, rail_top + h * 0.019],
                fill=mix(rail_col, NIGHT, 0.30))
    d.rectangle([0, rail_bot - h * 0.010, w, rail_bot], fill=rail_col)
    n_posts = 11
    for i in range(n_posts):
        x = w * (i + 0.5) / n_posts + (i % 2) * w * 0.006
        d.rounded_rectangle([x - w * 0.0055, rail_top + h * 0.016,
                             x + w * 0.0055, rail_bot - h * 0.008],
                            radius=w * 0.004, fill=mix(rail_col, SKY_BLUE, 0.25))
    # parasol
    ux, uy = w * 0.285, h * 0.215
    ur = w * 0.255
    dome = []
    for i in range(41):
        t = i / 40
        a = math.pi + t * math.pi
        rr = ur * (1.0 + 0.035 * math.sin(t * math.pi * 8.0))
        dome.append((ux + math.cos(a) * rr, uy + math.sin(a) * rr * 0.55))
    d.line(P([(ux - ur, uy), (ux + ur, uy)]), fill=mix(TERRACOTTA, NIGHT, 0.25),
           width=max(2, int(w * 0.006)))
    poly(d, dome + [(ux + ur, uy), (ux - ur, uy)], TERRACOTTA)
    for i in range(8):
        a0 = math.pi + i * math.pi / 8.0
        a1 = a0 + math.pi / 8.0
        pts = [(ux, uy - ur * 0.42)]
        for j in range(7):
            a = a0 + (a1 - a0) * j / 6.0
            pts.append((ux + math.cos(a) * ur * 0.96,
                        uy + math.sin(a) * ur * 0.55 * 0.96))
        poly(d, pts, mix(TERRACOTTA, CREAM, 0.52))
    d.ellipse([ux - ur * 0.05, uy - ur * 0.56, ux + ur * 0.05, uy - ur * 0.44],
              fill=mix(TERRACOTTA, NIGHT, 0.25))
    pole_col = WOOD
    d.line([(ux, uy - ur * 0.40), (ux + w * 0.012, h * 0.80)],
           fill=pole_col, width=max(3, int(w * 0.012)))
    # cafe table + chairs on the terrace
    tx, ty = w * 0.295, h * 0.855
    trx, try_ = w * 0.155, h * 0.028
    for sx, sy in ((-0.20, 0.006), (0.20, 0.002)):
        cx = tx + w * sx
        cy = ty + h * sy
        d.rounded_rectangle([cx - w * 0.038, cy - h * 0.062,
                             cx + w * 0.038, cy + h * 0.010],
                            radius=w * 0.014, fill=mix(DEEP_TEAL, TEAL_MID, 0.22))
        d.rounded_rectangle([cx - w * 0.042, cy + h * 0.008,
                             cx + w * 0.042, cy + h * 0.030],
                            radius=w * 0.010, fill=mix(DEEP_TEAL, TEAL_MID, 0.30))
        for lx in (-0.028, 0.028):
            d.line([(cx + w * lx, cy + h * 0.030), (cx + w * lx * 1.1, cy + h * 0.070)],
                   fill=mix(NIGHT, TEAL_MID, 0.20), width=max(2, int(w * 0.006)))
    ellipse(d, tx, ty, trx, try_, mix(CREAM, SAND, 0.25))
    d.rectangle([tx - trx * 0.10, ty, tx + trx * 0.10, h * 0.915],
                fill=mix(CREAM, SAND, 0.45))
    glass(d, tx - w * 0.045, ty - h * 0.004, w * 0.030, h * 0.042,
          liquid=mix(GOLD, TERRACOTTA, 0.25))
    glass(d, tx + w * 0.040, ty - h * 0.002, w * 0.030, h * 0.042, liquid="#e6bd78")
    # potted plant on the right
    pot_x, pot_y = w * 0.865, h * 0.905
    for k in range(5):
        a = math.radians(-150 + k * 30)
        banana_leaf(d, pot_x, pot_y - h * 0.030, h * 0.20,
                    a, mix(SAGE_DARK, SAGE, 0.25), mix(SAGE_DEEP, NIGHT, 0.2))
    poly(d, [(pot_x - w * 0.050, h * 0.845), (pot_x + w * 0.050, h * 0.845),
             (pot_x + w * 0.036, h * 0.945), (pot_x - w * 0.036, h * 0.945)],
         mix(TERRACOTTA, SAND, 0.35))
    d.rectangle([pot_x - w * 0.052, h * 0.840, pot_x + w * 0.052, h * 0.852],
                fill=mix(TERRACOTTA, NIGHT, 0.20))
    img = add_glow(img, w * 0.74, h * 0.13, w * 0.35, "#f3d8b4", 0.28)
    img = dof_bottom(img, 0.935, radius=h * 0.0045)
    return img


def draw_sabah_pingpong(w, h):
    """Blue table-tennis table on the sand, orange paddles, late light."""
    horizon = h * 0.305
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#8ba7ae"), (0.34, "#c2cfc6"), (0.70, "#e6d6b4"),
                   (1.0, "#f2dbae")],
        sea_stops=[(0.0, "#d7e5dc"), (0.35, "#b3cdd2"), (1.0, "#8fabab")],
        sun_xy=(w * 0.86, h * 0.075), sun_r=h * 0.028, sun_halo="#f4d8ae",
        glow=0.55, shimmer_color=CREAM_LIGHT, shimmer_alpha=50,
        shimmer_seed=41, horizon_haze=0.30, haze_seed=42,
    )
    img = fill_grad(img, h * 0.368, h,
                    [(0.0, "#e8d5b0"), (0.45, "#e2cfa8"), (1.0, "#c9b088")])
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + h * 0.002, h * 0.052, "#9db3a8", seed=7, n=4,
          spread=0.14, jag=0.05)
    palm(d, w * 0.05, h * 0.435, h * 0.17, lean=0.14, trunk="#7e8f79",
         leaf="#7b9570", seed=8, fronds=5, trunk_w=0.020, leaf_w=0.040)
    palm(d, w * 0.955, h * 0.405, h * 0.13, lean=-0.16, trunk="#7e8f79",
         leaf="#7b9570", seed=9, fronds=5, trunk_w=0.020, leaf_w=0.040)
    birds(d, w * 0.16, h * 0.10, h * 0.005, "#6a7c76", n=3, seed=10, spread=3.0)
    for k in range(9):
        yy = h * (0.44 + 0.062 * k)
        pts = [(i, yy + h * 0.008 * math.sin(i / w * math.tau * 1.4 + k * 1.3))
               for i in range(0, w + 1, max(4, w // 60))]
        d.line(P(pts), fill=mix(SAND_DEEP, CREAM, 0.32),
               width=max(1, int(h * 0.0018)))

    far_y, near_y = h * 0.505, h * 0.700
    far_l, far_r = w * 0.255, w * 0.745
    near_l, near_r = w * 0.140, w * 0.860
    blue = "#4f86a3"
    blue_dark = mix(blue, NIGHT, 0.32)
    top_quad = [(far_l, far_y), (far_r, far_y), (near_r, near_y), (near_l, near_y)]
    img = shape_shadow(img, top_quad, offset=(w * 0.020, h * 0.052),
                       color="#8a7a5e", opacity=0.28, blur=w * 0.018)
    d = ImageDraw.Draw(img)
    for fx, fy, bx, by in ((0.175, 0.714, 0.150, 0.805), (0.825, 0.714, 0.850, 0.805),
                           (0.285, 0.714, 0.272, 0.788), (0.715, 0.714, 0.728, 0.788)):
        d.line([(w * fx, h * fy), (w * bx, h * by)], fill=blue_dark,
               width=max(2, int(w * 0.013)))
        ellipse(d, w * bx, h * by, w * 0.013, h * 0.005, mix(blue_dark, NIGHT, 0.25))
    poly(d, [(near_l, near_y), (near_r, near_y),
             (near_r - w * 0.006, near_y + h * 0.021),
             (near_l + w * 0.006, near_y + h * 0.021)], blue_dark)
    poly(d, top_quad, blue)
    m = w * 0.020
    line_w = max(2, int(h * 0.0032))
    d.line([(far_l + m, far_y + h * 0.004), (far_r - m, far_y + h * 0.004)],
           fill=CREAM_LIGHT, width=line_w)
    d.line([(near_l + m, near_y - h * 0.004), (near_r - m, near_y - h * 0.004)],
           fill=CREAM_LIGHT, width=line_w)
    d.line([(far_l + m, far_y + h * 0.004), (near_l + m, near_y - h * 0.004)],
           fill=CREAM_LIGHT, width=line_w)
    d.line([(far_r - m, far_y + h * 0.004), (near_r - m, near_y - h * 0.004)],
           fill=CREAM_LIGHT, width=line_w)
    d.line([(w * 0.5, far_y + h * 0.005), (w * 0.5, near_y - h * 0.004)],
           fill=CREAM_LIGHT, width=max(2, int(w * 0.0042)))

    # net, perspective band across the middle of the table
    t_net = 0.45
    ny = far_y + (near_y - far_y) * t_net
    nl = far_l + (near_l - far_l) * t_net
    nr = far_r + (near_r - far_r) * t_net
    net_h = h * 0.044
    top_curve = []
    for i in range(25):
        u = i / 24
        x = nl + (nr - nl) * u
        sag = math.sin(math.pi * u) * h * 0.0042
        top_curve.append((x, ny - net_h - sag))
    mesh_bottom = ny + h * 0.002
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    poly(ld, top_curve + [(x, mesh_bottom) for x, _ in reversed(top_curve)],
         rgba(CREAM_LIGHT, 55))
    for k in range(1, 5):
        f = k / 5.0
        ld.line(P([(x, y + (mesh_bottom - y) * f) for x, y in top_curve]),
                fill=rgba(CREAM_LIGHT, 125), width=max(1, int(w * 0.0016)))
    for i in range(1, 24):
        x, y = top_curve[i]
        ld.line([(x, y), (x, mesh_bottom)], fill=rgba(CREAM_LIGHT, 125),
                width=max(1, int(w * 0.0015)))
    img = comp(img, layer)
    d = ImageDraw.Draw(img)
    d.line(P(top_curve), fill=CREAM_LIGHT, width=max(3, int(h * 0.0062)))
    post_w = w * 0.013
    for x, y in (top_curve[0], top_curve[-1]):
        d.rounded_rectangle([x - post_w / 2, y - h * 0.004,
                             x + post_w / 2, mesh_bottom + h * 0.012],
                            radius=post_w * 0.5, fill=CREAM_LIGHT)

    # paddles + ball
    paddle(d, w * 0.360, h * 0.600, math.radians(68), h * 0.150)
    paddle(d, w * 0.680, h * 0.622, math.radians(-112), h * 0.145,
           blade=mix(TERRACOTTA, GOLD, 0.12))
    ball_x, ball_y = w * 0.585, h * 0.628
    ellipse(d, ball_x + w * 0.003, ball_y + h * 0.010, w * 0.009,
            h * 0.004, mix(SAND_DEEP, NIGHT, 0.25))
    ellipse(d, ball_x, ball_y, w * 0.010, h * 0.0068, CREAM_LIGHT)
    ellipse(d, ball_x - w * 0.002, ball_y - h * 0.002, w * 0.004,
            h * 0.0026, mix(CREAM_LIGHT, SAND, 0.25))

    # palm fronds framing the top corners
    for ang, ln in ((-24, 0.36), (-62, 0.32), (-102, 0.30)):
        frond(d, -w * 0.015, -h * 0.02, math.radians(ang), h * ln, 0.26,
              w * 0.050, mix(SAGE_DARK, SAGE, 0.18))
    for ang, ln in ((-156, 0.34), (-118, 0.30), (-78, 0.27)):
        frond(d, w * 1.015, -h * 0.02, math.radians(ang), h * ln, 0.26,
              w * 0.048, mix(SAGE_DEEP, SAGE, 0.20))
    grass_tufts(d, w * 0.02, w * 0.20, h * 1.01, h * 0.10, SAGE_DARK,
                seed=15, n=10, width=w * 0.006)
    grass_tufts(d, w * 0.80, w * 0.99, h * 1.01, h * 0.09, SAGE_DARK,
                seed=16, n=10, width=w * 0.006)
    img = add_glow(img, w * 0.86, h * 0.075, w * 0.30, "#f6dcb4", 0.22)
    img = dof_top(img, 0.05, radius=h * 0.004, strength=0.8)
    img = dof_bottom(img, 0.955, radius=h * 0.004)
    return img


def draw_sabah_surf(w, h):
    """A surfboard floating among soft swells, distant island and gulls."""
    horizon = h * 0.295
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#8fadb2"), (0.38, "#c6d4cf"), (0.78, "#ecd9b4"),
                   (1.0, "#f6e2bc")],
        sea_stops=[(0.0, "#e2ece0"), (0.22, "#b9d0d1"), (0.55, "#8fb0ae"),
                   (1.0, "#6f9490")],
        sun_xy=(w * 0.80, h * 0.095), sun_r=h * 0.032, sun_halo="#f3d9b0",
        glow=0.62, shimmer_color=CREAM_LIGHT, shimmer_alpha=65,
        shimmer_seed=51, horizon_haze=0.34, haze_seed=52,
    )
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + h * 0.001, h * 0.085, "#8faaa4", seed=13, n=4,
          spread=0.16, jag=0.06)
    sailboat(d, w * 0.185, horizon - h * 0.004, h * 0.036, "#f4ead2")
    birds(d, w * 0.58, h * 0.11, h * 0.006, "#5d726d", n=4, seed=14, spread=3.0)
    img = wave_band(img, h * 0.400, h * 0.016, 2.6, 0.5, "#9db8b4", foam="#f6efdc")
    img = wave_band(img, h * 0.540, h * 0.028, 1.8, 2.2, "#7fa39e", foam="#f8f2e2")
    img = wave_band(img, h * 0.690, h * 0.034, 1.35, 4.4, "#628b86", foam="#f4ecd8")
    img = wave_band(img, h * 0.855, h * 0.038, 1.00, 1.1, "#4d7571", foam="#e8dfc6")

    bx, by = w * 0.455, h * 0.630
    angle = math.radians(-17)
    board_pts = rot_pts(lens_pts(w * 0.40, w * 0.045), angle, bx, by)
    img = shape_shadow(img, board_pts, offset=(w * 0.004, h * 0.032),
                       color="#2f4f4a", opacity=0.32, blur=w * 0.007)
    d = ImageDraw.Draw(img)
    surfboard(d, bx, by, w * 0.40, w * 0.045, angle)
    # wet rim + foam licking at the waterline
    for sgn in (-1.0, 1.0):
        cx2 = bx + math.cos(angle) * sgn * w * 0.18
        cy2 = by + h * 0.014 + math.sin(angle) * sgn * w * 0.18
        d.arc([cx2 - w * 0.080, cy2 - h * 0.010, cx2 + w * 0.080, cy2 + h * 0.026],
              start=10, end=170, fill=mix(CREAM_LIGHT, SKY_BLUE, 0.15),
              width=max(1, int(h * 0.0035)))
    rng = random.Random(17)
    for _ in range(16):
        t = rng.random()
        px = bx + math.cos(angle) * (t - 0.5) * w * 0.44
        py = by + h * 0.018 + math.sin(angle) * (t - 0.5) * w * 0.44
        rr = max(1.0, w * rng.uniform(0.002, 0.005))
        ellipse(d, px + rng.uniform(-w * 0.01, w * 0.01),
                py + rng.uniform(-h * 0.004, h * 0.008), rr, rr * 0.7, "#f2ead4")
    # sparkling water reflections
    img = shimmer(img, h * 0.42, h * 0.98, "#f6efdb", 60, 53, n=70,
                  center=w * 0.46, spread=0.35, dash=(0.006, 0.035), blur=0.9)
    img = add_glow(img, w * 0.80, h * 0.10, w * 0.24, "#f6dcb4", 0.20)
    img = dof_bottom(img, 0.90, radius=h * 0.0045)
    return img


def draw_sabah_sunset(w, h):
    """Sunset bar: pointed thatched pavilion, warm fairy lights, pink sea."""
    horizon = h * 0.552
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#3c5c63"), (0.20, "#63767d"), (0.44, "#a37e83"),
                   (0.68, "#cf967f"), (0.86, "#eab486"), (1.0, "#f7d5a4")],
        sea_stops=[(0.0, "#f3c495"), (0.10, "#d9a284"), (0.32, "#9a9284"),
                   (0.62, "#5f7a72"), (1.0, "#38554f")],
        sun_xy=(w * 0.355, horizon - h * 0.055), sun_r=h * 0.050,
        sun_halo="#f7cd93", glow=1.0, shimmer_color="#f8dfb0",
        shimmer_alpha=115, shimmer_seed=61, horizon_haze=0.30, haze_seed=62,
    )
    img = soft_band(img, h * 0.20, h * 0.34, "#e0a89c", 0.30, 63, cells=6,
                    contrast=2.8, thresh=0.44, blur=h * 0.012)
    img = soft_band(img, h * 0.33, h * 0.46, "#f0c39a", 0.28, 64, cells=8,
                    contrast=3.0, thresh=0.46, blur=h * 0.008)
    img = soft_band(img, h * 0.44, h * 0.535, "#fbe0b2", 0.36, 65, cells=6,
                    contrast=2.2, thresh=0.38, blur=h * 0.010)
    d = ImageDraw.Draw(img)
    birds(d, w * 0.24, h * 0.24, h * 0.007, "#4d5f5c", n=4, seed=66, spread=3.0)
    img = add_glow(img, w * 0.78, h * 0.63, w * 0.20, "#f2bf7c", 0.55)

    # pavilion silhouette, right side
    base_y = h * 0.735
    xl, xr = w * 0.555, w * 1.005
    apex_x, apex_y = w * 0.775, h * 0.385
    eave_y = h * 0.615
    d = ImageDraw.Draw(img)
    d.rectangle([xl, eave_y - h * 0.02, xr, base_y],
                fill=mix(NIGHT, TEAL_MID, 0.12))
    counter_y = base_y - h * 0.075
    d.rectangle([xl - w * 0.012, counter_y, w * 1.02, counter_y + h * 0.020],
                fill=mix(WOOD, NIGHT, 0.55))
    d.rectangle([xl - w * 0.012, counter_y + h * 0.020, w * 1.02, base_y],
                fill=mix(NIGHT, WOOD, 0.12))
    for k in range(3):
        sx = xl + (xr - xl) * (0.22 + 0.26 * k)
        ellipse(d, sx, base_y + h * 0.014, w * 0.026, h * 0.011,
                mix(NIGHT, TEAL_MID, 0.16))
        d.rectangle([sx - w * 0.004, base_y - h * 0.032,
                     sx + w * 0.004, base_y + h * 0.012], fill=NIGHT)
    for k, col in enumerate((mix(NIGHT, DEEP_TEAL, 0.12), mix(NIGHT, TEAL_MID, 0.20))):
        lift = h * 0.030 * k
        half = w * (0.248 - 0.030 * k)
        poly(d, [(apex_x, apex_y + lift), (apex_x - half, eave_y + h * 0.014 * k),
                 (apex_x + half, eave_y + h * 0.014 * k)], col)
    d.line([(apex_x, apex_y), (apex_x, apex_y - h * 0.062)],
           fill=mix(NIGHT, TEAL_MID, 0.22), width=max(2, int(w * 0.006)))
    ellipse(d, apex_x, apex_y - h * 0.064, w * 0.007, h * 0.007, GOLD_DEEP)
    d.line([(apex_x - w * 0.248, eave_y + h * 0.010), (apex_x, apex_y)],
           fill=mix(GOLD, TERRACOTTA, 0.40), width=max(2, int(w * 0.0035)))
    d.rectangle([xl - w * 0.02, eave_y - h * 0.006, w * 1.02, eave_y + h * 0.014],
                fill=mix(NIGHT, WOOD, 0.38))

    # palms on the left, silhouetted against the sunset
    d = ImageDraw.Draw(img)
    palm(d, w * 0.035, h * 1.02, h * 0.95, lean=0.12,
         trunk=mix(NIGHT, TEAL_MID, 0.18), leaf=mix(NIGHT, SAGE_DARK, 0.28),
         seed=67, fronds=7, trunk_w=0.023, leaf_w=0.044)
    palm(d, w * 0.165, h * 0.95, h * 0.52, lean=0.22,
         trunk=mix(NIGHT, TEAL_MID, 0.14), leaf=mix(NIGHT, SAGE_DARK, 0.20),
         seed=68, fronds=6, trunk_w=0.021, leaf_w=0.040)
    palm(d, w * 1.02, h * 0.99, h * 0.58, lean=-0.16,
         trunk=mix(NIGHT, TEAL_MID, 0.14), leaf=mix(NIGHT, SAGE_DARK, 0.20),
         seed=69, fronds=6, trunk_w=0.021, leaf_w=0.040)

    # fairy lights
    img = string_lights(img, (xl - w * 0.012, eave_y - h * 0.008),
                        (-w * 0.005, h * 0.548), h * 0.058, n=11, seed=70)
    img = string_lights(img, (w * 0.995, eave_y - h * 0.030),
                        (w * 1.02, h * 0.635), h * 0.020, n=5, seed=71)
    img = add_glow(img, w * 0.775, eave_y + h * 0.055, w * 0.15, "#f5c27f", 0.40)

    # foreground bank + big leaves, slightly out of focus
    d = ImageDraw.Draw(img)
    poly(d, [(0, h * 0.972), (w * 0.18, h * 0.938), (w * 0.38, h * 0.968),
             (w * 0.62, h * 0.945), (w * 0.86, h * 0.972), (w, h * 0.952),
             (w, h), (0, h)], mix(NIGHT, SAGE_DARK, 0.10))
    for ang, ln in ((-78, 0.30), (-38, 0.26), (-112, 0.24)):
        banana_leaf(d, w * 0.06, h * 1.03, h * ln, math.radians(ang),
                    mix(NIGHT, SAGE_DARK, 0.22))
    for ang, ln in ((-108, 0.26), (-142, 0.30), (-64, 0.22)):
        banana_leaf(d, w * 0.94, h * 1.04, h * ln, math.radians(ang),
                    mix(NIGHT, SAGE_DARK, 0.18))
    img = shimmer(img, h * 0.80, h * 0.99, "#f5d7a6", 45, 72, n=50,
                  center=w * 0.355, spread=0.16, dash=(0.008, 0.045), blur=1.4)
    img = dof_bottom(img, 0.93, radius=h * 0.0045)
    return img


def draw_sabah_palms(w, h):
    """Coconut grove lawn above the sea, long afternoon shadows."""
    horizon = h * 0.275
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#8fadb2"), (0.40, "#b9cecb"), (0.75, "#e3dcc0"),
                   (1.0, "#f2e4c4")],
        sea_stops=[(0.0, "#dbe7dd"), (0.35, "#a9c9d1"), (1.0, "#7f9fa0")],
        sun_xy=(w * 0.72, h * 0.10), sun_r=h * 0.030, sun_halo="#f2d6ae",
        glow=0.50, shimmer_color=CREAM_LIGHT, shimmer_alpha=45,
        shimmer_seed=71, horizon_haze=0.30, haze_seed=72,
    )
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + h * 0.001, h * 0.05, "#9db3a8", seed=73, n=3,
          spread=0.14, jag=0.05)
    sailboat(d, w * 0.22, horizon - h * 0.002, h * 0.025, "#f2e6cc")
    birds(d, w * 0.62, h * 0.13, h * 0.0055, "#5d726d", n=3, seed=74)

    img = fill_grad(img, h * 0.345, h,
                    [(0.0, "#8fa77f"), (0.30, "#7d9870"), (0.62, "#6f8a63"),
                     (1.0, "#526b44")])
    d = ImageDraw.Draw(img)
    vpx = w * 0.52
    for i in range(9):
        fx = w * (-0.06 + 1.12 * i / 8.0)
        tx = vpx + (fx - vpx) * 0.42
        col = (mix(SAGE, "#b6c69a", 0.10) if i % 2 == 0
               else mix(SAGE_DARK, SAGE, 0.20))
        poly(d, [(tx - w * 0.052, h * 0.345), (tx + w * 0.052, h * 0.345),
                 (fx + w * 0.080, h), (fx - w * 0.080, h)], col)
    for k in range(5):
        yy = h * (0.36 + 0.13 * k)
        d.line([(0, yy), (w, yy + h * 0.004)], fill=mix(SAGE_DARK, SAGE, 0.55),
               width=max(1, int(h * 0.0012)))

    img = ground_shadow(img, w * 0.20, h * 0.945, w * 0.17, h * 0.030,
                        opacity=0.32, blur=w * 0.02)
    img = ground_shadow(img, w * 0.84, h * 0.665, w * 0.10, h * 0.020,
                        opacity=0.26, blur=w * 0.014)
    img = ground_shadow(img, w * 0.565, h * 0.480, w * 0.055, h * 0.010,
                        opacity=0.22, blur=w * 0.010)
    d = ImageDraw.Draw(img)
    palm(d, w * 0.18, h * 1.01, h * 0.92, lean=0.055, trunk=TERRACOTTA_DEEP,
         leaf=mix(SAGE_DARK, NIGHT, 0.12), seed=75, fronds=7, trunk_w=0.042,
         leaf_w=0.105, crown_drop=0.015)
    palm(d, w * 0.84, h * 0.685, h * 0.43, lean=-0.13,
         trunk=mix(TERRACOTTA_DEEP, NIGHT, 0.12), leaf=mix(SAGE_DARK, NIGHT, 0.18),
         seed=76, fronds=6, trunk_w=0.030, leaf_w=0.074)
    palm(d, w * 0.565, h * 0.475, h * 0.205, lean=0.10,
         trunk=mix(TERRACOTTA_DEEP, NIGHT, 0.18),
         leaf=mix(SAGE_DARK, SAGE, 0.12), seed=77, fronds=5,
         trunk_w=0.024, leaf_w=0.058)
    grass_tufts(d, 0, w, h * 1.005, h * 0.085, SAGE_DARK, seed=78, n=44,
                width=w * 0.004)
    rng = random.Random(79)
    for _ in range(34):
        x = rng.uniform(0, w)
        y = rng.uniform(h * 0.44, h * 0.98)
        r = w * rng.uniform(0.0016, 0.0036)
        ellipse(d, x, y, r, r, mix(CREAM_LIGHT, SAGE, 0.15))
    img = add_glow(img, w * 0.72, h * 0.10, w * 0.26, "#f6dcb4", 0.18)
    img = dof_bottom(img, 0.93, radius=h * 0.0045)
    return img


# --------------------------------------------------------------------------
# YANGSHUO -- river, karst towers, climbing and the little scooter
# --------------------------------------------------------------------------
def draw_yangshuo_cormorant(w, h):
    """Bamboo raft with cormorants, misty karst behind, reeds in front."""
    horizon = h * 0.335
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, horizon,
                    [(0.0, "#b9cdd0"), (0.35, "#cfdbd6"), (0.72, "#e8e3d1"),
                     (1.0, "#f4ecd8")])
    img = fill_grad(img, horizon, h,
                    [(0.0, "#dde1d4"), (0.20, "#c3d2ce"), (0.58, "#a3bab6"),
                     (1.0, "#7f9c98")])
    d = ImageDraw.Draw(img)
    karst_range(d, w, horizon - h * 0.002, h * 0.145,
                mix("#b7c6c1", CREAM, 0.32), seed=81, count=5,
                min_w=0.048, max_w=0.100)
    img = mist(img, horizon - h * 0.048, h * 0.030, opacity=0.55, seed=82)
    d = ImageDraw.Draw(img)
    karst_range(d, w, horizon + h * 0.001, h * 0.105,
                mix("#9aaea4", CREAM, 0.12), seed=83, count=4,
                min_w=0.070, max_w=0.135)
    img = mirror_water(img, horizon, opacity=0.40, wobble=3.0, tint="#c9d6cf",
                       squash=0.95, seed=84)
    d = ImageDraw.Draw(img)
    rngw = random.Random(85)
    for k in range(20):
        yy = horizon + (h - horizon) * (0.04 + 0.050 * k + rngw.uniform(-0.020, 0.020))
        x0 = w * rngw.uniform(-0.10, 0.55)
        ln = w * rngw.uniform(0.25, 0.62)
        d.line([(x0, yy), (x0 + ln, yy)], fill=mix("#a9bdb7", CREAM, 0.35),
               width=max(1, int(h * 0.0012)))
    birds(d, w * 0.74, h * 0.14, h * 0.006, "#5d726d", n=3, seed=85, spread=3.2)

    # bamboo raft
    raft_cx, raft_cy = w * 0.43, h * 0.700
    raft_len, raft_w = w * 0.56, h * 0.055
    raft_angle = math.radians(-6)
    raft_pts = rot_pts([(-raft_len / 2, -raft_w / 2), (raft_len / 2, -raft_w * 0.30),
                        (raft_len / 2, raft_w * 0.30), (-raft_len / 2, raft_w / 2)],
                       raft_angle, raft_cx, raft_cy)
    img = shape_shadow(img, raft_pts, offset=(w * 0.008, h * 0.026),
                       color="#3d5a52", opacity=0.26, blur=h * 0.012)
    d = ImageDraw.Draw(img)
    bamboo_raft(d, raft_cx, raft_cy, raft_len, raft_w, raft_angle,
                mix(SAND, CREAM, 0.10), mix(SAND_DEEP, TERRACOTTA, 0.25))
    # lashed cross bars
    for t in (-0.28, 0.22):
        p1 = rot_pts([(raft_len * t, -raft_w * 0.52)], raft_angle, raft_cx, raft_cy)[0]
        p2 = rot_pts([(raft_len * t, raft_w * 0.52)], raft_angle, raft_cx, raft_cy)[0]
        d.line([p1, p2], fill=mix(TERRACOTTA_DEEP, NIGHT, 0.30),
               width=max(2, int(h * 0.005)))

    # cormorants
    bird_col = mix(DEEP_TEAL, NIGHT, 0.35)
    cormorant(d, w * 0.315, raft_cy - h * 0.020, h * 0.058, bird_col,
              wings=True, facing=1)
    cormorant(d, w * 0.455, raft_cy - h * 0.018, h * 0.052, bird_col,
              facing=-1)
    cormorant(d, w * 0.545, raft_cy - h * 0.010, h * 0.046, bird_col,
              facing=1)

    # punting pole + lantern
    pole = [(w * 0.615, raft_cy + h * 0.010), (w * 0.70, h * 0.455)]
    d.line(P(pole), fill=mix(WOOD, SAND, 0.30), width=max(2, int(w * 0.010)))
    for k in range(1, 4):
        t = k / 4
        px = pole[0][0] + (pole[1][0] - pole[0][0]) * t
        py = pole[0][1] + (pole[1][1] - pole[0][1]) * t
        d.line([(px - w * 0.006, py + h * 0.002), (px + w * 0.006, py - h * 0.002)],
               fill=mix(TERRACOTTA_DEEP, NIGHT, 0.30), width=max(1, int(w * 0.004)))
    lantern_x, lantern_y = w * 0.663, h * 0.522
    d.line([(w * 0.700, h * 0.455), (lantern_x, h * 0.482)],
           fill=mix(WOOD, SAND, 0.30), width=max(2, int(w * 0.006)))
    d.line([(lantern_x, h * 0.482), (lantern_x, lantern_y - h * 0.022)],
           fill=mix(NIGHT, TEAL_MID, 0.2), width=max(1, int(w * 0.003)))
    img = add_glow(img, lantern_x, lantern_y, w * 0.10, "#f4c07a", 0.55)
    d = ImageDraw.Draw(img)
    ellipse(d, lantern_x, lantern_y, w * 0.020, h * 0.020,
            mix("#e8a35c", GOLD_LIGHT, 0.35))
    ellipse(d, lantern_x, lantern_y, w * 0.012, h * 0.012, "#f6d8a0")
    # lantern reflection
    img = shimmer(img, lantern_y + h * 0.02, lantern_y + h * 0.09, "#f3c98d",
                  70, 86, n=18, center=lantern_x, spread=0.03,
                  dash=(0.004, 0.020), blur=1.0)

    # foreground reeds, slightly blurred
    d = ImageDraw.Draw(img)
    reeds(d, -w * 0.02, w * 0.30, h * 1.01, h * 0.20,
          mix(SAGE_DEEP, NIGHT, 0.30), mix(TERRACOTTA_DEEP, NIGHT, 0.35),
          seed=87, n=18)
    reeds(d, w * 0.72, w * 1.02, h * 1.01, h * 0.24,
          mix(SAGE_DEEP, NIGHT, 0.25), mix(SAGE_DARK, NIGHT, 0.30),
          seed=88, n=16)
    grass_tufts(d, 0, w, h * 1.005, h * 0.06, mix(SAGE_DEEP, NIGHT, 0.20),
                seed=89, n=30, width=w * 0.004)
    img = mist(img, h * 0.44, h * 0.055, opacity=0.28, seed=90)
    img = dof_bottom(img, 0.90, radius=h * 0.005)
    return img


def draw_yangshuo_river(w, h):
    """Li River: layered karst peaks, mirrored water, mist and a small raft."""
    rng = random.Random(441)
    horizon = h * 0.470
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, horizon,
                    [(0.0, "#b9cdd1"), (0.28, "#cdd8d3"), (0.58, "#e5e0cc"),
                     (0.82, "#f2e8d2"), (1.0, "#f4ecd8")])
    img = add_glow(img, w * 0.68, h * 0.18, w * 0.50, "#f6e6c4", 0.28)
    img = soft_band(img, h * 0.10, h * 0.26, CREAM_LIGHT, 0.30, 442, cells=6,
                    contrast=2.2, thresh=0.44, blur=h * 0.012)
    d = ImageDraw.Draw(img)
    birds(d, w * 0.62, h * 0.14, h * 0.0055, "#6d807a", n=4, seed=443, spread=3.0)
    far = ((0.03, 0.070, 0.20), (0.16, 0.060, 0.30), (0.31, 0.090, 0.24),
           (0.46, 0.075, 0.33), (0.62, 0.085, 0.26), (0.77, 0.070, 0.31),
           (0.91, 0.080, 0.22))
    for cx, hw, hh in far:
        karst_tower(d, w * cx, horizon + 1, w * hw, h * hh, "#c0d0ca")
    img = mist(img, horizon - h * 0.150, h * 0.080, opacity=0.55, seed=444)
    d = ImageDraw.Draw(img)
    mid = ((0.02, 0.095, 0.26), (0.18, 0.080, 0.20), (0.34, 0.105, 0.28),
           (0.52, 0.085, 0.22), (0.68, 0.095, 0.27), (0.84, 0.080, 0.21),
           (0.97, 0.090, 0.25))
    for cx, hw, hh in mid:
        karst_tower(d, w * cx, horizon + 1, w * hw, h * hh, "#93ab9c")
    img = mist(img, horizon - h * 0.080, h * 0.045, opacity=0.42, seed=445)
    d = ImageDraw.Draw(img)
    near = ((0.04, 0.140, 0.165), (0.24, 0.110, 0.130), (0.44, 0.130, 0.150),
            (0.64, 0.105, 0.120), (0.82, 0.120, 0.145), (0.97, 0.135, 0.160))
    for cx, hw, hh in near:
        karst_tower(d, w * cx, horizon + 1, w * hw, h * hh, "#6f8a63")
    # water
    img = fill_grad(img, horizon, h,
                    [(0.0, "#dbe2d4"), (0.18, "#c6d5cc"), (0.52, "#aec3ba"),
                     (0.80, "#9bb3ac"), (1.0, "#8aa5a0")])
    # mirrored peaks, painted into the water then broken up by ripple bands
    water_col = mix("#aec3ba", "#dbe2d4", 0.45)
    d = ImageDraw.Draw(img)
    for cx, hw, hh in mid:
        karst_tower(d, w * cx, horizon + h * 0.004, w * hw * 0.98, -h * hh * 0.80,
                    mix("#93ab9c", water_col, 0.55))
    for cx, hw, hh in near:
        karst_tower(d, w * cx, horizon + h * 0.004, w * hw * 0.98, -h * hh * 0.80,
                    mix("#6f8a63", water_col, 0.42))
    rip = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rp = ImageDraw.Draw(rip)
    rip_rng = random.Random(453)
    for k in range(34):
        t = (k / 33.0) ** 0.9
        yy2 = horizon + (h - horizon) * (0.03 + 0.92 * t)
        hgt = h * rip_rng.uniform(0.004, 0.014) * (0.6 + t)
        rp.rectangle([0, yy2, w, yy2 + hgt],
                     fill=rgba(mix(water_col, CREAM, 0.18),
                               int(150 * (0.30 + 0.55 * t))))
    img = comp(img, rip.filter(ImageFilter.GaussianBlur(h * 0.004)))
    img = mist(img, horizon + h * 0.012, h * 0.020, opacity=0.32, seed=446)
    img = shimmer(img, horizon + h * 0.02, h * 0.96, "#eef0dd", 55, 447,
                  n=90, center=w * 0.46, spread=0.40, dash=(0.008, 0.050),
                  blur=1.2)
    d = ImageDraw.Draw(img)
    rng2 = random.Random(448)
    for k in range(24):
        t = (k / 23.0) ** 1.2
        yy2 = horizon + (h - horizon) * (0.05 + 0.90 * t)
        x0 = w * rng2.uniform(-0.05, 0.8)
        ln = w * rng2.uniform(0.08, 0.35)
        d.line([(x0, yy2), (x0 + ln, yy2)],
               fill=mix("#9db5ae", CREAM, rng2.uniform(0.20, 0.55)),
               width=max(1, int(h * 0.0012)))
    # bamboo raft with cormorant and lantern
    raft_cx, raft_cy = w * 0.225, h * 0.825
    raft_len, raft_w = w * 0.22, h * 0.028
    raft_angle = math.radians(-4)
    bamboo_raft(d, raft_cx, raft_cy, raft_len, raft_w, raft_angle,
                mix(SAND, CREAM, 0.15), mix(SAND_DEEP, TERRACOTTA, 0.22))
    d.line([(raft_cx + w * 0.05, raft_cy), (raft_cx + w * 0.085, raft_cy - h * 0.085)],
           fill=mix(WOOD, SAND, 0.25), width=max(2, int(w * 0.005)))
    img = add_glow(img, raft_cx + w * 0.080, raft_cy - h * 0.092, w * 0.09,
                   "#f4c07a", 0.60)
    d = ImageDraw.Draw(img)
    lx, ly = raft_cx + w * 0.080, raft_cy - h * 0.092
    ellipse(d, lx, ly, w * 0.010, h * 0.013, mix("#e8a35c", GOLD_LIGHT, 0.35))
    ellipse(d, lx, ly, w * 0.005, h * 0.007, "#f8dfae")
    img = shimmer(img, ly + h * 0.014, ly + h * 0.08, "#f3c98d", 80, 449,
                  n=16, center=lx, spread=0.025, dash=(0.003, 0.015), blur=0.9)
    d = ImageDraw.Draw(img)
    cormorant(d, raft_cx + w * 0.005, raft_cy - h * 0.008, h * 0.034,
              mix(DEEP_TEAL, NIGHT, 0.35), facing=1)
    # foreground reeds and bank
    d = ImageDraw.Draw(img)
    poly(d, [(0, h * 1.02), (0, h * 0.982), (w * 0.12, h * 0.995),
             (w * 0.20, h * 1.02)], mix(SAGE_DEEP, NIGHT, 0.30))
    reeds(d, -w * 0.01, w * 0.16, h * 1.01, h * 0.13,
          mix(SAGE_DEEP, NIGHT, 0.35), mix(TERRACOTTA_DEEP, NIGHT, 0.40),
          seed=450, n=14)
    reeds(d, w * 0.86, w * 1.02, h * 1.01, h * 0.10,
          mix(SAGE_DEEP, NIGHT, 0.30), mix(TERRACOTTA_DEEP, NIGHT, 0.45),
          seed=451, n=8)
    grass_tufts(d, 0, w, h * 1.005, h * 0.035, mix(SAGE_DARK, NIGHT, 0.20),
                seed=452, n=24, width=w * 0.0025)
    img = dof_bottom(img, 0.955, radius=h * 0.004)
    return img
def draw_yangshuo_light(w, h):
    """Late sun: a river of scattered gold under a warm hazy sky."""
    horizon = h * 0.355
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, horizon,
                    [(0.0, "#7f9a98"), (0.28, "#a7ada2"), (0.62, "#d9c4a4"),
                     (0.86, "#f0d3a2"), (1.0, "#f6dfae")])
    sun_x, sun_y = w * 0.655, h * 0.278
    img = sun(img, sun_x, sun_y, h * 0.046, CREAM_LIGHT, "#f5c98e", 1.0)
    img = soft_band(img, h * 0.14, h * 0.30, "#e8bfa0", 0.26, 111, cells=6,
                    contrast=2.6, thresh=0.44, blur=h * 0.012)
    d = ImageDraw.Draw(img)
    ridge(d, w, horizon + 1, h * 0.115, "#9c8f80", seed=112, n=4,
          spread=0.18, jag=0.06)
    karst_range(d, w, horizon + 1, h * 0.078, "#8b8274", seed=113, count=4,
                min_w=0.080, max_w=0.160)
    img = mist(img, horizon - h * 0.02, h * 0.030, opacity=0.40, seed=114)
    birds(d, w * 0.30, h * 0.20, h * 0.006, "#6d6258", n=3, seed=115, spread=3.0)

    img = fill_grad(img, horizon, h,
                    [(0.0, "#e6cca4"), (0.16, "#d5ba94"), (0.42, "#b3a084"),
                     (0.72, "#7e8a7b"), (1.0, "#5e7269")])
    d = ImageDraw.Draw(img)
    rng = random.Random(116)
    for k in range(34):
        t = (k / 33.0) ** 1.25
        yy = horizon + (h - horizon) * (0.03 + 0.94 * t)
        x0 = w * rng.uniform(-0.05, 0.75)
        ln = w * rng.uniform(0.10, 0.45)
        d.line([(x0, yy), (x0 + ln, yy)],
               fill=mix("#8b9684", CREAM, rng.uniform(0.10, 0.48)),
               width=max(1, int(h * rng.uniform(0.0012, 0.0022))))
    img = shimmer(img, horizon + h * 0.004, h * 0.985, "#f6dba6", 150, 117,
                  n=max(120, int(w / 10)), center=sun_x, spread=0.13,
                  dash=(0.018, 0.145), blur=1.5, fade=0.25)
    img = shimmer(img, horizon + h * 0.02, h * 0.98, "#fdf0c8", 90, 118,
                  n=max(60, int(w / 22)), center=sun_x, spread=0.20,
                  dash=(0.006, 0.045), blur=0.9, fade=0.30)
    # darker current lines low in the frame
    d = ImageDraw.Draw(img)
    rng2 = random.Random(119)
    for k in range(18):
        t = rng2.random() ** 0.7
        yy = horizon + (h - horizon) * (0.35 + 0.62 * t)
        x0 = w * rng2.uniform(-0.1, 0.8)
        ln = w * rng2.uniform(0.15, 0.5)
        d.line([(x0, yy), (x0 + ln, yy)], fill=mix("#6b7c6e", "#a89c80", 0.3),
               width=max(1, int(h * 0.0020)))

    # foreground reeds / rock silhouettes
    d = ImageDraw.Draw(img)
    reeds(d, -w * 0.02, w * 0.22, h * 1.01, h * 0.20,
          mix(SAGE_DEEP, NIGHT, 0.45), mix(NIGHT, TERRACOTTA_DEEP, 0.40),
          seed=120, n=16)
    poly(d, [(-w * 0.02, h * 1.02), (w * 0.06, h * 0.915), (w * 0.15, h * 0.955),
             (w * 0.19, h * 1.02)], mix(NIGHT, SAGE_DEEP, 0.20))
    reeds(d, w * 0.80, w * 1.02, h * 1.01, h * 0.16,
          mix(SAGE_DEEP, NIGHT, 0.40), mix(TERRACOTTA_DEEP, NIGHT, 0.50),
          seed=121, n=10)
    img = add_glow(img, sun_x, sun_y, w * 0.30, "#f7d29a", 0.25)
    img = dof_bottom(img, 0.92, radius=h * 0.005)
    return img


def draw_yangshuo_karst(w, h):
    """Tower-karst peaks in three grounded, misty planes."""
    rng = random.Random(431)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#a9c9d1"), (0.22, "#c2d5d2"), (0.46, "#dde0ce"),
                     (0.72, "#ebe4cd"), (1.0, "#ded8c0")])
    img = add_glow(img, w * 0.72, h * 0.10, w * 0.55, "#f6e6c0", 0.30)
    d = ImageDraw.Draw(img)
    birds(d, w * 0.64, h * 0.12, h * 0.0050, "#7d8f89", n=4, seed=432, spread=3.0)

    # far plane
    f_base = h * 0.610
    d.rectangle([0, f_base - h * 0.02, w, h * 0.760], fill="#c7d4ce")
    karst_range(d, w, f_base, h * 0.27, "#c7d4ce", seed=433, count=7,
                min_w=0.035, max_w=0.085, jitter=0.85)
    img = mist(img, h * 0.560, h * 0.045, opacity=0.55, seed=434)
    d = ImageDraw.Draw(img)

    # middle plane
    m_base = h * 0.760
    d.rectangle([0, m_base - h * 0.02, w, h * 0.900], fill="#a5bca9")
    karst_range(d, w, m_base, h * 0.27, "#a5bca9", seed=435, count=6,
                min_w=0.055, max_w=0.115, jitter=0.80)
    img = mist(img, h * 0.700, h * 0.040, opacity=0.40, seed=436)
    d = ImageDraw.Draw(img)

    # near plane
    n_base = h * 0.900
    d.rectangle([0, n_base - h * 0.02, w, h], fill="#6f8a63")
    karst_range(d, w, n_base, h * 0.30, "#6f8a63", seed=437, count=5,
                min_w=0.080, max_w=0.170, jitter=0.75)
    karst_tower(d, -w * 0.04, n_base + h * 0.02, w * 0.15, h * 0.36, "#5c7a52")
    karst_tower(d, w * 1.04, n_base + h * 0.02, w * 0.16, h * 0.40, "#5c7a52")
    # shrubs scattered on the near hillside
    for _ in range(26):
        cx = w * rng.uniform(0.0, 1.0)
        cy = h * rng.uniform(0.800, 0.905)
        r = w * rng.uniform(0.010, 0.028)
        foliage(d, cx, cy, r * 1.5, r * 0.7,
                ["#5c7a52", "#4c6a51", "#6f8a63"], seed=int(cx) + 4, n=4)
    # small trees standing on the near ridge
    tree_rng = random.Random(438)
    for _ in range(16):
        tx = w * tree_rng.uniform(0.0, 1.0)
        ty = n_base - h * tree_rng.uniform(0.0, 0.045)
        th = h * tree_rng.uniform(0.012, 0.026)
        d.line([(tx, ty), (tx, ty - th * 0.5)], fill=mix("#4c6a51", NIGHT, 0.25),
               width=max(1, int(w * 0.0025)))
        ellipse(d, tx, ty - th * 0.6, th * 0.55, th * 0.45,
                mix("#4c6a51", SAGE_DARK, 0.20))
    # foreground vegetation
    img = fill_grad(img, h * 0.945, h,
                    [(0.0, "#4c6a51"), (0.55, "#425f48"), (1.0, "#35503c")])
    d = ImageDraw.Draw(img)
    for _ in range(12):
        cx = w * rng.uniform(-0.05, 1.05)
        cy = h * rng.uniform(0.955, 1.03)
        r = w * rng.uniform(0.025, 0.070)
        foliage(d, cx, cy, r * 1.5, r * 0.55,
                ["#3d5a45", "#4c6a51", "#5c7a52"], seed=int(cx) + 9, n=5)
    for k in range(5):
        banana_leaf(d, w * rng.uniform(-0.02, 1.0), h * 1.02,
                    h * rng.uniform(0.10, 0.16),
                    math.radians(rng.uniform(-135, -45)),
                    mix("#3d5a45", NIGHT, 0.12))
    grass_tufts(d, 0, w, h * 1.005, h * 0.045, "#35503c", seed=439, n=34,
                width=w * 0.004)
    img = dappled_light(img, w * 0.1, h * 0.30, w * 0.9, h * 0.88, seed=440,
                        n=14, size=(0.010, 0.030), opacity=0.10, blur=w * 0.014)
    img = dof_bottom(img, 0.955, radius=h * 0.004)
    return img
def draw_yangshuo_climb_1(w, h):
    """Limestone crag close-up: smooth orange rope, quickdraws, chalk marks."""
    rng = random.Random(461)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#d6d0c1"), (0.30, "#c9c2b2"), (0.62, "#bab2a0"),
                     (1.0, "#a59d8a")])
    d = ImageDraw.Draw(img)
    # large limestone facets
    facet_cols = ["#d8d2c3", "#c7c0af", "#bbb3a0", "#cfc8b8", "#b1a997",
                  "#c2bbaa", "#dcd6c8"]
    for _ in range(18):
        cx = w * rng.uniform(-0.05, 1.05)
        cy = h * rng.uniform(-0.02, 1.02)
        rw = w * rng.uniform(0.11, 0.30)
        rh = h * rng.uniform(0.06, 0.18)
        pts = []
        n = rng.randint(5, 7)
        for k in range(n):
            a = k * math.tau / n + rng.uniform(-0.30, 0.30)
            rr = rng.uniform(0.55, 1.0)
            pts.append((cx + math.cos(a) * rw * rr, cy + math.sin(a) * rh * rr))
        poly(d, pts, mix(rng.choice(facet_cols), "#d9ccb2", rng.uniform(0.0, 0.45)))
    # soft strata shadows
    for i in range(8):
        y0 = h * rng.uniform(0.04, 0.96)
        amp = h * rng.uniform(0.004, 0.018)
        pts = []
        step = max(4, w // 48)
        freq = rng.uniform(0.7, 1.5)
        phase = rng.uniform(0.0, math.tau)
        for k in range(0, w + step, step):
            pts.append((k, y0 + math.sin(k / w * math.tau * freq + phase) * amp))
        d.line(P(pts), fill=mix("#a5947c", NIGHT, 0.20),
               width=max(2, int(h * rng.uniform(0.0035, 0.0075))))
        d.line(P([(x, y - h * 0.0035) for x, y in pts]),
               fill=mix("#ded1b8", CREAM, 0.25), width=max(1, int(h * 0.0022)))
    for _ in range(140):
        sx = w * rng.uniform(0, 1)
        sy = h * rng.uniform(0, 1)
        sr = w * rng.uniform(0.001, 0.004)
        ellipse(d, sx, sy, sr, sr * 0.7,
                mix(rng.choice(("#a5947c", "#ded1b8", "#c3b294")),
                    "#c8b899", rng.uniform(0.0, 0.5)))
    # a few short cracks
    for _ in range(4):
        x = w * rng.uniform(0.05, 0.95)
        y = h * rng.uniform(0.10, 0.90)
        pts = [(x, y)]
        for j in range(1, 5):
            pts.append((pts[-1][0] + rng.uniform(-0.015, 0.015) * w,
                        pts[-1][1] + rng.uniform(0.025, 0.06) * h))
        d.line(P(pts), fill=mix("#93826c", NIGHT, 0.22),
               width=max(1, int(w * 0.0020)))
    # warm light from the top left, shade on the right
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    warm = np.exp(-(((xx - w * 0.10) / (w * 0.62)) ** 2
                    + ((yy - h * 0.02) / (h * 0.75)) ** 2))
    shade = np.clip((xx / w - 0.52) / 0.48, 0.0, 1.0) ** 1.3 * 0.18
    overlay = np.zeros((h, w, 4), dtype=np.uint8)
    overlay[..., 0] = np.clip(warm * 48, 0, 255).astype(np.uint8)
    overlay[..., 1] = np.clip(warm * 34, 0, 255).astype(np.uint8)
    overlay[..., 2] = np.clip(warm * 8, 0, 255).astype(np.uint8)
    overlay[..., 3] = np.clip(warm * 70 + shade * 255, 0, 255).astype(np.uint8)
    img = comp(img, Image.fromarray(overlay, "RGBA"))
    d = ImageDraw.Draw(img)
    # chalk marks
    chalk_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chalk_layer)
    for cx, cy, r in ((w * 0.66, h * 0.50, w * 0.030), (w * 0.70, h * 0.54, w * 0.018),
                      (w * 0.24, h * 0.66, w * 0.022), (w * 0.28, h * 0.70, w * 0.012)):
        ellipse(cd, cx, cy, r, r * 0.60, rgba(CREAM_LIGHT, 90))
    img = comp(img, chalk_layer.filter(ImageFilter.GaussianBlur(w * 0.012)))
    # dark overhang at the top with hanging greenery
    d = ImageDraw.Draw(img)
    poly(d, [(-w * 0.02, -h * 0.02), (w * 1.02, -h * 0.02),
             (w * 1.02, h * 0.035), (w * 0.86, h * 0.075),
             (w * 0.68, h * 0.045), (w * 0.50, h * 0.085),
             (w * 0.30, h * 0.040), (w * 0.10, h * 0.070),
             (-w * 0.02, h * 0.030)], mix("#a08d74", NIGHT, 0.18))
    for k in range(6):
        bx = w * rng.uniform(-0.05, 1.05)
        for _j in range(2):
            banana_leaf(d, bx + rng.uniform(-0.03, 0.03) * w,
                        h * rng.uniform(0.02, 0.06), h * rng.uniform(0.07, 0.14),
                        math.radians(rng.uniform(60, 120)),
                        mix(SAGE_DARK, NIGHT, rng.uniform(0.05, 0.30)))
        foliage(d, bx, h * rng.uniform(0.02, 0.04), w * rng.uniform(0.03, 0.06),
                h * rng.uniform(0.008, 0.020), ["#4c6a51", "#3d5a45"],
                seed=int(bx) + 7, n=4)
    for k in range(4):
        cx = w * rng.uniform(0.05, 0.95)
        cy = h * rng.uniform(0.14, 0.32)
        r = w * rng.uniform(0.008, 0.020)
        ellipse(d, cx, cy, r * 1.8, r * 0.7, mix(SAGE, SAGE_DARK, 0.30))

    def smooth(points, seg=14):
        pts = [points[0]] + list(points) + [points[-1]]
        out = []
        for i in range(1, len(pts) - 2):
            p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
            for j in range(seg):
                t = j / seg
                t2, t3 = t * t, t * t * t
                x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t
                           + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                           + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
                y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t
                           + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                           + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
                out.append((x, y))
        out.append(points[-1])
        return out

    rope = smooth([(w * 0.20, -h * 0.03), (w * 0.33, h * 0.12), (w * 0.28, h * 0.28),
                   (w * 0.36, h * 0.42), (w * 0.43, h * 0.55), (w * 0.40, h * 0.70),
                   (w * 0.52, h * 0.84), (w * 0.47, h * 1.03)])
    shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.line(P([(x + w * 0.008, y + h * 0.006) for x, y in rope]),
            fill=rgba(NIGHT, 90), width=max(5, int(w * 0.026)), joint="curve")
    img = comp(img, shadow_layer.filter(ImageFilter.GaussianBlur(w * 0.006)))
    d = ImageDraw.Draw(img)
    d.line(P(rope), fill="#a9572f", width=max(5, int(w * 0.022)), joint="curve")
    d.line(P([(x - w * 0.004, y - h * 0.002) for x, y in rope]), fill="#cf7841",
           width=max(3, int(w * 0.013)), joint="curve")
    d.line(P([(x - w * 0.007, y - h * 0.004) for x, y in rope]), fill="#e8a46c",
           width=max(1, int(w * 0.0045)), joint="curve")

    def quickdraw(bolt, clip):
        bx0, by0 = bolt
        cx0, cy0 = clip
        d.rounded_rectangle([bx0 - w * 0.012, by0 - w * 0.022,
                             bx0 + w * 0.012, by0 + w * 0.022],
                            radius=w * 0.006, fill=mix(STONE, CREAM, 0.32))
        ellipse(d, bx0, by0, w * 0.007, w * 0.007, mix(TILE_SOFT, NIGHT, 0.40))
        ang = math.atan2(cy0 - by0, cx0 - bx0)
        dist = math.hypot(cx0 - bx0, cy0 - by0) or 1.0
        ux, uy = (cx0 - bx0) / dist, (cy0 - by0) / dist
        nx, ny = -uy, ux
        hw = w * 0.006
        sling = [(bx0 + nx * hw, by0 + ny * hw), (bx0 - nx * hw, by0 - ny * hw),
                 (cx0 - nx * hw, cy0 - ny * hw), (cx0 + nx * hw, cy0 + ny * hw)]
        poly(d, sling, mix(SAGE_DARK, NIGHT, 0.30))
        ring = rot_pts([(math.cos(a) * w * 0.020, math.sin(a) * w * 0.034)
                        for a in np.linspace(0, math.tau, 30)],
                       ang, cx0, cy0)
        d.line(P(ring + [ring[0]]), fill=mix(STONE, CREAM, 0.10),
               width=max(2, int(w * 0.0065)), joint="curve")
        gx0, gy0 = rot_pts([(-w * 0.008, w * 0.024)], ang, cx0, cy0)[0]
        gx1, gy1 = rot_pts([(w * 0.008, w * 0.024)], ang, cx0, cy0)[0]
        d.line([(gx0, gy0), (gx1, gy1)], fill=mix(TILE_SOFT, NIGHT, 0.35),
               width=max(1, int(w * 0.0038)))

    quickdraw((w * 0.470, h * 0.335), (w * 0.315, h * 0.340))
    quickdraw((w * 0.545, h * 0.620), (w * 0.415, h * 0.622))
    img = dof_bottom(img, 0.96, radius=h * 0.004)
    return img
def draw_yangshuo_climb_2(w, h):
    """The trail under the crag: a lone backpack, stones and small flowers."""
    rng = random.Random(151)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h * 0.30,
                    [(0.0, "#a9c9d1"), (0.55, "#cfdcd6"), (1.0, "#ece6cf")])
    d = ImageDraw.Draw(img)
    birds(d, w * 0.68, h * 0.075, h * 0.005, "#7d8f89", n=2, seed=152, spread=2.5)
    # crag upper half
    cliff_top = h * 0.075
    cliff_bottom = h * 0.545
    lip = []
    for i in range(9):
        x = w * i / 8.0
        y = cliff_top + rng.uniform(-0.015, 0.030) * h
        lip.append((x, y))
    cliff_pts = list(lip) + [(w, cliff_bottom), (0, cliff_bottom)]
    poly(d, cliff_pts, "#c7b89d")
    palette = ["#d6c9b0", "#c3b398", "#b2a288", "#cdbfa4", "#bdae93"]
    for _ in range(20):
        cx = rng.uniform(0, w)
        cy = rng.uniform(cliff_top + h * 0.01, cliff_bottom - h * 0.02)
        rw = rng.uniform(0.06, 0.19) * w
        rh = rng.uniform(0.02, 0.06) * h
        pts = []
        for k in range(6):
            a = k * math.tau / 6 + rng.uniform(-0.2, 0.2)
            rr = rng.uniform(0.6, 1.0)
            pts.append((cx + math.cos(a) * rw * rr, cy + math.sin(a) * rh * rr))
        poly(d, pts, mix(rng.choice(palette), "#cdbfa4", rng.uniform(0.0, 0.45)))
    for _ in range(4):
        x = rng.uniform(0.05, 0.95) * w
        y = rng.uniform(cliff_top + h * 0.02, cliff_bottom - h * 0.15)
        pts = [(x, y)]
        for _j in range(3):
            pts.append((pts[-1][0] + rng.uniform(-0.012, 0.012) * w,
                        pts[-1][1] + rng.uniform(0.030, 0.060) * h))
        d.line(P(pts), fill=mix("#8f7f68", NIGHT, 0.16), width=max(1, int(w * 0.0018)))
    # greenery hanging over the top edge
    for _k in range(4):
        gx = w * rng.uniform(0.0, 1.0)
        foliage(d, gx, cliff_top - h * 0.004, w * rng.uniform(0.03, 0.06),
                h * rng.uniform(0.008, 0.018), ["#4c6a51", "#3d5a45"],
                seed=int(gx) + 5, n=5)
        for _j in range(2):
            banana_leaf(d, gx + rng.uniform(-0.02, 0.02) * w, cliff_top,
                        h * rng.uniform(0.05, 0.09),
                        math.radians(rng.uniform(75, 115)),
                        mix(SAGE_DARK, SAGE, rng.uniform(0.0, 0.3)))
    # talus / green slope
    img = fill_grad(img, cliff_bottom - h * 0.005, h,
                    [(0.0, "#7d9870"), (0.28, "#6f8a63"), (0.72, "#5e7a52"),
                     (1.0, "#4c6a51")])
    d = ImageDraw.Draw(img)
    for _ in range(7):
        cx = rng.uniform(0, w)
        cy = rng.uniform(cliff_bottom, h * 0.98)
        r = w * rng.uniform(0.012, 0.035)
        foliage(d, cx, cy, r * 1.7, r, ["#527046", "#4c6a51", "#6f8a63"],
                seed=int(cx) + 3, n=5)
    # trail
    path_pts = [(w * 0.47, cliff_bottom - h * 0.005), (w * 0.545, cliff_bottom + h * 0.06),
                (w * 0.60, h * 0.78), (w * 0.83, h * 1.02), (w * 0.14, h * 1.02),
                (w * 0.34, h * 0.80), (w * 0.40, cliff_bottom + h * 0.055)]
    poly(d, path_pts, mix(SAND, STONE, 0.42))
    poly(d, [(w * 0.47, cliff_bottom - h * 0.005), (w * 0.545, cliff_bottom + h * 0.06),
             (w * 0.60, h * 0.78), (w * 0.55, h * 0.80), (w * 0.44, cliff_bottom + h * 0.05),
             (w * 0.40, cliff_bottom + h * 0.055)], mix(STONE, CREAM, 0.35))
    # pebbles along the track
    for _ in range(26):
        t = rng.random()
        y = (cliff_bottom + h * 0.04) + (h * 0.96 - (cliff_bottom + h * 0.04)) * t
        spread = (0.02 + 0.30 * t) * w
        cx = w * (0.47 + 0.10 * t) + rng.uniform(-spread, spread)
        r = w * rng.uniform(0.004, 0.012) * (0.5 + t)
        ellipse(d, cx, y, r, r * 0.62, mix(STONE_DARK, CREAM, rng.uniform(0.1, 0.5)))
    # backpack, no person
    px, py = w * 0.285, h * 0.755
    bw, bh = w * 0.165, h * 0.135
    img = ground_shadow(img, px + bw * 0.1, py + bh * 0.10, bw * 0.72, h * 0.018,
                        opacity=0.30, blur=w * 0.012)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([px - bw / 2, py - bh, px + bw / 2, py],
                        radius=bw * 0.32, fill=mix(TERRACOTTA, SAND, 0.20))
    d.rounded_rectangle([px - bw / 2, py - bh, px + bw / 2, py - bh * 0.62],
                        radius=bw * 0.30, fill=mix(TERRACOTTA, NIGHT, 0.10))
    d.rounded_rectangle([px - bw * 0.34, py - bh * 0.95, px + bw * 0.34, py - bh * 0.50],
                        radius=bw * 0.22, fill=mix(TERRACOTTA, SAND, 0.38))
    d.rounded_rectangle([px - bw * 0.30, py - bh * 0.42, px + bw * 0.30, py - bh * 0.10],
                        radius=bw * 0.16, fill=mix(TERRACOTTA, NIGHT, 0.05))
    # straps
    d.line([(px - bw * 0.26, py - bh * 0.55), (px - bw * 0.36, py - bh * 0.05)],
           fill=mix(SAGE_DARK, NIGHT, 0.20), width=max(2, int(w * 0.012)))
    d.line([(px + bw * 0.26, py - bh * 0.55), (px + bw * 0.36, py - bh * 0.05)],
           fill=mix(SAGE_DARK, NIGHT, 0.20), width=max(2, int(w * 0.012)))
    d.line([(px - bw * 0.20, py - bh * 0.35), (px + bw * 0.20, py - bh * 0.35)],
           fill=mix(SAGE_DARK, NIGHT, 0.25), width=max(2, int(w * 0.007)))
    # side pocket + bottle
    d.rounded_rectangle([px - bw * 0.44, py - bh * 0.50, px - bw * 0.28, py - bh * 0.12],
                        radius=bw * 0.07, fill=mix(TERRACOTTA, SAND, 0.42))
    d.rounded_rectangle([px + bw * 0.30, py - bh * 0.55, px + bw * 0.40, py - bh * 0.22],
                        radius=w * 0.006, fill=mix(SKY_BLUE, CREAM, 0.25))
    # flowers and ferns
    for _ in range(28):
        fx = rng.uniform(0, w)
        fy = rng.uniform(cliff_bottom, h * 1.01)
        fr = w * rng.uniform(0.0022, 0.0045)
        if rng.random() < 0.55:
            blossom(d, fx, fy, fr, mix(CREAM_LIGHT, DUSK_PALE, rng.uniform(0.0, 0.7)),
                    mix(GOLD, TERRACOTTA, 0.30), petals=5)
        else:
            ellipse(d, fx, fy, fr, fr, mix(SAGE, CREAM, 0.25))
    # foreground leaves at the bottom corners
    for _ in range(5):
        banana_leaf(d, rng.choice([-0.03, 0.98]) * w, h * rng.uniform(0.94, 1.05),
                    h * rng.uniform(0.10, 0.17), math.radians(rng.uniform(30, 150)),
                    mix(SAGE_DEEP, NIGHT, 0.15))
    img = dof_bottom(img, 0.92, radius=h * 0.0045)
    return img


def draw_yangshuo_scooter(w, h):
    """Side profile of a little electric scooter on a mountain road."""
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h * 0.63,
                    [(0.0, "#8fa6a6"), (0.26, "#c6c3aa"), (0.50, "#ead3a6"),
                     (0.76, "#e7d7ab"), (1.0, "#d8cda4")])
    sun_x, sun_y = w * 0.24, h * 0.215
    img = sun(img, sun_x, sun_y, h * 0.028, CREAM_LIGHT, "#f5cf98", 0.75)
    img = soft_band(img, h * 0.10, h * 0.23, "#f1d7ad", 0.24, 161, cells=5,
                    contrast=2.4, thresh=0.44, blur=h * 0.010)
    d = ImageDraw.Draw(img)
    karst_range(d, w, h * 0.475, h * 0.20, mix("#b9c8c0", CREAM, 0.35),
                seed=162, count=6, min_w=0.045, max_w=0.100)
    img = mist(img, h * 0.410, h * 0.040, opacity=0.55, seed=163)
    d = ImageDraw.Draw(img)
    karst_range(d, w, h * 0.545, h * 0.18, mix("#93a894", CREAM, 0.15),
                seed=164, count=5, min_w=0.065, max_w=0.135)
    img = mist(img, h * 0.492, h * 0.030, opacity=0.35, seed=165)
    d = ImageDraw.Draw(img)
    karst_range(d, w, h * 0.625, h * 0.16, "#6f8a63", seed=166, count=4,
                min_w=0.090, max_w=0.180)
    birds(d, w * 0.70, h * 0.14, h * 0.0055, "#6d807a", n=3, seed=167, spread=3.0)
    # fields
    img = fill_grad(img, h * 0.585, h,
                    [(0.0, "#8fa77f"), (0.30, "#7d9870"), (0.66, "#6f8a63"),
                     (1.0, "#5a7550")])
    d = ImageDraw.Draw(img)
    vpx, vpy = w * 0.55, h * 0.58
    for i in range(9):
        bx = w * (-0.15 + 1.30 * i / 8.0)
        tx = vpx + (bx - vpx) * 0.16
        d.line([(tx, h * 0.588), (bx, h)], fill=mix(SAGE_DARK, SAGE, 0.40),
               width=max(1, int(w * 0.0018)))
    for k in range(3):
        yy = h * (0.66 + 0.11 * k)
        d.line([(0, yy), (w, yy + h * 0.006)], fill=mix(SAGE_DARK, SAGE, 0.45),
               width=max(1, int(h * 0.0012)))
    # road
    road_pts = [(w * 0.615, h * 0.615), (w * 0.700, h * 0.615),
                (w * 1.10, h * 1.02), (w * 0.30, h * 1.02)]
    poly(d, road_pts, mix(STONE, SAND, 0.35))
    poly(d, [(w * 0.615, h * 0.615), (w * 0.700, h * 0.615),
             (w * 1.02, h * 1.02), (w * 0.86, h * 1.02)], mix(STONE, CREAM, 0.20))
    d.line([(w * 0.612, h * 0.615), (w * 0.295, h * 1.02)],
           fill=mix(STONE_DARK, CREAM, 0.30), width=max(2, int(w * 0.006)))
    d.line([(w * 0.703, h * 0.615), (w * 1.10, h * 1.02)],
           fill=mix(STONE_DARK, CREAM, 0.25), width=max(2, int(w * 0.005)))
    road_pebbles = random.Random(168)
    for _ in range(22):
        t = road_pebbles.random()
        y = h * (0.635 + 0.37 * t)
        x = w * (0.63 + 0.20 * t) + road_pebbles.uniform(-0.16, 0.22) * w * (0.3 + t)
        r = w * road_pebbles.uniform(0.002, 0.006)
        ellipse(d, x, y, r, r * 0.6, mix(STONE_DARK, CREAM, 0.35))

    # scooter silhouette, profile facing right
    g = h * 0.883
    r = w * 0.082
    rear = (w * 0.285, g - r)
    front = (w * 0.675, g - r)
    body = mix(DEEP_TEAL, NIGHT, 0.28)
    body_mid = mix(DEEP_TEAL, TEAL_MID, 0.22)
    seat_col = mix(NIGHT, DEEP_TEAL, 0.30)
    img = ground_shadow(img, w * 0.48, g + h * 0.010, w * 0.31, h * 0.014,
                        opacity=0.34, blur=w * 0.014)
    d = ImageDraw.Draw(img)
    # wheels
    for cx, cy in (rear, front):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=mix(NIGHT, "#161d1c", 0.05))
        d.ellipse([cx - r * 0.70, cy - r * 0.70, cx + r * 0.70, cy + r * 0.70],
                  fill=body)
        d.ellipse([cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55],
                  fill=mix(STONE, SAGE, 0.25))
        d.ellipse([cx - r * 0.20, cy - r * 0.20, cx + r * 0.20, cy + r * 0.20],
                  fill=mix(NIGHT, TEAL_MID, 0.25))
    # fenders
    d.arc([rear[0] - r * 1.32, rear[1] - r * 1.32, rear[0] + r * 1.32, rear[1] + r * 1.32],
          start=195, end=345, fill=body, width=max(4, int(w * 0.016)))
    d.arc([front[0] - r * 1.32, front[1] - r * 1.32,
           front[0] + r * 1.32, front[1] + r * 1.32],
          start=205, end=335, fill=body, width=max(4, int(w * 0.016)))
    # rear body + seat
    poly(d, [(w * 0.185, g - h * 0.150), (w * 0.300, g - h * 0.172),
             (w * 0.395, g - h * 0.158), (w * 0.420, g - h * 0.098),
             (w * 0.412, g - h * 0.052), (w * 0.360, g - h * 0.040),
             (w * 0.215, g - h * 0.058), (w * 0.170, g - h * 0.098)], body)
    d.rounded_rectangle([w * 0.215, g - h * 0.196, w * 0.398, g - h * 0.158],
                        radius=h * 0.014, fill=seat_col)
    d.rounded_rectangle([w * 0.240, g - h * 0.190, w * 0.375, g - h * 0.174],
                        radius=h * 0.008, fill=mix(seat_col, TEAL_MID, 0.22))
    # sage panel accent
    d.rounded_rectangle([w * 0.240, g - h * 0.130, w * 0.345, g - h * 0.070],
                        radius=w * 0.018, fill=mix(SAGE, body, 0.35))
    # floorboard
    poly(d, [(w * 0.365, g - h * 0.058), (w * 0.610, g - h * 0.052),
             (w * 0.618, g - h * 0.030), (w * 0.362, g - h * 0.036)],
         mix(body, NIGHT, 0.20))
    # front shield + column
    poly(d, [(w * 0.596, g - h * 0.056), (w * 0.626, g - h * 0.198),
             (w * 0.668, g - h * 0.208), (w * 0.664, g - h * 0.042),
             (w * 0.612, g - h * 0.038)], body)
    poly(d, [(w * 0.628, g - h * 0.150), (w * 0.660, g - h * 0.158),
             (w * 0.658, g - h * 0.070), (w * 0.630, g - h * 0.066)],
         mix(SAGE, body, 0.30))
    # handlebar
    d.line([(w * 0.648, g - h * 0.205), (w * 0.648, g - h * 0.245),
            (w * 0.742, g - h * 0.238)], fill=body, width=max(3, int(w * 0.014)),
           joint="curve")
    d.line([(w * 0.735, g - h * 0.240), (w * 0.762, g - h * 0.236)],
           fill=mix(NIGHT, TEAL_MID, 0.25), width=max(4, int(w * 0.018)))
    # mirror
    d.line([(w * 0.700, g - h * 0.240), (w * 0.724, g - h * 0.283)],
           fill=body, width=max(2, int(w * 0.007)))
    ellipse(d, w * 0.730, g - h * 0.289, w * 0.021, w * 0.016,
            mix(CREAM_LIGHT, SKY_BLUE, 0.25))
    # headlight + glow
    hx, hy = w * 0.668, g - h * 0.172
    img = add_glow(img, hx + w * 0.02, hy, w * 0.075, "#f6d9a4", 0.55)
    d = ImageDraw.Draw(img)
    ellipse(d, hx, hy, w * 0.019, w * 0.019, mix(CREAM_LIGHT, GOLD_LIGHT, 0.30))
    ellipse(d, hx, hy, w * 0.010, w * 0.010, CREAM_LIGHT)
    # front basket
    d.rounded_rectangle([w * 0.688, g - h * 0.214, w * 0.790, g - h * 0.168],
                        radius=w * 0.012, fill=mix(SAND, TERRACOTTA, 0.30))
    for i in range(4):
        bx = w * (0.700 + 0.023 * i)
        d.line([(bx, g - h * 0.210), (bx, g - h * 0.172)],
               fill=mix(SAND_DEEP, TERRACOTTA, 0.25), width=max(1, int(w * 0.003)))
    # kickstand + warm rim light
    d.line([(w * 0.330, g - h * 0.048), (w * 0.300, g + h * 0.002)],
           fill=mix(NIGHT, TEAL_MID, 0.20), width=max(2, int(w * 0.006)))
    rim = mix(GOLD_LIGHT, TERRACOTTA, 0.35)
    d.line([(w * 0.300, g - h * 0.173), (w * 0.395, g - h * 0.159)],
           fill=rim, width=max(1, int(w * 0.004)))
    d.line([(w * 0.626, g - h * 0.199), (w * 0.668, g - h * 0.209)],
           fill=rim, width=max(1, int(w * 0.004)))
    d.line([(w * 0.648, g - h * 0.245), (w * 0.742, g - h * 0.238)],
           fill=rim, width=max(1, int(w * 0.004)))
    # roadside grass, blurred foreground
    grass_tufts(d, 0, w, h * 1.005, h * 0.05, mix(SAGE_DEEP, NIGHT, 0.15),
                seed=169, n=30, width=w * 0.0035)
    img = dof_bottom(img, 0.96, radius=h * 0.004)
    return img


def dappled_light(img, x0, y0, x1, y1, seed=0, n=36, size=(0.010, 0.040),
                  opacity=0.18, blur=6):
    """Soft circular light spots (sun through leaves)."""
    w, h = img.size
    rng = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        cx = rng.uniform(x0, x1)
        cy = rng.uniform(y0, y1)
        r = min(w, h) * rng.uniform(*size)
        ellipse(d, cx, cy, r, r * rng.uniform(0.45, 0.95),
                rgba(CREAM_LIGHT, int(opacity * 255)))
    return comp(img, layer.filter(ImageFilter.GaussianBlur(blur)))


def bubbles_glow(img, cx, cy, r, color=GOLD_LIGHT, opacity=0.8):
    return add_glow(img, cx, cy, r, color, opacity)


# --------------------------------------------------------------------------
# CHIANG MAI -- jungle trail, temples, warm bars and northern food
# --------------------------------------------------------------------------
def draw_chiangmai_trail(w, h):
    """Monk's trail: hanging leaves, big trunks, bamboo gate, dappled path."""
    rng = random.Random(171)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#22352c"), (0.16, "#2c4437"), (0.36, "#3d5a45"),
                     (0.56, "#4c6a51"), (0.76, "#5d7a58"), (1.0, "#6f8a63")])
    img = add_glow(img, w * 0.52, h * 0.02, w * 0.50, "#f0d9a4", 0.22)
    d = ImageDraw.Draw(img)
    # canopy edge
    for k in range(9):
        cx = w * rng.uniform(-0.12, 1.12)
        cy = h * rng.uniform(-0.16, 0.05)
        r = w * rng.uniform(0.08, 0.17)
        foliage(d, cx, cy, r, r * 0.55,
                ["#1c2d26", "#24382f", "#2c4437"], seed=k + 40, n=7)
    for k in range(14):
        banana_leaf(d, w * rng.uniform(-0.08, 1.08), -h * 0.01,
                    h * rng.uniform(0.10, 0.21),
                    math.radians(rng.uniform(50, 130)),
                    mix("#24382f", SAGE_DARK, rng.uniform(0.0, 0.28)))
    img = light_shafts(img, w * 0.46, -h * 0.04, h * 0.58, w * 0.05, w * 0.18,
                       opacity=0.06, seed=172, n=1, spread=0.10, slant=0.08,
                       blur=w * 0.05)
    d = ImageDraw.Draw(img)
    # framing trunks
    tree_trunk(d, w * 0.055, h * 1.03, h * 0.98, w * 0.070, "#2b4034",
               lean=-0.02, seed=173, branches=2)
    tree_trunk(d, w * 0.945, h * 1.03, h * 0.92, w * 0.064, "#283c30",
               lean=0.03, seed=174, branches=2)
    for cx, cy, r in ((w * 0.09, h * 0.10, w * 0.11),
                      (w * 0.90, h * 0.12, w * 0.12),
                      (w * 0.52, h * 0.055, w * 0.15)):
        foliage(d, cx, cy, r, r * 0.55,
                ["#24382f", "#2c4437", "#34503d"], seed=175, n=7)
    for k in range(6):
        bx = w * rng.uniform(0.0, 1.0)
        banana_leaf(d, bx, h * 0.02, h * rng.uniform(0.09, 0.15),
                    math.radians(rng.uniform(60, 120)),
                    mix("#24382f", SAGE_DARK, 0.25))
    # forest floor
    img = fill_grad(img, h * 0.52, h,
                    [(0.0, "#4c6a51"), (0.30, "#55704f"), (0.65, "#65804f"),
                     (1.0, "#78925c")])
    d = ImageDraw.Draw(img)
    for k in range(16):
        cx = w * rng.uniform(-0.05, 1.05)
        r = w * rng.uniform(0.035, 0.085)
        foliage(d, cx, h * 0.523, r * 1.7, r * 0.55,
                ["#3d5a45", "#45604a", "#4c6a51"], seed=int(cx) + 11, n=6)
    img = mist(img, h * 0.520, h * 0.030, opacity=0.30, seed=181)
    d = ImageDraw.Draw(img)
    rng2 = random.Random(176)
    for _ in range(3):
        cx = w * rng2.choice([rng2.uniform(-0.15, 0.10), rng2.uniform(0.90, 1.15)])
        cy = h * rng2.uniform(0.62, 0.98)
        r = w * rng2.uniform(0.10, 0.20)
        foliage(d, cx, cy, r, r * 0.35,
                ["#45604a", "#4c6a51", "#55704f"], seed=int(cx) + 3, n=6)
    # winding trail
    path = [(w * 0.29, h * 1.02), (w * 0.38, h * 0.90), (w * 0.45, h * 0.78),
            (w * 0.475, h * 0.66), (w * 0.49, h * 0.56), (w * 0.545, h * 0.56),
            (w * 0.57, h * 0.66), (w * 0.60, h * 0.78), (w * 0.68, h * 0.90),
            (w * 0.79, h * 1.02)]
    poly(d, path, mix(SAND, STONE, 0.40))
    poly(d, [(w * 0.29, h * 1.02), (w * 0.38, h * 0.90), (w * 0.45, h * 0.78),
             (w * 0.475, h * 0.66), (w * 0.49, h * 0.56), (w * 0.515, h * 0.56),
             (w * 0.49, h * 0.68), (w * 0.468, h * 0.80), (w * 0.395, h * 0.92),
             (w * 0.325, h * 1.02)], mix(SAND, CREAM, 0.35))
    for _ in range(26):
        t = rng2.random()
        y = h * (0.545 + 0.47 * t)
        half = w * (0.035 + 0.20 * t)
        cx = w * (0.517 + 0.16 * (t - 0.5)) + rng2.uniform(-half, half) * 0.45
        r = w * rng2.uniform(0.003, 0.010) * (0.5 + t)
        ellipse(d, cx, y, r, r * 0.55,
                mix(STONE_DARK, CREAM, rng2.uniform(0.2, 0.6)))
    # roots crossing the trail
    for _ in range(4):
        t = rng2.uniform(0.15, 0.75)
        yy = h * (0.56 + 0.44 * t)
        x0 = w * (0.46 - 0.10 * t + 0.02 * rng2.random())
        x1 = x0 + w * (0.08 + 0.10 * t)
        d.line([(x0, yy), (x0 + (x1 - x0) * 0.5, yy + h * 0.006), (x1, yy - h * 0.004)],
               fill=mix(WOOD_DARK, NIGHT, 0.30), width=max(2, int(w * 0.006)))
    # stone steps on the trail
    for k in range(8):
        t = k / 7.0
        yy = h * (0.585 + 0.40 * t)
        half = w * (0.045 + 0.115 * t)
        cx = w * (0.518 + 0.10 * t)
        d.line([(cx - half, yy), (cx + half * 0.6, yy + h * 0.006),
                (cx + half, yy)],
               fill=mix(SAND, STONE_DARK, 0.30), width=max(2, int(h * 0.0045)))
    # bamboo gate
    gate_y = h * 0.575
    post_h = h * 0.165
    bamboo_col = mix(SAGE, "#c2b482", 0.55)
    for px in (w * 0.462, w * 0.575):
        d.rectangle([px - w * 0.013, gate_y - post_h, px + w * 0.013,
                     gate_y + h * 0.012], fill=bamboo_col)
        for k in range(4):
            yy = gate_y - post_h + post_h * k / 4.0
            d.line([(px - w * 0.015, yy), (px + w * 0.015, yy)],
                   fill=mix(WOOD, SAGE_DARK, 0.40), width=max(1, int(w * 0.0030)))
    d.rectangle([w * 0.444, gate_y - post_h - h * 0.014, w * 0.593,
                 gate_y - post_h + h * 0.002], fill=bamboo_col)
    for px in (w * 0.462, w * 0.575):
        d.rectangle([px - w * 0.019, gate_y - post_h - h * 0.016,
                     px + w * 0.019, gate_y - post_h + h * 0.004],
                    fill=mix(TERRACOTTA, WOOD, 0.30))
    # diagonal brace
    d.line([(w * 0.462, gate_y - post_h * 0.55), (w * 0.575, gate_y - post_h + h * 0.010)],
           fill=mix(WOOD, SAGE_DARK, 0.45), width=max(2, int(w * 0.0055)))
    # warm little lantern hanging from the gate
    lan_x, lan_y = w * 0.520, gate_y - post_h + h * 0.030
    d.line([(lan_x, gate_y - post_h + h * 0.002), (lan_x, lan_y - h * 0.014)],
           fill=mix(NIGHT, WOOD_DARK, 0.30), width=max(1, int(w * 0.0026)))
    img = add_glow(img, lan_x, lan_y, w * 0.085, "#f4c07a", 0.60)
    d = ImageDraw.Draw(img)
    ellipse(d, lan_x, lan_y, w * 0.016, h * 0.018,
            mix("#e8a35c", GOLD_LIGHT, 0.35))
    ellipse(d, lan_x, lan_y, w * 0.010, h * 0.011, "#f6d8a0")
    d.line([(lan_x - w * 0.018, lan_y - h * 0.018), (lan_x + w * 0.018, lan_y - h * 0.018)],
           fill=mix(TERRACOTTA_DEEP, NIGHT, 0.30), width=max(1, int(w * 0.003)))
    # ferns along the edges
    rng3 = random.Random(177)
    for _ in range(12):
        fx = rng3.choice([rng3.uniform(0.02, 0.36), rng3.uniform(0.66, 1.0)]) * w
        fy = rng3.uniform(0.57, 1.0) * h
        for j in range(5):
            a = math.radians(18 + j * 36)
            frond(d, fx, fy, a, w * rng3.uniform(0.035, 0.075), 0.40,
                  w * 0.007, mix(SAGE_DARK, SAGE, rng3.uniform(0.10, 0.40)))
    grass_tufts(d, 0, w, h * 1.005, h * 0.05, SAGE_DARK, seed=178, n=40,
                width=w * 0.0035)
    grass_tufts(d, w * 0.30, w * 0.70, h * 1.005, h * 0.030, mix(SAGE, SAND, 0.30),
                seed=179, n=20, width=w * 0.0025)
    # leaf litter
    for _ in range(34):
        lx = w * rng3.uniform(0, 1)
        ly = h * rng3.uniform(0.56, 1.0)
        r = w * rng3.uniform(0.003, 0.008)
        ellipse(d, lx, ly, r * 1.8, r * 0.8,
                rng3.choice([mix(TERRACOTTA, NIGHT, 0.35),
                             mix(SAND, NIGHT, 0.30), mix(SAGE_DARK, NIGHT, 0.20)]))
    # foreground leaves, blurred
    for ang, ln, bx in ((-62, 0.22, -0.02), (-108, 0.20, 0.02), (-84, 0.17, -0.06),
                        (-118, 0.19, 0.98), (-66, 0.21, 1.02), (-96, 0.16, 0.92)):
        banana_leaf(d, bx * w, h * 1.02, h * ln, math.radians(ang),
                    mix(SAGE_DEEP, NIGHT, 0.18))
    img = dappled_light(img, w * 0.10, h * 0.36, w * 0.90, h * 1.0, seed=180,
                        n=34, size=(0.010, 0.030), opacity=0.18, blur=w * 0.012)
    img = dof_bottom(img, 0.92, radius=h * 0.005)
    img = dof_top(img, 0.06, radius=h * 0.004, strength=0.8)
    return img
def draw_chiangmai_temple(w, h):
    """Golden chedi and temple roof against a deep blue northern sky."""
    rng = random.Random(471)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h * 0.90,
                    [(0.0, "#5a8aa2"), (0.26, "#7fa6b8"), (0.52, "#a9c9d1"),
                     (0.74, "#cfdcd4"), (1.0, "#e6e0c9")])
    img = add_glow(img, w * 0.42, h * 0.20, w * 0.60, "#f6e3bd", 0.32)
    img = soft_band(img, h * 0.06, h * 0.26, CREAM_LIGHT, 0.34, 472, cells=6,
                    contrast=2.4, thresh=0.44, blur=h * 0.012)
    img = soft_band(img, h * 0.16, h * 0.34, "#f8efd8", 0.22, 476, cells=9,
                    contrast=2.6, thresh=0.46, blur=h * 0.010)
    d = ImageDraw.Draw(img)
    birds(d, w * 0.76, h * 0.14, h * 0.0045, "#6d807a", n=3, seed=473, spread=2.6)
    birds(d, w * 0.22, h * 0.20, h * 0.0040, "#6d807a", n=2, seed=477, spread=2.4)
    # temple hall on the right with tiered terracotta roof
    hx0, hx1 = w * 0.585, w * 1.03
    base_y = h * 0.755
    d.rectangle([hx0, base_y - h * 0.135, hx1, base_y],
                fill=mix(CREAM, SAND, 0.25))
    for k in range(3):
        wx = hx0 + w * (0.04 + 0.13 * k)
        d.rectangle([wx, base_y - h * 0.075, wx + w * 0.07, base_y - h * 0.015],
                    fill=mix(TILE, NIGHT, 0.20))
    # roof tiers with slightly upturned eaves
    for k, (ridge_y, eave_y, inset) in enumerate(((h * 0.560, h * 0.640, 0.030),
                                                  (h * 0.492, h * 0.585, 0.075))):
        ex0 = hx0 - w * (0.055 - inset)
        ex1 = hx1 + w * (0.030 - inset * 0.40)
        poly(d, [(ex0, eave_y + h * 0.006), (ex0 + w * 0.030, eave_y),
                 (ex1 - w * 0.030, eave_y - h * 0.006), (ex1, eave_y + h * 0.004),
                 (ex1 - w * 0.052, ridge_y + h * 0.010),
                 (ex0 + w * 0.060, ridge_y + h * 0.014)],
             mix(TERRACOTTA, GOLD, 0.16))
        d.line(P([(ex0, eave_y + h * 0.006), (ex0 + w * 0.030, eave_y),
                  (ex1 - w * 0.030, eave_y - h * 0.006),
                  (ex1, eave_y + h * 0.004)]),
               fill=mix(TILE, NIGHT, 0.10), width=max(2, int(h * 0.006)))
    # golden gable ornament
    gx = hx0 + w * 0.245
    poly(d, [(gx - w * 0.070, h * 0.492), (gx + w * 0.070, h * 0.492),
             (gx + w * 0.050, h * 0.430), (gx, h * 0.410),
             (gx - w * 0.050, h * 0.430)], mix(GOLD, GOLD_LIGHT, 0.28))
    d.line([(gx, h * 0.410), (gx, h * 0.360)], fill=GOLD_DEEP,
           width=max(2, int(w * 0.005)))
    ellipse(d, gx, h * 0.358, w * 0.008, w * 0.008, GOLD_LIGHT)
    # golden glow behind the chedi
    img = add_glow(img, w * 0.385, h * 0.50, w * 0.40, "#f7e0a8", 0.55)
    d = ImageDraw.Draw(img)
    chedi(d, w * 0.385, h * 0.755, w * 0.300, h * 0.430, h * 0.170)
    # brick base wall
    d.rectangle([w * 0.08, h * 0.755, w * 0.70, h * 0.835],
                fill=mix(BRICK, NIGHT, 0.20))
    for k in range(4):
        yy = h * (0.755 + 0.020 * k)
        d.line([(w * 0.08, yy), (w * 0.70, yy)],
               fill=mix(BRICK_DARK, NIGHT, 0.22), width=max(1, int(h * 0.0026)))
    for k in range(6):
        xx = w * (0.10 + 0.10 * k)
        d.line([(xx, h * 0.755), (xx, h * 0.835)],
               fill=mix(BRICK_DARK, NIGHT, 0.30), width=max(1, int(w * 0.0018)))
    # courtyard steps
    for k in range(5):
        yy = h * (0.835 + 0.033 * k)
        d.rectangle([0, yy, w, yy + h * 0.033],
                    fill=mix(STONE, CREAM, 0.34 - 0.05 * k))
        d.line([(0, yy), (w, yy)], fill=mix(STONE_DARK, NIGHT, 0.16),
               width=max(1, int(h * 0.0026)))
    img = fill_grad(img, h * 0.998, h, [(0.0, "#cfc6ae"), (1.0, "#c2b89e")])
    # tropical leaves framing
    d = ImageDraw.Draw(img)
    for ang, ln in ((-38, 0.34), (-68, 0.38), (-100, 0.32), (-132, 0.26)):
        banana_leaf(d, -w * 0.01, -h * 0.02, h * ln, math.radians(ang),
                    mix(SAGE_DARK, NIGHT, 0.16), mix(SAGE_DEEP, NIGHT, 0.22))
    for ang, ln in ((-142, 0.32), (-112, 0.36), (-80, 0.28), (-48, 0.22)):
        banana_leaf(d, w * 1.01, -h * 0.02, h * ln, math.radians(ang),
                    mix(SAGE_DARK, NIGHT, 0.20), mix(SAGE_DEEP, NIGHT, 0.24))
    # a frangipani branch on the left
    d.line(P([(-w * 0.02, h * 0.30), (w * 0.075, h * 0.315),
              (w * 0.145, h * 0.285)]), fill=mix(WOOD_DARK, NIGHT, 0.20),
           width=max(2, int(w * 0.007)))
    for k in range(5):
        lx = w * (0.03 + 0.026 * k)
        ly = h * (0.300 + 0.014 * math.sin(k * 1.7))
        banana_leaf(d, lx, ly, h * 0.045, math.radians(-40 + k * 18),
                    mix(SAGE_DARK, SAGE, 0.25))
    for k in range(4):
        blossom(d, w * (0.05 + 0.024 * k), h * (0.290 - 0.006 * k),
                w * 0.012, mix(CREAM_LIGHT, DUSK_PALE, 0.15),
                mix(GOLD, TERRACOTTA, 0.30))
    # foreground shrubs with blossoms
    for k in range(7):
        cx = w * (-0.02 + 0.17 * k)
        foliage(d, cx, h * 1.01, w * 0.085, h * 0.030,
                ["#4c6a51", "#5d7a58", "#3d5a45"], seed=474 + k, n=7)
    rng2 = random.Random(480)
    for _ in range(12):
        fx = rng2.uniform(0, w)
        blossom(d, fx, h * rng2.uniform(0.985, 1.02),
                w * rng2.uniform(0.007, 0.013),
                mix(DUSK_PALE, CREAM_LIGHT, 0.25),
                mix(TERRACOTTA, GOLD, 0.35))
    img = dappled_light(img, w * 0.04, h * 0.78, w * 0.96, h * 1.0, seed=475,
                        n=18, size=(0.008, 0.020), opacity=0.12, blur=w * 0.010)
    img = dof_bottom(img, 0.95, radius=h * 0.004)
    return img
def draw_chiangmai_forest(w, h):
    """Wat Umong: mossy brick wall, seated stone figure, dappled forest light."""
    rng = random.Random(491)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#1b2e26"), (0.24, "#243a2d"), (0.50, "#33503b"),
                     (0.74, "#2c4433"), (1.0, "#243a2b")])
    img = add_glow(img, w * 0.30, h * 0.02, w * 0.55, "#e8d5a0", 0.35)
    img = light_shafts(img, w * 0.34, -h * 0.05, h * 0.72, w * 0.06, w * 0.24,
                       opacity=0.10, seed=492, n=2, spread=0.22, slant=-0.06,
                       blur=w * 0.045)
    d = ImageDraw.Draw(img)
    # canopy
    for k in range(7):
        cx = w * rng.uniform(-0.10, 1.10)
        cy = h * rng.uniform(-0.15, 0.02)
        r = w * rng.uniform(0.10, 0.20)
        foliage(d, cx, cy, r, r * 0.52,
                ["#16261f", "#1b2e26", "#243a2d"], seed=k + 60, n=7)
    for k in range(12):
        bx = w * rng.uniform(-0.05, 1.05)
        banana_leaf(d, bx, -h * 0.01, h * rng.uniform(0.07, 0.14),
                    math.radians(rng.uniform(55, 125)),
                    mix("#1b2e26", "#2c4437", 0.35))
    # trunks
    tree_trunk(d, w * 0.105, h * 1.04, h * 1.00, w * 0.062, "#263a2c",
               lean=0.02, seed=493, branches=2)
    tree_trunk(d, w * 0.930, h * 1.04, h * 0.94, w * 0.056, "#22362a",
               lean=-0.03, seed=494, branches=2)

    # brick wall
    wall_top = h * 0.300
    wall_bot = h * 0.775
    brick = mix(BRICK, NIGHT, 0.34)
    brick_dark = mix(BRICK_DARK, NIGHT, 0.40)
    d.rectangle([0, wall_top, w, wall_bot], fill=brick)
    rows = 12
    for r in range(rows):
        y0 = wall_top + (wall_bot - wall_top) * r / rows
        y1 = wall_top + (wall_bot - wall_top) * (r + 1) / rows
        d.line([(0, y1), (w, y1)], fill=mix(brick, brick_dark, 0.55),
               width=max(1, int(h * 0.0018)))
        offset = (r % 2) * (w / 34.0)
        for cj in range(-1, 35):
            xx = offset + cj * (w / 17.0)
            d.line([(xx, y0), (xx, y1)], fill=mix(brick, brick_dark, 0.35),
                   width=max(1, int(w * 0.0013)))
        for cj in range(-1, 18):
            bx = offset + cj * (w / 17.0) + 2
            d.rectangle([bx, y0 + 1, bx + w / 17.0 - 4, y1 - 1],
                        fill=mix(brick, rng.choice((BRICK_DARK, SAND_DEEP, BRICK)),
                                 rng.uniform(0.03, 0.10)))
    # moss and weathering
    moss = mix(SAGE_DARK, brick, 0.45)
    for _ in range(9):
        mx = rng.uniform(0, w)
        my = rng.uniform(wall_bot - h * 0.19, wall_bot)
        for _ in range(7):
            ellipse(d, mx + rng.uniform(-0.045, 0.045) * w,
                    my + rng.uniform(-0.030, 0.030) * h,
                    w * rng.uniform(0.006, 0.022), h * rng.uniform(0.003, 0.010),
                    mix(moss, rng.choice((SAGE, SAGE_DARK, brick)),
                        rng.uniform(0.0, 0.35)))
    for _ in range(40):
        ellipse(d, rng.uniform(0, w), rng.uniform(wall_top, wall_bot),
                w * rng.uniform(0.0015, 0.004), h * rng.uniform(0.0015, 0.004),
                mix(moss, brick, rng.uniform(0.0, 0.4)))
    for _ in range(12):
        cx = rng.uniform(0, w)
        cy = rng.uniform(wall_top, wall_bot)
        ellipse(d, cx, cy, w * rng.uniform(0.008, 0.030),
                h * rng.uniform(0.004, 0.016), mix(STONE_DARK, brick, 0.45))
    # wall coping
    d.rectangle([0, wall_top - h * 0.020, w, wall_top],
                fill=mix(TILE, brick, 0.30))
    d.rectangle([0, wall_top - h * 0.020, w, wall_top - h * 0.013],
                fill=mix(NIGHT, TILE, 0.40))
    # hanging roots / vines over the wall
    for _ in range(6):
        vx = rng.uniform(0, w)
        vy = wall_top - h * 0.010
        pts = [(vx, vy)]
        for j in range(1, 7):
            pts.append((vx + math.sin(j * 1.3 + vx) * w * 0.010,
                        vy + h * 0.020 * j))
        d.line(P(pts), fill=mix(WOOD_DARK, NIGHT, 0.35), width=max(1, int(w * 0.0018)))
        for j in range(1, 6):
            ellipse(d, pts[j][0], pts[j][1], w * 0.004, w * 0.006,
                    mix(SAGE_DARK, SAGE, 0.30))

    # arched niche with seated stone figure
    nx, ny = w * 0.500, h * 0.600
    nw, nh = w * 0.095, h * 0.215
    d.rectangle([nx - nw * 1.18, ny - nh, nx + nw * 1.18, ny + nh * 0.42],
                fill=mix(brick, NIGHT, 0.12))
    d.pieslice([nx - nw, ny - nh - nw * 0.45, nx + nw, ny - nh + nw * 0.45],
               start=180, end=360, fill=mix(NIGHT, brick_dark, 0.35))
    d.rectangle([nx - nw, ny - nh, nx + nw, ny + nh * 0.42],
                fill=mix(NIGHT, brick_dark, 0.35))
    d.pieslice([nx - nw * 0.86, ny - nh - nw * 0.30, nx + nw * 0.86,
                ny - nh + nw * 0.30], start=180, end=360,
               fill=mix(NIGHT, brick_dark, 0.20))
    d.rectangle([nx - nw * 0.86, ny - nh, nx + nw * 0.86, ny + nh * 0.34],
                fill=mix(NIGHT, brick_dark, 0.20))
    stone = mix(STONE_DARK, SAGE_DARK, 0.38)
    stone_dark = mix(stone, NIGHT, 0.45)
    base_y = ny + nh * 0.32
    # plinth
    d.rectangle([nx - nw * 0.72, base_y - nh * 0.060, nx + nw * 0.72, base_y],
                fill=stone_dark)
    d.rectangle([nx - nw * 0.80, base_y, nx + nw * 0.80, base_y + nh * 0.030],
                fill=stone)
    # crossed legs
    d.rounded_rectangle([nx - nw * 0.60, base_y - nh * 0.150,
                         nx + nw * 0.60, base_y - nh * 0.045],
                        radius=nw * 0.20, fill=stone)
    # torso
    poly(d, [(nx - nw * 0.36, base_y - nh * 0.140),
             (nx + nw * 0.36, base_y - nh * 0.140),
             (nx + nw * 0.46, base_y - nh * 0.350),
             (nx + nw * 0.40, base_y - nh * 0.440),
             (nx - nw * 0.40, base_y - nh * 0.440),
             (nx - nw * 0.46, base_y - nh * 0.350)], stone)
    # arms folded into the lap
    d.rounded_rectangle([nx - nw * 0.46, base_y - nh * 0.190,
                         nx + nw * 0.46, base_y - nh * 0.130],
                        radius=nw * 0.10, fill=stone_dark)
    # neck + head + topknot, with a halo behind
    d.rectangle([nx - nw * 0.09, base_y - nh * 0.500,
                 nx + nw * 0.09, base_y - nh * 0.430], fill=stone)
    d.ellipse([nx - nw * 0.32, base_y - nh * 0.660,
               nx + nw * 0.32, base_y - nh * 0.400],
              outline=mix(stone, NIGHT, 0.20), width=max(2, int(w * 0.004)))
    ellipse(d, nx, base_y - nh * 0.535, nw * 0.155, nh * 0.075, stone)
    ellipse(d, nx, base_y - nh * 0.585, nw * 0.062, nh * 0.028, stone_dark)
    # moss on the figure
    for k in range(7):
        ellipse(d, nx + rng.uniform(-0.4, 0.4) * nw,
                base_y - nh * rng.uniform(0.12, 0.56),
                nw * rng.uniform(0.04, 0.10), nh * rng.uniform(0.012, 0.030),
                mix(SAGE, NIGHT, 0.22))
    # warm side light on the figure
    d.line([(nx - nw * 0.38, base_y - nh * 0.44),
            (nx - nw * 0.50, base_y - nh * 0.30),
            (nx - nw * 0.42, base_y - nh * 0.055)],
           fill=mix(stone, GOLD_LIGHT, 0.30), width=max(2, int(w * 0.004)))

    # ground
    img = fill_grad(img, wall_bot - h * 0.004, h,
                    [(0.0, "#2b4232"), (0.40, "#35503b"), (1.0, "#293e2e")])
    d = ImageDraw.Draw(img)
    d.rectangle([0, wall_bot - h * 0.008, w, wall_bot + h * 0.006],
                fill=mix(NIGHT, SAGE_DEEP, 0.20))
    for _ in range(80):
        lx = rng.uniform(0, w)
        ly = rng.uniform(wall_bot, h)
        r = w * rng.uniform(0.002, 0.006) * (1.0 + (ly / h))
        ellipse(d, lx, ly, r * 3.2, r * 0.7,
                rng.choice([mix(SAGE_DARK, NIGHT, 0.35),
                            mix(SAND_DEEP, NIGHT, 0.45),
                            mix(SAGE, NIGHT, 0.30)]))
    for _ in range(10):
        rx = rng.uniform(0, w)
        ry = rng.uniform(wall_bot + h * 0.01, h * 0.98)
        d.ellipse([rx - w * rng.uniform(0.01, 0.03), ry - h * 0.006,
                   rx + w * rng.uniform(0.01, 0.03), ry + h * 0.006],
                  fill=mix(STONE_DARK, NIGHT, 0.40))
    grass_tufts(d, 0, w, h * 1.005, h * 0.030, mix(SAGE_DARK, NIGHT, 0.20),
                seed=495, n=30, width=w * 0.0025)
    # dappled sunlight
    img = dappled_light(img, w * 0.05, h * 0.28, w * 0.95, h * 0.76, seed=496,
                        n=40, size=(0.010, 0.028), opacity=0.22, blur=w * 0.010)
    img = dappled_light(img, w * 0.02, h * 0.76, w * 0.98, h * 1.0, seed=497,
                        n=24, size=(0.008, 0.022), opacity=0.16, blur=w * 0.010)
    # foreground leaves
    d = ImageDraw.Draw(img)
    for ang, ln, bx in ((-70, 0.16, -0.02), (-120, 0.14, 0.04), (-95, 0.12, -0.08),
                        (-80, 0.15, 1.02), (-125, 0.13, 0.96), (-100, 0.14, 0.90)):
        banana_leaf(d, bx * w, h * 1.03, h * ln, math.radians(ang),
                    mix(SAGE_DEEP, NIGHT, 0.25))
    img = add_glow(img, w * 0.52, h * 0.06, w * 0.35, "#e8d9a8", 0.20)
    img = dof_bottom(img, 0.93, radius=h * 0.005)
    return img
def draw_chiangmai_bar(w, h):
    """Night bar: warm pendant lamps, glowing bottles, two glasses on wood."""
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#14262a"), (0.34, "#1e3333"), (0.62, "#284340"),
                     (1.0, "#1c2d2b")])
    img = add_glow(img, w * 0.50, h * 0.40, w * 0.48, "#e8a866", 0.28)
    d = ImageDraw.Draw(img)
    img = string_lights(img, (-w * 0.02, h * 0.085), (w * 1.02, h * 0.135),
                        h * 0.050, color=GOLD_LIGHT, n=13, seed=201)
    # pendant lamps
    lamps = ((w * 0.235, h * 0.245, w * 0.032), (w * 0.520, h * 0.195, w * 0.027),
             (w * 0.790, h * 0.265, w * 0.029))
    for lx, ly, r in lamps:
        img = add_glow(img, lx, ly + r * 0.70, r * 3.2, "#f6c98a", 0.50)
    d = ImageDraw.Draw(img)
    for lx, ly, r in lamps:
        d.line([(lx, 0), (lx, ly - r * 0.6)], fill=mix(NIGHT, TEAL_MID, 0.22),
               width=max(1, int(w * 0.0026)))
        poly(d, [(lx - r * 0.22, ly - r * 0.75), (lx + r * 0.22, ly - r * 0.75),
                 (lx + r, ly + r * 0.55), (lx - r, ly + r * 0.55)],
             mix(TERRACOTTA, NIGHT, 0.20))
        ellipse(d, lx, ly + r * 0.50, r * 0.82, r * 0.22,
                mix(GOLD_LIGHT, TERRACOTTA, 0.30))
    for lx, ly, r in lamps:
        img = add_glow(img, lx, ly + r * 0.62, r * 1.6, "#fbe0aa", 0.60)
        d = ImageDraw.Draw(img)
        ellipse(d, lx, ly + r * 0.62, r * 0.30, r * 0.30, CREAM_LIGHT)
    # back shelf + bottles
    wood = mix(WOOD, NIGHT, 0.35)
    for sy in (h * 0.470, h * 0.585):
        d.rectangle([w * 0.10, sy, w * 0.90, sy + h * 0.014], fill=wood)
        d.line([(w * 0.10, sy), (w * 0.90, sy)],
               fill=mix(WOOD, GOLD, 0.30), width=max(1, int(h * 0.0022)))
    bottle_cols = [mix(SAGE_DARK, NIGHT, 0.30), mix(TERRACOTTA_DEEP, NIGHT, 0.25),
                   mix(TEAL_SOFT, NIGHT, 0.30), mix(GOLD_DEEP, NIGHT, 0.30)]
    rng = random.Random(202)
    for row, sy in enumerate((h * 0.470, h * 0.585)):
        n = 8 if row == 0 else 7
        for i in range(n):
            bx = w * (0.14 + 0.72 * (i + 0.5) / n)
            bh = h * rng.uniform(0.030, 0.055)
            bw = w * rng.uniform(0.012, 0.018)
            col = bottle_cols[rng.randrange(len(bottle_cols))]
            d.rounded_rectangle([bx - bw, sy - bh, bx + bw, sy],
                                radius=bw * 0.45, fill=col)
            d.rectangle([bx - bw * 0.32, sy - bh - h * 0.014,
                         bx + bw * 0.32, sy - bh + h * 0.002], fill=col)
            d.line([(bx - bw * 0.5, sy - bh * 0.7), (bx - bw * 0.5, sy - bh * 0.2)],
                   fill=mix(CREAM_LIGHT, col, 0.55), width=max(1, int(w * 0.0022)))
    # counter
    counter_y = h * 0.700
    d.rectangle([-4, counter_y, w + 4, counter_y + h * 0.030],
                fill=mix(WOOD, GOLD, 0.22))
    d.line([(-4, counter_y), (w + 4, counter_y)], fill=mix(GOLD_LIGHT, WOOD, 0.30),
           width=max(2, int(h * 0.004)))
    d.rectangle([-4, counter_y + h * 0.030, w + 4, h * 0.900], fill=wood)
    for i in range(9):
        xx = w * i / 8.0
        d.line([(xx, counter_y + h * 0.032), (xx, h * 0.898)],
               fill=mix(WOOD_DARK, NIGHT, 0.30), width=max(1, int(w * 0.0022)))
    # glasses + candle + plant on the counter
    glass(d, w * 0.360, counter_y + h * 0.006, w * 0.058, h * 0.075,
          liquid=mix(GOLD, TERRACOTTA, 0.35))
    glass(d, w * 0.470, counter_y + h * 0.004, w * 0.054, h * 0.068,
          liquid="#e2b46e")
    for gx, gy in ((w * 0.360, counter_y - h * 0.024), (w * 0.470, counter_y - h * 0.022)):
        ellipse(d, gx, gy, w * 0.020, h * 0.007, mix(CREAM_LIGHT, SKY_BLUE, 0.30))
    candle_x, candle_y = w * 0.625, counter_y + h * 0.002
    d.rounded_rectangle([candle_x - w * 0.020, candle_y - h * 0.030,
                         candle_x + w * 0.020, candle_y], radius=w * 0.008,
                        fill=mix(CREAM, SAND, 0.30))
    img = add_glow(img, candle_x, candle_y - h * 0.038, w * 0.075, "#f8d28e", 0.85)
    d = ImageDraw.Draw(img)
    ellipse(d, candle_x, candle_y - h * 0.034, w * 0.007, h * 0.012, "#f8dda4")
    # small plant
    d.rounded_rectangle([w * 0.760, counter_y - h * 0.020, w * 0.820, counter_y + h * 0.008],
                        radius=w * 0.008, fill=mix(TERRACOTTA, NIGHT, 0.20))
    for k in range(4):
        a = math.radians(-150 + k * 40)
        d.line([(w * 0.790, counter_y - h * 0.016),
                (w * 0.790 + math.cos(a) * w * 0.035,
                 counter_y - h * 0.016 + math.sin(a) * h * 0.045)],
               fill=mix(SAGE_DARK, SAGE, 0.25), width=max(2, int(w * 0.005)))
    # stools + foreground darkness
    for sx in (w * 0.290, w * 0.700):
        d.ellipse([sx - w * 0.070, h * 0.902, sx + w * 0.070, h * 0.936],
                  fill=mix(WOOD_DARK, NIGHT, 0.35))
        d.rectangle([sx - w * 0.010, h * 0.912, sx + w * 0.010, h * 0.985],
                    fill=mix(NIGHT, TEAL_MID, 0.15))
        d.rectangle([sx - w * 0.055, h * 0.982, sx + w * 0.055, h * 0.994],
                    fill=mix(WOOD_DARK, NIGHT, 0.30))
    img = dof_bottom(img, 0.935, radius=h * 0.005)
    img = add_glow(img, w * 0.5, h * 0.35, w * 0.55, "#e8a866", 0.16)
    return img


def draw_chiangmai_table(w, h):
    """Northern Thai table: gingham cloth, curries, mango sticky rice."""
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#8c6b52"), (0.10, "#a8875f"), (0.16, "#c4a06e"),
                     (1.0, "#b6745e")])
    # wall / warm top strip
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, h * 0.155], fill=mix(WOOD_DARK, NIGHT, 0.25))
    d.rectangle([0, h * 0.140, w, h * 0.165], fill=mix(WOOD, GOLD, 0.25))
    img = fill_grad(img, h * 0.165, h,
                    [(0.0, "#bd6b57"), (0.55, "#b25d4d"), (1.0, "#a04e42")])
    d = ImageDraw.Draw(img)
    cell = w * 0.115
    check_cloth(d, 0, h * 0.165, w, h * 0.985, "#b95f52", CREAM, cell,
                alpha=0.42)
    # table edge at the bottom
    d.rectangle([0, h * 0.955, w, h], fill=mix(WOOD, NIGHT, 0.30))
    d.line([(0, h * 0.955), (w, h * 0.955)], fill=mix(GOLD_LIGHT, WOOD, 0.35),
           width=max(2, int(h * 0.004)))
    # soft top light
    img = add_glow(img, w * 0.30, h * 0.28, w * 0.55, "#f5d6a4", 0.22)
    d = ImageDraw.Draw(img)
    # place settings
    rng = random.Random(211)
    # khao soi bowl upper-left
    bx, by = w * 0.320, h * 0.420
    ellipse(d, bx + w * 0.012, by + h * 0.020, w * 0.185, h * 0.115,
            mix(TERRACOTTA_DEEP, NIGHT, 0.15))
    bowl(d, bx, by, w * 0.165, h * 0.078, mix("#d98a4a", GOLD, 0.20))
    ellipse(d, bx, by, w * 0.140, h * 0.062, "#dd9450")
    for k in range(3):
        d.arc([bx - w * 0.11, by - h * 0.050, bx + w * 0.11, by + h * 0.050],
              start=200 + k * 6, end=340 - k * 6, fill=CREAM_LIGHT,
              width=max(2, int(h * 0.005)))
    rng2 = random.Random(212)
    for _ in range(8):
        lx = bx + rng2.uniform(-0.09, 0.09) * w
        ly = by + rng2.uniform(-0.035, 0.035) * h
        ellipse(d, lx, ly, w * 0.014, h * 0.006, mix(SAGE, CREAM, 0.25))
    ellipse(d, bx + w * 0.03, by - h * 0.020, w * 0.030, h * 0.014,
            mix(CREAM_LIGHT, "#e8a35c", 0.25))
    # rice plate upper right
    rx, ry = w * 0.740, h * 0.390
    plate(d, rx, ry, w * 0.155, h * 0.092, rim=mix(TERRACOTTA, CREAM, 0.25))
    ellipse(d, rx, ry, w * 0.090, h * 0.052, CREAM_LIGHT)
    for _ in range(18):
        ellipse(d, rx + rng.uniform(-0.07, 0.07) * w,
                ry + rng.uniform(-0.035, 0.035) * h, w * 0.010, h * 0.005,
                mix(CREAM_LIGHT, SAGE, 0.12))
    # greens plate middle-left
    gx, gy = w * 0.250, h * 0.610
    plate(d, gx, gy, w * 0.140, h * 0.078, rim=mix(TERRACOTTA, CREAM, 0.20))
    for _ in range(9):
        lx = gx + rng.uniform(-0.08, 0.08) * w
        ly = gy + rng.uniform(-0.030, 0.030) * h
        ellipse(d, lx, ly, w * 0.025, h * 0.014,
                rng.choice([mix(SAGE_DARK, SAGE, 0.4), mix(SAGE, CREAM, 0.2),
                            mix(SAGE_DEEP, SAGE, 0.3)]))
    # mango sticky rice lower right
    mx, my = w * 0.690, h * 0.680
    plate(d, mx, my, w * 0.195, h * 0.105, rim=mix(TERRACOTTA, CREAM, 0.22))
    ellipse(d, mx - w * 0.030, my + h * 0.010, w * 0.075, h * 0.045,
            mix(CREAM_LIGHT, SAND, 0.22))
    for k in range(3):
        ox = mx + w * (0.030 + 0.036 * k)
        oy = my - h * (0.020 - 0.014 * (k % 2))
        ellipse(d, ox, oy, w * 0.042, h * 0.020,
                mix(GOLD, "#f0b84e", 0.25))
        ellipse(d, ox, oy, w * 0.030, h * 0.014,
                mix("#f4c96a", CREAM_LIGHT, 0.25))
    d.line([(mx - w * 0.055, my - h * 0.012), (mx - w * 0.005, my - h * 0.030)],
           fill=mix(CREAM_LIGHT, GOLD, 0.30), width=max(2, int(h * 0.006)))
    # glasses of iced tea
    glass(d, w * 0.480, h * 0.340, w * 0.062, h * 0.090,
          liquid=mix(GOLD, TERRACOTTA, 0.30))
    glass(d, w * 0.560, h * 0.330, w * 0.060, h * 0.085, liquid="#d9a05a")
    ellipse(d, w * 0.480, h * 0.340, w * 0.026, h * 0.010,
            mix(CREAM_LIGHT, SKY_BLUE, 0.25))
    ellipse(d, w * 0.560, h * 0.330, w * 0.024, h * 0.009,
            mix(CREAM_LIGHT, SKY_BLUE, 0.25))
    # cutlery at each side
    spoon(d, w * 0.060, h * 0.530, math.radians(6), h * 0.13, mix(STONE, CREAM, 0.20))
    spoon(d, w * 0.945, h * 0.520, math.radians(-6), h * 0.13,
          mix(STONE, CREAM, 0.20))
    # little flowers in a jar, top left
    jx, jy = w * 0.860, h * 0.205
    d.rounded_rectangle([jx - w * 0.035, jy - h * 0.020, jx + w * 0.035, jy + h * 0.075],
                        radius=w * 0.012, fill=mix(SKY_BLUE, CREAM, 0.45))
    for k in range(3):
        a = math.radians(-120 + k * 40)
        tx = jx + math.cos(a) * w * 0.060
        ty = jy - h * 0.010 + math.sin(a) * h * 0.070
        d.line([(jx, jy + h * 0.060), (tx, ty)], fill=SAGE,
               width=max(2, int(w * 0.004)))
        blossom(d, tx, ty, w * 0.018, mix(DUSK_PALE, CREAM_LIGHT, 0.20),
                mix(GOLD, TERRACOTTA, 0.30))
    # lime/plum plate balancing the lower right corner
    fx, fy = w * 0.760, h * 0.795
    plate(d, fx, fy, w * 0.130, h * 0.072, rim=mix(TERRACOTTA, CREAM, 0.28))
    ellipse(d, fx, fy, w * 0.100, h * 0.052, CREAM_LIGHT)
    for k in range(4):
        ox = fx + w * (0.012 + 0.030 * (k % 2))
        oy = fy + h * (0.014 * (k // 2) - 0.010)
        ellipse(d, ox, oy, w * 0.024, h * 0.013, mix(SAGE, GOLD, 0.40))
        ellipse(d, ox, oy, w * 0.016, h * 0.009, mix("#b9c46a", CREAM_LIGHT, 0.25))
    img = dappled_light(img, 0, h * 0.18, w, h * 0.95, seed=213, n=16,
                        size=(0.02, 0.06), opacity=0.10, blur=w * 0.016)
    img = dof_bottom(img, 0.94, radius=h * 0.004)
    return img


# --------------------------------------------------------------------------
# HONGCUN -- white walls, dark tiles, moon pond and blossom courtyards
# --------------------------------------------------------------------------
def draw_hongcun_moonpond(w, h):
    """Moon pond: white-walled houses, dark roofs and their still reflection."""
    rng = random.Random(431)
    horizon = h * 0.455
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, horizon,
                    [(0.0, "#b6c7c4"), (0.32, "#d0d5c6"), (0.62, "#e6dcc7"),
                     (0.85, "#f2e8d2"), (1.0, "#f6eeda")])
    img = add_glow(img, w * 0.26, h * 0.16, w * 0.45, "#f3e4c2", 0.26)
    d = ImageDraw.Draw(img)
    # tree canopies behind the roofline
    for k in range(6):
        cx = w * (0.02 + 0.19 * k)
        cy = horizon - h * rng.uniform(0.13, 0.19)
        r = w * rng.uniform(0.025, 0.055)
        foliage(d, cx, cy, r, r * 0.75,
                ["#7d9870", "#6f8a63", "#8fa77f"], seed=540 + k, n=6)
    row = ((0.000, 0.130, 0.150), (0.120, 0.100, 0.130), (0.210, 0.150, 0.185),
           (0.350, 0.110, 0.140), (0.450, 0.130, 0.170), (0.570, 0.100, 0.135),
           (0.660, 0.160, 0.200), (0.810, 0.120, 0.150), (0.920, 0.110, 0.175))
    for x0, ww, hh in row:
        huizhou_house(d, w * x0, horizon + 1, w * ww, h * hh,
                      wall=mix(WHITE_WALL, CREAM, 0.16),
                      tile=mix(TILE, SKY_BLUE, 0.22))
    huizhou_house(d, -w * 0.045, horizon + h * 0.012, w * 0.205, h * 0.255,
                  wall=WHITE_WALL, tile=TILE)
    huizhou_house(d, w * 0.950, horizon + h * 0.008, w * 0.145, h * 0.230,
                  wall=WHITE_WALL, tile=TILE)
    # a couple of warm lit windows
    for wx, wy in ((w * 0.248, horizon - h * 0.098), (w * 0.548, horizon - h * 0.078)):
        img = add_glow(img, wx, wy, w * 0.026, "#f2c887", 0.55)
        d = ImageDraw.Draw(img)
        d.rectangle([wx - w * 0.010, wy - h * 0.020, wx + w * 0.010, wy + h * 0.020],
                    fill="#f4d39a")
    # moon bridge
    bx = w * 0.848
    span = w * 0.100
    base = horizon + h * 0.018
    deck = [(bx - span, base), (bx - span * 0.58, base - h * 0.052),
            (bx, base - h * 0.064), (bx + span * 0.58, base - h * 0.052),
            (bx + span, base)]
    poly(d, deck + [(x, y + h * 0.020) for x, y in reversed(deck)],
         mix(STONE_DARK, TILE, 0.30))
    d.pieslice([bx - span * 0.66, base - h * 0.054, bx + span * 0.66, base + h * 0.070],
               start=180, end=360, fill=mix("#8ba09a", "#5f7a76", 0.45))
    d.line(P([(x, y - h * 0.003) for x, y in deck]),
           fill=mix(TILE, NIGHT, 0.20), width=max(2, int(h * 0.007)))
    for t in (-0.75, -0.30, 0.30, 0.75):
        px = bx + span * t
        py = base - h * 0.052 * (1.0 - abs(t)) - h * 0.006
        d.line([(px, py), (px, py + h * 0.048)],
               fill=mix(STONE, NIGHT, 0.30), width=max(2, int(w * 0.004)))
    # far bank edge
    d.rectangle([0, horizon, w, horizon + h * 0.010], fill=mix(STONE, NIGHT, 0.28))
    d.rectangle([0, horizon + h * 0.010, w, horizon + h * 0.018],
                fill=mix(STONE_DARK, NIGHT, 0.22))
    img = fill_grad(img, horizon + h * 0.018, h,
                    [(0.0, "#c3cbbd"), (0.18, "#aebab2"), (0.55, "#96aaa3"),
                     (1.0, "#7b9590")])
    img = mirror_water(img, horizon + h * 0.018, opacity=0.50, wobble=2.0,
                       tint="#b7c4bb", squash=0.94, seed=541)
    d = ImageDraw.Draw(img)
    # ripples that cut across the reflection
    for k in range(26):
        yy = horizon + h * (0.032 + 0.036 * k)
        d.line([(0, yy), (w, yy + h * 0.0018)], fill=mix("#9fb3ac", CREAM, 0.30),
               width=max(1, int(h * 0.0014)))
    # willow on the left
    tx, ty = w * 0.055, h * 1.02
    tree_trunk(d, tx, ty, h * 0.68, w * 0.018, mix(BRICK_DARK, NIGHT, 0.22),
               lean=0.10, seed=542, branches=3)
    ww_rng = random.Random(543)
    for k in range(9):
        sx = tx + w * ww_rng.uniform(-0.055, 0.11)
        sy = h * ww_rng.uniform(0.24, 0.40)
        pts = [(sx, sy)]
        for j in range(1, 8):
            pts.append((sx + math.sin(j * 0.8 + k) * w * (0.003 + 0.005 * j),
                        sy + h * 0.028 * j))
        d.line(P(pts), fill=mix(SAGE_DARK, NIGHT, 0.30), width=max(1, int(w * 0.0022)))
        for j in range(2, 8):
            ellipse(d, pts[j][0], pts[j][1], w * 0.0045, w * 0.0075,
                    mix(SAGE, SAGE_DARK, 0.30))
    for k in range(4):
        foliage(d, w * (0.02 + 0.035 * k), h * (0.29 + 0.03 * k),
                w * 0.05, h * 0.025, ["#6f8a63", "#5d7a58", "#7d9870"],
                seed=544 + k, n=6)
    # foreground stone bank lower left
    d = ImageDraw.Draw(img)
    poly(d, [(0, h * 1.02), (0, h * 0.850), (w * 0.155, h * 0.900),
             (w * 0.290, h * 1.02)], mix(STONE, CREAM, 0.18))
    for k in range(3):
        y0 = h * (0.868 + 0.045 * k)
        d.line([(0, y0), (w * (0.10 + 0.045 * k), y0 + h * 0.028)],
               fill=mix(STONE_DARK, NIGHT, 0.25), width=max(1, int(h * 0.003)))
    grass_tufts(d, 0, w * 0.30, h * 1.005, h * 0.045, SAGE_DARK, seed=545, n=22,
                width=w * 0.0035)
    img = shimmer(img, horizon + h * 0.035, h * 0.94, "#eae4cf", 35, 546,
                  n=40, center=w * 0.50, spread=0.45, dash=(0.006, 0.035),
                  blur=1.2)
    img = dof_bottom(img, 0.945, radius=h * 0.004)
    return img
def draw_hongcun_window(w, h):
    """White wall, stepped horse-head gables, a lattice window and koi below."""
    rng = random.Random(571)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h * 0.24,
                    [(0.0, "#b6c7c4"), (0.40, "#d6d7c5"), (0.78, "#e8dfc8"),
                     (1.0, "#f2ead6")])
    img = add_glow(img, w * 0.72, h * 0.05, w * 0.40, "#f2e5c2", 0.22)
    d = ImageDraw.Draw(img)
    # wall with a clean tiled top and stepped gables at both ends
    wall_top = h * 0.150
    wall_bot = h * 0.800
    d.rectangle([-4, wall_top, w + 4, wall_bot], fill=WHITE_WALL)
    d.rectangle([-4, wall_top - h * 0.034, w + 4, wall_top], fill=TILE)
    d.rectangle([-4, wall_top - h * 0.034, w + 4, wall_top - h * 0.026],
                fill=darken(TILE, 0.20))
    for side in (0, 1):
        gx = -4 if side == 0 else w + 4
        dirn = 1 if side == 0 else -1
        step_w = w * 0.052
        step_h = h * 0.062
        for k in range(2):
            outer = gx + dirn * step_w * (k + 1)
            top = wall_top - h * 0.034 - step_h * (k + 1)
            d.rectangle([min(gx, outer), top, max(gx, outer), wall_top - h * 0.034],
                        fill=WHITE_WALL)
            d.rectangle([min(gx, outer), top - h * 0.020, max(gx, outer), top],
                        fill=TILE)
    # plaster stains + short cracks
    for _ in range(24):
        cx = rng.uniform(0, w)
        cy = rng.uniform(wall_top + h * 0.02, wall_bot - h * 0.02)
        ellipse(d, cx, cy, w * rng.uniform(0.012, 0.065),
                h * rng.uniform(0.005, 0.024),
                mix(WHITE_WALL, STONE_DARK, rng.uniform(0.03, 0.11)))
    for _ in range(4):
        x = rng.uniform(w * 0.05, w * 0.95)
        y = rng.uniform(wall_top + h * 0.03, h * 0.30)
        pts = [(x, y)]
        for j in range(1, 4):
            pts.append((pts[-1][0] + rng.uniform(-0.006, 0.006) * w,
                        pts[-1][1] + rng.uniform(0.020, 0.045) * h))
        d.line(P(pts), fill=mix(STONE_DARK, NIGHT, 0.08), width=max(1, int(w * 0.0016)))
    # window
    wx, wy = w * 0.500, h * 0.390
    ww, wh = w * 0.300, h * 0.270
    img = add_glow(img, wx, wy, w * 0.30, "#f3d9a4", 0.36)
    d = ImageDraw.Draw(img)
    # eave above the window
    poly(d, [(wx - ww * 0.74, wy - wh * 0.66), (wx + ww * 0.74, wy - wh * 0.66),
             (wx + ww * 0.82, wy - wh * 0.55), (wx - ww * 0.82, wy - wh * 0.55)],
         TILE)
    d.rectangle([wx - ww * 0.82, wy - wh * 0.55, wx + ww * 0.82, wy - wh * 0.50],
                fill=mix(TILE, WHITE_WALL, 0.30))
    # stone lintel + frame
    d.rectangle([wx - ww * 0.66, wy - wh * 0.52, wx + ww * 0.66, wy + wh * 0.55],
                fill=mix(WHITE_WALL, STONE, 0.25))
    d.rectangle([wx - ww * 0.56, wy - wh * 0.48, wx + ww * 0.56, wy + wh * 0.50],
                fill=mix(WOOD_DARK, NIGHT, 0.18))
    d.rectangle([wx - ww * 0.46, wy - wh * 0.40, wx + ww * 0.46, wy + wh * 0.42],
                fill=mix("#efd9a9", GOLD_LIGHT, 0.22))
    for i in range(1, 3):
        x = wx - ww * 0.46 + ww * 0.92 * i / 3.0
        d.rectangle([x - ww * 0.016, wy - wh * 0.40,
                     x + ww * 0.016, wy + wh * 0.42],
                    fill=mix(WOOD_DARK, NIGHT, 0.18))
    for j in range(1, 4):
        y = wy - wh * 0.40 + wh * 0.82 * j / 4.0
        d.rectangle([wx - ww * 0.46, y - wh * 0.014,
                     wx + ww * 0.46, y + wh * 0.014],
                    fill=mix(WOOD_DARK, NIGHT, 0.18))
    # little carved corner squares
    for sx in (-1, 1):
        for sy in (-1, 1):
            d.rectangle([wx + sx * ww * 0.50 - ww * 0.025,
                         wy + sy * wh * 0.45 - wh * 0.030,
                         wx + sx * ww * 0.50 + ww * 0.025,
                         wy + sy * wh * 0.45 + wh * 0.030],
                        fill=mix(WOOD_DARK, NIGHT, 0.22))
    # stone sill
    d.rectangle([wx - ww * 0.70, wy + wh * 0.55, wx + ww * 0.70,
                 wy + wh * 0.55 + h * 0.032], fill=mix(STONE, CREAM, 0.28))
    d.rectangle([wx - ww * 0.70, wy + wh * 0.55 + h * 0.032,
                 wx + ww * 0.70, wy + wh * 0.55 + h * 0.040],
                fill=mix(STONE_DARK, NIGHT, 0.18))
    # stone plinth, water jar and a potted plant along the wall base
    d.rectangle([-4, wall_bot - h * 0.075, w + 4, wall_bot - h * 0.030],
                fill=mix(WHITE_WALL, STONE, 0.22))
    d.rectangle([-4, wall_bot - h * 0.030, w + 4, wall_bot],
                fill=mix(STONE, NIGHT, 0.18))
    jar_x, jar_y = w * 0.220, wall_bot - h * 0.075
    d.rounded_rectangle([jar_x - w * 0.055, jar_y - h * 0.060,
                         jar_x + w * 0.055, jar_y],
                        radius=w * 0.020, fill=mix(STONE_DARK, BRICK_DARK, 0.25))
    ellipse(d, jar_x, jar_y - h * 0.060, w * 0.055, h * 0.014,
            fill=mix(STONE_DARK, BRICK_DARK, 0.15))
    ellipse(d, jar_x, jar_y - h * 0.060, w * 0.044, h * 0.010,
            fill=("#9fb2ab"))
    for k in range(3):
        banana_leaf(d, jar_x + w * 0.010 * k, jar_y - h * 0.055,
                    h * 0.070, math.radians(-70 + k * 22),
                    mix(SAGE_DARK, SAGE, 0.30))
    pot_x = w * 0.800
    d.rounded_rectangle([pot_x - w * 0.040, wall_bot - h * 0.115,
                         pot_x + w * 0.040, wall_bot - h * 0.075],
                        radius=w * 0.012, fill=mix(TERRACOTTA, SAND, 0.30))
    for k in range(4):
        a = math.radians(-150 + k * 32)
        d.line([(pot_x, wall_bot - h * 0.108),
                (pot_x + math.cos(a) * w * 0.042,
                 wall_bot - h * 0.108 + math.sin(a) * h * 0.052)],
               fill=mix(SAGE_DARK, SAGE, 0.25), width=max(2, int(w * 0.0035)))
    # vines creeping up from the plinth
    vine_rng = random.Random(573)
    for _ in range(4):
        vx = vine_rng.uniform(0.05, 0.95) * w
        vy = wall_bot - h * 0.045
        pts = [(vx, vy)]
        for j in range(1, 6):
            pts.append((vx + math.sin(j * 1.2 + vx) * w * 0.012, vy - h * 0.016 * j))
        d.line(P(pts), fill=mix(SAGE_DARK, SAGE, 0.30), width=max(1, int(w * 0.0022)))
        for j in range(1, 5):
            ellipse(d, pts[j][0], pts[j][1], w * 0.006, w * 0.005,
                    mix(SAGE, SAGE_DARK, 0.30))
    # pond below the window
    img = fill_grad(img, wall_bot, h,
                    [(0.0, "#b3c4b8"), (0.30, "#9db3aa"), (0.72, "#86a09a"),
                     (1.0, "#748f8a")])
    d = ImageDraw.Draw(img)
    d.rectangle([-4, wall_bot - h * 0.016, w + 4, wall_bot + h * 0.014],
                fill=mix(STONE, NIGHT, 0.26))
    d.line([(-4, wall_bot + h * 0.014), (w + 4, wall_bot + h * 0.014)],
           fill=mix(STONE_DARK, NIGHT, 0.18), width=max(2, int(h * 0.004)))
    for k in range(7):
        yy = h * (0.838 + 0.023 * k)
        d.line([(0, yy), (w, yy + h * 0.001)], fill=mix("#9fb3ac", CREAM, 0.32),
               width=max(1, int(h * 0.0014)))
    # lily pads
    for lx, ly in ((w * 0.145, h * 0.885), (w * 0.845, h * 0.905),
                   (w * 0.775, h * 0.960)):
        ellipse(d, lx, ly, w * 0.085, h * 0.028, mix(SAGE_DARK, SAGE, 0.28))
        poly(d, [(lx, ly), (lx + w * 0.038, ly - h * 0.026),
                 (lx + w * 0.016, ly + h * 0.002)],
             mix("#8aa49d", "#9fb3ac", 0.55))
    # koi
    fish(d, w * 0.315, h * 0.910, w * 0.062, mix(TERRACOTTA, GOLD, 0.35),
         angle=math.radians(-8))
    fish(d, w * 0.560, h * 0.950, w * 0.055, mix(CREAM_LIGHT, GOLD, 0.30),
         angle=math.radians(10))
    fish(d, w * 0.660, h * 0.885, w * 0.040, mix(DUSK_PINK, TERRACOTTA, 0.30),
         angle=math.radians(-20))
    for fx, fy, fr in ((w * 0.315, h * 0.940, 0.085), (w * 0.560, h * 0.985, 0.075),
                       (w * 0.660, h * 0.915, 0.055)):
        d.arc([fx - w * fr, fy - h * 0.022, fx + w * fr, fy + h * 0.022],
              start=200, end=340, fill=mix(CREAM_LIGHT, SKY_BLUE, 0.22),
              width=max(1, int(h * 0.0022)))
    # a flowering branch from the top right
    d.line(P([(w * 1.02, h * 0.010), (w * 0.900, h * 0.030),
              (w * 0.800, h * 0.020), (w * 0.730, h * 0.045)]),
           fill=mix(WOOD_DARK, NIGHT, 0.25), width=max(2, int(w * 0.006)))
    for k in range(6):
        lx = w * (0.760 + 0.043 * k)
        ly = h * (0.022 + 0.014 * math.sin(k * 2.1))
        banana_leaf(d, lx, ly, h * 0.040, math.radians(30 + k * 20),
                    mix(SAGE_DARK, SAGE, 0.30))
    for k in range(4):
        blossom(d, w * (0.79 + 0.05 * k), h * (0.035 + 0.012 * k),
                w * 0.010, mix(DUSK_PALE, CREAM_LIGHT, 0.25),
                mix(GOLD, TERRACOTTA, 0.30))
    img = dappled_light(img, 0, wall_top, w, wall_bot, seed=572, n=16,
                        size=(0.010, 0.028), opacity=0.10, blur=w * 0.014)
    img = dof_bottom(img, 0.955, radius=h * 0.0035)
    return img
def draw_hongcun_lakeside(w, h):
    """Waterside stone walk: tree shade on a white wall, slow green water."""
    rng = random.Random(451)
    horizon = h * 0.315
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#b6c7c4"), (0.35, "#d3d7c5"), (0.62, "#e8e0ca"),
                     (0.85, "#efe6d2"), (1.0, "#d9d2bd")])
    img = add_glow(img, w * 0.18, h * 0.08, w * 0.40, "#f2e5c2", 0.20)
    d = ImageDraw.Draw(img)
    # far shore: small white houses and tree clumps on the left
    for x0, ww, hh in ((0.010, 0.105, 0.090), (0.135, 0.085, 0.072),
                       (0.245, 0.110, 0.095), (0.380, 0.080, 0.066),
                       (0.470, 0.090, 0.080)):
        huizhou_house(d, w * x0, horizon + 1, w * ww, h * hh,
                      wall=mix(WHITE_WALL, SKY_BLUE, 0.18),
                      tile=mix(TILE, SKY_BLUE, 0.30), window=False)
    for k in range(8):
        cx = w * (0.02 + 0.072 * k)
        cy = horizon - h * rng.uniform(0.012, 0.034)
        r = w * rng.uniform(0.020, 0.042)
        foliage(d, cx, cy, r * 1.5, r * 0.8,
                ["#6f8a63", "#5d7a58", "#7d9870"], seed=550 + k, n=7)
    # water
    img = fill_grad(img, horizon, h,
                    [(0.0, "#c2cec2"), (0.30, "#b0c3ba"), (0.70, "#9cb3ac"),
                     (1.0, "#8aa5a0")])
    img = mirror_water(img, horizon + h * 0.004, opacity=0.42, wobble=2.0,
                       tint="#b6c6bd", squash=0.94, seed=551)
    img = mist(img, horizon + h * 0.004, h * 0.008, opacity=0.35, seed=552)
    d = ImageDraw.Draw(img)
    d.line([(0, horizon), (w, horizon)], fill=mix(STONE, NIGHT, 0.26),
           width=max(1, int(h * 0.0024)))
    for k in range(16):
        yy = horizon + h * (0.030 + 0.028 * k)
        d.line([(0, yy), (w, yy + h * 0.0016)],
               fill=mix("#9fb3ac", CREAM, 0.32), width=max(1, int(h * 0.0013)))
    # stone landing steps down to the water
    for k in range(3):
        sx0 = w * (0.255 + 0.030 * k)
        sy0 = h * (0.520 + 0.030 * k)
        d.rectangle([sx0 - w * 0.075, sy0, sx0 + w * 0.075, sy0 + h * 0.028],
                    fill=mix(STONE, CREAM, 0.28 - k * 0.05))
        d.line([(sx0 - w * 0.075, sy0), (sx0 + w * 0.075, sy0)],
               fill=mix(STONE_DARK, NIGHT, 0.18), width=max(1, int(h * 0.003)))
    # white wall on the right
    wall_x0, wall_x1 = w * 0.545, w * 1.02
    wall_y0, wall_y1 = h * 0.095, h * 0.590
    d.rectangle([wall_x0, wall_y0, wall_x1, wall_y1], fill=WHITE_WALL)
    for _ in range(14):
        cx = rng.uniform(wall_x0, wall_x1)
        cy = rng.uniform(wall_y0 + h * 0.03, wall_y1)
        ellipse(d, cx, cy, w * rng.uniform(0.02, 0.07),
                h * rng.uniform(0.008, 0.028),
                mix(WHITE_WALL, STONE_DARK, rng.uniform(0.04, 0.11)))
    d.rectangle([wall_x0 - w * 0.012, wall_y0 - h * 0.045, wall_x1, wall_y0],
                fill=TILE)
    d.rectangle([wall_x0 - w * 0.012, wall_y0 - h * 0.045, wall_x1,
                 wall_y0 - h * 0.036], fill=darken(TILE, 0.20))
    for k in range(2):
        gg_w = w * (0.095 - 0.030 * k)
        gg_h = h * (0.052 + 0.032 * k)
        d.rectangle([wall_x1 - gg_w, wall_y0 - h * 0.045 - gg_h, wall_x1,
                     wall_y0 - h * 0.045], fill=WHITE_WALL)
        d.rectangle([wall_x1 - gg_w, wall_y0 - h * 0.045 - gg_h, wall_x1,
                     wall_y0 - h * 0.045 - gg_h + h * 0.016], fill=TILE)
    # wooden door + small window in the wall
    d.rectangle([w * 0.660, wall_y1 - h * 0.140, w * 0.735, wall_y1],
                fill=mix(WOOD_DARK, NIGHT, 0.20))
    d.line([(w * 0.698, wall_y1 - h * 0.140), (w * 0.698, wall_y1)],
           fill=mix(WOOD, NIGHT, 0.30), width=max(1, int(w * 0.0035)))
    d.rectangle([w * 0.815, wall_y1 - h * 0.185, w * 0.875, wall_y1 - h * 0.105],
                fill=mix(TILE, NIGHT, 0.15))
    # stone bank + grass strip between water and path
    poly(d, [(-4, h * 0.590), (w + 4, h * 0.590), (w + 4, h * 0.640),
             (-4, h * 0.640)], mix(STONE, NIGHT, 0.16))
    poly(d, [(-4, h * 0.640), (w + 4, h * 0.640), (w + 4, h * 0.690),
             (-4, h * 0.690)], mix(SAGE_DARK, SAGE, 0.30))
    # stone walk with slab joints
    img = fill_grad(img, h * 0.690, h,
                    [(0.0, "#c9c0a8"), (0.55, "#bcb29a"), (1.0, "#a99f88")])
    d = ImageDraw.Draw(img)
    paving(d, 0, h * 0.690, w, h * 1.02, mix(STONE, SAND, 0.30),
           mix(STONE_DARK, NIGHT, 0.12), seed=553, rows=5, cols=5)
    rng2 = random.Random(560)
    for _ in range(18):
        ellipse(d, rng2.uniform(0, w), rng2.uniform(h * 0.70, h),
                w * rng2.uniform(0.0015, 0.004), h * rng2.uniform(0.0015, 0.004),
                mix(STONE_DARK, CREAM, 0.30))
    # tree in front of the wall, standing on the bank
    tx, ty = w * 0.680, h * 0.985
    img = ground_shadow(img, tx, ty, w * 0.15, h * 0.018, opacity=0.26,
                        blur=w * 0.016)
    d = ImageDraw.Draw(img)
    tree_trunk(d, tx, ty, h * 0.80, w * 0.046, mix(BRICK_DARK, NIGHT, 0.16),
               lean=-0.05, seed=554, branches=4)
    rng3 = random.Random(555)
    for k in range(8):
        cx = tx + w * rng3.uniform(-0.30, 0.22)
        cy = h * rng3.uniform(0.020, 0.230)
        r = w * rng3.uniform(0.080, 0.150)
        foliage(d, cx, cy, r, r * 0.62,
                ["#4c6a51", "#5d7a58", "#6f8a63", "#3d5a45"], seed=555 + k, n=9)
    # dappled shade on wall and walk
    shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    rng4 = random.Random(556)
    for _ in range(26):
        cx = rng4.uniform(wall_x0, wall_x1)
        cy = rng4.uniform(wall_y0 + h * 0.03, wall_y1)
        r = w * rng4.uniform(0.010, 0.034)
        ellipse(sd, cx, cy, r, r * 0.60, rgba(mix(SAGE_DEEP, NIGHT, 0.35), 55))
    for _ in range(16):
        cx = rng4.uniform(0, w)
        cy = rng4.uniform(h * 0.70, h)
        r = w * rng4.uniform(0.012, 0.040)
        ellipse(sd, cx, cy, r, r * 0.35, rgba(mix(SAGE_DEEP, NIGHT, 0.35), 45))
    img = comp(img, shadow_layer.filter(ImageFilter.GaussianBlur(w * 0.010)))
    # reeds at the water's edge
    d = ImageDraw.Draw(img)
    reeds(d, -w * 0.02, w * 0.20, h * 0.600, h * 0.115,
          mix(SAGE_DEEP, NIGHT, 0.30), mix(TERRACOTTA_DEEP, NIGHT, 0.40),
          seed=557, n=16)
    reeds(d, w * 0.20, w * 0.44, h * 0.600, h * 0.080,
          mix(SAGE_DEEP, NIGHT, 0.35), mix(SAGE_DARK, NIGHT, 0.30),
          seed=558, n=9)
    # foreground leaves
    for ang, ln, bx in ((-60, 0.16, -0.03), (-105, 0.14, 0.05),
                        (-78, 0.17, 1.02), (-120, 0.14, 0.95)):
        banana_leaf(d, bx * w, h * 1.02, h * ln, math.radians(ang),
                    mix(SAGE_DEEP, NIGHT, 0.20))
    img = dappled_light(img, w * 0.55, h * 0.12, w, h * 0.60, seed=559, n=16,
                        size=(0.010, 0.028), opacity=0.14, blur=w * 0.012)
    img = dof_bottom(img, 0.94, radius=h * 0.0045)
    return img
def draw_hongcun_courtyard(w, h):
    """Blossom tree over a stone table in a small white-walled courtyard."""
    rng = random.Random(581)
    img = Image.new("RGB", (w, h))
    img = fill_grad(img, 0, h,
                    [(0.0, "#b6c7c4"), (0.06, "#d3d6c6"), (0.14, "#e9e0ca"),
                     (0.34, "#efe6d2"), (0.60, "#e4dbc6"), (1.0, "#cfc6ae")])
    d = ImageDraw.Draw(img)
    # back wall with tile coping and stepped gables at both ends
    wall_top = h * 0.135
    wall_bot = h * 0.620
    d.rectangle([0, wall_top, w, wall_bot], fill=WHITE_WALL)
    d.rectangle([0, wall_top - h * 0.040, w, wall_top], fill=TILE)
    d.rectangle([0, wall_top - h * 0.040, w, wall_top - h * 0.032],
                fill=darken(TILE, 0.20))
    for side in (0, 1):
        gx = 0 if side == 0 else w
        dirn = -1 if side == 1 else 1
        for k in range(2):
            sww = w * (0.070 - 0.020 * k)
            shh = h * (0.050 + 0.040 * k)
            x0 = gx
            x1 = gx + dirn * sww
            d.rectangle([min(x0, x1), wall_top - h * 0.040 - shh, max(x0, x1),
                         wall_top - h * 0.040], fill=WHITE_WALL)
            d.rectangle([min(x0, x1), wall_top - h * 0.040 - shh, max(x0, x1),
                         wall_top - h * 0.040 - shh + h * 0.022], fill=TILE)
    for _ in range(18):
        cx = rng.uniform(0, w)
        cy = rng.uniform(wall_top + h * 0.02, wall_bot - h * 0.01)
        ellipse(d, cx, cy, w * rng.uniform(0.02, 0.08),
                h * rng.uniform(0.008, 0.030),
                mix(WHITE_WALL, STONE_DARK, rng.uniform(0.03, 0.10)))
    # stone floor
    paving(d, 0, wall_bot, w, h * 1.02, mix(STONE, SAND, 0.34),
           mix(STONE_DARK, NIGHT, 0.12), seed=582, rows=6, cols=8)
    d = ImageDraw.Draw(img)
    # moss between slabs
    for _ in range(28):
        cx = rng.uniform(0, w)
        cy = rng.uniform(wall_bot + h * 0.01, h)
        ellipse(d, cx, cy, w * rng.uniform(0.010, 0.035),
                h * rng.uniform(0.003, 0.012),
                mix(SAGE, STONE, rng.uniform(0.40, 0.70)))
    # blossom tree
    tx, ty = w * 0.305, h * 0.965
    img = ground_shadow(img, tx, ty, w * 0.17, h * 0.020, opacity=0.28,
                        blur=w * 0.018)
    d = ImageDraw.Draw(img)
    tree_trunk(d, tx, ty, h * 0.72, w * 0.036, mix(BRICK_DARK, WOOD, 0.22),
               lean=0.06, seed=583, branches=5)
    rng2 = random.Random(584)
    for k in range(10):
        cx = tx + w * rng2.uniform(-0.25, 0.22)
        cy = h * rng2.uniform(0.045, 0.290)
        r = w * rng2.uniform(0.065, 0.130)
        foliage(d, cx, cy, r, r * 0.62,
                ["#5d7a58", "#6f8a63", "#4c6a51", "#7d9870"],
                seed=584 + k, n=8)
    # many small blossoms
    blossoms(d, tx - w * 0.005, h * 0.165, w * 0.315, h * 0.125,
             [mix(DUSK_PALE, CREAM_LIGHT, 0.20), mix("#e6bfbf", CREAM_LIGHT, 0.28),
              mix(DUSK_PINK, CREAM_LIGHT, 0.30), CREAM_LIGHT],
             [mix(GOLD, TERRACOTTA, 0.40), mix(GOLD, CREAM, 0.25)],
             seed=585, n=230, size=(0.10, 0.24))
    # falling petals
    rng3 = random.Random(586)
    for _ in range(55):
        px = rng3.uniform(w * 0.01, w * 0.70)
        py = rng3.uniform(h * 0.30, h * 1.00)
        r = w * rng3.uniform(0.0022, 0.0048)
        ellipse(d, px, py, r, r * 0.72,
                mix(DUSK_PALE, CREAM_LIGHT, rng3.uniform(0.0, 0.7)))
    # stone table + stools
    sx, sy = w * 0.775, h * 0.760
    d.rectangle([sx - w * 0.035, sy + h * 0.030, sx + w * 0.035, h * 0.955],
                fill=mix(STONE, NIGHT, 0.24))
    ellipse(d, sx, h * 0.955, w * 0.090, h * 0.018,
            mix(STONE_DARK, NIGHT, 0.28))
    ellipse(d, sx, sy + h * 0.030, w * 0.120, h * 0.026,
            mix(STONE, CREAM, 0.18))
    ellipse(d, sx, sy, w * 0.135, h * 0.062, mix(STONE, CREAM, 0.30))
    ellipse(d, sx, sy - h * 0.006, w * 0.128, h * 0.055,
            mix(STONE, CREAM_LIGHT, 0.42))
    for ox, oy in ((w * 0.645, h * 0.845), (w * 0.905, h * 0.845)):
        d.rectangle([ox - w * 0.020, oy - h * 0.045, ox + w * 0.020, oy + h * 0.010],
                    fill=mix(STONE, CREAM, 0.20))
        ellipse(d, ox, oy - h * 0.045, w * 0.032, h * 0.014,
                fill=mix(STONE, CREAM_LIGHT, 0.35))
        ellipse(d, ox, oy + h * 0.008, w * 0.032, h * 0.012,
                fill=mix(STONE_DARK, NIGHT, 0.22))
    # teapot + cups + petals on the table
    d.rounded_rectangle([sx - w * 0.045, sy - h * 0.075, sx + w * 0.010, sy - h * 0.035],
                        radius=w * 0.014, fill=mix(TERRACOTTA, SAND, 0.20))
    ellipse(d, sx + w * 0.010, sy - h * 0.055, w * 0.010, h * 0.010,
            mix(TERRACOTTA, SAND, 0.20))
    d.line([(sx + w * 0.010, sy - h * 0.062), (sx + w * 0.045, sy - h * 0.070)],
           fill=mix(TERRACOTTA, SAND, 0.20), width=max(2, int(w * 0.007)))
    for cx, cy in ((sx + w * 0.040, sy - h * 0.006), (sx + w * 0.085, sy - h * 0.022)):
        ellipse(d, cx, cy, w * 0.016, h * 0.009,
                mix(CREAM_LIGHT, STONE, 0.18))
    for _ in range(16):
        px = sx + rng3.uniform(-0.12, 0.12) * w
        py = sy + rng3.uniform(-0.045, 0.048) * h
        r = w * rng3.uniform(0.0018, 0.0040)
        ellipse(d, px, py, r, r * 0.72, mix(DUSK_PALE, CREAM_LIGHT, 0.35))
    # planter with flowers by the wall
    px2, py2 = w * 0.900, h * 0.640
    d.rounded_rectangle([px2 - w * 0.040, py2 - h * 0.030, px2 + w * 0.040, py2],
                        radius=w * 0.010, fill=mix(TERRACOTTA, SAND, 0.30))
    for k in range(5):
        a = math.radians(-150 + k * 30)
        d.line([(px2, py2 - h * 0.026),
                (px2 + math.cos(a) * w * 0.035, py2 - h * 0.026 + math.sin(a) * h * 0.045)],
               fill=mix(SAGE_DARK, SAGE, 0.25), width=max(2, int(w * 0.004)))
        blossom(d, px2 + math.cos(a) * w * 0.035,
                py2 - h * 0.026 + math.sin(a) * h * 0.045,
                w * 0.010, mix(DUSK_PALE, CREAM_LIGHT, 0.20),
                mix(GOLD, TERRACOTTA, 0.35))
    # long tree shadow on wall + floor
    shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    for _ in range(26):
        cx = tx + rng.uniform(-0.30, 0.34) * w
        cy = h * rng.uniform(0.60, 1.0)
        r = w * rng.uniform(0.012, 0.045)
        ellipse(sd, cx, cy, r, r * 0.40, rgba(mix(SAGE_DEEP, NIGHT, 0.35), 52))
    for _ in range(10):
        cx = rng.uniform(0, w * 0.7)
        cy = rng.uniform(wall_top, wall_bot)
        r = w * rng.uniform(0.015, 0.040)
        ellipse(sd, cx, cy, r, r * 0.55, rgba(mix(SAGE_DEEP, NIGHT, 0.35), 40))
    img = comp(img, shadow_layer.filter(ImageFilter.GaussianBlur(w * 0.012)))
    d = ImageDraw.Draw(img)
    # foreground blurred leaves bottom corners
    for ang, ln, bx in ((-60, 0.17, -0.03), (-105, 0.15, 0.04),
                        (-78, 0.18, 1.02), (-122, 0.15, 0.96)):
        banana_leaf(d, bx * w, h * 1.02, h * ln, math.radians(ang),
                    mix(SAGE_DEEP, NIGHT, 0.22))
    img = dappled_light(img, w * 0.15, h * 0.12, w * 0.68, h * 0.52, seed=587,
                        n=26, size=(0.012, 0.038), opacity=0.18, blur=w * 0.012)
    img = dof_bottom(img, 0.93, radius=h * 0.0045)
    return img
def draw_hero(w, h):
    horizon = h * 0.575
    img = seascape(
        w, h, horizon,
        sky_stops=[(0.0, "#3f606a"), (0.18, "#6a7f83"), (0.42, "#a8898a"),
                   (0.66, "#d29a80"), (0.85, "#eeb98a"), (1.0, "#f8d8a6")],
        sea_stops=[(0.0, "#f2c898"), (0.12, "#d9a584"), (0.38, "#8e9384"),
                   (0.72, "#52706a"), (1.0, "#33524d")],
        sun_xy=(w * 0.630, horizon - h * 0.085), sun_r=h * 0.072,
        sun_halo="#f7cd92", glow=1.15, shimmer_color="#f8dfb0",
        shimmer_alpha=105, shimmer_seed=301, horizon_haze=0.34, haze_seed=302,
    )
    img = soft_band(img, h * 0.18, h * 0.36, "#e2a99c", 0.30, 303, cells=6,
                    contrast=2.8, thresh=0.44, blur=h * 0.010)
    img = soft_band(img, h * 0.38, h * 0.52, "#f2c79c", 0.30, 304, cells=7,
                    contrast=2.6, thresh=0.44, blur=h * 0.008)
    d = ImageDraw.Draw(img)
    # far mountain shadows on both sides of the horizon
    ridge(d, w * 0.60, horizon + 1, h * 0.10, "#7d8f8b", seed=305, n=4,
          spread=0.14, jag=0.05)
    d2 = ImageDraw.Draw(img)
    ridge(d2, w * 0.35, horizon + 1, h * 0.06, "#94a49c", seed=306, n=3,
          spread=0.10, jag=0.04)
    # island silhouette
    island = [(w * 0.120, horizon + h * 0.006), (w * 0.170, horizon - h * 0.020),
              (w * 0.235, horizon - h * 0.070), (w * 0.300, horizon - h * 0.105),
              (w * 0.370, horizon - h * 0.125), (w * 0.445, horizon - h * 0.105),
              (w * 0.510, horizon - h * 0.070), (w * 0.565, horizon - h * 0.030),
              (w * 0.610, horizon + h * 0.004)]
    poly(d2, island, mix(DEEP_TEAL, NIGHT, 0.28))
    # beach edge highlight
    d2.line(P(island), fill=mix(GOLD, TERRACOTTA, 0.45),
            width=max(2, int(h * 0.004)))
    # palms on the island
    palm(d2, w * 0.245, horizon - h * 0.040, h * 0.115, lean=0.10,
         trunk=mix(NIGHT, TEAL_MID, 0.18), leaf=mix(NIGHT, SAGE_DARK, 0.25),
         seed=307, fronds=6, trunk_w=0.050, leaf_w=0.30)
    palm(d2, w * 0.290, horizon - h * 0.088, h * 0.130, lean=-0.06,
         trunk=mix(NIGHT, TEAL_MID, 0.18), leaf=mix(NIGHT, SAGE_DARK, 0.22),
         seed=308, fronds=6, trunk_w=0.050, leaf_w=0.30)
    palm(d2, w * 0.345, horizon - h * 0.105, h * 0.110, lean=0.12,
         trunk=mix(NIGHT, TEAL_MID, 0.16), leaf=mix(NIGHT, SAGE_DARK, 0.30),
         seed=309, fronds=5, trunk_w=0.050, leaf_w=0.28)
    palm(d2, w * 0.480, horizon - h * 0.080, h * 0.105, lean=-0.10,
         trunk=mix(NIGHT, TEAL_MID, 0.20), leaf=mix(NIGHT, SAGE_DARK, 0.28),
         seed=310, fronds=5, trunk_w=0.050, leaf_w=0.28)
    # little pointed pavilion + a couple of tiny warm lanterns on the island
    pav_x, pav_y = w * 0.408, horizon - h * 0.098
    pav_h = h * 0.055
    d2.rectangle([pav_x - w * 0.008, pav_y - pav_h * 0.35, pav_x + w * 0.008, pav_y],
                 fill=mix(NIGHT, TEAL_MID, 0.20))
    poly(d2, [(pav_x - w * 0.020, pav_y - pav_h * 0.30), (pav_x + w * 0.020, pav_y - pav_h * 0.30),
              (pav_x, pav_y - pav_h)], mix(NIGHT, TEAL_MID, 0.22))
    ellipse(d2, pav_x, pav_y - pav_h * 0.22, w * 0.004, h * 0.004, "#fbe0aa")
    ellipse(d2, w * 0.243, horizon - h * 0.020, w * 0.004, h * 0.004, "#fbe0aa")
    ellipse(d2, w * 0.248, horizon - h * 0.024, w * 0.003, h * 0.003, "#fbe0aa")
    # reflection of island + sky
    img = mirror_water(img, horizon + h * 0.006, opacity=0.46, wobble=5.0,
                       tint="#8a9c93", squash=0.92, seed=311, fade_pow=1.05)
    d = ImageDraw.Draw(img)
    d.line([(0, horizon + h * 0.002), (w, horizon + h * 0.002)],
           fill=mix(CREAM_LIGHT, SKY_BLUE, 0.35), width=max(1, int(h * 0.0022)))
    img = shimmer(img, horizon + h * 0.01, h * 0.99, "#f8e0b2", 95, 312,
                  n=110, center=w * 0.63, spread=0.20, dash=(0.012, 0.075),
                  blur=1.4)
    # sailboat, birds
    d = ImageDraw.Draw(img)
    sailboat(d, w * 0.845, horizon - h * 0.010, h * 0.030, "#f4e3c2")
    birds(d, w * 0.32, h * 0.20, h * 0.0065, "#4d5f5c", n=5, seed=313, spread=3.2)
    birds(d, w * 0.58, h * 0.14, h * 0.0050, "#4d5f5c", n=3, seed=314, spread=2.6)
    # foreground framing, out of focus
    for ang, ln in ((-26, 0.34), (-64, 0.30), (-104, 0.28)):
        frond(d, -w * 0.012, h * 1.02, math.radians(ang), h * ln, 0.30,
              w * 0.055, mix(NIGHT, SAGE_DARK, 0.18))
    for ang, ln in ((-154, 0.30), (-116, 0.28), (-78, 0.24)):
        frond(d, w * 1.012, h * 1.02, math.radians(ang), h * ln, 0.28,
              w * 0.050, mix(NIGHT, SAGE_DARK, 0.22))
    poly(d, [(0, h * 1.03), (0, h * 0.965), (w * 0.22, h * 0.998),
             (w * 0.32, h * 1.03)], mix(NIGHT, SAGE_DEEP, 0.20))
    poly(d, [(w, h * 1.03), (w, h * 0.955), (w * 0.80, h * 0.995),
             (w * 0.72, h * 1.03)], mix(NIGHT, SAGE_DEEP, 0.16))
    img = dof_bottom(img, 0.93, radius=h * 0.006)
    return img


# --------------------------------------------------------------------------
# job table, contact sheet and command line entry point
# --------------------------------------------------------------------------
JOBS = [
    ("sabah-dining-1", 1200, 1600, draw_sabah_dining_1),
    ("sabah-dining-2", 1164, 1600, draw_sabah_dining_2),
    ("sabah-pingpong", 1200, 1600, draw_sabah_pingpong),
    ("sabah-surf", 1440, 989, draw_sabah_surf),
    ("sabah-sunset", 1440, 1080, draw_sabah_sunset),
    ("sabah-palms", 1165, 1600, draw_sabah_palms),
    ("yangshuo-cormorant", 1180, 1646, draw_yangshuo_cormorant),
    ("yangshuo-river", 1440, 1080, draw_yangshuo_river),
    ("yangshuo-light", 1350, 1800, draw_yangshuo_light),
    ("yangshuo-karst", 1080, 1440, draw_yangshuo_karst),
    ("yangshuo-climb-1", 960, 1440, draw_yangshuo_climb_1),
    ("yangshuo-climb-2", 960, 1440, draw_yangshuo_climb_2),
    ("yangshuo-scooter", 1013, 1800, draw_yangshuo_scooter),
    ("chiangmai-trail", 960, 1440, draw_chiangmai_trail),
    ("chiangmai-temple", 960, 1440, draw_chiangmai_temple),
    ("chiangmai-forest", 1440, 1080, draw_chiangmai_forest),
    ("chiangmai-bar", 1000, 1600, draw_chiangmai_bar),
    ("chiangmai-table", 1000, 1600, draw_chiangmai_table),
    ("hongcun-moonpond", 1440, 1080, draw_hongcun_moonpond),
    ("hongcun-window", 1200, 1600, draw_hongcun_window),
    ("hongcun-lakeside", 1200, 1600, draw_hongcun_lakeside),
    ("hongcun-courtyard", 1440, 1080, draw_hongcun_courtyard),
]

DOC_FILES = (("hero.webp", 1600, 900), ("artwork-preview.webp", 1600, 1000))


def rounded_mask(width, height, radius):
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width - 1, height - 1],
                                           radius=radius, fill=255)
    return mask


def render(name, fw, fh, fn):
    t0 = time.perf_counter()
    img = fn(fw * SS, fh * SS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img = img.resize((fw, fh), Image.Resampling.LANCZOS)
    img = finish(img, seed_of(name))
    path = EXAMPLES / (name + ".webp")
    img.save(path, "WEBP", quality=86, method=6)
    size_kib = path.stat().st_size / 1024.0
    print("  %-22s %4dx%-4d %8.1f KiB %6.1fs"
          % (name, fw, fh, size_kib, time.perf_counter() - t0))
    return path


def contact_sheet(files, out_path):
    """1600x1000 cream contact sheet, 5x5 grid of rounded cards."""
    W, H = 1600, 1000
    cols, rows = 5, 5
    margin, gap, pad = 54, 20, 7
    bg = vgradient(W, H, [(0.0, CREAM_LIGHT), (0.45, CREAM), (1.0, CREAM_DEEP)])
    cell_w = (W - 2 * margin - (cols - 1) * gap) / cols
    cell_h = (H - 2 * margin - (rows - 1) * gap) / rows
    cards = []
    for i, path in enumerate(files):
        im = Image.open(path).convert("RGB")
        r, c = divmod(i, cols)
        x = margin + c * (cell_w + gap)
        y = margin + r * (cell_h + gap)
        inner_w = max(1, int(cell_w - 2 * pad))
        inner_h = max(1, int(cell_h - 2 * pad))
        scale = min(inner_w / im.width, inner_h / im.height)
        tw = max(1, int(round(im.width * scale)))
        th = max(1, int(round(im.height * scale)))
        thumb = im.resize((tw, th), Image.Resampling.LANCZOS)
        avg = im.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
        card_col = mix(mix(avg, CREAM, 0.58), CREAM_LIGHT, 0.12)
        cx = x + (cell_w - (tw + 2 * pad)) / 2.0
        cy = y + (cell_h - (th + 2 * pad)) / 2.0
        cards.append((cx, cy, tw, th, card_col, thumb))
    shadows = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadows)
    for cx, cy, tw, th, _col, _thumb in cards:
        sd.rounded_rectangle([cx + 3, cy + 5, cx + tw + 2 * pad + 3,
                              cy + th + 2 * pad + 5], radius=12,
                             fill=rgba(NIGHT, 34))
    base = bg.convert("RGBA")
    base = Image.alpha_composite(base,
                                 shadows.filter(ImageFilter.GaussianBlur(9)))
    sheet = base.convert("RGB")
    for cx, cy, tw, th, card_col, thumb in cards:
        cw, ch = tw + 2 * pad, th + 2 * pad
        card = Image.new("RGB", (cw, ch), card_col)
        sheet.paste(card, (int(round(cx)), int(round(cy))),
                    rounded_mask(cw, ch, 12))
        sheet.paste(thumb, (int(round(cx + pad)), int(round(cy + pad))),
                    rounded_mask(tw, th, 6))
    draw = ImageDraw.Draw(sheet)
    for cx, cy, tw, th, card_col, _thumb in cards:
        cw, ch = tw + 2 * pad, th + 2 * pad
        draw.rounded_rectangle([cx + 0.5, cy + 0.5, cx + cw - 0.5, cy + ch - 0.5],
                               radius=12, outline=mix(card_col, NIGHT, 0.20),
                               width=1)
    sheet = finish(sheet, seed_of("artwork-preview"), grain=2.2, vignette=0.10,
                   mottle=0.018)
    sheet.save(out_path, "WEBP", quality=88, method=6)
    print("  %-22s %4dx%-4d %8.1f KiB"
          % (out_path.name, out_path.width if hasattr(out_path, "width") else W,
             H, out_path.stat().st_size / 1024.0))
    return sheet


def build_docs():
    missing = [n for n, _, _, _ in JOBS if not (EXAMPLES / (n + ".webp")).exists()]
    if missing:
        raise SystemExit("generate the illustrations before docs: " + ", ".join(missing))
    t0 = time.perf_counter()
    fw, fh = 1600, 900
    img = draw_hero(fw * SS, fh * SS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img = img.resize((fw, fh), Image.Resampling.LANCZOS)
    img = finish(img, seed_of("hero"), grain=5.2, vignette=0.24)
    hero_path = DOCS / "hero.webp"
    img.save(hero_path, "WEBP", quality=88, method=6)
    print("  %-22s %4dx%-4d %8.1f KiB %6.1fs"
          % ("hero.webp", fw, fh, hero_path.stat().st_size / 1024.0,
             time.perf_counter() - t0))
    t1 = time.perf_counter()
    contact_sheet([EXAMPLES / (n + ".webp") for n, _, _, _ in JOBS],
                  DOCS / "artwork-preview.webp")
    print("  contact sheet built in %.1fs" % (time.perf_counter() - t1))


def verify(raise_on_error=True):
    problems = []
    rows = []
    total = 0
    for name, fw, fh, _fn in JOBS:
        path = EXAMPLES / (name + ".webp")
        if not path.exists():
            problems.append("missing: " + path.relative_to(ROOT).as_posix())
            continue
        total += path.stat().st_size
        with Image.open(path) as im:
            im.load()
            size = im.size
            mode = im.mode
            std = ImageStat.Stat(im.convert("L")).stddev[0]
        ok = size == (fw, fh) and mode == "RGB" and std > 12.0
        if not ok:
            problems.append("%s: size=%s mode=%s std=%.1f"
                            % (name, size, mode, std))
        rows.append((name, size, mode, std, path.stat().st_size, ok))
    for fname, fw, fh in DOC_FILES:
        path = DOCS / fname
        if not path.exists():
            problems.append("missing: " + path.relative_to(ROOT).as_posix())
            continue
        total += path.stat().st_size
        with Image.open(path) as im:
            im.load()
            size = im.size
            mode = im.mode
            std = ImageStat.Stat(im.convert("L")).stddev[0]
        ok = size == (fw, fh) and mode == "RGB" and std > 12.0
        if not ok:
            problems.append("%s: size=%s mode=%s std=%.1f"
                            % (fname, size, mode, std))
        rows.append((fname, size, mode, std, path.stat().st_size, ok))
    print("\nverification")
    for name, size, mode, std, nbytes, ok in rows:
        print("  [%s] %-22s %4dx%-4d %-3s std=%5.1f %9d B"
              % ("ok" if ok else "FAIL", name, size[0], size[1], mode, std, nbytes))
    print("  files: %d   total: %.1f KiB (%.2f MiB)"
          % (len(rows), total / 1024.0, total / (1024.0 * 1024.0)))
    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print("  - " + p)
        if raise_on_error:
            raise SystemExit(1)
        return False
    print("  all checks passed")
    return True


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    EXAMPLES.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    known = {name for name, _, _, _ in JOBS}
    wanted = [a for a in argv if a != "docs"]
    unknown = [a for a in wanted if a not in known]
    if unknown:
        raise SystemExit("unknown image(s): %s\nknown: %s"
                         % (", ".join(unknown), ", ".join(sorted(known))))
    t_start = time.perf_counter()
    if wanted:
        jobs = [j for j in JOBS if j[0] in wanted]
        print("island-resort artwork: %d selected illustration(s) @ %dx" % (len(jobs), SS))
        for name, fw, fh, fn in jobs:
            render(name, fw, fh, fn)
        if "docs" in argv:
            build_docs()
        print("\nrendered in %.1fs" % (time.perf_counter() - t_start))
        return 0
    print("island-resort artwork: %d illustrations + %d docs @ %dx supersampling"
          % (len(JOBS), len(DOC_FILES), SS))
    for name, fw, fh, fn in JOBS:
        render(name, fw, fh, fn)
    build_docs()
    elapsed = time.perf_counter() - t_start
    print("\nrendered in %.1fs" % elapsed)
    verify()
    return 0


if __name__ == "__main__":
    sys.exit(main())
