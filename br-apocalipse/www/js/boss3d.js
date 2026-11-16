'use strict';
/* Os 10 chefes em 3D. Cada um é um veículo-monstro montado com o kit; os pontos fracos (b.parts) são caixas brilhantes
   na face voltada para a câmera, exatamente onde ficam os retângulos de tiro do jogo. */
const B3D = (() => {
  const PI = Math.PI, M4 = GL3.M4, cache = {};
  const A = () => V3D.A, T = () => V3D.tex();
  const TINT = new Float32Array(3), PC = new Float32Array(3), MT = M4.make(), MP = M4.make(), MQ = M4.make();
  // caixa de um ponto fraco (unitária, brilhante: célula branca do atlas tingida pela cor do ponto)
  let partBox = null;
  function pbox() { if (partBox) return partBox; const b = new GL3.Builder(); b.mat = 1; K3.box(b, -0.5, 0.5, 0, 1, -0.5, 0.5, A().WHITE); return (partBox = b.mesh()); }
  const wheelsOf = (list) => list.map(w => ({ x: w[0], y: w[1], z: w[2], r: w[1], w: w[3] || 0.45 }));

  /* ---------- modelos ---------- */
  function model(key) {
    if (cache[key]) return cache[key];
    const a = A(), b = new GL3.Builder(), sc = new GL3.Builder(), SA = S3D.tex(), U = K3.R(512); let L = 8, wheels = [], fx = {};
    b.mat = 1;
    const cab = (z0, z1, w, h, y0) => { b.mat = 1; K3.extrude(b, [[z0, y0], [z0, h], [z1 - 0.5, h], [z1, h - 0.9], [z1, y0]], -w / 2, w / 2, a.PAINT, (i, n) => n[2] > 0.3 && n[1] > 0.2 ? (b.mat = 0, a.GLASS) : n[2] > 0.8 ? (b.mat = 0, a.GRILLE) : (b.mat = n[1] < -0.5 ? 0 : 1, n[1] < -0.5 ? a.DARK : a.PAINT)); b.mat = 1; };
    const chassis = (z0, z1, w) => { b.mat = 0; K3.box(b, -w / 2, w / 2, 0.7, 1.05, z0, z1, a.DARK); };
    switch (key) {
      case 'usineiro': {   // treminhão de cana pegando fogo
        L = 11; cab(3.0, 5.5, 2.6, 3.3, 0.9); chassis(-5.5, 3.0, 2.2);
        b.mat = 1; K3.box(b, -1.6, 1.6, 1.05, 3.4, -5.5, 2.6, { side: a.PAINT, front: a.PAINT, back: a.TAIL, top: null });
        const c = K3.R(512); sc.mat = 0; K3.box(sc, -1.5, 1.5, 3.3, 4.0, -5.4, 2.5, { side: [0.5 + 0.5 / 512, 0.375 + 0.5 / 512, 0.75 - 0.5 / 512, 0.5 - 0.5 / 512], top: [0.5 + 0.5 / 512, 0.25 + 0.5 / 512, 0.75 - 0.5 / 512, 0.375 - 0.5 / 512] });
        wheels = wheelsOf([[1.25, 0.55, 4.2], [-1.25, 0.55, 4.2], [1.25, 0.55, -1.0], [-1.25, 0.55, -1.0], [1.25, 0.55, -2.3], [-1.25, 0.55, -2.3], [1.25, 0.55, -4.4], [-1.25, 0.55, -4.4]]);
        fx.fire = [[-1, 4.1, -2], [0.8, 4.1, 0], [0, 4.1, -4], [-0.6, 4.1, 1.5]]; break;
      }
      case 'guincho': {   // guincho pesado: lança e arpão
        L = 8; cab(1.5, 4.0, 2.6, 3.1, 0.9); chassis(-4, 1.5, 2.2); b.mat = 0; K3.box(b, -1.5, 1.5, 1.05, 1.6, -4, 1.4, a.METAL);
        b.mat = 1; const m = K3.mark(b); K3.box(b, -0.25, 0.25, 0, 4.2, -0.25, 0.25, a.PAINT); K3.xf(b, m, -0.55, 0, 0, 0, 1.6, -0.5);
        b.mat = 0; K3.box(b, -1.3, 1.3, 4.0, 4.3, -3.4, -3.0, a.HAZ); K3.box(b, -1.5, 1.5, 0.4, 0.9, -4.15, -3.9, a.HAZ);
        wheels = wheelsOf([[1.25, 0.55, 2.9], [-1.25, 0.55, 2.9], [1.25, 0.55, -2.0], [-1.25, 0.55, -2.0], [1.25, 0.55, -3.2], [-1.25, 0.55, -3.2]]); break;
      }
      case 'reidograu': {   // monster truck rosa com pneus gigantes
        L = 5.4; b.mat = 1; K3.extrude(b, [[-2.6, 1.9], [-2.6, 2.6], [-1.0, 2.75], [1.6, 2.7], [2.6, 2.35], [2.6, 1.9]], -1.35, 1.35, a.PAINT, (i, n) => n[2] > 0.72 ? a.GRILLE : n[2] < -0.72 ? a.TAIL : a.PAINT);
        b.mat = 0; K3.extrude(b, [[-1.2, 2.7], [-1.05, 3.35], [0.55, 3.38], [1.1, 2.7]], -1.15, 1.15, a.GLASSF, (i, n) => n[1] > 0.85 ? a.DARK : a.GLASS, 0.12);
        K3.box(b, -1.0, 1.0, 1.2, 1.9, -1.6, 1.6, a.DARK); K3.box(b, -1.5, 1.5, 3.38, 3.5, -0.4, 0.4, a.DARK); for (let i = 0; i < 6; i++) K3.box(b, -1.3 + i * 0.5, -1.1 + i * 0.5, 3.4, 3.55, -0.2, 0.2, i % 2 ? a.BLUE : a.RED);
        wheels = wheelsOf([[1.25, 0.95, 1.6, 0.9], [-1.25, 0.95, 1.6, 0.9], [1.25, 0.95, -1.6, 0.9], [-1.25, 0.95, -1.6, 0.9]]); fx.bounce = 1; break;
      }
      case 'tatuzao': {   // blindado de choque, chapas inclinadas
        L = 7; b.mat = 1; K3.extrude(b, [[-3.5, 0.6], [-3.5, 2.9], [-2.6, 3.4], [1.8, 3.4], [3.2, 2.3], [3.5, 1.2], [3.5, 0.6]], -1.6, 1.6, a.METAL, (i, n) => n[2] > 0.3 && n[1] > 0.3 ? (b.mat = 0, a.MESH) : n[2] > 0.8 ? (b.mat = 0, a.GRILLE) : n[2] < -0.8 ? (b.mat = 0, a.METAL) : (b.mat = 1, a.METAL), 0.2);
        b.mat = 0; K3.cyl(b, [0, 3.4, -0.5], 0.7, 0.55, 0.5, 10, 'y', a.METAL, a.METAL, true); K3.cyl(b, [0, 3.65, -0.5], 0.08, 0.08, 1.8, 8, 'z', a.DARK, a.DARK, true);
        for (const s of [-1, 1]) K3.quad(b, [s * 1.62, 1.6, -2.6], [s * 1.62, 2.4, -2.6], [s * 1.62, 2.4, 0.6], [s * 1.62, 1.6, 0.6], [s, 0, 0], a.LOGO);
        wheels = wheelsOf([[1.45, 0.6, 2.3], [-1.45, 0.6, 2.3], [1.45, 0.6, 0.2], [-1.45, 0.6, 0.2], [1.45, 0.6, -2.2], [-1.45, 0.6, -2.2]]); break;
      }
      case 'ceifador': {   // colheitadeira monstro na contramão: plataforma de corte de 11 m com molinete girando
        L = 9; b.mat = 1; K3.box(b, -1.9, 1.9, 1.0, 4.0, -4.5, 1.6, a.PAINT); K3.extrude(b, [[0.2, 4.0], [0.2, 5.3], [1.8, 5.3], [2.3, 4.0]], -1.3, 1.3, a.PAINT, (i, n) => n[2] > 0.3 ? (b.mat = 0, a.GLASS) : (b.mat = 1, a.PAINT));
        b.mat = 0; K3.box(b, -5.5, 5.5, 0.15, 1.7, 2.6, 4.4, { side: a.METAL, front: a.HAZ, back: a.METAL, top: a.METAL }); K3.box(b, -0.8, 0.8, 1.0, 2.2, 1.4, 2.8, a.METAL);
        K3.cyl(b, [2.2, 4.0, -2.6], 0.25, 0.25, 4, 8, 'y', a.CHROME, a.DARK, true); K3.box(b, 1.95, 2.45, 4.0, 4.3, -2.85, 0.5, a.CHROME);
        wheels = wheelsOf([[1.9, 0.95, 0.4, 0.8], [-1.9, 0.95, 0.4, 0.8], [1.6, 0.6, -3.6, 0.5], [-1.6, 0.6, -3.6, 0.5]]); fx.reel = [0, 1.2, 4.6, 5.3]; fx.smoke = [2.2, 8.2, -2.6]; break;
      }
      case 'derrubador': {   // escavadeira blindada em esteiras, braço com caçamba
        L = 6; b.mat = 0; for (const s of [-1, 1]) K3.box(b, s * 1.45 - 0.45, s * 1.45 + 0.45, 0, 1.1, -2.8, 2.8, { side: a.DARK, front: a.TIRE, back: a.TIRE, top: a.TIRE });
        b.mat = 1; K3.box(b, -1.5, 1.5, 1.1, 2.6, -2.6, 2.2, a.PAINT); K3.box(b, -1.0, 0.6, 2.6, 4.2, -0.6, 1.4, { side: a.GLASS, front: a.GLASS, back: a.PAINT, top: a.PAINT });
        b.mat = 0; K3.box(b, -1.6, 1.6, 1.1, 2.0, -2.9, -2.6, a.METAL); fx.arm = 1; break;
      }
      case 'carrasco': {   // caminhão-cegonha com carros-bomba no andar de cima
        L = 15; cab(5.0, 7.5, 2.6, 3.3, 0.9); chassis(-7.5, 5.0, 2.2); b.mat = 0;
        for (const s of [-1, 1]) for (let z = -7; z <= 4.5; z += 1.5) K3.box(b, s * 1.45 - 0.08, s * 1.45 + 0.08, 1.05, 4.0, z - 0.08, z + 0.08, a.METAL);
        K3.box(b, -1.6, 1.6, 2.35, 2.5, -7.5, 4.6, a.METAL); K3.box(b, -1.6, 1.6, 3.9, 4.05, -7.5, 4.6, a.METAL);
        for (const z of [-5.5, -1.5, 2.5]) { const m = K3.mark(b); K3.box(b, -0.85, 0.85, 0, 0.7, -1.7, 1.7, a.RUST); K3.box(b, -0.75, 0.75, 0.7, 1.15, -1.0, 0.8, a.GLASSF); K3.xf(b, m, 0, 0, 0, 0, 2.5, z); const m2 = K3.mark(b); K3.box(b, -0.85, 0.85, 0, 0.7, -1.7, 1.7, a.PAINT); K3.cyl(b, [0, 0.7, -0.6], 0.25, 0.25, 0.5, 8, 'y', a.BARREL, a.DARK, true); K3.xf(b, m2, 0, 0, 0, 0, 1.05, z); }
        wheels = wheelsOf([[1.25, 0.55, 6.2], [-1.25, 0.55, 6.2], [1.25, 0.55, -4.5], [-1.25, 0.55, -4.5], [1.25, 0.55, -5.8], [-1.25, 0.55, -5.8]]); break;
      }
      case 'corisco': {   // caminhonete do Coronel, com o próprio em pé na caçamba
        L = 5.6; b.mat = 1; K3.extrude(b, [[-2.8, 0.45], [-2.8, 1.2], [2.4, 1.2], [2.8, 1.05], [2.8, 0.45], [2.4, 0.32], [-2.4, 0.32]], -1.3, 1.3, a.PAINT, (i, n) => n[2] > 0.72 ? (b.mat = 0, a.GRILLE) : n[2] < -0.72 ? (b.mat = 0, a.TAIL) : (b.mat = 1, n[1] < -0.5 ? a.DARK : a.PAINT));
        b.mat = 0; K3.extrude(b, [[-0.9, 1.2], [-0.8, 2.05], [0.8, 2.08], [1.45, 1.2]], -1.2, 1.2, a.GLASSF, (i, n) => n[1] > 0.85 ? a.PAINT : a.GLASS, 0.14);
        for (const s of [-1, 1]) K3.quad(b, [s * 1.31, 0.6, -2.4], [s * 1.31, 1.15, -2.4], [s * 1.31, 1.15, -1.0], [s * 1.31, 0.6, -1.0], [s, 0, 0], a.STAR);
        wheels = wheelsOf([[1.15, 0.45, 1.8], [-1.15, 0.45, 1.8], [1.15, 0.45, -1.8], [-1.15, 0.45, -1.8]]); fx.colonel = [0, 1.2, -1.8]; break;
      }
      case 'iluminado': {   // trio elétrico: paredão de caixas de som e luzes
        L = 12; cab(3.5, 6.0, 2.8, 3.3, 0.9); chassis(-6, 3.5, 2.4); b.mat = 1; K3.box(b, -1.8, 1.8, 1.05, 4.9, -6, 3.2, { side: a.PAINT, front: a.PAINT, back: a.DARK, top: a.METAL });
        b.mat = 0; for (const s of [-1, 1]) for (let z = -5.5; z < 3; z += 1.1) for (let y = 1.4; y < 4.6; y += 1.1) K3.cyl(b, [s * 1.81, y, z], 0.42, 0.42, 0.05, 12, 'x', a.DARK, a.RIM, true);
        K3.box(b, -1.8, 1.8, 4.9, 5.2, -6, 3.2, a.HAZ); fx.lights = 1;
        wheels = wheelsOf([[1.35, 0.55, 4.8], [-1.35, 0.55, 4.8], [1.35, 0.55, -2.8], [-1.35, 0.55, -2.8], [1.35, 0.55, -4.2], [-1.35, 0.55, -4.2]]); break;
      }
      case 'leviata': {   // bitrem blindado com dois tanques
        L = 18; cab(6.5, 9, 2.8, 3.4, 0.9); chassis(-9, 6.5, 2.4);
        b.mat = 1; for (const [z0, z1] of [[-9, -1.4], [-1.0, 6.2]]) { K3.cyl(b, [0, 2.6, z0], 1.6, 1.6, z1 - z0, 14, 'z', a.METAL, a.METAL, true); K3.box(b, -0.3, 0.3, 4.15, 4.35, z0 + 0.5, z1 - 0.5, a.HAZ); }
        b.mat = 0; for (let z = -8.5; z < 6; z += 0.9) for (const s of [-1, 1]) K3.cyl(b, [s * 1.62, 2.6, z], 0.12, 0.0, 0.5, 5, 'x', a.CHROME, null, false);
        wheels = wheelsOf([[1.35, 0.55, 8.0], [-1.35, 0.55, 8.0], [1.35, 0.55, -2.5], [-1.35, 0.55, -2.5], [1.35, 0.55, -3.8], [-1.35, 0.55, -3.8], [1.35, 0.55, -6.8], [-1.35, 0.55, -6.8], [1.35, 0.55, -8.1], [-1.35, 0.55, -8.1]]); break;
      }
      default: { L = 6; b.mat = 1; K3.box(b, -1.5, 1.5, 0.5, 3, -3, 3, a.PAINT); }
    }
    const parts = K3.model([{ b, tex: T() }, { b: sc, tex: SA }]);
    return (cache[key] = { parts, L, wheels, fx });
  }

  /* ---------- desenho ---------- */
  let armMesh = null, reelMesh = null;
  function arm() { if (armMesh) return armMesh; const b = new GL3.Builder(), a = A(); b.mat = 1; K3.box(b, -0.3, 0.3, 0, 0.6, 0, 3.2, a.PAINT); const m = K3.mark(b); K3.box(b, -0.25, 0.25, 0, 0.5, 0, 2.6, a.PAINT); K3.xf(b, m, 1.1, 0, 0, 0, 0.3, 3.1); b.mat = 0; const m2 = K3.mark(b); K3.box(b, -0.7, 0.7, -0.6, 0.4, -0.4, 0.5, a.METAL); K3.xf(b, m2, 0.6, 0, 0, 0, -1.9, 4.6); return (armMesh = b.mesh()); }
  function reel() { if (reelMesh) return reelMesh; const b = new GL3.Builder(), a = A(); b.mat = 0; K3.cyl(b, [-5.3, 0, 0], 0.25, 0.25, 10.6, 8, 'x', a.DARK, a.DARK, true); for (let i = 0; i < 6; i++) { const m = K3.mark(b); K3.box(b, -5.2, 5.2, 0.25, 0.95, -0.04, 0.04, a.CHROME); K3.xf(b, m, i * PI / 3, 0, 0, 0, 0, 0); } return (reelMesh = b.mesh()); }
  function draw(R, b, vx, vy, vz, ctx) {
    const md = model(b.key), t = G.t, front = !!b.front, col = TEX3.hexRGB(b.def.cor);
    TINT[0] = col[0] / 255 * 1.35; TINT[1] = col[1] / 255 * 1.35; TINT[2] = col[2] / 255 * 1.35;
    // a face voltada para a câmera fica na distância do chefe (onde o jogo mede os tiros)
    const yaw = front ? PI : 0, f = Z3D.fwd(R, yaw, ctx.slope(Math.min(vz, ctx.maxD - 1))), half = md.L / 2;
    const cz = vz + half, bounce = md.fx.bounce ? Math.abs(Math.sin(t * 5)) * 0.18 : 0;
    const M = R.place(MT, vx, vy + bounce, cz, f[0], f[1], 1);
    const flash = b.parts.some(p => p.flash > 0) ? 0.15 : 0;
    for (const p of md.parts) R.model(p.mesh, p.tex, M, { t1: TINT, spec: 0.35, flash });
    const wm = V3D.wheelMesh()[0];
    for (const w of md.wheels) { const W = M4.mul(MQ, M, wheelM(w.x, w.y, w.z, w.r, w.w, P.z / w.r * (front ? 2 : 1))); R.model(wm.mesh, wm.tex, W, {}); }
    const wp = (x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
    // efeitos de cada chefe
    if (md.fx.fire) for (const q of md.fx.fire) { const p = wp(q[0], q[1], q[2]), fl = 1 + Math.sin(t * 13 + q[0] * 3) * 0.25; R.flame(p[0], p[1] + 0.9 * fl, p[2], 1.1 * fl, 1.5 * fl, 0.95); R.glow(p[0], p[1] + 0.6, p[2], 3.5, 2.5, 1, 0.45, 0.1, 0.35); }
    if (md.fx.reel) { const r = md.fx.reel, Mr = M4.mul(MP, M, rotX(r[0], r[1] + 0.5, r[2], t * 6)); R.model(reel(), T(), Mr, { t1: TINT }); }
    if (md.fx.smoke) { const p = wp(md.fx.smoke[0], md.fx.smoke[1], md.fx.smoke[2]); R.flame(p[0], p[1] + 0.4, p[2], 0.6, 0.8 + Math.sin(t * 25) * 0.15, 0.9); }
    if (md.fx.arm) { const a = Math.sin(t * 2) * 0.4, Ma = M4.mul(MP, M, rotX(0, 2.4, front ? 1.6 : -1.6, -0.55 + a, front ? 0 : PI)); R.model(arm(), T(), Ma, { t1: TINT, spec: 0.3 }); }
    if (md.fx.colonel) V3D.human(R, M, md.fx.colonel[0], md.fx.colonel[1], md.fx.colonel[2], 'atira', 0.4, t);
    if (md.fx.lights) { const on = b.parts.some(p => !p.dead); for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { if (!on || Math.sin(t * 9 + x + y) < -0.5) continue; const p = wp(-1.5 + x * 0.43, 2.0 + y * 0.5, front ? half + 0.05 : -half - 0.05); const c = (x + y) % 3; R.glow(p[0], p[1], p[2], 0.35, 0.35, c === 0 ? 1 : 0.6, c === 1 ? 1 : 0.5, c === 2 ? 1 : 0.4, 0.9); } }
    if (R.L.night || G.clima !== 'limpo') { for (const s of [-1, 1]) { const p = wp(s * 1.0, 1.1, front ? half + 0.1 : -half - 0.1); R.glow(p[0], p[1], p[2], front ? 1.4 : 0.6, front ? 0.8 : 0.35, 1, front ? 0.95 : 0.15, front ? 0.75 : 0.08, R.L.night ? 0.9 : 0.4); } }
    // pontos fracos: caixas acesas na face visível, piscando quando vulneráveis
    const falc = G.abil.on > 0 && S.cls === 'falcao', zFace = front ? half + 0.06 : -half - 0.06;
    for (const p of b.parts) {
      if (p.id === 'cabo' && !p.vuln) continue; if (b.key === 'reidograu' && front) continue;
      const lx = front ? -p.ox : p.ox, c = p.dead ? [0.04, 0.04, 0.04] : p.flash > 0 ? [1, 1, 1] : TEX3.hexRGB(p.cor || '#c22').map(v => v / 255);
      PC[0] = c[0]; PC[1] = c[1]; PC[2] = c[2];
      const Mp = M4.mul(MP, M, partM(lx, p.oy, zFace, p.w, p.h, 0.12));
      R.model(pbox(), T(), Mp, { t1: PC, glow: p.dead ? 0 : 0.75 });
      if (p.vuln && !p.dead) { const q = wp(lx, p.oy + p.h / 2, zFace), on = falc || Math.sin(t * 8) > 0; R.glow(q[0], q[1], q[2], p.w * 0.9 + 0.3, p.h * 0.9 + 0.3, 1, on ? 0.15 : 0.8, on ? 0.1 : 0.15, 0.55); }
    }
    R.blob(vx, vy, cz, 2.0, half * 1.05, 0.55);
  }
  const WM = M4.make(), PM = M4.make(), RXM = M4.make();
  function wheelM(x, y, z, r, w, ang) { const c = Math.cos(ang), s = Math.sin(ang); WM.fill(0); WM[15] = 1; WM[0] = w; WM[5] = c * r; WM[6] = s * r; WM[9] = -s * r; WM[10] = c * r; WM[12] = x; WM[13] = y; WM[14] = z; return WM; }
  function partM(x, y, z, w, h, d) { PM.fill(0); PM[15] = 1; PM[0] = w; PM[5] = h; PM[10] = d; PM[12] = x; PM[13] = y; PM[14] = z; return PM; }
  function rotX(x, y, z, ang, yaw) { const c = Math.cos(ang), s = Math.sin(ang), cy = Math.cos(yaw || 0), sy = Math.sin(yaw || 0); RXM.fill(0); RXM[15] = 1; RXM[0] = cy; RXM[2] = -sy; RXM[4] = sy * s; RXM[5] = c; RXM[6] = cy * s; RXM[8] = sy * c; RXM[9] = -s; RXM[10] = cy * c; RXM[12] = x; RXM[13] = y; RXM[14] = z; return RXM; }
  return { draw, model };
})();
