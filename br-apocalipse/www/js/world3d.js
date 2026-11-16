'use strict';
/* Mundo 3D (WebGL): a mesma estrada curva do jogo, agora em polígonos com textura, luz por pixel, faróis de verdade e neblina.
   A projeção é idêntica à do modo 2D (focal F, horizonte hor), então os retângulos de tiro (G.hits) continuam batendo com o que se vê. */
const W3D = (() => {
  let ok = false, gl = null, glcv = null;
  const M4 = GL3.M4, X = new Float32Array(200), proj = M4.make(), mtx = M4.make(), mtx2 = M4.make();
  let P_SKY, P_GND, P_MOD, P_MODA, P_MODI, P_MODIA, P_SKIN, P_DEC, P_ADD, P_QUAD, P_LINE;
  let white = null, quad = null;

  /* ---------- shaders ---------- */
  const LIGHT = `
uniform vec3 uFogC; uniform vec4 uFogP; uniform vec3 uAmbS; uniform vec3 uAmbG; uniform vec3 uSunC; uniform vec3 uSunD;
uniform vec4 uHL; uniform vec3 uHLp; uniform vec3 uHLd; uniform vec3 uHLc; uniform vec4 uPL; uniform vec3 uPLc;
float fogF(float z) { float r = (z * uFogP.x - uFogP.z) * uFogP.w; return r <= 0.0 ? 0.0 : pow(min(r, 1.0), 1.1) * uFogP.y; }
vec3 lightAt(vec3 p, vec3 n) {
  vec3 L = mix(uAmbG, uAmbS, n.y * 0.5 + 0.5) + uSunC * max(dot(n, uSunD), 0.0);
  if (uHL.x > 0.0) {
    vec3 d = p - uHLp; float dist = length(d); vec3 dn = d / max(dist, 0.01);
    float cone = smoothstep(uHL.w, uHL.z, dot(dn, uHLd));
    float att = clamp(1.0 - dist * uHL.y, 0.0, 1.0); att *= att;
    L += uHLc * (uHL.x * cone * att * (0.5 + 0.5 * max(dot(n, -dn), 0.0)));
  }
  if (uPL.w > 0.0) { vec3 d = uPL.xyz - p; float dd = dot(d, d); L += uPLc * (uPL.w * max(dot(n, d * inversesqrt(dd + 0.01)), 0.0) / (1.0 + dd * 0.08)); }
  return L;
}
vec3 tone(vec3 c) { vec3 h = max(c - 0.82, 0.0); return min(c, 0.82) + h / (1.0 + h * 2.6); }
`;
  const VS_GND = `attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV; attribute vec3 aCol; uniform mat4 uP;
varying vec3 vP; varying vec2 vUV; varying vec3 vC; varying vec2 vW;
void main() { vP = aPos; vUV = aUV; vC = aCol; vW = aNor.xz; gl_Position = uP * vec4(aPos, 1.0); }`;
  const FS_GND = LIGHT + `uniform sampler2D uT; uniform sampler2D uD; uniform sampler2D uM; uniform vec4 uDS; uniform float uGlow; uniform vec2 uWet;
varying vec3 vP; varying vec2 vUV; varying vec3 vC; varying vec2 vW;
void main() {
  vec4 t = texture2D(uT, vUV);
  vec3 base = t.rgb * vC;
  base *= 1.0 + (texture2D(uD, vW * uDS.x).r * 2.0 - 1.0) * uDS.y;
  base *= 1.0 + (texture2D(uM, vW * uDS.z).r * 2.0 - 1.0) * uDS.w;
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 col = base * max(lightAt(vP, n), vec3(t.a * uGlow));
  if (uWet.x > 0.0) {   // asfalto molhado: brilho do céu e dos faróis refletido
    vec3 v = normalize(vP); float fr = pow(1.0 - abs(v.y), 5.0);
    col += uWet.x * fr * (uAmbS * 0.55 + uHLc * uHL.x * 0.08) * (0.6 + 0.4 * texture2D(uD, vW * 0.37).r);
  }
  col = mix(col, uFogC, fogF(vP.z));
  gl_FragColor = vec4(tone(col), 1.0);
}`;
  const VS_MOD = `attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV; attribute vec3 aCol; attribute vec2 aExt;
uniform mat4 uP; uniform mat4 uM; uniform vec2 uUV;
#ifdef INST
attribute vec4 iA; attribute vec4 iB; uniform float uDet;
#endif
#ifdef SKIN
uniform vec4 uB[66];
#endif
varying vec3 vP; varying vec3 vN; varying vec2 vUV; varying vec3 vC; varying float vMat;
void main() {
  vec4 p = vec4(aPos, 1.0); vec3 n = aNor; vC = aCol;
#ifdef SKIN
  int b = int(aExt.x + 0.5) * 3; vec4 r0 = uB[b]; vec4 r1 = uB[b + 1]; vec4 r2 = uB[b + 2];
  p = vec4(dot(r0, p), dot(r1, p), dot(r2, p), 1.0); n = vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n));
#endif
#ifdef INST
  vec3 xa = vec3(uDet * iB.y, 0.0, -uDet * iB.x), fw = vec3(iB.x, 0.0, iB.y);
  vec4 w = vec4((xa * p.x + vec3(0.0, p.y * iB.w, 0.0) + fw * p.z) * iA.w + iA.xyz, 1.0);
  n = xa * n.x + vec3(0.0, n.y, 0.0) + fw * n.z; vC *= iB.z;
#else
  vec4 w = uM * p; n = (uM * vec4(n, 0.0)).xyz;
#endif
  vP = w.xyz; vN = n; vUV = aUV + uUV; vMat = aExt.y;
  gl_Position = uP * w;
}`;
  const FS_MOD = LIGHT + `uniform sampler2D uT; uniform vec3 uTint1; uniform vec3 uTint2; uniform float uFlash; uniform float uGlow; uniform float uSpec;
varying vec3 vP; varying vec3 vN; varying vec2 vUV; varying vec3 vC; varying float vMat;
void main() {
  vec4 t = texture2D(uT, vUV);
#ifdef ATEST
  if (t.a < 0.5) discard;
  float em = 0.0;
#else
  float em = t.a;
#endif
  vec3 tint = vMat < 0.5 ? vec3(1.0) : (vMat < 1.5 ? uTint1 : uTint2);
  vec3 base = t.rgb * vC * tint;
  vec3 n = normalize(vN);
  if (dot(n, vP) > 0.0) n = -n;   // face vista por trás (chapas finas, fitas): ilumina o lado que aparece
  vec3 col = base * max(lightAt(vP, n), vec3(em * uGlow));
  if (uSpec > 0.0) {   // pintura brilhante: reflexo do sol, do céu e dos faróis
    vec3 v = normalize(-vP), h = normalize(uSunD + v);
    col += uSpec * (uSunC * pow(max(dot(n, h), 0.0), 40.0) + uAmbS * 0.25 * pow(1.0 - max(dot(n, v), 0.0), 3.0));
    if (uHL.x > 0.0) { vec3 dl = vP - uHLp; float dd = length(dl); vec3 hl = normalize(-dl / max(dd, 0.01) + v); col += uSpec * uHLc * uHL.x * 0.4 * pow(max(dot(n, hl), 0.0), 30.0) * clamp(1.0 - dd * uHL.y, 0.0, 1.0) * smoothstep(uHL.w, uHL.z, dot(dl / max(dd, 0.01), uHLd)); }
  }
  float f = fogF(vP.z);
  col = mix(col, uFogC, mix(f, f * f * 0.85, em));
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(tone(col), 1.0);
}`;
  // decalques no chão (sombras, sangue, freadas): iluminados, misturados por alfa
  const VS_DEC = `attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aCol; attribute vec2 aExt; uniform mat4 uP;
varying vec3 vP; varying vec2 vUV; varying vec3 vC; varying float vA; varying float vL;
void main() { vP = aPos; vUV = aUV; vC = aCol; vA = aExt.x; vL = aExt.y; gl_Position = uP * vec4(aPos, 1.0); }`;
  const FS_DEC = LIGHT + `uniform sampler2D uT; varying vec3 vP; varying vec2 vUV; varying vec3 vC; varying float vA; varying float vL;
void main() {
  vec4 t = texture2D(uT, vUV); float f = fogF(vP.z);
  vec3 col = t.rgb * vC; col *= mix(vec3(1.0), lightAt(vP, vec3(0.0, 1.0, 0.0)), vL);
  gl_FragColor = vec4(tone(mix(col, uFogC, f * vL)), t.a * vA * (vL > 0.5 ? 1.0 : 1.0 - f));
}`;
  // brilhos e partículas: aditivo, some na neblina
  const VS_ADD = `attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aCol; attribute vec2 aExt; uniform mat4 uP;
varying vec2 vUV; varying vec3 vC; varying float vA; varying float vZ;
void main() { vUV = aUV; vC = aCol; vA = aExt.x; vZ = aPos.z; gl_Position = uP * vec4(aPos, 1.0); }`;
  const FS_ADD = `uniform sampler2D uT; uniform vec4 uFogP; varying vec2 vUV; varying vec3 vC; varying float vA; varying float vZ;
void main() { vec4 t = texture2D(uT, vUV); float r = (vZ * uFogP.x - uFogP.z) * uFogP.w; float f = r <= 0.0 ? 0.0 : min(r, 1.0) * uFogP.y;
  gl_FragColor = vec4(t.rgb * vC * t.a * vA * (1.0 - f * 0.7), 1.0); }`;
  // céu: degradê, nuvens num plano alto, sol
  const VS_SKY = `attribute vec3 aPos; varying vec2 vS; void main() { vS = aPos.xy; gl_Position = vec4(aPos.xy, 0.0, 1.0); }`;
  const FS_SKY = `uniform vec4 uV; uniform vec4 uV2; uniform vec3 uS0; uniform vec3 uS1; uniform vec3 uFogC; uniform vec3 uCC; uniform vec4 uSun; uniform vec3 uSunK; uniform sampler2D uT;
varying vec2 vS;
void main() {
  float y = (0.5 - vS.y * 0.5) * uV.y, x = (vS.x * 0.5 + 0.5) * uV.x;
  if (y >= uV.w) { gl_FragColor = vec4(uFogC, 1.0); return; }
  vec3 col = mix(uS0, uS1, clamp(y / max(uV.w, 1.0), 0.0, 1.0));
  float dy = (uV.w - y) / uV2.x, dist = 450.0 / max(dy, 0.0015);
  vec2 cp = vec2((x - uV.z) / uV2.x * dist + uV2.y, dist + uV2.z) / 1600.0;
  float cl = texture2D(uT, cp).a * 0.75 + texture2D(uT, cp * 2.7 + 0.31).a * 0.25;
  cl = smoothstep(uCC.x, uCC.x + 0.42, cl) * (1.0 - smoothstep(2500.0, 26000.0, dist));
  float sd = length(vec2(x, y) - uSun.xy);
  vec3 sun = uSunK * (smoothstep(uSun.z, uSun.z * 0.9, sd) + 0.45 * exp(-sd / (uSun.z * 2.2)));
  col += sun * uSun.w;
  col = mix(col, vec3(uCC.y), cl * uCC.z);
  gl_FragColor = vec4(col, 1.0);
}`;
  // quadro em tela (horizonte, marcos, retrovisores)
  const VS_QUAD = `attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aCol; attribute vec2 aExt; varying vec2 vUV; varying vec3 vC; varying float vA;
void main() { vUV = aUV; vC = aCol; vA = aExt.x; gl_Position = vec4(aPos.xy, 0.0, 1.0); }`;
  const FS_QUAD = `uniform sampler2D uT; uniform float uOpaque; varying vec2 vUV; varying vec3 vC; varying float vA;
void main() { vec4 t = texture2D(uT, vUV); gl_FragColor = vec4(t.rgb * vC, mix(t.a * vA, 1.0, uOpaque)); }`;

  /* ---------- buffers dinâmicos (recriados a cada quadro) ---------- */
  function Dyn(maxQuads) { this.max = maxQuads * 4; this.f = new Float32Array(this.max * 13); this.ix = new Uint16Array(maxQuads * 6); this.nv = 0; this.ni = 0; this.mesh = new GL3.Mesh(null, null, true); }
  Dyn.prototype.reset = function () { this.nv = 0; this.ni = 0; };
  Dyn.prototype.room = function (n) { return this.nv + n <= this.max; };
  Dyn.prototype.v = function (x, y, z, wx, wz, u, v, r, g, b, e0, e1) {
    const f = this.f, o = this.nv * 13; f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = wx; f[o + 4] = 0; f[o + 5] = wz; f[o + 6] = u; f[o + 7] = v; f[o + 8] = r; f[o + 9] = g; f[o + 10] = b; f[o + 11] = e0; f[o + 12] = e1;
    return this.nv++;
  };
  Dyn.prototype.q = function (a, b, c, d) { const i = this.ix, o = this.ni; i[o] = a; i[o + 1] = b; i[o + 2] = c; i[o + 3] = a; i[o + 4] = c; i[o + 5] = d; this.ni += 6; };
  Dyn.prototype.draw = function () { if (!this.ni) return; this.mesh.set(this.f, this.nv, this.ix, this.ni); this.mesh.draw(); };
  const D = {};   // buffers por material

  function init(canvas) {
    glcv = canvas;
    if (!GL3.init(canvas)) return false;
    gl = GL3.gl;
    try {
      P_SKY = new GL3.Program(VS_SKY, FS_SKY);
      P_GND = new GL3.Program(VS_GND, FS_GND);
      P_MOD = new GL3.Program(VS_MOD, FS_MOD);
      P_MODA = new GL3.Program(VS_MOD, FS_MOD, ['ATEST']);
      P_SKIN = new GL3.Program(VS_MOD, FS_MOD, ['SKIN']);
      if (GL3.ext.inst) { P_MODI = new GL3.Program(VS_MOD, FS_MOD, ['INST']); P_MODIA = new GL3.Program(VS_MOD, FS_MOD, ['INST', 'ATEST']); }
      P_DEC = new GL3.Program(VS_DEC, FS_DEC);
      P_ADD = new GL3.Program(VS_ADD, FS_ADD);
      P_QUAD = new GL3.Program(VS_QUAD, FS_QUAD);
      for (const p of [P_SKY, P_GND, P_MOD, P_MODA, P_SKIN, P_MODI, P_MODIA, P_DEC, P_ADD, P_QUAD]) if (p) p.use();   // compila já: erro aqui = cai para o 2D
    } catch (e) { console.error(e); ok = false; return false; }
    for (const k of ['grass', 'dirt', 'asf', 'water', 'cliff', 'deck']) D[k] = new Dyn(k === 'grass' ? 560 : 300);
    D.dec = new Dyn(900); D.add = new Dyn(1200); D.scr = new Dyn(64); D.sh = new Dyn(500); D.part = new Dyn(480);
    white = TEX3.T(() => ({ w: 4, h: 4, data: new Uint8Array(64).fill(255) }), { mip: false });
    quad = new Float32Array([-1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, -1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, -1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0]);
    quad = new GL3.Mesh(quad, new Uint16Array([0, 1, 2, 0, 2, 3]));
    ok = true;
    return true;
  }

  /* ---------- cena (luz, neblina) ---------- */
  const L = { fogC: [0, 0, 0], fogP: [0, 0.2, 0.2, 1.25], ambS: [0.5, 0.5, 0.5], ambG: [0.3, 0.3, 0.3], sunC: [0.8, 0.8, 0.8], sunD: [0, 1, 0], HL: [0, 0, 0, 0], HLp: [0, 0, 0], HLd: [0, 0, 1], HLc: [1, 0.93, 0.8], PL: [0, 0, 0, 0], PLc: [1, 0.5, 0.2], glow: 0.9, gGlow: 0, wet: 0, det: 1, night: false, gen: 0, maxD: 800 };
  const rgbN = (h) => { const a = TEX3.hexRGB(h); return [a[0] / 255, a[1] / 255, a[2] / 255]; };
  const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const SUN = { limpo: 0.95, chuva: 0.22, neblina: 0.16, fumaca: 0.32, queimada: 0.45, areia: 0.42 };
  const CLIMA_FOG = { chuva: '#59626a', neblina: null, fumaca: '#3a2a20', queimada: '#6a4a30', areia: '#c8a050' };
  function scene(v, maxD, opt) {
    const st = G.st, night = G.night, cl = G.clima, fs = v.flip ? -1 : 1, dir = v.dir;
    const fogHex = (cl !== 'limpo' && CLIMA_FOG[cl]) || st.fog, fogc = rgbN(night && cl === 'limpo' ? '#0a0e14' : fogHex), fogK = cl === 'limpo' ? st.fogK : 1;
    L.fogC = fogc; L.fogK = fogK; L.fogP = [1 / maxD, fogK, 0.2, 1.25]; L.maxD = maxD;
    const s0 = rgbN(st.sky[0]), s1 = rgbN(st.sky[1]);
    if (night) {
      L.sunC = [0.085, 0.1, 0.16]; L.ambS = [0.055, 0.066, 0.1]; L.ambG = [0.026, 0.026, 0.034];   // luar
    } else {
      const k = SUN[cl] || 0.9, warm = st.sol ? [1.0, 0.78, 0.55] : [1.0, 0.95, 0.86];
      L.sunC = warm.map(c => c * k * 0.95);
      const amb = 0.36 + (1 - k) * 0.5, sk = mixA(s1, [1, 1, 1], 0.45);
      L.ambS = sk.map(c => c * amb * 1.05); const gr = rgbN(st.ground[0]); L.ambG = mixA(gr, [0.5, 0.5, 0.5], 0.5).map(c => c * amb * 0.75);
      if (cl !== 'limpo') { L.ambS = mixA(L.ambS, fogc.map(c => c * 0.9), 0.35); }
    }
    // sol vindo de trás-esquerda-cima (os zumbis que vêm na direção do carro ficam bem iluminados)
    const sx = -0.42, sy = st.sol ? 0.5 : 0.78, sz = -0.47, sl = Math.hypot(sx, sy, sz); L.sunD = [fs * sx / sl, sy / sl, dir * sz / sl];
    // faróis: saem da frente do carro e iluminam para a frente da estrada
    L.HL = [0, 0, 0, 0];
    if (night) {
      const tpp = G.role === 'pilot' && G.cam === 'tpp', front = tpp && typeof V3D !== 'undefined' ? V3D.playerModel(S.veh, S.up).len : 1.8;
      const lv = P.lights, carZ = dir * (P.z + front - v.camZ), carX = fs * (P.x - v.camX);
      const fwd = [0, lv === 2 ? -0.012 : -0.05, dir], fl = Math.hypot(fwd[0], fwd[1], fwd[2]);
      L.HLp = [carX, -v.camH + 0.75, carZ]; L.HLd = fwd.map(c => c / fl);
      L.HL = lv === 2 ? [3.2, 1 / 160, 0.965, 0.85] : lv === 1 ? [2.9, 1 / 82, 0.94, 0.79] : [0.6, 1 / 14, 0.9, 0.6];
    }
    L.PL = [0, 0, 0, 0];
    if (opt && opt.light) { L.PL = opt.light.p; L.PLc = opt.light.c; }
    L.glow = 0.92; L.gGlow = night ? 0.16 : 0; L.wet = cl === 'chuva' ? 0.75 : 0; L.night = night;
    L.gen++;
  }
  function setLight(p) {
    if (p.lgen === L.gen && p.lglgen === GL3.gen) return;
    const u = p.u;
    gl.uniform3fv(u.uFogC, L.fogC); gl.uniform4fv(u.uFogP, L.fogP);
    if (u.uAmbS) {
      gl.uniform3fv(u.uAmbS, L.ambS); gl.uniform3fv(u.uAmbG, L.ambG); gl.uniform3fv(u.uSunC, L.sunC); gl.uniform3fv(u.uSunD, L.sunD);
      gl.uniform4fv(u.uHL, L.HL); gl.uniform3fv(u.uHLp, L.HLp); gl.uniform3fv(u.uHLd, L.HLd); gl.uniform3fv(u.uHLc, L.HLc);
      gl.uniform4fv(u.uPL, L.PL); gl.uniform3fv(u.uPLc, L.PLc);
    }
    p.lgen = L.gen; p.lglgen = GL3.gen;
  }
  function useProg(p) { p.use(); if (p.pgen !== pgen || p.pglgen !== GL3.gen) { gl.uniformMatrix4fv(p.u.uP, false, proj); p.pgen = pgen; p.pglgen = GL3.gen; } setLight(p); return p; }
  let pgen = 0;

  /* ---------- API para os módulos de modelos (zumbis, veículos, cenário, chefes) ---------- */
  let DET = 1, FS = 1, DIR = 1;
  const R = {
    get det() { return DET; }, get fs() { return FS; }, get dir() { return DIR; }, L,
    // matriz de um modelo na vista: frente (fx,fz) já na vista
    place(o, x, y, z, fx, fz, k, ky) { return M4.place(o || mtx, x, y, z, fx, fz, DET, k, ky); },
    model(mesh, tex, M, o) {
      const p = useProg(o && o.atest ? P_MODA : P_MOD), u = p.u;
      gl.uniformMatrix4fv(u.uM, false, M); (tex || white).bind(0); gl.uniform1i(u.uT, 0);
      gl.uniform3fv(u.uTint1, (o && o.t1) || ONE); gl.uniform3fv(u.uTint2, (o && o.t2) || ONE);
      gl.uniform1f(u.uFlash, (o && o.flash) || 0); gl.uniform1f(u.uGlow, o && o.glow !== undefined ? o.glow : L.glow); gl.uniform1f(u.uSpec, (o && o.spec) || 0);
      if (o && o.uv) gl.uniform2f(u.uUV, o.uv[0], o.uv[1]); else gl.uniform2f(u.uUV, 0, 0);
      if (o && o.add) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); mesh.draw(); gl.depthMask(true); gl.disable(gl.BLEND); return; }   // clarão: soma luz
      mesh.draw();
    },
    skin(mesh, tex, M, bones, o) {
      const p = useProg(P_SKIN), u = p.u;
      gl.uniformMatrix4fv(u.uM, false, M); gl.uniform4fv(u.uB, bones); (tex || white).bind(0); gl.uniform1i(u.uT, 0);
      gl.uniform3fv(u.uTint1, (o && o.t1) || ONE); gl.uniform3fv(u.uTint2, (o && o.t2) || ONE);
      gl.uniform1f(u.uFlash, (o && o.flash) || 0); gl.uniform1f(u.uGlow, o && o.glow !== undefined ? o.glow : L.glow); gl.uniform1f(u.uSpec, o && o.spec !== undefined ? o.spec : 0.06);
      gl.uniform2f(u.uUV, 0, 0);
      mesh.draw();
    },
    // buffer dinâmico já na vista (capô do carro)
    hood(d) { if (!d.ni) return; d.mesh.set(d.f, d.nv, d.ix, d.ni); R.model(d.mesh, V3D.tex(), IDM, { glow: 0 }); },
    // cópias instanciadas (cenário): agrupadas por malha+textura e desenhadas no fim
    inst(mesh, tex, atest, x, y, z, fx, fz, k, shade, ky) {
      let b = batches.get(mesh); if (!b) { b = { mesh, tex, atest, a: new Float32Array(64 * 8), n: 0 }; batches.set(mesh, b); }
      if (b.n * 8 >= b.a.length) { const na = new Float32Array(b.a.length * 2); na.set(b.a); b.a = na; }
      const o = b.n * 8, a = b.a; a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = k; a[o + 4] = fx; a[o + 5] = fz; a[o + 6] = shade || 1; a[o + 7] = ky || 1; b.n++;
    },
    // sombra redonda no chão
    blob(x, y, z, rx, rz, a) { decQuad(D.sh, BLOB_UV, x, y + 0.03, z, rx, rz, 1, 0, a, 0, 0, 0, 0); },
    // decalque do atlas (célula 0..15), ang = rotação no chão, cor multiplicadora
    decal(cell, x, y, z, rx, rz, ang, a, r, g, b) { decalList.push(cell, x, y, z, rx, rz, ang, a, r === undefined ? 1 : r, g === undefined ? 1 : g, b === undefined ? 1 : b); },
    // brilho aditivo virado para a câmera
    glow(x, y, z, w, h, r, g, b, a) { addQuad(GLOW_UV, x, y, z, w, h, r, g, b, a); },
    flame(x, y, z, w, h, a) { addQuad(GLOW_UV, x, y, z, w, h, 1, 0.55, 0.15, a); },
    particle(x, y, z, s, r, g, b, a) { const d = D.part; if (!d.room(4)) return; const i0 = d.v(x - s, y - s, z, 0, 0, 0, 1, r, g, b, a, 1), i1 = d.v(x + s, y - s, z, 0, 0, 1, 1, r, g, b, a, 1), i2 = d.v(x + s, y + s, z, 0, 0, 1, 0, r, g, b, a, 1), i3 = d.v(x - s, y + s, z, 0, 0, 0, 0, r, g, b, a, 1); d.q(i0, i1, i2, i3); },
    proj(x, y, z) { return [CX + VF * x / z, CY - VF * y / z]; },   // vista → tela (px virtuais)
    get F() { return VF; }, get cx() { return CX; }, get cy() { return CY; },
  };
  const ONE = new Float32Array([1, 1, 1]), IDM = M4.make();
  const batches = new Map(), decalList = [];
  const BLOB_UV = [0, 0, 1, 1], GLOW_UV = [0, 0, 1, 1];
  let VF = 500, CX = 480, CY = 216;

  function decQuad(d, uv, x, y, z, rx, rz, c, s, a, cr, cg, cb, lit) {
    if (!d || !d.room(4)) return;
    const ax = c * rx, az = -s * rx, bx = s * rz, bz = c * rz;   // eixos no chão
    const i0 = d.v(x - ax - bx, y, z - az - bz, 0, 0, uv[0], uv[1], cr, cg, cb, a, lit), i1 = d.v(x + ax - bx, y, z + az - bz, 0, 0, uv[2], uv[1], cr, cg, cb, a, lit);
    const i2 = d.v(x + ax + bx, y, z + az + bz, 0, 0, uv[2], uv[3], cr, cg, cb, a, lit), i3 = d.v(x - ax + bx, y, z - az + bz, 0, 0, uv[0], uv[3], cr, cg, cb, a, lit);
    d.q(i0, i1, i2, i3);
  }
  function addQuad(uv, x, y, z, w, h, r, g, b, a) {
    const d = D.add; if (!d.room(4)) return;
    const i0 = d.v(x - w, y - h, z, 0, 0, uv[0], uv[3], r, g, b, a, 0), i1 = d.v(x + w, y - h, z, 0, 0, uv[2], uv[3], r, g, b, a, 0);
    const i2 = d.v(x + w, y + h, z, 0, 0, uv[2], uv[1], r, g, b, a, 0), i3 = d.v(x - w, y + h, z, 0, 0, uv[0], uv[1], r, g, b, a, 0);
    d.q(i0, i1, i2, i3);
  }

  /* ---------- chão: asfalto, acostamento, terreno, ponte, precipício ---------- */
  const STAGE_GND = [0, 1, 2, 3, 4, 5, 6, 6, 8, 9];
  function groundTex() { const st = G.st, i = G.arena ? 2 : Math.max(0, STAGES.indexOf(st)); return TEX3.ground(STAGE_GND[i] === undefined ? 0 : STAGE_GND[i], st.ground[0]); }
  function buildGround(v, base, off, N) {
    const st = G.st, dir = v.dir, fs = v.flip ? -1 : 1, y = -v.camH, pen = st.penhasco;
    for (const k of ['grass', 'dirt', 'asf', 'water', 'cliff', 'deck']) D[k].reset();
    const strip = (d, z0, z1, c0, c1, a, b, yy, u0, u1, vn, vf, wz0, wz1, col) => {
      if (!d.room(4)) return;
      const r = col ? col[0] : 1, g = col ? col[1] : 1, bb = col ? col[2] : 1;
      const i0 = d.v(c0 + fs * a, yy, z0, a, wz0, u0, vn, r, g, bb, 0, 0), i1 = d.v(c0 + fs * b, yy, z0, b, wz0, u1, vn, r, g, bb, 0, 0);
      const i2 = d.v(c1 + fs * b, yy, z1, b, wz1, u1, vf, r, g, bb, 0, 0), i3 = d.v(c1 + fs * a, yy, z1, a, wz1, u0, vf, r, g, bb, 0, 0);
      d.q(i0, i1, i2, i3);
    };
    const wall = (d, z0, z1, x0, x1, ya, yb, u0, u1, va, vb) => {   // parede vertical ao longo da estrada
      if (!d.room(4)) return;
      const i0 = d.v(x0, ya, z0, 0, 0, u0, va, 1, 1, 1, 0, 0), i1 = d.v(x1, ya, z1, 0, 0, u1, va, 1, 1, 1, 0, 0), i2 = d.v(x1, yb, z1, 0, 0, u1, vb, 1, 1, 1, 0, 0), i3 = d.v(x0, yb, z0, 0, 0, u0, vb, 1, 1, 1, 0, 0);
      d.q(i0, i1, i2, i3);
    };
    const FAR = 1800, E = ROADW + 2.6, gk = [1, 1, 1];
    for (let n = 0; n < N; n++) {
      const z0 = (n - off) * SEG, z1 = (n + 1 - off) * SEG; if (z1 <= 0.05) continue;
      const c0 = fs * (X[n] - v.camX), c1 = fs * (X[n + 1] - v.camX), i = Math.round(base + dir * n), bridge = isBridge(i * SEG);
      const s0 = (i & 1) * 0.5, an = dir > 0 ? s0 : s0 + 0.5, af = dir > 0 ? s0 + 0.5 : s0;                  // v do asfalto (2 segmentos por textura)
      const gn = dir > 0 ? 0 : 1, gf = 1 - gn;                                                               // v do terreno (1 por segmento)
      const im = ((i % 64) + 64) % 64, wn = (dir > 0 ? im : im + 1) * SEG, wf = (dir > 0 ? im + 1 : im) * SEG; // coordenada contínua p/ detalhe
      strip(D.asf, z0, z1, c0, c1, -ROADW, ROADW, y, 0, 1, an, af, wn, wf);
      if (bridge) {
        strip(D.deck, z0, z1, c0, c1, -ROADW - 0.7, -ROADW, y + 0.02, 0, 0.18, gn, gf, wn, wf); strip(D.deck, z0, z1, c0, c1, ROADW, ROADW + 0.7, y + 0.02, 0, 0.18, gn, gf, wn, wf);
        wall(D.deck, z0, z1, c0 - fs * (ROADW + 0.7), c1 - fs * (ROADW + 0.7), y + 0.02, y - 1.6, 0, 2, 0, 0.4); wall(D.deck, z0, z1, c0 + fs * (ROADW + 0.7), c1 + fs * (ROADW + 0.7), y + 0.02, y - 1.6, 0, 2, 0, 0.4);
        strip(D.water, z0, z1, c0, c1, -FAR, FAR, y - 7, -FAR / 6, FAR / 6, gn * 1.3, gf * 1.3, wn, wf);
        continue;
      }
      strip(D.dirt, z0, z1, c0, c1, -E, -ROADW, y, -E / 4, -ROADW / 4, gn * 2, gf * 2, wn, wf);
      strip(D.dirt, z0, z1, c0, c1, ROADW, E, y, ROADW / 4, E / 4, gn * 2, gf * 2, wn, wf);
      strip(D.grass, z0, z1, c0, c1, -FAR, -E, y, -FAR / 8, -E / 8, gn, gf, wn, wf, gk);
      if (pen) {   // precipício à direita: borda, paredão descendo e o vale lá embaixo na neblina
        const edge = ROADW + 4.2;
        strip(D.grass, z0, z1, c0, c1, E, edge, y, E / 8, edge / 8, gn, gf, wn, wf, gk);
        wall(D.cliff, z0, z1, c0 + fs * edge, c1 + fs * edge, y, y - 90, 0, 2, 0, 9);
        strip(D.cliff, z0, z1, c0, c1, edge, FAR, y - 90, edge / 16, FAR / 16, gn, gf, wn, wf);
      } else strip(D.grass, z0, z1, c0, c1, E, FAR, y, E / 8, FAR / 8, gn, gf, wn, wf, gk);
    }
  }
  function drawGround() {
    const p = useProg(P_GND), u = p.u;
    gl.uniform1i(u.uT, 0); gl.uniform1i(u.uD, 1); gl.uniform1i(u.uM, 2);
    TEX3.detail().bind(1); TEX3.macro().bind(2);
    const pass = (d, tex, ds, glow, wet) => { if (!d.ni) return; tex.bind(0); gl.uniform4fv(u.uDS, ds); gl.uniform1f(u.uGlow, glow || 0); gl.uniform2f(u.uWet, wet || 0, 0); d.draw(); };
    const st = G.st, duo = st === STAGES[2] || st === ARENA;
    pass(D.grass, groundTex(), [1 / 1.7, 0.55, 1 / 90, 0.65]);
    pass(D.cliff, TEX3.cliff(), [1 / 2.2, 0.5, 1 / 60, 0.5]);
    pass(D.water, TEX3.water(), [1 / 3, 0.25, 1 / 80, 0.3], 0, L.wet + 0.9);
    pass(D.dirt, TEX3.gravel(), [1 / 1.3, 0.5, 1 / 70, 0.5], 0, L.wet * 0.5);
    pass(D.deck, TEX3.gravel(), [1 / 1.3, 0.3, 1 / 70, 0.2]);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    pass(D.asf, TEX3.asphalt(duo), [1 / 1.4, 0.65, 1 / 110, 0.55], L.gGlow, L.wet);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  // detalhes fixos do asfalto: buracos, manchas, rachaduras, freadas — sorteados pelo número do segmento
  function roadDecals(v, base, off, N) {
    const dir = v.dir, fs = v.flip ? -1 : 1, y = -v.camH, H = DRAW.hash;
    for (let n = 1; n < Math.min(N, 70); n++) {
      const i = Math.round(base + dir * n); if (isBridge(i * SEG)) continue; const h = H(i * 1.37 + 0.5); if (h > 0.42) continue;
      const kind = [0, 1, 2, 5, 6, 7, 8, 10, 0, 6][(H(i * 2.1) * 10) | 0], lat = (H(i * 3.7) - 0.5) * ROADW * 1.6, zz = (n + H(i * 5.3) - off) * SEG;
      if (zz < 1) continue;
      const cx = fs * (X[n] + (X[n + 1] - X[n]) * H(i * 5.3) + lat - v.camX), big = kind < 2 ? 1.6 : kind === 7 ? 0.45 : kind === 10 ? 1.8 : 0.9;
      decalList.push(kind, cx, y, zz, big * (kind < 2 ? 0.55 : 1), big * (kind < 2 ? 2.2 : 1), kind < 2 ? 0 : H(i) * 6.28, kind === 10 ? 0.7 : 0.85, 1, 1, 1);
    }
  }
  function flushDecals() {
    const d = D.dec, l = decalList;
    for (let j = 0; j < l.length; j += 11) {
      const cell = l[j], u0 = (cell % 4) / 4 + 0.004, v0 = ((cell / 4) | 0) / 4 + 0.004, uv = [u0, v0, u0 + 0.242, v0 + 0.242], c = Math.cos(l[j + 6]), s = Math.sin(l[j + 6]);
      decQuad(D.dec, uv, l[j + 1], l[j + 2] + 0.025, l[j + 3], l[j + 4], l[j + 5], c, s, l[j + 7], l[j + 8], l[j + 9], l[j + 10], 1);
    }
    decalList.length = 0;
  }
  function drawDecals() {
    if (!D.dec.ni) return;
    const p = useProg(P_DEC); gl.uniform1i(p.u.uT, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    // sombras (bloco do início, textura de sombra) e decalques (atlas) em duas passadas
    TEX3.decals().bind(0); D.dec.draw();
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function drawShadows() {
    if (!D.sh.ni) return;
    const p = useProg(P_DEC); gl.uniform1i(p.u.uT, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-3, -6);
    TEX3.blob().bind(0); D.sh.draw();
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function drawParts() {
    if (!D.part.ni) return;
    const p = useProg(P_DEC); gl.uniform1i(p.u.uT, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    TEX3.glow().bind(0); D.part.draw();
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function drawAdd() {
    if (!D.add.ni) return;
    const p = useProg(P_ADD); gl.uniform1i(p.u.uT, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    TEX3.glow().bind(0); D.add.draw();
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  function flushInst() {
    for (const b of batches.values()) {
      if (!b.n) continue;
      if (P_MODI) {
        const p = useProg(b.atest ? P_MODIA : P_MODI), u = p.u;
        gl.uniform1f(u.uDet, DET); (b.tex || white).bind(0); gl.uniform1i(u.uT, 0);
        gl.uniform3fv(u.uTint1, ONE); gl.uniform3fv(u.uTint2, ONE); gl.uniform1f(u.uFlash, 0); gl.uniform1f(u.uGlow, L.glow); gl.uniform1f(u.uSpec, b.spec || 0);
        b.mesh.drawInst(b.a, b.n);
      } else {   // sem instanciamento: uma chamada por cópia
        for (let j = 0; j < b.n; j++) { const a = b.a, o = j * 8; M4.place(mtx2, a[o], a[o + 1], a[o + 2], a[o + 4], a[o + 5], DET, a[o + 3], a[o + 7]); R.model(b.mesh, b.tex, mtx2, { atest: b.atest, t1: shadeV(a[o + 6]) }); }
      }
      b.n = 0;
    }
  }
  const SV = new Float32Array(3); const shadeV = (k) => { SV[0] = SV[1] = SV[2] = k; return SV; };

  /* ---------- céu e horizonte ---------- */
  function drawSky(v, W, H) {
    const st = G.st, night = G.night, cl = G.clima;
    const s0 = rgbN(night ? '#03050a' : st.sky[0]), s1 = rgbN(night ? '#10161f' : st.sky[1]), fc = L.fogC;
    const top = cl === 'limpo' ? s0 : mixA(s0, fc, 0.6), hz = cl === 'limpo' ? mixA(s1, fc, 0.35) : mixA(s1, fc, 0.95);
    const p = P_SKY.use(), u = p.u;
    gl.uniform4f(u.uV, W, H, W / 2 + (v.pan || 0), v.hor); gl.uniform4f(u.uV2, v.F, -G.skyX * 0.9, v.camZ * 0.35 * v.dir + G.t * 6, 0);
    gl.uniform3fv(u.uS0, top); gl.uniform3fv(u.uS1, hz); gl.uniform3fv(u.uFogC, L.fogC);
    const cover = night ? 0.62 : cl === 'chuva' ? 0.18 : cl === 'neblina' ? 0.3 : cl === 'limpo' ? 0.56 : 0.4, cc = night ? 0.06 : cl === 'chuva' ? 0.42 : cl === 'limpo' ? 0.97 : 0.7;
    gl.uniform3f(u.uCC, cover, cc, night ? 0.6 : cl === 'limpo' ? 0.85 : 0.95);
    const ox = ((-G.skyX * 0.02) % W + W * 1.5) % W, pan = v.pan || 0;
    if (v.main && v.dir > 0 && st.sol && !night && cl === 'limpo') { gl.uniform4f(u.uSun, ox + pan * 0.3, v.hor - H * 0.07, H * 0.055, 1); gl.uniform3f(u.uSunK, 1.0, 0.86, 0.6); }
    else if (v.main && v.dir > 0 && night) { gl.uniform4f(u.uSun, W * 0.78 + pan * 0.2, H * 0.1, 14, 0.9); gl.uniform3f(u.uSunK, 0.85, 0.9, 1.0); }
    else gl.uniform4f(u.uSun, -999, -999, 1, 0);
    TEX3.clouds().bind(0); gl.uniform1i(u.uT, 0);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    quad.draw();
    // silhuetas distantes (morros/serra/mata/cidade) sobre a linha do horizonte
    const row = st.penhasco || st === STAGES[8] ? 1 : st === STAGES[3] || st === STAGES[9] ? 3 : st === STAGES[0] || st === STAGES[1] ? 2 : 0;
    const hc = night ? [0.02, 0.025, 0.04] : mixA(mixA(s1, fc, cl === 'limpo' ? 0.25 : 0.85), [0.15, 0.17, 0.2], cl === 'limpo' ? 0.35 : 0.1);
    const bh = H * (row === 1 ? 0.12 : 0.085), scroll = (-G.skyX * 0.012 + (v.dir < 0 ? 0.5 : 0)) % 1;
    screenQuad(TEX3.horizon(), 0, v.hor - bh, W, v.hor + 1.5, W, H, scroll, row / 4 + 0.004, scroll + W / (H * 3.2), (row + 1) / 4 - 0.002, hc, 1);
    // segunda camada mais perto e mais escura
    if (!night && cl === 'limpo') { const hc2 = mixA(hc, [0.12, 0.14, 0.12], 0.4); screenQuad(TEX3.horizon(), 0, v.hor - bh * 0.55, W, v.hor + 1.5, W, H, scroll * 1.7 + 0.37, ((row + 2) % 4) / 4 + 0.004, scroll * 1.7 + 0.37 + W / (H * 2.2), ((row + 2) % 4 + 1) / 4 - 0.002, hc2, 1); }
    // marcos (Congresso, Padre Cícero, navio) no horizonte
    if (v.main && v.dir > 0 && st.marco && G.prog >= st.mar && (cl === 'limpo' || st.marco === 'padre')) {
      const s = (H / 540) * (0.8 + (G.prog - st.mar) * 3), mx = W / 2 + pan * 0.5 + (W * 0.5 - ox) * 0.15, my = v.hor + 1;
      screenQuad(marcoTex(st.marco), mx - 400 * s, my - 110 * s, mx + 400 * s, my + 10 * s, W, H, 0, 0, 1, 1, [1, 1, 1], 1);
    }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  const marcos = {};
  function marcoTex(tipo) {
    return marcos[tipo] || (marcos[tipo] = TEX3.T(() => {
      const c = TEX3.cnv(1024, 154), x = c.getContext('2d'), m = TEX3.cnv(1024, 154), k = m.getContext('2d');
      x.fillStyle = '#7a8088'; x.fillRect(0, 0, 1024, 154);
      DRAW.marco(x, tipo, 512, 141, 1.28, 0); DRAW.marco(k, tipo, 512, 141, 1.28, 0);
      const d = k.getImageData(0, 0, 1024, 154).data; const md = k.createImageData(1024, 154); for (let i = 0; i < d.length; i += 4) { md.data[i] = md.data[i + 1] = md.data[i + 2] = d[i + 3]; md.data[i + 3] = 255; } k.putImageData(md, 0, 0);
      return TEX3.pack(c, m);
    }, { mip: false }));
  }
  function screenQuad(tex, x0, y0, x1, y1, W, H, u0, v0, u1, v1, col, a) {
    const d = D.scr; d.reset();
    const nx = (x) => x / W * 2 - 1, ny = (y) => 1 - y / H * 2;
    const i0 = d.v(nx(x0), ny(y1), 0, 0, 0, u0, v1, col[0], col[1], col[2], a, 0), i1 = d.v(nx(x1), ny(y1), 0, 0, 0, u1, v1, col[0], col[1], col[2], a, 0);
    const i2 = d.v(nx(x1), ny(y0), 0, 0, 0, u1, v0, col[0], col[1], col[2], a, 0), i3 = d.v(nx(x0), ny(y0), 0, 0, 0, u0, v0, col[0], col[1], col[2], a, 0);
    d.q(i0, i1, i2, i3);
    const p = P_QUAD.use(); tex.bind ? tex.bind(0) : 0; gl.uniform1i(p.u.uT, 0); gl.uniform1f(p.u.uOpaque, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); d.draw(); gl.disable(gl.BLEND);
  }

  /* ---------- objetos ---------- */
  const list = [];
  let boxMesh = null;
  function box() {
    if (boxMesh) return boxMesh;
    const b = new GL3.Builder(); b.mat = 1;
    const f = (nx, ny, nz, pts) => { const i = pts.map(p => b.vert(p[0], p[1], p[2], nx, ny, nz, 0.5, 0.5)); b.tri(i[0], i[1], i[2]); b.tri(i[0], i[2], i[3]); };
    f(0, 0, -1, [[-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 0, -0.5]]); f(0, 0, 1, [[0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5], [-0.5, 0, 0.5]]);
    f(-1, 0, 0, [[-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5], [-0.5, 0, -0.5]]); f(1, 0, 0, [[0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [0.5, 0, 0.5]]);
    f(0, 1, 0, [[-0.5, 1, -0.5], [-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5]]);
    return (boxMesh = b.mesh());
  }
  const TC = new Float32Array(3);
  function placeholder(x, y, z, w, h, d, hex, flash) {
    const c = rgbN(hex); TC[0] = c[0]; TC[1] = c[1]; TC[2] = c[2];
    const m = M4.place(mtx, x, y, z, 0, 1, DET, 1, 1); m[0] *= w; m[2] *= w; m[5] = h; m[8] *= d; m[10] *= d;
    R.model(box(), white, m, { t1: TC, flash });
  }

  /* ---------- quadro principal ---------- */
  // v = { W, H, hor, F, dir, flip, camX, camZ, camH, N, main, pan }
  function render(v, opt) {
    if (!ok || GL3.lost) return false;
    const st = G.st, W = v.W, H = v.H, hor = v.hor, F = v.F, dir = v.dir, fs = v.flip ? -1 : 1, N = Math.round(v.N), camH = v.camH, pan = v.pan || 0;
    FS = fs; DIR = dir; DET = fs * dir; VF = F; CX = W / 2 + pan; CY = hor;
    const base = Math.floor(v.camZ / SEG), frac = v.camZ / SEG - base, off = dir > 0 ? frac : 1 - frac, maxD = N * SEG;
    let x = 0, dx = 0; for (let n = 0; n <= N + 1; n++) { X[n] = x; x += dx; dx += curveAt(base + dir * n); }
    const vw = opt && opt.vp ? opt.vp : [0, 0, glcv.width, glcv.height];
    if (!opt || !opt.target) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vw[0], vw[1], vw[2], vw[3]);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const near = 0.25, far = maxD + 280;
    M4.proj(proj, F, W / 2 + pan, hor, W, H, near, far); pgen++;
    scene(v, maxD, opt);
    drawSky(v, W, H);
    gl.disable(gl.CULL_FACE);
    buildGround(v, base, off, N); drawGround();
    D.dec.reset(); D.add.reset(); D.sh.reset(); D.part.reset();
    roadDecals(v, base, off, N);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(DET > 0 ? gl.CW : gl.CCW);
    objects(v, W, H, base, off, N, maxD);
    if (opt && opt.player && typeof V3D !== 'undefined') V3D.drawPlayer(R, fs * (P.x - v.camX), -camH + opt.player.jumpH, 7.5 + V3D.playerModel(S.veh, S.up).rear, -camH, P.steer, G.t);
    flushInst();
    gl.disable(gl.CULL_FACE);
    flushDecals(); drawDecals(); drawShadows(); drawParts(); drawAdd();
    /* primeiro plano: cabine, capô, lataria, braços, armas e zumbis agarrados no carro. Profundidade própria e plano
       próximo de 3 cm (o mundo usa 25 cm), com a mesma focal e o mesmo centro: a projeção na tela não muda. */
    if (opt && (opt.hood || opt.near || (opt.latch && opt.latch.length))) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      M4.proj(proj, F, W / 2 + pan, hor, W, H, 0.03, 160); pgen++;
      D.add.reset(); D.part.reset(); gl.disable(gl.CULL_FACE);
      if (opt.near) opt.near(R, { W, H, F, cx: W / 2 + pan, cy: hor, fs, dir, camH, v });
      else if (opt.hood && typeof V3D !== 'undefined') V3D.drawHood(R, W, H, F, W / 2 + pan, hor, opt.hood.dashY, opt.hood.hoodH);
      if (opt.latch && typeof Z3D !== 'undefined') for (const L of opt.latch) {
        if (ENEMY[L.e.type].veh) continue;
        const z = F / L.k, x = (L.x - (W / 2 + pan)) * z / F, y = (hor - L.y) * z / F, side = L.e.side || 0, a = side ? -side * 0.55 * fs : 0;
        Z3D.drawLatch(R, L.e, x, y, z, [Math.sin(a), -Math.cos(a)]);
      }
      if (opt.nearAfter) opt.nearAfter(R);
      drawParts(); drawAdd();
    }
    return true;
  }

  function objects(v, W, H, base, off, N, maxD) {
    const st = G.st, F = v.F, dir = v.dir, fs = v.flip ? -1 : 1, hor = v.hor, camH = v.camH, pan = v.pan || 0, y0 = -camH;
    list.length = 0;
    const center = (dz) => { const nf = dz / SEG + off, n0 = Math.max(0, Math.floor(nf)), t = nf - n0; return X[n0] + (X[n0 + 1] - X[n0]) * t; };
    const slope = (dz) => { const nf = dz / SEG + off, n0 = Math.max(0, Math.min(N, Math.floor(nf))); return (X[n0 + 1] - X[n0]) / SEG; };
    const cen = st.cen2 && G.prog >= st.cen2From ? st.cen2 : st.cen, kmNow = Math.max(0, Math.round(st.km - (st.km - st.kmFim) * G.prog));
    const pedI = st.pedagio ? Math.floor(st.len * st.pedagio / SEG) : -1;
    for (let n = 1; n < N; n++) {
      const i = base + dir * n, dz = (n - off) * SEG; if (dz < 1.5) continue;
      if (i === pedI) list.push({ dz, wx: X[n] - ROADW - 1.5, t: 'pedagio', seed: i });
      if (isBridge(i * SEG)) { list.push({ dz, wx: X[n] - ROADW - 0.3, t: 'guarda', seed: i }); list.push({ dz, wx: X[n] + ROADW + 0.3, t: 'guarda', seed: i }); continue; }
      if (i % 120 === 60) { list.push({ dz, wx: X[n] + ROADW + 3, t: 'placa', seed: i, st: { txt1: (st.cidade || '').toUpperCase().slice(0, 14), txt2: 'FORTALEZA ' + kmNow + ' km' } }); continue; }
      if (i % 260 === 130) list.push({ dz, wx: X[n] - ROADW - 2.5, t: 'radar', seed: i });
      if (i % 3 !== 0) continue;
      for (let s = -1; s <= 1; s += 2) {
        if (st.penhasco) { if (s > 0) continue; if (i % 6 === 0) list.push({ dz, wx: X[n] - ROADW - 9, t: 'penhasco', seed: i }); else if (i % 6 === 3) list.push({ dz, wx: X[n] - ROADW - 4, t: cen[(DRAW.hash(i) * cen.length) | 0], seed: i }); continue; }
        const h = DRAW.hash(i * 3.1 + s * 17); if (h < 0.25 && v.main) continue; const t = cen[(DRAW.hash(i + s * 7) * cen.length) | 0];
        const wide = t === 'cana' || t === 'canafogo' || t === 'soja' || t === 'algodao' || t === 'posto' || t === 'predio' || t === 'ministerio' || t === 'carreta';
        list.push({ dz, wx: X[n] + s * (ROADW + (wide ? 9 : 4.5) + h * (wide ? 3 : 9)), t, seed: i * 2 + s, side: s });
      }
    }
    for (const e of G.ents) { if (e.dead || e.st === 'latch') continue; const dz = dir * (e.z - v.camZ); if (dz < 0.9 || dz > maxD) continue; list.push({ dz, wx: center(dz) + e.x, e }); }
    const b = G.boss; if (b && b.parts && b.fase !== 3 && b.fase !== 4) { const dz = dir * (P.z + b.rel - v.camZ); if (dz > 1.2 && dz < maxD + 200) list.push({ dz: Math.min(dz, maxD - 1), rdz: dz, wx: center(Math.min(dz, maxD - 1)) + b.x, boss: b }); }
    if (G.haz) for (const h of G.haz) { const dz = dir * (h.z - v.camZ); if (dz > 1 && dz < maxD) list.push({ dz, wx: center(dz) + h.x, haz: h }); }
    const ctx = { v, W, H, F, fs, dir, camH, y0, maxD, slope, center };
    for (const s of list) {
      const dzr = s.rdz || s.dz, k = F / dzr, sx = W / 2 + pan + fs * (s.wx - v.camX) * (F / s.dz) * (s.rdz ? s.dz / dzr : 1), sy = hor + camH * k;
      if (sx < -W * 0.6 || sx > W * 1.6) continue;
      const vx = fs * (s.wx - v.camX) * (s.rdz ? 1 : 1), vz = dzr;
      if (s.haz) { if (typeof FX3D !== 'undefined') FX3D.hazard(R, s.haz, vx, y0, vz, ctx); continue; }
      if (s.boss) {
        if (typeof B3D !== 'undefined') B3D.draw(R, b, vx, y0, vz, ctx); else placeholder(vx, y0, vz, b.w, b.h, 4, b.def.cor || '#555', 0);
        if (v.main) { b.sx = sx; b.sy = sy; b.sh = b.h * k; b.k = k; b.vf = G.frame; if (!(b.key === 'reidograu' && b.front)) for (const p of b.parts) if (!p.dead && p.vuln) G.hits.push({ part: p, x: sx + (p.ox - p.w / 2) * k - 2, y: sy - (p.oy + p.h) * k - 2, w: p.w * k + 4, h: p.h * k + 4, dz: dzr }); }
        continue;
      }
      if (s.e) {
        const e = s.e, d = ENEMY[e.type], hpx = d.h * k, lod = hpx < 9 ? 0 : hpx < 30 ? 1 : 2;
        if (typeof Z3D !== 'undefined' && (e.type === 'boi' || (!d.veh && !d.estatico && e.type !== 'rampa'))) Z3D.draw(R, e, vx, y0, vz, lod, ctx, s);
        else if (typeof V3D !== 'undefined') V3D.draw(R, e, vx, y0, vz, lod, ctx, s);
        else placeholder(vx, y0, vz, d.w, d.h, d.veh || d.estatico ? 4 : 0.35, d.veh || d.estatico ? (e.cor || d.cor) : DRAW.pele(e)[0], e.flash > 0 ? 0.6 : 0);
        if (v.main) { e.sx = sx; e.sy = sy; e.sh = hpx; e.vf = G.frame; if (!d.estatico) G.hits.push({ e, x: sx - d.w * k * 0.6, y: sy - hpx * 1.05, w: d.w * k * 1.2, h: hpx * 1.05, dz: s.dz }); }
        continue;
      }
      if (typeof S3D !== 'undefined') S3D.add(R, s, vx, y0, vz, ctx); else placeholder(vx, y0, vz, 2, 4, 2, '#4a5a3a', 0);
    }
    if (typeof Z3D !== 'undefined' && Z3D.corpses) Z3D.corpses(R, ctx);
    if (typeof S3D !== 'undefined') S3D.clutter(R, v, base, off, N, ctx);
    if (typeof FX3D !== 'undefined') FX3D.draw(R, ctx);
  }

  const mirT = new GL3.Target();
  // rv = vista de trás (como o 2D usava); rects = [[x, y, w, h, sx, sw], ...] em px virtuais da tela principal
  function mirror(rv, update, rects, tw, th, W, H) {
    if (!ok || GL3.lost) return false;
    if (update || !mirT.ok || mirT.w !== tw || mirT.h !== th) { if (!mirT.begin(tw, th)) { mirT.end(); return false; } render(rv, { target: true, vp: [0, 0, tw, th] }); mirT.end(); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, glcv.width, glcv.height); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    for (const r of rects) screenQuad(mirT, r[0], r[1], r[0] + r[2], r[1] + r[3], W, H, r[4] / 360, 1, (r[4] + r[5]) / 360, 0, [1, 1, 1], 1);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    return true;
  }
  // só atualiza a imagem do retrovisor (a cabine 3D cola essa imagem nos espelhos de verdade)
  function mirrorTex(rv, update, tw, th) {
    if (!ok || GL3.lost) return null;
    if (update || !mirT.ok || mirT.w !== tw || mirT.h !== th || mirT.gen !== GL3.gen) { if (!mirT.begin(tw, th)) { mirT.end(); return null; } render(rv, { target: true, vp: [0, 0, tw, th] }); mirT.end(); }
    return mirT.ok ? mirT : null;
  }
  /* aquecimento: gera texturas e compila tudo aos poucos enquanto o jogador está no menu (evita travadinha ao começar) */
  function warm() {
    if (!ok) return;
    const jobs = [() => TEX3.asphalt(false), () => TEX3.asphalt(true), () => TEX3.gravel(), () => TEX3.detail(), () => TEX3.macro(), () => TEX3.clouds(), () => TEX3.horizon(), () => TEX3.blob(), () => TEX3.glow(), () => TEX3.decals(), () => TEX3.water(), () => TEX3.cliff(),
      () => V3D.tex(), () => S3D.tex(), () => S3D.texB(), () => typeof GUN3D !== 'undefined' && GUN3D.tex(), () => typeof ARMS3D !== 'undefined' && ARMS3D.tex(), () => typeof CAB3D !== 'undefined' && CAB3D.tex()];
    for (let id = 0; id < 7; id++) jobs.push(() => Z3D.atlasFor(DRAW.pele({ id, type: 'andarilho' })));
    jobs.push(() => Z3D.atlasFor(DRAW.pele({ id: 0, type: 'engolidor' })));
    let i = 0;
    const step = () => {
      if (i >= jobs.length || GL3.lost) return;
      if (G.mode === 'play') { setTimeout(step, 400); return; }   // durante a partida, as texturas vêm sob demanda
      try { const t = jobs[i++](); if (t && t.bind) t.bind(0); } catch (e) { console.error(e); }
      setTimeout(step, 30);
    };
    setTimeout(step, 300);
  }
  function resize(w, h) { if (!glcv) return; if (glcv.width !== w || glcv.height !== h) { glcv.width = w; glcv.height = h; } }
  function clear() { if (!ok || GL3.lost) return; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, glcv.width, glcv.height); gl.clearColor(0.043, 0.039, 0.031, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }

  return { init, render, resize, clear, mirror, mirrorTex, warm, R, X, get ok() { return ok; }, get canvas() { return glcv; }, scene: L, Dyn, useProg: (p) => useProg(p), get progs() { return { P_MOD, P_SKIN, P_ADD, P_QUAD, P_DEC }; }, screenQuad, rgbN, mixA };
})();
