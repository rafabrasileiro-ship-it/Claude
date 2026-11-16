'use strict';
/* Animação dos zumbis 3D: esqueleto posto a cada quadro por regras de cada tipo, viradas suaves, tropeços, botes,
   reação a tiro, mortes (queda, atropelamento voando, cabeça explodindo), cadáveres com poça de sangue e o boi infectado. */
(() => {
  const Z = Z3D, M4 = GL3.M4, PI = Math.PI, TAU = PI * 2, HB = Z.HB, clampv = Z.clampv, lerp = Z.lerp, hsh = Z.hsh;
  const sm = (t) => t * t * (3 - 2 * t);

  /* ---------- matrizes dos ossos (3×4 por linhas, direto no formato do shader) ---------- */
  const BONES = new Float32Array(16 * 12);
  function compose(out, o, p, ox, oy, oz, ax, ay, az, s) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
    const l0 = cb * cc * s, l1 = (-cb * sc * ca + sb * sa) * s, l2 = (cb * sc * sa + sb * ca) * s, l3 = sc * s, l4 = cc * ca * s, l5 = -cc * sa * s, l6 = -sb * cc * s, l7 = (sb * sc * ca + cb * sa) * s, l8 = (-sb * sc * sa + cb * ca) * s;
    if (p < 0) { out[o] = l0; out[o + 1] = l1; out[o + 2] = l2; out[o + 3] = ox; out[o + 4] = l3; out[o + 5] = l4; out[o + 6] = l5; out[o + 7] = oy; out[o + 8] = l6; out[o + 9] = l7; out[o + 10] = l8; out[o + 11] = oz; return; }
    for (let r = 0; r < 3; r++) {
      const a = out[p + r * 4], b = out[p + r * 4 + 1], c = out[p + r * 4 + 2];
      out[o + r * 4] = a * l0 + b * l3 + c * l6; out[o + r * 4 + 1] = a * l1 + b * l4 + c * l7; out[o + r * 4 + 2] = a * l2 + b * l5 + c * l8;
      out[o + r * 4 + 3] = a * ox + b * oy + c * oz + out[p + r * 4 + 3];
    }
  }
  // A = ângulos (3 por osso), S = escala por osso (opcional), root = [dx, dy, dz] somado ao osso 0
  function solve(skel, A, S, root) {
    for (let i = 0; i < skel.length; i++) { const q = skel[i]; compose(BONES, i * 12, q[0] < 0 ? -1 : q[0] * 12, q[1] + (i ? 0 : root[0]), q[2] + (i ? 0 : root[1]), q[3] + (i ? 0 : root[2]), A[i * 3], A[i * 3 + 1], A[i * 3 + 2], S ? S[i] : 1); }
    return BONES.subarray(0, skel.length * 12);
  }
  // posição de um osso no espaço do modelo (para cabeça explodindo, chamas, mãos)
  const bonePos = (i) => [BONES[i * 12 + 3], BONES[i * 12 + 7], BONES[i * 12 + 11]];

  /* ---------- estado de animação guardado no próprio inimigo ---------- */
  function st(e) {
    let r = e._r;
    if (!r) {
      const h = hsh(Math.abs(e.id | 0) + 0.31);
      r = e._r = { ph: h * TAU, x: e.x, z: e.z, lt: G.t, vx: 0, vz: 0, spd: 0, yaw: PI, hit: 0, fl: 0, lunge: 0, seed: h, twitch: 0, tw: 0, jaw: 0, A: new Float32Array(16 * 3), root: [0, 0, 0], tilt: 0, roll: 0, S: null };
    }
    return r;
  }
  function track(e, r) {
    const dt = clampv(G.t - r.lt, 0, 0.1); r.lt = G.t;
    if (dt <= 0) return 0;
    const jump = Math.abs(e.x - r.x) + Math.abs(e.z - r.z) > 4;
    if (jump) { r.x = e.x; r.z = e.z; r.vx = r.vz = 0; }
    const k = G.netClient ? Math.min(1, dt * 14) : 1, nx = r.x + (e.x - r.x) * k, nz = r.z + (e.z - r.z) * k;
    const vx = (nx - r.x) / dt, vz = (nz - r.z) / dt, a = Math.min(1, dt * 6);
    r.vx += (vx - r.vx) * a; r.vz += (vz - r.vz) * a; r.x = nx; r.z = nz;
    r.spd = Math.hypot(r.vx, r.vz);
    if (e.flash > 0.06 && r.fl <= 0) { r.hit = 1; r.hitDir = (hsh(G.t * 7.1 + e.id) - 0.5); }   // tiro: tranco
    r.fl = e.flash || 0; r.hit = Math.max(0, r.hit - dt * 3.2);
    return dt;
  }

  /* ---------- poses por tipo ---------- */
  function pose(e, r, dt, A) {
    A.fill(0);
    const id = Math.abs(e.id | 0), t = G.t, h1 = hsh(id * 1.7), h2 = hsh(id * 2.9 + 1), h3 = hsh(id * 4.3 + 2);
    const dz = e.z - P.z, dx = e.x - P.x, near = dz > 0 && dz < 16 && Math.abs(dx) < 4 && P.speed > 3;
    r.lunge += ((near ? 1 : 0) - r.lunge) * Math.min(1, dt * 4);
    let sp = r.spd, root = r.root; root[0] = root[1] = root[2] = 0; r.tilt = 0; r.roll = 0;
    const set = (b, x, y, z) => { A[b * 3] = x; A[b * 3 + 1] = y; A[b * 3 + 2] = z; };
    const add = (b, x, y, z) => { A[b * 3] += x; A[b * 3 + 1] += y; A[b * 3 + 2] += z; };
    // pernas: passada (positivo = joelho dobra para trás); amp/knee em rad
    const legs = (ph, amp, knee, base) => {
      for (const [th, sh, o] of [[HB.TA, HB.SA, 0], [HB.TB, HB.SB, PI]]) { const p = ph + o; set(th, -amp * Math.sin(p) - (base || 0), 0, 0); set(sh, knee * Math.max(0, Math.sin(p + 1.25)) + 0.06 + (base || 0) * 1.6, 0, 0); }
    };
    const jaw = (v) => { r.jaw += (v - r.jaw) * Math.min(1, dt * 8); set(HB.JAW, r.jaw, 0, 0); };
    // espasmo de cabeça de tempos em tempos (vivo-morto)
    r.tw -= dt; if (r.tw <= 0) { r.tw = 0.6 + hsh(t * 3.3 + id) * 3.5; r.twitch = 1; } r.twitch = Math.max(0, r.twitch - dt * 5);
    const tw = r.twitch * Math.sin(t * 60) * 0.25;
    const type = e.type;

    if (e.st === 'latch') { latchPose(e, r, A, set, jaw); return; }
    if ((type === 'corredor' && sp > 0.9) || (type === 'cangaceiro' && sp > 2.2) || (type === 'engolidor' && sp > 2)) {
      // corrida desengonçada, tronco projetado, braços se debatendo para a frente
      const f = clampv(sp / 5, 0.55, 1.3); r.ph += dt * TAU * (1.6 + 0.9 * f); const ph = r.ph;
      legs(ph, 0.62 * f + 0.1, 1.35 * f, 0.08);
      set(HB.CHEST, 0.42 + 0.06 * Math.sin(ph * 2), 0.18 * Math.sin(ph), 0.05 * Math.sin(ph));
      set(HB.UA, -(1.05 + 0.65 * Math.sin(ph + PI)), 0, 0.2 + 0.15 * Math.sin(ph * 2)); set(HB.FA, -0.6 - 0.4 * Math.max(0, Math.sin(ph)), 0, 0);
      set(HB.UB, -(1.05 + 0.65 * Math.sin(ph)), 0, -0.2 - 0.15 * Math.sin(ph * 2)); set(HB.FB, -0.6 - 0.4 * Math.max(0, Math.sin(ph + PI)), 0, 0);
      set(HB.HEAD, -0.32 + tw, 0.1 * Math.sin(ph), (h1 - 0.5) * 0.3);
      root[1] = -0.05 + 0.07 * Math.abs(Math.sin(ph)); jaw(0.45 + 0.2 * Math.sin(t * 9));
    } else if (type === 'carrapato') {
      if (e.st === 'jump') {   // salto no para-brisa
        const u = clampv(e.t / 0.35, 0, 1); r.tilt = 1.25; root[1] = 0.4 + Math.sin(u * PI) * 0.9;
        set(HB.UA, -2.9, 0, 0.35); set(HB.UB, -2.9, 0, -0.35); set(HB.FA, -0.1, 0, 0); set(HB.FB, -0.1, 0, 0);
        set(HB.TA, 0.5, 0, 0.1); set(HB.TB, 0.6, 0, -0.1); set(HB.SA, 0.2, 0, 0); set(HB.SB, 0.3, 0, 0); set(HB.HEAD, -1.0, 0, 0); jaw(0.8);
      } else {   // de quatro, braços compridos puxando o corpo
        const f = clampv(sp / 1.5, 0.25, 1.4); r.ph += dt * TAU * (0.8 + 0.9 * f); const ph = r.ph;
        r.tilt = 1.12; root[1] = -0.38;
        set(HB.TA, -1.45 + 0.3 * Math.sin(ph), 0, 0.25); set(HB.SA, 1.9 - 0.3 * Math.max(0, Math.sin(ph + 1)), 0, 0);
        set(HB.TB, -1.45 + 0.3 * Math.sin(ph + PI), 0, -0.25); set(HB.SB, 1.9 - 0.3 * Math.max(0, Math.sin(ph + PI + 1)), 0, 0);
        set(HB.UA, -1.15 - 0.45 * Math.sin(ph + PI), 0, 0.35); set(HB.FA, -0.35 + 0.3 * Math.sin(ph), 0, 0);
        set(HB.UB, -1.15 - 0.45 * Math.sin(ph), 0, -0.35); set(HB.FB, -0.35 + 0.3 * Math.sin(ph + PI), 0, 0);
        set(HB.CHEST, -0.15 + 0.05 * Math.sin(ph * 2), 0.12 * Math.sin(ph), 0); set(HB.HEAD, -0.95 + tw, 0.3 * Math.sin(t * 1.3 + id), 0.2 * Math.sin(t * 0.7));
        jaw(0.25 + r.lunge * 0.5);
      }
    } else if (type === 'boiadeiro') {
      // gingado pesado, barriga balançando, braços abertos
      const f = clampv(sp / 0.5, 0, 1); r.ph += dt * TAU * (0.35 + 0.35 * f); const ph = r.ph;
      legs(ph, 0.22 * f + 0.03, 0.35 * f + 0.05);
      r.roll = 0.13 * Math.sin(ph); root[1] = -0.02 * Math.abs(Math.cos(ph));
      set(HB.CHEST, -0.12, 0.08 * Math.sin(ph), -0.05 * Math.sin(ph));
      set(HB.UA, -0.35 + 0.15 * Math.sin(ph), 0, 0.75 + 0.1 * Math.sin(t * 2)); set(HB.FA, -0.5, 0, 0);
      set(HB.UB, -0.35 - 0.15 * Math.sin(ph), 0, -0.75 - 0.1 * Math.sin(t * 2.3)); set(HB.FB, -0.5, 0, 0);
      set(HB.HEAD, 0.1 + tw, 0.2 * Math.sin(t * 0.6 + id), 0.15 * Math.sin(ph)); jaw(0.15 + 0.1 * Math.sin(t * 2));
    } else if (type === 'colosso') {
      // passos lentos que fazem o chão tremer; bloco de concreto erguido acima da cabeça
      const f = clampv(sp / 2, 0, 1.3); r.ph += dt * TAU * (0.28 + 0.3 * f); const ph = r.ph;
      legs(ph, 0.3 * f + 0.04, 0.55 * f + 0.06);
      r.roll = 0.07 * Math.sin(ph); root[1] = -0.06 * Math.abs(Math.cos(ph));
      set(HB.CHEST, 0.08, 0.06 * Math.sin(ph), 0);
      const up = 0.08 * Math.sin(ph * 2);
      set(HB.UA, -2.85 + up, 0, 0.32); set(HB.FA, -0.55, 0, 0); set(HB.UB, -2.85 + up, 0, -0.32); set(HB.FB, -0.55, 0, 0);
      set(HB.HEAD, 0.15 + tw * 0.5, 0.15 * Math.sin(t * 0.5), 0); set(HB.PROP, up * 0.5, 0, 0.04 * Math.sin(ph)); jaw(0.3 + 0.25 * r.lunge);
    } else if (type === 'encouracado') {
      // marcha pesada atrás do escudo
      const f = clampv(sp / 0.7, 0, 1.2); r.ph += dt * TAU * (0.45 + 0.4 * f); const ph = r.ph;
      legs(ph, 0.3 * f + 0.03, 0.45 * f + 0.05);
      set(HB.CHEST, 0.12, 0.1 * Math.sin(ph), 0.03 * Math.sin(ph)); root[1] = -0.03 * Math.abs(Math.cos(ph));
      set(HB.UB, -0.45, 0.2, -0.1); set(HB.FB, -1.2, 0, 0);
      set(HB.UA, -(1.2 + 0.25 * r.lunge) + 0.1 * Math.sin(ph), 0, 0.15); set(HB.FA, -0.35, 0, 0);
      set(HB.HEAD, 0.05 + tw * 0.3, 0.12 * Math.sin(t * 0.8 + id), 0); jaw(0.2);
    } else if (type === 'engolidor') {
      // anda pegando fogo, braços para cima se debatendo, cabeça jogada para trás
      const f = clampv(sp / 0.8, 0.2, 1); r.ph += dt * TAU * (0.55 + 0.5 * f); const ph = r.ph;
      legs(ph, 0.32 * f, 0.5 * f + 0.05);
      set(HB.CHEST, 0.15 + 0.1 * Math.sin(t * 5), 0.25 * Math.sin(t * 3.3), 0.1 * Math.sin(t * 4));
      set(HB.UA, -(2.1 + 0.6 * Math.sin(t * 7.3)), 0, 0.5 + 0.2 * Math.sin(t * 5)); set(HB.FA, -0.5 - 0.4 * Math.sin(t * 9), 0, 0);
      set(HB.UB, -(1.8 + 0.7 * Math.sin(t * 6.1 + 1)), 0, -0.5 - 0.2 * Math.sin(t * 4.4)); set(HB.FB, -0.6 - 0.4 * Math.sin(t * 8 + 2), 0, 0);
      set(HB.HEAD, -0.55 + 0.2 * Math.sin(t * 3), 0.3 * Math.sin(t * 2.2), 0.2 * Math.sin(t * 2.9)); jaw(0.75);
      root[1] = -0.03 * Math.abs(Math.cos(ph));
    } else {
      // andarilho (e cangaceiro parado): passo arrastado, uma perna manca, braços estendidos, cabeça caída de lado
      const f = clampv(sp / 0.7, 0, 1.4), idle = 1 - Math.min(1, f);
      r.ph += dt * TAU * (0.32 + 0.42 * f + idle * 0.12); const ph = r.ph;
      const limp = h1 < 0.5 ? 0 : 1, lth = limp ? HB.TB : HB.TA, lsh = limp ? HB.SB : HB.SA;
      legs(ph, 0.36 * f + 0.02, 0.6 * f + 0.04);
      add(lth, 0.12 * Math.sin(ph), 0, 0); A[lsh * 3] = 0.08 + 0.12 * f * Math.max(0, Math.sin(ph + (limp ? PI : 0) + 1.25));   // perna arrastada
      r.roll = (0.07 + 0.05 * f) * Math.sin(ph) + idle * 0.05 * Math.sin(t * 0.9 + id); root[1] = -0.035 * f * Math.abs(Math.cos(ph));
      const lean = (type === 'cangaceiro' ? 0.18 : 0.26) + 0.12 * h2 + r.lunge * 0.2;
      set(HB.CHEST, lean + 0.04 * Math.sin(ph * 2), 0.14 * Math.sin(ph) + idle * 0.12 * Math.sin(t * 0.6 + id), 0.05 * Math.sin(ph));
      // braços: os dois esticados, um pendurado ou um caído (varia por zumbi)
      const reach = 1.3 + 0.25 * r.lunge, armSway = 0.12 * Math.sin(ph + 0.5);
      const style = (id >> 1) % 3;
      const armA = style === 1 ? -0.25 + 0.25 * Math.sin(ph) : -(reach + 0.12 * h3) + armSway, armB = style === 2 ? -0.3 + 0.2 * Math.sin(ph + PI) : -(reach - 0.1 + 0.15 * h1) - armSway;
      set(HB.UA, armA, 0.15, 0.12 + 0.1 * Math.sin(t * 1.1 + id)); set(HB.FA, style === 1 ? -0.1 : -0.25 - 0.15 * Math.sin(t * 1.7 + id), 0, 0);
      set(HB.UB, armB, -0.15, -0.12 - 0.1 * Math.sin(t * 1.3 + id)); set(HB.FB, style === 2 ? -0.1 : -0.25 - 0.15 * Math.sin(t * 1.5 + id * 2), 0, 0);
      set(HB.HEAD, 0.25 - r.lunge * 0.35 + tw, 0.25 * Math.sin(t * 0.5 + id) * idle, (h1 - 0.5) * 0.7 + tw);
      jaw(0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 1.9 + id)) + r.lunge * 0.45);
    }
    // tiro: tranco para trás, cabeça estalando, braços abrindo
    if (r.hit > 0) { const k = r.hit; add(HB.CHEST, -0.5 * k, r.hitDir * 0.6 * k, r.hitDir * 0.4 * k); add(HB.HEAD, -0.6 * k, 0, r.hitDir * 0.8 * k); add(HB.UA, 0.6 * k, 0, 0.4 * k); add(HB.UB, 0.6 * k, 0, -0.4 * k); root[2] -= 0.12 * k; }
  }
  function latchPose(e, r, A, set, jaw) {
    const t = G.t, id = Math.abs(e.id | 0);
    if (e.side === 0) {   // no capô: socando o vidro
      const bt = e.bt || 0, punch = bt < 0.35 ? Math.sin(bt / 0.35 * PI) : 0, a = Math.sin(t * 5 + id);
      set(HB.CHEST, 0.5 + punch * 0.25, 0.15 * Math.sin(t * 3), 0.08 * a); set(HB.HEAD, -0.15 + 0.1 * Math.sin(t * 7), 0.2 * Math.sin(t * 2), 0.25 * Math.sin(t * 1.3));
      set(HB.UA, -2.5 + punch * 0.9, 0, 0.35); set(HB.FA, -0.4 - punch * 0.6, 0, 0); set(HB.UB, -2.3 - 0.3 * Math.sin(t * 6), 0, -0.4); set(HB.FB, -0.5 - 0.3 * Math.sin(t * 6 + 1), 0, 0);
      set(HB.TA, -0.9, 0, 0.15); set(HB.SA, 1.6, 0, 0); set(HB.TB, -0.7, 0, -0.15); set(HB.SB, 1.4, 0, 0); jaw(0.7 + 0.2 * Math.sin(t * 11));
    } else {   // pendurado na porta, pernas balançando
      const a = Math.sin(t * 6 + id);
      set(HB.CHEST, 0.2, -0.3 * e.side, 0.1 * a); set(HB.HEAD, 0.1 + 0.15 * Math.sin(t * 4), 0.35 * Math.sin(t * 1.7), 0.2);
      set(HB.UA, -2.6 + 0.4 * a, 0, 0.3); set(HB.FA, -0.7, 0, 0); set(HB.UB, -2.4 - 0.4 * a, 0, -0.3); set(HB.FB, -0.8, 0, 0);
      set(HB.TA, -0.4 + 0.5 * Math.sin(t * 9 + id), 0, 0.1); set(HB.SA, 0.6 + 0.4 * Math.sin(t * 9 + id + 1), 0, 0); set(HB.TB, -0.3 + 0.5 * Math.sin(t * 9 + id + PI), 0, -0.1); set(HB.SB, 0.7 + 0.4 * Math.sin(t * 9 + id + PI + 1), 0, 0);
      jaw(0.6 + 0.3 * Math.sin(t * 13));
    }
  }

  /* ---------- tinta da roupa ---------- */
  const T1 = new Float32Array(3), T2 = new Float32Array(3);
  function tints(e) {
    const id = Math.abs(e.id | 0), tt = Z.TYPE_TINT[e.type];
    const a = tt ? tt[0] : Z.SHIRTS[(id * 5 + 1) % Z.SHIRTS.length], b = tt ? tt[1] : Z.PANTS[(id * 3 + 2) % Z.PANTS.length];
    T1[0] = a[0]; T1[1] = a[1]; T1[2] = a[2]; T2[0] = b[0]; T2[1] = b[1]; T2[2] = b[2];
  }

  /* ---------- boi infectado (quadrúpede) ---------- */
  const BOI_SK = [[-1, 0, 1.05, 0], [0, 0, 0.18, 0.78], [0, 0.22, -0.16, 0.55], [2, 0, -0.42, 0], [0, -0.22, -0.16, 0.55], [4, 0, -0.42, 0], [0, 0.22, -0.1, -0.6], [6, 0, -0.45, 0], [0, -0.22, -0.1, -0.6], [8, 0, -0.45, 0], [0, 0, 0.12, -0.82], [1, 0, -0.06, 0.22]];
  const boiAtl = new Map();
  function boiAtlas(Pl) {
    let a = boiAtl.get(Pl); if (a) return a;
    a = TEX3.T(() => {
      const S = 256, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d'), r = TEX3.rng(77 + Pl[0].length), rgb = TEX3.hexRGB, css = TEX3.css;
      const w0 = rgb(Pl[0]), w3 = rgb(Pl[3]);
      k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
      TEX3.field(x, S, S, TEX3.fbm(S, S, 4, 5, 515, 0.6), [52, 40, 30], [98, 78, 60], 16, 9);
      x.fillStyle = 'rgba(200,190,170,0.18)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.ellipse(r() * S, r() * 128, 10 + r() * 26, 6 + r() * 16, r() * 3, 0, 7); x.fill(); }   // manchas mais claras
      x.strokeStyle = 'rgba(20,14,10,0.35)'; x.lineWidth = 1; for (let i = 0; i < 900; i++) { const X = r() * S, Y = r() * 128; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + 1, Y + 3); x.stroke(); }    // pelo
      for (let i = 0; i < 9; i++) {   // feridas luminescentes
        const X = r() * S, Y = 8 + r() * 110, R = 4 + r() * 9, col = i & 1 ? w3 : w0;
        x.fillStyle = '#2a0604'; x.beginPath(); x.ellipse(X, Y, R * 1.4, R, r() * 3, 0, 7); x.fill(); x.fillStyle = css(col[0], col[1], col[2]); x.beginPath(); x.ellipse(X, Y, R, R * 0.6, r() * 3, 0, 7); x.fill();
        k.fillStyle = '#fff'; k.beginPath(); k.ellipse(X, Y, R, R * 0.6, 0, 0, 7); k.fill();
      }
      // cabeça (128..256 em y, 0..128 em x): olhos acesos nas laterais
      x.fillStyle = '#3a2c22'; x.fillRect(0, 128, 128, 128);
      for (const ex of [32, 96]) { x.fillStyle = '#0a0604'; x.beginPath(); x.ellipse(ex, 170, 10, 8, 0, 0, 7); x.fill(); x.fillStyle = css(w0[0], w0[1], w0[2]); x.beginPath(); x.arc(ex, 170, 5, 0, 7); x.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(ex, 170, 5.5, 0, 7); k.fill(); }
      x.fillStyle = '#1a1210'; x.fillRect(40, 228, 48, 28);   // focinho
      // patas (128..192 x, 128..256 y): casco preto embaixo
      x.fillStyle = '#2e241c'; x.fillRect(128, 128, 64, 128); x.fillStyle = '#0c0a08'; x.fillRect(128, 228, 64, 28);
      // chifre
      const t2 = TEX3.cnv(64, 128); TEX3.field(t2.getContext('2d'), 64, 128, TEX3.fbm(64, 128, 2, 3, 617, 0.5), [140, 130, 112], [214, 206, 186], 10, 2); x.drawImage(t2, 192, 128);
      return TEX3.pack(c, m);
    }, { repeat: false });
    boiAtl.set(Pl, a); return a;
  }
  let boiMesh = null;
  function boiModel() {
    if (boiMesh) return boiMesh;
    const b = new GL3.Builder(), uv = (x0, y0, x1, y1) => [(x0 + 1) / 256, (y0 + 1) / 256, (x1 - 1) / 256, (y1 - 1) / 256], HIDE = uv(0, 0, 256, 128), HEAD = uv(0, 128, 128, 256), LEG = uv(128, 128, 192, 256), HORN = uv(192, 128, 256, 256);
    // corpo deitado ao longo de z (loft em y girado), com cupim nos ombros
    b.bone = 0; let s0 = 0;
    Z.loft(b, [[-0.86, 0.12, 0.15, 0, 0], [-0.74, 0.27, 0.33, 0, 0.02], [-0.42, 0.33, 0.41, 0, 0.04], [0, 0.36, 0.45, 0, 0.06], [0.36, 0.35, 0.46, 0, 0.04], [0.62, 0.3, 0.42, 0, 0.0], [0.8, 0.19, 0.3, 0, -0.02]], 12, HIDE, true, true);
    Z.xform(b, 0, PI / 2, 0, 0, 0, 0, 0);
    s0 = b.v.length / GL3.STRIDE; Z.loft(b, [[0, 0.13, 0.16, 0, 0], [0.12, 0.11, 0.14, 0, 0], [0.22, 0.04, 0.05, 0, 0]], 8, HIDE, true, false); Z.xform(b, s0, 0, 0, 0, 0, 0.33, 0.45);   // cupim
    // pescoço + cabeça (osso 1), apontando para frente e para baixo
    b.bone = 1; s0 = b.v.length / GL3.STRIDE;
    Z.loft(b, [[-0.25, 0.17, 0.22, 0, 0], [0.05, 0.15, 0.18, 0, 0], [0.3, 0.13, 0.16, 0, 0], [0.5, 0.11, 0.12, 0, 0], [0.62, 0.085, 0.085, 0, 0]], 10, HEAD, true, true);
    Z.xform(b, s0, PI / 2 + 0.55, 0, 0, 0, 0, 0.05);
    for (const sx of [1, -1]) { s0 = b.v.length / GL3.STRIDE; Z.loft(b, [[0, 0.035, 0.035, 0, 0], [0.16, 0.025, 0.025, 0, 0], [0.3, 0.004, 0.004, 0, 0]], 6, HORN, false, true); Z.xform(b, s0, -0.5, 0, -sx * 1.15, sx * 0.1, 0.12, 0.05); }   // chifres
    for (const sx of [1, -1]) { s0 = b.v.length / GL3.STRIDE; Z.boxP(b, -0.02, 0.02, -0.05, 0.05, -0.1, 0.1, HIDE); Z.xform(b, s0, 0, 0, sx * 0.3, sx * 0.14, 0.05, -0.02); }   // orelhas
    // patas (2 segmentos) com casco
    for (const [u, l] of [[2, 3], [4, 5], [6, 7], [8, 9]]) {
      b.bone = u; Z.loft(b, [[-0.44, 0.06, 0.07, 0, 0], [-0.2, 0.08, 0.1, 0, 0], [0.06, 0.11, 0.14, 0, 0]], 8, u >= 6 ? HIDE : LEG, false, false);
      b.bone = l; Z.loft(b, [[-0.42, 0.055, 0.06, 0, 0.01], [-0.3, 0.045, 0.05, 0, 0], [0.02, 0.055, 0.06, 0, 0]], 8, LEG, false, true);
    }
    b.bone = 10; Z.loft(b, [[-0.65, 0.05, 0.05, 0, 0], [-0.5, 0.02, 0.02, 0, 0], [0.0, 0.03, 0.03, 0, 0]], 6, LEG, false, true);   // rabo com tufo
    boiMesh = b.mesh(); boiMesh.skel = BOI_SK; return boiMesh;
  }
  function boiPose(e, r, dt, A) {
    A.fill(0); const t = G.t, f = clampv(r.spd / 6, 0.2, 1.4); r.ph += dt * TAU * (0.8 + 1.4 * f); const ph = r.ph, set = (b, x, y, z) => { A[b * 3] = x; A[b * 3 + 1] = y; A[b * 3 + 2] = z; };
    const g = (o) => Math.sin(ph + o);
    set(2, -0.5 * g(0), 0, 0); set(3, 0.7 * Math.max(0, g(1.2)), 0, 0); set(4, -0.5 * g(0.45), 0, 0); set(5, 0.7 * Math.max(0, g(1.65)), 0, 0);
    set(6, 0.55 * g(PI), 0, 0); set(7, -0.3 + 0.5 * Math.max(0, g(PI + 1.2)), 0, 0); set(8, 0.55 * g(PI + 0.45), 0, 0); set(9, -0.3 + 0.5 * Math.max(0, g(PI + 1.65)), 0, 0);
    set(0, 0.06 * g(0.5) * f, 0, 0.04 * Math.sin(ph * 0.5)); set(1, 0.15 * g(1) * f + 0.1, 0.15 * Math.sin(t * 0.9 + e.id), 0); set(10, 0.4 + 0.3 * Math.sin(t * 3), 0.6 * Math.sin(t * 2.2), 0);
    r.root[0] = 0; r.root[1] = 0.05 * Math.abs(g(0)) * f; r.root[2] = 0; r.tilt = 0; r.roll = 0;
    if (r.hit > 0) { A[0] -= 0.2 * r.hit; A[3] -= 0.4 * r.hit; }
  }

  /* ---------- desenho ---------- */
  const MT = M4.make(), MT2 = M4.make(), RX = M4.make();
  // frente do modelo na vista a partir de um rumo na estrada (yaw: 0 = sentido da estrada) e da curva local (inclinação s)
  function fwd(R, yaw, s) {
    const fs = R.fs, dir = R.dir, L = Math.hypot(fs * s, 1), tx = fs * s / L, tz = 1 / L, nx = 1 / L, nz = -fs * s / L;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    return [sy * fs * nx + cy * dir * tx, sy * fs * nz + cy * dir * tz];
  }
  // inclina o modelo inteiro (cair/rastejar) em torno do eixo x local, com pivô nos pés, e rolagem
  function tiltM(M, pitch, roll, lift) {
    if (!pitch && !roll && !lift) return M;
    const c = Math.cos(pitch), s = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // Rz(roll)·Rx(pitch) + elevação
    RX.fill(0); RX[15] = 1;
    RX[0] = cr; RX[1] = sr; RX[2] = 0;
    RX[4] = -sr * c; RX[5] = cr * c; RX[6] = s;
    RX[8] = sr * s; RX[9] = -cr * s; RX[10] = c;
    RX[13] = lift || 0;
    return M4.mul(MT2, M, RX);
  }
  function darkAt(R, x, y, z) {   // quanto o ponto está fora do farol (0 = iluminado, 1 = breu)
    const L = R.L; if (!L.night) return 0;
    let lit = 0.08;
    if (L.HL[0] > 0) { const dx = x - L.HLp[0], dy = y - L.HLp[1], dz = z - L.HLp[2], d = Math.hypot(dx, dy, dz) || 1, cs = (dx * L.HLd[0] + dy * L.HLd[1] + dz * L.HLd[2]) / d; const cone = clampv((cs - L.HL[3]) / (L.HL[2] - L.HL[3]), 0, 1), att = Math.max(0, 1 - d * L.HL[1]); lit += L.HL[0] * sm(cone) * att * att * 0.6; }
    return clampv(1 - lit, 0, 1);
  }
  function fogAt(R, z) { const L = R.L, q = (z * L.fogP[0] - 0.2) * 1.25; return q <= 0 ? 0 : Math.min(1, Math.pow(Math.min(q, 1), 1.1) * L.fogP[1]); }

  function draw(R, e, vx, vy, vz, lod, ctx, s) {
    const r = st(e), dt = track(e, r);
    if (!ctx.v.main && dt === 0 && r.drawnT === G.t) { /* retrovisor: reaproveita a pose do quadro */ }
    // suavização (co-op) e rumo
    const ex = r.x - e.x, ez = r.z - e.z; vx += R.fs * ex; vz += R.dir * ez;
    const boi = e.type === 'boi';
    if (ctx.v.main || r.drawnT !== G.t) {
      // virar para o carro, misturado com a direção do movimento (de longe vagam, de perto encaram)
      let tx = P.x - r.x, tz = P.z - r.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (r.spd > 0.35 && !boi) { const w = clampv((tl - 10) / 35, 0, 0.75); tx = lerp(tx, r.vx / r.spd, w); tz = lerp(tz, r.vz / r.spd, w); }
      let want = boi ? Math.atan2(r.vx || 0.001, r.vz || -1) : Math.atan2(tx, tz);
      if (e.type === 'carrapato' && e.st === 'jump') want = PI;
      let d = want - r.yaw; d = ((d + PI) % TAU + TAU) % TAU - PI; r.yaw += d * Math.min(1, dt * (e.type === 'corredor' ? 6 : 3));
      if (Z3D.debugYaw != null) r.yaw = Z3D.debugYaw;
      if (boi) boiPose(e, r, dt, r.A); else pose(e, r, dt, r.A);
      r.drawnT = G.t;
    }
    const mesh = boi ? boiModel() : Z.humanoid(Z.specKey(e), Z.SPEC[Z.specKey(e)]);
    const P0 = DRAW.pele(e), tex = boi ? boiAtlas(P0) : Z.atlasFor(P0);
    const f = fwd(R, r.yaw, ctx.slope(vz));
    let M = R.place(MT, vx, vy, vz, f[0], f[1], 1);
    M = tiltM(M, r.tilt, r.roll * R.fs, 0);
    const bones = solve(mesh.skel, r.A, null, r.root);
    if (!boi) tints(e);
    R.skin(mesh, tex, M, bones, { t1: T1, t2: T2, flash: e.flash > 0 ? 0.55 : 0 });
    // sombra, brilho noturno, fogo do Engolidor
    const d = ENEMY[e.type];
    if (lod > 0) R.blob(vx, vy, vz, d.w * 0.75, d.w * 0.6, R.L.night ? 0.3 : 0.55);
    if (R.L.night && !boi) {
      const dk = darkAt(R, vx, vy + d.h * 0.6, vz), fg = fogAt(R, vz);
      if (dk > 0.45) { const c = DRAW.pele(e)[0], cc = TEX3.hexRGB(c); R.glow(vx, vy + d.h * 0.62, vz, d.w * 1.3, d.h * 0.62, cc[0] / 255, cc[1] / 255, cc[2] / 255, (dk - 0.45) * 1.1 * (1 - fg * 0.6)); }
    }
    if (d.fogo) {
      const hp = bonePos(HB.HEAD), w = M; const hx = w[0] * hp[0] + w[4] * hp[1] + w[8] * hp[2] + w[12], hy = w[1] * hp[0] + w[5] * hp[1] + w[9] * hp[2] + w[13], hz = w[2] * hp[0] + w[6] * hp[1] + w[10] * hp[2] + w[14];
      const fl = 0.8 + 0.25 * Math.sin(G.t * 23 + e.id);
      R.flame(hx, hy + 0.25, hz, 0.32 * fl, 0.45 * fl, 0.9); R.flame(hx + 0.12, hy - 0.15, hz, 0.22, 0.3 * fl, 0.6); R.glow(hx, hy - 0.3, hz, 1.4, 1.2, 1, 0.45, 0.1, 0.35);
    }
    if (ctx.v.main) { r.seen = G.frame; r.vxp = vx; r.lastDz = e.z - P.z; r.mesh = mesh; r.tex = tex; }
    alive.set(e.id, e);
  }

  /* ---------- agarrados no carro: colocados onde o 2D colocava (mesmo retângulo de tiro) ---------- */
  function drawLatch(R, e, vx, vy, vz, facing) {
    const r = st(e), dt = track(e, r);
    if (r.drawnT !== G.t) { pose(e, r, dt, r.A); r.drawnT = G.t; }
    const mesh = Z.humanoid(Z.specKey(e), Z.SPEC[Z.specKey(e)]), tex = Z.atlasFor(DRAW.pele(e));
    const M = R.place(MT, vx, vy, vz, facing[0], facing[1], 1);
    tints(e); R.skin(mesh, tex, M, solve(mesh.skel, r.A, null, r.root), { t1: T1, t2: T2, flash: e.flash > 0 ? 0.55 : 0 });
    alive.set(e.id, e);
  }

  /* ---------- mortes e cadáveres ---------- */
  const alive = new Map(), corpses = [];
  function spawnCorpse(e) {
    const r = e._r; if (!r || !r.mesh) return;
    const dzc = e.z - P.z; if (dzc < -55 || dzc > 460) return;
    const d = ENEMY[e.type], car = e.killed === 'car' || e.killed === 'crash' || (!e.killed && dzc < 4 && dzc > -2 && Math.abs(e.x - P.x) < G.V.w + d.w && P.speed > 6);
    const c = { e: { id: e.id, type: e.type }, type: e.type, x: r.x, z: r.z, yaw: r.yaw, t: 0, A: new Float32Array(r.A), root: r.root.slice(), mesh: r.mesh, tex: r.tex, kind: car ? 'fly' : 'fall', head: !!e.kHead, seed: hsh(e.id * 9.1), y: 0, vy: 0, vx: 0, vz: 0, pitch: r.tilt || 0, roll: 0, spin: 0, dirF: 1, pool: 0 };
    if (e.st === 'latch') { c.kind = 'fly'; c.x = P.x + (e.side || 0) * (G.V.w + 0.4); c.z = P.z + (e.side === 0 ? 2.2 : 0.3); }
    if (c.kind === 'fly') {
      const sp = Math.max(8, P.speed), side = (c.x - P.x) >= 0 ? 1 : -1;
      c.vz = sp * 0.62 + 1.5; c.vy = 5 + sp * 0.11 + c.seed * 2; c.vx = side * (1.5 + c.seed * 3.5); c.spin = (6 + c.seed * 6) * (c.seed > 0.5 ? 1 : -1); c.y = 0.3; c.rollSpin = (c.seed - 0.5) * 8;
    } else c.dirF = (hsh(e.id * 3.3) > 0.3 ? -1 : 1);   // a maioria cai para trás
    if (e.type === 'boi') c.boi = true;
    corpses.push(c); if (corpses.length > 46) corpses.shift();
    if (c.head && typeof FX3D !== 'undefined') FX3D.burst && FX3D.burst(c, 'head');
  }
  function corpsePose(c, dt) {
    const A = c.A, t = c.t;
    if (c.boi) { c.pitch = 0; c.roll = Math.min(PI / 2, t * 3) * (c.seed > 0.5 ? 1 : -1); return; }
    if (c.kind === 'fly') {
      c.vy -= 13 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.y > 0 || c.vy > 0) { c.pitch += c.spin * dt; c.roll += c.rollSpin * dt; for (let i = 3; i < 11; i++) A[i * 3] += Math.sin(t * 17 + i) * dt * 6; }
      else {
        c.y = 0; c.vy = 0; c.vx *= Math.max(0, 1 - dt * 5); c.vz *= Math.max(0, 1 - dt * 3.5);
        const p = ((c.pitch + PI) % TAU + TAU) % TAU - PI, tg = p >= 0 ? PI / 2 : -PI / 2; c.pitch = p + (tg - p) * Math.min(1, dt * 8); c.dirF = tg > 0 ? 1 : -1;
        const q = ((c.roll + PI) % TAU + TAU) % TAU - PI; c.roll = q * Math.max(0, 1 - dt * 6);
        if (!c.landed) { c.landed = 1; c.pool = 0.01; }
      }
      return;
    }
    // queda: joelhos cedem, tomba para trás (ou de cara), quica e fica
    const u1 = clampv(t / 0.28, 0, 1), u2 = clampv((t - 0.18) / 0.62, 0, 1);
    const fall = u2 * u2 * (PI / 2) * c.dirF, bounce = t > 0.8 && t < 1.05 ? Math.sin((t - 0.8) / 0.25 * PI) * 0.12 : 0;
    c.pitch = lerp(c.pitch0 === undefined ? (c.pitch0 = c.pitch) : c.pitch0, 0, u1) + fall - bounce * c.dirF;
    c.root[1] = -0.22 * sm(u1) * (1 - u2 * 0.6);
    const kne = 0.9 * sm(u1) * (1 - u2 * 0.7);
    A[HB.TA * 3] = lerp(A[HB.TA * 3], -kne * 0.7, Math.min(1, dt * 9)); A[HB.TB * 3] = lerp(A[HB.TB * 3], -kne * 0.6, Math.min(1, dt * 9));
    A[HB.SA * 3] = lerp(A[HB.SA * 3], kne * 1.4, Math.min(1, dt * 9)); A[HB.SB * 3] = lerp(A[HB.SB * 3], kne * 1.2, Math.min(1, dt * 9));
    const sp = u2;   // braços se abrem na queda
    A[HB.UA * 3] = lerp(A[HB.UA * 3], -0.4 - c.seed, Math.min(1, dt * 5)); A[HB.UA * 3 + 2] = lerp(A[HB.UA * 3 + 2], 0.9 * sp + 0.3, Math.min(1, dt * 5));
    A[HB.UB * 3] = lerp(A[HB.UB * 3], -0.2 - c.seed * 0.8, Math.min(1, dt * 5)); A[HB.UB * 3 + 2] = lerp(A[HB.UB * 3 + 2], -1.1 * sp - 0.2, Math.min(1, dt * 5));
    A[HB.HEAD * 3 + 1] = lerp(A[HB.HEAD * 3 + 1], (c.seed - 0.5) * 1.6, Math.min(1, dt * 4)); A[HB.JAW * 3] = lerp(A[HB.JAW * 3], 0.5, Math.min(1, dt * 3));
    A[HB.CHEST * 3] = lerp(A[HB.CHEST * 3], 0.05, Math.min(1, dt * 4));
    if (t > 0.6 && !c.pool) c.pool = 0.01;
  }
  const HS = new Float32Array(16);
  function corpsesPass(R, ctx) {
    const v = ctx.v, main = v.main;
    if (main) {
      // quem sumiu desde o último quadro: morto (anfitrião marca e.killed) ou removido da lista no co-op
      const now = new Set(); for (const e of G.ents) if (!e.dead) now.add(e.id);
      for (const [id, e] of alive) if (!now.has(id)) { alive.delete(id); if ((e.dead && e.killed) || (G.netClient && !e.dead)) spawnCorpse(e); }
      const dt = clampv(G.t - (corpsesPass.lt || G.t), 0, 0.1); corpsesPass.lt = G.t;
      for (const c of corpses) { c.t += dt; corpsePose(c, dt); if (c.pool) c.pool = Math.min(1, c.pool + dt * 0.35); }
      for (let i = corpses.length - 1; i >= 0; i--) if (corpses[i].z < P.z - 70 || corpses[i].z > P.z + 520 || corpses[i].t > 90) corpses.splice(i, 1);
    }
    if (!corpses.length) return;
    for (const c of corpses) {
      const dz = R.dir * (c.z - v.camZ); if (dz < 0.6 || dz > ctx.maxD) continue;
      const wx = ctx.center(dz) + c.x, vx = R.fs * (wx - v.camX), vy = ctx.y0 + Math.max(0, c.y), vz = dz;
      if (vx < -dz * 2.5 || vx > dz * 2.5) continue;
      const f = fwd(R, c.yaw, ctx.slope(dz));
      let M = R.place(MT, vx, vy, vz, f[0], f[1], 1);
      M = tiltM(M, c.pitch, c.roll * R.fs, c.kind === 'fall' || c.y <= 0 ? 0.08 : 0);
      if (c.boi) { R.skin(c.mesh, c.tex, M, solve(BOI_SK, c.A, null, c.root), { flash: 0 }); }
      else {
        let S = null; if (c.head) { S = HS; S.fill(1); S[HB.HEAD] = 0.001; }
        tints(c.e); R.skin(c.mesh, c.tex, M, solve(c.mesh.skel, c.A, S, c.root), { t1: T1, t2: T2, flash: 0, glow: R.L.glow * Math.max(0.15, 1 - c.t / 6) });
      }
      if (c.pool > 0) { const pr = (0.35 + c.pool * 0.9) * (c.type === 'colosso' ? 1.8 : 1), o = c.boi ? 0 : 0.85 * c.dirF * (c.type === 'colosso' ? 1.8 : 1); R.decal(c.type === 'boiadeiro' ? 11 : 3 + (c.e.id & 1), vx + f[0] * o, ctx.y0, vz + f[1] * o, pr, pr * 0.8, c.seed * 6, Math.min(0.92, c.pool * 1.6)); }
      else R.blob(vx, vy, vz, 0.6, 0.5, 0.45);
    }
  }

  Object.assign(Z3D, { draw, drawLatch, corpses: corpsesPass, fwd, solve, bonePos, st, get corpseList() { return corpses; } });
})();
