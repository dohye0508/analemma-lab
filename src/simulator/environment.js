(function(root) {
  'use strict';
  const RAD = Math.PI / 180;
  const settings = { image: 'atacama', rotate: .57, exposure: .60, span: 120.2, top: 90 };
  const sources = {
    atacama: { file: 'atacama.jpg', credit: 'ESO/B. Tafreshi', url: 'https://www.eso.org/public/images/uhd_img2563pv2_cc_eq/' },
    galaxy: { file: 'milky-way.jpg', credit: 'ESO/S. Brunier', url: 'https://www.eso.org/public/images/eso0932a/' },
    hilly_terrain_01: { file:'hilly_terrain_01.jpg', credit:'Poly Haven', license:'CC0', url:'https://polyhaven.com/a/hilly_terrain_01' },
    kloppenheim_03: { file:'kloppenheim_03.jpg', credit:'Poly Haven', license:'CC0', url:'https://polyhaven.com/a/kloppenheim_03' },
    spruit_sunrise: { file:'spruit_sunrise.jpg', credit:'Poly Haven', license:'CC0', url:'https://polyhaven.com/a/spruit_sunrise' },
    forest_slope: { file:'forest_slope.jpg', credit:'Poly Haven', license:'CC0', url:'https://polyhaven.com/a/forest_slope' },
    snowy_park_01: { file:'snowy_park_01.jpg', credit:'Poly Haven', license:'CC0', url:'https://polyhaven.com/a/snowy_park_01' },
    earth: { file: 'earth.jpg', credit: 'Solar System Scope', url: 'https://www.solarsystemscope.com/textures/' }
  };
  const defaults = { background:'atacama', brightness:100, rotation:0 };
  let preferences = { ...defaults };
  function validated(value) {
    return { background:["atacama","hilly_terrain_01","kloppenheim_03","spruit_sunrise","forest_slope","snowy_park_01"].includes(value.background) ? value.background : 'atacama',
      brightness:Number.isFinite(Number(value.brightness)) ? Math.max(30,Math.min(140,Number(value.brightness))) : 100,
      rotation:Number.isFinite(Number(value.rotation)) ? Math.max(0,Math.min(360,Number(value.rotation))) : 0 };
  }
  try { preferences = validated(JSON.parse(localStorage.getItem('analemma-environment')) || defaults); } catch {}
  const images = {};
  const initial = new Set([preferences.background,'earth','galaxy']);
  let pending = initial.size;
  for (const [key, source] of Object.entries(sources)) {
    const img = new Image();
    images[key] = img;
    img.onload = img.onerror = () => {
      if (initial.has(key) && !--pending) document.documentElement.dataset.environment = 'ready';
      root.dispatchEvent(new Event('environmentready'));
    };
    if(initial.has(key)) img.src = 'assets/' + source.file;
  }
  const vertex = 'attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}';
  const fragment = [
    'precision highp float;',
    'uniform vec2 u_size; uniform vec2 u_center; uniform float u_focal;',
    'uniform vec2 u_camera; uniform float u_rotate; uniform vec2 u_range;',
    'uniform float u_exposure; uniform sampler2D u_image;',
    'void main(){',
    'vec2 p=vec2(gl_FragCoord.x,u_size.y-gl_FragCoord.y);',
    'float az=u_camera.x, alt=u_camera.y;',
    'vec3 forward=vec3(sin(az)*cos(alt),sin(alt),cos(az)*cos(alt));',
    'vec3 right=vec3(cos(az),0.0,-sin(az));',
    'vec3 up=vec3(-sin(az)*sin(alt),cos(alt),-cos(az)*sin(alt));',
    'vec3 ray=normalize(forward+(p.x-u_center.x)/u_focal*right+(u_center.y-p.y)/u_focal*up);',
    'float u=fract(atan(ray.x,ray.z)/6.2831853+u_rotate);',
    'float v=(u_range.x-asin(clamp(ray.y,-1.0,1.0)))/u_range.y;',
    'vec3 photo=texture2D(u_image,vec2(u,clamp(v,.001,.999))).rgb;',
    'float bounds=smoothstep(-.04,.01,v)*(1.0-smoothstep(.99,1.05,v));',
    'photo=pow(photo,vec3(1.06))*u_exposure;',
    'float edge=1.0-.17*pow(length((p/u_size-.5)*1.25),2.0);',
    'gl_FragColor=vec4(mix(vec3(.008,.012,.021),photo,bounds)*edge,1.0);',
    '}'
  ].join('\n');
  function shader(gl, type, source) {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  class NightEnvironment {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.cache = '';
      this.textures = new Map();
      try {
        const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
        if (!gl) return;
        this.gl = gl;
        const program = gl.createProgram();
        gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vertex));
        gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fragment));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        this.program = program; gl.useProgram(program);
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const a = gl.getAttribLocation(program,'a_position');
        gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
        this.uniform = {};
        for (const name of ['size','center','focal','camera','rotate','range','exposure','image']) this.uniform[name]=gl.getUniformLocation(program,'u_'+name);
        this.canvas.addEventListener('webglcontextlost', e=>{ e.preventDefault(); this.gl=null; this.cache=''; root.dispatchEvent(new Event('environmentready')); });
      } catch {
        this.gl = null;
      }
    }
    render(ctx, w, h, projection, camera, orbit = false) {
      const key = orbit ? 'galaxy' : preferences.background;
      const img = images[key];
      if(!img.getAttribute('src')) img.src = 'assets/'+sources[key].file;
      if (!img.complete || !img.naturalWidth) return false;
      const cfg = { ...(orbit ? { rotate:.08, exposure:.24, top:90, span:180 } : key === 'atacama' ? settings : { rotate:.5, exposure:1, top:90, span:180 }) };
      cfg.exposure *= preferences.brightness / 100;
      cfg.rotate += preferences.rotation / 360;
      const cache = [key,cfg.exposure,cfg.rotate,w,h,projection.cx,projection.cy,projection.f,camera.az,camera.alt].join(':');
      const gl = this.gl;
      if (!gl) {
        const scale = Math.max(w/img.width, h/img.height);
        ctx.save();
        ctx.globalAlpha = cfg.exposure;
        ctx.drawImage(img, (w-img.width*scale)/2, (h-img.height*scale)/2, img.width*scale,img.height*scale);
        ctx.restore();
        return true;
      }
      try {
        if (this.cache !== cache) {
          this.canvas.width=Math.round(w);this.canvas.height=Math.round(h);
          gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);
          let texture = this.textures.get(key);
          if (!texture) {
            texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
            const limit=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
            let textureSource=img;
            if(Math.max(img.width,img.height)>limit) {
              const buffer=document.createElement('canvas'), scale=limit/Math.max(img.width,img.height);
              buffer.width=Math.round(img.width*scale);buffer.height=Math.round(img.height*scale);
              buffer.getContext('2d').drawImage(img,0,0,buffer.width,buffer.height);textureSource=buffer;
            }
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureSource);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            this.textures.set(key,texture);
          } else gl.bindTexture(gl.TEXTURE_2D,texture);
          const u=this.uniform;
          gl.uniform2f(u.size,w,h);gl.uniform2f(u.center,projection.cx,projection.cy);
          gl.uniform1f(u.focal,projection.f);gl.uniform2f(u.camera,camera.az*RAD,camera.alt*RAD);
          gl.uniform1f(u.rotate,cfg.rotate);gl.uniform2f(u.range,cfg.top*RAD,cfg.span*RAD);
          gl.uniform1f(u.exposure,cfg.exposure);gl.uniform1i(u.image,0);
          gl.drawArrays(gl.TRIANGLES,0,6);
          this.cache=cache;
        }
        ctx.drawImage(this.canvas,0,0,w,h);
      } catch {
        this.gl=null;
        return this.render(ctx,w,h,projection,camera,orbit);
      }
      return true;
    }
    static updateCredit(view) {
      const source = sources[view === 'orbit' ? 'galaxy' : preferences.background];
      const el = document.getElementById('photoCredit');
      if (el) { el.hidden=!source; if(source) { el.href=source.url; el.textContent=source.credit+' · '+(source.license || 'CC BY 4.0'); } }
      const details = document.getElementById('photoDetails');
      if (details) details.textContent=source ? '사진: '+source.credit+'. 밝기 조정 및 구면 투영을 적용했습니다.' : '단색 하늘과 지평선을 표시합니다.';
    }
    static get ready() { const image=images[preferences.background];return image.complete && image.naturalWidth>0; }
    static get preferences() { return { ...preferences }; }
    static configure(next) {
      preferences = validated({ ...preferences, ...next });
      try { localStorage.setItem('analemma-environment',JSON.stringify(preferences)); } catch {}
      root.dispatchEvent(new Event('environmentready'));
    }
    static reset() { this.configure(defaults); }
    static get earth() { return images.earth; }
  }
  root.NightEnvironment=NightEnvironment;
})(window);
