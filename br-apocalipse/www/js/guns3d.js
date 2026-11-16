'use strict';
/* Armas em 3D (1ª pessoa do Artilheiro e as do capô): modelos de baixo polígono com textura, no espírito dos jogos de PS1,
   com as peças que se mexem de verdade — ferrolho da pistola, bomba da escopeta, tambor do revólver e do lança-granadas,
   cano dos canhões, fita de munição e corrente da motosserra. A física: recuo em molas (coice para trás, cano subindo,
   torção), balanço com as acelerações do carro, atraso da arma ao virar a mira, respiração, troca de arma, recarga
   animada, cápsulas ejetadas que caem e voam para trás e o clarão que ilumina mãos, carro e zumbis à noite. */
const GUN3D = (() => {
  const UV = K3.R(512), PI = Math.PI, M4 = GL3.M4;
  const A = {
    BLUED: UV(0, 0, 128, 64), PARK: UV(128, 0, 256, 64), POLY: UV(256, 0, 384, 64), WOOD: UV(384, 0, 512, 64),
    WOODL: UV(0, 64, 128, 128), OD: UV(128, 64, 192, 128), STEEL: UV(192, 64, 256, 128), CHROME: UV(256, 64, 320, 128), RUBBER: UV(320, 64, 384, 96),
    BRASS: UV(384, 64, 448, 96), SHELLR: UV(448, 64, 512, 96), BORE: UV(320, 96, 352, 128), SIGHT: UV(352, 96, 368, 112), SIGHTY: UV(368, 96, 384, 112),
    HOT: UV(384, 96, 448, 128), KNURL: UV(448, 96, 512, 128),
    BLADE: UV(0, 192, 256, 224), CORD: UV(256, 192, 320, 224), ORANGE: UV(320, 192, 384, 256), BAR: UV(384, 192, 512, 224), CHAIN: UV(384, 224, 512, 256),
    REDIND: UV(0, 224, 64, 256), NAILS: UV(64, 224, 128, 256), BAT: UV(128, 224, 256, 256),
    BELT: UV(0, 256, 256, 288), BELT50: UV(256, 256, 512, 288), RIVET: UV(0, 288, 128, 352), CANNON: UV(128, 288, 256, 352),
    FLASH: UV(256, 288, 384, 416), FLAME: UV(384, 288, 512, 352), CYL6: UV(384, 352, 448, 416), DRUM: UV(448, 352, 512, 416),
  };
  const MARK = (i) => UV((i % 8) * 64, 128 + ((i / 8) | 0) * 32, (i % 8) * 64 + 64, 160 + ((i / 8) | 0) * 32);
  const LABELS = ['.38 SPL', '9mm', 'CAL.20', 'CAL.12', '10mm', '5,56', '7,62', 'MAG 7,62', '40mm', '.50 BMG', '20mm', '25mm', '30mm', 'PERIGO', 'IA2', 'FAL'];
  let atlas = null;
  const tex = () => atlas || (atlas = TEX3.T(makeAtlas, { repeat: false }));
  function makeAtlas() {
    const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(5150);
    x.fillStyle = '#555'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
    const reg = (x0, y0, x1, y1, f) => { for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip(); q.translate(x0, y0); } f(x1 - x0, y1 - y0); x.restore(); k.restore(); };
    const fld = (w, h, n, ca, cb, grain, seed) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, n, ca, cb, grain, seed); x.drawImage(t, 0, 0); };
    const wear = (w, h, n, col) => { x.strokeStyle = col; x.lineWidth = 0.8; for (let i = 0; i < n; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 24, Y + (r() - 0.5) * 4); x.stroke(); } };
    // aço oxidado (azulado), parkerizado, polímero, madeiras, verde-oliva, aço polido, níquel
    reg(0, 0, 128, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 4, 3, 0.5), [24, 28, 38], [52, 58, 74], 6, 3); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(160,180,210,0.22)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(150,160,180,0.18)'); x.fillStyle = g; x.fillRect(0, 0, w, h); wear(w, h, 30, 'rgba(170,175,185,0.35)'); });
    reg(128, 0, 256, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 3, 5, 0.6), [34, 36, 36], [58, 60, 58], 22, 5); wear(w, h, 18, 'rgba(120,120,115,0.3)'); });
    reg(256, 0, 384, 64, (w, h) => { fld(w, h, TEX3.fbm(w, h, 32, 2, 7, 0.6), [20, 21, 23], [38, 39, 42], 16, 7); x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 300; i++) x.fillRect(r() * w, r() * h, 1, 1); });
    const wood = (w, h, a, b2, seed) => { fld(w, h, TEX3.fbm(w, h, 2, 4, seed, 0.6), a, b2, 10, seed); x.strokeStyle = 'rgba(30,14,4,0.45)'; x.lineWidth = 1; for (let i = 0; i < 14; i++) { const y0 = r() * h; x.beginPath(); x.moveTo(0, y0); for (let X = 0; X <= w; X += 8) x.lineTo(X, y0 + Math.sin(X * 0.05 + i) * 3); x.stroke(); } wear(w, h, 10, 'rgba(255,220,170,0.18)'); };
    reg(384, 0, 512, 64, (w, h) => wood(w, h, [70, 36, 16], [118, 66, 30], 9));
    reg(0, 64, 128, 128, (w, h) => wood(w, h, [128, 86, 46], [178, 128, 76], 11));
    reg(128, 64, 192, 128, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 13, 0.6), [62, 70, 42], [88, 98, 60], 14, 13); wear(w, h, 14, 'rgba(40,40,36,0.5)'); });
    reg(192, 64, 256, 128, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9aa0a8'); g.addColorStop(0.5, '#5c6168'); g.addColorStop(1, '#868c94'); x.fillStyle = g; x.fillRect(0, 0, w, h); wear(w, h, 40, 'rgba(230,235,240,0.35)'); });
    reg(256, 64, 320, 128, (w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e8ecf0'); g.addColorStop(0.4, '#8c939c'); g.addColorStop(0.6, '#c8ced6'); g.addColorStop(1, '#6a7078'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    reg(320, 64, 384, 96, (w, h) => { fld(w, h, TEX3.fbm(w, h, 16, 2, 15, 0.5), [16, 16, 16], [30, 30, 30], 10, 15); });
    reg(384, 64, 448, 96, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f8e098'); g.addColorStop(0.45, '#c89838'); g.addColorStop(1, '#7a5a1a'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    reg(448, 64, 512, 96, (w, h) => { x.fillStyle = '#a81812'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, 4, w, 4); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0d080'); g.addColorStop(1, '#8a6a20'); x.fillStyle = g; x.fillRect(0, 0, 14, h); });
    reg(320, 96, 352, 128, (w, h) => { x.fillStyle = '#3a3c40'; x.fillRect(0, 0, w, h); x.fillStyle = '#050505'; x.beginPath(); x.arc(16, 16, 11, 0, 7); x.fill(); });
    reg(352, 96, 368, 112, (w, h) => { x.fillStyle = '#111'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f4f0'; x.beginPath(); x.arc(8, 8, 4, 0, 7); x.fill(); k.fillStyle = '#888'; k.fillRect(0, 0, w, h); });
    reg(368, 96, 384, 112, (w, h) => { x.fillStyle = '#d8b820'; x.fillRect(0, 0, w, h); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    // brasa do cano quente: brilha (alfa = emissivo)
    reg(384, 96, 448, 128, (w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff5010'); g.addColorStop(0.5, '#ffd060'); g.addColorStop(1, '#ff3008'); x.fillStyle = g; x.fillRect(0, 0, w, h); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    reg(448, 96, 512, 128, (w, h) => { x.fillStyle = '#26282a'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a4e52'; for (let X = 0; X < w; X += 4) x.fillRect(X, 0, 2, h); });
    // marcações estampadas
    for (let i = 0; i < 16; i++) reg((i % 8) * 64, 128 + ((i / 8) | 0) * 32, (i % 8) * 64 + 64, 160 + ((i / 8) | 0) * 32, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 2, 40 + i, 0.6), [32, 34, 36], [52, 54, 56], 12, 40 + i); x.fillStyle = i === 13 ? '#d8b020' : 'rgba(205,205,200,0.85)'; x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.fillText(LABELS[i], w / 2, 21); });
    // lâmina do facão: aço com fio polido, riscos e sangue
    reg(0, 192, 256, 224, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7c8288'); g.addColorStop(0.7, '#a8aeb4'); g.addColorStop(0.85, '#e8eef2'); g.addColorStop(1, '#b8bec4'); x.fillStyle = g; x.fillRect(0, 0, w, h); wear(w, h, 50, 'rgba(60,60,60,0.35)'); for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(110,10,6,0.7)'; x.beginPath(); x.ellipse(60 + r() * 180, 8 + r() * 16, 10 + r() * 20, 3 + r() * 5, r(), 0, 7); x.fill(); } });
    reg(256, 192, 320, 224, (w, h) => { x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1a120a'; x.lineWidth = 2; for (let X = -h; X < w; X += 5) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X + h, h); x.stroke(); } });
    reg(320, 192, 384, 256, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 17, 0.6), [210, 88, 20], [238, 124, 34], 10, 17); wear(w, h, 20, 'rgba(40,30,20,0.35)'); x.fillStyle = '#1a1a1a'; x.fillRect(4, 40, 56, 10); });
    reg(384, 192, 512, 224, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a5e62'); g.addColorStop(0.5, '#a0a6ac'); g.addColorStop(1, '#5a5e62'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#2a2a2a'; x.font = 'bold 12px Arial'; x.fillText('SERRA', 30, 21); });
    reg(384, 224, 512, 256, (w, h) => { x.fillStyle = '#2a2a2c'; x.fillRect(0, 0, w, h); for (let X = 0; X < w; X += 8) { x.fillStyle = '#b8bcc0'; x.beginPath(); x.moveTo(X, h); x.lineTo(X + 3, 4); x.lineTo(X + 7, h); x.fill(); x.fillStyle = '#6a6e72'; x.fillRect(X, h * 0.55, 8, 3); } });
    reg(0, 224, 64, 256, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 19, 0.6), [150, 20, 14], [196, 36, 24], 10, 19); x.fillStyle = '#e8c020'; x.fillRect(0, 12, w, 6); });
    reg(64, 224, 128, 256, (w, h) => { x.fillStyle = '#5a4030'; x.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { x.fillStyle = '#9a9a96'; x.beginPath(); x.arc(r() * w, r() * h, 2.5, 0, 7); x.fill(); } });
    reg(128, 224, 256, 256, (w, h) => wood(w, h, [96, 70, 44], [150, 116, 78], 21));
    // fitas de munição: cartuchos de latão com elos pretos (repete na horizontal: rola a cada tiro)
    const belt = (w, h, n, tip) => { x.fillStyle = '#121212'; x.fillRect(0, 0, w, h); const sp = w / n; for (let i = 0; i < n; i++) { const X = i * sp; const g = x.createLinearGradient(X, 0, X + sp, 0); g.addColorStop(0, '#7a5a1a'); g.addColorStop(0.5, '#f0d080'); g.addColorStop(1, '#8a6a20'); x.fillStyle = g; x.fillRect(X + sp * 0.2, 3, sp * 0.6, h * 0.62); x.fillStyle = tip; x.beginPath(); x.moveTo(X + sp * 0.2, h * 0.62 + 3); x.lineTo(X + sp * 0.5, h - 2); x.lineTo(X + sp * 0.8, h * 0.62 + 3); x.fill(); x.fillStyle = '#2a2a2a'; x.fillRect(X, h * 0.3, sp, 5); } };
    reg(0, 256, 256, 288, (w, h) => belt(w, h, 16, '#b07828'));
    reg(256, 256, 512, 288, (w, h) => belt(w, h, 8, '#3a3a3a'));
    reg(0, 288, 128, 352, (w, h) => { fld(w, h, TEX3.fbm(w, h, 8, 3, 23, 0.6), [52, 58, 50], [80, 88, 76], 12, 23); x.fillStyle = '#a0a49e'; for (let y = 8; y < h; y += 28) for (let X = 8; X < w; X += 28) { x.beginPath(); x.arc(X, y, 2.6, 0, 7); x.fill(); } wear(w, h, 16, 'rgba(30,30,30,0.5)'); });
    reg(128, 288, 256, 352, (w, h) => { fld(w, h, TEX3.fbm(w, h, 4, 4, 29, 0.6), [44, 54, 34], [72, 84, 54], 12, 29); x.fillStyle = 'rgba(30,26,20,0.5)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 16, 6 + r() * 10, r() * 3, 0, 7); x.fill(); } x.fillStyle = '#d8b020'; x.font = 'bold 11px Arial'; x.fillText('PERIGO', 8, 58); });
    // clarão: estrela de pontas (frente) e chama alongada (lados) — somam luz
    reg(256, 288, 384, 416, (w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.translate(64, 64); const g = x.createRadialGradient(0, 0, 2, 0, 0, 60); g.addColorStop(0, '#fffff0'); g.addColorStop(0.18, '#ffe7a0'); g.addColorStop(0.45, '#ff9a30'); g.addColorStop(1, '#000'); x.fillStyle = g; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, rr = i % 2 ? 16 : (i % 4 ? 46 : 62); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.fill(); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    reg(384, 288, 512, 352, (w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#fff8d0'); g.addColorStop(0.3, '#ffb040'); g.addColorStop(1, '#000'); x.fillStyle = g; x.beginPath(); x.moveTo(0, h * 0.35); x.quadraticCurveTo(w * 0.5, h * 0.05, w, h * 0.5); x.quadraticCurveTo(w * 0.5, h * 0.95, 0, h * 0.65); x.fill(); k.fillStyle = '#fff'; k.fillRect(0, 0, w, h); });
    // face do tambor (6 câmaras) e do carregador de tambor
    reg(384, 352, 448, 416, (w, h) => { x.fillStyle = '#34383a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; x.fillStyle = '#060606'; x.beginPath(); x.arc(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, 8, 0, 7); x.fill(); x.fillStyle = '#c89838'; x.beginPath(); x.arc(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, 4, 0, 7); x.fill(); } });
    reg(448, 352, 512, 416, (w, h) => { x.fillStyle = '#1c1e20'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a3e42'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 24, 0, 7); x.stroke(); x.beginPath(); x.arc(32, 32, 10, 0, 7); x.stroke(); });
    return TEX3.pack(c, m);
  }

  /* ---------- modelagem ---------- */
  const bx = (b, x0, x1, y0, y1, z0, z1, uv) => K3.box(b, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1), uv);
  const cz = (b, x, y, z0, z1, r0, r1, n, uv, cap) => K3.cyl(b, [x, y, z0], r0, r1 === undefined ? r0 : r1, z1 - z0, n || 10, 'z', uv, cap || uv, true);
  const cyY = (b, x, y0, y1, z, r, n, uv) => K3.cyl(b, [x, y0, z], r, r, y1 - y0, n || 8, 'y', uv, uv, true);
  const pr = (b, prof, x0, x1, uv, edge) => K3.extrude(b, prof, x0, x1, uv, typeof edge === 'function' ? edge : () => edge || uv);
  // empunhadura de pistola inclinada para trás, centrada na origem (a palma da mão direita fica aqui)
  const pgrip = (b, uv, w, top) => pr(b, [[-0.03, top || 0.028], [0.014, top || 0.028], [0.004, -0.058], [-0.04, -0.054]], -(w || 0.0145), w || 0.0145, uv);
  const trig = (b, z) => { bx(b, -0.003, 0.003, -0.001, 0.005, z - 0.012, z + 0.042, A.PARK); bx(b, -0.003, 0.003, -0.001, 0.026, z + 0.036, z + 0.042, A.PARK); bx(b, -0.0018, 0.0018, 0.006, 0.024, z + 0.008, z + 0.014, A.STEEL); };
  // mãos: p = ponto do eixo do que é segurado; ax = eixo (dedo indicador → mínimo na mão direita, mínimo → indicador na esquerda); pn = palma → eixo
  const RG = (p, ax, pn, r) => ({ p, ax, pn, r: r || 0.016 });
  const PISTOL_R = () => RG([0, 0, 0], [0, -0.96, -0.27], [-1, 0, 0.12], 0.016);
  const HG = (z, y, r) => RG([0, y, z], [0, 0, 1], [0.22, 1, 0], r || 0.026);         // mão esquerda por baixo do guarda-mão
  const VG = (z, y) => RG([0, y, z], [0, 1, 0.12], [1, 0, 0.1], 0.016);               // mão esquerda numa empunhadura vertical
  const TWO = () => RG([-0.006, -0.045, 0.006], [0.15, 0.95, 0.27], [0.75, 0.55, 0.2], 0.02); // pistola a duas mãos: a esquerda em concha por baixo da direita

  // cada arma: partes (estáticas ou móveis), linha do cano, miras, mãos, ejeção, poses e física
  const BUILD = {
    rev38(P) {
      const s = P.st; pr(s, [[-0.028, 0.026], [0.012, 0.028], [0.001, -0.054], [-0.037, -0.05]], -0.0155, 0.0155, A.WOOD);
      bx(s, -0.012, 0.012, 0.022, 0.066, -0.034, 0.012, A.BLUED); bx(s, -0.011, 0.011, 0.02, 0.027, 0.012, 0.058, A.BLUED); bx(s, -0.009, 0.009, 0.064, 0.069, 0.01, 0.062, A.BLUED);
      bx(s, -0.011, 0.011, 0.03, 0.068, 0.054, 0.072, A.BLUED); cz(s, 0, 0.054, 0.07, 0.165, 0.0085, 0.0085, 10, A.BLUED, A.BORE); bx(s, -0.007, 0.007, 0.036, 0.049, 0.07, 0.16, A.BLUED);
      bx(s, -0.006, 0.006, 0.066, 0.071, 0.065, 0.163, A.BLUED); bx(s, -0.0014, 0.0014, 0.069, 0.079, 0.152, 0.16, A.BLUED); bx(s, -0.0125, -0.0118, 0.035, 0.05, 0.075, 0.13, MARK(0));
      trig(s, 0.004);
      const c = P.part('cyl', [0, 0.046, 0]); cz(c, 0, 0, 0.012, 0.056, 0.0205, 0.0205, 12, A.BLUED, A.CYL6);
      const h = P.part('hammer', [0, 0.052, -0.03]); bx(h, -0.0035, 0.0035, -0.004, 0.02, -0.01, 0.003, A.BLUED);
      return { bore: 0.054, muzzle: 0.165, rear: [0.071, -0.02], front: [0.079, 0.156], gl: TWO(), shell: null, hip: [0.11, -0.13, 0.38], ads: 0.42, kick: 1.2, mass: 0.6, roll: 0.2 };
    },
    pist9(P) {
      const s = P.st; pgrip(s, A.POLY); bx(s, -0.012, 0.012, 0.024, 0.036, -0.03, 0.125, A.POLY); bx(s, -0.0128, 0.0128, -0.064, -0.056, -0.042, 0.004, A.POLY); trig(s, 0.006);
      const sl = P.part('slide', [0, 0, 0]);
      bx(sl, -0.0132, 0.0132, 0.036, 0.064, -0.012, 0.142, { side: A.PARK, top: A.STEEL, front: A.BORE, back: A.PARK }); bx(sl, -0.0137, 0.0137, 0.038, 0.062, -0.037, -0.012, A.KNURL);
      bx(sl, 0.0132, 0.0142, 0.049, 0.06, 0.018, 0.058, A.BORE); bx(sl, -0.0142, -0.0132, 0.042, 0.054, 0.06, 0.12, MARK(1));
      bx(sl, -0.008, -0.0025, 0.064, 0.071, -0.034, -0.026, A.PARK); bx(sl, 0.0025, 0.008, 0.064, 0.071, -0.034, -0.026, A.PARK); bx(sl, -0.0015, 0.0015, 0.064, 0.071, 0.124, 0.131, A.SIGHT);
      return { bore: 0.05, muzzle: 0.142, rear: [0.071, -0.03], front: [0.071, 0.128], gl: TWO(), shell: 'brass', eject: [0.014, 0.056, 0.035], hip: [0.11, -0.13, 0.38], ads: 0.42, kick: 0.9, mass: 0.5, roll: 0.12 };
    },
    cal20(P) {
      const s = P.st;
      pr(s, [[-0.075, 0.046], [0.002, 0.048], [0.018, -0.022], [-0.06, -0.036]], -0.0165, 0.0165, A.WOODL);
      pr(s, [[-0.42, 0.034], [-0.075, 0.046], [-0.06, -0.036], [-0.42, -0.11]], -0.021, 0.021, A.WOODL);
      bx(s, -0.0165, 0.0165, 0.022, 0.078, 0.0, 0.135, A.BLUED); bx(s, -0.017, -0.0166, 0.03, 0.06, 0.03, 0.11, MARK(2)); trig(s, 0.012);
      cz(s, 0, 0.062, 0.135, 0.68, 0.0125, 0.011, 12, A.BLUED, A.BORE); bx(s, -0.002, 0.002, 0.071, 0.077, 0.656, 0.664, A.SIGHT);
      pr(s, [[0.135, 0.052], [0.38, 0.05], [0.38, 0.03], [0.135, 0.02]], -0.021, 0.021, A.WOODL);
      return { bore: 0.062, muzzle: 0.68, rear: [0.079, 0.118], front: [0.077, 0.66], gl: HG(0.27, 0.035), shell: 'shell', eject: [0.017, 0.055, 0.07], hip: [0.13, -0.155, 0.3], ads: 0.25, kick: 1.6, mass: 1.1, roll: 0.15 };
    },
    cal12(P) {
      const s = P.st;
      pr(s, [[-0.075, 0.046], [0.002, 0.048], [0.018, -0.022], [-0.06, -0.036]], -0.017, 0.017, A.POLY);
      pr(s, [[-0.42, 0.034], [-0.075, 0.046], [-0.06, -0.036], [-0.42, -0.11]], -0.022, 0.022, A.POLY); bx(s, -0.023, 0.023, -0.11, 0.035, -0.43, -0.415, A.RUBBER);
      bx(s, -0.017, 0.017, 0.018, 0.078, 0.0, 0.145, A.PARK); bx(s, -0.0175, -0.017, 0.03, 0.06, 0.03, 0.12, MARK(3)); trig(s, 0.012);
      cz(s, 0, 0.064, 0.145, 0.64, 0.0125, 0.0125, 12, A.PARK, A.BORE); bx(s, -0.004, 0.004, 0.0765, 0.081, 0.145, 0.63, A.PARK); bx(s, -0.002, 0.002, 0.081, 0.087, 0.618, 0.626, A.SIGHT);
      cz(s, 0, 0.034, 0.145, 0.575, 0.0105, 0.0105, 10, A.PARK, A.PARK);
      const pm = P.part('pump', [0, 0, 0]); pr(pm, [[0.2, 0.052], [0.385, 0.052], [0.385, 0.017], [0.2, 0.017]], -0.0265, 0.0265, A.POLY, (i, n) => n[1] > 0.5 ? A.POLY : A.KNURL);
      return { bore: 0.064, muzzle: 0.64, rear: [0.081, 0.12], front: [0.087, 0.62], gl: HG(0.295, 0.034, 0.028), glMov: 'pump', shell: 'shell', eject: [0.018, 0.052, 0.07], ejectOnPump: true, hip: [0.13, -0.155, 0.3], ads: 0.25, kick: 2.0, mass: 1.25, roll: 0.18 };
    },
    smg9(P) {
      const s = P.st; pgrip(s, A.POLY, 0.014, 0.03); trig(s, 0.01);
      cz(s, 0, 0.052, -0.09, 0.2, 0.024, 0.024, 10, A.PARK, A.PARK); cz(s, 0, 0.052, 0.2, 0.275, 0.014, 0.012, 8, A.KNURL, A.BORE); bx(s, -0.025, -0.0245, 0.04, 0.062, 0.0, 0.08, MARK(1));
      pr(s, [[0.125, 0.032], [0.165, 0.032], [0.16, -0.062], [0.122, -0.06]], -0.014, 0.014, A.POLY);
      bx(s, 0.024, 0.029, 0.034, 0.042, -0.27, 0.02, A.PARK); bx(s, 0.024, 0.029, 0.0, 0.042, -0.275, -0.265, A.PARK);
      bx(s, -0.009, 0.009, 0.076, 0.09, -0.07, -0.058, A.PARK); bx(s, -0.0015, 0.0015, 0.076, 0.09, 0.19, 0.196, A.SIGHT);
      const mg = P.part('mag', [0, 0, 0]); bx(mg, -0.0105, 0.0105, -0.115, 0.032, 0.058, 0.086, A.PARK);
      return { bore: 0.052, muzzle: 0.275, rear: [0.09, -0.064], front: [0.09, 0.193], gl: VG(0.144, -0.015), shell: 'brass', eject: [0.024, 0.06, 0.04], hip: [0.13, -0.155, 0.3], ads: 0.24, kick: 0.6, mass: 0.75, roll: 0.06 };
    },
    smg10(P) {
      const s = P.st; pgrip(s, A.POLY, 0.0145, 0.032); trig(s, 0.01);
      bx(s, -0.022, 0.022, 0.032, 0.082, -0.12, 0.185, A.PARK); bx(s, -0.0225, -0.022, 0.045, 0.07, -0.05, 0.05, MARK(4));
      pr(s, [[0.185, 0.078], [0.32, 0.076], [0.32, 0.036], [0.185, 0.03]], -0.027, 0.027, A.POLY); cz(s, 0, 0.06, 0.32, 0.375, 0.0105, 0.0105, 8, A.PARK, A.BORE);
      bx(s, -0.011, 0.011, 0.082, 0.1, 0.305, 0.325, A.PARK); bx(s, -0.0015, 0.0015, 0.082, 0.1, 0.31, 0.316, A.SIGHT); bx(s, -0.01, 0.01, 0.082, 0.1, -0.11, -0.095, A.PARK);
      bx(s, 0.016, 0.021, 0.04, 0.05, -0.33, -0.12, A.STEEL); bx(s, -0.021, -0.016, 0.04, 0.05, -0.33, -0.12, A.STEEL); bx(s, -0.024, 0.024, -0.05, 0.065, -0.345, -0.33, A.RUBBER);
      const mg = P.part('mag', [0, 0, 0]); pr(mg, [[0.05, 0.032], [0.086, 0.032], [0.118, -0.115], [0.083, -0.122]], -0.0115, 0.0115, A.PARK);
      return { bore: 0.06, muzzle: 0.375, rear: [0.098, -0.103], front: [0.1, 0.313], gl: HG(0.255, 0.047, 0.028), shell: 'brass', eject: [0.022, 0.07, 0.05], hip: [0.13, -0.155, 0.3], ads: 0.22, kick: 0.7, mass: 0.8, roll: 0.06 };
    },
    fz556(P) {
      const s = P.st; pgrip(s, A.POLY, 0.0145, 0.03); trig(s, 0.012);
      bx(s, -0.022, 0.022, 0.045, 0.09, -0.13, 0.2, A.PARK); bx(s, -0.02, 0.02, 0.016, 0.046, -0.1, 0.085, A.POLY); bx(s, -0.0225, -0.022, 0.05, 0.08, -0.06, 0.06, MARK(14));
      bx(s, -0.012, 0.012, 0.09, 0.099, -0.12, 0.37, A.KNURL); bx(s, -0.026, 0.026, 0.036, 0.09, 0.2, 0.385, A.POLY); bx(s, -0.027, -0.026, 0.05, 0.075, 0.22, 0.36, A.KNURL); bx(s, 0.026, 0.027, 0.05, 0.075, 0.22, 0.36, A.KNURL);
      cz(s, 0, 0.063, 0.385, 0.585, 0.009, 0.009, 8, A.PARK, A.BORE); cz(s, 0, 0.063, 0.585, 0.635, 0.012, 0.012, 8, A.KNURL, A.BORE);
      bx(s, -0.006, 0.006, 0.099, 0.112, 0.345, 0.36, A.PARK); bx(s, -0.0014, 0.0014, 0.112, 0.124, 0.35, 0.355, A.SIGHTY);
      bx(s, -0.011, -0.004, 0.099, 0.123, -0.085, -0.075, A.PARK); bx(s, 0.004, 0.011, 0.099, 0.123, -0.085, -0.075, A.PARK);
      pr(s, [[-0.34, 0.076], [-0.13, 0.08], [-0.13, 0.03], [-0.34, -0.055]], -0.019, 0.019, A.POLY); bx(s, -0.02, 0.02, -0.06, 0.08, -0.35, -0.338, A.RUBBER);
      const mg = P.part('mag', [0, 0, 0]); pr(mg, [[0.022, 0.018], [0.062, 0.018], [0.1, -0.15], [0.058, -0.16]], -0.0122, 0.0122, A.POLY);
      return { bore: 0.063, muzzle: 0.635, rear: [0.12, -0.08], front: [0.124, 0.352], gl: HG(0.3, 0.05, 0.03), shell: 'brass', eject: [0.022, 0.07, 0.03], hip: [0.13, -0.16, 0.3], ads: 0.21, kick: 0.75, mass: 1.0, roll: 0.05 };
    },
    fz762(P) {
      const s = P.st; pgrip(s, A.POLY, 0.015, 0.03); trig(s, 0.012);
      bx(s, -0.024, 0.024, 0.034, 0.096, -0.15, 0.245, A.PARK); bx(s, -0.0245, -0.024, 0.05, 0.08, -0.08, 0.05, MARK(15)); bx(s, -0.004, 0.004, 0.096, 0.104, 0.0, 0.13, A.PARK);
      pr(s, [[0.245, 0.092], [0.475, 0.086], [0.475, 0.04], [0.245, 0.034]], -0.028, 0.028, A.WOOD); cz(s, 0, 0.066, 0.475, 0.765, 0.0102, 0.0102, 8, A.PARK, A.BORE); cz(s, 0, 0.066, 0.765, 0.85, 0.0135, 0.0125, 8, A.KNURL, A.BORE);
      bx(s, -0.014, 0.014, 0.055, 0.105, 0.5, 0.532, A.PARK); bx(s, -0.013, -0.009, 0.105, 0.132, 0.508, 0.526, A.PARK); bx(s, 0.009, 0.013, 0.105, 0.132, 0.508, 0.526, A.PARK); bx(s, -0.0014, 0.0014, 0.105, 0.128, 0.514, 0.52, A.SIGHT);
      bx(s, -0.011, -0.004, 0.096, 0.123, -0.13, -0.118, A.PARK); bx(s, 0.004, 0.011, 0.096, 0.123, -0.13, -0.118, A.PARK);
      pr(s, [[-0.47, 0.074], [-0.15, 0.092], [-0.15, 0.036], [-0.47, -0.065]], -0.021, 0.021, A.WOOD); bx(s, -0.022, 0.022, -0.068, 0.078, -0.48, -0.468, A.RUBBER);
      const mg = P.part('mag', [0, 0, 0]); pr(mg, [[0.03, 0.036], [0.078, 0.036], [0.09, -0.13], [0.042, -0.136]], -0.0145, 0.0145, A.PARK);
      return { bore: 0.066, muzzle: 0.85, rear: [0.122, -0.124], front: [0.128, 0.517], gl: HG(0.36, 0.055, 0.03), shell: 'brass', eject: [0.024, 0.075, 0.04], hip: [0.13, -0.16, 0.3], ads: 0.21, kick: 1.05, mass: 1.25, roll: 0.07 };
    },
    lmg(P) {
      const s = P.st; pgrip(s, A.POLY, 0.016, 0.03); trig(s, 0.012);
      bx(s, -0.034, 0.034, 0.02, 0.116, -0.19, 0.27, A.PARK); bx(s, -0.031, 0.031, 0.116, 0.131, -0.06, 0.16, A.PARK); bx(s, -0.0345, -0.034, 0.05, 0.09, -0.1, 0.06, MARK(7));
      cz(s, 0, 0.072, 0.27, 0.98, 0.0165, 0.0145, 10, A.PARK, A.BORE); cz(s, 0, 0.036, 0.27, 0.62, 0.0095, 0.0095, 8, A.PARK, A.PARK); cz(s, 0, 0.072, 0.98, 1.05, 0.02, 0.017, 8, A.KNURL, A.BORE);
      bx(s, -0.006, 0.006, 0.088, 0.15, 0.37, 0.39, A.PARK); bx(s, -0.006, 0.006, 0.145, 0.153, 0.32, 0.44, A.WOOD);
      bx(s, -0.022, -0.013, 0.012, 0.024, 0.6, 0.98, A.STEEL); bx(s, 0.013, 0.022, 0.012, 0.024, 0.6, 0.98, A.STEEL); bx(s, -0.0015, 0.0015, 0.088, 0.122, 0.95, 0.957, A.SIGHT);
      bx(s, -0.012, 0.012, 0.131, 0.145, -0.12, -0.1, A.PARK);
      pr(s, [[-0.52, 0.088], [-0.19, 0.104], [-0.19, 0.03], [-0.52, -0.06]], -0.023, 0.023, A.WOOD); bx(s, -0.024, 0.024, -0.064, 0.09, -0.53, -0.518, A.RUBBER);
      bx(s, -0.13, -0.045, -0.07, 0.035, -0.07, 0.07, A.OD);
      const bl = P.part('belt', [0, 0, 0]); belt(bl, [[-0.034, 0.095], [-0.06, 0.09], [-0.085, 0.07], [-0.1, 0.045]], 0.026, A.BELT);
      return { bore: 0.072, muzzle: 1.05, rear: [0.145, -0.11], front: [0.122, 0.953], gl: HG(0.17, 0.012, 0.036), shell: 'brass', eject: [-0.0, 0.01, 0.05], ejDown: true, hip: [0.14, -0.17, 0.28], ads: 0.22, kick: 0.85, mass: 1.9, roll: 0.06, beltStep: 1 / 16 };
    },
    mgl(P) {
      const s = P.st; pgrip(s, A.POLY, 0.016, 0.03); trig(s, 0.012);
      bx(s, -0.014, 0.014, 0.138, 0.151, -0.04, 0.2, A.PARK); bx(s, -0.014, 0.014, -0.0, 0.012, -0.0, 0.2, A.PARK); bx(s, -0.022, 0.022, 0.0, 0.15, -0.045, 0.01, A.PARK); bx(s, 0.022, 0.0226, 0.03, 0.12, -0.04, 0.0, MARK(8));
      cz(s, 0, 0.076, 0.168, 0.43, 0.027, 0.027, 12, A.OD, A.BORE); bx(s, -0.016, 0.016, 0.1, 0.11, 0.2, 0.42, A.KNURL);
      pr(s, [[0.272, 0.05], [0.31, 0.05], [0.305, -0.05], [0.268, -0.048]], -0.015, 0.015, A.POLY);
      bx(s, -0.055, -0.048, 0.13, 0.19, 0.04, 0.1, A.PARK); bx(s, -0.006, 0.006, 0.151, 0.16, 0.38, 0.39, A.SIGHT);
      bx(s, -0.005, 0.005, 0.02, 0.035, -0.36, -0.045, A.PARK); bx(s, -0.005, 0.005, 0.09, 0.105, -0.36, -0.045, A.PARK); bx(s, -0.02, 0.02, -0.06, 0.11, -0.37, -0.355, A.RUBBER);
      const c = P.part('cyl', [0, 0.076, 0]); cz(c, 0, 0, 0.018, 0.165, 0.064, 0.064, 12, A.OD, A.CYL6);
      return { bore: 0.076, muzzle: 0.43, rear: [0.19, 0.07], front: [0.16, 0.385], gl: VG(0.29, 0.0), shell: null, hip: [0.14, -0.16, 0.3], ads: 0.25, kick: 2.2, mass: 1.6, roll: 0.15 };
    },
  };
  // fita de munição: tiras curvas (u = ao longo da fita, rola a cada tiro)
  function belt(b, pts, w, uv) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], u0 = uv[0] + (uv[2] - uv[0]) * i / (pts.length - 1), u1 = uv[0] + (uv[2] - uv[0]) * (i + 1) / (pts.length - 1), n = [q[1] - p[1], -(q[0] - p[0]), 0];
      K3.quad(b, [p[0], p[1], -w], [p[0], p[1], w], [q[0], q[1], w], [q[0], q[1], -w], n, [u0, uv[1], u1, uv[3]], false);
    }
  }
  // armas montadas (torreta: .50 e canhões) — origem no munhão, empunhaduras atrás
  function mounted(P, o) {
    const s = P.st, rw = o.rw, t = o.tex;
    bx(s, -rw, rw, -0.07, o.rh, -0.46, o.rl, { side: t, top: A.PARK, front: A.PARK, back: A.PARK }); bx(s, -rw * 0.92, rw * 0.92, o.rh, o.rh + 0.016, -0.42, o.rl * 0.3, A.PARK);
    bx(s, -rw - 0.0006, -rw, -0.03, o.rh - 0.02, -0.25, -0.05, MARK(o.mark)); bx(s, rw, rw + 0.0006, -0.03, o.rh - 0.02, -0.25, -0.05, MARK(13));
    for (const sx of [-1, 1]) { cyY(s, sx * (rw + 0.0), -0.01, 0.12, -0.54, 0.017, 8, A.RUBBER); bx(s, sx * 0.012, sx * (rw + 0.01), -0.02, 0.0, -0.55, -0.45, A.PARK); bx(s, sx * 0.012, sx * (rw + 0.01), 0.11, 0.13, -0.55, -0.45, A.PARK); }
    bx(s, -0.025, 0.025, -0.0, 0.035, -0.53, -0.505, A.STEEL);
    cyY(s, 0, -0.75, -0.07, 0, 0.034, 10, A.PARK); bx(s, -rw * 0.9, rw * 0.9, -0.1, -0.07, -0.18, 0.18, A.PARK);
    bx(s, -0.012, 0.012, o.rh + 0.016, o.rh + 0.05, -0.36, -0.345, A.PARK); bx(s, -0.003, 0.003, o.rh + 0.05, o.rh + 0.062, -0.358, -0.347, A.SIGHTY);
    const by = o.by;
    if (o.jacket) cz(s, 0, by, o.rl, o.rl + 0.22, o.br * 1.9, o.br * 1.9, 10, A.KNURL, A.KNURL);
    if (o.under) cz(s, 0, by - o.br * 2.1, o.rl, o.rl + 0.5, o.br * 1.2, o.br * 1.2, 10, A.PARK, A.PARK);
    bx(s, o.box[0], o.box[1], -0.12, 0.09, -0.22, 0.12, o.boxUV);
    const bl = P.part('belt', [0, 0, 0]); belt(bl, [[(o.box[0] + o.box[1]) / 2, 0.092], [o.box[1] + 0.004, 0.11], [-rw - 0.002, 0.07]], o.bw, o.beltUV);
    if (o.shield) { bx(s, -0.33, -0.15, -0.22, 0.3, o.rl + 0.05, o.rl + 0.065, A.RIVET); bx(s, 0.15, 0.33, -0.22, 0.3, o.rl + 0.05, o.rl + 0.065, A.RIVET); bx(s, -0.15, 0.15, 0.17, 0.3, o.rl + 0.05, o.rl + 0.065, A.RIVET); }
    const brl = P.part('barrel', [0, 0, 0]);
    cz(brl, 0, by, o.rl - 0.05, o.len, o.br, o.br * 0.94, 10, A.PARK, A.BORE);
    if (o.brake) { bx(brl, -o.br * 1.7, o.br * 1.7, by - o.br * 1.3, by + o.br * 1.3, o.len, o.len + o.brake, A.PARK); bx(brl, -o.br * 1.75, -o.br * 1.7, by - o.br, by + o.br, o.len + 0.02, o.len + o.brake - 0.02, A.BORE); bx(brl, o.br * 1.7, o.br * 1.75, by - o.br, by + o.br, o.len + 0.02, o.len + o.brake - 0.02, A.BORE); }
    else cz(brl, 0, by, o.len, o.len + 0.07, o.br * 1.35, o.br * 1.15, 8, A.KNURL, A.BORE);
    const hot = P.part('hot', [0, 0, 0]); cz(hot, 0, by, o.rl + 0.25, o.len - 0.05, o.br * 1.02, o.br * 0.96, 10, A.HOT, A.HOT);
    const gR = RG([rw, 0.055, -0.54], [0, -1, 0], [-0.25, 0, 1], 0.017), gL = RG([-rw, 0.055, -0.54], [0, 1, 0], [0.25, 0, 1], 0.017);
    return { bore: by, muzzle: o.len + (o.brake || 0.07), rear: [o.rh + 0.058, -0.35], front: [by + o.br * 2, o.rl + 0.2], gr: gR, gl: gL, mount: true, shell: o.shell, eject: [0, -0.07, 0.0], ejDown: true, kick: o.kick, mass: o.mass, roll: 0.03, recoilZ: o.rz, beltStep: o.bstep };
  }
  BUILD.m2 = (P) => mounted(P, { rw: 0.062, rh: 0.092, rl: 0.36, by: 0.016, br: 0.021, len: 1.55, jacket: 1, tex: A.RIVET, mark: 9, box: [-0.22, -0.075], boxUV: A.OD, bw: 0.03, beltUV: A.BELT, shell: 'big', kick: 1.0, mass: 2.6, rz: 0.03, bstep: 1 / 16 });
  BUILD.c20 = (P) => mounted(P, { rw: 0.085, rh: 0.12, rl: 0.42, by: 0.02, br: 0.027, len: 1.75, under: 1, brake: 0.12, tex: A.CANNON, mark: 10, box: [-0.27, -0.1], boxUV: A.CANNON, bw: 0.04, beltUV: A.BELT50, shell: 'big', kick: 1.2, mass: 3.4, rz: 0.06, bstep: 1 / 8, shield: 0 });
  BUILD.c25 = (P) => mounted(P, { rw: 0.095, rh: 0.13, rl: 0.45, by: 0.022, br: 0.031, len: 1.95, under: 1, brake: 0.15, tex: A.CANNON, mark: 11, box: [-0.29, -0.11], boxUV: A.CANNON, bw: 0.045, beltUV: A.BELT50, shell: 'big', kick: 1.35, mass: 3.8, rz: 0.08, bstep: 1 / 8, shield: 1 });
  BUILD.c30 = (P) => mounted(P, { rw: 0.105, rh: 0.14, rl: 0.48, by: 0.024, br: 0.036, len: 2.15, under: 1, brake: 0.18, tex: A.CANNON, mark: 12, box: [-0.31, -0.12], boxUV: A.CANNON, bw: 0.05, beltUV: A.BELT50, shell: 'big', kick: 1.5, mass: 4.2, rz: 0.1, bstep: 1 / 8, shield: 1 });

  // armas brancas (origem na mão direita; +z = ponta)
  const MELEE3 = {
    facao(P) { const s = P.st; cz(s, 0, 0, -0.07, 0.05, 0.0155, 0.0145, 8, A.CORD, A.WOOD); bx(s, -0.011, 0.011, -0.022, 0.024, 0.048, 0.057, A.STEEL); bx(s, -0.012, 0.012, -0.012, 0.012, -0.082, -0.07, A.STEEL);
      pr(s, [[0.057, 0.02], [0.43, 0.034], [0.5, 0.004], [0.46, -0.028], [0.057, -0.018]], -0.0024, 0.0024, A.BLADE); return { gr: RG([0, 0, 0], [0, 0, -1], [-1, 0, 0.05], 0.016), gl: null, mass: 0.6 }; },
    lanca(P) { const s = P.st; cz(s, 0, 0, -0.75, 0.75, 0.0165, 0.0155, 8, A.BAT, A.BAT); for (const z of [0.66, 0.7, 0.74]) cz(s, 0, 0, z, z + 0.012, 0.019, 0.019, 8, A.STEEL, A.STEEL);
      pr(s, [[0.72, 0.016], [0.9, 0.022], [1.0, 0.0], [0.9, -0.022], [0.72, -0.016]], -0.0025, 0.0025, A.BLADE); return { gr: RG([0, 0, 0], [0, 0, -1], [-0.45, 0.9, 0], 0.017), gl: RG([0, 0, 0.36], [0, 0, 1], [0.45, 0.9, 0], 0.017), mass: 0.9 }; },
    porrete(P) { const s = P.st; cz(s, 0, 0, -0.07, 0.62, 0.02, 0.046, 10, A.BAT, A.BAT); cz(s, 0, 0, -0.07, 0.07, 0.0215, 0.0225, 8, A.CORD, A.CORD);
      for (let i = 0; i < 14; i++) { const z = 0.32 + (i % 7) * 0.045, a = i * 2.4, rr = 0.036 + (z - 0.3) * 0.03, m = K3.mark(s); cz(s, 0, 0, 0, 0.05, 0.0025, 0.0018, 4, A.STEEL, A.STEEL); Z3D.xform(s, m, PI / 2, a, 0, Math.sin(a) * rr * 0.6, Math.cos(a) * rr * 0.6, z); }
      return { gr: RG([0, 0, 0], [0, 0, -1], [-1, 0, 0.05], 0.02), gl: null, mass: 1.1 }; },
    serra(P, ind) {
      const s = P.st, L = ind ? 1.02 : 0.74, body = ind ? A.REDIND : A.ORANGE;
      bx(s, -0.07, 0.07, -0.06, 0.11, 0.0, 0.31, { side: body, top: body, front: A.POLY, back: A.POLY }); bx(s, -0.06, 0.06, 0.11, 0.135, 0.04, 0.28, A.POLY); bx(s, 0.07, 0.075, -0.02, 0.06, 0.1, 0.24, A.KNURL);
      bx(s, -0.015, 0.015, -0.03, 0.012, -0.15, 0.0, A.POLY); bx(s, -0.015, 0.015, -0.03, 0.07, -0.16, -0.135, A.POLY); bx(s, -0.006, 0.006, -0.03, -0.012, -0.08, -0.055, A.STEEL);
      bx(s, -0.095, 0.095, 0.142, 0.168, 0.18, 0.205, A.POLY); bx(s, -0.095, -0.075, -0.02, 0.168, 0.18, 0.205, A.POLY); bx(s, 0.075, 0.095, -0.02, 0.168, 0.18, 0.205, A.POLY);
      bx(s, -0.0045, 0.0045, -0.012, 0.06, 0.3, L, A.BAR); K3.cyl(s, [-0.0045, 0.024, L], 0.036, 0.036, 0.009, 10, 'x', A.BAR, A.BAR, true);
      if (ind) bx(s, -0.08, -0.07, 0.0, 0.08, 0.32, 0.36, A.STEEL);
      const ch = P.part('chain', [0, 0, 0]); bx(ch, -0.0062, 0.0062, 0.06, 0.071, 0.3, L, A.CHAIN); bx(ch, -0.0062, 0.0062, -0.023, -0.012, 0.3, L, A.CHAIN);
      return { gr: RG([0, -0.009, -0.075], [0, 0, -1], [0, -1, 0.05], 0.016), gl: RG([-0.035, 0.155, 0.192], [1, 0, 0], [0, -0.45, 0.89], 0.014), mass: ind ? 2.4 : 1.8, len: L };
    },
  };
  MELEE3.serraInd = (P) => MELEE3.serra(P, true);

  // canhões e metralhadoras do capô (montados no carro, sem mãos)
  const CAPO3 = [null,
    (P) => { const s = P.st; cz(s, 0, 0.05, -0.12, 0.2, 0.026, 0.026, 10, A.PARK, A.PARK); cz(s, 0, 0.05, 0.2, 0.36, 0.013, 0.012, 8, A.KNURL, A.BORE); bx(s, -0.01, 0.01, -0.07, 0.03, 0.04, 0.07, A.PARK); return { bore: 0.05, muzzle: 0.36, shell: 'brass', fl: 0.7 }; },
    (P) => { const s = P.st; bx(s, -0.03, 0.03, 0.02, 0.09, -0.15, 0.15, A.PARK); cz(s, 0, 0.065, 0.15, 0.62, 0.016, 0.016, 10, A.PARK, A.BORE); const m = K3.mark(s); K3.cyl(s, [-0.06, -0.02, 0.0], 0.07, 0.07, 0.12, 12, 'x', A.PARK, A.DRUM, true); void m; return { bore: 0.065, muzzle: 0.62, shell: 'shell', fl: 1.0 }; },
    (P) => { const s = P.st; bx(s, -0.035, 0.035, 0.02, 0.115, -0.2, 0.25, A.PARK); cz(s, 0, 0.07, 0.25, 0.95, 0.016, 0.014, 10, A.PARK, A.BORE); cz(s, 0, 0.07, 0.95, 1.02, 0.02, 0.017, 8, A.KNURL, A.BORE); bx(s, -0.14, -0.04, -0.06, 0.06, -0.12, 0.08, A.OD); return { bore: 0.07, muzzle: 1.02, shell: 'brass', fl: 1.0, belt: 1 }; },
    (P) => { const s = P.st; for (const sx of [-0.13, 0.13]) { bx(s, sx - 0.06, sx + 0.06, -0.06, 0.09, -0.4, 0.35, A.RIVET); cz(s, sx, 0.016, 0.35, 0.55, 0.04, 0.04, 10, A.KNURL, A.KNURL); cz(s, sx, 0.016, 0.55, 1.5, 0.021, 0.02, 10, A.PARK, A.BORE); cz(s, sx, 0.016, 1.5, 1.57, 0.028, 0.024, 8, A.KNURL, A.BORE); } bx(s, -0.2, 0.2, -0.09, -0.06, -0.2, 0.2, A.PARK); return { bore: 0.016, muzzle: 1.57, twin: 0.13, shell: 'big', fl: 1.4 }; },
    (P) => { const s = P.st; bx(s, -0.1, 0.1, -0.09, 0.13, -0.45, 0.45, A.CANNON); cz(s, 0, 0.022, 0.45, 1.95, 0.031, 0.029, 10, A.PARK, A.BORE); bx(s, -0.055, 0.055, -0.02, 0.064, 1.95, 2.1, A.PARK); cz(s, 0, -0.045, 0.45, 0.95, 0.036, 0.036, 10, A.PARK, A.PARK); return { bore: 0.022, muzzle: 2.1, shell: 'big', fl: 1.8 }; },
    (P) => { const s = P.st; bx(s, -0.11, 0.11, -0.09, 0.14, -0.48, 0.48, A.CANNON); cz(s, 0, 0.024, 0.48, 2.15, 0.036, 0.034, 10, A.PARK, A.BORE); bx(s, -0.063, 0.063, -0.025, 0.073, 2.15, 2.33, A.PARK); cz(s, 0, -0.05, 0.48, 1.0, 0.04, 0.04, 10, A.PARK, A.PARK); return { bore: 0.024, muzzle: 2.33, shell: 'big', fl: 2.0 }; },
  ];

  // monta o modelo: P.st = parte estática; P.part(nome, pivô) = parte móvel
  const models = {};
  function make(key, fn, arg) {
    if (models[key]) return models[key];
    const parts = [], P = { st: new GL3.Builder(), part(name, piv) { const b = new GL3.Builder(); parts.push({ name, piv, b }); return b; } };
    const info = fn(P, arg) || {};
    const T = tex(), out = { key, info, parts: [] };
    if (P.st.v.length) out.parts.push({ name: 'st', piv: [0, 0, 0], mesh: P.st.mesh(), tex: T });
    for (const p of parts) if (p.b.v.length) {
      // peças que giram em volta de um pivô: os vértices ficam relativos ao pivô
      if (p.piv[0] || p.piv[1] || p.piv[2]) for (let o = 0; o < p.b.v.length; o += GL3.STRIDE) { p.b.v[o] -= p.piv[0]; p.b.v[o + 1] -= p.piv[1]; p.b.v[o + 2] -= p.piv[2]; }
      out.parts.push({ name: p.name, piv: p.piv, mesh: p.b.mesh(), tex: T });
    }
    return (models[key] = out);
  }
  const gunModel = (k) => BUILD[k] ? make('w' + k, BUILD[k]) : null;
  const meleeModel = (k) => MELEE3[k] ? make('m' + k, MELEE3[k]) : null;
  const capoModel = (n) => CAPO3[n] ? make('c' + n, CAPO3[n]) : null;
  // cápsulas (latão, cartucho vermelho, grande) e carregador que cai na recarga
  let shellM = null;
  function shellMeshes() {
    if (shellM) return shellM; const T = tex(), mk = (f) => { const b = new GL3.Builder(); f(b); return b.mesh(); };
    shellM = { brass: mk((b) => cz(b, 0, 0, -0.011, 0.011, 0.0048, 0.0048, 6, A.BRASS, A.BRASS)), shell: mk((b) => { cz(b, 0, 0, -0.03, 0.03, 0.0105, 0.0105, 8, A.SHELLR, A.BORE); }), big: mk((b) => cz(b, 0, 0, -0.04, 0.04, 0.011, 0.011, 8, A.BRASS, A.BRASS)), tex: T };
    return shellM;
  }

  return { tex, A, gunModel, meleeModel, capoModel, shellMeshes, CAPO3, MARK };
})();
