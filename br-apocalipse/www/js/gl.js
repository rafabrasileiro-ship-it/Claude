'use strict';
/* Núcleo WebGL 1 do motor 3D: contexto, programas, malhas, texturas e matrizes.
   Tudo guarda a "receita" do lado da CPU: se o Android descartar o contexto (app em segundo plano), os recursos são refeitos sozinhos. */
const GL3 = (() => {
  let gl = null, cv = null, gen = 0, lost = false, curProg = null, boundMesh = null;
  const ext = { inst: null, aniso: null, anisoMax: 0, highp: false };
  // layout fixo dos vértices: posição(3) normal(3) uv(2) cor(3) extra(2: osso, material) = 13 floats
  const STRIDE = 13, SB = STRIDE * 4;
  const ATTR = ['aPos', 'aNor', 'aUV', 'aCol', 'aExt', 'iA', 'iB'];

  function init(canvas) {
    cv = canvas;
    const o = { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    try { gl = cv.getContext('webgl', o) || cv.getContext('experimental-webgl', o); } catch (e) { gl = null; }
    if (!gl) return false;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; }, false);
    cv.addEventListener('webglcontextrestored', () => { lost = false; setup(); }, false);
    setup();
    return true;
  }
  function setup() {
    gen++; curProg = null; boundMesh = null;
    ext.inst = gl.getExtension('ANGLE_instanced_arrays');
    ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    ext.anisoMax = ext.aniso ? Math.min(8, gl.getParameter(ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 0) : 0;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); ext.highp = !!(hp && hp.precision > 0);
    ext.maxVU = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 128;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  /* ---------- programas ---------- */
  function Program(vs, fs, defs) { this.vs = vs; this.fs = fs; this.defs = defs || []; this.gen = -1; this.p = null; this.u = {}; this.a = {}; }
  Program.prototype.use = function () {
    if (this.gen !== gen) compile(this);
    if (curProg !== this) { gl.useProgram(this.p); curProg = this; }
    return this;
  };
  function compile(P) {
    const head = P.defs.map(d => '#define ' + d + '\n').join('');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error('GLSL: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, head + P.vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, (ext.highp ? 'precision highp float;\n' : 'precision mediump float;\n') + head + P.fs));
    ATTR.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('GL link: ' + gl.getProgramInfoLog(p));
    P.p = p; P.u = {}; P.gen = gen;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); P.u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
    P.used = {}; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES) || 0;
    for (let i = 0; i < na; i++) P.used[gl.getActiveAttrib(p, i).name] = 1;
  }

  /* ---------- malhas ---------- */
  // data: Float32Array no layout acima; idx: Uint16Array. dyn = reescrita a cada quadro.
  function Mesh(data, idx, dyn) { this.data = data; this.idx = idx; this.nv = data ? data.length / STRIDE : 0; this.ni = idx ? idx.length : 0; this.dyn = !!dyn; this.gen = -1; this.vb = null; this.ib = null; this.cap = 0; this.icap = 0; }
  Mesh.prototype.upload = function () {
    this.vb = gl.createBuffer(); this.ib = this.idx ? gl.createBuffer() : null; this.gen = gen; this.cap = 0; this.icap = 0;
    if (this.data && this.data.length) this.set(this.data, this.nv, this.idx, this.ni);
  };
  Mesh.prototype.set = function (data, nv, idx, ni) {   // malhas dinâmicas: envia só o trecho usado
    if (this.gen !== gen) { this.data = null; this.idx = null; this.upload(); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    const nf = nv * STRIDE;
    if (nf > this.cap) { this.cap = Math.max(nf, this.cap * 2); gl.bufferData(gl.ARRAY_BUFFER, this.cap * 4, this.dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, nf === data.length ? data : data.subarray(0, nf));
    if (idx) {
      if (!this.ib) this.ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
      if (ni > this.icap) { this.icap = Math.max(ni, this.icap * 2); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.icap * 2, this.dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); }
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, ni === idx.length ? idx : idx.subarray(0, ni));
    }
    this.nv = nv; this.ni = idx ? ni : 0; boundMesh = null;
    if (this.dyn) { this.data = data; this.idx = idx; }   // guarda a referência para refazer após perda de contexto
  };
  Mesh.prototype.bind = function () {
    if (this.gen !== gen) this.upload();
    if (boundMesh === this) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, SB, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, SB, 12);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, SB, 24);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, SB, 32);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, SB, 44);
    for (let i = 0; i < 5; i++) gl.enableVertexAttribArray(i);
    if (this.ib) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
    boundMesh = this;
  };
  Mesh.prototype.draw = function (mode) {
    if (!this.nv) return; this.bind();
    if (this.ib) gl.drawElements(mode === undefined ? gl.TRIANGLES : mode, this.ni, gl.UNSIGNED_SHORT, 0); else gl.drawArrays(mode === undefined ? gl.TRIANGLES : mode, 0, this.nv);
  };
  // desenho instanciado: inst = Float32Array com 8 floats por cópia (iA: x,y,z,escala · iB: frente x, frente z, tom, escala vertical)
  let instBuf = null, instGen = -1, instCap = 0;
  Mesh.prototype.drawInst = function (inst, n) {
    if (!this.nv || !n) return; this.bind();
    if (instGen !== gen) { instBuf = gl.createBuffer(); instGen = gen; instCap = 0; }
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    if (n * 8 > instCap) { instCap = Math.max(n * 8, instCap * 2, 512); gl.bufferData(gl.ARRAY_BUFFER, instCap * 4, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, n * 8));
    const I = ext.inst;
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(5); gl.enableVertexAttribArray(6); I.vertexAttribDivisorANGLE(5, 1); I.vertexAttribDivisorANGLE(6, 1);
    if (this.ib) I.drawElementsInstancedANGLE(gl.TRIANGLES, this.ni, gl.UNSIGNED_SHORT, 0, n); else I.drawArraysInstancedANGLE(gl.TRIANGLES, 0, this.nv, n);
    I.vertexAttribDivisorANGLE(5, 0); I.vertexAttribDivisorANGLE(6, 0); gl.disableVertexAttribArray(5); gl.disableVertexAttribArray(6);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); boundMesh = null;
  };

  /* ---------- texturas ---------- */
  // make() devolve { w, h, data: Uint8Array RGBA } ou um canvas. Sem cópia guardada: se o contexto cair, make() roda de novo.
  function Texture(make, o) { this.make = make; this.o = o || {}; this.gen = -1; this.t = null; this.w = 0; this.h = 0; }
  Texture.prototype.upload = function () {
    const src = this.make(), o = this.o, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (src.data) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data); this.w = src.w; this.h = src.h; }
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); this.w = src.width; this.h = src.height; }
    const pot = !(this.w & (this.w - 1)) && !(this.h & (this.h - 1)), mip = pot && o.mip !== false, wrap = pot && o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.repeatS === false ? gl.CLAMP_TO_EDGE : wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    if (mip && ext.aniso && o.aniso !== false) gl.texParameterf(gl.TEXTURE_2D, ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, ext.anisoMax);
    this.t = t; this.gen = gen;
  };
  Texture.prototype.bind = function (unit) {
    if (this.gen !== gen) this.upload();
    gl.activeTexture(gl.TEXTURE0 + (unit || 0)); gl.bindTexture(gl.TEXTURE_2D, this.t);
  };
  // reenvia o conteúdo (canvas que mudou: rádio, mapa) sem recriar a textura
  Texture.prototype.update = function () {
    if (this.gen !== gen || !this.t) { this.upload(); return; }
    const src = this.make(); gl.bindTexture(gl.TEXTURE_2D, this.t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (src.data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, src.w, src.h, gl.RGBA, gl.UNSIGNED_BYTE, src.data); else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const pot = !(this.w & (this.w - 1)) && !(this.h & (this.h - 1)); if (pot && this.o.mip !== false) gl.generateMipmap(gl.TEXTURE_2D);
  };
  Texture.prototype.free = function () { if (this.t && this.gen === gen) gl.deleteTexture(this.t); this.t = null; this.gen = -1; };

  /* alvo de renderização (retrovisores) */
  function Target() { this.gen = -1; this.w = 0; this.h = 0; }
  Target.prototype.begin = function (w, h) {
    if (this.gen !== gen || this.w !== w || this.h !== h) {
      if (this.gen === gen) { gl.deleteFramebuffer(this.fb); gl.deleteTexture(this.tex); gl.deleteRenderbuffer(this.rb); }
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      this.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rb);
      this.w = w; this.h = h; this.gen = gen; this.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); gl.viewport(0, 0, w, h);
    return this.ok;
  };
  Target.prototype.end = function () { gl.bindFramebuffer(gl.FRAMEBUFFER, null); };
  Target.prototype.bind = function (unit) { gl.activeTexture(gl.TEXTURE0 + (unit || 0)); gl.bindTexture(gl.TEXTURE_2D, this.tex); };

  /* ---------- construtor de malhas ---------- */
  // acumula vértices/índices; cada vértice: x,y,z, nx,ny,nz, u,v, r,g,b, osso, material
  function Builder() { this.v = []; this.i = []; this.bone = 0; this.mat = 0; this.col = [1, 1, 1]; }
  Builder.prototype.vert = function (x, y, z, nx, ny, nz, u, v) { this.v.push(x, y, z, nx, ny, nz, u, v, this.col[0], this.col[1], this.col[2], this.bone, this.mat); return this.v.length / STRIDE - 1; };
  Builder.prototype.tri = function (a, b, c) { this.i.push(a, b, c); };
  Builder.prototype.mesh = function () { if (this.v.length / STRIDE > 65535) throw new Error('malha grande demais'); return new Mesh(new Float32Array(this.v), new Uint16Array(this.i)); };

  /* ---------- matrizes 4x4 (colunas, como o GL) ---------- */
  const M4 = {
    make: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    mul(o, a, b) {   // o = a * b (o pode ser a ou b)
      const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3; o[c * 4 + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
        o[c * 4 + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3; o[c * 4 + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
      }
      return o;
    },
    // posiciona um modelo na vista: frente do modelo (+z) → (fx, 0, fz) já na vista; det = ±1 (vista espelhada/retrovisor)
    place(o, x, y, z, fx, fz, det, k, ky) {
      ky = k * (ky || 1);
      o[0] = det * fz * k; o[1] = 0; o[2] = -det * fx * k; o[3] = 0;
      o[4] = 0; o[5] = ky; o[6] = 0; o[7] = 0;
      o[8] = fx * k; o[9] = 0; o[10] = fz * k; o[11] = 0;
      o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
      return o;
    },
    // projeção do jogo: focal F (px virtuais), centro (cx, cy), tela W×H virtual, z para frente
    proj(o, F, cx, cy, W, H, near, far) {
      o.fill(0);
      o[0] = 2 * F / W; o[5] = 2 * F / H; o[8] = 2 * cx / W - 1; o[9] = 1 - 2 * cy / H;
      o[10] = (far + near) / (far - near); o[11] = 1; o[14] = -2 * far * near / (far - near);
      return o;
    },
  };

  return {
    init, Program, Mesh, Texture, Target, Builder, M4, STRIDE,
    get gl() { return gl; }, get ext() { return ext; }, get lost() { return lost || !gl || gl.isContextLost(); }, get gen() { return gen; },
    unbindMesh() { boundMesh = null; },
  };
})();
