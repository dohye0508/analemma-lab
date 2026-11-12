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

The main canvas switches between observation, orbit, and graph views. The graph
button replaces the scene and returns to the preceding view when pressed again.
The graph uses equal angular scale on both axes, separate axis-title margins,
and tick spacing based on the available screen size. Camera pan and zoom are
independent for each view.

The left inspector contains eight planet presets and the original four physical
parameters. Playback, direct percentage entry, quarter-orbit jumps, grid, trails,
and latitude comparison remain available. Dragging the observation camera uses
the reversed direction requested for this interface; graph dragging is unchanged.
Keyboard 1/2/3 selects observation/orbit/graph, Space plays or pauses, R fits the
camera, G/T toggles the grid/trail, and F toggles fullscreen.

The Background button provides six ground panoramas: Atacama, hills, grassland,
sunrise, forest, and snow. Brightness and rotation are saved locally. Former
space-only background preferences migrate to Atacama. Orbital space retains its
separate celestial environment. Background photographs are illustrative, not
computed star maps. Credits are inside the background dialog and in
`assets/CREDITS.txt`. There is no Help button or help dialog.

The main sky trail fades by at most 22% with angular separation from the current
Sun. Quarter-orbit markers and subtle text shadows improve legibility; comparison
and below-horizon paths retain dashed styling. Physics remains unchanged.

Run the dependency-free checks with `node --test tests/physics.test.cjs`.

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

## Photographs and font

Ground landscapes from Poly Haven are CC0; ESO photographs and the Solar System
Scope Earth texture are CC BY 4.0. See `assets/CREDITS.txt` for source links.
Panoramas are bounded to the device texture limit during WebGL upload; additional
backgrounds load when selected. Pretendard is bundled under SIL OFL 1.1 in
`fonts/pretendard/LICENSE`.
