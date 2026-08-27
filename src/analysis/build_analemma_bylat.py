import csv
import os
import matplotlib
import matplotlib.font_manager as fm
import numpy as np

# Stellarium writes script-console output next to its config file.
# Windows: %APPDATA%\Stellarium  /  macOS: ~/Library/Application Support/Stellarium
# Linux:   ~/.stellarium
SRC_DIR = os.environ.get("STELLARIUM_DIR", os.path.expanduser("~/.stellarium"))
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "by_latitude")

PLANETS = [
    ("Mercury", "수성"),
    ("Venus",   "금성"),
    ("Earth",   "지구"),
    ("Mars",    "화성"),
    ("Jupiter", "목성"),
    ("Saturn",  "토성"),
    ("Uranus",  "천왕성"),
    ("Neptune", "해왕성"),
]
LAT_COLORS = {0: "#2a78d6", 30: "#e07b39", 60: "#3aa655", 89.9: "#c0392b"}

FONT_PATH = r"C:\Windows\Fonts\malgun.ttf"
cjk_font = None
if os.path.exists(FONT_PATH):
    try:
        fm.fontManager.addfont(FONT_PATH)
        cjk_font = fm.FontProperties(fname=FONT_PATH).get_name()
        matplotlib.rcParams["font.family"] = cjk_font
        matplotlib.rcParams["axes.unicode_minus"] = False
    except Exception:
        cjk_font = None

import matplotlib.pyplot as plt


def parse_file(path):
    """Returns dict: {latitude(float): [(step, az, alt), ...]}"""
    with open(path, "r", encoding="utf-8") as f:
        lines = [ln.strip() for ln in f if ln.strip()]

    blocks = {}
    cur_lat = None
    rows = None
    for ln in lines:
        if ln.startswith("planet="):
            continue
        if ln == "DONE":
            break
        if ln.startswith("latitude="):
            if cur_lat is not None:
                blocks[cur_lat] = rows
            cur_lat = float(ln.split("=")[1])
            rows = []
            continue
        if ln == "step,azimuth,altitude":
            continue
        parts = ln.split(",")
        if len(parts) != 3:
            continue
        try:
            step = int(parts[0])
            az = float(parts[1])
            alt = float(parts[2])
        except ValueError:
            continue
        rows.append((step, az, alt))
    if cur_lat is not None:
        blocks[cur_lat] = rows
    return blocks


def strip_burn_in(rows):
    if len(rows) < 6:
        return rows
    az = np.unwrap(np.radians([r[1] for r in rows]))
    alt = np.radians([r[2] for r in rows])
    dist = np.hypot(np.diff(az), np.diff(alt))
    median = np.median(dist)
    cut = 0
    for i in range(min(5, len(dist))):
        if dist[i] > 3 * median:
            cut = i + 1
        else:
            break
    return rows[cut:]


def label(en, ko):
    return f"{en} ({ko})" if cjk_font else en


results = {}
for name, ko in PLANETS:
    path = os.path.join(SRC_DIR, f"analemma_lat_{name}.txt")
    blocks = parse_file(path)
    clean = {lat: strip_burn_in(rows) for lat, rows in blocks.items()}
    results[name] = clean

    csv_path = os.path.join(OUT_DIR, f"analemma_lat_{name}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["latitude", "step", "azimuth", "altitude"])
        for lat, rows in clean.items():
            for step, az, alt in rows:
                w.writerow([lat, step, az, alt])
    counts = {lat: len(rows) for lat, rows in clean.items()}
    print(f"{name}: {counts} -> {csv_path}")

fig, axes = plt.subplots(2, 4, figsize=(22, 11))
fig.suptitle("Solar Path Across One Year by Latitude, per Planet (Analemma)", fontsize=16)

for ax, (name, ko) in zip(axes.flat, PLANETS):
    for lat, rows in sorted(results[name].items()):
        az_deg = np.array([r[1] for r in rows])
        alt_deg = np.array([r[2] for r in rows])
        az_unwrapped = np.degrees(np.unwrap(np.radians(az_deg)))
        color = LAT_COLORS.get(lat, "#888888")
        lat_label = "89.9°N(극)" if lat == 89.9 else f"{int(lat)}°N"
        ax.plot(az_unwrapped, alt_deg, "-o", color=color, markersize=1.5,
                linewidth=1, label=lat_label)
        ax.plot(az_unwrapped[0], alt_deg[0], "o", color="black", markersize=4, zorder=5)
    ax.set_title(label(name, ko))
    ax.set_xlabel("Azimuth (deg)")
    ax.set_ylabel("Altitude (deg)")
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=7, loc="best")

plt.tight_layout(rect=[0, 0, 1, 0.96])
png_path = os.path.join(OUT_DIR, "analemma_comparison_bylat.png")
plt.savefig(png_path, dpi=150)
print(f"\nSaved comparison plot -> {png_path}")
print(f"CJK font used: {cjk_font}")
