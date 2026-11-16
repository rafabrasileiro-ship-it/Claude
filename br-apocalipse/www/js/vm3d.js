'use strict';
/* 1ª pessoa do Artilheiro em 3D: a arma nas mãos (ou montada na torreta), os braços e o próprio carro ao lado.
   A arma aponta para a mira e, na mira de ferro, a alça e a massa ficam exatamente sobre o ponto de mira.
   Física (molas com amortecimento): coice do tiro, cano subindo e torcendo, balanço com curvas/freadas/buracos,
   atraso ao virar a mira, respiração, troca de arma, recarga com o carregador caindo, armas brancas com golpe e
   motosserra vibrando. Cápsulas voam e caem; o clarão do tiro acende uma luz que ilumina mãos, carro e zumbis. */
const VM3D = (() => {
  const M4 = GL3.M4, v3 = ARMS3D.v3, PI = Math.PI;
  const clampN = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, ss = (t) => { t = clampN(t, 0, 1); return t * t * (3 - 2 * t); };
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  /* ---------- matrizes ---------- */
  function frame(o, X, Y, Z, P) { o[0] = X[0]; o[1] = X[1]; o[2] = X[2]; o[3] = 0; o[4] = Y[0]; o[5] = Y[1]; o[6] = Y[2]; o[7] = 0; o[8] = Z[0]; o[9] = Z[1]; o[10] = Z[2]; o[11] = 0; o[12] = P[0]; o[13] = P[1]; o[14] = P[2]; o[15] = 1; return o; }
  function aimBasis(f, u) { let X = v3.cross(u, f); if (v3.len(X) < 1e-4) X = [1, 0, 0]; X = v3.norm(X); return [X, v3.cross(f, X), f]; }
  function rotM(o, rx, ry, rz) { const m = Z3D.rot(rx, ry, rz); o[0] = m[0]; o[1] = m[3]; o[2] = m[6]; o[3] = 0; o[4] = m[1]; o[5] = m[4]; o[6] = m[7]; o[7] = 0; o[8] = m[2]; o[9] = m[5]; o[10] = m[8]; o[11] = 0; o[12] = o[13] = o[14] = 0; o[15] = 1; return o; }
  const xp = (M, p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]];
  const xd = (M, d) => [M[0] * d[0] + M[4] * d[1] + M[8] * d[2], M[1] * d[0] + M[5] * d[1] + M[9] * d[2], M[2] * d[0] + M[6] * d[1] + M[10] * d[2]];
  function mirror(M) { M[0] = -M[0]; M[4] = -M[4]; M[8] = -M[8]; M[12] = -M[12]; return M; }
  const MG = M4.make(), MR = M4.make(), MT = M4.make(), MP = M4.make(), MQ = M4.make(), MB = M4.make(), MW = M4.make(), MX = M4.make();

  /* ---------- estado da física ---------- */
  const ST = {
    t: -1, p: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0],   // deslocamento/rotação da arma (m, rad) e velocidades
    yaw: 0, pit: 0, vyaw: 0, vpit: 0, init: false,                   // direção da arma (atrasada em relação à mira)
    cur: null, swap: 0, shots: -1, slide: 0, ham: 0, cyl: 0, cylT: 0, brl: 0, belt: 0, chain: 0, relTot: 0, relDrop: false, pumpEj: false, shellsDumped: false,
    flash: 0, flashRot: 0, muzzle: null, sx: 0, sy: 0, mir: false, light: null, lastMelee: 0, swingPrev: 0,
  };
  const shells = [];
  const SEATZ = [null, [-0.55, -0.55, -1.45], [-0.6, -0.6, -0.4], [-0.3, -1.6, -1.5], [-0.5, -0.5, -0.8], [-1.0, -1.0, -0.5]];
  function spring1(x, v, w, z, f, dt) { const a = f - w * w * x - 2 * z * w * v; v += a * dt; return [x + v * dt, v]; }
  const cls3 = () => (typeof cls === 'function' && cls() ? cls().id : 'trovao');

  /* ---------- quadro: pose e física (antes do desenho, para o clarão já iluminar o mundo) ---------- */
  function update(v) {
    const now = G.t; let dt = now - ST.t; if (ST.t < 0 || dt < 0 || dt > 0.5) dt = 0; ST.t = now; dt = Math.min(dt, 0.05);
    ST.light = null; ST.ok = false;
    if (G.role !== 'gunner' || !A.exposed || A.down > 0) { ST.init = false; shells.length = 0; return null; }
    const F = v.F, CX = v.W / 2 + (v.pan || 0), CY = v.hor, cf = CARFX.S, look = A.look || 1;
    const melee = !!A.useMelee, w = WEAPONS[A.w], key = melee ? 'm:' + S.melee : 'w:' + A.w;
    const mdl = melee ? GUN3D.meleeModel(S.melee) : GUN3D.gunModel(A.w);
    if (!mdl) return null;
    const info = mdl.info, mount = !!info.mount, mass = info.mass || 1;
    // troca de arma: abaixa a velha e sobe a nova
    if (ST.cur !== key) { if (ST.cur) ST.swap = 1; ST.cur = key; ST.relTot = 0; }
    ST.swap = Math.max(0, ST.swap - dt / 0.42);
    // lado do carro: à direita do Artilheiro → arma na mão esquerda (espelha tudo)
    const side = A.seat === 0 ? 1 : A.seat === 1 ? -1 : 0, sd = side * look; ST.mir = !mount && sd > 0;
    // direção da mira (raio do olho pela mira na tela) — no espaço sem espelho
    let d = v3.norm([(A.ax - CX) / F, -(A.ay - CY) / F, 1]); if (ST.mir) d[0] = -d[0];
    const tyaw = Math.atan2(d[0], d[2]), tpit = Math.atan2(d[1], Math.hypot(d[0], d[2])), ads = mount ? 0 : clampN(A.ads, 0, 1);
    if (!ST.init) { ST.yaw = tyaw; ST.pit = tpit; ST.vyaw = ST.vpit = 0; ST.init = true; ST.p = [0, 0, 0]; ST.v = [0, 0, 0]; ST.r = [0, 0, 0]; ST.w = [0, 0, 0]; ST.shots = G.stats.shots; }
    const wa = (mount ? 11 : 16 + ads * 22) / Math.sqrt(mass), za = 0.72 + ads * 0.2;
    let q = spring1(ST.yaw - tyaw, ST.vyaw, wa, za, 0, dt); ST.yaw = tyaw + q[0]; ST.vyaw = q[1];
    q = spring1(ST.pit - tpit, ST.vpit, wa, za, 0, dt); ST.pit = tpit + q[0]; ST.vpit = q[1];
    const dl = [Math.sin(ST.yaw) * Math.cos(ST.pit), Math.sin(ST.pit), Math.cos(ST.yaw) * Math.cos(ST.pit)];
    // tiros deste quadro (o contador do jogo sobe a cada disparo)
    const nShots = melee ? 0 : Math.max(0, Math.min(4, G.stats.shots - ST.shots)); ST.shots = G.stats.shots;
    const kick = (info.kick || 1) * (A.ads > 0.5 && cls3() === 'falcao' ? 0.55 : 1) * (A.ads > 0.5 ? 0.8 : 1);
    for (let i = 0; i < nShots; i++) {
      const rr = Math.random, mk = mount ? 0.35 : 1;
      ST.v[2] -= kick * 1.1 * mk / Math.sqrt(mass); ST.w[0] -= kick * 7.5 * mk / Math.sqrt(mass); ST.w[1] += (rr() - 0.5) * kick * 2.2 * mk; ST.w[2] += (rr() - 0.35) * kick * (info.roll || 0.1) * 34 * mk; ST.v[1] += kick * 0.25 * mk;
      ST.slide = 1; ST.ham = 1; ST.brl = 1; ST.flash = 1; ST.flashRot = rr() * PI * 2; ST.flashS = 0.85 + rr() * 0.3;
      if (A.w === 'rev38' || A.w === 'mgl') ST.cylT += PI / 3;
      if (info.beltStep) ST.belt += info.beltStep;
      if (info.shell && !info.ejectOnPump) spawnShell(info, 1);
    }
    ST.slide = Math.max(0, ST.slide - dt / 0.07); ST.ham = Math.max(0, ST.ham - dt / 0.3); ST.brl = Math.max(0, ST.brl - dt / 0.16); ST.flash = Math.max(0, ST.flash - dt / 0.06);
    ST.cyl += (ST.cylT - ST.cyl) * Math.min(1, dt * 22);
    // molas da arma: coice e balanço com o carro (a arma "fica para trás" quando o carro acelera/vira)
    const kp = (mount ? 30 : 21) / Math.sqrt(mass) * (1 + ads * 0.35), kr = (mount ? 26 : 17) / Math.sqrt(mass) * (1 + ads * 0.3), zp = 0.58, zr = 0.52, sway = (1 - ads * 0.65) * (mount ? 0.35 : 1);
    const fx = -cf.alat * 0.011 * look * sway / mass, fz = -cf.alon * 0.008 * look * sway / mass, fy = cf.avert * 0.012 * sway;
    if (cf.jolt > 0) { ST.v[1] += cf.jolt * 0.18 * sway; ST.w[0] += (Math.random() - 0.5) * cf.jolt * 1.2 * sway; ST.w[2] += (Math.random() - 0.5) * cf.jolt * 0.9 * sway; }
    for (let i = 0; i < 3; i++) { const f = i === 0 ? fx * kp * kp * 0.02 : i === 1 ? fy * kp * kp * 0.02 : fz * kp * kp * 0.02; q = spring1(ST.p[i], ST.v[i], kp, zp, f, dt); ST.p[i] = q[0]; ST.v[i] = q[1]; q = spring1(ST.r[i], ST.w[i], kr, zr, i === 2 ? -cf.alat * 0.02 * look * sway * kr * kr * 0.02 : 0, dt); ST.r[i] = q[0]; ST.w[i] = q[1]; }
    for (let i = 0; i < 3; i++) { ST.p[i] = clampN(ST.p[i], -0.12, 0.12); ST.r[i] = clampN(ST.r[i], -0.6, 0.6); }
    // pose base: quadril ↔ mira de ferro; montada: pivô fixo no carro
    const tt = now, breath = (1 - ads * 0.75) * (mount ? 0.3 : 1);
    const bob = [Math.sin(tt * 0.9) * 0.0035 * breath + cf.vibX * 1.5, Math.sin(tt * 1.4) * 0.0045 * breath + cf.vibY * 2, 0];
    let Mg, G0;
    const aimPt = v3.mul(dl, 30);
    if (mount) {
      const piv = [0, -0.2 - ss(A.ads) * 0.07, 0.86], f = v3.norm(v3.sub(aimPt, piv)), B = aimBasis(f, [0, 1, 0]);   // o atirador olha por cima da caixa da arma
      G0 = v3.add(piv, v3.add(ST.p, bob)); Mg = frame(MG, B[0], B[1], B[2], G0);
    } else if (melee) {
      Mg = meleePose(mdl, info, dl, bob, dt);
    } else {
      const hip = info.hip || [0.14, -0.2, 0.3], zoom = 1 + A.ads * 0.6;
      // quadril: a arma converge para o ponto mirado
      const Gh = v3.add(hip, [0, 0, 0]), fh = v3.norm(v3.sub(aimPt, v3.add(Gh, [0, info.bore || 0.05, 0]))), Bh = aimBasis(fh, [0, 1, 0]);
      // mira de ferro: a linha alça→massa sobre o raio do olho
      const rear = info.rear, front = info.front, sa = Math.atan2(front[0] - rear[0], front[1] - rear[1]);
      const Ba = aimBasis(dl, [0, 1, 0]); rotM(MR, -sa, 0, 0); frame(MT, Ba[0], Ba[1], Ba[2], [0, 0, 0]); M4.mul(MT, MT, MR);
      const rs = v3.mul(dl, (info.ads || 0.2) * zoom), Ga = v3.sub(rs, xd(MT, [0, rear[0], rear[1]]));
      const t = ss(ads), f = v3.norm(lerp3(fh, xd(MT, [0, 0, 1]), t)), up = lerp3(Bh[1], xd(MT, [0, 1, 0]), t), B = aimBasis(f, up);
      G0 = v3.add(lerp3(Gh, Ga, t), v3.add(ST.p, bob));
      Mg = frame(MG, B[0], B[1], B[2], G0);
    }
    // recarga e troca: deslocamentos por cima da pose
    let rel = 0;
    if (!melee && A.reloadT > 0) { if (ST.relTot < A.reloadT) { ST.relTot = A.reloadT; ST.relDrop = false; ST.shellsDumped = false; } rel = 1 - A.reloadT / Math.max(0.01, ST.relTot); } else ST.relTot = 0;
    ST.rel = rel;
    const rb = rel > 0 ? Math.sin(PI * ss(rel / 0.18) * 0.5) * (1 - ss((rel - 0.82) / 0.18)) : 0;
    const swapOff = ST.swap > 0 ? (ST.swap > 0.5 ? (1 - ST.swap) * 2 : ST.swap * 2) : 0;   // 0 → 1 (embaixo) → 0
    rotM(MR, ST.r[0] + rb * (mount ? 0.05 : 0.22) + swapOff * 0.9, ST.r[1] + rb * (mount ? 0 : -0.25), ST.r[2] + rb * (mount ? 0 : 0.6));
    M4.mul(MG, Mg, MR);
    if (rb || swapOff) { const off = xd(MG, [0, 0, 0]); void off; MG[12] += rb * (mount ? 0 : -0.05); MG[13] += -rb * (mount ? 0.02 : 0.06) - swapOff * 0.34; MG[14] += -rb * 0.04; }
    // cápsulas e carregadores
    if (info.ejectOnPump) { const pp = pumpPos(); if (pp > 0.75 && !ST.pumpEj) { ST.pumpEj = true; spawnShell(info, 1); } if (pp < 0.2) ST.pumpEj = false; }
    if (rel > 0.22 && !ST.relDrop && !melee) { ST.relDrop = true; if (A.w === 'rev38') for (let i = 0; i < 6; i++) spawnShell(info, 0.4, 'brass'); else if (mdl.parts.some(p => p.name === 'mag')) spawnMag(mdl); }
    updShells(dt);
    // clarão: luz pontual na boca do cano
    const muz = xp(MG, [0, info.bore || 0.05, info.muzzle || 0.5]);
    if (ST.mir) muz[0] = -muz[0];
    ST.muzzle = muz; ST.sx = CX + F * muz[0] / Math.max(0.05, muz[2]); ST.sy = CY - F * muz[1] / Math.max(0.05, muz[2]);
    G.muzzle = [ST.sx, ST.sy]; G.muzzleF = G.frame;
    if (ST.flash > 0 && !melee) { const k = (info.fl || clampN((info.kick || 1) * 1.6, 0.8, 3)) * ST.flash; ST.light = { p: [muz[0], muz[1], muz[2] + 0.1, 2.2 * k], c: [1, 0.72, 0.38] }; }
    if (melee && (S.melee === 'serra' || S.melee === 'serraInd')) ST.chain -= dt * A.rev * 9;
    ST.info = info; ST.mdl = mdl; ST.ok = true;
    return ST.light;
  }
  const pumpPos = () => (A.w === 'cal12' ? Math.sin(PI * clampN((1 - A.pump - 0.12) / 0.88, 0, 1)) : 0);

  /* golpes das armas brancas: o progresso A.swing (0→1) vira um arco no espaço */
  function meleePose(mdl, info, dl, bob, dt) {
    const m = S.melee, sw = A.swing || 0, ph = sw;
    let P0, f, up;
    if (m === 'serra' || m === 'serraInd') {
      const rev = A.rev || 0, push = I.fire ? 0.06 : 0, vib = rev * (m === 'serraInd' ? 0.006 : 0.0045);
      // motosserra baixa, à direita e um pouco deitada: o sabre aparece inteiro, apontando para a mira
      P0 = [0.17 + Math.sin(G.t * 71) * vib, -0.31 + Math.sin(G.t * 83 + 1) * vib, 0.27 + push];
      f = v3.norm(lerp3(dl, [-0.22, 0.32, 1], 0.45)); up = v3.norm([0.4, 1, 0]);
    } else if (m === 'lanca') {
      const th = ph < 0.3 ? ss(ph / 0.3) : 1 - ss((ph - 0.3) / 0.7);
      P0 = [0.13, -0.2, 0.16 + th * 0.42]; f = v3.norm(lerp3(dl, [-0.05, 0.08, 1], 0.3)); up = [0, 1, 0];
    } else {
      // facão e porrete: repouso com a lâmina para cima; golpe em arco da direita alta para a esquerda baixa
      const wind = ph < 0.15 ? ss(ph / 0.15) : 0, strike = ph >= 0.15 && ph < 0.55 ? ss((ph - 0.15) / 0.4) : ph >= 0.55 ? 1 : 0, rec = ph >= 0.55 ? ss((ph - 0.55) / 0.45) : 0;
      const rest = { p: [0.17, -0.13, 0.36], f: [-0.12, 0.85, 0.5] }, back = { p: [0.21, -0.02, 0.3], f: [0.25, 0.86, -0.3] }, hit = { p: [-0.15, -0.25, 0.48], f: [-0.75, -0.45, 0.48] };
      let a = rest, b = rest, t = 0;
      if (ph <= 0) { a = rest; b = rest; t = 0; } else if (ph < 0.15) { a = rest; b = back; t = wind; } else if (ph < 0.55) { a = back; b = hit; t = strike; } else { a = hit; b = rest; t = rec; }
      P0 = lerp3(a.p, b.p, t); f = v3.norm(lerp3(a.f, b.f, t)); up = v3.norm([0.6, 0.2, -0.75]);
      if (m === 'porrete') { P0 = v3.add(P0, [0, 0.02, 0]); }
    }
    const B = aimBasis(f, up); return frame(MG, B[0], B[1], B[2], v3.add(P0, v3.add(ST.p, bob)));
  }

  /* ---------- cápsulas ---------- */
  function spawnShell(info, k, type) {
    if (shells.length > 26) shells.shift();
    const e = info.eject || [0.02, 0.05, 0.04], p = xp(MG, e), r = Math.random;
    const dir = info.ejDown ? xd(MG, [0.15 * (r() - 0.5), -1.1, -0.1]) : xd(MG, [1.5 + r() * 0.6, 1.1 + r() * 0.7, -0.4 + r() * 0.3]);
    shells.push({ p, v: v3.mul(dir, k || 1), rx: r() * 6, ry: r() * 6, wx: (r() - 0.5) * 40, wy: (r() - 0.5) * 30, t: 0, type: type || info.shell || 'brass', mir: ST.mir });
  }
  function spawnMag(mdl) { const mp = mdl.parts.find(p => p.name === 'mag'); if (!mp) return; shells.push({ p: [MG[12], MG[13], MG[14]], v: [0.05, -0.6, 0.05], rx: 0, ry: 0, wx: 2, wy: 1.5, t: 0, type: 'mag', mesh: mp.mesh, M: Float32Array.from(MG), mir: ST.mir }); if (shells.length > 26) shells.shift(); }
  function updShells(dt) {
    const wind = Math.min(30, Math.abs(P.speed)) * 0.9 * (A.look || 1);
    for (const s of shells) { s.t += dt; s.v[1] -= 9.8 * dt; s.v[2] -= wind * dt; for (let i = 0; i < 3; i++) s.p[i] += s.v[i] * dt; s.rx += s.wx * dt; s.ry += s.wy * dt; }
    for (let i = shells.length - 1; i >= 0; i--) if (shells[i].t > 1.4 || shells[i].p[1] < -2.5 || shells[i].p[2] < -1) shells.splice(i, 1);
  }

  /* ---------- desenho (passada de primeiro plano) ---------- */
  const TINT = new Float32Array(3);
  function draw(R, c) {
    gunnerCar(R, c);
    if (!ST.ok) return;
    const info = ST.info, mdl = ST.mdl, T = GUN3D.tex(), clsId = cls3(), heat = A.heat || 0, mir = ST.mir;
    // peças da arma
    for (const p of mdl.parts) {
      let M = MG;
      if (p.name !== 'st') {
        M4.ident(MP); MP[12] = p.piv[0]; MP[13] = p.piv[1]; MP[14] = p.piv[2];
        if (p.name === 'slide') MP[14] -= ST.slide * 0.034;
        else if (p.name === 'pump') MP[14] -= pumpPos() * 0.075;
        else if (p.name === 'barrel') MP[14] -= ST.brl * (info.recoilZ || 0.04);
        else if (p.name === 'hammer') { rotM(MQ, -0.55 * (1 - ST.ham), 0, 0); M4.mul(MP, MP, MQ); }
        else if (p.name === 'cyl') { const out = A.w === 'rev38' ? ss((ST.rel - 0.08) / 0.15) * (1 - ss((ST.rel - 0.78) / 0.12)) : 0; MP[12] -= out * 0.035; MP[13] -= out * 0.01; rotM(MQ, 0, 0, ST.cyl + out * 0.9); M4.mul(MP, MP, MQ); }
        else if (p.name === 'mag') { const r = ST.rel; const off = r > 0.15 && r < 0.72 ? (r < 0.35 ? ss((r - 0.15) / 0.2) : r < 0.5 ? 1 : 1 - ss((r - 0.5) / 0.22)) : 0; if (r > 0.22 && r < 0.5) continue; MP[13] -= off * 0.22; }
        else if (p.name === 'hot') { if (heat < 0.08) continue; M = M4.mul(MW, MG, MP); if (mir) mirror(M); TINT[0] = heat; TINT[1] = heat * 0.55; TINT[2] = heat * 0.25; R.model(p.mesh, T, M, { add: true, glow: 1, t1: TINT }); continue; }
        M = M4.mul(MW, MG, MP);
      } else M = M4.mul(MW, MG, M4.ident(MP));
      if (mir) mirror(M);
      const o = { glow: 0, spec: 0.35 };
      if (p.name === 'belt') o.uv = [ST.belt * (GUN3D.A.BELT[2] - GUN3D.A.BELT[0]), 0];
      if (p.name === 'chain') o.uv = [ST.chain * 0.05, 0];
      R.model(p.mesh, T, M, o);
    }
    // braços
    drawArms(R, clsId, info);
    // cápsulas e carregadores caindo
    const sm = GUN3D.shellMeshes();
    for (const s of shells) {
      rotM(MQ, s.rx, s.ry, 0); M4.ident(MP); MP[12] = s.p[0]; MP[13] = s.p[1]; MP[14] = s.p[2];
      let M;
      if (s.type === 'mag') { M = M4.mul(MW, MP, MQ); MW[12] = s.p[0]; MW[13] = s.p[1]; MW[14] = s.p[2]; const B = s.M; for (let i = 0; i < 12; i++) MX[i] = B[i]; MX[12] = s.p[0]; MX[13] = s.p[1]; MX[14] = s.p[2]; MX[15] = 1; M = MX; if (s.mir) mirror(M = Float32Array.from(M)); R.model(s.mesh, T, M, { glow: 0, spec: 0.3 }); continue; }
      M = M4.mul(MW, MP, MQ); if (s.mir) mirror(M);
      R.model(sm[s.type] || sm.brass, sm.tex, M, { glow: 0, spec: 0.7 });
    }
    // clarão
    if (ST.flash > 0 && !A.useMelee) flash(R, info, mir);
  }
  function drawArms(R, clsId, info) {
    const mir = ST.mir, gr = info.gr || { p: [0, 0, 0], ax: [0, -0.96, -0.27], pn: [-1, 0, 0.12], r: 0.016 };
    const hand = (g, mov) => {
      let p = g.p; if (mov === 'pump') p = [p[0], p[1], p[2] - pumpPos() * 0.075];
      const P = xp(MG, p), ax = v3.norm(xd(MG, g.ax)), pn0 = xd(MG, g.pn), hz = v3.norm(v3.sub(pn0, v3.mul(ax, v3.dot(pn0, ax)))), hy = v3.cross(hz, ax);
      return { P, hy, hz, r: g.r };
    };
    const shR = [0.19, -0.26, 0.0], shL = [-0.2, -0.27, 0.02];   // debruçado na janela: ombros um pouco à frente do olho
    const h = hand(gr);
    ARMS3D.draw(R, clsId, false, shR, h.P, h.hy, h.hz, [0.55, -1, -0.25], h.r, mir);
    let gl = info.gl, hl = null;
    if (gl) {
      hl = hand(gl, info.glMov);
      // recarga: a mão esquerda larga o guarda-mão e vai buscar munição embaixo da arma
      if (ST.rel > 0 && !A.useMelee) {
        const r = ST.rel, away = info.mount ? ss((r - 0.1) / 0.15) * (1 - ss((r - 0.8) / 0.15)) : ss((r - 0.06) / 0.12) * (1 - ss((r - 0.8) / 0.14));
        const low = xp(MG, info.mount ? [-0.3, 0.05, -0.15] : [0, -0.2 + 0.08 * Math.sin(r * PI * 6), 0.06]), tgt = info.mount ? low : (r > 0.5 && r < 0.75 ? xp(MG, [0, -0.06, 0.07]) : low);
        hl.P = lerp3(hl.P, tgt, away);
      }
      ARMS3D.draw(R, clsId, true, shL, hl.P, hl.hy, hl.hz, [-0.55, -1, -0.25], hl.r, mir);
    } else if (!A.useMelee || (S.melee !== 'facao' && S.melee !== 'porrete')) {
      // sem empunhadura para a esquerda: mão apoiada embaixo
    } else {
      // facão/porrete: a mão esquerda fica relaxada, fora da linha do golpe
      const P = [-0.2, -0.36, 0.3], hz = [0.3, 1, 0.1], hy = v3.norm([0.3, 0.1, 1]);
      ARMS3D.draw(R, clsId, true, shL, P, hy, v3.norm(hz), [-0.55, -1, -0.3], 0.02, mir);
    }
  }
  let starM = null, flameM = null;
  function flashMeshes() {
    if (starM) return; const A2 = GUN3D.A;
    let b = new GL3.Builder(); K3.quad(b, [-0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], [0, 0, -1], A2.FLASH, false); starM = b.mesh();
    b = new GL3.Builder(); K3.quad(b, [0, -0.5, 0], [0, 0.5, 0], [0, 0.5, 1], [0, -0.5, 1], [1, 0, 0], [A2.FLAME[0], A2.FLAME[1], A2.FLAME[2], A2.FLAME[3]], false); K3.quad(b, [-0.5, 0, 0], [0.5, 0, 0], [0.5, 0, 1], [-0.5, 0, 1], [0, 1, 0], A2.FLAME, false); flameM = b.mesh();
  }
  function flash(R, info, mir) {
    flashMeshes(); const T = GUN3D.tex(), k = clampN((info.kick || 1), 0.6, 2.4) * (ST.flashS || 1), a = ST.flash;
    const mz = xp(MG, [0, info.bore || 0.05, (info.muzzle || 0.5) + 0.01]), size = (0.1 + k * 0.08) * (0.65 + a * 0.35);
    // estrela de frente (virada para a câmera)
    rotM(MQ, 0, 0, ST.flashRot); for (let i = 0; i < 16; i++) MP[i] = MQ[i]; MP[0] *= size; MP[1] *= size; MP[4] *= size; MP[5] *= size; MP[12] = mz[0]; MP[13] = mz[1]; MP[14] = mz[2];
    if (mir) mirror(MP);
    TINT[0] = TINT[1] = TINT[2] = a; R.model(starM, T, MP, { add: true, glow: 1, t1: TINT });
    // chamas laterais ao longo do cano
    M4.ident(MQ); MQ[0] = size * 0.9; MQ[5] = size * 0.9; MQ[10] = size * (1.6 + k * 0.6); MQ[14] = (info.muzzle || 0.5) + 0.005; MQ[13] = info.bore || 0.05;
    rotM(MR, 0, 0, ST.flashRot * 0.3); M4.mul(MQ, MQ, MR);
    const M = M4.mul(MW, MG, MQ); if (mir) mirror(M); R.model(flameM, T, M, { add: true, glow: 1, t1: TINT });
    R.glow(mir ? -mz[0] : mz[0], mz[1], mz[2], size * 2.2, size * 2.2, 1, 0.75, 0.4, 0.55 * a);
  }

  /* ---------- o carro ao lado do Artilheiro (lataria 3D com a física da suspensão) ---------- */
  const CT = new Float32Array(3);
  // olho do Artilheiro no espaço do carro: debruçado para fora da janela (ou de pé no teto/caçamba)
  function seatEye(md) {
    const veh = S.veh, seat = A.seat, z = (SEATZ[veh] || SEATZ[1])[seat], sx = seat === 0 ? -1 : seat === 1 ? 1 : 0, hw = (md && md.hw) || G.V.w * 0.8;
    return [sx * (hw + 0.62), [0, 1.25, 1.3, 1.6, 2.1, 2.7][veh] + (seat === 2 ? 0.8 : 0.32), z];
  }
  function gunnerCar(R, c) {
    if (G.role !== 'gunner' || typeof V3D === 'undefined') return;
    const sv = S, veh = sv.veh, md = V3D.playerModel(veh, sv.up, A.seat === 2 && veh >= 4), E = seatEye(md), fs = c.fs, dir = c.dir, look = A.look || 1;
    M4.ident(MB); MB[0] = fs; MB[10] = dir; MB[12] = -fs * E[0]; MB[13] = -E[1]; MB[14] = -dir * E[2];
    const M = M4.mul(MX, MB, CARFX.bodyM(MP, 1, md.mid || 0));
    const col = TEX3.hexRGB(VEHICLES[veh].cor); CT[0] = col[0] / 255 * 1.2; CT[1] = col[1] / 255 * 1.2; CT[2] = col[2] / 255 * 1.2;
    for (const p of md.parts) R.model(p.mesh, p.tex, M, { t1: CT, spec: 0.5 });
    if (typeof V3D.drawCapo === 'function') V3D.drawCapo(R, M, md);
    // rodas no chão (a carroceria balança por cima delas)
    const wm = V3D.wheelMesh()[0], spin = P.z;
    for (const w of md.wheels) { const r = w[3]; const cA = Math.cos(spin / r), sA = Math.sin(spin / r); M4.ident(MW); MW[0] = w[4]; MW[5] = cA * r; MW[6] = sA * r; MW[9] = -sA * r; MW[10] = cA * r; MW[12] = w[0]; MW[13] = w[1]; MW[14] = w[2]; R.model(wm.mesh, wm.tex, M4.mul(MQ, MB, MW), {}); }
    // seteira / chapas com frestas: moldura de aço presa ao carro em volta da vista
    if ((veh === 4 && A.seat !== 2) || (sv.up.janela >= 2 && A.seat !== 2)) plateFrame(R, c, M);
    void look;
  }
  let plateM = null;
  function plateFrame(R, c, Mcar) {
    if (!plateM) { const b = new GL3.Builder(), Av = V3D.A, z = 0.36; for (const [x0, x1, y0, y1] of [[-3, 3, 0.16, 2], [-3, 3, -2, -0.16], [-3, -0.42, -0.2, 0.2], [0.42, 3, -0.2, 0.2]]) K3.box(b, x0, x1, y0, y1, z, z + 0.012, Av.PLATE); for (const [x0, x1] of [[-0.44, -0.4], [0.4, 0.44]]) K3.box(b, x0, x1, -0.18, 0.18, z - 0.02, z, Av.METAL); plateM = b.mesh(); }
    // a moldura fica parada na tela (como o rosto colado na seteira) e só balança com a carroceria
    const F = c.F, k = 0.36 / F, cx = c.cx, cy = c.cy, sx = (c.W / 2 - cx) * k, sy = (cy - c.H * 0.47) * k;
    M4.ident(MQ); MQ[0] = c.W * 0.5 * k / 0.42 * 0.95; MQ[5] = c.H * 0.36 * k / 0.16; MQ[12] = sx; MQ[13] = sy;
    const cf = CARFX.S; MQ[13] += cf.heave * 0.4; rotM(MR, cf.pitch * 0.6, 0, cf.roll * (A.look || 1) * 0.8); M4.mul(MQ, MQ, MR);
    R.model(plateM, V3D.tex(), MQ, { glow: 0, spec: 0.2 });
    void Mcar;
  }
  return { update, draw, get muzzle() { return ST.muzzle; }, get state() { return ST; }, shells };
})();
