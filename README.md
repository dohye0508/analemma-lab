# Analemma Lab

**https://dohye0508.github.io/analemma-lab/**

An interactive tool that computes the analemma (the path the Sun traces
across the sky over one year, viewed at the same local solar time each
day) from axial tilt, orbital eccentricity, argument of perihelion, and
observer latitude. Includes real presets for all eight planets and a
latitude-comparison overlay.

## How it's computed (`index.html`)

1. Solve Kepler's equation `M = E - e*sinE` (Newton's method) for the
   eccentric anomaly.
2. Get the true anomaly, then the ecliptic longitude λ.
3. Declination: `sin(δ) = sin(ε)*sin(λ)`.
4. Equation of time from the difference between mean solar longitude and
   right ascension, giving the hour angle H.
5. Horizontal coordinates: `sin(alt) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(H)`.

No build step — open `index.html` directly.

## Project layout

```
index.html              the web app (deployed via GitHub Pages)
src/
  stellarium/            Stellarium script-console (F1) sources
  analysis/              Python: raw .txt -> CSV + comparison plots
  report/                docx report generator
data/
  single_latitude/       per-planet CSV + plot at a fixed 30N latitude
  by_latitude/           per-planet CSV + plot across 0/30/60/89.9N
```

## Reproducing the data

1. Paste a script from `src/stellarium/` into Stellarium's script console
   and run it. Output lands in Stellarium's user directory
   (`%APPDATA%\Stellarium` on Windows) as `analemma_<planet>.txt`.
2. `pip install matplotlib numpy`, then run a script from
   `src/analysis/` to produce CSVs and plots under `data/`.
   (`STELLARIUM_DIR` env var overrides the input location.)
3. `npm install docx`, then run `src/report/build_report.js` to build a
   docx report from the plots in `data/`.
