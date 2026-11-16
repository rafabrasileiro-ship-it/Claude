'use strict';
/* Cenário 3D de beira de estrada: árvores, cerrado, canaviais (e queimando), postes, cercas, gado no pasto, carretas, postos,
   prédios, a Esplanada, lavouras de soja e algodão, silos, pedras, mandacarus, xique-xiques, coqueiros, placas com texto,
   radares, guard-rails, paredões de pedra e o pedágio — mais capim, pedrinhas e lixo espalhados no acostamento. */
const S3D = (() => {
  const PI = Math.PI, UV = K3.R(512), H = (n) => DRAW.hash(n);
  const A = { BARK: UV(0, 0, 64, 128), PALMB: UV(64, 0, 128, 128), CONC: UV(128, 0, 192, 64), GALV: UV(192, 0, 256, 64), RUSTM: UV(128, 64, 192, 128), WOOD: UV(192, 64, 256, 128),
    ROCK: UV(256, 0, 384, 128), CACT: UV(384, 0, 448, 128), XIQ: UV(448, 0, 512, 128), SIGN: UV(384, 128, 512, 192), PUMP: UV(384, 192, 448, 256), CANOPY: UV(448, 192, 512, 256),
    TRAIL: UV(0, 128, 128, 256), SOY: UV(128, 128, 256, 192), COTTON: UV(128, 192, 256, 256), CANET: UV(256, 128, 384, 192), CANES: UV(256, 192, 384, 256),
    BURNT: UV(0, 256, 128, 384), ROOF: UV(128, 256, 256, 320), DIRT: UV(128, 320, 256, 384), SHOP: UV(256, 256, 384, 384), DARKG: UV(384, 256, 448, 320), WHITE: UV(448, 256, 512, 320), HAY: UV(384, 320, 512, 384), TRASH: UV(0, 384, 256, 512), KM: UV(256, 384, 320, 448) };
  const B = { LEAF: UV(0, 0, 256, 256), IPE: UV(256, 0, 512, 128), PALM: UV(256, 128, 512, 256), GRASS: UV(0, 256, 256, 384), DRY: UV(256, 256, 512, 384), CANE: UV(0, 384, 256, 512), WIRE: UV(256, 384, 512, 448), COTP: UV(256, 448, 512, 512) };
  let TA = null, TB = null, TF = null, TM = null;
  const texA = () => TA || (TA = TEX3.T(makeA, { repeat: false }));
  const texB = () => TB || (TB = TEX3.T(makeB, { repeat: false }));
  const fac = () => TF || (TF = TEX3.T(() => facade(false), { repeat: true }));
  const fmin = () => TM || (TM = TEX3.T(() => facade(true), { repeat: true }));

  function makeA() {
    const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(909), css = TEX3.css;
    x.fillStyle = '#777'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip(); q.translate(x0, y0); } f(x1 - x0, y1 - y0); x.restore(); k.restore(); };
    const fld = (w, h, cells, oct, seed, ca, cb, grain) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, TEX3.fbm(w, h, cells, oct, seed, 0.6), ca, cb, grain, seed); x.drawImage(t, 0, 0); };
    reg(0, 0, 64, 128, (w, h) => { fld(w, h, 2, 4, 1, [58, 44, 32], [104, 86, 66], 14); x.strokeStyle = 'rgba(30,22,14,0.6)'; x.lineWidth = 1.4; for (let i = 0; i < 16; i++) { const X = r() * w; x.beginPath(); x.moveTo(X, 0); x.bezierCurveTo(X + 4, h * 0.3, X - 4, h * 0.6, X + 2, h); x.stroke(); } });
    reg(64, 0, 128, 128, (w, h) => { fld(w, h, 2, 3, 2, [96, 84, 66], [140, 126, 100], 12); x.strokeStyle = 'rgba(50,40,28,0.7)'; x.lineWidth = 2; for (let y = 4; y < h; y += 9) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + 2); x.stroke(); } });
    reg(128, 0, 192, 64, (w, h) => fld(w, h, 2, 4, 3, [118, 116, 110], [168, 166, 158], 22));
    reg(192, 0, 256, 64, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d0d4d6'); g.addColorStop(0.5, '#8a9094'); g.addColorStop(1, '#b0b6ba'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,70,30,0.3)'; for (let i = 0; i < 12; i++) x.fillRect(r() * w, r() * h, 3, 2); });
    reg(128, 64, 192, 128, (w, h) => { fld(w, h, 2, 4, 4, [90, 44, 20], [160, 90, 46], 20); x.fillStyle = 'rgba(0,0,0,0.25)'; for (let X = 0; X < w; X += 6) x.fillRect(X, 0, 2, h); });
    reg(192, 64, 256, 128, (w, h) => { fld(w, h, 2, 4, 5, [84, 70, 54], [130, 112, 90], 16); x.strokeStyle = 'rgba(40,30,20,0.6)'; for (let i = 0; i < 10; i++) { const X = r() * w; x.beginPath(); x.moveTo(X, 0); x.lineTo(X + 2, h); x.stroke(); } });
    reg(256, 0, 384, 128, (w, h) => { fld(w, h, 4, 6, 6, [96, 82, 64], [168, 150, 124], 28); x.strokeStyle = 'rgba(40,30,20,0.55)'; x.lineWidth = 1.5; for (let i = 0; i < 18; i++) { let X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); for (let s = 0; s < 5; s++) { X += (r() - 0.5) * 22; Y += r() * 14; x.lineTo(X, Y); } x.stroke(); } x.fillStyle = 'rgba(90,110,60,0.3)'; for (let i = 0; i < 20; i++) { x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 8, 0, 7); x.fill(); } });
    reg(384, 0, 448, 128, (w, h) => { fld(w, h, 2, 3, 7, [44, 92, 50], [78, 130, 74], 10); x.fillStyle = 'rgba(20,50,24,0.7)'; for (let X = 4; X < w; X += 8) x.fillRect(X, 0, 2, h); x.fillStyle = '#e8e0c0'; for (let i = 0; i < 160; i++) x.fillRect(r() * w, r() * h, 1, 1); });
    reg(448, 0, 512, 128, (w, h) => { fld(w, h, 2, 3, 8, [70, 104, 84], [110, 144, 116], 10); x.fillStyle = 'rgba(30,60,44,0.7)'; for (let X = 3; X < w; X += 6) x.fillRect(X, 0, 2, h); x.fillStyle = '#efe8d0'; for (let i = 0; i < 240; i++) x.fillRect(r() * w, r() * h, 1, 1.5); });
    reg(384, 128, 512, 192, (w, h) => { x.fillStyle = '#0c6a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f0f0e8'; x.lineWidth = 3; x.strokeRect(4, 4, w - 8, h - 8); });
    reg(384, 192, 448, 256, (w, h) => { x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, w, h); x.fillStyle = '#c21a12'; x.fillRect(0, 0, w, 14); x.fillStyle = '#1a1a1a'; x.fillRect(10, 20, w - 20, 14); x.fillStyle = '#6aff8a'; x.fillRect(14, 24, 20, 6); k.fillStyle = '#888'; k.fillRect(14, 24, 20, 6); x.fillStyle = '#2a2a2a'; x.fillRect(20, 40, 24, 20); });
    reg(448, 192, 512, 256, (w, h) => { x.fillStyle = '#f2efe8'; x.fillRect(0, 0, w, h); x.fillStyle = '#c21a12'; x.fillRect(0, 0, w, 22); x.fillRect(0, h - 10, w, 10); });
    reg(0, 128, 128, 256, (w, h) => { fld(w, h, 4, 4, 9, [180, 180, 176], [222, 222, 218], 10); x.fillStyle = 'rgba(0,0,0,0.18)'; for (let X = 0; X < w; X += 8) x.fillRect(X, 0, 3, h); x.fillStyle = 'rgba(120,60,20,0.5)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.ellipse(r() * w, r() * h, 4 + r() * 10, 6 + r() * 16, 0, 0, 7); x.fill(); } x.fillStyle = 'rgba(20,20,20,0.6)'; x.fillRect(0, h - 10, w, 10); });
    reg(128, 128, 256, 192, (w, h) => { x.fillStyle = '#3a5a1c'; x.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) { x.fillStyle = '#6a9a2e'; x.fillRect(0, y, w, 5); x.fillStyle = 'rgba(140,190,70,0.6)'; for (let i = 0; i < 40; i++) x.fillRect(r() * w, y + r() * 4, 2, 2); } });
    reg(128, 192, 256, 256, (w, h) => { x.fillStyle = '#4a5a2a'; x.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) { x.fillStyle = '#6a7a3a'; x.fillRect(0, y, w, 5); } x.fillStyle = '#f4f2ec'; for (let i = 0; i < 380; i++) { x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 1.6, 0, 7); x.fill(); } });
    reg(256, 128, 384, 192, (w, h) => { fld(w, h, 4, 4, 10, [46, 84, 30], [96, 140, 52], 26); x.strokeStyle = 'rgba(130,180,70,0.6)'; for (let i = 0; i < 90; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 16, Y + (r() - 0.5) * 6); x.stroke(); } });
    reg(256, 192, 384, 256, (w, h) => { x.fillStyle = '#2e4a1c'; x.fillRect(0, 0, w, h); for (let X = 0; X < w; X += 5 + r() * 4) { x.fillStyle = r() < 0.5 ? '#6a8a3a' : '#8aa04a'; x.fillRect(X, 0, 2.5, h); x.fillStyle = 'rgba(40,60,20,0.6)'; for (let y = 6; y < h; y += 10) x.fillRect(X, y, 2.5, 1.5); } x.strokeStyle = 'rgba(120,170,60,0.8)'; for (let i = 0; i < 50; i++) { const X = r() * w; x.beginPath(); x.moveTo(X, 0); x.quadraticCurveTo(X + 10, 10, X + 16 * (r() - 0.3), 24); x.stroke(); } });
    reg(0, 256, 128, 384, (w, h) => { fld(w, h, 4, 4, 11, [14, 10, 8], [60, 40, 26], 22); x.fillStyle = 'rgba(255,120,20,0.7)'; for (let i = 0; i < 40; i++) x.fillRect(r() * w, r() * h, 2, 2); k.fillStyle = '#fff'; for (let i = 0; i < 40; i++) k.fillRect(r() * w, r() * h, 2, 2); });
    reg(128, 256, 256, 320, (w, h) => { x.fillStyle = '#8a3a22'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(40,14,8,0.6)'; for (let y = 0; y < h; y += 8) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } for (let X = 0; X < w; X += 12) for (let y = 0; y < h; y += 16) { x.beginPath(); x.moveTo(X + (y / 16 % 2) * 6, y); x.lineTo(X + (y / 16 % 2) * 6, y + 8); x.stroke(); } });
    reg(128, 320, 256, 384, (w, h) => fld(w, h, 4, 4, 12, [96, 78, 56], [150, 128, 96], 20));
    reg(256, 256, 384, 384, (w, h) => { x.fillStyle = '#d8d0c0'; x.fillRect(0, 0, w, h); x.fillStyle = '#c21a12'; x.fillRect(0, 0, w, 20); x.fillStyle = '#fff'; x.font = 'bold 15px Arial'; x.textAlign = 'center'; x.fillText('CONVENIÊNCIA', w / 2, 15); x.fillStyle = '#1a2a34'; x.fillRect(12, 34, 46, 60); x.fillRect(70, 34, 46, 60); k.fillStyle = '#555'; k.fillRect(12, 34, 46, 60); x.fillStyle = 'rgba(100,60,30,0.4)'; x.fillRect(0, h - 26, w, 26); });
    reg(384, 256, 448, 320, (w, h) => { x.fillStyle = '#1e2a1c'; x.fillRect(0, 0, w, h); });
    reg(448, 256, 512, 320, (w, h) => { x.fillStyle = '#e8e8e2'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 30; i++) x.fillRect(r() * w, r() * h, 2, 2); });
    reg(384, 320, 512, 384, (w, h) => { fld(w, h, 4, 3, 13, [170, 140, 70], [220, 196, 120], 30); x.strokeStyle = 'rgba(110,80,30,0.5)'; for (let i = 0; i < 60; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + 10, Y + (r() - 0.5) * 4); x.stroke(); } });
    reg(0, 384, 256, 512, (w, h) => { x.fillStyle = '#5a4a36'; x.fillRect(0, 0, w, h); const cols = ['#e8e2d0', '#2a5aa0', '#c22', '#1a1a1a', '#d8b040', '#6a8a3a']; for (let i = 0; i < 70; i++) { x.fillStyle = cols[i % cols.length]; x.save(); x.translate(r() * w, r() * h); x.rotate(r() * 3); x.fillRect(-4 - r() * 6, -2 - r() * 3, 8 + r() * 10, 4 + r() * 5); x.restore(); } });
    reg(256, 384, 320, 448, (w, h) => { x.fillStyle = '#f0f0ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = 'bold 22px Arial'; x.textAlign = 'center'; x.fillText('KM', w / 2, 26); x.font = 'bold 18px Arial'; x.fillText('BR', w / 2, 52); });
    return TEX3.pack(c, m);
  }
  // atlas com recorte (alfa): folhas, ipê florido, palha de coqueiro, capim, cerrado seco, cana, arame, pé de algodão
  function makeB() {
    const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(717), css = TEX3.css;
    x.fillStyle = '#3a5a2a'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip(); q.translate(x0, y0); } f(x1 - x0, y1 - y0); x.restore(); k.restore(); };
    const leafBlob = (w, h, n, cols, size, round) => {
      for (let i = 0; i < n; i++) {
        const a = r() * PI * 2, d = Math.sqrt(r()) * (round ? 0.46 : 0.5), X = w / 2 + Math.cos(a) * d * w, Y = h / 2 + Math.sin(a) * d * h, s = size * (0.6 + r() * 0.8), rot = r() * 6;
        x.fillStyle = cols[(r() * cols.length) | 0]; x.beginPath(); x.ellipse(X, Y, s, s * 0.5, rot, 0, 7); x.fill();
        k.fillStyle = '#fff'; k.beginPath(); k.ellipse(X, Y, s, s * 0.5, rot, 0, 7); k.fill();
      }
    };
    reg(0, 0, 256, 256, (w, h) => { x.fillStyle = '#2a4a1e'; x.fillRect(0, 0, w, h); leafBlob(w, h, 900, ['#2e5a22', '#3a6e2a', '#4a7e32', '#243e1a', '#5a8a3a'], 7, true); x.strokeStyle = '#3a2a1a'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2 + (r() - 0.5) * w * 0.6, h * (0.3 + r() * 0.4)); x.stroke(); k.strokeStyle = '#fff'; k.lineWidth = 3; k.beginPath(); k.moveTo(w / 2, h); k.lineTo(w / 2, h * 0.6); k.stroke(); } });
    reg(256, 0, 512, 128, (w, h) => { x.fillStyle = '#c8a020'; x.fillRect(0, 0, w, h); for (const [o, cl] of [[0, ['#f0c818', '#e8b010', '#ffd840', '#c89a10']], [w / 2, ['#e070b0', '#c85090', '#f090c8', '#a83a78']]]) { x.save(); k.save(); x.translate(o, 0); k.translate(o, 0); leafBlob(w / 2, h, 500, cl, 5, true); x.restore(); k.restore(); } });
    reg(256, 128, 512, 256, (w, h) => {   // folha de coqueiro: nervura central e folíolos
      x.fillStyle = '#2e5a24'; x.fillRect(0, 0, w, h); k.lineCap = 'round'; x.lineCap = 'round';
      x.strokeStyle = '#5a6a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(4, h / 2); x.lineTo(w - 4, h / 2); x.stroke(); k.strokeStyle = '#fff'; k.lineWidth = 5; k.beginPath(); k.moveTo(4, h / 2); k.lineTo(w - 4, h / 2); k.stroke();
      for (let X = 10; X < w - 8; X += 5) { const L = (h / 2 - 6) * Math.sin(X / w * PI) * (0.8 + r() * 0.3); for (const s of [-1, 1]) { x.strokeStyle = r() < 0.5 ? '#3a7a2a' : '#4a8a30'; x.lineWidth = 3; x.beginPath(); x.moveTo(X, h / 2); x.lineTo(X + 14, h / 2 + s * L); x.stroke(); k.lineWidth = 3; k.beginPath(); k.moveTo(X, h / 2); k.lineTo(X + 14, h / 2 + s * L); k.stroke(); } }
    });
    reg(0, 256, 256, 384, (w, h) => { x.fillStyle = '#5a6a2a'; x.fillRect(0, 0, w, h); x.lineCap = 'round'; k.lineCap = 'round'; for (let i = 0; i < 420; i++) { const X = 8 + r() * (w - 16), L = h * (0.3 + r() * 0.65), a = (r() - 0.5) * 0.8, dry = r(); x.strokeStyle = css(80 + dry * 110, 110 + dry * 60, 40 + dry * 20); x.lineWidth = 1.5 + r() * 1.5; x.beginPath(); x.moveTo(X, h); x.quadraticCurveTo(X + a * 20, h - L * 0.5, X + a * L, h - L); x.stroke(); k.strokeStyle = '#fff'; k.lineWidth = x.lineWidth; k.beginPath(); k.moveTo(X, h); k.quadraticCurveTo(X + a * 20, h - L * 0.5, X + a * L, h - L); k.stroke(); } });
    reg(256, 256, 512, 384, (w, h) => { x.fillStyle = '#6a6a3a'; x.fillRect(0, 0, w, h); leafBlob(w, h, 520, ['#7a7a3a', '#8a8a42', '#6a6a30', '#9a8a4a', '#5a6a32'], 5, false); });
    reg(0, 384, 256, 512, (w, h) => { x.fillStyle = '#4a6a2a'; x.fillRect(0, 0, w, h); x.lineCap = 'round'; k.lineCap = 'round'; for (let X = 3; X < w; X += 5 + r() * 3) { const L = h * (0.7 + r() * 0.3); x.strokeStyle = r() < 0.5 ? '#6a8a3a' : '#7a9a44'; x.lineWidth = 3; x.beginPath(); x.moveTo(X, h); x.lineTo(X + (r() - 0.5) * 6, h - L); x.stroke(); k.strokeStyle = '#fff'; k.lineWidth = 3; k.beginPath(); k.moveTo(X, h); k.lineTo(X + (r() - 0.5) * 6, h - L); k.stroke(); for (let q = 0; q < 2; q++) { const Y = h - L * (0.5 + r() * 0.5), s = r() < 0.5 ? -1 : 1; x.strokeStyle = '#8aaa4a'; x.lineWidth = 2; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + s * 18, Y - 14, X + s * 34, Y + 6); x.stroke(); k.lineWidth = 2; k.beginPath(); k.moveTo(X, Y); k.quadraticCurveTo(X + s * 18, Y - 14, X + s * 34, Y + 6); k.stroke(); } } });
    reg(256, 384, 512, 448, (w, h) => { x.fillStyle = '#5a5a5a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6a6a66'; k.strokeStyle = '#fff'; for (const Y of [12, 32, 52]) { x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, Y); x.lineTo(w, Y); x.stroke(); k.lineWidth = 2; k.beginPath(); k.moveTo(0, Y); k.lineTo(w, Y); k.stroke(); for (let X = 6; X < w; X += 18) { k.beginPath(); k.moveTo(X - 3, Y - 3); k.lineTo(X + 3, Y + 3); k.moveTo(X + 3, Y - 3); k.lineTo(X - 3, Y + 3); k.stroke(); } } });
    reg(256, 448, 512, 512, (w, h) => { x.fillStyle = '#5a6a32'; x.fillRect(0, 0, w, h); leafBlob(w, h, 300, ['#5a6a32', '#6a7a3a', '#4a5a2a'], 4, false); for (let i = 0; i < 90; i++) { const X = r() * w, Y = r() * h * 0.8; x.fillStyle = '#f8f6f0'; x.beginPath(); x.arc(X, Y, 2.5, 0, 7); x.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(X, Y, 2.5, 0, 7); k.fill(); } });
    return TEX3.pack(c, m);
  }
  // fachada repetível (4 m × 3 m por módulo): janelas, algumas quebradas, algumas acesas (brilham à noite)
  function facade(mini) {
    const S = 256, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(mini ? 515 : 414);
    const t = TEX3.cnv(S, S); TEX3.field(t.getContext('2d'), S, S, TEX3.fbm(S, S, 4, 4, mini ? 3 : 2, 0.6), mini ? [170, 170, 160] : [96, 92, 86], mini ? [206, 204, 194] : [140, 134, 124], 14, 5); x.drawImage(t, 0, 0);
    k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    if (mini) { for (let y = 0; y < S; y += 32) { x.fillStyle = '#28383c'; x.fillRect(0, y + 8, S, 18); for (let X = 0; X < S; X += 16) { const lit = r() < 0.06; x.fillStyle = lit ? '#e8d890' : r() < 0.2 ? '#0a0e10' : '#3a5058'; x.fillRect(X + 1, y + 9, 14, 16); if (lit) { k.fillStyle = '#bbb'; k.fillRect(X + 1, y + 9, 14, 16); } } } }
    else for (let y = 0; y < 4; y++) for (let X = 0; X < 4; X++) {
      const px = X * 64 + 14, py = y * 64 + 14, lit = r() < 0.08, broken = r() < 0.3;
      x.fillStyle = '#4a4440'; x.fillRect(px - 3, py - 3, 42, 40); x.fillStyle = lit ? '#e8c870' : broken ? '#060606' : '#22303a'; x.fillRect(px, py, 36, 34);
      if (!lit && !broken) { x.fillStyle = 'rgba(200,220,240,0.18)'; x.fillRect(px, py, 12, 34); }
      if (broken) { x.fillStyle = '#22303a'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 20, py); x.lineTo(px, py + 18); x.fill(); }
      if (lit) { k.fillStyle = '#ccc'; k.fillRect(px, py, 36, 34); }
      x.fillStyle = 'rgba(30,24,20,0.4)'; x.fillRect(px - 3, py + 37, 42, 14);
    }
    return TEX3.pack(c, m);
  }
  // placas: texto por cidade/km (cache pequeno)
  const signTex = new Map();
  function signFor(t1, t2) {
    const key = t1 + '|' + t2; let t = signTex.get(key);
    if (!t) {
      if (signTex.size > 12) { for (const [kk, v] of signTex) { v.free(); signTex.delete(kk); break; } }
      t = TEX3.T(() => { const c = TEX3.cnv(256, 128), x = c.getContext('2d'); x.fillStyle = '#0c6a3a'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#f2f2ea'; x.lineWidth = 5; x.strokeRect(6, 6, 244, 116); x.fillStyle = '#f2f2ea'; x.textAlign = 'center'; x.font = 'bold 30px Arial'; x.fillText(t1, 128, 52, 232); x.font = 'bold 26px Arial'; x.fillText(t2, 128, 96, 232); return TEX3.pack(c, 0); }, { repeat: false });
      signTex.set(key, t);
    }
    return t;
  }

  /* ---------- modelos (cada um: lista de submalhas {mesh, tex, atest}) ---------- */
  const MOD = {};
  const P2 = (tex, atest) => ({ b: new GL3.Builder(), tex, atest });
  function make(name, f) { if (!MOD[name]) MOD[name] = f(); return MOD[name]; }
  const trunk = (b, x, z, h, r0, r1, bend, uv, sides) => { const m = K3.mark(b), n = 4, rings = []; for (let i = 0; i <= n; i++) { const t = i / n; rings.push([t * h, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, Math.sin(t * PI * 0.8) * bend, 0]); } Z3D.loft(b, rings, sides || 7, uv, false, false); K3.xf(b, m, 0, 0, 0, x, 0, z); };
  const M = {
    arvore: (v) => make('arvore' + v, () => {
      const t = P2(texA()), f = P2(texB(), true), d = P2(texA()), tall = v === 1, ipe = v === 2;
      t.b.col = [1, 1, 1]; trunk(t.b, 0, 0, tall ? 4.5 : 3, 0.28, 0.16, 0.25, A.BARK);
      for (let i = 0; i < 3; i++) { const m = K3.mark(t.b); Z3D.loft(t.b, [[0, 0.1, 0.1, 0, 0], [1.6, 0.05, 0.05, 0, 0]], 5, A.BARK, false, false); K3.xf(t.b, m, 0.7, i * 2.1, 0, 0, tall ? 3.4 : 2.2, 0); }
      const cy = tall ? 5.6 : 4.1, R0 = tall ? 2.0 : 2.6; d.b.col = ipe ? [0.85, 0.7, 0.2] : [0.3, 0.45, 0.22];
      K3.blob(d.b, [0, cy, 0], R0 * 0.75, R0 * 0.55, R0 * 0.75, 8, 5, A.DARKG, 0.25, 3);
      const uv = ipe ? (v === 2 ? [B.IPE[0], B.IPE[1], (B.IPE[0] + B.IPE[2]) / 2, B.IPE[3]] : B.IPE) : B.LEAF;
      for (let i = 0; i < 7; i++) { const m = K3.mark(f.b), a = i * 0.9, y = cy - R0 * 0.55 + (i % 3) * R0 * 0.3; K3.quad(f.b, [-R0, 0, 0], [-R0, R0 * 1.2, 0], [R0, R0 * 1.2, 0], [R0, 0, 0], [0, 0, 1], uv, true); K3.xf(f.b, m, (i % 2 ? 0.5 : -0.3), a, 0, Math.cos(a) * 0.5, y, Math.sin(a) * 0.5); }
      return K3.model([t, d, f]);
    }),
    cerrado: (v) => make('cerrado' + v, () => {
      const t = P2(texA()), f = P2(texB(), true);
      trunk(t.b, 0, 0, 2.2, 0.16, 0.09, 0.7, A.BARK, 6); for (let i = 0; i < 3; i++) { const m = K3.mark(t.b); trunk(t.b, 0, 0, 1.4, 0.08, 0.04, 0.4, A.BARK, 5); K3.xf(t.b, m, 0.9, i * 2.2 + v, 0, 0.3, 1.8, 0); }
      for (let i = 0; i < 5; i++) { const m = K3.mark(f.b), a = i * 1.3 + v, s = 1.3 + (i % 2) * 0.5; K3.quad(f.b, [-s, 0, -s * 0.6], [-s, 0, s * 0.6], [s, 0, s * 0.6], [s, 0, -s * 0.6], [0, 1, 0], B.DRY, true); K3.xf(f.b, m, (i % 2 - 0.5) * 0.3, a, 0, Math.cos(a) * 0.8, 2.4 + (i % 3) * 0.35, Math.sin(a) * 0.8); }
      for (let i = 0; i < 3; i++) { const m = K3.mark(f.b); K3.quad(f.b, [-1.4, 0, 0], [-1.4, 1.1, 0], [1.4, 1.1, 0], [1.4, 0, 0], [0, 0, 1], B.DRY, true); K3.xf(f.b, m, 0, i * 1.05, 0, 0, 2.0, 0); }
      return K3.model([t, f]);
    }),
    cana: () => make('cana', () => { const o = P2(texA()), f = P2(texB(), true); K3.box(o.b, -5, 5, 0, 3.1, -3.5, 3.5, { side: A.CANES, front: A.CANES, back: A.CANES, top: A.CANET });
      for (let i = 0; i < 4; i++) { K3.quad(f.b, [-5 + i * 2.5, 0, 3.55], [-5 + i * 2.5, 3.8, 3.55], [-2.5 + i * 2.5, 3.8, 3.55], [-2.5 + i * 2.5, 0, 3.55], [0, 0, 1], B.CANE, true); K3.quad(f.b, [-5 + i * 2.5, 0, -3.55], [-5 + i * 2.5, 3.8, -3.55], [-2.5 + i * 2.5, 3.8, -3.55], [-2.5 + i * 2.5, 0, -3.55], [0, 0, -1], B.CANE, true); }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K3.quad(f.b, [s * 5.05, 0, -3.5 + i * 2.33], [s * 5.05, 3.8, -3.5 + i * 2.33], [s * 5.05, 3.8, -1.17 + i * 2.33], [s * 5.05, 0, -1.17 + i * 2.33], [s, 0, 0], B.CANE, true);
      for (let i = 0; i < 8; i++) { const m = K3.mark(f.b); K3.quad(f.b, [-2, 0, 0], [-2, 1.2, 0], [2, 1.2, 0], [2, 0, 0], [0, 0, 1], B.CANE, true); K3.xf(f.b, m, 0, i * 0.8, 0, -3.8 + (i % 4) * 2.5, 2.9, -2.5 + (i >> 2) * 5); }
      return K3.model([o, f]); }),
    canafogo: () => make('canafogo', () => { const o = P2(texA()); K3.box(o.b, -5, 5, 0, 2.2, -3.5, 3.5, A.BURNT); for (let i = 0; i < 14; i++) { const x = -4.6 + (i % 7) * 1.5, z = -3 + (i / 7 | 0) * 5.5; K3.box(o.b, x - 0.05, x + 0.05, 2.2, 3.0 + H(i) * 0.6, z - 0.05, z + 0.05, A.BURNT); } return K3.model([o]); }),
    poste: () => make('poste', () => { const o = P2(texA()); K3.cyl(o.b, [0, 0, 0], 0.17, 0.1, 9, 8, 'y', A.CONC, A.CONC, true); K3.box(o.b, -1.3, 1.3, 8.2, 8.38, -0.08, 0.08, A.CONC); for (const x of [-1.1, 0, 1.1]) K3.cyl(o.b, [x, 8.38, 0], 0.06, 0.04, 0.22, 6, 'y', A.WHITE, A.WHITE, true); K3.box(o.b, -0.3, 0.3, 6.6, 7.2, -0.25, 0.1, A.DARKG); return K3.model([o]); }),
    cerca: () => make('cerca', () => { const o = P2(texA()), w = P2(texB(), true); for (let i = -4; i <= 4; i += 2) K3.cyl(o.b, [i, 0, 0], 0.07, 0.06, 1.35, 6, 'y', A.WOOD, A.WOOD, true); K3.quad(w.b, [-4, 0.35, 0], [-4, 1.3, 0], [4, 1.3, 0], [4, 0.35, 0], [0, 0, 1], B.WIRE, true); return K3.model([o, w]); }),
    carreta: (v) => make('carreta' + v, () => { const o = P2(texA()); o.b.col = [[0.85, 0.3, 0.2], [0.3, 0.45, 0.7], [0.75, 0.75, 0.7]][v]; K3.box(o.b, -1.25, 1.25, 1.1, 3.9, -6, 6, { side: A.TRAIL, front: A.TRAIL, back: A.TRAIL, top: A.WHITE }); o.b.col = [1, 1, 1]; K3.box(o.b, -1.0, 1.0, 0.75, 1.1, -6, 6, A.DARKG); for (const z of [-4.6, -3.4]) for (const s of [-1, 1]) K3.cyl(o.b, [s * 1.05 - 0.15, 0.5, z], 0.5, 0.5, 0.3, 10, 'x', A.DARKG, A.CONC, true); return K3.model([o]); }),
    posto: () => make('posto', () => { const o = P2(texA()); K3.box(o.b, -7, 7, 5.0, 5.7, -4, 4, { side: A.CANOPY, front: A.CANOPY, back: A.CANOPY, top: A.WHITE, bottom: A.WHITE }); for (const x of [-6, 5.6]) for (const z of [-2.8, 2.8]) K3.box(o.b, x - 0.2, x + 0.2, 0, 5.0, z - 0.2, z + 0.2, A.WHITE);
      for (const x of [-2, 1.6]) K3.box(o.b, x - 0.45, x + 0.45, 0, 1.8, -0.35, 0.35, { side: A.WHITE, front: A.PUMP, back: A.PUMP, top: A.WHITE }); K3.box(o.b, -4, 4, 0, 0.18, -2, 2, A.CONC);
      K3.box(o.b, -6, 6, 0, 3.6, -11, -6, { side: A.WHITE, front: A.SHOP, back: A.WHITE, top: A.ROOF }); K3.cyl(o.b, [8, 0, 3], 0.18, 0.18, 9, 8, 'y', A.GALV, A.GALV, true); K3.box(o.b, 7.0, 9.0, 8.0, 10.2, 2.9, 3.1, { side: A.CANOPY, front: A.CANOPY, back: A.CANOPY, top: A.WHITE }); return K3.model([o]); }),
    soja: () => make('soja', () => { const o = P2(texA()); K3.box(o.b, -6, 6, 0, 0.62, -4, 4, A.SOY); return K3.model([o]); }),
    algodao: () => make('algodao', () => { const o = P2(texA()), f = P2(texB(), true); K3.box(o.b, -6, 6, 0, 0.6, -4, 4, A.COTTON); for (let i = 0; i < 5; i++) K3.quad(f.b, [-6, 0.3, -3.8 + i * 1.9], [-6, 1.0, -3.8 + i * 1.9], [6, 1.0, -3.8 + i * 1.9], [6, 0.3, -3.8 + i * 1.9], [0, 0, 1], B.COTP, true); return K3.model([o, f]); }),
    silo: () => make('silo', () => { const o = P2(texA()); K3.cyl(o.b, [0, 0, 0], 2.5, 2.5, 9, 14, 'y', A.GALV, A.GALV, false); K3.cyl(o.b, [0, 9, 0], 2.6, 0.2, 2.2, 14, 'y', A.GALV, A.GALV, true); K3.box(o.b, 2.45, 2.6, 0, 10, -0.25, 0.25, A.DARKG); K3.box(o.b, -2.7, 2.7, 0, 0.3, -2.7, 2.7, A.CONC); return K3.model([o]); }),
    pedra: (v) => make('pedra' + v, () => { const o = P2(texA()); K3.blob(o.b, [0, 0.35, 0], 1.3 + v * 0.3, 1.0 + v * 0.2, 1.1, 9, 6, A.ROCK, 0.4, 7 + v); if (v === 2) K3.blob(o.b, [1.2, 0.2, 0.6], 0.7, 0.55, 0.6, 7, 5, A.ROCK, 0.35, 21); return K3.model([o]); }),
    mandacaru: (v) => make('mandacaru' + v, () => { const o = P2(texA()), col = (x, z, y0, h, r) => { const m = K3.mark(o.b); Z3D.loft(o.b, [[0, r, r, 0, 0], [h * 0.9, r * 0.95, r * 0.95, 0, 0], [h, r * 0.55, r * 0.55, 0, 0]], 8, A.CACT, true, false); K3.xf(o.b, m, 0, 0, 0, x, y0, z); };
      col(0, 0, 0, 4.2 + v * 0.6, 0.24); for (const [s, y] of [[-1, 1.6], [1, 2.2], [-1, 2.9]].slice(0, 2 + v)) { const m = K3.mark(o.b); Z3D.loft(o.b, [[0, 0.16, 0.16, 0, 0], [0.7, 0.16, 0.16, 0, 0]], 7, A.CACT, false, false); K3.xf(o.b, m, 0, 0, -s * PI / 2, 0, y, 0); col(s * 0.7, 0, y - 0.05, 1.6, 0.16); } return K3.model([o]); }),
    xique: () => make('xique', () => { const o = P2(texA()); for (let i = 0; i < 6; i++) { const m = K3.mark(o.b), h = 0.8 + H(i * 3) * 1.4; Z3D.loft(o.b, [[0, 0.12, 0.12, 0, 0], [h, 0.11, 0.11, 0, 0], [h + 0.08, 0.05, 0.05, 0, 0]], 7, A.XIQ, true, false); K3.xf(o.b, m, (H(i) - 0.5) * 0.3, 0, (H(i + 9) - 0.5) * 0.3, (H(i * 7) - 0.5) * 1.6, 0, (H(i * 5) - 0.5) * 1.2); } return K3.model([o]); }),
    coqueiro: (v) => make('coqueiro' + v, () => { const o = P2(texA()), f = P2(texB(), true), h = 7.5 + v * 1.5, bend = 0.9 + v * 0.3;
      const rings = []; for (let i = 0; i <= 8; i++) { const t = i / 8; rings.push([t * h, 0.2 - t * 0.06, 0.2 - t * 0.06, Math.sin(t * PI * 0.5) * bend, 0]); } Z3D.loft(o.b, rings, 7, A.PALMB, true, false);
      o.b.col = [0.5, 0.4, 0.2]; for (let i = 0; i < 4; i++) K3.blob(o.b, [bend + Math.cos(i * 1.6) * 0.18, h - 0.25, Math.sin(i * 1.6) * 0.18], 0.13, 0.13, 0.13, 6, 4, A.BARK, 0, i);
      for (let i = 0; i < 8; i++) { const m = K3.mark(f.b), a = i * PI * 2 / 8 + v; K3.quad(f.b, [0, 0, -0.55], [0, 0, 0.55], [3.4, 0, 0.55], [3.4, 0, -0.55], [0, 1, 0], B.PALM, true); K3.xf(f.b, m, 0, a, -0.45 - (i % 2) * 0.25, bend, h, 0); }
      return K3.model([o, f]); }),
    placa: () => make('placa', () => { const o = P2(texA()); for (const x of [0, 4]) K3.cyl(o.b, [x, 0, 0], 0.09, 0.09, 4.4, 8, 'y', A.GALV, A.GALV, true); K3.box(o.b, -0.3, 4.3, 2.7, 4.6, -0.06, 0.04, { side: A.GALV, front: A.GALV, back: A.GALV, top: A.GALV }); return K3.model([o]); }),
    radar: () => make('radar', () => { const o = P2(texA()); K3.cyl(o.b, [0, 0, 0], 0.09, 0.07, 3.6, 8, 'y', A.GALV, A.GALV, true); K3.box(o.b, -0.35, 0.35, 3.5, 4.15, -0.3, 0.3, { side: A.WHITE, front: A.DARKG, back: A.WHITE, top: A.WHITE }); return K3.model([o]); }),
    guarda: () => make('guarda', () => { const o = P2(texA()); for (let i = -4; i <= 4; i += 2) K3.box(o.b, i - 0.08, i + 0.08, 0, 0.75, -0.08, 0.08, A.DARKG); K3.box(o.b, -4.05, 4.05, 0.42, 0.78, -0.03, 0.06, A.GALV); return K3.model([o]); }),
    penhasco: () => make('penhasco', () => { const o = P2(texA()); K3.blob(o.b, [0, 4, 0], 6.5, 9, 4.5, 10, 7, A.ROCK, 0.3, 5); K3.blob(o.b, [3, 9, 1], 4, 6, 3.5, 8, 6, A.ROCK, 0.3, 9); return K3.model([o]); }),
    pedagio: () => make('pedagio', () => { const o = P2(texA()); K3.box(o.b, -2, 29, 6.5, 7.6, -5, 5, { side: A.CANOPY, front: A.CANOPY, back: A.CANOPY, top: A.ROOF, bottom: A.WHITE }); for (const x of [-1, 10, 18, 27]) K3.box(o.b, x - 0.5, x + 0.5, 0, 6.5, -1.5, 1.5, { side: A.WHITE, front: A.SHOP, back: A.WHITE, top: A.ROOF }); return K3.model([o]); }),
    pilar: () => make('pilar', () => { const o = P2(texA()); K3.box(o.b, -0.9, 0.9, -7.5, -1.5, -0.9, 0.9, A.CONC); K3.box(o.b, -1.3, 1.3, -1.75, -1.5, -1.2, 1.2, A.CONC); return K3.model([o]); }),
    // miudezas de beira de estrada
    tufo: () => make('tufo', () => { const f = P2(texB(), true); K3.cards(f.b, [0, 0, 0], 1.4, 0.75, 3, B.GRASS); return K3.model([f]); }),
    pedrinha: () => make('pedrinha', () => { const o = P2(texA()); K3.blob(o.b, [0, 0.08, 0], 0.32, 0.2, 0.26, 6, 4, A.ROCK, 0.4, 3); return K3.model([o]); }),
    lixo: () => make('lixo', () => { const o = P2(texA()); K3.box(o.b, -0.6, 0.6, 0, 0.06, -0.4, 0.4, A.TRASH); K3.cyl(o.b, [0.3, 0.2, 0], 0.2, 0.2, 0.5, 8, 'z', A.DARKG, A.DARKG, true); return K3.model([o]); }),
    marcokm: () => make('marcokm', () => { const o = P2(texA()); K3.box(o.b, -0.15, 0.15, 0, 0.8, -0.1, 0.1, { side: A.WHITE, front: A.KM, back: A.KM, top: A.WHITE }); return K3.model([o]); }),
    feno: () => make('feno', () => { const o = P2(texA()); K3.cyl(o.b, [-0.7, 0.75, 0], 0.75, 0.75, 1.4, 12, 'x', A.HAY, A.HAY, true); return K3.model([o]); }),
  };
  const BOI_COW = Object.assign(['#e8e2d6', '#9a948a', '#ffffff', '#2a2420'], { cow: true });

  /* ---------- prédios: caixas com fachada repetível (um modelo por tamanho arredondado) ---------- */
  function building(w, h, d, mini) {
    return make('pr' + w + 'x' + h + 'x' + d + (mini ? 'm' : ''), () => {
      const o = { b: new GL3.Builder(), tex: mini ? fmin() : fac() }, rt = P2(texA()), uw = w / 4, uh = h / 3, ud = d / 4;
      const b = o.b;
      K3.quad(b, [-w / 2, 0, d / 2], [-w / 2, h, d / 2], [w / 2, h, d / 2], [w / 2, 0, d / 2], [0, 0, 1], [0, 0, uw, uh]);
      K3.quad(b, [w / 2, 0, -d / 2], [w / 2, h, -d / 2], [-w / 2, h, -d / 2], [-w / 2, 0, -d / 2], [0, 0, -1], [0, 0, uw, uh]);
      K3.quad(b, [-w / 2, 0, -d / 2], [-w / 2, h, -d / 2], [-w / 2, h, d / 2], [-w / 2, 0, d / 2], [-1, 0, 0], [0, 0, ud, uh]);
      K3.quad(b, [w / 2, 0, d / 2], [w / 2, h, d / 2], [w / 2, h, -d / 2], [w / 2, 0, -d / 2], [1, 0, 0], [0, 0, ud, uh]);
      K3.quad(rt.b, [-w / 2, h, d / 2], [-w / 2, h, -d / 2], [w / 2, h, -d / 2], [w / 2, h, d / 2], [0, 1, 0], A.CONC);
      K3.box(rt.b, -w / 2 - 0.1, w / 2 + 0.1, h, h + 0.4, -d / 2 - 0.1, d / 2 + 0.1, A.CONC);
      if (!mini) { K3.box(rt.b, -0.8, 0.8, h + 0.4, h + 2.0, -0.8, 0.8, A.RUSTM); K3.cyl(rt.b, [w * 0.25, h + 0.4, 0], 0.7, 0.7, 1.6, 10, 'y', A.GALV, A.GALV, true); }
      return K3.model([o, rt]);
    });
  }

  /* ---------- colocar no mundo ---------- */
  const add = (R, md, x, y, z, f, k, shade, ky) => { for (const p of md) R.inst(p.mesh, p.tex, p.atest, x, y, z, f[0], f[1], k, shade, ky); };
  function addScenery(R, s, vx, vy, vz, ctx) {
    const t = s.t, seed = s.seed, h1 = H(seed), h2 = H(seed * 1.7 + 3), sl = ctx.slope(vz), F = (yaw) => Z3D.fwd(R, yaw, sl), rnd = F(h1 * PI * 2), road = F(0), side = s.side || (s.wx > ctx.center(vz) ? 1 : -1);
    const sh = 0.85 + h2 * 0.3;
    switch (t) {
      case 'arvore': add(R, M.arvore(h1 < 0.15 ? 2 : h1 < 0.55 ? 0 : 1), vx, vy, vz, rnd, 0.8 + h2 * 0.5, sh); R.blob(vx, vy, vz, 3.2, 3.2, 0.4); break;
      case 'cerrado': add(R, M.cerrado(h2 < 0.5 ? 0 : 1), vx, vy, vz, rnd, 0.9 + h1 * 0.6, sh); R.blob(vx, vy, vz, 2.4, 2.4, 0.3); break;
      case 'cana': add(R, M.cana(), vx, vy, vz, road, 1, sh, 0.95 + h1 * 0.25); break;
      case 'canafogo': { add(R, M.canafogo(), vx, vy, vz, road, 1, 1); const tt = G.t; for (let i = 0; i < 5; i++) { const lx = -4 + i * 2, fx = vx + lx * R.det * road[1], fz = vz - lx * R.det * road[0], fh = 1.6 + Math.sin(tt * 9 + seed + i * 2) * 0.6 + H(seed + i) * 1.4; R.flame(fx, vy + 2.2 + fh * 0.5, fz, 0.9, fh, 0.9); } R.glow(vx, vy + 3, vz, 7, 4, 1, 0.4, 0.1, 0.35); break; }
      case 'poste': add(R, M.poste(), vx, vy, vz, road, 1, 1); break;
      case 'cerca': add(R, M.cerca(), vx, vy, vz, road, 1, sh); break;
      case 'pasto': {   // gado pastando (não infectado)
        const cow = M.feno(); if (h1 < 0.3) { add(R, cow, vx, vy, vz, rnd, 1, sh); break; }
        const mesh = Z3D.boiMesh(), tex = Z3D.boiAtlasFor(BOI_COW), A2 = Z3D.cowPose(seed), f = F(h1 * PI * 2); const M2 = R.place(null, vx, vy, vz, f[0], f[1], 0.95);
        R.skin(mesh, tex, M2, Z3D.solve(mesh.skel, A2, null, [0, 0, 0]), { glow: 0 }); R.blob(vx, vy, vz, 1.0, 1.6, 0.45); break;
      }
      case 'carreta': add(R, M.carreta(Math.abs(seed | 0) % 3), vx, vy, vz, F(h1 > 0.5 ? -0.12 : 0.1), 1, 1); R.blob(vx, vy, vz, 1.8, 6.5, 0.5); break;
      case 'posto': add(R, M.posto(), vx, vy, vz, F(side > 0 ? -PI / 2 : PI / 2), 1, 1); if (R.L.night) R.glow(vx, vy + 4.8, vz, 6, 1.2, 1, 0.95, 0.8, 0.5); break;
      case 'predio': { const w = 7 + Math.round(h2 * 5), h = 8 + Math.round(h1 * 14), d = 8; add(R, building(w, h, d, false), vx, vy, vz, road, 1, 0.9 + h2 * 0.2); break; }
      case 'ministerio': add(R, building(12, 22, 10, true), vx, vy, vz, road, 1, 1); break;
      case 'soja': add(R, M.soja(), vx, vy, vz, road, 1, sh); break;
      case 'algodao': add(R, M.algodao(), vx, vy, vz, road, 1, sh); break;
      case 'silo': add(R, M.silo(), vx, vy, vz, road, 1, 1); R.blob(vx, vy, vz, 3, 3, 0.4); break;
      case 'pedra': add(R, M.pedra((seed % 3 + 3) % 3), vx, vy, vz, rnd, 0.8 + h1 * 1.6, sh); break;
      case 'mandacaru': add(R, M.mandacaru(h2 < 0.5 ? 0 : 1), vx, vy, vz, rnd, 0.85 + h1 * 0.4, sh); R.blob(vx, vy, vz, 1.2, 1.2, 0.35); break;
      case 'xique': add(R, M.xique(), vx, vy, vz, rnd, 0.9 + h1 * 0.5, sh); break;
      case 'coqueiro': add(R, M.coqueiro(h2 < 0.5 ? 0 : 1), vx, vy, vz, F(h1 * PI * 2), 1, sh); R.blob(vx, vy, vz, 2.6, 2.6, 0.3); break;
      case 'placa': { add(R, M.placa(), vx, vy, vz, F(PI), 1, 1); const st = s.st || {}; const bf = F(PI), M2 = R.place(null, vx + bf[1] * R.det * 2.0, vy, vz - bf[0] * R.det * 2.0, bf[0], bf[1], 1); R.model(signMesh(), signFor(st.txt1 || '', st.txt2 || ''), M2, { glow: 0 }); break; }
      case 'radar': add(R, M.radar(), vx, vy, vz, F(PI), 1, 1); break;
      case 'guarda': add(R, M.guarda(), vx, vy, vz, road, 1, 1); if (Math.abs(seed) % 4 === 0) add(R, M.pilar(), vx + (side > 0 ? -1 : 1) * R.fs * 0.9, vy, vz, road, 1, 1); break;
      case 'penhasco': add(R, M.penhasco(), vx, vy, vz, rnd, 1, sh); break;
      case 'pedagio': add(R, M.pedagio(), vx, vy, vz, road, 1, 1); break;
    }
  }
  // tabuleta da placa (frente com o texto), posta à frente dos postes
  let signM = null;
  function signMesh() { if (signM) return signM; const b = new GL3.Builder(); K3.quad(b, [-2.2, 2.75, 0.08], [-2.2, 4.55, 0.08], [2.2, 4.55, 0.08], [2.2, 2.75, 0.08], [0, 0, 1], [1, 0, 0, 1]); return (signM = b.mesh()); }

  // miudezas sorteadas por segmento (capim, pedrinhas, lixo, marco quilométrico, fardos)
  function clutter(R, v, base, off, N, ctx) {
    const st = G.st, dir = v.dir, fs = v.flip ? -1 : 1, y = -v.camH, X = W3D.X, Nn = Math.min(N, 46), dry = st.penhasco || st === STAGES[6] || st === STAGES[7];
    for (let n = 1; n < Nn; n++) {
      const i = Math.round(base + dir * n); if (isBridge(i * SEG)) continue;
      const cnt = n < 18 ? 5 : 2;
      for (let q = 0; q < cnt; q++) {
        const h = H(i * 7.31 + q * 1.7), h2 = H(i * 3.17 + q * 5.1), sd = h < 0.5 ? -1 : 1; if (st.penhasco && sd > 0) continue;
        const lat = sd * (ROADW + 2.8 + h2 * 13), zz = (n + H(i + q * 9.3) - off) * SEG; if (zz < 1.2) continue;
        const nf = zz / SEG + off, n0 = Math.max(0, Math.floor(nf)), tt = nf - n0, cx = X[n0] + (X[n0 + 1] - X[n0]) * tt, vx = fs * (cx + lat - v.camX);
        const kind = H(i * 1.1 + q * 2.3), sl = (X[n0 + 1] - X[n0]) / SEG, f = Z3D.fwd(R, h * 9, sl);
        if (kind < 0.62) add(R, M.tufo(), vx, y, zz, f, 0.7 + h2 * 0.8, dry ? 1.25 : 0.9 + h * 0.2, 0.7 + h * 0.7);
        else if (kind < 0.86) add(R, M.pedrinha(), vx, y, zz, f, 0.6 + h2 * 1.4, 0.9);
        else if (kind < 0.93 && n < 30) add(R, M.lixo(), vx, y, zz, f, 0.9, 1);
        else if (st.cen && st.cen.includes('pasto') && kind < 0.97) add(R, M.feno(), vx, y, zz, f, 1, 1);
      }
      if (i % 125 === 7) { const zz = (n - off) * SEG; if (zz > 1.2) { const vx = fs * (X[n] + ROADW + 1.4 - v.camX); add(R, M.marcokm(), vx, y, zz, Z3D.fwd(R, PI, (X[n + 1] - X[n]) / SEG), 1, 1); } }
    }
  }
  return { add: addScenery, clutter, M, tex: texA, texB, building, signFor };
})();
