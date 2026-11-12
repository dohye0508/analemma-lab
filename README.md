# Analemma Lab

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

No build step, package installation, or network connection is needed — open
`index.html` directly. All fonts and runtime code are included locally.

## Simulation workspace

- The sky and orbital position share one workspace and timeline. Click the
  orbital thumbnail or camera icon to swap the main and contextual views.
  There is no separate tab navigation. Below-horizon sky trajectories are dashed;
  the orbital view shows the inertially fixed tilted axis. Body sizes are
  exaggerated for visibility.
- The chart icon opens the original azimuth–altitude graph over the scene.
  It supports independent pan/zoom, expansion, and overlays at 0°, 30°, 60°,
  and 89°N. Opening it preserves the main camera and playback state.
- Large planet icons and playback controls remain visible. Parameter names
  and current values stay in the inspector; annual statistics are expandable.
  Twelve large action icons expose the camera, graph, latitude comparison,
  grid, trail, zoom, camera fit, reset, fullscreen, help, and inspector directly.
  There is no on-screen product wordmark. Explanations and model details live
  in help; bundled Pretendard and tabular numerals keep labels and values clear.
  Statistics always refer to the selected observer, including during comparison.
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
shortcuts. On narrow screens, swipe the planet strip and open the inspector with
the sliders icon. On phones, the tool dock becomes two rows with every action
visible. The UI keeps a single workspace across desktop and mobile.

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

## UI references and font

The bottom hotbar and object inspector are informed by actual Universe Sandbox
running screenshots and its [Update 35 interface changes](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/).
All interface graphics are drawn locally; no game assets are bundled.

[Pretendard v1.3.9](https://github.com/orioncactus/pretendard) is included under
the SIL Open Font License 1.1; see `fonts/pretendard/LICENSE`.
