(function () {
  'use strict';
  const P = window.AnalemmaPhysics;
  const $ = id => document.getElementById(id);
  const earth = P.presets.find(p => p.id === 'earth');
  const state = {
    preset: earth, params: { eps: earth.eps, ecc: earth.ecc, peri: earth.peri, lat: 30 },
    view: 'sky', phase: 0, playing: false, speed: 0.05,
    grid: false, trail: true, compare: false, analysis: false, curves: [], current: null,
  };
  const definitions = [
    { id: 'eps', icon: 'tilt', name: '자전축 기울기', min: 0, max: 180, step: 0.01, unit: '°' },
    { id: 'ecc', icon: 'eccentric', name: '이심률', min: 0, max: 0.9, step: 0.0001, unit: '' },
    { id: 'peri', icon: 'perihelion', name: '근일점 방향', min: 0, max: 360, step: 1, unit: '°' },
    { id: 'lat', icon: 'latitude', name: '위도', min: -89, max: 89, step: 1, unit: '°' },
  ];
  for (const def of definitions) {
    const property = document.createElement('div');
    property.className = 'property';
    property.innerHTML = '<div class="property-row"><label for="' + def.id + '"><svg class="icon" aria-hidden="true"><use href="#i-' + def.icon + '"/></svg><span>' + def.name + '</span></label>' +
      '<div class="number-field"><input id="' + def.id + 'Number" type="number" aria-label="' + def.name + ' 수치" min="' + def.min + '" max="' + def.max + '" step="' + def.step + '"><span>' + def.unit + '</span></div></div>' +
      '<input type="range" id="' + def.id + '" aria-label="' + def.name + '" min="' + def.min + '" max="' + def.max + '" step="' + def.step + '">';
    $('properties').append(property);
  }
  for (const preset of P.presets) {
    const button = document.createElement('button');
    button.className = 'object-button';
    button.dataset.planet = preset.id;
    button.title = preset.name;
    button.setAttribute('aria-label', preset.name + ' 프리셋');
    button.innerHTML = '<span class="planet ' + preset.id + '" aria-hidden="true"></span><span class="planet-label">' + preset.name + '</span>';
    button.addEventListener('click', () => selectPlanet(preset));
    $('presets').append(button);
  }
  document.querySelector('.inspector-scroll').prepend($('presets'));
  const renderer = new window.AnalemmaRenderer($('scene'));
  const contextRenderer = new window.AnalemmaRenderer($('contextScene'), { compact: true });
  let previousView = 'sky';
  let frame = 0, dirty = true, previousTime = 0, previousReadout = 0, toastTimeout;

  function invalidate() {
    dirty = true;
    if (!frame) frame = requestAnimationFrame(animate);
  }
  function animate(now) {
    frame = 0;
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.1) : 0;
    previousTime = now;
    if (state.playing && !document.hidden) {
      state.phase = (state.phase + delta * state.speed) % 1;
      dirty = true;
    }
    if (dirty) {
      state.current = P.position(state.params, state.phase);
      renderer.draw({ ...state, grid:state.view === 'graph' || state.grid });
      if ($('contextScene').checkVisibility({ visibilityProperty: true })) {
        contextRenderer.draw({ ...state, view: state.view === 'sky' ? 'orbit' : 'sky', grid: false, curves: [state.curves[0]] });
      }
      if (!state.playing || now - previousReadout > 80) {
        updateReadouts();
        previousReadout = now;
      }
      dirty = false;
    }
    if (state.playing && !document.hidden) frame = requestAnimationFrame(animate);
  }
  function setFill(input) {
    const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--fill', percent + '%');
  }
  function syncControls(except) {
    for (const def of definitions) {
      $(def.id).value = state.params[def.id];
      setFill($(def.id));
      if (except !== def.id + 'Number') $(def.id + 'Number').value = state.params[def.id];
      $(def.id).setAttribute('aria-valuetext', def.id === 'lat' ? P.latitudeLabel(state.params.lat) : state.params[def.id] + def.unit);
    }
    $('latNumber').title = P.latitudeLabel(state.params.lat) + ' · 음수는 남위';
    $('modified').hidden = ['eps', 'ecc', 'peri'].every(id => Math.abs(state.params[id] - state.preset[id]) < 1e-9);
  }
  function rebuild(except) {
    state.curves = [{ main: true, lat: state.params.lat, color: '#e7b66d', points: P.curve(state.params) }];
    if (state.compare) {
      for (const [lat, color] of [[0, '#80aecf'], [30, '#ad9bc6'], [60, '#7ab5a4'], [89, '#cf8f98']]) {
        if (lat !== state.params.lat) state.curves.push({ main: false, lat, color, points: P.curve(state.params, lat) });
      }
    }
    const stats = P.statistics(state.curves[0].points);
    $('statAlt').textContent = stats.alt.toFixed(2) + '°';
    $('statAz').textContent = stats.az.toFixed(2) + '°';
    $('statEot').textContent = stats.eot.toFixed(2) + '°';
    $('legend').innerHTML = state.curves.map(curve => '<span class="legend-item"><span class="legend-line" style="--legend-color:' + curve.color + '"></span>' + P.latitudeLabel(curve.lat) + '</span>').join('');
    $('legend').hidden = !state.compare;
    syncControls(except);
    invalidate();
  }
  function selectPlanet(preset) {
    state.preset = preset;
    for (const key of ['eps', 'ecc', 'peri']) state.params[key] = preset[key];
    $('planetName').textContent = preset.name;
    $('selectedPlanet').className = 'planet ' + preset.id;
    document.querySelectorAll('[data-planet]').forEach(button => {
      const active = button.dataset.planet === preset.id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    rebuild();
    fit();
  }
  function updateReadouts() {
    const p = state.current;
    const percent = (state.phase * 100).toFixed(1);
    $('phaseValue').textContent = percent;
    if (document.activeElement !== $('phaseNumber')) $('phaseNumber').value = percent;
    $('phase').value = state.phase * 100;
    setFill($('phase'));
    $('phase').setAttribute('aria-valuetext', '공전 ' + percent + '%');
    $('currentAlt').textContent = p.alt.toFixed(2) + '°';
    $('currentAz').textContent = p.az.toFixed(2) + '°';
    $('currentEot').textContent = (p.eot >= 0 ? '+' : '') + p.eot.toFixed(2) + '°';
    $('visibilityState').hidden = p.alt >= 0;
    $('findSun').hidden = state.view !== 'sky' || renderer.sunVisible;
  }
  function setView(view) {
    if(view !== 'graph') previousView=view;
    state.view = view;
    state.analysis = view === 'graph';
    $('graphToggle').setAttribute('aria-pressed',String(state.analysis));
    $('graphToggle').setAttribute('aria-label',state.analysis ? '관측으로 돌아가기' : '그래프 보기');
    $('graphToggle').title=state.analysis ? '관측으로 돌아가기' : '그래프 보기';
    $('viewport').dataset.view = view;
    const label = view === 'sky' ? '궤도 크게 보기' : '관측 크게 보기';
    $('cameraToggle').setAttribute('aria-pressed', String(view === 'orbit'));
    $('cameraToggle').setAttribute('aria-label', label);
    $('cameraToggle').title = label;
    $('cameraToggle').querySelector('use').setAttribute('href', view === 'sky' ? '#i-orbit' : '#i-sky');
    $('contextSwap').setAttribute('aria-label', label);
    $('contextSwap').title = label;
    $('cameraToggle').querySelector('.tool-label').textContent = view === 'sky' ? '궤도' : '관측';
    $('contextLabel').textContent = view === 'sky' ? '공전 궤도' : '지표 관측';
    window.NightEnvironment.updateCredit(view);
    invalidate();
  }
  function setAnalysis(open) { setView(open ? 'graph' : previousView); }
  function setPlaying(playing) {
    state.playing = playing;
    previousTime = 0;
    $('playIcon').setAttribute('href', playing ? '#i-pause' : '#i-play');
    $('play').setAttribute('aria-label', playing ? '일시 정지' : '재생');
    invalidate();
  }
  function seek(phase) {
    state.phase = P.clamp(phase, 0, 1);
    setPlaying(false);
  }
  function showToast(message) {
    clearTimeout(toastTimeout);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimeout = setTimeout(() => $('toast').hidden = true, 2600);
  }
  function togglePanel(force) {
    const workspace = document.querySelector('.workspace');
    const hidden = force === undefined ? !workspace.classList.contains('panel-hidden') : !force;
    workspace.classList.toggle('panel-hidden', hidden);
    const label = hidden ? '속성 패널 열기' : '속성 패널 숨기기';
    $('panelToggle').setAttribute('aria-expanded', String(!hidden));
    $('panelToggle').setAttribute('aria-label', label);
    $('panelToggle').title = label;
    if (hidden && $('inspector').contains(document.activeElement)) $('panelToggle').focus();
    invalidate();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { showToast('전체 화면을 지원하지 않는 브라우저입니다.'); }
  }
  function toggleDisplay(key, id) {
    state[key] = !state[key];
    $(id).setAttribute('aria-pressed', String(state[key]));
    invalidate();
  }
  function fit() {
    for (const view of [renderer, contextRenderer]) view.fit(state);
    invalidate();
  }
  function zoomActiveSurface(factor) {
    renderer.zoom(state.view, factor);
    invalidate();
  }

  for (const def of definitions) {
    $(def.id).addEventListener('input', () => {
      state.params[def.id] = Number($(def.id).value);
      rebuild();
    });
    const number = $(def.id + 'Number');
    number.addEventListener('input', () => {
      const valid = number.value.trim() !== '' && Number.isFinite(number.valueAsNumber) && number.validity.valid;
      number.parentElement.classList.toggle('invalid', !valid);
      number.setAttribute('aria-invalid', String(!valid));
      if (valid) { state.params[def.id] = number.valueAsNumber; rebuild(number.id); }
    });
    number.addEventListener('change', () => {
      if (Number.isFinite(number.valueAsNumber)) {
        state.params[def.id] = Number((Math.round(P.clamp(number.valueAsNumber, def.min, def.max) / def.step) * def.step).toFixed(4));
      }
      number.parentElement.classList.remove('invalid');
      number.removeAttribute('aria-invalid');
      rebuild();
    });
    number.addEventListener('keydown', event => { if (event.key === 'Enter') number.blur(); });
  }
  $('cameraToggle').addEventListener('click', () => setView(state.view === 'sky' ? 'orbit' : 'sky'));
  $('contextSwap').addEventListener('click', () => setView(state.view === 'sky' ? 'orbit' : 'sky'));
  $('graphToggle').addEventListener('click', () => setAnalysis(!state.analysis));
  $('compareToggle').addEventListener('click', () => {
    state.compare = !state.compare;
    $('compareToggle').setAttribute('aria-pressed', String(state.compare));
    renderer.graphCamera = { x: 0, y: 0, zoom: 1 };
    if (state.compare && state.view === 'orbit') setAnalysis(true);
    rebuild();
  });
  $('restorePreset').addEventListener('click', () => selectPlanet(state.preset));
  $('play').addEventListener('click', () => setPlaying(!state.playing));
  $('stepBack').addEventListener('click', () => seek(state.phase - 0.01));
  $('stepForward').addEventListener('click', () => seek(state.phase + 0.01));
  $('phase').addEventListener('input', () => seek(Number($('phase').value) / 100));
  function setPhasePopover(open, restoreFocus = false) {
    $('phasePopover').hidden = !open;
    $('phaseToggle').setAttribute('aria-expanded', String(open));
    if (open) {
      $('phaseNumber').value = (state.phase * 100).toFixed(1);
      $('phaseNumber').focus();
      $('phaseNumber').select();
    } else if (restoreFocus) $('phaseToggle').focus();
  }
  $('phaseToggle').addEventListener('click', () => setPhasePopover($('phasePopover').hidden));
  $('phaseNumber').addEventListener('change', () => {
    const value = $('phaseNumber').valueAsNumber;
    if (Number.isFinite(value)) seek(P.clamp(value, 0, 100) / 100);
    $('phaseNumber').value = (state.phase * 100).toFixed(1);
  });
  $('phaseNumber').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      $('phaseNumber').dispatchEvent(new Event('change'));
      setPhasePopover(false, true);
    }
  });
  document.querySelectorAll('[data-phase]').forEach(button => button.addEventListener('click', () => {
    seek(Number(button.dataset.phase) / 100);
    $('phaseNumber').value = button.dataset.phase;
  }));
  document.addEventListener('pointerdown', event => {
    if (!$('phasePopover').hidden && !event.target.closest('#phasePopover, #phaseToggle')) setPhasePopover(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('phasePopover').hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPhasePopover(false, true);
    }
  });
  $('speed').addEventListener('change', () => { state.speed = Number($('speed').value); });
  $('gridToggle').addEventListener('click', () => toggleDisplay('grid', 'gridToggle'));
  $('trailToggle').addEventListener('click', () => toggleDisplay('trail', 'trailToggle'));
  $('zoomIn').addEventListener('click', () => zoomActiveSurface(0.85));
  $('zoomOut').addEventListener('click', () => zoomActiveSurface(1 / 0.85));
  $('fit').addEventListener('click', fit);
  $('findSun').addEventListener('click', () => { renderer.focusSun(state); invalidate(); });
  $('fullscreen').addEventListener('click', fullscreen);
  $('panelToggle').addEventListener('click', () => togglePanel());
  $('closePanel').addEventListener('click', () => togglePanel(false));
  function syncEnvironment() {
    const prefs = window.NightEnvironment.preferences;
    document.querySelectorAll('[data-background]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.background === prefs.background)));
    $('backgroundBrightness').value=prefs.brightness;
    $('backgroundRotation').value=prefs.rotation;
    $('brightnessValue').textContent=prefs.brightness+'%';
    $('rotationValue').textContent=prefs.rotation+'°';
    for(const id of ['backgroundBrightness','backgroundRotation']) { $(id).disabled=prefs.background==='plain'; setFill($(id)); }
    window.NightEnvironment.updateCredit(state.view);
    invalidate();
  }
  $('environmentToggle').addEventListener('click', () => { syncEnvironment(); $('environmentDialog').showModal(); });
  $('closeEnvironment').addEventListener('click', () => $('environmentDialog').close());
  $('environmentDialog').addEventListener('close', () => $('environmentToggle').focus());
  document.querySelectorAll('[data-background]').forEach(button => button.addEventListener('click', () => { window.NightEnvironment.configure({ background:button.dataset.background }); syncEnvironment(); }));
  for(const [id,key] of [['backgroundBrightness','brightness'],['backgroundRotation','rotation']]) $(id).addEventListener('input', () => { window.NightEnvironment.configure({ [key]:Number($(id).value) }); syncEnvironment(); });
  $('resetEnvironment').addEventListener('click', () => { window.NightEnvironment.reset(); syncEnvironment(); });
  $('reset').addEventListener('click', () => {
    setPlaying(false);
    setPhasePopover(false);
    state.phase = 0; state.params.lat = 30; state.compare = false; state.speed = 0.05;
    $('compareToggle').setAttribute('aria-pressed', 'false');
    $('speed').value = '0.05';
    state.grid = false; state.trail = true;
    $('gridToggle').setAttribute('aria-pressed', 'false');
    $('trailToggle').setAttribute('aria-pressed', 'true');
    setAnalysis(false); selectPlanet(earth); setView('sky');
    showToast('초기화했습니다.');
  });

  // Each surface retains its own camera. Pointer maps also support touch pinch.
  function attachCamera(canvas, viewRenderer, viewName) {
    const pointers = new Map();
    const distance = () => {
      const p = [...pointers.values()];
      return p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const before = distance();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        const direction = viewName() === 'orbit' ? -1 : 1;
        viewRenderer.pan(viewName(), (event.clientX - previous.x) * direction, (event.clientY - previous.y) * direction);
      }
      else {
        const after = distance();
        if (before > 0 && after > 0) viewRenderer.zoom(viewName(), before / after);
      }
      invalidate();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(name, event => pointers.delete(event.pointerId));
    }
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      viewRenderer.zoom(viewName(), Math.exp(P.clamp(event.deltaY, -100, 100) * 0.0015));
      invalidate();
    }, { passive: false });
    canvas.addEventListener('dblclick', () => { viewRenderer.fit(state); invalidate(); });
  }
  attachCamera($('scene'), renderer, () => state.view);
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || $('environmentDialog').open) return;
    if (event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    const targetRenderer = renderer;
    const targetView = state.view;
    if (key === ' ') {
      if (event.target.closest('button,a,summary')) return;
      event.preventDefault(); setPlaying(!state.playing);
    } else if (key === 'escape') {
      if (state.analysis) setAnalysis(false);
      else if (window.innerWidth <= 850) togglePanel(false);
    } else if (key === 'r') fit();
    else if (key === 'g') toggleDisplay('grid', 'gridToggle');
    else if (key === 't') toggleDisplay('trail', 'trailToggle');
    else if (key === 'f') fullscreen();
    else if (key === '1') setView('sky');
    else if (key === '2') setView('orbit');
    else if (key === '3') setAnalysis(!state.analysis);
    else if (key === '+' || key === '=' || key === '-') {
      event.preventDefault(); targetRenderer.zoom(targetView, key === '-' ? 1 / 0.85 : 0.85); invalidate();
    } else if (event.target.tagName === 'CANVAS' && key.startsWith('arrow')) {
      event.preventDefault();
      targetRenderer.pan(targetView, key === 'arrowleft' ? 25 : key === 'arrowright' ? -25 : 0, key === 'arrowup' ? 25 : key === 'arrowdown' ? -25 : 0);
      invalidate();
    }
  });
  document.addEventListener('visibilitychange', () => { previousTime = 0; if (!document.hidden) invalidate(); });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    $('fullscreen').setAttribute('aria-pressed', String(active));
    $('fullscreen').setAttribute('aria-label', active ? '전체 화면 종료 (F)' : '전체 화면 (F)');
    $('fullscreen').title = active ? '전체 화면 종료 (F)' : '전체 화면 (F)';
    invalidate();
  });
  const observer = new ResizeObserver(invalidate);
  const inspectorObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--inspector-bottom', $('inspector').getBoundingClientRect().bottom + 'px');
    invalidate();
  });
  inspectorObserver.observe($('inspector'));
  for (const id of ['viewport', 'contextScene']) observer.observe($(id));
  document.fonts.ready.then(invalidate);
  window.addEventListener('environmentready', invalidate);
  togglePanel(window.innerWidth > 850);
  selectPlanet(earth);
  setView('sky');

})();
