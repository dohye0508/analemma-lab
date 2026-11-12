# 아날렘마 시뮬레이션

**https://dohye0508.github.io/analemma-lab/**

An interactive tool that computes the analemma (the path the Sun traces
across the sky over one year, viewed at the same local solar time each
day) from axial tilt, orbital eccentricity, argument of perihelion, and
observer latitude. Includes real presets for all eight planets and a
latitude-comparison overlay.

## How it's computed (`src/simulator/physics.js`)

1. Solve Kepler's equation `M = E - e*sinE` (Newton's method) for the
   eccentric anomaly.
2. Get the true anomaly, then the ecliptic longitude λ.
3. Declination: `sin(δ) = sin(ε)*sin(λ)`.
4. Equation of time from the difference between mean solar longitude and
   right ascension, giving the hour angle H.
5. Horizontal coordinates: `sin(alt) = sin(φ)sin(δ) + cos(φ)cos(δ)cos(H)`.

No build step or package installation is needed. Fonts, photographs, and runtime
code are bundled locally. Serve the repository over HTTP for the WebGL sky:

```sh
python -m http.server 4175 --bind 127.0.0.1
```

Open `http://127.0.0.1:4175/`. Direct file opening falls back to a flat photograph
where browser texture security prevents spherical rendering.

## Simulation workspace

- The sky and orbital position share one workspace and timeline. Click the
  orbital thumbnail or camera icon to swap the main and contextual views.
  There is no separate tab navigation. Below-horizon sky trajectories are dashed;
  the orbital view shows the inertially fixed tilted axis. Body sizes are
  exaggerated for visibility.
- The chart icon opens the original azimuth–altitude graph over the scene.
  It supports independent pan/zoom, expansion, and overlays at 0°, 30°, 60°,
  and 89°N. Opening it preserves the main camera and playback state.
- The selected C layout docks a compact inspector and graph in a single left
  column. The continuous top toolbar uses 36px icons with short Korean labels.
  Panels end where their content ends, exposing the photographic scene. Property
  names (15px) and editable values (16px) share a row; each property occupies
  50px including its slider. The bottom playback control is 48px high.
- Click the orbital percentage to open a compact seek panel: drag the slider,
  type a percentage, or use 0/25/50/75/100% checkpoints. Enter applies and closes;
  Escape closes and returns focus. Playback and the eight presets remain wired
  to the same simulation state. No on-screen product wordmark is shown.
- The inspector retains the eight presets, obliquity (0–180°), eccentricity
  (0–0.9), perihelion direction (0–360°), and observer latitude (−89–89°).
  Numeric inputs retain the full preset precision. Changed presets are marked
  and can be restored without changing the observer latitude.
- Playback and scrubbing use a normalized orbital period. 0% is perihelion,
  50% is aphelion; this is not a calendar date or continuous diurnal motion.
  Each frame samples the Sun at local **mean** solar noon.

Drag the viewport to move the camera; scroll or pinch to zoom. `Space` toggles
playback, `R` fits the cameras, `G` toggles the grid, `T` toggles the trail,
`1`/`2` select the main camera, and `3` opens/closes the graph overlay.
`F` toggles fullscreen and `?` opens help. Focus either interactive canvas to
use arrows and `+`/`−` on that camera. Editing form fields does not trigger these
shortcuts. On narrow screens, the properties button opens the inspector, which
contains all eight planet presets. The graph and inspector share the overlay
space on phones. The toolbar becomes two rows while keeping every action
visible, with icons remaining large.

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

## Interface, photographs, and font

The dense property rows and edge-aligned panels follow the supplied Universe
Sandbox running screenshot. The selected C design keeps short labels, large
icons, a compact playback control, and the main simulation in one workspace.

ESO/B. Tafreshi's Atacama panorama is projected around the sky camera with WebGL.
ESO/S. Brunier's Milky Way panorama supplies the orbital background; the Earth
surface uses Solar System Scope's texture. Full links, CC BY 4.0 credits, and
adaptations are listed in `assets/CREDITS.txt` and in the on-screen photo credit
and help. These are illustrative photographs, not a current-location star map;
the original mean-solar-noon model remains unchanged. Failed image/WebGL loading
falls back to a flat photograph or the original scene background.

[Pretendard v1.3.9](https://github.com/orioncactus/pretendard) is included under
the SIL Open Font License 1.1; see `fonts/pretendard/LICENSE`.
