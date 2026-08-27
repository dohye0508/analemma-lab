import csv
import os
import matplotlib
import matplotlib.font_manager as fm
import numpy as np

# Stellarium writes script-console output next to its config file.
# Windows: %APPDATA%\Stellarium  /  macOS: ~/Library/Application Support/Stellarium
# Linux:   ~/.stellarium
SRC_DIR = os.environ.get("STELLARIUM_DIR", os.path.expanduser("~/.stellarium"))
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "single_latitude")

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

# ---- CJK font setup (fall back to English-only labels if not found) ----
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
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        lines = [ln.strip() for ln in f if ln.strip()]
    # first line: "planet=Name", second line: header, rest: data (until a
    # non-numeric line like "DONE" if present)
    for ln in lines[2:]:
        if ln == "DONE":
            break
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
    return rows


def strip_burn_in(rows):
    """Drop leading points whose jump distance is >3x the median step
    distance elsewhere in the series (startup transient)."""
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
    if cjk_font:
        return f"{en} ({ko})"
    return en


results = {}
for name, ko in PLANETS:
    path = os.path.join(SRC_DIR, f"analemma_{name}.txt")
    rows = parse_file(path)
    rows = strip_burn_in(rows)
    results[name] = rows

    csv_path = os.path.join(OUT_DIR, f"analemma_{name}.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["step", "azimuth", "altitude"])
        for step, az, alt in rows:
            w.writerow([step, az, alt])
    print(f"{name}: {len(rows)} points -> {csv_path}")

fig, axes = plt.subplots(2, 4, figsize=(20, 10))
fig.suptitle("Solar Path Across One Year, by Planet (Analemma)", fontsize=16)

for ax, (name, ko) in zip(axes.flat, PLANETS):
    rows = results[name]
    az_deg = np.array([r[1] for r in rows])
    alt_deg = np.array([r[2] for r in rows])
    az_unwrapped = np.degrees(np.unwrap(np.radians(az_deg)))

    ax.plot(az_unwrapped, alt_deg, "-o", color="#2a78d6", markersize=2, linewidth=1)
    ax.plot(az_unwrapped[0], alt_deg[0], "o", color="black", markersize=6, zorder=5)
    ax.set_title(label(name, ko))
    ax.set_xlabel("Azimuth (deg)")
    ax.set_ylabel("Altitude (deg)")
    ax.grid(True, alpha=0.3)

plt.tight_layout(rect=[0, 0, 1, 0.96])
png_path = os.path.join(OUT_DIR, "analemma_comparison.png")
plt.savefig(png_path, dpi=150)
print(f"\nSaved comparison plot -> {png_path}")
print(f"CJK font used: {cjk_font}")
