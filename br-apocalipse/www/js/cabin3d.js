'use strict';
/* Cabine do Piloto em 3D: painel com mostradores retroiluminados e ponteiros de verdade, LEDs de alerta, régua de
   blindagem, rádio e o mapa de papel no porta-luvas; volante que gira com as mãos agarradas (braços por cinemática
   inversa), alavanca de câmbio que a mão direita troca a cada marcha, colunas, teto, para-sóis, retrovisores 3D com a
   imagem de trás, pingente pendurado que balança com as curvas e freadas, limpadores, telas e chapas nas janelas,
   o capô de verdade (com para-choques, lâminas e motosserras) e a arma do capô. Tudo preso à carroceria: a cabine
   rola, arfa e trepida com a física (CARFX) enquanto o olhar do motorista fica estável no horizonte. */
const CAB3D = (() => {
  const M4 = GL3.M4, v3 = ARMS3D.v3, PI = Math.PI, TAU = PI * 2, UV = K3.R(512);
  const clampN = (v, a, b) => v < a ? a : v > b ? b : v, ss = (t) => { t = clampN(t, 0, 1); return t * t * (3 - 2 * t); };
  // E = olho no espaço do carro; zc = base do para-brisa; drop/dz = borda do painel (abaixo do olho / à frente);
  // wr = raio do volante; wt = inclinação; roof = teto acima do olho; pw = colunas (x à esquerda e à direita)
  const CP = [null,
    { E: [-0.3, 1.15, 0.05], zc: 0.95, drop: 0.23, dz: 0.9, wr: 0.185, wt: 0.42, roof: 0.31, pw: [-0.5, 1.1], dash: [0.42, 0.4, 0.37], seat: [0.5, 0.36, 0.26] },
    { E: [-0.32, 1.2, 0.2], zc: 1.12, drop: 0.25, dz: 0.92, wr: 0.205, wt: 0.36, roof: 0.27, pw: [-0.58, 1.22], dash: [0.46, 0.36, 0.28], seat: [0.55, 0.4, 0.28] },
    { E: [-0.33, 1.5, 0.45], zc: 1.38, drop: 0.31, dz: 0.88, wr: 0.19, wt: 0.42, roof: 0.3, pw: [-0.6, 1.26], dash: [0.4, 0.4, 0.41], seat: [0.36, 0.36, 0.36] },
    { E: [-0.35, 2.0, 1.75], zc: 2.3, drop: 0.3, dz: 0.8, wr: 0.21, wt: 0.26, roof: 0.3, pw: [-0.65, 1.35], dash: [0.5, 0.53, 0.55], seat: [0.3, 0.32, 0.33] },
    { E: [-0.45, 2.6, -0.25], zc: 0.65, drop: 0.31, dz: 0.85, wr: 0.235, wt: 0.2, roof: 0.42, pw: [-0.8, 1.7], dash: [0.52, 0.42, 0.33], seat: [0.55, 0.14, 0.12] },
  ];
  /* ---------- atlas da cabine (materiais + mostradores + dígitos + pingentes) ---------- */
  const A = {
    DASH: UV(0, 0, 128, 64), LEATH: UV(128, 0, 192, 64), VINYL: UV(192, 0, 256, 64), CLOTH: UV(256, 0, 320, 64), METAL: UV(320, 0, 384, 64), CHROME: UV(384, 0, 448, 64), RUBBER: UV(448, 0, 512, 64),
    RPM: UV(0, 64, 128, 192), KMH: UV(128, 64, 256, 192), FUEL: UV(256, 64, 320, 128), TEMP: UV(320, 64, 384, 128), LEDLB: UV(256, 128, 512, 160), ARMLB: UV(256, 160, 512, 192),
    DIG: UV(0, 192, 352, 224), WHITE: UV(354, 194, 362, 202), GRAY: UV(366, 194, 374, 202), BLACK: UV(378, 194, 386, 202), STICK: UV(390, 192, 454, 224), VENT: UV(454, 192, 512, 224),
    GRID: UV(0, 224, 128, 288), PLATE: UV(128, 224, 256, 288), BROKEN: UV(256, 224, 320, 288), HUB: UV(320, 224, 384, 288), CROSS: UV(384, 224, 416, 256), DICE: UV(416, 224, 448, 256), PEPPER: UV(448, 224, 480, 256), BEAD: UV(480, 224, 512, 256),
    WIPER: UV(384, 256, 512, 272), SEAT: UV(0, 288, 128, 352), CARPET: UV(128, 288, 256, 352), PANEL: UV(256, 288, 384, 352), KNOB: UV(384, 288, 448, 352), BOOT: UV(448, 288, 512, 352),
  };
  let atlas = null;
  const tex = () => atlas || (atlas = TEX3.T(makeAtlas, { repeat: false }));
  function makeAtlas() {
    const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(31337);
    x.fillStyle = '#444'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip(); q.translate(x0, y0); } f(x1 - x0, y1 - y0); x.restore(); k.restore(); };
    const fld = (w, h, n, ca, cb, grain, seed) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, n, ca, cb, grain, seed); x.drawImage(t, 0, 0); };
    // plástico do painel (o tom vem da cor do vértice), couro do volante, vinil da porta, forro, metal, cromo, borracha
    reg(0, 0, 128, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 32, 2, 3, 0.6), [150, 150, 150], [185, 185, 185], 22, 3); x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) x.fillRect(r() * w, r() * h, 10 + r() * 30, 1); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 4; i++) x.fillRect(0, r() * h, w, 1); });
    reg(128, 0, 192, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 3, 5, 0.6), [26, 24, 22], [48, 44, 40], 14, 5); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, 8, w, 6); });
    reg(192, 0, 256, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 7, 0.6), [36, 32, 30], [58, 52, 48], 12, 7); x.strokeStyle = 'rgba(0,0,0,0.5)'; for (let y = 10; y < h; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } });
    reg(256, 0, 320, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 3, 9, 0.6), [150, 144, 132], [190, 182, 168], 18, 9); x.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1); });
    reg(320, 0, 384, 64, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8a8e92'); g.addColorStop(0.5, '#4a4e52'); g.addColorStop(1, '#6a6e72'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    reg(384, 0, 448, 64, (w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f0f2f4'); g.addColorStop(0.5, '#70767c'); g.addColorStop(1, '#d0d4d8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    reg(448, 0, 512, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 2, 11, 0.5), [14, 14, 14], [28, 28, 28], 8, 11); });
    // mostradores (retroiluminados: alfa = brilho)
    const dial = (w, h, max, step, red, label, sub) => {
      const cx = w / 2, cy = h / 2, R0 = w * 0.47;
      x.fillStyle = '#060606'; x.fillRect(0, 0, w, h); x.fillStyle = '#0d0f0e'; x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.fill();
      x.strokeStyle = '#3a3a36'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.stroke();
      const a0 = PI * 0.75, a1 = PI * 2.25, n = Math.round(max / step);
      if (red) { x.strokeStyle = '#d0281a'; x.lineWidth = w * 0.05; x.beginPath(); x.arc(cx, cy, R0 * 0.84, a0 + (a1 - a0) * red, a1); x.stroke(); }
      x.strokeStyle = '#e8f0e8'; x.fillStyle = '#e8f0e8'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `bold ${w * 0.11 | 0}px Arial`;
      for (let i = 0; i <= n * 2; i++) { const a = a0 + (a1 - a0) * i / (n * 2), big = i % 2 === 0; x.lineWidth = big ? 3 : 1.5; x.beginPath(); x.moveTo(cx + Math.cos(a) * R0 * (big ? 0.76 : 0.83), cy + Math.sin(a) * R0 * (big ? 0.76 : 0.83)); x.lineTo(cx + Math.cos(a) * R0 * 0.92, cy + Math.sin(a) * R0 * 0.92); x.stroke(); if (big) x.fillText(String(i / 2 * step), cx + Math.cos(a) * R0 * 0.6, cy + Math.sin(a) * R0 * 0.6); }
      x.font = `${w * 0.075 | 0}px Arial`; x.fillStyle = '#9ac0a0'; x.fillText(label, cx, cy + R0 * 0.42); if (sub) x.fillText(sub, cx, cy - R0 * 0.3);
      k.fillStyle = '#fff'; k.beginPath(); k.arc(cx, cy, R0, 0, 7); k.fill();
    };
    reg(0, 64, 128, 192, (w, h) => dial(w, h, 8, 1, 0.8, 'RPM x1000'));
    reg(128, 64, 256, 192, (w, h) => dial(w, h, 200, 20, 0, 'km/h'));
    const mini = (w, h, l0, l1, lab, red) => { x.fillStyle = '#060606'; x.fillRect(0, 0, w, h); const cx = w / 2, cy = h * 0.58, R0 = w * 0.44; x.fillStyle = '#0d0f0e'; x.beginPath(); x.arc(cx, cy, R0, 0, 7); x.fill(); x.strokeStyle = '#e8f0e8'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { const a = PI * 1.15 + PI * 0.7 * i / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * R0 * 0.7, cy + Math.sin(a) * R0 * 0.7); x.lineTo(cx + Math.cos(a) * R0 * 0.9, cy + Math.sin(a) * R0 * 0.9); x.stroke(); } if (red) { x.strokeStyle = '#d0281a'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, R0 * 0.8, PI * 1.15 + PI * 0.7 * 0.8, PI * 1.85); x.stroke(); } x.fillStyle = '#e8f0e8'; x.font = 'bold 9px Arial'; x.textAlign = 'center'; x.fillText(l0, cx - R0 * 0.62, cy + 2); x.fillText(l1, cx + R0 * 0.62, cy + 2); x.fillStyle = '#9ac0a0'; x.fillText(lab, cx, cy + R0 * 0.55); k.fillStyle = '#fff'; k.beginPath(); k.arc(cx, cy, R0, 0, 7); k.fill(); };
    reg(256, 64, 320, 128, (w, h) => mini(w, h, 'E', 'F', 'COMB'));
    reg(320, 64, 384, 128, (w, h) => mini(w, h, 'C', 'H', 'TEMP', 1));
    reg(256, 128, 512, 160, (w, h) => { x.fillStyle = '#0a0a09'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8d0c8'; x.font = 'bold 13px Arial'; x.textAlign = 'center'; ['◀ ESQ', 'CAPÔ', 'DIR ▶', 'TEMP', 'COMB', 'PNEU'].forEach((t, i) => x.fillText(t, (i + 0.5) * w / 6, 21)); k.fillStyle = '#666'; k.fillRect(0, 0, w, h); });
    reg(256, 160, 512, 192, (w, h) => { x.fillStyle = '#0a0a09'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8d0c8'; x.font = 'bold 10px Arial'; x.textAlign = 'left'; x.fillText('BLINDAGEM', 6, 10); x.fillStyle = '#161616'; x.fillRect(4, 13, w - 8, 17); k.fillStyle = '#555'; k.fillRect(0, 0, w, h); });
    // dígitos (velocidade e marcha): 0-9, R, N
    reg(0, 192, 352, 224, (w, h) => { x.fillStyle = '#040604'; x.fillRect(0, 0, w, h); x.fillStyle = '#8affa0'; x.font = 'bold 26px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; '0123456789RN'.split('').forEach((ch, i) => x.fillText(ch, i * 29 + 14.5, 17)); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    reg(354, 194, 362, 202, (w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    reg(366, 194, 374, 202, (w, h) => { x.fillStyle = '#3a3a36'; x.fillRect(0, 0, w, h); });
    reg(378, 194, 386, 202, (w, h) => { x.fillStyle = '#080808'; x.fillRect(0, 0, w, h); });
    reg(390, 192, 454, 224, (w, h) => { x.fillStyle = '#c9b060'; x.fillRect(0, 0, w * 0.55, h); x.fillStyle = '#2a6a3a'; x.fillRect(w * 0.6, 0, w * 0.4, h); x.fillStyle = '#111'; x.font = 'bold 9px Arial'; x.textAlign = 'center'; x.fillText('SEM', w * 0.27, 12); x.fillText('PARAR', w * 0.27, 24); });
    reg(454, 192, 512, 224, (w, h) => { x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, w, h); x.fillStyle = '#2e2e2e'; for (let y = 3; y < h; y += 6) x.fillRect(2, y, w - 4, 3); });
    // tela de arame (recorte por alfa), chapa de aço, espelho quebrado, miolo do volante, pingentes
    reg(0, 224, 128, 288, (w, h) => { x.fillStyle = '#26282a'; x.fillRect(0, 0, w, h); k.fillStyle = '#000'; k.fillRect(0, 0, w, h); k.fillStyle = '#fff'; for (let i = 0; i < w; i += 16) { k.fillRect(i, 0, 3, h); k.fillRect(0, i % h, w, 3); } x.fillStyle = '#8a8e90'; for (let i = 0; i < w; i += 16) { x.fillRect(i, 0, 3, h); x.fillRect(0, i % h, w, 3); } });
    reg(128, 224, 256, 288, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 13, 0.6), [34, 32, 30], [58, 54, 50], 12, 13); x.fillStyle = '#6a6660'; for (let X = 10; X < w; X += 36) { x.beginPath(); x.arc(X, 8, 3, 0, 7); x.arc(X, h - 8, 3, 0, 7); x.fill(); } });
    reg(256, 224, 320, 288, (w, h) => { x.fillStyle = '#15181a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a98a8'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(r() * w, r() * h); x.stroke(); } });
    reg(320, 224, 384, 288, (w, h) => { const g = x.createRadialGradient(26, 26, 2, 32, 32, 32); g.addColorStop(0, '#4a4a48'); g.addColorStop(1, '#141412'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#9a9c9e'; x.font = 'bold 11px Arial'; x.textAlign = 'center'; x.fillText('BR-116', 32, 36); });
    reg(384, 224, 416, 256, (w, h) => { x.fillStyle = '#e0b830'; x.fillRect(0, 0, w, h); });
    reg(416, 224, 448, 256, (w, h) => { x.fillStyle = '#f0f0ec'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (const [X, Y] of [[8, 8], [16, 16], [24, 24]]) { x.beginPath(); x.arc(X, Y, 2.5, 0, 7); x.fill(); } });
    reg(448, 224, 480, 256, (w, h) => { x.fillStyle = '#c01810'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(6, 4, 4, 18); });
    reg(480, 224, 512, 256, (w, h) => { x.fillStyle = '#8a6a3a'; x.fillRect(0, 0, w, h); });
    reg(384, 256, 512, 272, (w, h) => { x.fillStyle = '#101010'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2a2a'; x.fillRect(0, h * 0.6, w, 3); });
    reg(0, 288, 128, 352, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 15, 0.6), [150, 150, 150], [190, 190, 190], 16, 15); x.strokeStyle = 'rgba(0,0,0,0.4)'; for (let X = 16; X < w; X += 24) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); } });
    reg(128, 288, 256, 352, (w, h) => fld(w, h, TEX3.fbm(w, h, 32, 2, 17, 0.6), [24, 24, 24], [40, 40, 38], 18, 17));
    reg(256, 288, 384, 352, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 3, 19, 0.6), [40, 38, 36], [60, 56, 52], 10, 19); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, h * 0.4, w, 4); });
    reg(384, 288, 448, 352, (w, h) => { const g = x.createRadialGradient(24, 22, 2, 32, 32, 32); g.addColorStop(0, '#5a5a58'); g.addColorStop(1, '#0c0c0c'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#c8c8c0'; x.font = 'bold 8px Arial'; x.textAlign = 'center'; x.fillText('1 3 5', 32, 26); x.fillText('2 4 R', 32, 42); });
    reg(448, 288, 512, 352, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 2, 21, 0.6), [16, 16, 16], [30, 30, 30], 8, 21); x.strokeStyle = 'rgba(0,0,0,0.6)'; for (let y = 6; y < h; y += 8) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } });
    return TEX3.pack(c, m);
  }
  /* rádio e mapa: canvas que muda de vez em quando (troca de estação, avanço no mapa) */
  let infoC = null, infoT = null, infoKey = '';
  function infoTex() {
    if (!infoC) { infoC = TEX3.cnv(256, 256); infoT = TEX3.T(() => infoC, { repeat: false, mip: false }); }
    const r = RADIO[G.radio] || RADIO[0], st = G.st, done = (G.arena ? 3 : S.stage) + G.prog, key = G.radio + '|' + (st && st.musica) + '|' + Math.round(done * 150);
    if (key !== infoKey) {
      infoKey = key; const x = infoC.getContext('2d');
      x.fillStyle = '#050805'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#12301a'; x.fillRect(6, 6, 244, 52);
      x.fillStyle = '#6aff8a'; x.font = 'bold 18px monospace'; x.textAlign = 'left'; x.fillText(G.radio === 0 ? ((st && st.musica) || '').toUpperCase() + ' · AUTO' : r.nome, 14, 30, 228); x.font = '15px monospace'; x.fillText(r.freq, 14, 50);
      // mapa de papel com a rota até Fortaleza
      x.save(); x.translate(0, 64); const mw = 256, mh = 192; x.fillStyle = '#d8cfae'; x.fillRect(0, 0, mw, mh); x.fillStyle = 'rgba(120,100,60,0.25)'; for (let i = 0; i < 5; i++) x.fillRect(0, (i + 1) * mh / 6, mw, 1); x.fillRect(mw / 2, 0, 1, mh);
      x.strokeStyle = '#8a8266'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(mw * 0.45, mh * 0.05); x.lineTo(mw * 0.95, mh * 0.2); x.lineTo(mw * 0.8, mh * 0.6); x.lineTo(mw * 0.55, mh * 0.95); x.lineTo(mw * 0.35, mh * 0.7); x.lineTo(mw * 0.08, mh * 0.4); x.lineTo(mw * 0.25, mh * 0.12); x.closePath(); x.stroke();
      const pts = [[0.5, 0.82], [0.53, 0.76], [0.5, 0.68], [0.47, 0.6], [0.54, 0.56], [0.62, 0.45], [0.66, 0.42], [0.78, 0.3], [0.82, 0.26], [0.84, 0.22], [0.86, 0.12]];
      x.strokeStyle = '#c22'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i === 0) x.moveTo(p[0] * mw, p[1] * mh); else if (i <= done) x.lineTo(p[0] * mw, p[1] * mh); else { const q = pts[i - 1], f = clampN(done - (i - 1), 0, 1); x.lineTo((q[0] + (p[0] - q[0]) * f) * mw, (q[1] + (p[1] - q[1]) * f) * mh); break; } } x.stroke();
      x.fillStyle = '#333'; for (const p of pts) x.fillRect(p[0] * mw - 2, p[1] * mh - 2, 4, 4); x.font = 'bold 11px Arial'; x.fillText('BAURU', mw * 0.36, mh * 0.9); x.fillText('FORTALEZA', mw * 0.55, mh * 0.08); x.restore();
      infoT.update();
    }
    return infoT;
  }

  /* ---------- malhas ---------- */
  const cache = {};
  function torus(b, R, r, segs, sides, uv, a0, a1) {
    const base = b.v.length / GL3.STRIDE, A0 = a0 || 0, A1 = a1 === undefined ? TAU : a1;
    for (let i = 0; i <= segs; i++) { const a = A0 + (A1 - A0) * i / segs, ca = Math.cos(a), sa = Math.sin(a); for (let j = 0; j <= sides; j++) { const t = j / sides * TAU, ct = Math.cos(t), st = Math.sin(t), nx = ct * ca, ny = ct * sa, nz = st; b.vert(R * ca + r * nx, R * sa + r * ny, r * nz, nx, ny, nz, uv[0] + (uv[2] - uv[0]) * i / segs, uv[1] + (uv[3] - uv[1]) * j / sides); } }
    for (let i = 0; i < segs; i++) for (let j = 0; j < sides; j++) { const a = base + i * (sides + 1) + j, c = a + sides + 1; b.tri(a, c, c + 1); b.tri(a, c + 1, a + 1); }
  }
  // quadrilátero solto (já com a normal) — K3.quad cuida da orientação
  // quadrilátero de uma face, com a normal virada para o olho (origem)
  const quad = (b, p0, p1, p2, p3, uv) => { const u = v3.sub(p1, p0), w = v3.sub(p3, p0); let n = v3.norm(v3.cross(w, u)); const ce = v3.mul(v3.add(v3.add(p0, p1), v3.add(p2, p3)), 0.25); if (v3.dot(n, ce) > 0) n = v3.mul(n, -1); K3.quad(b, p0, p1, p2, p3, n, uv, false); };
  function cabinMesh(veh) {
    if (cache['c' + veh]) return cache['c' + veh];
    const c = CP[veh], b = new GL3.Builder(), D = c.drop, Z = c.dz, L = c.pw[0], Rr = c.pw[1], top = c.roof, wx = -0.1;
    const zN = Z - 0.24, cw = 0.19, zF = Z - 0.1, hy = -D + 0.035, fy = -D - 0.15, dk = c.dash, dd = [dk[0] * 0.7, dk[1] * 0.7, dk[2] * 0.7], lt = [Math.min(1, dk[0] * 1.35), Math.min(1, dk[1] * 1.35), Math.min(1, dk[2] * 1.35)];
    b.mat = 0;
    // tampo do painel com o nicho dos instrumentos recortado na frente do motorista
    b.col = lt;
    quad(b, [L, -D, Z + 0.02], [L, -D - 0.015, zN], [wx - cw, -D - 0.015, zN], [wx - cw, -D, Z + 0.02], A.DASH);
    quad(b, [wx + cw, -D, Z + 0.02], [wx + cw, -D - 0.015, zN], [Rr, -D - 0.015, zN], [Rr, -D, Z + 0.02], A.DASH);
    quad(b, [wx - cw, -D, Z + 0.02], [wx - cw, -D - 0.005, zF + 0.02], [wx + cw, -D - 0.005, zF + 0.02], [wx + cw, -D, Z + 0.02], A.DASH);
    // capuz curvo por cima dos mostradores
    b.col = dk;
    for (let i = 0; i < 8; i++) { const a0 = PI * i / 8, a1 = PI * (i + 1) / 8, p = (a) => [wx - Math.cos(a) * cw, -D - 0.01 + Math.sin(a) * (hy + D + 0.01), 0]; const P0 = p(a0), P1 = p(a1); quad(b, [P0[0], P0[1], zN + 0.01], [P0[0], P0[1], zF + 0.025], [P1[0], P1[1], zF + 0.025], [P1[0], P1[1], zN + 0.01], A.DASH); }
    // paredes e fundo do nicho
    b.col = dd;
    for (const sx of [-1, 1]) quad(b, [wx + sx * cw, -D - 0.01, zN + 0.01], [wx + sx * cw, fy, zN + 0.01], [wx + sx * cw, fy, zF], [wx + sx * cw, -D - 0.01, zF], A.DASH);
    quad(b, [wx - cw, fy, zN + 0.01], [wx - cw, fy, zF], [wx + cw, fy, zF], [wx + cw, fy, zN + 0.01], A.DASH);
    quad(b, [wx - cw, -D + 0.01, zF + 0.012], [wx - cw, fy, zF + 0.012], [wx + cw, fy, zF + 0.012], [wx + cw, -D + 0.01, zF + 0.012], A.DASH);
    // frente do painel caindo até os joelhos, com a borda acolchoada
    b.col = dk;
    quad(b, [L, -D - 0.015, zN], [L, -D - 0.58, zN - 0.07], [wx - cw, -D - 0.58, zN - 0.07], [wx - cw, -D - 0.015, zN], A.DASH);
    quad(b, [wx + cw, -D - 0.015, zN], [wx + cw, -D - 0.58, zN - 0.07], [Rr, -D - 0.58, zN - 0.07], [Rr, -D - 0.015, zN], A.DASH);
    quad(b, [wx - cw, fy, zN + 0.01], [wx - cw, -D - 0.58, zN - 0.06], [wx + cw, -D - 0.58, zN - 0.06], [wx + cw, fy, zN + 0.01], A.DASH);
    b.col = [0.16, 0.15, 0.14]; K3.box(b, L, Rr, -D - 0.032, -D - 0.008, zN - 0.012, zN + 0.004, A.LEATH);
    // console do rádio e porta-luvas (caixas na frente do painel)
    b.col = dk; K3.box(b, 0.16, 0.44, -D - 0.17, -D - 0.045, zN - 0.04, zN + 0.01, A.DASH); K3.box(b, 0.14, 0.46, -D - 0.62, -D - 0.17, zN - 0.13, zN, A.DASH);
    const gx1 = Math.min(Rr - 0.06, 0.98); K3.box(b, 0.52, gx1, -D - 0.2, -D - 0.035, zN - 0.012, zN + 0.008, A.DASH);
    // saídas de ar
    b.col = [1, 1, 1]; for (const vx of [0.2, 0.4]) quad(b, [vx - 0.03, -D - 0.04, zN - 0.0415], [vx - 0.03, -D - 0.012, zN - 0.0415], [vx + 0.03, -D - 0.012, zN - 0.0415], [vx + 0.03, -D - 0.04, zN - 0.0415], A.VENT);
    // coluna da direção
    b.col = [0.13, 0.13, 0.13]; const wc = wheelCenter(c); K3.cyl(b, [wc[0], wc[1] - 0.015, wc[2] + 0.03], 0.033, 0.045, zN - wc[2] + 0.02, 8, 'z', A.RUBBER, A.RUBBER, true);
    // colunas do para-brisa, teto, para-sóis, portas
    b.col = [0.46, 0.44, 0.41];
    const zt = Z - 0.42, gb = [0, -D, Z + 0.02], gt = [0, top - 0.02, zt];
    for (const [px, s] of [[L, 1], [Rr, -1]]) {
      quad(b, [px, -D, Z + 0.03], [px + s * 0.05, -D, Z + 0.015], [px + s * 0.07, top, zt - 0.015], [px + s * 0.02, top, zt], A.CLOTH);
      quad(b, [px, -D, Z + 0.03], [px - s * 0.02, -D, Z - 0.03], [px - s * 0.0, top, zt - 0.06], [px + s * 0.02, top, zt], A.CLOTH);
    }
    K3.box(b, L - 0.05, Rr + 0.05, top - 0.02, top + 0.05, zt - 0.12, zt + 0.02, A.CLOTH); quad(b, [L - 0.1, top + 0.05, zt - 0.1], [L - 0.1, top + 0.05, -0.6], [Rr + 0.1, top + 0.05, -0.6], [Rr + 0.1, top + 0.05, zt - 0.1], A.CLOTH);
    b.col = [0.34, 0.31, 0.28]; K3.box(b, L + 0.05, -0.06, top - 0.05, top - 0.028, zt - 0.2, zt - 0.03, A.VINYL); K3.box(b, 0.3, Rr - 0.08, top - 0.05, top - 0.028, zt - 0.2, zt - 0.03, A.VINYL);
    b.col = c.seat;
    for (const [px, s] of [[L, 1], [Rr, -1]]) { K3.box(b, Math.min(px, px + s * 0.07), Math.max(px, px + s * 0.07), -D - 0.07, -D + 0.005, -0.7, Z, A.VINYL); K3.box(b, Math.min(px - s * 0.02, px + s * 0.03), Math.max(px - s * 0.02, px + s * 0.03), -D - 0.75, -D - 0.07, -0.7, Z - 0.1, A.PANEL); }
    // adesivo no vidro (canto de cima, à esquerda)
    b.col = [1, 1, 1]; const gl = (u, w) => v3.add(v3.add(gb, v3.mul(v3.sub(gt, gb), w)), [u, 0, 0]);
    { const p0 = gl(L + 0.17, 0.86), p1 = gl(L + 0.17, 0.95), p2 = gl(L + 0.29, 0.95), p3 = gl(L + 0.29, 0.86); quad(b, v3.add(p0, [0, 0, -0.004]), v3.add(p1, [0, 0, -0.004]), v3.add(p2, [0, 0, -0.004]), v3.add(p3, [0, 0, -0.004]), A.STICK); }
    // retrovisor interno: haste e moldura
    b.col = [0.1, 0.1, 0.1]; const mc = mirC(c); K3.box(b, mc[0] - 0.011, mc[0] + 0.011, mc[1] + 0.03, top + 0.04, mc[2] + 0.005, mc[2] + 0.025, A.RUBBER); K3.box(b, mc[0] - 0.146, mc[0] + 0.146, mc[1] - 0.042, mc[1] + 0.042, mc[2] + 0.002, mc[2] + 0.03, A.RUBBER);
    // retrovisores externos: carcaça e braço
    for (const sm of sideMirrors(c)) { K3.box(b, sm.c[0] - sm.w / 2 - 0.01, sm.c[0] + sm.w / 2 + 0.01, sm.c[1] - sm.h / 2 - 0.01, sm.c[1] + sm.h / 2 + 0.01, sm.c[2] + 0.002, sm.c[2] + 0.045, A.RUBBER); const ax = sm.s < 0 ? [sm.c[0] + sm.w / 2, c.pw[0]] : [c.pw[1], sm.c[0] - sm.w / 2]; K3.box(b, Math.min(ax[0], ax[1]), Math.max(ax[0], ax[1]), sm.c[1] - sm.h / 2 - 0.02, sm.c[1] - sm.h / 2, sm.c[2] + 0.01, sm.c[2] + 0.04, A.RUBBER); }
    // câmbio: base com coifa
    b.col = [1, 1, 1]; const gb2 = gearBase(c); K3.cyl(b, [gb2[0], gb2[1], gb2[2]], 0.06, 0.02, 0.07, 8, 'y', A.BOOT, A.BOOT, false);
    const outB = b;
    // mostradores (retroiluminados) na parede do fundo do nicho
    const out = { c, wx }, d = new GL3.Builder(); d.col = [1, 1, 1];
    const fz = zF + 0.008, gy = -D - 0.088;
    const face = (cx, cy, rr, uv) => quad(d, [cx - rr, cy - rr, fz], [cx - rr, cy + rr, fz], [cx + rr, cy + rr, fz], [cx + rr, cy - rr, fz], uv);
    out.g = { rpm: [wx - 0.07, gy, 0.054], kmh: [wx + 0.07, gy, 0.054], fuel: [wx - 0.155, gy - 0.02, 0.028], temp: [wx + 0.155, gy - 0.02, 0.028], z: fz };
    face(out.g.rpm[0], out.g.rpm[1], 0.054, A.RPM); face(out.g.kmh[0], out.g.kmh[1], 0.054, A.KMH); face(out.g.fuel[0], out.g.fuel[1], 0.028, A.FUEL); face(out.g.temp[0], out.g.temp[1], 0.028, A.TEMP);
    // faixa dos LEDs (em cima dos mostradores)
    out.led = { y: -D - 0.022, z: fz - 0.001, x0: wx - 0.17, x1: wx + 0.17 };
    quad(d, [out.led.x0, out.led.y - 0.013, out.led.z], [out.led.x0, out.led.y + 0.011, out.led.z], [out.led.x1, out.led.y + 0.011, out.led.z], [out.led.x1, out.led.y - 0.013, out.led.z], A.LEDLB);
    // régua da blindagem: à esquerda do volante, na frente do painel
    const ax0 = Math.max(L + 0.07, wx - cw - 0.3), ax1 = wx - cw - 0.025, az = Z - 0.13, ay = -D + 0.022;
    b.col = [0.12, 0.12, 0.12]; K3.box(b, ax0 - 0.008, ax1 + 0.008, -D - 0.006, -D + 0.05, az + 0.001, az + 0.03, A.RUBBER);
    out.arm = { y: ay, z: az - 0.001, x0: ax0, x1: ax1 };
    quad(d, [ax0, ay - 0.026, az], [ax0, ay + 0.02, az], [ax1, ay + 0.02, az], [ax1, ay - 0.026, az], A.ARMLB);
    out.dials = d.mesh(); out.mesh = outB.mesh();
    // rádio e mapa (textura do rádio/mapa)
    const ib = new GL3.Builder(); ib.col = [1, 1, 1];
    out.radio = [[0.18, -D - 0.155, zN - 0.0415], [0.42, -D - 0.06, zN - 0.0415]];
    quad(ib, [0.18, -D - 0.155, zN - 0.0415], [0.18, -D - 0.06, zN - 0.0415], [0.42, -D - 0.06, zN - 0.0415], [0.42, -D - 0.155, zN - 0.0415], [0, 0, 1, 0.25]);
    const mx0 = 0.55, mx1 = Math.min(gx1 - 0.04, 0.94), my0 = -D - 0.19, my1 = -D - 0.045, mz = zN - 0.0125;
    quad(ib, [mx0, my0, mz], [mx0 + 0.01, my1, mz], [mx1 + 0.01, my1 - 0.01, mz], [mx1, my0 - 0.01, mz], [0, 0.25, 1, 1]);
    out.info = ib.mesh();
    return (cache['c' + veh] = out);
  }
  const wheelCenter = (c) => [-0.1, -c.drop - (c.wr > 0.2 ? 0.13 : 0.18), c.dz - 0.38];
  const mirC = (c) => [0.06, Math.min(c.roof - 0.17, 0.13), c.dz - 0.46];
  const gearBase = (c) => [0.3, -c.drop - 0.62, c.dz - 0.62];
  function sideMirrors(c) { return [{ c: [c.pw[0] - 0.27, 0.08, c.dz - 0.18], w: 0.16, h: 0.09, uv: [0, 150], s: -1 }, { c: [c.pw[1] - 0.04, 0.1, c.dz + 0.12], w: 0.16, h: 0.09, uv: [210, 150], s: 1 }]; }
  let wheelM = null, gearM = null, pendM = {}, wiperM = null, glassM = null, gridM = null, plateM = {};
  function steering() {
    if (wheelM) return wheelM; const b = new GL3.Builder(); b.col = [1, 1, 1];
    torus(b, 1, 0.09, 28, 7, A.LEATH);   // aro de raio 1 (escala pelo veículo)
    b.col = [0.12, 0.12, 0.12];
    for (const a of [PI, 0, PI / 2]) { const m = K3.mark(b); K3.box(b, -0.08, 0.08, -0.03, 0.03, 0, 0.95, A.RUBBER); Z3D.xform(b, m, -PI / 2, 0, a + PI / 2, 0, 0, 0.0); }
    b.col = [1, 1, 1]; K3.cyl(b, [0, 0, -0.16], 0.3, 0.27, 0.16, 12, 'z', A.RUBBER, A.HUB, true);
    return (wheelM = b.mesh());
  }
  function gearLever() { if (gearM) return gearM; const b = new GL3.Builder(); b.col = [1, 1, 1]; K3.cyl(b, [0, 0, 0], 0.008, 0.007, 0.2, 6, 'y', A.METAL, A.METAL, false); K3.blob(b, [0, 0.215, 0], 0.024, 0.022, 0.024, 8, 5, A.KNOB, 0, 3); return (gearM = b.mesh()); }
  function pendant(id) {
    if (pendM[id]) return pendM[id]; const b = new GL3.Builder(); b.col = [1, 1, 1];
    for (let i = 0; i < 5; i++) K3.blob(b, [0, -i * 0.012, 0], 0.0035, 0.0035, 0.0035, 5, 3, A.BEAD, 0, 1);
    if (id === 'graxa') K3.box(b, -0.011, 0.011, -0.083, -0.061, -0.011, 0.011, A.DICE);
    else if (id === 'trovao') { K3.box(b, -0.0028, 0.0028, -0.1, -0.06, -0.002, 0.002, A.CROSS); K3.box(b, -0.011, 0.011, -0.075, -0.07, -0.002, 0.002, A.CROSS); }
    else { K3.blob(b, [0, -0.078, 0], 0.008, 0.018, 0.008, 7, 5, A.PEPPER, 0.1, 5); K3.cyl(b, [0, -0.062, 0], 0.002, 0.0015, 0.008, 4, 'y', A.BOOT, A.BOOT, false); }
    return (pendM[id] = b.mesh());
  }
  function wiper() { if (wiperM) return wiperM; const b = new GL3.Builder(); b.col = [1, 1, 1]; K3.box(b, 0, 0.5, -0.006, 0.006, -0.008, 0.008, A.WIPER); K3.box(b, 0.04, 0.5, -0.011, -0.005, -0.011, 0.011, A.RUBBER); return (wiperM = b.mesh()); }
  // vidro do retrovisor (imagem da vista de trás): quad unitário
  const glassC = {};
  function glass(u0, uw) { const k = u0 + ':' + uw; if (glassC[k]) return glassC[k]; const b = new GL3.Builder(); K3.quad(b, [-0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], [0, 0, -1], [u0 / 360, 1, (u0 + uw) / 360, 0], false); return (glassC[k] = b.mesh()); }

  /* ---------- estado (física dos braços, câmbio, pingente, limpadores) ---------- */
  const ST = { t: -1, gear: 1, shift: 0, shiftFrom: 1, pa: 0, pv: 0, pb: 0, pw: 0, wiper: 0, poly: null, dashY: 0, sx: 0, sy: 0, light: null, radioRect: null, puffs: [] };
  const MC = M4.make(), MM = M4.make(), MQ = M4.make(), MR = M4.make(), MW = M4.make(), MT = M4.make(), MB = M4.make(), MZ = M4.make();
  function rotM(o, rx, ry, rz) { const m = Z3D.rot(rx, ry, rz); o[0] = m[0]; o[1] = m[3]; o[2] = m[6]; o[3] = 0; o[4] = m[1]; o[5] = m[4]; o[6] = m[7]; o[7] = 0; o[8] = m[2]; o[9] = m[5]; o[10] = m[8]; o[11] = 0; o[12] = o[13] = o[14] = 0; o[15] = 1; return o; }
  const xp = (M, p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
  const xd = (M, d) => [M[0] * d[0] + M[4] * d[1] + M[8] * d[2], M[1] * d[0] + M[5] * d[1] + M[9] * d[2], M[2] * d[0] + M[6] * d[1] + M[10] * d[2]];
  // matrizes do quadro: modelo do carro → vista (MM) e cabine (olho) → vista (MC)
  function mats() {
    const c = CP[S.veh] || CP[1], E = c.E;
    M4.ident(MT); MT[12] = -E[0]; MT[13] = -E[1]; MT[14] = -E[2];
    M4.mul(MM, MT, CARFX.bodyM(MB, 1, 0));
    M4.ident(MT); MT[12] = E[0]; MT[13] = E[1]; MT[14] = E[2]; M4.mul(MC, MM, MT);
    return c;
  }
  function update(v) {
    const now = G.t; let dt = now - ST.t; if (ST.t < 0 || dt < 0 || dt > 0.5) dt = 0; ST.t = now; dt = Math.min(dt, 0.05);
    const c = mats(), F = v.F, CX = v.W / 2 + (v.pan || 0), CY = v.hor, cf = CARFX.S;
    // troca de marcha: a mão direita vai ao câmbio e volta (só com o volante quase reto)
    const g = typeof P.gear === 'number' ? P.gear : 0;
    if (g !== ST.gear) { if (ST.shift <= 0 && Math.abs(P.steer) < 0.55) { ST.shift = 1; ST.shiftFrom = ST.gear; } ST.gear = g; }
    ST.shift = Math.max(0, ST.shift - dt / 0.55);
    // pingente: pêndulo de verdade preso ao retrovisor. Na cabine (referencial acelerado) o fio sente a aceleração do carro
    // (para fora na curva, para a frente na freada), a gravidade efetiva muda com os solavancos verticais e a própria cabine
    // gira em volta dele (rolagem e arfagem do quadro), então ele balança, passa do ponto e amortece.
    const L = 0.17, w02 = 9.8 / L, zt0 = 0.1 * Math.sqrt(w02), g1 = Math.max(0.35, 1 + cf.avert / 9.8);
    const rac = ST.lvr === undefined ? 0 : clampN((cf.vr - ST.lvr) / Math.max(dt, 1e-3), -40, 40), pac = ST.lvp === undefined ? 0 : clampN((cf.vp - ST.lvp) / Math.max(dt, 1e-3), -40, 40); ST.lvr = cf.vr; ST.lvp = cf.vp;
    let aa = -cf.alat / L * 0.85 - w02 * g1 * Math.sin(ST.pa) - 2 * zt0 * ST.pv - rac * 0.6;
    ST.pv += aa * dt; ST.pa += ST.pv * dt;
    aa = cf.alon / L * 0.85 - w02 * g1 * Math.sin(ST.pb) - 2 * zt0 * ST.pw + pac * 0.6;
    ST.pw += aa * dt; ST.pb += ST.pw * dt;
    ST.pa = clampN(ST.pa, -1.2, 1.2); ST.pb = clampN(ST.pb, -0.9, 0.9);
    // contorno do para-brisa na tela (o 2D desenha sangue/chuva/rachaduras só dentro dele) e linha do painel
    const D = c.drop, Z = c.dz, zt = Z - 0.42, prj = (p) => { const q = xp(MC, p); return [CX + F * q[0] / q[2], CY - F * q[1] / q[2]]; };
    ST.poly = [prj([c.pw[0] + 0.06, -D, Z + 0.02]), prj([c.pw[1] - 0.06, -D, Z + 0.02]), prj([c.pw[1] - 0.06, c.roof - 0.03, zt]), prj([c.pw[0] + 0.07, c.roof - 0.03, zt])];
    const dl = prj([0, -D, Z + 0.02]); ST.dashY = dl[1];
    const ms = cabinMesh(S.veh), r0 = prj(ms.radio[0]), r1 = prj(ms.radio[1]); ST.radioRect = [Math.min(r0[0], r1[0]), Math.min(r0[1], r1[1]), Math.abs(r1[0] - r0[0]), Math.abs(r1[1] - r0[1])];
    ST.vents = [prj([0.2, -D - 0.015, Z - 0.36]), prj([0.4, -D - 0.015, Z - 0.36])];
    // luz: clarão da arma do capô; à noite, o brilho verde dos instrumentos nas mãos
    ST.light = null;
    if (P.gfire > 0 && S.up.capo > 0) { const mt = V3D.CAPO_MOUNT[S.veh] || V3D.CAPO_MOUNT[1], m = GUN3D.capoModel(S.up.capo), mu = xp(MM, [mt[0], mt[1] + 0.16 + m.info.bore, mt[2] + m.info.muzzle]); ST.light = { p: [mu[0], mu[1], mu[2], 2.4], c: [1, 0.72, 0.4] }; G.capoMuzzle = [CX + F * mu[0] / mu[2], CY - F * mu[1] / mu[2]]; G.capoMuzzleF = G.frame; }
    else if (S.up.capo > 0) { const mt = V3D.CAPO_MOUNT[S.veh] || V3D.CAPO_MOUNT[1], m = GUN3D.capoModel(S.up.capo), mu = xp(MM, [mt[0], mt[1] + 0.16 + m.info.bore, mt[2] + m.info.muzzle]); G.capoMuzzle = [CX + F * mu[0] / mu[2], CY - F * mu[1] / mu[2]]; G.capoMuzzleF = G.frame; }
    if (!ST.light && G.night) { const q = xp(MC, [-0.1, -D - 0.12, Z - 0.42]); ST.light = { p: [q[0], q[1], q[2], 0.22], c: [0.45, 1, 0.6] }; }
    // limpadores
    if (P.wipe > 0) ST.wiper = Math.sin((1.3 - P.wipe) / 1.3 * PI * 2) * 0.5 + 0.5; else ST.wiper += (0 - ST.wiper) * Math.min(1, dt * 6);
    return ST.light;
  }

  /* ---------- desenho (primeiro plano) ---------- */
  const TINT = new Float32Array(3), ONE = new Float32Array([1, 1, 1]), DIMM = new Float32Array([0.6, 0.6, 0.66]);
  const dyn = { f: new Float32Array(160 * 4 * 13), ix: new Uint16Array(160 * 6), nv: 0, ni: 0, mesh: null };
  function dq(p0, p1, p2, p3, uv, col) {
    if (dyn.nv + 4 > 640) return; const n = v3.norm(v3.cross(v3.sub(p3, p0), v3.sub(p1, p0))), f = dyn.f, base = dyn.nv;
    const put = (p, u, vv) => { const o = dyn.nv * 13; f[o] = p[0]; f[o + 1] = p[1]; f[o + 2] = p[2]; f[o + 3] = -n[0]; f[o + 4] = -n[1]; f[o + 5] = -n[2]; f[o + 6] = u; f[o + 7] = vv; f[o + 8] = col[0]; f[o + 9] = col[1]; f[o + 10] = col[2]; f[o + 11] = 0; f[o + 12] = 0; dyn.nv++; };
    put(p0, uv[0], uv[3]); put(p1, uv[0], uv[1]); put(p2, uv[2], uv[1]); put(p3, uv[2], uv[3]);
    const i = dyn.ix, o = dyn.ni; i[o] = base; i[o + 1] = base + 1; i[o + 2] = base + 2; i[o + 3] = base; i[o + 4] = base + 2; i[o + 5] = base + 3; dyn.ni += 6;
  }
  function needle(cx, cy, z, len, ang, wd, col) { const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa * wd, ny = ca * wd; dq([cx - nx - ca * len * 0.15, cy - ny - sa * len * 0.15, z], [cx + nx - ca * len * 0.15, cy + ny - sa * len * 0.15, z], [cx + ca * len, cy + sa * len, z], [cx + ca * len, cy + sa * len, z], A.WHITE, col); }
  const dig = (ch) => { const i = '0123456789RN'.indexOf(ch); const u0 = (i * 29) / 512, w = 29 / 512; return [u0 + 0.5 / 512, 192.5 / 512, u0 + w - 0.5 / 512, 223.5 / 512]; };
  function draw(R, ctx) {
    const c = mats(), veh = S.veh, ms = cabinMesh(veh), T = tex(), night = G.night, D = c.drop, Z = c.dz;
    // capô de verdade (frente do carro, cortada no para-brisa) com os upgrades e a arma do capô
    const fm = V3D.frontModel(veh, S.up, c.zc), col = TEX3.hexRGB(VEHICLES[veh].cor); TINT[0] = col[0] / 255 * 1.15; TINT[1] = col[1] / 255 * 1.15; TINT[2] = col[2] / 255 * 1.15;
    for (const p of fm.parts) R.model(p.mesh, p.tex, MM, { t1: TINT, spec: 0.5 });
    V3D.drawCapo(R, MM, V3D.playerModel(veh, S.up));
    V3D.drawDoors(R, MM, V3D.playerModel(veh, S.up), 0, ctx);   // zumbis agarrados nas portas, vistos pelas janelas
    // serras do para-choque girando (brilho) quando ligadas
    if (P.saws && fm.saws) for (let i = 0; i < fm.saws; i++) { const xs = (i - (fm.saws - 1) / 2) * (fm.saws > 2 ? fm.hw * 0.36 : fm.hw * 0.8), q = xp(MM, [xs, 0.8, fm.fz + 0.33]); R.glow(q[0], q[1], q[2], 0.32, 0.5, 0.55, 0.6, 0.75, 0.25); }
    // interior
    R.model(ms.mesh, T, MC, { glow: 0, spec: 0.12 });
    R.model(ms.dials, T, MC, { glow: night ? 0.9 : 0.62, spec: 0.3 });
    R.model(ms.info, infoTex(), MC, { glow: night ? 0.55 : 0.2 });
    // ponteiros, dígitos, LEDs, régua da blindagem, barrinhas do rádio
    dyn.nv = dyn.ni = 0;
    const gz = ms.g.z - 0.004, a0 = PI * 0.75, span = PI * 1.5, ang = (f) => -(a0 + span * clampN(f, 0, 1.05));
    const nc = [1, 0.32, 0.14];
    needle(ms.g.rpm[0], ms.g.rpm[1], gz, 0.05, ang(P.rpm || 0), 0.0028, nc);
    needle(ms.g.kmh[0], ms.g.kmh[1], gz, 0.05, ang(Math.abs(P.speed) * 3.6 / 200), 0.0028, nc);
    const mini = (g, f) => { const a = -(PI * 1.15 + PI * 0.7 * clampN(f, 0, 1)); needle(g[0], g[1] - 0.004, gz, 0.024, a, 0.0018, nc); };
    mini(ms.g.fuel, P.fuel); mini(ms.g.temp, (P.temp || 0) / 1.15);
    const sp = String(Math.round(Math.abs(P.speed) * 3.6)).padStart(3, ' '), gr = String(P.gear);
    for (let i = 0; i < 3; i++) if (sp[i] !== ' ') { const x0 = ms.g.kmh[0] - 0.018 + i * 0.012, y0 = ms.g.kmh[1] - 0.034; dq([x0, y0, gz], [x0, y0 + 0.014, gz], [x0 + 0.011, y0 + 0.014, gz], [x0 + 0.011, y0, gz], dig(sp[i]), ONE); }
    { const x0 = ms.g.rpm[0] - 0.008, y0 = ms.g.rpm[1] - 0.036; dq([x0, y0, gz], [x0, y0 + 0.018, gz], [x0 + 0.016, y0 + 0.018, gz], [x0 + 0.016, y0, gz], dig(gr === 'R' ? 'R' : gr), ONE); }
    const bl = Math.sin(G.t * 16) > 0, L = ms.led, ledOn = [G.led.L > 0 && bl, G.led.H > 0 && bl, G.led.R > 0 && bl, P.over && bl, P.fuel < 0.15 && bl, (P.tires && S.up.pneu < 1) && bl], ledC = [[1, 0.2, 0.08], [1, 0.65, 0.1], [1, 0.2, 0.08], [1, 0.12, 0.1], [1, 0.65, 0.1], [1, 0.5, 0.1]];
    for (let i = 0; i < 6; i++) { const x = L.x0 + (i + 0.5) * (L.x1 - L.x0) / 6, y = L.y + 0.019, z = L.z - 0.006, s = 0.0065; dq([x - s, y - s, z], [x - s, y + s, z], [x + s, y + s, z], [x + s, y - s, z], ledOn[i] ? A.WHITE : A.GRAY, ledOn[i] ? ledC[i] : [0.4, 0.4, 0.38]); if (ledOn[i]) { const q = xp(MC, [x, y, z - 0.004]); R.glow(q[0], q[1], q[2], 0.03, 0.03, ledC[i][0], ledC[i][1], ledC[i][2], 0.9); } }
    const ar = P.armor / G.V.armorMax, Ab = ms.arm;
    const segW = (Ab.x1 - Ab.x0 - 0.01) / 14;
    for (let i = 0; i < 14; i++) { const on = i / 14 < ar, cc = !on ? [0.3, 0.3, 0.3] : ar < 0.3 ? [1, 0.15, 0.12] : ar < 0.6 ? [1, 0.6, 0.12] : [0.3, 1, 0.3], x0 = Ab.x0 + 0.005 + i * segW, y0 = Ab.y - 0.024; dq([x0, y0, Ab.z - 0.001], [x0, y0 + 0.024, Ab.z - 0.001], [x0 + segW * 0.78, y0 + 0.024, Ab.z - 0.001], [x0 + segW * 0.78, y0, Ab.z - 0.001], on ? A.WHITE : A.GRAY, cc); }
    const rb = 1 + (Math.abs(Math.sin(G.t * 6)) * 6 | 0), rr = ms.radio;
    for (let i = 0; i < rb; i++) { const x0 = rr[0][0] + 0.13 + i * 0.011, y0 = rr[0][1] + 0.013; dq([x0, y0, rr[0][2] - 0.001], [x0, y0 + 0.012, rr[0][2] - 0.001], [x0 + 0.007, y0 + 0.012, rr[0][2] - 0.001], [x0 + 0.007, y0, rr[0][2] - 0.001], A.WHITE, [0.42, 1, 0.55]); }
    if (dyn.ni) { if (!dyn.mesh) dyn.mesh = new GL3.Mesh(null, null, true); dyn.mesh.set(dyn.f, dyn.nv, dyn.ix, dyn.ni); R.model(dyn.mesh, T, MC, { glow: 1 }); }
    // volante (gira com a direção e trepida com o motor), câmbio, retrovisores, pingente, limpadores, janelas
    const wc = wheelCenter(c), steerA = P.steer * 1.5, cf = CARFX.S;
    rotM(MQ, c.wt, 0, 0); rotM(MZ, 0, 0, -steerA); M4.mul(MQ, MQ, MZ); M4.ident(MT); MT[12] = wc[0] + cf.vibX * 0.6; MT[13] = wc[1] + cf.vibY * 0.6; MT[14] = wc[2]; M4.mul(MW, MT, MQ);
    M4.ident(MT); MT[0] = MT[5] = MT[10] = c.wr; const Mw = M4.mul(MR, MC, M4.mul(MT, MW, MT));
    R.model(steering(), T, Mw, { glow: 0, spec: 0.25 });
    // câmbio: posição de cada marcha no "H"
    const gpos = (gg) => gg === 'R' ? [0.035, -0.035] : [[0, 0], [-0.03, 0.035], [-0.03, -0.035], [0, 0.035], [0, -0.035], [0.03, 0.035]][gg] || [0, 0];
    const gfrom = gpos(ST.shiftFrom), gto = gpos(ST.gear), gt = ST.shift > 0 ? ss((1 - ST.shift - 0.3) / 0.25) : 1, gp = [gfrom[0] + (gto[0] - gfrom[0]) * gt, gfrom[1] + (gto[1] - gfrom[1]) * gt];
    const gb = gearBase(c); rotM(MQ, gp[1] * 4.5, 0, -gp[0] * 4.5); M4.ident(MT); MT[12] = gb[0]; MT[13] = gb[1] + 0.03; MT[14] = gb[2]; M4.mul(MW, MT, MQ);
    R.model(gearLever(), T, M4.mul(MR, MC, MW), { glow: 0, spec: 0.5 });
    const knob = xp(MW, [0, 0.215, 0]);
    mirrors3d(R, c);
    // pingente pendurado no retrovisor
    const pc = v3.add(mirC(c), [0, -0.045, 0.01]); rotM(MQ, ST.pb, 0, ST.pa); M4.ident(MT); MT[12] = pc[0]; MT[13] = pc[1]; MT[14] = pc[2]; M4.mul(MW, MT, MQ); MT[0] = MT[5] = MT[10] = 1.5; M4.mul(MW, MW, MT);
    R.model(pendant(typeof cls === 'function' && cls() ? cls().id : 'trovao'), T, M4.mul(MR, MC, MW), { glow: 0, spec: 0.4 });
    wipers(R, c);
    windowsUp(R, c);
    cracks3d(R, c);
    // braços no volante (e a direita no câmbio na troca de marcha)
    arms(R, c, wc, steerA, knob);
  }
  function arms(R, c, wc, steerA, knob) {
    const id = typeof cls === 'function' && cls() ? cls().id : 'trovao';
    const rimPt = (th) => { const loc = [-Math.sin(th), Math.cos(th), 0]; rotM(MQ, c.wt, 0, 0); rotM(MZ, 0, 0, -steerA); M4.mul(MQ, MQ, MZ); const p = xd(MQ, v3.mul(loc, c.wr)); return { p: v3.add(wc, p), tan: xd(MQ, [Math.cos(th), Math.sin(th), 0]), rad: xd(MQ, loc), fwd: xd(MQ, [0, 0, 1]) }; };
    const grip = (th) => { const q = rimPt(th), ax = v3.norm(q.tan), pn0 = v3.norm(v3.add(v3.mul(q.fwd, 0.85), v3.mul(q.rad, -0.5))), hz = v3.norm(v3.sub(pn0, v3.mul(ax, v3.dot(pn0, ax)))), hy = v3.cross(hz, ax); return { P: q.p, hy, hz }; };
    const toV = (h) => ({ P: xp(MC, h.P), hy: xd(MC, h.hy), hz: xd(MC, h.hz) });
    const lim = (a) => clampN(a, -1.1, 1.1);
    const ga = c.wr > 0.2 ? 0.74 : 0.92, hl = toV(grip(ga)), shL = xp(MC, [-0.2, -0.33, -0.06]), shR = xp(MC, [0.2, -0.33, -0.06]);
    ARMS3D.draw(R, id, true, shL, hl.P, hl.hy, hl.hz, xd(MC, [-0.8, -1, 0.1]), 0.019, false);
    let hr = toV(grip(-ga));
    if (ST.shift > 0) {   // mão direita: volante → câmbio → volante
      const t = 1 - ST.shift, away = ss(t / 0.3) * (1 - ss((t - 0.6) / 0.35)), kn = xp(MC, v3.add(knob, [0, 0.005, -0.02]));
      hr = { P: [hr.P[0] + (kn[0] - hr.P[0]) * away, hr.P[1] + (kn[1] - hr.P[1]) * away, hr.P[2] + (kn[2] - hr.P[2]) * away], hy: v3.norm(v3.add(v3.mul(hr.hy, 1 - away), v3.mul(xd(MC, [0.2, -0.3, 1]), away))), hz: v3.norm(v3.add(v3.mul(hr.hz, 1 - away), v3.mul(xd(MC, [-0.2, -1, 0.1]), away))) };
    }
    ARMS3D.draw(R, id, false, shR, hr.P, hr.hy, hr.hz, xd(MC, [0.8, -1, 0.1]), 0.019, false);
  }
  /* retrovisores: a imagem de trás (renderizada antes) colada no vidro de cada espelho */
  function mirrors3d(R, c) {
    const mt = ST.mirTex, Z = c.dz, top = c.roof, zt = Z - 0.42;
    const one = (cx, cy, cz, w, h, u0, uw, ok) => {
      M4.ident(MT); MT[0] = w; MT[5] = h; MT[12] = cx; MT[13] = cy; MT[14] = cz; const M = M4.mul(MR, MC, MT);
      if (ok && mt) R.model(glass(u0, uw), mt, M, { glow: 1, t1: G.night ? DIMM : ONE });
      else { if (!glassC.br) { const b = new GL3.Builder(); K3.quad(b, [-0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], [0, 0, -1], A.BROKEN, false); glassC.br = b.mesh(); } R.model(glassC.br, tex(), M, { glow: 0.15 }); }
    };
    const mc = mirC(c); one(mc[0], mc[1], mc[2], 0.27, 0.07, 60, 240, true);
    for (const sm of sideMirrors(c)) one(sm.c[0], sm.c[1], sm.c[2], sm.w, sm.h, sm.uv[0], sm.uv[1], sm.s < 0 ? !!P.mirrorL : true);
  }
  function wipers(R, c) {
    const D = c.drop, Z = c.dz, top = c.roof, zt = Z - 0.42, gb = [0, -D + 0.012, Z + 0.035], gt = [0, top, zt], gdir = v3.norm(v3.sub(gt, gb)), side = [1, 0, 0], nrm = v3.cross(side, gdir);
    const a = ST.wiper * 1.85;
    for (const px of [-0.02, 0.5]) {
      // eixo do limpador sobre o vidro: começa deitado para a esquerda e sobe varrendo
      const dirv = v3.add(v3.mul(side, -Math.cos(a)), v3.mul(gdir, Math.sin(a))), up = nrm;
      const X = v3.mul(dirv, -1), Y = up, Zv = v3.cross(X, Y);
      MT[0] = X[0]; MT[1] = X[1]; MT[2] = X[2]; MT[3] = 0; MT[4] = Y[0]; MT[5] = Y[1]; MT[6] = Y[2]; MT[7] = 0; MT[8] = Zv[0]; MT[9] = Zv[1]; MT[10] = Zv[2]; MT[11] = 0; MT[12] = px; MT[13] = gb[1]; MT[14] = gb[2]; MT[15] = 1;
      // a malha vai de x=0 a 0.5 no sentido +x: virar para o lado da varredura
      M4.ident(MQ); MQ[0] = -1; M4.mul(MW, MT, MQ);
      R.model(wiper(), tex(), M4.mul(MR, MC, MW), { glow: 0, spec: 0.2 });
    }
  }
  // tela de arame (recortada) ou chapas de aço com a fresta na altura do horizonte
  /* ---------- trincados no para-brisa: presos ao vidro (na cabine), balançam junto com a carroceria ---------- */
  let crackM = null, crackKey = '';
  function cracks3d(R, c) {
    if (!P.cracks.length) return;
    const key = S.veh + ':' + P.cracks.length + ':' + P.cracks[0].a;
    if (!crackM || crackKey !== key) {
      crackKey = key; const D = c.drop, Z = c.dz, top = c.roof, zt = Z - 0.42, L = c.pw[0] + 0.06, Rr = c.pw[1] - 0.06, Wm = Rr - L;
      const gb = [0, -D, Z + 0.02], gt = [0, top - 0.03, zt], eU = v3.norm(v3.sub(gt, gb)), eR = [1, 0, 0], nrm = v3.norm(v3.cross(eU, eR));   // aponta para o olho
      const Hh = v3.len ? v3.len(v3.sub(gt, gb)) : Math.hypot(gt[1] - gb[1], gt[2] - gb[2]);
      const at = (x, h) => { const xx = clampN(x, L + 0.01, Rr - 0.01), hh = clampN(h, 0.01, Hh - 0.01); return [xx, gb[1] + eU[1] * hh - nrm[1] * 0.004, gb[2] + eU[2] * hh - nrm[2] * 0.004]; };   // sempre dentro do vidro
      const b = new GL3.Builder();
      const seg = (p, q, w, col, lift) => {
        const d = v3.norm(v3.sub(q, p)), s2 = v3.mul(v3.norm(v3.cross(nrm, d)), w / 2), o = v3.mul(nrm, lift); b.col = col;
        const a0 = v3.add(v3.sub(p, s2), o), a1 = v3.add(v3.add(p, s2), o), a2 = v3.add(v3.add(q, s2), o), a3 = v3.add(v3.sub(q, s2), o);
        K3.quad(b, a0, a1, a2, a3, nrm, A.WHITE, true);
      };
      for (const k of P.cracks) {
        const cx = L + Wm * k.x, ch = Hh * (1 - k.y), pts = [], pp = (a, r) => at(cx + Math.cos(a) * r, ch - Math.sin(a) * r);
        const C = at(cx, ch);
        for (let i = 0; i < 9; i++) { const a = k.a + i * 0.7, r = k.r * Wm * (0.5 + DRAW.hash(i + k.a) * 0.9); pts.push([C, pp(a, r * 0.5), pp(a + 0.2, r)]); }
        const rr = k.r * Wm * 0.4, ring = []; for (let i = 0; i <= 12; i++) ring.push(pp(i / 12 * TAU, rr));
        for (const [col, w, lift] of [[[0.3, 0.32, 0.36], 0.0046, 0], [[0.93, 0.96, 1], 0.0024, 0.0012]]) {
          for (const [p0, p1, p2] of pts) { seg(p0, p1, w, col, lift); seg(p1, p2, w * 0.85, col, lift); }
          for (let i = 0; i < 12; i++) seg(ring[i], ring[i + 1], w, col, lift);
        }
      }
      crackM = b.mesh();
    }
    R.model(crackM, tex(), MC, { glow: 0.5, spec: 0.1 });
  }
  function windowsUp(R, c) {
    const j = S.up.janela || 0; if (!j) return;
    const D = c.drop, Z = c.dz, top = c.roof, zt = Z - 0.42, L = c.pw[0] + 0.02, Rr = c.pw[1] - 0.02, gb = [0, -D, Z + 0.06], gt = [0, top, zt + 0.04];
    const at = (w) => v3.add(gb, v3.mul(v3.sub(gt, gb), w)), key = S.veh + ':' + j;
    if (j === 1) {
      if (!gridM || gridM.k !== key) {   // a grade do atlas não repete sozinha: o vidro vira um mosaico de células
        const bb = new GL3.Builder(), nx = 14, ny = 6;
        for (let i = 0; i < nx; i++) for (let k = 0; k < ny; k++) { const x0 = L + (Rr - L) * i / nx, x1 = L + (Rr - L) * (i + 1) / nx, q0 = at(k / ny), q1 = at((k + 1) / ny); K3.quad(bb, [x0, q0[1], q0[2]], [x0, q1[1], q1[2]], [x1, q1[1], q1[2]], [x1, q0[1], q0[2]], [0, 0.5, -0.86], A.GRID, false); }
        gridM = { mesh: bb.mesh(), k: key }; }
      R.model(gridM.mesh, tex(), MC, { atest: true, glow: 0 }); return;
    }
    if (!plateM[key]) {
      const b = new GL3.Builder(), k1 = 0.109, hit = (k) => { const d = v3.sub(gt, gb); const t = (k * gb[2] - gb[1]) / (d[1] - k * d[2]); return clampN(t, 0, 1); };
      const tLo = hit(-k1), tHi = hit(k1), p0 = at(0), pa = at(tLo), pb = at(tHi), p1 = at(1);
      b.col = [1, 1, 1];
      K3.quad(b, [L, p0[1], p0[2] - 0.01], [L, pa[1], pa[2] - 0.01], [Rr, pa[1], pa[2] - 0.01], [Rr, p0[1], p0[2] - 0.01], [0, 0.5, -0.86], A.PLATE, false);
      K3.quad(b, [L, pb[1], pb[2] - 0.01], [L, p1[1], p1[2] - 0.01], [Rr, p1[1], p1[2] - 0.01], [Rr, pb[1], pb[2] - 0.01], [0, 0.5, -0.86], A.PLATE, false);
      for (const t of [tLo, tHi]) { const q = at(t); K3.box(b, L, Rr, q[1] - 0.008, q[1] + 0.008, q[2] - 0.03, q[2] - 0.005, A.METAL); }
      plateM[key] = b.mesh();
    }
    R.model(plateM[key], tex(), MC, { glow: 0, spec: 0.15 });
  }
  return {
    update, draw, tex, CP,
    set mirTex(t) { ST.mirTex = t; }, get poly() { return ST.poly; }, get dashY() { return ST.dashY; }, get radioRect() { return ST.radioRect; }, get vents() { return ST.vents; },
  };
})();
