(function (root) {
  'use strict';
  const P = root.AnalemmaPhysics;
  const { RAD, TAU, clamp } = P;
  const GOLD = '#e7b66d';
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  function direction(az, alt) {
    const a = az * RAD, h = alt * RAD;
    return { x: Math.sin(a) * Math.cos(h), y: Math.sin(h), z: Math.cos(a) * Math.cos(h) };
  }
  function circle(ctx, x, y, radius, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  class Renderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.compact = Boolean(options.compact);
      this.plot = Boolean(options.plot);
      if (!this.plot) this.environment = new root.NightEnvironment();
      this.camera = { az: 180, alt: 43, fov: 90 };
      this.orbitCamera = { yaw: -0.38, pitch: 0.52, zoom: 1 };
      this.graphCamera = { x: 0, y: 0, zoom: 1 };
    }

    size(canvas, ctx) {
      const box = canvas.getBoundingClientRect();
      const w = Math.max(1, box.width), h = Math.max(1, box.height);
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    fit(state) {
      const points = state.curves[0].points;
      const vectors = points.map(p => direction(p.az, p.alt));
      const sum = vectors.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, z: a.z + v.z }), { x: 0, y: 0, z: 0 });
      const length = Math.hypot(sum.x, sum.y, sum.z) || 1;
      const az = Math.atan2(sum.x, sum.z) / RAD;
      const alt = Math.asin(clamp(sum.y / length, -1, 1)) / RAD;
      this.camera = { az, alt: clamp(alt - 20, -45, 55), fov: state.compare ? 112 : 94 };
      this.orbitCamera = { yaw: -0.38, pitch: 0.52, zoom: 1 };
      this.graphCamera = { x: 0, y: 0, zoom: 1 };
    }

    zoom(view, factor) {
      if (view === 'sky') this.camera.fov = clamp(this.camera.fov * factor, 15, 125);
      if (view === 'orbit') this.orbitCamera.zoom = clamp(this.orbitCamera.zoom / factor, 0.4, 3);
      if (view === 'graph') this.graphCamera.zoom = clamp(this.graphCamera.zoom / factor, 0.4, 12);
    }

    focusSun(state) {
      const sun = P.position(state.params, state.phase);
      this.camera.az = sun.az;
      this.camera.alt = clamp(sun.alt, -80, 85);
    }

    pan(view, dx, dy) {
      if (view === 'sky') {
        this.camera.az -= dx * this.camera.fov / Math.max(this.w, 300);
        this.camera.alt = clamp(this.camera.alt + dy * this.camera.fov / Math.max(this.h, 300), -80, 85);
      } else if (view === 'orbit') {
        this.orbitCamera.yaw += dx * 0.006;
        this.orbitCamera.pitch = clamp(this.orbitCamera.pitch + dy * 0.005, 0.12, 1.48);
      } else {
        this.graphCamera.x += dx; this.graphCamera.y += dy;
      }
    }

    draw(state) {
      const size = this.size(this.canvas, this.ctx); this.w = size.w; this.h = size.h;
      this.state = state;
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.ctx.lineWidth = 1; this.ctx.setLineDash([]);
      this.ctx.font = '14px Pretendard, sans-serif';
      const layout = !this.compact && !this.plot ? getComputedStyle(document.documentElement) : null;
      this.left = layout ? parseFloat(layout.getPropertyValue('--scene-left')) : 0;
      this.right = this.w - (layout ? 20 : 0);
      this.safeTop = layout ? parseFloat(layout.getPropertyValue('--scene-top')) : 8;
      this.safeBottom = layout ? parseFloat(layout.getPropertyValue('--scene-bottom')) : 8;
      if (state.view === 'sky') this.sky();
      else if (state.view === 'orbit') this.orbit();
      else this.graph();
    }

    skyProjection() {
      const { az, alt, fov } = this.camera;
      const forward = direction(az, alt);
      const right = { x: Math.cos(az * RAD), y: 0, z: -Math.sin(az * RAD) };
      const up = { x: -Math.sin(az * RAD) * Math.sin(alt * RAD), y: Math.cos(alt * RAD), z: -Math.cos(az * RAD) * Math.sin(alt * RAD) };
      const availableHeight = Math.max(90, this.h - this.safeTop - this.safeBottom);
      const f = Math.min(availableHeight * 1.02, (this.right - this.left) * 2) / (2 * Math.tan(fov * RAD / 2));
      const cx = (this.left + this.right) / 2, cy = this.safeTop + availableHeight * 0.5;
      const projectVector = v => {
        const z = dot(v, forward);
        if (z < 0.09) return null;
        return { x: cx + f * dot(v, right) / z, y: cy - f * dot(v, up) / z };
      };
      return { project: (azimuth, altitude) => projectVector(direction(azimuth, altitude)), projectVector, horizon: cy + f * Math.tan(alt * RAD), f, cx, cy };
    }

    line(points, project, color, width = 1, dashed = false) {
      const c = this.ctx;
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dashed ? [4, 5] : []); c.beginPath();
      let previous = null;
      for (const point of points) {
        const q = project(point);
        if (!q || !Number.isFinite(q.x + q.y)) { previous = null; continue; }
        if (!previous || (points.length > 2 && Math.hypot(q.x - previous.x, q.y - previous.y) > Math.max(this.w, this.h) * 0.7)) c.moveTo(q.x, q.y);
        else c.lineTo(q.x, q.y);
        previous = q;
      }
      c.stroke(); c.setLineDash([]);
    }

    depthTrail(points, project, color, width, dashed) {
      const c=this.ctx, current=direction(this.state.current.az,this.state.current.alt);
      const projected=points.map(project);
      // Quantized opacity keeps a continuous trajectory while batching strokes.
      const buckets=Array.from({length:8},()=>[]);
      for(let i=1;i<points.length;i++) {
        const a=projected[i-1],b=projected[i];
        if(!a||!b||Math.hypot(b.x-a.x,b.y-a.y)>Math.max(this.w,this.h)*.7)continue;
        const angle=Math.acos(clamp(dot(current,direction(points[i].az,points[i].alt)),-1,1));
        buckets[Math.min(7,Math.floor(angle/(60*RAD)*8))].push([a,b]);
      }
      c.save();c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';
      if(root.NightEnvironment.preferences.background !== 'atacama') { c.shadowColor='#0009'; c.shadowBlur=3; }
      c.setLineDash(dashed?[4,5]:[]);
      buckets.forEach((segments,index)=>{c.globalAlpha=1-.35*index/7;c.beginPath();for(const [a,b] of segments){c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);}c.stroke();});
      c.restore();
    }

    label(text, x, y, color = '#a0b0c3', align = 'left', font = '14px Pretendard, sans-serif') {
      const c = this.ctx;
      c.font = font; c.textAlign = align; c.fillStyle = color; c.fillText(text, x, y); c.textAlign = 'left';
    }

    sky() {
      const c = this.ctx, { w, h, state } = this;
      const projection = this.skyProjection(); this.projection = projection;
      const horizon = projection.horizon;
      const skyFill = c.createLinearGradient(0, 0, 0, Math.max(h * 0.6, Math.min(h * 1.3, horizon)));
      skyFill.addColorStop(0, '#080e18'); skyFill.addColorStop(0.55, '#142536'); skyFill.addColorStop(1, '#36464f');
      c.fillStyle = skyFill; c.fillRect(0, 0, w, h);
      if (horizon < h) {
        const ground = c.createLinearGradient(0, Math.max(0, horizon), 0, h);
        ground.addColorStop(0, '#1a2427'); ground.addColorStop(1, '#11181b');
        c.fillStyle = ground; c.fillRect(0, Math.max(0, horizon), w, h);
      }
      const photographic = this.environment.render(c,w,h,projection,this.camera);
      if (state.grid) {
        for (let alt = -60; alt <= 75; alt += 15) {
          const points = Array.from({ length: 361 }, (_, az) => ({ az, alt }));
          this.line(points, p => projection.project(p.az, p.alt), alt === 0 ? '#8399a455' : '#8099b11e');
          const q = projection.project(this.camera.az + 35, alt);
          if (!this.compact && alt % 30 === 0 && q && q.y > this.safeTop && q.y < h - 38 && q.x < w - 40) this.label(`${alt}°`, q.x + 4, q.y - 9, '#97adbd');
        }
        for (let az = 0; az < 360; az += 30) {
          const points = Array.from({ length: 175 }, (_, i) => ({ az, alt: -85 + i }));
          this.line(points, p => projection.project(p.az, p.alt), '#8099b11e');
        }
      }
      if ((!photographic || state.grid) && horizon > 0 && horizon < h) {
        c.strokeStyle = '#91a0a14a'; c.beginPath(); c.moveTo(0, horizon); c.lineTo(w, horizon); c.stroke();
      }
      for (const [az, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
        const q = projection.project(az, 0);
        if (!this.compact && q && q.x > 30 && q.x < w - 30 && q.y > this.safeTop && q.y < h - 25) this.label(name, q.x, q.y + 25, '#bdc9d3', 'center', '16px Pretendard, sans-serif');
      }
      if (state.trail) {
        [...state.curves].reverse().forEach(curve => {
          const points = curve.points.concat(curve.points[0]);
          const width = this.compact ? 1.4 : curve.main ? 2.5 : 1.6;
          (curve.main ? this.depthTrail : this.line).call(this, points, p => p.alt >= 0 ? projection.project(p.az, p.alt) : null, curve.color, width, !curve.main);
          this.line(points, p => p.alt < 0 ? projection.project(p.az, p.alt) : null, curve.color + 'aa', width, true);
          if(curve.main && !this.compact) for(let step=0;step<4;step++) { const p=curve.points[Math.floor(step*curve.points.length/4)];const q=projection.project(p.az,p.alt);if(q) { c.save();c.globalAlpha=.5;circle(c,q.x,q.y,2,curve.color);c.restore(); } }
        });
      }
      const sun = projection.project(state.current.az, state.current.alt);
      this.sunVisible = !!sun && sun.x > this.left && sun.x < this.right && sun.y > this.safeTop && sun.y < h - 30;
      if (sun) {
        this.sun(sun.x, sun.y, state.current.alt < 0);
        if (!this.compact) { c.save();c.shadowColor='#000';c.shadowBlur=5;this.label('태양',sun.x+19,sun.y-12,'#f1d5a8','left','13px Pretendard,sans-serif');c.restore(); }
      }
    }

    sun(x, y, below = false) {
      const c = this.ctx;
      const radius = this.compact ? 20 : 45;
      const halo = c.createRadialGradient(x, y, 2, x, y, radius);
      halo.addColorStop(0, below ? '#e7b66d28' : '#f6d9a159'); halo.addColorStop(0.25, '#e7b66d15'); halo.addColorStop(1, '#e7b66d00');
      c.fillStyle = halo; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      circle(c, x, y, this.compact ? 3 : below ? 5 : 8, below ? GOLD : '#fff0cc');
      circle(c, x, y, this.compact ? 6 : 13, null, '#e7b66d55');
    }

    orbitalPoint(point) {
      const angle = this.state.params.peri * RAD;
      // Sun-centered position: opposite the geocentric solar longitude.
      return { x: -(point.orbitX * Math.cos(angle) - point.orbitY * Math.sin(angle)), y: 0,
        z: -(point.orbitX * Math.sin(angle) + point.orbitY * Math.cos(angle)) };
    }

    orbit() {
      const { ctx: c, w, h, state } = this;
      c.fillStyle = '#090d13'; c.fillRect(0, 0, w, h);
      if (!this.compact) this.environment.render(c,w,h,{cx:w/2,cy:h/2,f:h*.65},{az:this.orbitCamera.yaw/RAD+180,alt:10},true);
      const camera = this.orbitCamera;
      const cx = (this.left + this.right) / 2, cy = h * 0.56;
      const scale = Math.min((this.right - this.left) * 0.37, h * 0.37) * camera.zoom / (1 + state.params.ecc);
      const project = p => ({ x: cx + (p.x * Math.cos(camera.yaw) - p.z * Math.sin(camera.yaw)) * scale,
        y: cy - (p.y * Math.cos(camera.pitch) - (p.x * Math.sin(camera.yaw) + p.z * Math.cos(camera.yaw)) * Math.sin(camera.pitch)) * scale });
      if (state.grid) {
        for (let i = -8; i <= 8; i++) {
          const t = i / 4;
          this.line([{ x: t, y: 0, z: -2 }, { x: t, y: 0, z: 2 }], project, i === 0 ? '#65819e32' : '#607c9815');
          this.line([{ x: -2, y: 0, z: t }, { x: 2, y: 0, z: t }], project, i === 0 ? '#65819e32' : '#607c9815');
        }
      }
      const points = state.curves[0].points.map(p => this.orbitalPoint(p));
      const depths = points.map(p => p.x * Math.sin(camera.yaw) + p.z * Math.cos(camera.yaw));
      const near = Math.max(...depths), far = Math.min(...depths);
      const orbitLine = (path, color, width) => {
        c.save();
        for (let i = 1; i < path.length; i++) {
          const p = path[i], depth = p.x * Math.sin(camera.yaw) + p.z * Math.cos(camera.yaw);
          c.globalAlpha = 1 - .35 * (near - depth) / Math.max(.001, near - far);
          this.line([path[i - 1], p], project, color, width);
        }
        c.restore();
      };
      if (state.trail) {
        orbitLine(points.concat(points[0]), '#8fa2bba0', this.compact ? 1.3 : 1.8);
        const end = Math.floor(state.phase * points.length);
        orbitLine(points.slice(0, end + 1), '#d5b07a90', 1.5);
      }
      const planetPosition = this.orbitalPoint(state.current), q = project(planetPosition), s = project({ x: 0, y: 0, z: 0 });
      this.line([{ x: 0, y: 0, z: 0 }, planetPosition], project, '#d3ab6c50', 1, true);
      const sunRadius = this.compact ? 8 : 25;
      const glowRadius = this.compact ? 34 : 100;
      const glow = c.createRadialGradient(s.x, s.y, 3, s.x, s.y, glowRadius);
      glow.addColorStop(0, '#f5bc6666'); glow.addColorStop(0.4, '#edaf5120'); glow.addColorStop(1, '#edaf5100');
      c.fillStyle = glow; c.fillRect(s.x - glowRadius, s.y - glowRadius, glowRadius * 2, glowRadius * 2);
      const sun = c.createRadialGradient(s.x - sunRadius / 4, s.y - sunRadius / 4, 0, s.x, s.y, sunRadius);
      sun.addColorStop(0, '#fff4d4'); sun.addColorStop(0.75, '#f1cb83'); sun.addColorStop(1, '#bd843c');
      circle(c, s.x, s.y, sunRadius, sun);
      const r = this.compact ? 9 : this.w < 500 ? 20 : 28;
      this.planet(c, q.x, q.y, r, state.preset, s.x - q.x, s.y - q.y);
      // The axis is fixed in inertial space; axial tilt affects both this and the sky model.
      const axis = { x: 0, y: Math.cos(state.params.eps * RAD), z: Math.sin(state.params.eps * RAD) };
      const projectedAxis = project({ x: planetPosition.x + axis.x, y: axis.y, z: planetPosition.z + axis.z });
      const length = Math.hypot(projectedAxis.x - q.x, projectedAxis.y - q.y) || 1;
      const axisLength = r + (this.compact ? 9 : 28);
      const dx = (projectedAxis.x - q.x) / length * axisLength, dy = (projectedAxis.y - q.y) / length * axisLength;
      c.strokeStyle = '#a4c4db99'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(q.x - dx, q.y - dy); c.lineTo(q.x + dx, q.y + dy); c.stroke(); c.setLineDash([]);
      if (!this.compact) this.label('N', q.x + dx + 6, q.y + dy - 4, '#b7cddd', 'left', '14px Pretendard, sans-serif');
      if (state.grid && !this.compact) for (const [phase, text] of [[0, '근일점'], [0.5, '원일점']]) {
        const p = project(this.orbitalPoint(P.position(state.params, phase)));
        circle(c, p.x, p.y, 3, '#0b1017', '#667c92');
        this.label(text, p.x, p.y + 20, '#8393a5', 'center');
      }
      this.sunVisible = true;
    }

    planet(c, x, y, r, preset, lightX, lightY) {
      c.save(); circle(c, x, y, r, preset.color); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
      if (preset.id === 'earth') {
        const texture = root.NightEnvironment.earth;
        if (texture.complete && texture.naturalWidth) {
          c.drawImage(texture,texture.width*.38,texture.height*.12,texture.width*.32,texture.height*.76,x-r,y-r,r*2,r*2);
        } else {
        c.fillStyle = '#618c78';
        for (const poly of [[[-.75,-.5],[-.25,-.72],[.05,-.3],[-.18,.05],[-.45,.0]],[[.1,-.38],[.65,-.15],[.4,.2],[.5,.55],[.15,.75],[-.03,.22]]]) {
          c.beginPath(); poly.forEach(([a,b],i) => i ? c.lineTo(x+a*r,y+b*r) : c.moveTo(x+a*r,y+b*r)); c.closePath(); c.fill();
        }
        c.fillStyle = '#d7e7e85e'; c.fillRect(x-r, y-r, r*2, r*.15);
        }
      } else if (['jupiter','saturn','venus'].includes(preset.id)) {
        c.fillStyle = '#684b362b';
        for (let band = -0.6; band < 1; band += 0.38) c.fillRect(x-r, y+band*r, 2*r, r*.17);
      }
      const n = Math.hypot(lightX, lightY) || 1;
      const shading = c.createLinearGradient(x+lightX/n*r,y+lightY/n*r,x-lightX/n*r,y-lightY/n*r);
      shading.addColorStop(0,'#ffffff30'); shading.addColorStop(.35,'#00000000'); shading.addColorStop(.78,'#030810b9'); shading.addColorStop(1,'#030810f5');
      c.fillStyle=shading;c.fillRect(x-r,y-r,2*r,2*r); c.restore();
      if (preset.id === 'saturn') { c.strokeStyle='#c4b58a8a';c.lineWidth=4;c.beginPath();c.ellipse(x,y,r*1.7,r*.35,-.35,0,TAU);c.stroke();c.lineWidth=1; }
      circle(c,x,y,r,null,'#a4c9e033');
    }

    graph() {
      const c=this.ctx,{w,h,state}=this;
      c.fillStyle='#141b24';c.fillRect(0,0,w,h);
      const margin={left:this.left+(w<700?44:66),right:w-(w<700?24:80),top:this.safeTop+(state.compare?74:42),bottom:h-this.safeBottom-58};
      const width=Math.max(50,margin.right-margin.left),height=Math.max(80,margin.bottom-margin.top);
      const mainAz=P.unwrap(state.curves[0].points.map(p=>p.az));
      const mainCenter=mainAz.reduce((a,b)=>a+b,0)/mainAz.length;
      const series=state.curves.map(curve=>{
        const az=P.unwrap(curve.points.map(p=>p.az));
        const center=az.reduce((a,b)=>a+b,0)/az.length;
        const offset=Math.round((mainCenter-center)/360)*360;
        return {...curve,points:curve.points.map((p,i)=>({...p,x:az[i]+offset}))};
      });
      const all=series.flatMap(s=>s.points);
      const minX=Math.min(...all.map(p=>p.x)), maxX=Math.max(...all.map(p=>p.x));
      const minY=Math.min(...all.map(p=>p.alt)), maxY=Math.max(...all.map(p=>p.alt));
      const yPadding=Math.max((maxY-minY)*0.09,3);
      const naturalYLow=Math.max(-90,minY-yPadding),naturalYHigh=Math.min(90,maxY+yPadding);
      const unitsPerPixel=Math.max(Math.max(maxX-minX,6)*1.18/width,Math.max(naturalYHigh-naturalYLow,6)/height);
      const spanX=unitsPerPixel*width/this.graphCamera.zoom,spanY=unitsPerPixel*height/this.graphCamera.zoom;
      const centerX=(minX+maxX)/2-this.graphCamera.x/width*spanX,centerY=(naturalYLow+naturalYHigh)/2+this.graphCamera.y/height*spanY;
      const xLow=centerX-spanX/2,yLow=centerY-spanY/2;
      const project=p=>({x:margin.left+(p.x-xLow)/spanX*width,y:margin.bottom-(p.alt-yLow)/spanY*height});
      const stepFor=(span,pixels,spacing)=>{const rough=span/Math.max(3,Math.floor(pixels/spacing)),power=10**Math.floor(Math.log10(rough));return [1,2,5,10].find(n=>n*power>=rough)*power;};
      const xStep=stepFor(spanX,width,95),yStep=stepFor(spanY,height,64);
      if(state.grid){
        for(let x=Math.ceil(xLow/xStep)*xStep;x<=xLow+spanX;x+=xStep){const q=project({x,alt:0});this.line([{x:q.x,y:margin.top},{x:q.x,y:margin.bottom}],p=>p,'#7591ac26');this.label(`${Number((((x%360)+360)%360).toFixed(Math.max(0,-Math.floor(Math.log10(xStep)))))}°`,q.x,margin.bottom+22,'#a4b5ca','center','13px Pretendard, sans-serif');}
        for(let y=Math.ceil(yLow/yStep)*yStep;y<=yLow+spanY;y+=yStep){const q=project({x:0,alt:y});this.line([{x:margin.left,y:q.y},{x:margin.right,y:q.y}],p=>p,'#7591ac26');this.label(`${y.toFixed(yStep<1?1:0)}°`,margin.left-10,q.y+4,'#a4b5ca','right','13px Pretendard, sans-serif');}
      }
      this.label('고도 (°)',margin.left,margin.top-20,'#b9c8db');this.label('방위각 (°)',(margin.left+margin.right)/2,margin.bottom+48,'#b9c8db','center');
      c.save();c.beginPath();c.rect(margin.left,margin.top,width,height);c.clip();
      const horizon=project({x:0,alt:0}).y;
      if(horizon<margin.bottom){c.fillStyle='#574b3822';c.fillRect(margin.left,Math.max(horizon,margin.top),width,height);this.line([{x:margin.left,y:horizon},{x:margin.right,y:horizon}],p=>p,'#b39b6b66',1,true);}
      if(state.trail) [...series].reverse().forEach(s=>{
        const points = Math.abs(s.points[0].x-s.points.at(-1).x)<180 ? s.points.concat(s.points[0]) : s.points;
        this.line(points,project,s.color,s.main?2.2:1.5,!s.main);
      });
      const sampleIndex=Math.min(mainAz.length-1,Math.floor((state.phase%1)*mainAz.length));
      const currentX=state.current.az+Math.round((mainAz[sampleIndex]-state.current.az)/360)*360;
      const q=project({x:currentX,alt:state.current.alt});
      this.line([{x:q.x,y:margin.top},{x:q.x,y:margin.bottom}],p=>p,'#e7b66d1a',1,true);
      this.sun(q.x,q.y,state.current.alt<0,false);c.restore();
      this.sunVisible=q.x>=margin.left&&q.x<=margin.right&&q.y>=margin.top&&q.y<=margin.bottom;
    }
  }
  root.AnalemmaRenderer=Renderer;
})(globalThis);
