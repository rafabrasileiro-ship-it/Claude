'use strict';
/* Efeitos 3D: partículas de sangue (tiro, cabeça estourando, atropelamento), perigos dos chefes no asfalto
   (fogo e objeto caindo com mira no chão). Tudo em coordenadas da estrada, convertido para a vista a cada quadro. */
const FX3D = (() => {
  const parts = [];   // {x, y, z (estrada), vx, vy, vz, life, max, s (tamanho), r,g,b}
  const H = (n) => DRAW.hash(n);
  function spray(x, y, z, n, spd, up, size, col, spread) {
    for (let i = 0; i < n; i++) {
      if (parts.length > 420) parts.shift();
      const a = Math.random() * Math.PI * 2, s = spd * (0.35 + Math.random() * 0.8), c = col || [0.42, 0.02, 0.02];
      parts.push({ x, y, z, vx: Math.cos(a) * s * (spread || 1), vy: up * (0.4 + Math.random()), vz: Math.sin(a) * s * (spread || 1) + (P.speed > 3 ? -P.speed * 0.15 : 0), life: 0, max: 0.6 + Math.random() * 0.6, s: size * (0.6 + Math.random() * 0.8), r: c[0] * (0.7 + Math.random() * 0.5), g: c[1], b: c[2] });
    }
  }
  // tiro em zumbi: esguicho no peito; cabeça estourando; atropelamento
  function hit(e, head) { const d = ENEMY[e.type]; spray(e.x, d.h * (head ? 0.92 : 0.62), e.z, head ? 10 : 6, 2.2, 2.5, 0.09, e.type === 'boiadeiro' ? [0.4, 0.75, 0.12] : null); }
  function burst(c, kind) {
    if (kind === 'head') { spray(c.x, 1.55, c.z, 26, 3.2, 4.5, 0.11); spray(c.x, 1.55, c.z, 8, 1.5, 3, 0.07, [0.85, 0.82, 0.7]); }
    else spray(c.x, 1.0, c.z, 22, 4, 5, 0.12);
  }
  function update(dt) {
    for (const p of parts) { p.life += dt; p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0) { p.y = 0; p.vx *= 0.2; p.vz *= 0.2; p.vy = 0; } }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) parts.splice(i, 1);
  }
  // desenha as partículas desta vista (chamado pelo mundo 3D)
  function draw(R, ctx) {
    const v = ctx.v; if (v.main) { if (P.z < (draw.lz || 0) - 60 || G.st !== draw.st) parts.length = 0; draw.lz = P.z; draw.st = G.st; const dt = Math.min(0.05, Math.max(0, G.t - (draw.lt || G.t))); draw.lt = G.t; update(dt); }
    for (const p of parts) {
      const dz = R.dir * (p.z - v.camZ); if (dz < 0.4 || dz > ctx.maxD) continue;
      const vx = R.fs * (ctx.center(dz) + p.x - v.camX), a = 1 - p.life / p.max;
      R.particle(vx, ctx.y0 + p.y + p.s * 0.5, dz, p.s, p.r, p.g, p.b, Math.min(1, a * 1.6));
    }
  }
  // perigos dos chefes: fogo no asfalto e objeto despencando com mira piscando no chão
  let crate = null;
  function crateM() { if (crate) return crate; const b = new GL3.Builder(), A = V3D.A; b.mat = 0; K3.box(b, -1, 1, 0, 1.6, -1.2, 1.2, { side: A.METAL, front: A.HAZ, back: A.HAZ, top: A.METAL, bottom: A.METAL }); return (crate = b.mesh()); }
  const MC = GL3.M4.make();
  function hazard(R, h, vx, vy, vz, ctx) {
    const t = G.t;
    if (h.kind === 'fogo') {
      if (h.t > h.delay) {
        R.decal(10, vx, vy, vz, h.r * 1.2, h.r * 1.2, 0, 0.85);
        const n = Math.min(9, 3 + h.r * 2 | 0);
        for (let i = 0; i < n; i++) { const a = i / n * 6.28 + h.x, rr = h.r * 0.6 * H(i + h.z), fh = 0.9 + Math.sin(t * 14 + i * 2.1) * 0.35 + H(i * 3) * 0.8; R.flame(vx + Math.cos(a) * rr, vy + fh * 0.55, vz + Math.sin(a) * rr, 0.45 + H(i) * 0.3, fh * 0.7, 0.9); }
        R.glow(vx, vy + 0.6, vz, h.r * 1.6, 1.4, 1, 0.45, 0.1, 0.45);
      } else R.decal(12, vx, vy, vz, h.r, h.r, t * 2, 0.9, 1, 0.55, 0.1);
      return;
    }
    if (h.done) return;
    const p = Math.min(1, h.t / h.delay), blink = Math.sin(t * 20) > 0;
    R.decal(12, vx, vy, vz, h.r, h.r, 0, 0.95, blink ? 1 : 1, blink ? 0.16 : 0.82, blink ? 0.16 : 0.25);
    R.blob(vx, vy, vz, h.r * (0.4 + p * 0.6), h.r * (0.4 + p * 0.6), 0.25 + p * 0.45);
    const hgt = (1 - p) * (1 - p) * 30, f = Z3D.fwd(R, t * 0.8, 0);
    R.model(crateM(), V3D.tex(), R.place(MC, vx, vy + hgt, vz, f[0], f[1], h.r * 0.55), {});
  }
  return { hit, burst, draw, hazard, spray, get count() { return parts.length; } };
})();
