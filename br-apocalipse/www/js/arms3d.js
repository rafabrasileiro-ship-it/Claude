'use strict';
/* Braços dos jogadores em 3D (1ª pessoa): segmentos rígidos como nos personagens de PS1 — braço com a manga dobrada,
   antebraço de pele, luva com punho e a mão fechada em volta do que segura (volante, empunhadura, guarda-mão).
   Cinemática inversa de dois ossos: dados o ombro e a mão, o cotovelo cai no lugar certo, puxado por um vetor de polo.
   Cada classe com a sua manga, tom de pele, luva e detalhe (relógio, pulseira, tatuagem do Trovão, graxa da Graxa). */
const ARMS3D = (() => {
  const UV = K3.R(256), TAU = Math.PI * 2;
  const A = {
    CLOTH: UV(0, 0, 128, 128), CUFF: UV(128, 0, 256, 32), SKIN: UV(128, 32, 256, 96), SKINT: UV(128, 96, 256, 128),
    GLOVE: UV(0, 128, 128, 192), KNUCK: UV(128, 128, 256, 192), BAND: UV(0, 192, 64, 256), WATCH: UV(64, 192, 96, 224), SKIND: UV(128, 192, 256, 256),
  };
  let atlas = null;
  const tex = () => atlas || (atlas = TEX3.T(makeAtlas, { repeat: false }));
  function makeAtlas() {
    const S = 256, c = TEX3.cnv(S, S), x = c.getContext('2d'), r = TEX3.rng(777);
    x.fillStyle = '#888'; x.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip(); x.translate(x0, y0); f(x1 - x0, y1 - y0); x.restore(); };
    const fld = (w, h, n, ca, cb, grain, seed) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, n, ca, cb, grain, seed); x.drawImage(t, 0, 0); };
    // tecido (tingido pela cor da manga): trama, dobras, costura, poeira
    reg(0, 0, 128, 128, (w, h) => {
      fld(w, h, TEX3.fbm(w, h, 4, 4, 11, 0.55), [178, 178, 178], [222, 222, 222], 18, 1);
      x.globalAlpha = 0.18; x.fillStyle = '#000'; for (let y = 0; y < h; y += 2) x.fillRect(0, y, w, 1); for (let X = 0; X < w; X += 3) x.fillRect(X, 0, 1, h); x.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { const y = 10 + r() * (h - 20), g = x.createLinearGradient(0, y - 6, 0, y + 6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0.08)'); x.fillStyle = g; x.beginPath(); x.ellipse(w * (0.3 + r() * 0.4), y, w * 0.45, 5, (r() - 0.5) * 0.4, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(40,40,40,0.55)'; x.setLineDash([3, 2]); x.lineWidth = 1; x.beginPath(); x.moveTo(w * 0.5, 0); x.lineTo(w * 0.5, h); x.stroke(); x.setLineDash([]);
      for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(60,40,20,${0.08 + r() * 0.12})`; x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 8, 0, 7); x.fill(); }
    });
    // barra dobrada da manga: rolos de pano
    reg(128, 0, 256, 32, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 13, 0.5), [170, 170, 170], [215, 215, 215], 14, 2); for (let y = 0; y < h; y += 8) { const g = x.createLinearGradient(0, y, 0, y + 8); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.6, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.4)'); x.fillStyle = g; x.fillRect(0, y, w, 8); } });
    // pele (o tom vem da cor do vértice): poros, veias e pelos leves
    const skin = (w, h, seed) => { fld(w, h, TEX3.fbm(w, h, 6, 4, seed, 0.5), [196, 196, 196], [236, 236, 236], 10, seed); x.strokeStyle = 'rgba(70,80,120,0.12)'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(r() * w, 0); x.bezierCurveTo(r() * w, h * 0.3, r() * w, h * 0.7, r() * w, h); x.stroke(); } x.strokeStyle = 'rgba(40,30,20,0.25)'; x.lineWidth = 0.7; for (let i = 0; i < 60; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + 2, Y + 3); x.stroke(); } };
    reg(128, 32, 256, 96, (w, h) => skin(w, h, 21));
    reg(128, 96, 256, 128, (w, h) => { skin(w, h, 23); x.strokeStyle = 'rgba(30,50,110,0.85)'; x.fillStyle = 'rgba(30,50,110,0.55)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(w * 0.35, 6); x.lineTo(w * 0.65, 6); x.lineTo(w * 0.6, h - 6); x.lineTo(w * 0.4, h - 6); x.closePath(); x.stroke(); x.beginPath(); x.arc(w * 0.5, h * 0.42, 7, 0, 7); x.fill(); x.font = 'bold 7px Arial'; x.textAlign = 'center'; x.fillStyle = 'rgba(20,30,80,0.9)'; x.fillText('MÃE', w * 0.5, h * 0.8); });
    reg(128, 192, 256, 256, (w, h) => { skin(w, h, 27); for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(15,12,10,${0.15 + r() * 0.35})`; x.beginPath(); x.ellipse(r() * w, r() * h, 2 + r() * 10, 1 + r() * 4, r() * 3, 0, 7); x.fill(); } });
    // luva (tingida): couro com costuras e reforço nos nós dos dedos
    reg(0, 128, 128, 192, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 4, 31, 0.6), [150, 150, 150], [205, 205, 205], 22, 3); x.strokeStyle = 'rgba(30,30,30,0.6)'; x.setLineDash([2, 2]); x.lineWidth = 1; for (let X = 16; X < w; X += 32) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); } x.setLineDash([]); x.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 20; i++) x.fillRect(r() * w, r() * h, 6, 1); });
    reg(128, 128, 256, 192, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 33, 0.6), [140, 140, 140], [190, 190, 190], 20, 4); x.fillStyle = 'rgba(20,20,20,0.35)'; for (let X = 0; X < w; X += 32) x.fillRect(X + 4, 8, 24, h - 16); x.strokeStyle = 'rgba(255,255,255,0.15)'; for (let X = 0; X < w; X += 32) { x.beginPath(); x.moveTo(X + 6, 12); x.lineTo(X + 26, 12); x.stroke(); } });
    reg(0, 192, 64, 256, (w, h) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.3)'; for (let X = 0; X < w; X += 6) x.fillRect(X, 0, 2, h); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 2, w, 3); });
    reg(64, 192, 96, 224, (w, h) => { x.fillStyle = '#222'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8d8c8'; x.beginPath(); x.arc(16, 16, 12, 0, 7); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(16, 16); x.lineTo(16, 7); x.moveTo(16, 16); x.lineTo(22, 18); x.stroke(); });
    return TEX3.pack(c, 0);
  }

  /* ---------- malhas ---------- */
  // classe: cores e medidas (raio relativo), detalhe do pulso esquerdo, tatuagem/graxa
  const CL = {
    trovao: { k: 1.12, band: '#c9b060', tat: 1 }, graxa: { k: 0.9, band: '#8a8a8a', dirt: 1 },
    falcao: { k: 1.0, band: '#141414', watch: 1 }, cobra: { k: 1.08, band: '#3a4a2a' },
  };
  const L1 = 0.3, L2 = 0.27;   // braço e antebraço (m)
  const hexN = (h) => { const a = TEX3.hexRGB(h); return [a[0] / 255, a[1] / 255, a[2] / 255]; };
  // anéis de um tubo ao longo de +y: [y, raio x, raio z]
  function tube(b, rings, uv, sides, capT, capB) { Z3D.loft(b, rings.map(r => [r[0], r[1], r[2] || r[1]]), sides || 8, uv, capT, capB); }
  /* mão fechada (luva) no espaço da mão: punho na origem, +y para os nós dos dedos, +z = palma (lado do que segura),
     o objeto segurado é um cilindro de raio gr com eixo em x passando por (0, 0.075, 0.016 + gr). Polegar do lado −x (mão direita). */
  function hand(b, k, gr) {
    const cz = 0.016 + gr, cy = 0.075, s = k;
    b.mat = 2;
    // punho da luva e dorso
    let m = K3.mark(b); tube(b, [[-0.03, 0.036 * s, 0.03 * s], [0.0, 0.034 * s, 0.028 * s], [0.012, 0.035 * s, 0.027 * s]], A.GLOVE, 8, false, true);
    m = K3.mark(b); K3.box(b, -0.041 * s, 0.041 * s, 0.006, 0.085, -0.015 * s, 0.016 * s, A.GLOVE);
    // dedos: quatro arcos de três falanges em volta do cilindro
    for (let f = 0; f < 4; f++) {
      const fx = (-0.03 + f * 0.02) * s, w = 0.0085 * s * (f === 3 ? 0.85 : 1), len = f === 3 ? 0.8 : f === 0 ? 0.95 : 1;
      let a0 = -Math.PI * 0.62;   // começa por cima/atrás do cilindro, desce pela frente e volta para a palma
      const R0 = gr + 0.012 * s;
      for (let j = 0; j < 3; j++) {
        const a1 = a0 + 0.95 * len, am = (a0 + a1) / 2, rr = R0;
        const p0 = [fx, cy + Math.cos(a0) * rr * -1, cz + Math.sin(a0) * rr], p1 = [fx, cy + Math.cos(a1) * rr * -1, cz + Math.sin(a1) * rr];
        const dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dy, dz) || 0.01, mm = K3.mark(b);
        K3.box(b, -w, w, -0.009 * s, 0.009 * s, 0, L + 0.004, j === 0 ? A.KNUCK : A.GLOVE);
        Z3D.xform(b, mm, Math.atan2(-dy, dz), 0, 0, p0[0], p0[1], p0[2]);
        a0 = a1; void am;
      }
    }
    // polegar: sai do lado −x perto do punho e abraça o cilindro pelo outro lado
    const t0 = [-0.04 * s, 0.03, 0.012], t1 = [-0.03 * s, 0.07, cz + gr * 0.2], t2 = [-0.012 * s, 0.085, cz + gr * 0.9];
    for (const [p, q] of [[t0, t1], [t1, t2]]) {
      const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz), mm = K3.mark(b);
      K3.box(b, -0.011 * s, 0.011 * s, -0.009 * s, 0.009 * s, 0, L + 0.006, A.GLOVE);
      Z3D.xform(b, mm, Math.atan2(-dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, p[0], p[1], p[2]);
    }
  }
  const cache = {};
  // mesh do braço (direito; o esquerdo é o espelho). Ossos: 0 braço, 1 antebraço, 2 mão. gr = raio do que a mão segura.
  function armMesh(clsId, left, gr) {
    const key = clsId + (left ? 'L' : 'R') + gr; if (cache[key]) return cache[key];
    const c = CLASSES.find(q => q.id === clsId) || CLASSES[0], o = CL[clsId] || CL.trovao, k = o.k, b = new GL3.Builder();
    const skinC = hexN(c.skin);
    // braço (manga): bone 0, de 0 (ombro) a L1 (cotovelo)
    b.bone = 0; b.mat = 1; b.col = [1, 1, 1];
    tube(b, [[-0.03, 0.06 * k, 0.055 * k], [0.08, 0.058 * k, 0.052 * k], [0.2, 0.052 * k, 0.048 * k], [L1 - 0.045, 0.049 * k, 0.045 * k]], A.CLOTH, 9, false, true);
    tube(b, [[L1 - 0.06, 0.053 * k, 0.05 * k], [L1 - 0.035, 0.058 * k, 0.054 * k], [L1 - 0.012, 0.055 * k, 0.051 * k], [L1 + 0.005, 0.047 * k, 0.044 * k]], A.CUFF, 9, true, true);
    // antebraço (pele): bone 1, cotovelo → punho
    b.bone = 1; b.mat = 0; b.col = skinC;
    const sk = o.tat && !left ? A.SKINT : o.dirt ? A.SKIND : A.SKIN;
    tube(b, [[-0.02, 0.041 * k, 0.038 * k], [0.06, 0.043 * k, 0.037 * k], [0.16, 0.036 * k, 0.03 * k], [L2 - 0.01, 0.029 * k, 0.025 * k], [L2 + 0.01, 0.028 * k, 0.024 * k]], sk, 9, false, false);
    if (left) { b.col = hexN(o.band); tube(b, [[L2 - 0.045, 0.032 * k, 0.028 * k], [L2 - 0.025, 0.032 * k, 0.028 * k]], A.BAND, 9, false, false); if (o.watch) { b.col = [1, 1, 1]; const m = K3.mark(b); K3.box(b, -0.014, 0.014, L2 - 0.05, L2 - 0.02, -0.004, 0.004, A.WATCH); Z3D.xform(b, m, 0, 0, 0, 0, 0, 0.03 * k); } }
    // mão (luva): bone 2
    b.bone = 2; b.col = [1, 1, 1]; hand(b, k, gr);
    if (left) for (let o2 = 0; o2 < b.v.length; o2 += GL3.STRIDE) { b.v[o2] = -b.v[o2]; b.v[o2 + 3] = -b.v[o2 + 3]; }
    return (cache[key] = { mesh: b.mesh(), sleeve: hexN(c.sleeve), glove: hexN(c.glove) });
  }

  /* ---------- poses ---------- */
  const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  };
  // ortonormaliza: y = eixo principal, z aproximado → base [x, y, z] com x = y × z
  function basis(y, zApprox) { const Y = v3.norm(y); let Z = v3.sub(zApprox, v3.mul(Y, v3.dot(zApprox, Y))); if (v3.len(Z) < 1e-5) Z = Math.abs(Y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; Z = v3.norm(v3.sub(Z, v3.mul(Y, v3.dot(Z, Y)))); return [v3.cross(Y, Z), Y, Z]; }
  // linha do osso (3 linhas × 4) a partir da base e da origem; mir = espelhar x da vista
  function rows(out, o, B, P, mir) {
    const m = mir ? -1 : 1;
    out[o] = B[0][0] * m; out[o + 1] = B[1][0] * m; out[o + 2] = B[2][0] * m; out[o + 3] = P[0] * m;
    out[o + 4] = B[0][1]; out[o + 5] = B[1][1]; out[o + 6] = B[2][1]; out[o + 7] = P[1];
    out[o + 8] = B[0][2]; out[o + 9] = B[1][2]; out[o + 10] = B[2][2]; out[o + 11] = P[2];
  }
  const BONES = new Float32Array(12 * 3), IDM = GL3.M4.make();
  /* desenha um braço. sh = ombro, hp = ponto do eixo do que a mão segura, hy = direção punho→dedos, hz = palma→objeto,
     pole = para onde o cotovelo aponta; tudo no espaço da vista (sem espelho). mir = espelha tudo em x (canhoto/lado do carro). */
  function draw(R, clsId, left, sh, hp, hy, hz, pole, gr, mir, o) {
    const am = armMesh(clsId, left, gr || 0.018), k = (CL[clsId] || CL.trovao).k;
    // base da mão: y = punho→dedos, z = palma; para a mão esquerda (malha espelhada) o eixo x inverte
    const HB = basis(hy, hz); if (left) HB[0] = v3.mul(HB[0], -1);
    const cz = 0.016 + (gr || 0.018), local = [0, 0.075, cz];
    const wrist = v3.sub(hp, v3.add(v3.add(v3.mul(HB[0], local[0]), v3.mul(HB[1], local[1])), v3.mul(HB[2], local[2])));
    // dois ossos: cotovelo pelo polo
    const d = v3.sub(wrist, sh), dl = Math.max(0.05, Math.min(L1 + L2 - 0.004, v3.len(d))), dn = v3.norm(d);
    const a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let pn = v3.sub(pole, v3.mul(dn, v3.dot(pole, dn))); if (v3.len(pn) < 1e-5) pn = [0, -1, 0]; pn = v3.norm(pn);
    const elbow = v3.add(v3.add(sh, v3.mul(dn, a)), v3.mul(pn, h)), wr2 = v3.add(sh, v3.mul(dn, dl));
    const UB = basis(v3.sub(elbow, sh), pn), FB = basis(v3.sub(wr2, elbow), HB[2]);
    if (left) { UB[0] = v3.mul(UB[0], -1); FB[0] = v3.mul(FB[0], -1); }
    rows(BONES, 0, UB, sh, mir); rows(BONES, 12, FB, elbow, mir); rows(BONES, 24, HB, wr2, mir);
    R.skin(am.mesh, tex(), IDM, BONES, { t1: am.sleeve, t2: am.glove, glow: 0, spec: 0.05, flash: (o && o.flash) || 0 });
    return { elbow, wrist: wr2, k };
  }
  return { draw, tex, armMesh, basis, v3, L1, L2 };
})();
