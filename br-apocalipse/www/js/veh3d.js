'use strict';
/* Veículos 3D: inimigos (moto, picape, buggy, blindado, carro-bomba, escolta), obstáculos (carcaça, pregos, baú do Exército,
   ponto de ônibus com sobrevivente, rampa do navio), o carro dos jogadores com todos os upgrades e o capô visto de dentro. */
const V3D = (() => {
  const UV = K3.R(512), PI = Math.PI, M4 = GL3.M4;
  const A = {
    PAINT: UV(0, 0, 256, 128), GLASS: UV(256, 0, 384, 64), GRILLE: UV(384, 0, 512, 64), TAIL: UV(256, 64, 384, 128), TIRE: UV(384, 64, 448, 128), RIM: UV(448, 64, 512, 128),
    RUST: UV(0, 128, 128, 256), METAL: UV(128, 128, 256, 256), WOOD: UV(256, 128, 384, 192), CANVAS: UV(384, 128, 512, 192), CHROME: UV(256, 192, 384, 256),
    RED: UV(386, 194, 414, 222), BLUE: UV(418, 194, 446, 222), AMBER: UV(450, 194, 478, 222), WHITE: UV(482, 194, 510, 222), DARK: UV(384, 224, 448, 256), BARREL: UV(448, 224, 512, 256),
    HAZ: UV(0, 256, 128, 320), SAW: UV(128, 256, 192, 320), MESH: UV(192, 256, 256, 320), SEAT: UV(256, 256, 320, 320), CONC: UV(320, 256, 384, 320), PLATE: UV(384, 256, 512, 320),
    GLASSF: UV(0, 320, 128, 384), STAR: UV(128, 320, 192, 384), LOGO: UV(192, 320, 512, 384),
  };
  let atlas = null;
  const tex = () => atlas || (atlas = TEX3.T(makeAtlas, { repeat: false }));
  function makeAtlas() {
    const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(4242), css = TEX3.css;
    x.fillStyle = '#777'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip(); q.translate(x0, y0); } f(x1 - x0, y1 - y0); x.restore(); k.restore(); };
    const fld = (w, h, n, ca, cb, grain, seed) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, n, ca, cb, grain, seed); x.drawImage(t, 0, 0); };
    // pintura (tingida pela cor do carro): costuras de porta, sujeira embaixo, ferrugem, riscos, buracos de bala, sangue
    reg(0, 0, 256, 128, (w, h) => {
      fld(w, h, TEX3.fbm(w, h, 4, 4, 11, 0.5), [196, 196, 196], [228, 228, 228], 8, 1);
      x.strokeStyle = 'rgba(30,30,30,0.6)'; x.lineWidth = 1.2; x.beginPath(); for (const X of [70, 130, 190]) { x.moveTo(X, 34); x.lineTo(X - 3, 112); } x.moveTo(0, 44); x.lineTo(w, 44); x.stroke();
      const g = x.createLinearGradient(0, 70, 0, h); g.addColorStop(0, 'rgba(110,86,50,0)'); g.addColorStop(1, 'rgba(110,86,50,0.75)'); x.fillStyle = g; x.fillRect(0, 70, w, h - 70);
      for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(${120 + r() * 50 | 0},${60 + r() * 20 | 0},20,${0.3 + r() * 0.4})`; x.beginPath(); x.ellipse(r() * w, r() * h, 2 + r() * 9, 2 + r() * 6, r() * 3, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(250,250,250,0.5)'; x.lineWidth = 0.8; for (let i = 0; i < 26; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 30, Y + (r() - 0.5) * 8); x.stroke(); }
      for (let i = 0; i < 9; i++) { const X = r() * w, Y = 20 + r() * 80; x.fillStyle = '#cfcfcf'; x.beginPath(); x.arc(X, Y, 3, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(X, Y, 1.7, 0, 7); x.fill(); }
      for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(110,8,6,0.75)'; const X = r() * w, Y = r() * 70; x.beginPath(); x.ellipse(X, Y, 8 + r() * 10, 5 + r() * 6, r() * 3, 0, 7); x.fill(); for (let d = 0; d < 3; d++) x.fillRect(X + (r() - 0.5) * 14, Y, 2, 10 + r() * 22); }
    });
    // vidro escuro com reflexo e trincas
    const glass = (w, h) => { const g = x.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, '#2c3c48'); g.addColorStop(0.55, '#0c1218'); g.addColorStop(1, '#18222a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(210,230,245,0.18)'; x.beginPath(); x.moveTo(w * 0.15, 0); x.lineTo(w * 0.35, 0); x.lineTo(w * 0.1, h); x.lineTo(0, h); x.fill(); x.beginPath(); x.moveTo(w * 0.45, 0); x.lineTo(w * 0.5, 0); x.lineTo(w * 0.3, h); x.lineTo(w * 0.27, h); x.fill(); x.strokeStyle = 'rgba(220,230,240,0.45)'; x.lineWidth = 0.7; const X = w * (0.6 + r() * 0.3), Y = h * 0.4; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(X, Y); const a = i * 0.9; x.lineTo(X + Math.cos(a) * 14, Y + Math.sin(a) * 10); x.stroke(); } };
    reg(256, 0, 384, 64, glass); reg(0, 320, 128, 384, glass);
    // frente: grade, faróis (brilham), para-choque
    reg(384, 0, 512, 64, (w, h) => {
      x.fillStyle = '#1a1c1e'; x.fillRect(0, 0, w, h); x.fillStyle = '#0a0a0a'; for (let y = 10; y < 40; y += 6) x.fillRect(w * 0.3, y, w * 0.4, 3);
      for (const X of [w * 0.13, w * 0.87]) { const g = x.createRadialGradient(X, 24, 1, X, 24, 13); g.addColorStop(0, '#fffef0'); g.addColorStop(0.6, '#f0e8c0'); g.addColorStop(1, '#8a8670'); x.fillStyle = g; x.beginPath(); x.ellipse(X, 24, 14, 10, 0, 0, 7); x.fill(); k.fillStyle = '#fff'; k.beginPath(); k.ellipse(X, 24, 13, 9, 0, 0, 7); k.fill(); }
      x.fillStyle = '#e09020'; x.fillRect(w * 0.22, 20, 7, 8); x.fillRect(w * 0.78 - 7, 20, 7, 8); x.fillStyle = '#3a3c3e'; x.fillRect(0, 44, w, 20);
    });
    // traseira: lanternas vermelhas (brilham), placa, para-choque
    reg(256, 64, 384, 128, (w, h) => {
      x.fillStyle = '#2a2c2e'; x.fillRect(0, 0, w, h);
      for (const X of [4, w - 30]) { x.fillStyle = '#d01010'; x.fillRect(X, 14, 26, 16); x.fillStyle = '#ff6a50'; x.fillRect(X + 3, 17, 20, 4); k.fillStyle = '#ddd'; k.fillRect(X, 14, 26, 16); }
      x.fillStyle = '#d8d8d0'; x.fillRect(w / 2 - 22, 30, 44, 14); x.fillStyle = '#222'; x.font = 'bold 10px monospace'; x.textAlign = 'center'; x.fillText('ZMB 0BR', w / 2, 41); x.fillStyle = '#3a3c3e'; x.fillRect(0, 48, w, 16);
    });
    reg(384, 64, 448, 128, (w, h) => { x.fillStyle = '#121212'; x.fillRect(0, 0, w, h); x.fillStyle = '#262626'; for (let y = 0; y < h; y += 8) for (let X = (y / 8) % 2 * 8; X < w; X += 16) x.fillRect(X, y, 10, 5); });
    reg(448, 64, 512, 128, (w, h) => { x.fillStyle = '#141414'; x.fillRect(0, 0, w, h); x.fillStyle = '#8a8c90'; x.beginPath(); x.arc(32, 32, 20, 0, 7); x.fill(); x.fillStyle = '#5a5c60'; x.beginPath(); x.arc(32, 32, 7, 0, 7); x.fill(); x.fillStyle = '#2a2a2a'; for (let i = 0; i < 5; i++) { const a = i * 1.2566; x.beginPath(); x.arc(32 + Math.cos(a) * 13, 32 + Math.sin(a) * 13, 3.5, 0, 7); x.fill(); } });
    reg(0, 128, 128, 256, (w, h) => { fld(w, h, TEX3.fbm(w, h, 4, 5, 21, 0.6), [40, 22, 14], [150, 70, 30], 30, 2); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(10,8,6,${0.3 + r() * 0.5})`; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 8, 0, 7); x.fill(); } });
    reg(128, 128, 256, 256, (w, h) => { fld(w, h, TEX3.fbm(w, h, 4, 4, 31, 0.55), [52, 58, 50], [86, 92, 82], 10, 3); x.strokeStyle = 'rgba(20,22,20,0.8)'; x.lineWidth = 2; for (let y = 0; y < h; y += 42) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } for (let X = 0; X < w; X += 64) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); } x.fillStyle = '#9a9e98'; for (let y = 6; y < h; y += 42) for (let X = 6; X < w; X += 16) { x.beginPath(); x.arc(X, y, 1.6, 0, 7); x.fill(); } x.strokeStyle = 'rgba(200,190,170,0.35)'; for (let i = 0; i < 20; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + 12, Y + 3); x.stroke(); } });
    reg(256, 128, 384, 192, (w, h) => { fld(w, h, TEX3.fbm(w, h, 2, 4, 41, 0.6), [100, 66, 36], [150, 106, 64], 14, 4); x.strokeStyle = 'rgba(40,24,10,0.8)'; x.lineWidth = 1.5; for (let y = 0; y < h; y += 13) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } });
    reg(384, 128, 512, 192, (w, h) => { fld(w, h, TEX3.fbm(w, h, 4, 4, 51, 0.6), [64, 70, 40], [96, 104, 62], 12, 5); x.strokeStyle = 'rgba(30,34,20,0.5)'; x.lineWidth = 2; for (let X = 8; X < w; X += 20) { x.beginPath(); x.moveTo(X, 0); x.quadraticCurveTo(X + 6, h / 2, X, h); x.stroke(); } });
    reg(256, 192, 384, 256, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0f2f4'); g.addColorStop(0.45, '#8a9098'); g.addColorStop(0.55, '#5a6068'); g.addColorStop(1, '#c0c4c8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const cell = (x0, col) => reg(x0, 192, x0 + 32, 224, (w, h) => { x.fillStyle = col; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(6, 6, 10, 6); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    cell(384, '#ff1a10'); cell(416, '#2a5aff'); cell(448, '#ffa010'); cell(480, '#fff8e0');
    reg(384, 224, 448, 256, (w, h) => { x.fillStyle = '#0e0e10'; x.fillRect(0, 0, w, h); });
    reg(448, 224, 512, 256, (w, h) => { x.fillStyle = '#a81a10'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8c020'; x.fillRect(0, 12, w, 8); x.fillStyle = '#5a0a06'; x.fillRect(0, 0, w, 3); x.fillRect(0, h - 3, w, 3); });
    reg(0, 256, 128, 320, (w, h) => { x.fillStyle = '#e8c020'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (let i = -h; i < w; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 12, 0); x.lineTo(i + 12 + h, h); x.lineTo(i + h, h); x.fill(); } });
    reg(128, 256, 192, 320, (w, h) => { x.fillStyle = '#8a8e92'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2a2a'; for (let y = 0; y < h; y += 6) { x.beginPath(); x.moveTo(0, y); x.lineTo(8, y + 3); x.lineTo(0, y + 6); x.fill(); x.beginPath(); x.moveTo(w, y); x.lineTo(w - 8, y + 3); x.lineTo(w, y + 6); x.fill(); } x.fillStyle = '#c86a1a'; x.fillRect(w * 0.3, 0, w * 0.4, 10); });
    reg(192, 256, 256, 320, (w, h) => { x.fillStyle = '#16181a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a8c88'; x.lineWidth = 1.5; for (let i = 0; i < w; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
    reg(256, 256, 320, 320, (w, h) => fld(w, h, TEX3.fbm(w, h, 2, 3, 61, 0.5), [50, 34, 24], [84, 60, 42], 10, 6));
    reg(320, 256, 384, 320, (w, h) => fld(w, h, TEX3.fbm(w, h, 2, 4, 71, 0.6), [110, 110, 104], [160, 158, 150], 26, 7));
    reg(384, 256, 512, 320, (w, h) => { x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a3a7a'; x.fillRect(0, 0, w, 14); x.fillStyle = '#111'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.fillText('BRZ 2X26', w / 2, 52); });
    reg(128, 320, 192, 384, (w, h) => { x.fillStyle = '#4a2e14'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8b040'; x.beginPath(); for (let a = 0; a < 10; a++) { const t = a / 10 * PI * 2 - PI / 2, rr = a % 2 ? 9 : 22; a ? x.lineTo(32 + Math.cos(t) * rr, 32 + Math.sin(t) * rr) : x.moveTo(32 + Math.cos(t) * rr, 32 + Math.sin(t) * rr); } x.fill(); });
    reg(192, 320, 512, 384, (w, h) => { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f0f0f0'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('CHOQUE', w / 2, 46); });
    return TEX3.pack(c, m);
  }

  /* ---------- carrocerias ---------- */
  // regra de textura das bordas do perfil: frente = grade, trás = lanterna, baixo = escuro, teto/capô = pintura
  const edgeLower = (i, n) => n[2] > 0.72 ? A.GRILLE : n[2] < -0.72 ? A.TAIL : n[1] < -0.5 ? A.DARK : A.PAINT;
  const edgeCabin = (i, n) => n[1] > 0.85 ? A.PAINT : n[1] < -0.5 ? null : A.GLASS;
  const BODY = {
    sedan: { L: 4.4, W: 1.76, low: [[-2.2, 0.32], [-2.2, 0.86], [-1.95, 0.95], [1.75, 0.92], [2.2, 0.8], [2.2, 0.32], [1.9, 0.2], [-1.9, 0.2]], cab: [[-1.5, 0.92], [-0.95, 1.38], [0.45, 1.41], [1.08, 0.92]], ins: 0.16, wr: 0.33, wz: [-1.35, 1.35] },
    hatch: { L: 3.7, W: 1.6, low: [[-1.85, 0.32], [-1.85, 0.9], [-1.72, 0.95], [1.45, 0.92], [1.85, 0.8], [1.85, 0.32], [1.55, 0.2], [-1.55, 0.2]], cab: [[-1.82, 0.93], [-1.72, 1.45], [0.25, 1.48], [0.95, 0.92]], ins: 0.14, wr: 0.3, wz: [-1.2, 1.2] },
    wagon: { L: 4.9, W: 1.8, low: [[-2.45, 0.32], [-2.45, 0.9], [-2.3, 0.95], [1.9, 0.93], [2.45, 0.82], [2.45, 0.32], [2.1, 0.2], [-2.1, 0.2]], cab: [[-2.4, 0.93], [-2.35, 1.42], [0.45, 1.45], [1.12, 0.93]], ins: 0.16, wr: 0.33, wz: [-1.55, 1.5] },
    pickup: { L: 5.3, W: 1.86, low: [[-2.65, 0.42], [-2.65, 1.02], [2.3, 1.02], [2.65, 0.92], [2.65, 0.42], [2.35, 0.3], [-2.35, 0.3]], cab: [[-0.95, 1.0], [-0.85, 1.76], [0.72, 1.79], [1.38, 1.0]], ins: 0.15, wr: 0.4, wz: [-1.7, 1.65], bed: [-2.6, -1.0] },
    van: { L: 5.6, W: 2.0, low: [[-2.8, 0.42], [-2.8, 2.25], [1.55, 2.3], [2.3, 1.45], [2.8, 1.15], [2.8, 0.42], [2.5, 0.3], [-2.5, 0.3]], cab: null, ins: 0.06, wr: 0.42, wz: [-1.9, 1.75] },
  };
  function wheelMesh() {
    if (wheelMesh.m) return wheelMesh.m;
    const b = new GL3.Builder(); K3.cyl(b, [-0.5, 0, 0], 1, 1, 1, 14, 'x', A.TIRE, A.RIM, true);
    return (wheelMesh.m = K3.model([{ b, tex: tex() }]));
  }
  // monta uma carroceria pelo perfil; tintM = material tingido (1) ou fixo (0)
  function body(b, d, o) {
    o = o || {}; const hw = d.W / 2;
    b.mat = o.rust ? 0 : 1; b.col = [1, 1, 1];
    K3.extrude(b, d.low, -hw, hw, o.rust ? A.RUST : A.PAINT, (i, n) => { const u = edgeLower(i, n); b.mat = !o.rust && u === A.PAINT ? 1 : 0; return o.rust && u === A.PAINT ? A.RUST : u; });
    if (d.cab) { b.mat = 0; K3.extrude(b, d.cab, -hw + 0.04, hw - 0.04, o.rust ? A.DARK : A.GLASSF, (i, n) => { const u = edgeCabin(i, n); return u === A.PAINT ? (b.mat = o.rust ? 0 : 1, o.rust ? A.RUST : A.PAINT) : (b.mat = 0, u && (o.rust ? A.DARK : u)); }, d.ins); b.mat = 1; }
    if (d.bed) { b.mat = 0; K3.quad(b, [-hw + 0.08, d.low[1][1] + 0.005, d.bed[0]], [-hw + 0.08, d.low[1][1] + 0.005, d.bed[1]], [hw - 0.08, d.low[1][1] + 0.005, d.bed[1]], [hw - 0.08, d.low[1][1] + 0.005, d.bed[0]], [0, 1, 0], A.DARK); }
  }
  const cache = {};
  const ONE = new Float32Array([1, 1, 1]), TINT = new Float32Array(3), MT = M4.make(), MW = M4.make(), MW2 = M4.make();

  /* ---------- modelos dos inimigos e obstáculos ---------- */
  function enemyModel(type) {
    if (cache[type]) return cache[type];
    const b = new GL3.Builder(), T = tex(); let wheels = [], lights = { f: [], r: [] }, extra = {};
    const addWheels = (d, xs) => { for (const z of d.wz) for (const s of [-1, 1]) wheels.push([s * (xs || d.W / 2 - 0.1), d.wr, z, d.wr, 0.26]); };
    switch (type) {
      case 'pickup': case 'escolta': { const d = BODY.pickup; body(b, d); addWheels(d); b.mat = 0; K3.box(b, -0.9, 0.9, 1.02, 1.12, -2.6, -2.5, A.METAL); for (const s of [-1, 1]) K3.box(b, s * 0.93 - 0.04, s * 0.93 + 0.04, 1.02, 1.7, -1.0, -0.9, A.METAL); K3.box(b, -0.95, 0.95, 1.62, 1.7, -1.0, -0.9, A.METAL);   // santo-antônio
        if (type === 'escolta') { b.mat = 0; for (const s of [-1, 1]) { const m = K3.mark(b); K3.quad(b, [s * 0.94, 0.55, -0.6], [s * 0.94, 0.95, -0.6], [s * 0.94, 0.95, 0.4], [s * 0.94, 0.55, 0.4], [s, 0, 0], A.STAR); } K3.box(b, -1.05, 1.05, 0.45, 0.85, 2.62, 2.85, A.METAL); }
        extra.rider = type === 'pickup' ? [0, 1.02, -1.8] : [0.4, 1.02, -1.9]; extra.rider2 = type === 'escolta' ? [-0.5, 1.02, -2.0] : null; lights = { f: [[0.72, 0.75, 2.66], [-0.72, 0.75, 2.66]], r: [[0.8, 0.8, -2.66], [-0.8, 0.8, -2.66]] }; break; }
      case 'carrobomba': case 'carcaca': { const d = BODY.sedan, rust = type === 'carcaca'; body(b, d, { rust }); if (!rust) { addWheels(d); b.mat = 0; for (const z of [-0.9, -0.2, 0.5]) K3.cyl(b, [0, 1.41, z], 0.27, 0.27, 0.62, 10, 'y', A.BARREL, A.DARK, true); extra.beacon = [0, 2.1, -0.2]; K3.box(b, -0.08, 0.08, 2.03, 2.15, -0.28, -0.12, A.RED); }
        else { b.mat = 0; for (const z of d.wz) for (const s of [-1, 1]) { const m = K3.mark(b); K3.cyl(b, [s * (d.W / 2 - 0.25) - 0.11, 0.2, z], 0.27, 0.27, 0.22, 10, 'x', A.TIRE, A.DARK, true); } }
        lights = rust ? { f: [], r: [] } : { f: [[0.66, 0.66, 2.2], [-0.66, 0.66, 2.2]], r: [[0.7, 0.72, -2.2], [-0.7, 0.72, -2.2]] }; break; }
      case 'buggy': {   // banheira baixa + gaiola + rodas grandes atrás
        b.mat = 1; K3.extrude(b, [[-1.5, 0.35], [-1.6, 0.8], [0.8, 0.85], [1.65, 0.55], [1.65, 0.35], [1.2, 0.25], [-1.2, 0.25]], -0.72, 0.72, A.PAINT, (i, n) => edgeLower(i, n));
        b.mat = 0; const bar = (x0, y0, z0, x1, y1, z1) => { const m = K3.mark(b), L = Math.hypot(x1 - x0, y1 - y0, z1 - z0); K3.cyl(b, [0, 0, 0], 0.045, 0.045, L, 6, 'y', A.DARK, null, false); const ry = Math.atan2(x1 - x0, z1 - z0), rx = Math.acos(Math.max(-1, Math.min(1, (y1 - y0) / L))); K3.xf(b, m, rx, ry, 0, x0, y0, z0); };
        for (const s of [-1, 1]) { bar(s * 0.66, 0.8, -1.2, s * 0.55, 1.75, -0.6); bar(s * 0.55, 1.75, -0.6, s * 0.55, 1.75, 0.2); bar(s * 0.55, 1.75, 0.2, s * 0.68, 0.85, 0.85); }
        bar(-0.55, 1.75, -0.6, 0.55, 1.75, -0.6); bar(-0.55, 1.75, 0.2, 0.55, 1.75, 0.2);
        K3.box(b, -0.8, 0.8, 1.55, 1.62, -1.6, -1.35, A.RED); K3.box(b, -0.3, 0.3, 0.85, 1.15, -0.5, -0.1, A.SEAT);
        wheels = [[0.85, 0.45, -1.05, 0.45, 0.36], [-0.85, 0.45, -1.05, 0.45, 0.36], [0.8, 0.36, 1.15, 0.36, 0.24], [-0.8, 0.36, 1.15, 0.36, 0.24]];
        extra.rider = [0, 0.85, -0.3]; lights = { f: [[0.4, 0.75, 1.62], [-0.4, 0.75, 1.62]], r: [] }; break; }
      case 'blindado': {   // furgão de gangue com placas soldadas e torreta
        const d = BODY.van; b.mat = 0; K3.extrude(b, d.low, -1.15, 1.15, A.METAL, (i, n) => n[2] > 0.3 && n[1] > 0.3 ? A.MESH : n[1] < -0.5 ? A.DARK : n[2] > 0.72 ? A.GRILLE : A.METAL, 0.12); addWheels({ W: 2.3, wz: d.wz, wr: 0.45 });
        for (const s of [-1, 1]) { K3.quad(b, [s * 1.12, 1.45, 0.8], [s * 1.12, 1.75, 0.8], [s * 1.12, 1.75, 1.5], [s * 1.12, 1.45, 1.5], [s, 0, 0], A.MESH); K3.box(b, s * 1.15 - 0.06, s * 1.15 + 0.06, 0.5, 1.0, -2.4, 2.2, A.HAZ); }
        K3.cyl(b, [0, 2.28, -0.5], 0.55, 0.45, 0.42, 10, 'y', A.METAL, A.METAL, true); K3.cyl(b, [0, 2.48, -0.5], 0.07, 0.07, 1.6, 8, 'z', A.DARK, A.DARK, true);
        K3.box(b, -1.25, 1.25, 0.35, 0.75, 2.75, 3.0, A.METAL); lights = { f: [[0.8, 1.0, 2.8], [-0.8, 1.0, 2.8]], r: [[0.9, 1.0, -2.8], [-0.9, 1.0, -2.8]] }; break; }
      case 'moto': {   // moto de trilha com garupa armada
        b.mat = 1; K3.box(b, -0.16, 0.16, 0.62, 0.86, -0.15, 0.45, A.PAINT); b.mat = 0; K3.box(b, -0.14, 0.14, 0.72, 0.84, -0.7, -0.1, A.SEAT); K3.box(b, -0.12, 0.12, 0.35, 0.65, -0.3, 0.3, A.DARK);
        const fork = K3.mark(b); K3.cyl(b, [0, 0, 0], 0.035, 0.035, 0.75, 6, 'y', A.CHROME, null, false); K3.xf(b, fork, -0.35, 0, 0, 0, 0.36, 0.62);
        K3.box(b, -0.36, 0.36, 1.08, 1.12, 0.78, 0.84, A.DARK); K3.box(b, -0.1, 0.1, 0.9, 1.0, 0.82, 0.9, A.WHITE);
        wheels = [[0.07, 0.34, -0.62, 0.34, 0.14], [0.07, 0.34, 0.78, 0.34, 0.12]]; extra.rider = [0, 0.78, -0.35]; extra.moto = true; lights = { f: [[0, 0.95, 0.9]], r: [[0, 0.82, -0.72]] }; break; }
      case 'pregos': { b.mat = 0; K3.box(b, -2.5, 2.5, 0, 0.05, -0.18, 0.18, A.DARK); for (let x = -2.4; x <= 2.4; x += 0.2) { for (const z of [-0.1, 0.08]) K3.cyl(b, [x, 0.04, z], 0.035, 0.0, 0.16, 4, 'y', A.CHROME, null, false); } break; }
      case 'sobrevivente': {   // ponto de ônibus com o sobrevivente no teto
        b.mat = 0; K3.box(b, -1.55, 1.55, 2.38, 2.52, -0.85, 0.85, A.CONC); for (const s of [-1, 1]) K3.cyl(b, [s * 1.4, 0, -0.6], 0.06, 0.06, 2.4, 8, 'y', A.CHROME, null, false);
        K3.box(b, -1.45, 1.45, 0.5, 2.38, -0.72, -0.66, A.GLASSF); K3.box(b, -1.2, 1.2, 0.45, 0.52, -0.6, -0.2, A.METAL); extra.human = [0, 2.52, 0]; extra.flare = [0.35, 3.95, 0]; break; }
      case 'bau': {   // caminhão do Exército tombado de lado
        b.mat = 0; const m0 = K3.mark(b);
        K3.box(b, -1.2, 1.2, 0.5, 2.6, 0.9, 3.1, { side: A.METAL, front: A.GRILLE, back: A.METAL, top: A.METAL }); K3.box(b, -1.2, 1.2, 0.6, 3.0, -3.6, 0.8, A.CANVAS); K3.box(b, -1.25, 1.25, 0.35, 0.6, -3.7, 3.2, A.DARK);
        for (const z of [-2.6, -1.4, 2.2]) for (const s of [-1, 1]) K3.cyl(b, [s * 1.2 - (s > 0 ? 0 : 0.32), 0.48, z], 0.48, 0.48, 0.32, 12, 'x', A.TIRE, A.RIM, true);
        K3.xf(b, m0, 0, 0.2, PI / 2 - 0.08, 1.3, 0, 0); break; }
      case 'rampa': { b.mat = 0; K3.extrude(b, [[-6, 0], [-6, 0.4], [6, 6], [6.6, 6], [6.6, 0]], -4, 4, A.METAL, (i, n) => n[1] > 0.3 ? A.HAZ : A.METAL); break; }
      default: { const d = BODY.sedan; body(b, d); addWheels(d); }
    }
    const parts = K3.model([{ b, tex: T }]);
    return (cache[type] = { parts, wheels, lights, extra });
  }

  /* ---------- pessoas (bandidos, sobrevivente, motoqueiros): mesma malha dos zumbis, pele normal ---------- */
  const HUMAN = [Object.assign(['#c48a62', '#8a5a3a', '#e0b08a', '#7a3a2a'], { human: true }), Object.assign(['#8a5a3a', '#5a3a22', '#b0805a', '#4a2a1a'], { human: true }), Object.assign(['#e0b090', '#a07a5a', '#f4d0b0', '#8a4a3a'], { human: true })];
  const HUM_A = new Float32Array(48), HT1 = new Float32Array([0.12, 0.12, 0.13]), HT2 = new Float32Array([0.2, 0.22, 0.28]);
  function human(R, M, x, y, z, kind, seed, t) {
    const mesh = Z3D.humanoid('andarilhoA', Z3D.SPEC.andarilhoA), A2 = HUM_A, HB = Z3D.HB; A2.fill(0);
    if (kind === 'senta') { A2[HB.TA * 3] = -1.45; A2[HB.TB * 3] = -1.45; A2[HB.SA * 3] = 1.4; A2[HB.SB * 3] = 1.4; A2[HB.UA * 3] = -1.2; A2[HB.FA * 3] = -0.4; A2[HB.UB * 3] = -1.2; A2[HB.FB * 3] = -0.4; A2[HB.CHEST * 3] = 0.25; }
    else if (kind === 'atira') { A2[HB.UA * 3] = -1.5; A2[HB.UA * 3 + 1] = -0.4; A2[HB.FA * 3] = -0.2; A2[HB.UB * 3] = -1.4; A2[HB.UB * 3 + 1] = 0.5; A2[HB.FB * 3] = -0.6; A2[HB.CHEST * 3 + 1] = 0.2 * Math.sin(t * 2 + seed); A2[HB.TA * 3] = -0.15; A2[HB.TB * 3] = 0.15; }
    else if (kind === 'acena') { A2[HB.UA * 3] = -2.8 + 0.4 * Math.sin(t * 7); A2[HB.UA * 3 + 2] = 0.4; A2[HB.FA * 3] = -0.3; A2[HB.UB * 3] = -2.6 + 0.4 * Math.sin(t * 7 + 1); A2[HB.UB * 3 + 2] = -0.4; }
    const bones = Z3D.solve(mesh.skel, A2, null, [0, kind === 'senta' ? -0.42 : 0, 0]);
    const m = M4.mul(MW2, M, M4.place(MW, x, y, z, 0, 1, 1, 1, 1));
    R.skin(mesh, Z3D.atlasFor(HUMAN[(seed * 3 | 0) % 3]), m, bones, { t1: kind === 'acena' ? new Float32Array([0.2, 0.36, 0.62]) : HT1, t2: HT2, flash: 0, glow: 0 });
    if (kind === 'atira') { const g = M4.mul(MW2, M, M4.place(MW, x - 0.12, y + 1.32, z + 0.35, 0, 1, 1, 1, 1)); R.model(gunMesh(), tex(), g, { glow: 0 }); }
  }
  function gunMesh() { if (gunMesh.m) return gunMesh.m; const b = new GL3.Builder(); K3.box(b, -0.03, 0.03, -0.05, 0.05, -0.25, 0.55, A.DARK); K3.box(b, -0.025, 0.025, -0.2, -0.04, 0.0, 0.1, A.DARK); return (gunMesh.m = b.mesh()); }

  /* ---------- desenho de um veículo inimigo/obstáculo ---------- */
  function draw(R, e, vx, vy, vz, lod, ctx, s) {
    const d = ENEMY[e.type], md = enemyModel(e.type), t = G.t;
    const col = TEX3.hexRGB(e.cor || d.cor); TINT[0] = col[0] / 255 * 1.25; TINT[1] = col[1] / 255 * 1.25; TINT[2] = col[2] / 255 * 1.25;
    const front = e.type === 'buggy' || e.type === 'carrobomba', stat = d.estatico;
    let yaw = front ? PI : 0;
    if (e.type === 'carcaca') yaw = (DRAW.hash(e.id * 1.3) - 0.5) * 1.2 + (DRAW.hash(e.id) > 0.5 ? PI : 0);
    if (e.type === 'moto') yaw = (e.side || 0) * -0.06 + Math.sin(t * 2 + e.id) * 0.03;
    if (e.type === 'bau' || e.type === 'sobrevivente' || e.type === 'pregos' || e.type === 'rampa') yaw = 0;
    const f = Z3D.fwd(R, yaw, ctx.slope(vz));
    let M = R.place(MT, vx, vy, vz, f[0], f[1], 1);
    if (e.type === 'moto') { const lean = -(e.side || 0) * 0.08 + Math.sin(t * 3 + e.id) * 0.05; M = tilt(M, 0, lean); }
    const o = { t1: TINT, flash: e.flash > 0 ? 0.55 : 0, spec: e.type === 'carcaca' ? 0 : 0.45 };
    for (const p of md.parts) R.model(p.mesh, p.tex, M, o);
    // rodas girando
    const spin = stat ? 0 : (P.z * (front ? 2 : 1)) / 0.35;
    const wm = wheelMesh()[0];
    for (const w of md.wheels) { const r = w[3]; const W = M4.mul(MW2, M, wheelM(w[0], w[1], w[2], r, w[4], spin * 0.35 / r)); R.model(wm.mesh, wm.tex, W, { flash: o.flash }); }
    // gente
    const ex = md.extra;
    if (ex.rider) human(R, M, ex.rider[0], ex.rider[1], ex.rider[2], ex.moto || e.type === 'buggy' ? 'senta' : 'atira', e.id * 0.37 % 1, t);
    if (ex.rider2) human(R, M, ex.rider2[0], ex.rider2[1], ex.rider2[2], 'atira', 0.6, t + 1);
    if (ex.human) human(R, M, ex.human[0], ex.human[1], ex.human[2], 'acena', 0.2, t);
    // faróis e lanternas acesos (mais fortes à noite), sinalizador e giroflex
    const night = R.L.night, wp = (p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
    if (night || G.clima !== 'limpo') {
      for (const p of md.lights.f) { const q = wp(p); if (q[2] > 0.3) R.glow(q[0], q[1], q[2], 0.9, 0.6, 1, 0.95, 0.75, night ? 0.9 : 0.4); }
      for (const p of md.lights.r) { const q = wp(p); if (q[2] > 0.3) R.glow(q[0], q[1], q[2], 0.5, 0.3, 1, 0.12, 0.08, night ? 0.8 : 0.35); }
    }
    if (ex.beacon && Math.sin(t * 20) > 0) { const q = wp(ex.beacon); R.glow(q[0], q[1], q[2], 1.2, 1.2, 1, 0.15, 0.05, 0.9); }
    if (ex.flare) { const q = wp(ex.flare); const a = 0.6 + Math.sin(t * 9) * 0.4; R.glow(q[0], q[1], q[2], 2.2 * a + 0.6, 2.2 * a + 0.6, 1, 0.12, 0.08, 0.95); R.glow(q[0], q[1], q[2], 0.35, 0.35, 1, 0.8, 0.6, 1); }
    if (lod > 0 && e.type !== 'pregos' && e.type !== 'rampa') R.blob(vx, vy, vz, d.w * 0.62, Math.max(1.2, d.w * 1.2), night ? 0.35 : 0.6);
  }
  const RT = M4.make(), MT3 = M4.make();
  function tilt(M, pitch, roll) {
    const c = Math.cos(pitch), s = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    RT.fill(0); RT[15] = 1; RT[0] = cr; RT[1] = sr; RT[4] = -sr * c; RT[5] = cr * c; RT[6] = s; RT[8] = sr * s; RT[9] = -cr * s; RT[10] = c;
    return M4.mul(MT3, M, RT);
  }
  // roda: cilindro unitário em x (de -0.5 a 0.5) escalado (raio r, largura w), girando em volta de x
  const WM = M4.make();
  function wheelM(x, y, z, r, w, ang) {
    const c = Math.cos(ang), s = Math.sin(ang); WM.fill(0); WM[15] = 1;
    WM[0] = w; WM[5] = c * r; WM[6] = s * r; WM[9] = -s * r; WM[10] = c * r; WM[12] = x; WM[13] = y; WM[14] = z;
    return WM;
  }

  /* ---------- carro dos jogadores (3ª pessoa) com upgrades ---------- */
  const PLAYER = [null, 'hatch', 'wagon', 'pickup', 'van', 'truck'];
  function playerModel(veh, up) {
    const key = 'p' + veh + JSON.stringify(up);
    if (cache[key]) return cache[key];
    const b = new GL3.Builder(), T = tex(); let wheels = [], d;
    if (veh === 5) {   // Scania bicuda: capô comprido, cabine alta, chassi, tanques e escapamentos
      d = { W: 2.5, L: 7.2 }; b.mat = 1;
      K3.extrude(b, [[0.6, 0.95], [0.6, 1.95], [2.9, 1.85], [3.35, 1.55], [3.35, 0.95]], -1.0, 1.0, A.PAINT, (i, n) => n[2] > 0.7 ? A.GRILLE : n[1] < -0.5 ? A.DARK : A.PAINT, 0.08);
      K3.extrude(b, [[-1.5, 0.95], [-1.5, 3.05], [0.35, 3.05], [0.65, 1.95], [0.65, 0.95]], -1.22, 1.22, A.PAINT, (i, n) => n[2] > 0.3 && n[1] > 0.2 ? (b.mat = 0, A.GLASS) : (b.mat = 1, n[1] < -0.5 ? A.DARK : A.PAINT));
      b.mat = 0; K3.box(b, -1.2, 1.2, 0.85, 1.1, -4.6, -1.5, A.DARK); K3.cyl(b, [0, 1.1, -3.3], 0.55, 0.55, 0.12, 12, 'y', A.CHROME, A.DARK, true);
      for (const s of [-1, 1]) { K3.cyl(b, [s * 1.12, 0.62, -1.2], 0.32, 0.32, 1.0, 10, 'z', A.CHROME, A.CHROME, true); K3.cyl(b, [s * 1.1, 1.1, -1.45], 0.08, 0.08, 2.6, 8, 'y', A.CHROME, A.DARK, true); for (const q of [-1.3, 0.2]) K3.box(b, s * 1.24 - 0.02, s * 1.24 + 0.02, 1.9, 2.5, q, q + 0.05, A.DARK); }
      K3.box(b, -1.25, 1.25, 0.45, 0.85, 3.3, 3.55, A.CHROME);
      wheels = [[1.05, 0.55, 2.6, 0.55, 0.4], [-1.05, 0.55, 2.6, 0.55, 0.4], [1.05, 0.55, -2.5, 0.55, 0.55], [-1.05, 0.55, -2.5, 0.55, 0.55], [1.05, 0.55, -3.8, 0.55, 0.55], [-1.05, 0.55, -3.8, 0.55, 0.55]];
    } else {
      d = BODY[PLAYER[veh]]; body(b, d); for (const z of d.wz) for (const s of [-1, 1]) wheels.push([s * (d.W / 2 - 0.1), d.wr, z, d.wr, 0.26]);
      b.mat = 0;
      if (veh === 1) { for (const s of [-1, 1]) K3.box(b, s * 0.55 - 0.03, s * 0.55 + 0.03, 1.52, 1.58, -1.6, 0.2, A.CHROME); K3.box(b, -0.25, 0.25, 1.6, 1.66, -1.9, 0.5, A.CHROME); for (let z = -1.8; z < 0.5; z += 0.32) K3.box(b, -0.25, 0.25, 1.66, 1.7, z, z + 0.05, A.CHROME); }   // escada no rack
      if (veh === 2) { K3.box(b, -0.55, -0.02, 1.45, 1.6, -0.4, -0.1, A.RED); K3.box(b, 0.02, 0.55, 1.45, 1.6, -0.4, -0.1, A.BLUE); K3.box(b, -0.6, 0.6, 1.44, 1.47, -0.42, -0.08, A.DARK); }   // giroflex
      if (veh === 4) { K3.cyl(b, [0, 2.3, -0.8], 0.55, 0.45, 0.42, 10, 'y', A.METAL, A.METAL, true); K3.cyl(b, [0, 2.5, -0.8], 0.06, 0.06, 1.5, 8, 'z', A.DARK, A.DARK, true); for (const s of [-1, 1]) K3.quad(b, [s * 1.0, 1.4, 1.1], [s * 1.0, 1.75, 1.1], [s * 1.0, 1.75, 1.6], [s * 1.0, 1.4, 1.6], [s, 0, 0], A.GLASSF); }
    }
    const hw = (veh === 5 ? 1.25 : d.W / 2), rz = veh === 5 ? -4.6 : -d.L / 2, fz = veh === 5 ? 3.55 : d.L / 2;
    b.mat = 0;
    if (veh >= 4 && veh === 5) { K3.cyl(b, [0, 3.05, -0.5], 0.5, 0.42, 0.4, 10, 'y', A.METAL, A.METAL, true); K3.cyl(b, [0, 3.25, -0.5], 0.06, 0.06, 1.5, 8, 'z', A.DARK, A.DARK, true); }
    // para-choque: quebra-mato, lâmina, limpa-trilhos em V, com motosserras
    if (up.frente >= 1) { K3.box(b, -hw * 0.95, hw * 0.95, 0.35, 0.45, fz + 0.12, fz + 0.22, A.DARK); for (const s of [-0.6, 0, 0.6]) K3.box(b, s * hw - 0.04, s * hw + 0.04, 0.35, 1.0, fz + 0.12, fz + 0.2, A.DARK); }
    if (up.frente === 2) K3.box(b, -hw * 1.05, hw * 1.05, 0.15, 0.85, fz + 0.25, fz + 0.4, A.METAL);
    if (up.frente >= 3) K3.extrude(b, [[fz + 0.15, 0.12], [fz + 0.15, 1.0], [fz + 1.1, 0.12]], -hw * 1.05, hw * 1.05, A.METAL, () => A.HAZ);
    const saws = up.frente >= 4 ? 6 : up.serra;
    for (let i = 0; i < saws; i++) { const xs = (i - (saws - 1) / 2) * (saws > 2 ? hw * 0.36 : hw * 0.8); K3.box(b, xs - 0.05, xs + 0.05, 0.3, 1.25, fz + 0.3, fz + 0.36, A.SAW); K3.box(b, xs - 0.13, xs + 0.13, 0.2, 0.4, fz + 0.2, fz + 0.45, A.HAZ); }
    // laterais: barras, motosserras laterais
    if (up.lateral >= 1) for (const s of [-1, 1]) K3.box(b, s * (hw + 0.04) - 0.04, s * (hw + 0.04) + 0.04, 0.55, 0.68, rz * 0.7, fz * 0.7, A.DARK);
    if (up.lateral >= 2) for (const s of [-1, 1]) K3.box(b, s * (hw + 0.3) - 0.04, s * (hw + 0.3) + 0.04, 0.45, 0.62, rz * 0.4, fz * 0.4, A.SAW);
    // janelas: telas ou chapas com frestas
    if (up.janela >= 1 && veh < 4) { const cab = d.cab, u = up.janela >= 2 ? A.METAL : A.MESH; K3.extrude(b, cab.map(p => [p[0] + (p[0] < 0 ? -0.02 : 0.02), p[1] + 0.02]), -d.W / 2 + d.ins * 0.2, d.W / 2 - d.ins * 0.2, u, (i, n) => n[1] > 0.85 ? null : u, d.ins); }
    // pneus maciços com cravos
    const parts = K3.model([{ b, tex: T }]);
    return (cache[key] = { parts, wheels, spikes: up.pneu >= 2, len: fz - rz, rear: -rz });
  }
  const SR = M4.make(), SB = M4.make(), SC = M4.make();
  function drawPlayer(R, vx, vy, vz, gy, steer, t) {
    const veh = S.veh, up = S.up, md = playerModel(veh, up), v = VEHICLES[veh];
    const col = TEX3.hexRGB(v.cor); TINT[0] = col[0] / 255 * 1.2; TINT[1] = col[1] / 255 * 1.2; TINT[2] = col[2] / 255 * 1.2;
    const yaw = steer * 0.18, f = Z3D.fwd(R, yaw, 0);
    let M = R.place(MT, vx, vy, vz, f[0], f[1], 1);
    M = tilt(M, -Math.min(0.06, Math.max(-0.06, (P.speed - (drawPlayer.ls || P.speed)) * 0.4)), -steer * 0.05 * Math.min(1, P.speed / 15));
    drawPlayer.ls = P.speed;
    for (const p of md.parts) R.model(p.mesh, p.tex, M, { t1: TINT, spec: 0.55 });
    const wm = wheelMesh()[0], spin = P.z / 0.35;
    for (const w of md.wheels) {
      const r = w[3], steerA = w[2] > 0 ? steer * 0.35 : 0; let W = wheelM(w[0], w[1], w[2], r, w[4], spin * 0.35 / r);
      if (steerA) {   // rodas da frente esterçam em volta do próprio centro
        const c = Math.cos(steerA), s = Math.sin(steerA); M4.ident(SR); SR[0] = c; SR[2] = -s; SR[8] = s; SR[10] = c; SR[12] = w[0]; SR[13] = w[1]; SR[14] = w[2];
        M4.ident(SB); SB[12] = -w[0]; SB[13] = -w[1]; SB[14] = -w[2]; W = M4.mul(SC, SR, M4.mul(SC, SB, W));
      }
      R.model(wm.mesh, wm.tex, M4.mul(MW2, M, W), {});
    }
    // lanternas e luz de freio
    const wp = (p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
    const hw = veh === 5 ? 1.15 : BODY[PLAYER[veh]].W / 2 - 0.15, rz = veh === 5 ? -4.6 : -md.len / 2, brake = I.brake || P.brakeT > 0;
    if (R.L.night || brake) for (const s of [-1, 1]) { const q = wp([s * hw, 0.8, rz - 0.02]); R.glow(q[0], q[1], q[2], 0.55, 0.32, 1, 0.1, 0.06, brake ? 1 : 0.55); }
    if (veh === 2 && Math.sin(t * 12) > 0) { const q = wp([-0.3, 1.55, -0.25]); R.glow(q[0], q[1], q[2], 1.1, 1.1, 1, 0.1, 0.05, 0.7); } else if (veh === 2) { const q = wp([0.3, 1.55, -0.25]); R.glow(q[0], q[1], q[2], 1.1, 1.1, 0.15, 0.3, 1, 0.7); }
    R.blob(vx, gy, vz, 1.4, md.len * 0.55, 0.6);
  }

  /* ---------- capô visto de dentro (1ª pessoa), no lugar do polígono 2D ---------- */
  let hoodD = null;
  function drawHood(R, W, H, F, cx, cy, dashY, hoodH) {
    if (!hoodD) hoodD = new W3D.Dyn(64);
    const d = hoodD; d.reset();
    const v = VEHICLES[S.veh], col = TEX3.hexRGB(v.cor), k = 0.75 / 255;
    // mesmas bordas do desenho 2D: perto (dashY) de 0.1W a 0.9W; longe (dashY − hoodH) de 0.2W a 0.8W
    const zn = 1.05, zf = 2.3, yN = -(dashY + 4 - cy) * zn / F, yF = -(dashY - hoodH - cy) * zf / F;
    const xN = (0.4 * W + 6) * zn / F, xF = 0.3 * W * zf / F, NX = 8, NZ = 4;
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, w = j / NZ, z = zn + (zf - zn) * w, hx = xN + (xF - xN) * w, x = (u * 2 - 1) * hx, crown = Math.cos((u * 2 - 1) * 1.2) * 0.05 * (1 - Math.abs(w - 0.5));
      const y = yN + (yF - yN) * w + crown, nx = -Math.sin((u * 2 - 1) * 1.2) * 0.25;
      d.v(x, y, z, 0, 0, A.PAINT[0] + (A.PAINT[2] - A.PAINT[0]) * u, A.PAINT[1] + (A.PAINT[3] - A.PAINT[1]) * (0.1 + w * 0.3), col[0] * k * 1.25, col[1] * k * 1.25, col[2] * k * 1.25, nx, 0);
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i; d.q(a, a + NX + 1, a + NX + 2, a + 1); }
    for (let o = 0; o < d.nv * 13; o += 13) { const nx = d.f[o + 11]; d.f[o + 3] = nx; d.f[o + 4] = 1; d.f[o + 5] = -0.15; d.f[o + 11] = 0; }
    R.hood(d);
  }
  return { draw, drawPlayer, drawHood, enemyModel, playerModel, tex, A, human, wheelMesh };
})();
