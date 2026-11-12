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
    constructor(canvas, inset) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.inset = inset; this.insetCtx = inset.getContext('2d');
      this.camera = { az: 180, alt: 43, fov: 90 };
      this.orbitCamera = { yaw: -0.38, pitch: 0.52, zoom: 1 };
      this.graphCamera = { x: 0, y: 0, zoom: 1 };
      // Decorative sky references are deterministic and do not represent a star catalog.
      let seed = 5927;
      const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      this.stars = Array.from({ length: 180 }, () => ({ ...direction(random() * 360, Math.asin(random()) / RAD), size: random() * 0.7 + 0.25 }));
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
      this.ctx.font = '11px KoPub, sans-serif';
      this.left = this.w < 500 ? 147 : this.w < 850 ? 180 : 205;
      this.right = this.w - 62;
      if (state.view === 'sky') this.sky();
      else if (state.view === 'orbit') this.orbit();
      else this.graph();
      if (this.inset.getBoundingClientRect().width > 0 && state.view !== 'orbit') this.drawInset();
    }

    skyProjection() {
      const { az, alt, fov } = this.camera;
      const forward = direction(az, alt);
      const right = { x: Math.cos(az * RAD), y: 0, z: -Math.sin(az * RAD) };
      const up = { x: -Math.sin(az * RAD) * Math.sin(alt * RAD), y: Math.cos(alt * RAD), z: -Math.cos(az * RAD) * Math.sin(alt * RAD) };
      const f = Math.min(this.h * 0.92, (this.right - this.left) * 2) / (2 * Math.tan(fov * RAD / 2));
      const cx = (this.left + this.right) / 2, cy = this.h * 0.54;
      const projectVector = v => {
        const z = dot(v, forward);
        if (z < 0.09) return null;
        return { x: cx + f * dot(v, right) / z, y: cy - f * dot(v, up) / z };
      };
      return { project: (azimuth, altitude) => projectVector(direction(azimuth, altitude)), projectVector, horizon: cy + f * Math.tan(alt * RAD), f };
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

    label(text, x, y, color = '#8294a6', align = 'left', font = '10px KoPub, sans-serif') {
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
      c.save(); c.globalAlpha = 0.22;
      for (const star of this.stars) {
        const q = projection.projectVector(star);
        if (q && q.x > 0 && q.x < w && q.y > 0 && q.y < Math.min(horizon, h)) circle(c, q.x, q.y, star.size, '#bccbd7');
      }
      c.restore();
      if (state.grid) {
        for (let alt = -60; alt <= 75; alt += 15) {
          const points = Array.from({ length: 361 }, (_, az) => ({ az, alt }));
          this.line(points, p => projection.project(p.az, p.alt), alt === 0 ? '#8399a455' : '#8099b11e');
          const q = projection.project(this.camera.az + 35, alt);
          if (q && q.y > 155 && q.y < h - 38 && q.x < w - 64) this.label(`${alt}°`, q.x + 4, q.y - 6, '#93a6b066');
        }
        for (let az = 0; az < 360; az += 30) {
          const points = Array.from({ length: 175 }, (_, i) => ({ az, alt: -85 + i }));
          this.line(points, p => projection.project(p.az, p.alt), '#8099b11e');
        }
      }
      if (horizon > 0 && horizon < h) {
        c.strokeStyle = '#91a0a14a'; c.beginPath(); c.moveTo(0, horizon); c.lineTo(w, horizon); c.stroke();
        this.label('지평선 · 0°', w - 22, horizon - 10, '#94a3a3', 'right');
      }
      for (const [az, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
        const q = projection.project(az, 0);
        if (q && q.x > 30 && q.x < w - 30 && q.y > 0 && q.y < h - 25) this.label(name, q.x, q.y + 22, '#c1ccc9', 'center', '12px Arial, sans-serif');
      }
      if (state.trail) {
        [...state.curves].reverse().forEach(curve => {
          const points = curve.points.concat(curve.points[0]);
          this.line(points, p => p.alt >= 0 ? projection.project(p.az, p.alt) : null, curve.color, curve.main ? 1.7 : 1, !curve.main);
          this.line(points, p => p.alt < 0 ? projection.project(p.az, p.alt) : null, curve.color + '88', 1, true);
          if (curve.main) {
            for (let j = 0; j < curve.points.length; j += 30) {
              const q = projection.project(curve.points[j].az, curve.points[j].alt);
              if (q) circle(c, q.x, q.y, 1.7, '#f0c98b');
            }
            for (let j = 0; j < 4; j++) {
              const p = curve.points[j * curve.points.length / 4], q = projection.project(p.az, p.alt);
              if (q && q.x > this.left && q.x < this.right - 20 && q.y > 145 && q.y < h - 85) this.label(`${j * 25}%`, q.x - 10, q.y - 8, '#c3b59b99', 'right', '9px Consolas, monospace');
            }
          }
        });
      }
      const sun = projection.project(state.current.az, state.current.alt);
      this.sunVisible = !!sun && sun.x > this.left && sun.x < this.right && sun.y > 135 && sun.y < h - 30;
      if (sun) this.sun(sun.x, sun.y, state.current.alt < 0, true);
    }

    sun(x, y, below = false, label = false) {
      const c = this.ctx;
      const halo = c.createRadialGradient(x, y, 2, x, y, 44);
      halo.addColorStop(0, below ? '#e7b66d28' : '#f6d9a159'); halo.addColorStop(0.25, '#e7b66d15'); halo.addColorStop(1, '#e7b66d00');
      c.fillStyle = halo; c.fillRect(x - 44, y - 44, 88, 88);
      circle(c, x, y, below ? 3.5 : 5.5, below ? GOLD : '#fff0cc');
      circle(c, x, y, 10, null, '#e7b66d55');
      if (label && x > this.left && x < this.right - 68 && y > 135 && y < this.h - 55) {
        c.strokeStyle = '#c7c2b374'; c.beginPath(); c.moveTo(x + 13, y - 4); c.lineTo(x + 30, y - 21); c.lineTo(x + 71, y - 21); c.stroke();
        this.label('태양', x + 33, y - 28, '#e6d7b8', 'left', '11px KoPub, sans-serif');
        this.label(`${this.state.current.alt.toFixed(2)}°`, x + 33, y - 7, '#a6b1bc', 'left', '10px Consolas, monospace');
      }
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
      if (state.trail) {
        this.line(points.concat(points[0]), project, '#7184986b', 1.2);
        for (let i = 0; i < points.length; i += 30) { const q = project(points[i]); circle(c, q.x, q.y, 1.3, '#8c9eaf88'); }
        const end = Math.floor(state.phase * points.length);
        this.line(points.slice(0, end + 1), project, '#d5b07a90', 1.5);
      }
      const planetPosition = this.orbitalPoint(state.current), q = project(planetPosition), s = project({ x: 0, y: 0, z: 0 });
      this.line([{ x: 0, y: 0, z: 0 }, planetPosition], project, '#d3ab6c50', 1, true);
      const glow = c.createRadialGradient(s.x, s.y, 3, s.x, s.y, 92);
      glow.addColorStop(0, '#f5bc6666'); glow.addColorStop(0.4, '#edaf5120'); glow.addColorStop(1, '#edaf5100');
      c.fillStyle = glow; c.fillRect(s.x - 92, s.y - 92, 184, 184);
      const sun = c.createRadialGradient(s.x - 5, s.y - 5, 0, s.x, s.y, 19);
      sun.addColorStop(0, '#fff4d4'); sun.addColorStop(0.75, '#f1cb83'); sun.addColorStop(1, '#bd843c');
      circle(c, s.x, s.y, 19, sun);
      this.label('태양', s.x, s.y + 38, '#c1ab88', 'center');
      const r = this.w < 500 ? 13 : 22;
      this.planet(c, q.x, q.y, r, state.preset, s.x - q.x, s.y - q.y);
      // The axis is fixed in inertial space; axial tilt affects both this and the sky model.
      const axis = { x: 0, y: Math.cos(state.params.eps * RAD), z: Math.sin(state.params.eps * RAD) };
      const projectedAxis = project({ x: planetPosition.x + axis.x, y: axis.y, z: planetPosition.z + axis.z });
      const length = Math.hypot(projectedAxis.x - q.x, projectedAxis.y - q.y) || 1;
      const dx = (projectedAxis.x - q.x) / length * (r + 22), dy = (projectedAxis.y - q.y) / length * (r + 22);
      c.strokeStyle = '#a4c4db99'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(q.x - dx, q.y - dy); c.lineTo(q.x + dx, q.y + dy); c.stroke(); c.setLineDash([]);
      this.label('N', q.x + dx + 5, q.y + dy - 4, '#aac5d5', 'left', '9px Arial, sans-serif');
      this.label(state.preset.name, q.x + r + 13, q.y - 4, '#d7e0e7', 'left', '13px KoPub, sans-serif');
      this.label(`ε ${state.params.eps.toFixed(2)}°`, q.x + r + 13, q.y + 13, '#7f94a8', 'left', '10px Consolas, monospace');
      for (const [phase, text] of [[0, '근일점'], [0.5, '원일점']]) {
        const p = project(this.orbitalPoint(P.position(state.params, phase)));
        circle(c, p.x, p.y, 3, '#0b1017', '#667c92');
        this.label(text, p.x, p.y + 20, '#8393a5', 'center');
      }
      this.label('공전면', this.right - 12, h - 78, '#586b7d', 'right');
      this.sunVisible = true;
    }

    planet(c, x, y, r, preset, lightX, lightY) {
      c.save(); circle(c, x, y, r, preset.color); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
      if (preset.id === 'earth') {
        c.fillStyle = '#618c78';
        for (const poly of [[[-.75,-.5],[-.25,-.72],[.05,-.3],[-.18,.05],[-.45,.0]],[[.1,-.38],[.65,-.15],[.4,.2],[.5,.55],[.15,.75],[-.03,.22]]]) {
          c.beginPath(); poly.forEach(([a,b],i) => i ? c.lineTo(x+a*r,y+b*r) : c.moveTo(x+a*r,y+b*r)); c.closePath(); c.fill();
        }
        c.fillStyle = '#d7e7e85e'; c.fillRect(x-r, y-r, r*2, r*.15);
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

    drawInset() {
      const c = this.insetCtx, {w,h} = this.size(this.inset,c), state = this.state;
      c.clearRect(0,0,w,h);
      const scale = w * 0.34 / (1 + state.params.ecc), cx=w*.5, cy=h*.51;
      const project = p => {const q=this.orbitalPoint(p);return {x:cx+q.x*scale,y:cy+q.z*scale*.58};};
      c.beginPath();state.curves[0].points.forEach((p,i)=>{const q=project(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();c.strokeStyle='#5e708255';c.stroke();
      const q=project(state.current);
      c.beginPath();c.moveTo(cx,cy);c.lineTo(q.x,q.y);c.strokeStyle='#d6b7843a';c.stroke();
      circle(c,cx,cy,4,'#e7c389');circle(c,q.x,q.y,4,state.preset.color);circle(c,q.x,q.y,7,null,'#adc8da44');
    }

    graph() {
      const c=this.ctx,{w,h,state}=this;
      c.fillStyle='#10171f';c.fillRect(0,0,w,h);
      const margin={left:this.left+20,right:w-72,top:this.w<500?210:175,bottom:h-87};
      if(margin.bottom-margin.top<60)margin.top=145;
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
      const spanX=Math.max(maxX-minX,6)*1.18/this.graphCamera.zoom,spanY=(naturalYHigh-naturalYLow)/this.graphCamera.zoom;
      const centerX=(minX+maxX)/2-this.graphCamera.x/width*spanX,centerY=(naturalYLow+naturalYHigh)/2+this.graphCamera.y/height*spanY;
      const xLow=centerX-spanX/2,yLow=centerY-spanY/2;
      const project=p=>({x:margin.left+(p.x-xLow)/spanX*width,y:margin.bottom-(p.alt-yLow)/spanY*height});
      const stepFor=span=>{const rough=span/5,power=10**Math.floor(Math.log10(rough));return [1,2,5,10].find(n=>n*power>=rough)*power;};
      const xStep=stepFor(spanX),yStep=stepFor(spanY);
      if(state.grid){
        for(let x=Math.ceil(xLow/xStep)*xStep;x<=xLow+spanX;x+=xStep){const q=project({x,alt:0});this.line([{x:q.x,y:margin.top},{x:q.x,y:margin.bottom}],p=>p,'#7591ac1a');this.label(`${Math.round(((x%360)+360)%360)}°`,q.x,margin.bottom+20,'#8295a9','center','10px Consolas, monospace');}
        for(let y=Math.ceil(yLow/yStep)*yStep;y<=yLow+spanY;y+=yStep){const q=project({x:0,alt:y});this.line([{x:margin.left,y:q.y},{x:margin.right,y:q.y}],p=>p,'#7591ac1a');this.label(`${y.toFixed(yStep<1?1:0)}°`,margin.left-10,q.y+3,'#8295a9','right','10px Consolas, monospace');}
      }
      this.label('고도',margin.left,margin.top-16,'#9bafc0');this.label('방위각 (북 = 0°)',margin.right,margin.bottom+39,'#9bafc0','right');
      c.save();c.beginPath();c.rect(margin.left,margin.top,width,height);c.clip();
      const horizon=project({x:0,alt:0}).y;
      if(horizon<margin.bottom){c.fillStyle='#574b3822';c.fillRect(margin.left,Math.max(horizon,margin.top),width,height);this.line([{x:margin.left,y:horizon},{x:margin.right,y:horizon}],p=>p,'#b39b6b66',1,true);}
      if(state.trail) [...series].reverse().forEach(s=>{
        const points = Math.abs(s.points[0].x-s.points.at(-1).x)<180 ? s.points.concat(s.points[0]) : s.points;
        this.line(points,project,s.color,s.main?1.8:1,!s.main);
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
