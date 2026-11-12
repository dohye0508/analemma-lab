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

No build step, package installation, or network connection is needed — open
`index.html` directly. All fonts and runtime code are included locally.

## Simulation workspace

- **관측 / Sky:** a perspective sky view with camera movement, a horizon,
  altitude/azimuth grid, annual solar trail, and current Sun marker. Below-horizon
  trajectories use dashed lines.
- **궤도 / Orbit:** the corresponding Kepler orbit, current orbital position,
  perihelion/aphelion, and inertially fixed tilted rotation axis. Distance is in
  units of the semimajor axis `a`; body sizes are exaggerated for visibility.
- **그래프 / Graph:** the original azimuth–altitude analysis with pan/zoom and
  overlays at 0°, 30°, 60°, and 89°N. Statistics always refer to the selected
  observer, even when comparison curves are visible.
- The inspector retains the eight presets, obliquity (0–180°), eccentricity
  (0–0.9), perihelion direction (0–360°), and observer latitude (−89–89°).
  Numeric inputs retain the full preset precision. Changed presets are marked
  and can be restored without changing the observer latitude.
- Playback and scrubbing use a normalized orbital period. 0% is perihelion,
  50% is aphelion; this is not a calendar date or continuous diurnal motion.
  Each frame samples the Sun at local **mean** solar noon.

Drag the viewport to move the camera; scroll to zoom. `Space` toggles playback,
`R` fits the view, `G` toggles the grid, `T` toggles the trail, `1`/`2`/`3` select
views, `F` toggles fullscreen, and `?` opens help. Focus the canvas to use arrow
keys for camera movement. Editing form fields does not trigger these shortcuts.
On narrow screens the inspector opens with the panel button.

The model retains the original geometric assumptions and retrograde mean-Sun
handling. It does not model atmospheric refraction, real terrain, or spin–orbit
resonance. The equation of time is displayed in angular degrees for consistent
comparison between planets. Geographic poles are capped at ±89° to avoid the
azimuth singularity and are labeled with their actual computed latitude.

Run the dependency-free physics checks with Node.js:

```sh
node --test tests/physics.test.cjs
```

## Project layout

```
index.html              simulator shell (deployed via GitHub Pages)
src/
  simulator/            physics, canvas rendering, UI controls, and styles
  stellarium/            Stellarium script-console (F1) sources
  analysis/              Python: raw .txt -> CSV + comparison plots
  report/                docx report generator
data/
  single_latitude/       per-planet CSV + plot at a fixed 30N latitude
  by_latitude/           per-planet CSV + plot across 0/30/60/89.9N
tests/                  physics regression and boundary checks
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
