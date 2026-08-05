#!/usr/bin/env python3
"""Convert oklch() colors in SVGs to sRGB, then export to PDF via Inkscape."""
import re, math, os, subprocess, sys

def oklch_to_srgb(L_pct, C, H_deg):
    L = L_pct / 100.0
    H = math.radians(H_deg)
    a = C * math.cos(H)
    b = C * math.sin(H)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l = l_ ** 3
    m = m_ ** 3
    s = s_ ** 3
    r  =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g  = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bv = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    def gamma(c):
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    r, g, bv = gamma(r), gamma(g), gamma(bv)
    ri, gi, bi = round(r * 255), round(g * 255), round(bv * 255)
    return f"#{ri:02x}{gi:02x}{bi:02x}"

pat = re.compile(r'oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)')

figures = os.path.dirname(os.path.abspath(__file__))
names = ["architecture", "erd", "combined-pass", "alignment", "snowball", "snowball_list"]

for name in names:
    src = os.path.join(figures, f"{name}.svg")
    tmp = os.path.join(figures, f"{name}_srgb.svg")
    dst = os.path.join(figures, f"{name}.pdf")
    with open(src) as f:
        svg = f.read()
    n = len(pat.findall(svg))
    converted = pat.sub(lambda m: oklch_to_srgb(float(m.group(1)), float(m.group(2)), float(m.group(3))), svg)
    with open(tmp, "w") as f:
        f.write(converted)
    print(f"{name}: converted {n} oklch values", flush=True)
    subprocess.run(
        ["inkscape", "--export-type=pdf", "--export-text-to-path",
         "--export-area-drawing", f"--export-filename={dst}", tmp],
        check=True, capture_output=True
    )
    os.remove(tmp)
    print(f"{name}: exported to {dst}", flush=True)

print("Done.")
