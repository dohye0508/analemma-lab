(function () {
  'use strict';
  const P = window.AnalemmaPhysics;
  const $ = id => document.getElementById(id);
  const earth = P.presets.find(p => p.id === 'earth');
  const state = { preset: earth, params: { eps: earth.eps, ecc: earth.ecc, peri: earth.peri, lat: 30 },
    view: 'sky', phase: 0, playing: false, speed: 0.05, grid: true, trail: true, compare: false, curves: [], current: null };
  const definitions = [
    { id: 'eps', name: '자전축 기울기', symbol: 'ε', min: 0, max: 180, step: 0.01, unit: '°', start: '0°', end: '180°' },
    { id: 'ecc', name: '이심률', symbol: 'e', min: 0, max: 0.9, step: 0.0001, unit: '', start: '원 궤도', end: '0.9' },
    { id: 'peri', name: '근일점 방향', symbol: 'ϖ', min: 0, max: 360, step: 1, unit: '°', start: '0°', end: '360°' },
    { id: 'lat', name: '관측 위도', symbol: 'φ', min: -89, max: 89, step: 1, unit: '°', start: '89°S', end: '89°N' },
  ];
  for (const def of definitions) {
    const property = document.createElement('div'); property.className = 'property';
    property.innerHTML = `<div class="property-row"><label for="${def.id}">${def.name}<span>${def.symbol}</span></label><div class="number-field"><input id="${def.id}Number" type="number" aria-label="${def.name} 수치" min="${def.min}" max="${def.max}" step="${def.step}" value="${state.params[def.id]}"><span>${def.unit}</span></div></div><input type="range" id="${def.id}" aria-label="${def.name}" min="${def.min}" max="${def.max}" step="${def.step}" value="${state.params[def.id]}"><div class="range-ends"><span>${def.start}</span>${def.id === 'lat' ? '<output id="latitudeLabel">30°N</output>' : ''}<span>${def.end}</span></div>`;
    $(def.id === 'lat' ? 'observerProperties' : 'orbitalProperties').append(property);
  }
  for (const preset of P.presets) {
    const button = document.createElement('button');
    button.className = 'object-button'; button.dataset.planet = preset.id;
    button.setAttribute('aria-label', `${preset.name} 프리셋`);
    button.innerHTML = `<span class="planet ${preset.id}" aria-hidden="true"></span><span>${preset.name}</span><small>${preset.english.slice(0,3).toUpperCase()}</small>`;
    button.addEventListener('click', () => selectPlanet(preset)); $('presets').append(button);
  }
  const renderer = new window.AnalemmaRenderer($('scene'), $('orbitInset'));
  let frame = 0, dirty = true, previousTime = 0, previousReadout = 0, dragging = null, toastTimeout;
  function invalidate() { dirty = true; if (!frame) frame = requestAnimationFrame(animate); }
  function animate(now) {
    frame = 0;
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.1) : 0; previousTime = now;
    if (state.playing && !document.hidden) { state.phase = (state.phase + delta * state.speed) % 1; dirty = true; }
    if (dirty) {
      state.current = P.position(state.params, state.phase);
      renderer.draw(state);
      if (!state.playing || now - previousReadout > 80) { updateReadouts(); previousReadout = now; }
      dirty = false;
    }
    if (state.playing && !document.hidden) frame = requestAnimationFrame(animate);
  }
  function setFill(input) { input.style.setProperty('--fill', `${(Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100}%`); }
  function syncControls(except) {
    for (const def of definitions) {
      $(def.id).value = state.params[def.id]; setFill($(def.id));
      if (except !== `${def.id}Number`) $(def.id + 'Number').value = state.params[def.id];
      $(def.id).setAttribute('aria-valuetext', def.id === 'lat' ? P.latitudeLabel(state.params.lat) : `${state.params[def.id]}${def.unit}`);
    }
    $('latitudeLabel').textContent = P.latitudeLabel(state.params.lat);
    $('modified').hidden = ['eps','ecc','peri'].every(id => Math.abs(state.params[id] - state.preset[id]) < 1e-9);
    updateCaption();
  }
  function rebuild(except) {
    state.curves = [{ main: true, lat: state.params.lat, color: '#e7b66d', points: P.curve(state.params) }];
    if (state.compare) {
      for (const [lat,color] of [[0,'#80aecf'],[30,'#ad9bc6'],[60,'#7ab5a4'],[89,'#cf8f98']]) {
        if (lat !== state.params.lat) state.curves.push({ main: false, lat, color, points: P.curve(state.params, lat) });
      }
    }
    const stats = P.statistics(state.curves[0].points);
    $('statAlt').textContent = `${stats.alt.toFixed(2)}°`;
    $('statAz').textContent = `${stats.az.toFixed(2)}°`;
    $('statEot').textContent = `${stats.eot.toFixed(2)}°`;
    $('legend').innerHTML = state.curves.map(curve => `<span class="legend-item"><span class="legend-line" style="--legend-color:${curve.color}"></span>${P.latitudeLabel(curve.lat)}${curve.main ? ' 관측자' : ''}</span>`).join('');
    syncControls(except); invalidate();
  }
  function selectPlanet(preset) {
    state.preset = preset;
    for (const key of ['eps','ecc','peri']) state.params[key] = preset[key];
    $('planetName').textContent = preset.name; $('planetEnglish').textContent = preset.english;
    $('selectedPlanet').className = `planet ${preset.id}`;
    $('planetDescription').textContent = preset.description; $('statusPlanet').textContent = preset.name;
    document.querySelectorAll('[data-planet]').forEach(button => {
      const active = button.dataset.planet === preset.id;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      button.querySelector('small').hidden = active;
    });
    rebuild(); renderer.fit(state); invalidate();
  }
  function updateCaption() {
    const name = state.preset.name + ($('modified').hidden ? '' : ' · 수정됨');
    const captions = { sky: ['지표면 관측',`${name}에서 본 태양`,`평균태양시 12:00 · ${P.latitudeLabel(state.params.lat)}`],
      orbit: ['태양 중심 좌표',`${name}의 공전 궤도`,'거리 단위 a · 천체 크기 확대'],
      graph: ['방위각–고도 좌표',`${name}의 아날렘마`,`선택 위도 ${P.latitudeLabel(state.params.lat)} · 1공전`] };
    [$('viewCaption'),$('sceneTitle'),$('sceneSubtitle')].forEach((el,i)=>el.textContent=captions[state.view][i]);
  }
  function updateReadouts() {
    const p=state.current,percent=(state.phase*100).toFixed(1);
    $('phaseValue').textContent=percent; $('phase').value=state.phase*100; setFill($('phase'));
    $('phase').setAttribute('aria-valuetext',`공전 ${percent}%`);
    $('samplePhase').textContent=`공전 ${percent}%`;
    $('currentAlt').textContent=`${p.alt.toFixed(2)}°`; $('currentAz').textContent=`${p.az.toFixed(2)}°`;
    $('currentEot').textContent=`${p.eot>=0?'+':''}${p.eot.toFixed(2)}°`;
    $('visibilityState').textContent=p.alt<0?'지평선 아래':'지평선 위'; $('visibilityState').classList.toggle('below',p.alt<0);
    $('orbitDistance').textContent=`${p.distance.toFixed(3)} a`; $('orbitAngle').textContent=`${(((p.nu/P.RAD)%360+360)%360).toFixed(1)}°`;
    $('cameraLabel').textContent=state.view==='sky'?`시야 ${renderer.camera.fov.toFixed(0)}°` : state.view==='orbit'?`궤도 확대 ${renderer.orbitCamera.zoom.toFixed(1)}×`:`그래프 확대 ${renderer.graphCamera.zoom.toFixed(1)}×`;
    let notice='';
    if(state.view==='sky'&&p.alt<0)notice=`태양이 지평선 아래에 있습니다 · 고도 ${p.alt.toFixed(1)}°`;
    else if(state.view!=='orbit'&&!renderer.sunVisible)notice='태양이 화면 밖에 있습니다 · R 시점 맞춤';
    if(state.view==='orbit'&&state.compare)notice='위도 비교는 관측·그래프 보기에 표시됩니다';
    $('viewNotice').textContent=notice;$('viewNotice').hidden=!notice;
  }
  function setView(view) {
    state.view=view;
    document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $('miniOrbit').hidden=view==='orbit';$('legend').hidden=view==='orbit';
    $('gestureHint').innerHTML=view==='graph'?'드래그 그래프 이동 <i>·</i> 휠 확대':'드래그 시점 이동 <i>·</i> 휠 확대';
    updateCaption();invalidate();
  }
  function setPlaying(playing) {
    state.playing=playing;previousTime=0;
    $('playIcon').setAttribute('href',playing?'#i-pause':'#i-play');
    $('play').setAttribute('aria-label',playing?'일시 정지':'재생');
    $('playState').textContent=playing?'재생 중':'일시 정지';invalidate();
  }
  function seek(phase) { state.phase=P.clamp(phase,0,1);setPlaying(false);invalidate(); }
  function showToast(message) { clearTimeout(toastTimeout);$('toast').textContent=message;$('toast').hidden=false;toastTimeout=setTimeout(()=>$('toast').hidden=true,2600); }
  function togglePanel(force) {
    const hidden=force===undefined?!document.querySelector('.workspace').classList.contains('panel-hidden'):!force;
    document.querySelector('.workspace').classList.toggle('panel-hidden',hidden);
    $('panelToggle').setAttribute('aria-expanded',String(!hidden));$('panelToggle').setAttribute('aria-label',hidden?'속성 패널 열기':'속성 패널 숨기기');
    if(hidden&&$('inspector').contains(document.activeElement))$('panelToggle').focus();invalidate();
  }
  async function fullscreen() {
    try { if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen(); }
    catch { showToast('이 브라우저에서는 전체 화면을 사용할 수 없습니다.'); }
  }
  function toggleDisplay(key,id) { state[key]=!state[key];$(id).classList.toggle('active',state[key]);$(id).setAttribute('aria-pressed',String(state[key]));invalidate(); }
  function fit() { renderer.fit(state);invalidate(); }

  for(const def of definitions){
    $(def.id).addEventListener('input',()=>{state.params[def.id]=Number($(def.id).value);rebuild();});
    const number=$(def.id+'Number');
    number.addEventListener('input',()=>{
      const valid=number.value.trim()!==''&&Number.isFinite(number.valueAsNumber)&&number.validity.valid;
      number.parentElement.classList.toggle('invalid',!valid);number.setAttribute('aria-invalid',String(!valid));
      if(valid){state.params[def.id]=number.valueAsNumber;rebuild(number.id);}
    });
    number.addEventListener('change',()=>{
      if(Number.isFinite(number.valueAsNumber))state.params[def.id]=Number((Math.round(P.clamp(number.valueAsNumber,def.min,def.max)/def.step)*def.step).toFixed(4));
      number.parentElement.classList.remove('invalid');number.removeAttribute('aria-invalid');rebuild();
    });
    number.addEventListener('keydown',event=>{if(event.key==='Enter')number.blur();});
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  $('compareToggle').addEventListener('change',()=>{state.compare=$('compareToggle').checked;rebuild();if(state.view==='graph')renderer.graphCamera={x:0,y:0,zoom:1};});
  $('restorePreset').addEventListener('click',()=>selectPlanet(state.preset));
  $('play').addEventListener('click',()=>setPlaying(!state.playing));
  $('restart').addEventListener('click',()=>seek(0));
  $('stepBack').addEventListener('click',()=>seek(state.phase-0.01));$('stepForward').addEventListener('click',()=>seek(state.phase+0.01));
  $('phase').addEventListener('input',()=>seek(Number($('phase').value)/100));
  $('speed').addEventListener('change',()=>{state.speed=Number($('speed').value);});
  $('gridToggle').addEventListener('click',()=>toggleDisplay('grid','gridToggle'));
  $('trailToggle').addEventListener('click',()=>toggleDisplay('trail','trailToggle'));
  $('zoomIn').addEventListener('click',()=>{renderer.zoom(state.view,0.85);invalidate();});
  $('zoomOut').addEventListener('click',()=>{renderer.zoom(state.view,1/0.85);invalidate();});
  $('fit').addEventListener('click',fit);$('fullscreen').addEventListener('click',fullscreen);
  $('panelToggle').addEventListener('click',()=>togglePanel());$('closePanel').addEventListener('click',()=>togglePanel(false));
  $('help').addEventListener('click',()=>{$('helpDialog').showModal();});$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
  $('helpDialog').addEventListener('click',event=>{if(event.target===$('helpDialog')){const r=$('helpDialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('helpDialog').close();}});
  $('reset').addEventListener('click',()=>{
    setPlaying(false);state.phase=0;state.params.lat=30;state.compare=false;$('compareToggle').checked=false;
    state.speed=0.05;$('speed').value='0.05';
    for(const [key,id] of [['grid','gridToggle'],['trail','trailToggle']]){state[key]=true;$(id).classList.add('active');$(id).setAttribute('aria-pressed','true');}
    selectPlanet(earth);setView('sky');showToast('지구 기본 설정으로 초기화했습니다.');
  });
  const canvas=$('scene');
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragging={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointermove',event=>{if(!dragging||dragging.id!==event.pointerId)return;renderer.pan(state.view,event.clientX-dragging.x,event.clientY-dragging.y);dragging.x=event.clientX;dragging.y=event.clientY;invalidate();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{dragging=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();renderer.zoom(state.view,Math.exp(P.clamp(event.deltaY,-100,100)*0.0015));invalidate();},{passive:false});
  canvas.addEventListener('dblclick',fit);
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||$('helpDialog').open)return;
    if(event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    const key=event.key.toLowerCase();
    if(key===' '){if(event.target.closest('button,a,summary'))return;event.preventDefault();setPlaying(!state.playing);}
    else if(key==='r')fit();else if(key==='g')toggleDisplay('grid','gridToggle');else if(key==='t')toggleDisplay('trail','trailToggle');
    else if(key==='f')fullscreen();else if(key==='?')$('helpDialog').showModal();
    else if(['1','2','3'].includes(key))setView({1:'sky',2:'orbit',3:'graph'}[key]);
    else if(key==='+'||key==='='||key==='-'){event.preventDefault();renderer.zoom(state.view,key==='-'?1/0.85:0.85);invalidate();}
    else if(event.target===canvas&&key.startsWith('arrow')){event.preventDefault();renderer.pan(state.view,key==='arrowleft'?25:key==='arrowright'?-25:0,key==='arrowup'?25:key==='arrowdown'?-25:0);invalidate();}
  });
  document.addEventListener('visibilitychange',()=>{previousTime=0;if(!document.hidden)invalidate();});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'전체 화면 종료':'전체 화면');invalidate();});
  new ResizeObserver(invalidate).observe($('viewport'));
  document.fonts.ready.then(invalidate);
  togglePanel(window.innerWidth>800);selectPlanet(earth);setView('sky');
})();
