'use strict';
/* Renderização: pista pseudo-3D, cockpit diegético, retrovisores em tempo real, visão do artilheiro */
const RENDER = (() => {
  let cv, c, mcv, mc, W = 960, H = 540, SX = 1, SY = 1, MS = 1, devW = 0, devH = 0;
  const glowList = [], occl = [];
  const rgbC = {}; const rgb = (h) => rgbC[h] || (rgbC[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const mix = (a, b, f) => `rgb(${a[0] + (b[0] - a[0]) * f | 0},${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0})`;
  const X = new Float32Array(160);
  let viewN = 110, puffs = [];
  const CLIMA_N = { limpo: 110, chuva: 62, neblina: 30, fumaca: 17, queimada: 22, areia: 15 };
  const CLIMA_FOG = { chuva: '#59626a', neblina: null, fumaca: '#3a2a20', queimada: '#6a4a30', areia: '#c8a050' };

  let use3D = false, glcv = null, glScale = 1, ftAcc = 0, ftN = 0, lastFT = 0;
  // resolução automática: se o celular não segura o ritmo, só a camada 3D baixa a resolução (o painel e o HUD ficam nítidos)
  function adapt() {
    const now = performance.now(), d = now - lastFT; lastFT = now;
    if (d > 0 && d < 100) { ftAcc += d; ftN++; }
    if (ftN < 90) return;
    const avg = ftAcc / ftN; ftAcc = ftN = 0;
    if (!use3D || (META.opts.res || 'auto') !== 'auto') { if (glScale !== 1) { glScale = 1; resize(); } return; }
    if (avg > 22 && glScale > 0.6) { glScale = Math.max(0.6, glScale - 0.1); resize(); }
    else if (avg < 14.5 && glScale < 1) { glScale = Math.min(1, glScale + 0.05); resize(); }
  }
  function init(canvas) {
    cv = canvas; c = cv.getContext('2d'); mcv = document.createElement('canvas'); mc = mcv.getContext('2d');
    // motor 3D (WebGL) por baixo do canvas 2D; se o aparelho não tiver WebGL, ou o jogador escolher, fica o desenho 2D clássico
    glcv = document.getElementById('gl');
    if (glcv && typeof W3D !== 'undefined' && META.opts.gfx !== '2d') { try { use3D = W3D.init(glcv); } catch (e) { console.error(e); use3D = false; } }
    document.body.classList.toggle('gl3d', use3D); if (glcv) glcv.style.display = use3D ? 'block' : 'none';
    if (use3D) W3D.warm();
    resize(); window.addEventListener('resize', resize);
    // tamanho exato da tela em pixels físicos: 1 pixel do desenho = 1 pixel da tela, sem reamostragem
    if (window.ResizeObserver) try {
      const ro = new ResizeObserver((en) => { const b = en[0] && en[0].devicePixelContentBoxSize; if (b && b[0]) { devW = b[0].inlineSize; devH = b[0].blockSize; } resize(); });
      try { ro.observe(cv, { box: 'device-pixel-content-box' }); } catch (e) { ro.observe(cv); }
    } catch (e) {}
  }
  function screenPx() {
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(), ew = (r.width || window.innerWidth) * dpr, eh = (r.height || window.innerHeight) * dpr;
    // usa o tamanho exato informado pelo navegador quando ele bate com CSS × densidade (alguns ambientes informam px CSS)
    if (devW > 0 && devH > 0 && Math.abs(devW - ew) <= dpr + 1 && Math.abs(devH - eh) <= dpr + 1) return [devW, devH];
    return [Math.max(1, Math.round(ew)), Math.max(1, Math.round(eh))];
  }
  /* O jogo pensa em 540 linhas (coordenadas virtuais) e é rasterizado na resolução escolhida:
     Automática = a da tela (1080 × 2400 no Galaxy S20 FE, 1264 × 2780 no Motorola Signature), ou um valor fixo do menu. */
  function resize() {
    const [pw, ph] = screenPx(), ar = pw / ph, a = Math.max(1.2, Math.min(2.4, ar)), opt = RESOLUCOES.find(r => r.id === META.opts.res) || RESOLUCOES[0];
    H = 540; W = Math.round(H * a);
    let bh = opt.h || ph, bw = !opt.h && a === ar ? pw : Math.round(bh * a);
    const cap = 3200 / Math.max(bw, bh); if (cap < 1) { bw = Math.round(bw * cap); bh = Math.round(bh * cap); }   // limite de memória do canvas
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    if (use3D) W3D.resize(Math.round(bw * glScale), Math.round(bh * glScale));
    SX = bw / W; SY = bh / H; MS = Math.min(3, Math.max(1, SY));
    const mw = Math.round(360 * MS), mh = Math.round(90 * MS); if (mcv.width !== mw || mcv.height !== mh) { mcv.width = mw; mcv.height = mh; }
    G.W = W; G.H = H;
  }
  function base(cx) { cx.setTransform(SX, 0, 0, SY, 0, 0); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }

  function quad(c, x1, y1, w1, x2, y2, w2, cor) { c.fillStyle = cor; c.beginPath(); c.moveTo(x1 - w1, y1); c.lineTo(x1 + w1, y1); c.lineTo(x2 + w2, y2); c.lineTo(x2 - w2, y2); c.fill(); }

  function world(c, v) {
    const st = G.st, W = v.W, H = v.H, hor = v.hor, F = v.F, dir = v.dir, fs = v.flip ? -1 : 1, N = Math.round(v.N), camH = v.camH, pan = v.pan || 0;
    const night = G.night, fogHex = (G.clima !== 'limpo' && CLIMA_FOG[G.clima]) || st.fog, fogc = rgb(night && G.clima === 'limpo' ? '#0a0e14' : fogHex), fogK = G.clima === 'limpo' ? st.fogK : 1;
    const sky0 = night ? '#03050a' : st.sky[0], sky1 = night ? '#10161f' : st.sky[1];
    const g = c.createLinearGradient(0, 0, 0, hor); g.addColorStop(0, G.clima === 'limpo' ? sky0 : mix(rgb(sky0), fogc, 0.6)); g.addColorStop(1, G.clima === 'limpo' ? mix(rgb(sky1), fogc, 0.35) : mix(rgb(sky1), fogc, 0.95)); c.fillStyle = g; c.fillRect(0, 0, W, hor + 1);
    if (v.main && dir > 0) {
      const ox = ((-G.skyX * 0.02) % W + W * 1.5) % W;
      if (st.sol && !night && G.clima === 'limpo') { c.fillStyle = 'rgba(255,220,150,0.25)'; c.beginPath(); c.arc(ox + pan * 0.3, hor - H * 0.07, H * 0.11, 0, 7); c.fill(); c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(ox + pan * 0.3, hor - H * 0.07, H * 0.055, 0, 7); c.fill(); }
      if (night) { c.fillStyle = '#dfe6f0'; c.beginPath(); c.arc(W * 0.78 + pan * 0.2, H * 0.1, 14, 0, 7); c.fill(); }
      if (st.marco && G.prog >= st.mar && (G.clima === 'limpo' || st.marco === 'padre')) DRAW.marco(c, st.marco, W / 2 + pan * 0.5 + (W * 0.5 - ox) * 0.15, hor + 1, (H / 540) * (0.8 + (G.prog - st.mar) * 3), G.t);
    }
    c.fillStyle = mix(fogc, fogc, 0); c.fillRect(0, hor, W, H - hor);
    const base = Math.floor(v.camZ / SEG), frac = v.camZ / SEG - base, off = dir > 0 ? frac : 1 - frac;
    let x = 0, dx = 0; for (let n = 0; n <= N + 1; n++) { X[n] = x; x += dx; dx += curveAt(base + dir * n); }
    const ga = rgb(st.ground[0]), gb = rgb(st.ground[1]), asf = rgb(night ? '#1c1c20' : '#3c3c40'), dirt = rgb(night ? '#2a241c' : '#7a6548'), water = rgb(night ? '#0a1420' : '#2a5a7a'), wh = rgb('#e8e8e0'), ye = rgb('#e0b020');
    const fogF = (r) => { const f = (r - 0.2) / 0.8; return f <= 0 ? 0 : Math.min(1, Math.pow(f, 1.1)) * fogK; };
    const duo = st === STAGES[2] || st === ARENA;
    for (let n = N - 1; n >= 0; n--) {
      const dz1 = Math.max((n - off) * SEG, 0.45), dz2 = (n + 1 - off) * SEG; if (dz2 <= 0.5) continue;
      const s1 = F / dz1, s2 = F / dz2, y1 = hor + camH * s1, y2 = hor + camH * s2; if (y2 > H + 2) continue;
      const cx1 = W / 2 + pan + fs * (X[n] - v.camX) * s1, cx2 = W / 2 + pan + fs * (X[n + 1] - v.camX) * s2, f = fogF(n / N), i = base + dir * n, bridge = isBridge(i * SEG);
      c.fillStyle = mix(bridge ? water : ((i >> 1) & 1 ? ga : gb), fogc, f); c.fillRect(0, y2 - 0.5, W, y1 - y2 + 1);
      if (st.penhasco) { const rx = cx2 + fs * (ROADW + 4) * s2; c.fillStyle = mix(rgb(sky1), fogc, 0.5); if (fs > 0) c.fillRect(rx, y2 - 0.5, W - rx, y1 - y2 + 1); else c.fillRect(0, y2 - 0.5, rx, y1 - y2 + 1); }
      if (!bridge) quad(c, cx1, y1, (ROADW + 2.6) * s1, cx2, y2, (ROADW + 2.6) * s2, mix(dirt, fogc, f));
      quad(c, cx1, y1, ROADW * s1, cx2, y2, ROADW * s2, mix(asf, fogc, f));
      if (n < 70) {
        const lw1 = 0.08 * s1, lw2 = 0.08 * s2, e1 = (ROADW - 0.5) * s1, e2 = (ROADW - 0.5) * s2, wc = mix(wh, fogc, f);
        quad(c, cx1 - e1, y1, lw1, cx2 - e2, y2, lw2, wc); quad(c, cx1 + e1, y1, lw1, cx2 + e2, y2, lw2, wc);
        if (duo) { quad(c, cx1, y1, lw1 * 2.2, cx2, y2, lw2 * 2.2, mix(ye, fogc, f)); if (i & 1) { quad(c, cx1 - e1 * 0.5, y1, lw1, cx2 - e2 * 0.5, y2, lw2, wc); quad(c, cx1 + e1 * 0.5, y1, lw1, cx2 + e2 * 0.5, y2, lw2, wc); } }
        else if (i & 1) quad(c, cx1, y1, lw1, cx2, y2, lw2, mix(ye, fogc, f));
      }
    }
    // sprites
    const list = [], maxD = N * SEG;
    const center = (dz) => { const nf = dz / SEG + off, n0 = Math.max(0, Math.floor(nf)), t = nf - n0; return X[n0] + (X[n0 + 1] - X[n0]) * t; };
    const cen = st.cen2 && G.prog >= st.cen2From ? st.cen2 : st.cen, kmNow = Math.max(0, Math.round(st.km - (st.km - st.kmFim) * G.prog));
    const pedI = st.pedagio ? Math.floor(st.len * st.pedagio / SEG) : -1;
    for (let n = 1; n < N; n++) {
      const i = base + dir * n, dz = (n - off) * SEG; if (dz < 1.5) continue;
      if (i === pedI) list.push({ dz, wx: X[n] - ROADW - 1.5, t: 'pedagio', seed: i });
      if (isBridge(i * SEG)) { if (i % 1 === 0) { list.push({ dz, wx: X[n] - ROADW - 0.3, t: 'guarda', seed: i }); list.push({ dz, wx: X[n] + ROADW + 0.3, t: 'guarda', seed: i }); } continue; }
      if (i % 120 === 60) { list.push({ dz, wx: X[n] + ROADW + 3, t: 'placa', seed: i, st: { txt1: (st.cidade || '').toUpperCase().slice(0, 14), txt2: 'FORTALEZA ' + kmNow + ' km' } }); continue; }
      if (i % 260 === 130) { list.push({ dz, wx: X[n] - ROADW - 2.5, t: 'radar', seed: i }); }
      if (i % 3 !== 0) continue;
      for (let s = -1; s <= 1; s += 2) {
        if (st.penhasco) { if (s > 0) continue; if (i % 6 === 0) list.push({ dz, wx: X[n] - ROADW - 9, t: 'penhasco', seed: i }); else if (i % 6 === 3) list.push({ dz, wx: X[n] - ROADW - 4, t: cen[(DRAW.hash(i) * cen.length) | 0], seed: i }); continue; }
        const h = DRAW.hash(i * 3.1 + s * 17); if (h < 0.25 && v.main) continue; const t = cen[(DRAW.hash(i + s * 7) * cen.length) | 0];
        const wide = t === 'cana' || t === 'canafogo' || t === 'soja' || t === 'algodao' || t === 'posto' || t === 'predio' || t === 'ministerio' || t === 'carreta';
        list.push({ dz, wx: X[n] + s * (ROADW + (wide ? 9 : 4.5) + h * (wide ? 3 : 9)), t, seed: i * 2 + s });
      }
    }
    for (const e of G.ents) { if (e.dead || e.st === 'latch') continue; const dz = dir * (e.z - v.camZ); if (dz < 0.9 || dz > maxD) continue; list.push({ dz, wx: center(dz) + e.x, e }); }
    const b = G.boss; if (b && b.parts && b.fase !== 3 && b.fase !== 4) { const dz = dir * (P.z + b.rel - v.camZ); if (dz > 1.2 && dz < maxD + 200) list.push({ dz: Math.min(dz, maxD - 1), rdz: dz, wx: center(Math.min(dz, maxD - 1)) + b.x, boss: b }); }
    if (G.haz) for (const h of G.haz) { const dz = dir * (h.z - v.camZ); if (dz > 1 && dz < maxD) list.push({ dz, wx: center(dz) + h.x, haz: h }); }
    list.sort((a, b) => b.dz - a.dz);
    const falc = G.abil.on > 0 && S.cls === 'falcao' && v.main, glowOn = v.main && G.night;
    if (v.main) { glowList.length = 0; occl.length = 0; } let di = 0;
    for (const s of list) {
      const dzr = s.rdz || s.dz, k = F / dzr, sx = W / 2 + pan + fs * (s.wx - v.camX) * (F / s.dz) * (s.rdz ? s.dz / dzr : 1), sy = hor + camH * k, f = fogF(s.dz / maxD);
      if (sx < -W * 0.6 || sx > W * 1.6) continue;
      // inimigos e obstáculos ficam opacos (a névoa entra como mistura de cor) e só somem no fim da visão; cenário continua esmaecendo
      const al = s.boss ? Math.max(0.35, 1 - f * 0.8) : s.e ? Math.min(1, (1 - s.dz / maxD) * 7) : 1 - f; if (al < 0.04) continue; c.globalAlpha = al;
      if (s.haz) { const h = s.haz, rx = h.r * k, ry = Math.max(1.5, h.r * camH * k / s.dz * 1.4);
        if (h.kind === 'fogo') { if (h.t > h.delay) { c.fillStyle = `rgba(255,${110 + Math.sin(G.t * 20 + h.x) * 50 | 0},10,0.8)`; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(sx - rx, sy); c.lineTo(sx - rx * 0.3, sy - rx * (1 + Math.sin(G.t * 14 + h.z) * 0.3)); c.lineTo(sx, sy - rx * 0.4); c.lineTo(sx + rx * 0.4, sy - rx * (1.2 + Math.cos(G.t * 11) * 0.3)); c.lineTo(sx + rx, sy); c.fill(); } else { c.strokeStyle = '#ff8a1a'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.stroke(); } }
        else if (!h.done) { const p = h.t / h.delay; c.fillStyle = `rgba(0,0,0,${0.25 + p * 0.4})`; c.beginPath(); c.ellipse(sx, sy, rx * (0.4 + p * 0.6), ry * (0.4 + p * 0.6), 0, 0, 7); c.fill(); c.strokeStyle = Math.sin(G.t * 20) > 0 ? '#ff2a2a' : '#ffd040'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.stroke(); c.fillStyle = '#5a4a3a'; const fy = sy - (1 - p) * (1 - p) * H * 0.9; c.fillRect(sx - rx * 0.5, fy - rx * 0.6, rx, rx * 0.6); }
        continue; }
      c.save(); c.translate(sx, sy); c.scale(k, k); di++;
      if (s.boss) { BOSS.draw(c, G.t, b.front); c.restore(); if (glowOn) occl.push([di, sx - b.w * k / 2, sy - b.h * k, sx + b.w * k / 2, sy]); if (v.main) { b.sx = sx; b.sy = sy; b.sh = b.h * k; b.k = k; b.vf = G.frame; if (!(b.key === 'reidograu' && b.front)) for (const p of b.parts) if (!p.dead && p.vuln) G.hits.push({ part: p, x: sx + (p.ox - p.w / 2) * k - 2, y: sy - (p.oy + p.h) * k - 2, w: p.w * k + 4, h: p.h * k + 4, dz: dzr }); } continue; }
      if (s.e) { const e = s.e, d = ENEMY[e.type], hpx = d.h * k, lod = hpx < 9 ? 0 : hpx < 30 ? 1 : 2;
        DRAW.fog(fogc, f);
        if (e.type === 'rampa') { DRAW.R(c, -9, -0.2, 18, 0.2, '#666'); c.fillStyle = '#4a4f55'; c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(3.5, 0); c.lineTo(3, -2.6); c.lineTo(-3, -2.6); c.fill(); c.fillStyle = '#e8c020'; c.fillRect(-3.2, -0.5, 6.4, 0.2); c.fillStyle = '#3a3f44'; c.fillRect(-16, -9, 32, 5); c.fillStyle = '#c22'; c.fillRect(-16, -5, 32, 0.6); c.fillStyle = '#ddd'; c.fillRect(4, -13, 6, 4); }
        else if (e.type === 'boi') DRAW.boi(c, e, G.t, lod);
        else if (d.veh || d.estatico) DRAW.vehicle(c, e, G.t, dir < 0 || e.type === 'buggy' || e.type === 'carrobomba');
        else DRAW.zombie(c, e, G.t, lod);
        DRAW.fog(null);
        if (glowOn) { if (d.veh || d.estatico) occl.push([di, sx - d.w * k / 2, sy - d.h * k, sx + d.w * k / 2, sy]); else glowList.push({ e, sx, sy, k, lod, f, fc: fogc, i: di }); }
        if (e.flash > 0) { c.globalAlpha = 0.6; c.fillStyle = '#fff'; c.fillRect(-d.w / 2, -d.h, d.w, d.h); }
        if (falc && !d.estatico) { c.globalAlpha = 0.9; c.fillStyle = '#ff1a1a'; if (d.veh) { c.fillRect(-d.w / 2, -d.h * 0.2, d.w * 0.25, d.h * 0.2); c.fillRect(d.w / 4, -d.h * 0.2, d.w * 0.25, d.h * 0.2); } else c.fillRect(-0.2, -d.h, 0.4, d.h * 0.22); }
        c.restore();
        if (v.main) { e.sx = sx; e.sy = sy; e.sh = hpx; e.vf = G.frame; if (!d.estatico) G.hits.push({ e, x: sx - d.w * k * 0.6, y: sy - hpx * 1.05, w: d.w * k * 1.2, h: hpx * 1.05, dz: s.dz }); }
        continue; }
      DRAW.scenery(c, s.t, s.seed, G.t, s.st); c.restore();
    }
    c.globalAlpha = 1;
    if (b && b.chainOn && v.main && b.esc) { const es = b.esc.filter(e => !e.dead && e.vf === G.frame); if (es.length === 2) { c.strokeStyle = `rgb(255,${100 + Math.sin(G.t * 30) * 60 | 0},20)`; c.lineWidth = 5; c.beginPath(); c.moveTo(es[0].sx, es[0].sy - es[0].sh * 0.5); c.quadraticCurveTo(W / 2, H * 0.62, es[1].sx, es[1].sy - es[1].sh * 0.5); c.stroke(); } }
    if (b && b.cable && v.main && b.vf === G.frame) { c.strokeStyle = '#c8c8c8'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.sx, b.sy - b.k * 1); c.lineTo(W / 2 + pan, H * 0.72); c.stroke(); }
  }

  function atmosphere(c, W, H, hor, pan, no3dNight) {
    const cl = G.clima;
    if (G.night && !no3dNight) { const lv = P.lights, r1 = H * (lv === 2 ? 0.95 : lv === 1 ? 0.62 : 0.2), cx = W / 2 + pan, cy = hor + H * 0.16; const g = c.createRadialGradient(cx, cy, H * 0.06, cx, cy, r1); g.addColorStop(0, 'rgba(255,240,200,0.05)'); g.addColorStop(0.5, 'rgba(4,6,12,0.45)'); g.addColorStop(1, 'rgba(2,3,8,0.94)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (cl === 'chuva') { c.fillStyle = 'rgba(60,70,85,0.22)'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(200,215,230,0.45)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * H; c.moveTo(x, y); c.lineTo(x - 8 - P.steer * 10, y + 34); } c.stroke(); }
    else if (cl === 'fumaca' || cl === 'queimada') { c.fillStyle = cl === 'fumaca' ? 'rgba(30,18,10,0.35)' : 'rgba(90,50,20,0.3)'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffb040'; for (let i = 0; i < 26; i++) { const x = (Math.sin(i * 91.7 + G.t * (0.6 + i % 5 * 0.2)) * 0.5 + 0.5) * W, y = ((i * 53 + G.t * (90 + i % 7 * 30)) % H); c.fillRect(x, H - y, 2.5, 2.5); } }
    else if (cl === 'areia') { c.fillStyle = 'rgba(200,160,70,0.32)'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(240,210,140,0.3)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * H; c.moveTo(x, y); c.lineTo(x + 60, y + 4); } c.stroke(); }
    else if (cl === 'neblina') { c.fillStyle = 'rgba(120,130,140,0.14)'; c.fillRect(0, 0, W, H); }
  }

  /* ---------- cockpit do Piloto ---------- */
  function gauge(cx, cy, r, val, red, label, txt) {
    c.fillStyle = '#0c0c0c'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 2; c.stroke();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; c.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82); c.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95); } c.stroke();
    if (red != null) { c.strokeStyle = '#d22'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r * 0.9, a0 + (a1 - a0) * red, a1); c.stroke(); }
    const a = a0 + (a1 - a0) * clamp(val, 0, 1.05); c.strokeStyle = '#ff5a1a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); c.stroke();
    c.fillStyle = '#aaa'; c.font = `${r * 0.26 | 0}px Arial`; c.textAlign = 'center'; c.fillText(label, cx, cy + r * 0.62); if (txt) { c.fillStyle = '#e8e0c0'; c.font = `bold ${r * 0.36 | 0}px Arial`; c.fillText(txt, cx, cy - r * 0.22); }
  }
  function windshield(dashY, is3d) {
    const u = S.up;
    // gotas / sangue / ácido / óleo
    if (P.rain > 0.05) { c.fillStyle = `rgba(190,205,220,${P.rain * 0.3})`; c.fillRect(0, 0, W, dashY); c.fillStyle = `rgba(220,230,240,${P.rain * 0.55})`; for (let i = 0; i < 46 * P.rain; i++) { const x = DRAW.hash(i + (G.t * 2 | 0)) * W, y = DRAW.hash(i * 3 + (G.t * 2 | 0)) * dashY; c.beginPath(); c.ellipse(x, y, 3, 5, 0, 0, 7); c.fill(); } }
    const ba = Math.min(1, 0.35 + P.blood);
    for (const s of P.splats) { c.fillStyle = s.cor; c.globalAlpha = ba; c.beginPath(); c.ellipse(s.x * W, s.y * dashY, s.r * W, s.r * W * 0.7, 0, 0, 7); c.fill(); c.fillRect(s.x * W - 2, s.y * dashY, 4, s.r * W * 2.2); }
    c.globalAlpha = 1;
    if (P.blood > 0.55) { c.fillStyle = `rgba(110,8,8,${(P.blood - 0.55) * 1.3})`; c.fillRect(0, 0, W, dashY); }
    if (P.acid > 0.02) { c.fillStyle = `rgba(110,190,30,${P.acid * 0.82})`; c.fillRect(0, 0, W, dashY); c.fillStyle = `rgba(170,230,60,${P.acid * 0.5})`; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(DRAW.hash(i * 7) * W, DRAW.hash(i * 13) * dashY, 20 + DRAW.hash(i) * 30, 0, 7); c.fill(); } }
    if (P.oil > 0.02) { c.fillStyle = `rgba(8,6,4,${P.oil * 0.9})`; c.fillRect(0, 0, W, dashY); }
    for (const k of P.cracks) { c.strokeStyle = 'rgba(235,240,245,0.75)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 9; i++) { const a = k.a + i * 0.7, r = k.r * W * (0.5 + DRAW.hash(i + k.a) * 0.9); c.moveTo(k.x * W, k.y * dashY); c.lineTo(k.x * W + Math.cos(a) * r * 0.5, k.y * dashY + Math.sin(a) * r * 0.5); c.lineTo(k.x * W + Math.cos(a + 0.2) * r, k.y * dashY + Math.sin(a + 0.2) * r); } c.stroke(); c.beginPath(); c.arc(k.x * W, k.y * dashY, k.r * W * 0.4, 0, 7); c.stroke(); }
    if (u.janela === 1 && !is3d) { c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 1.5; c.beginPath(); for (let x = 0; x < W; x += 26) { c.moveTo(x, 0); c.lineTo(x, dashY); } for (let y = 0; y < dashY; y += 26) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
    if (u.janela >= 2 && !is3d) { c.fillStyle = '#23211e'; c.fillRect(0, 0, W, H * 0.3); c.fillRect(0, H * 0.5, W, dashY - H * 0.5); c.fillStyle = '#3a3733'; for (let x = 20; x < W; x += 70) { c.beginPath(); c.arc(x, H * 0.285, 4, 0, 7); c.arc(x, H * 0.515, 4, 0, 7); c.fill(); } c.fillStyle = '#181614'; c.fillRect(0, H * 0.295, W, 5); c.fillRect(0, H * 0.5, W, 5); }
    // limpadores
    if (P.wipe > 0 && is3d) { c.fillStyle = 'rgba(200,220,240,0.1)'; c.fillRect(0, 0, W, dashY); }
    else if (P.wipe > 0) { const a = Math.sin((1.3 - P.wipe) / 1.3 * Math.PI * 2) * 0.5 + 0.5; c.strokeStyle = '#0a0a0a'; c.lineWidth = 6; for (const bx of [W * 0.3, W * 0.62]) { const ang = -Math.PI * 0.95 + a * Math.PI * 0.62; c.beginPath(); c.moveTo(bx, dashY); c.lineTo(bx + Math.cos(ang) * H * 0.5, dashY + Math.sin(ang) * H * 0.5); c.stroke(); } c.fillStyle = 'rgba(200,220,240,0.12)'; c.fillRect(0, 0, W, dashY); }
  }
  // onde cada agarrado aparece na tela (o mesmo cálculo serve ao desenho 2D, ao 3D e aos retângulos de tiro)
  function latchPlace(scale, yb, forGunner) {
    const out = [];
    for (const e of G.ents) {
      if (e.dead || e.st !== 'latch') continue;
      let x, y = yb, k = scale; const side = forGunner ? e.side * A.look : e.side;
      if (e.side === 0) { if (forGunner && A.look < 0) continue; x = W / 2 + Math.sin(e.t * 9) * 5; if (forGunner) { k *= 0.7; y = H * 0.98; } else y = yb + Math.abs(Math.sin(e.t * 2.86)) * 14; } else { x = side < 0 ? W * 0.085 : W * 0.915; x += Math.sin(e.t * 7 + e.id) * 4; }
      out.push({ e, x, y, k });
    }
    return out;
  }
  function drawLatchers(scale, yb, forGunner) {
    for (const L of latchPlace(scale, yb, forGunner)) {
      const e = L.e, d = ENEMY[e.type], x = L.x, y = L.y, k = L.k;
      if (!frame3D || d.veh) { c.save(); c.translate(x, y); c.scale(k, k); if (d.veh) DRAW.vehicle(c, e, G.t, false); else DRAW.zombie(c, e, G.t, 2); c.restore(); }
      if (e.flash > 0 && !frame3D) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - d.w * k / 2, y - d.h * k, d.w * k, d.h * k); }
      if (forGunner || G.cam === 'tpp') G.hits.push({ e, x: x - d.w * k * 0.7, y: y - d.h * k, w: d.w * k * 1.4, h: d.h * k, dz: 1.5 });
      e.sx = x; e.sy = y; e.sh = d.h * k; e.vf = G.frame;
    }
  }
  function mirrors() {
    if (frame3D) {   // espelhos em 3D: a vista de trás é desenhada pelo WebGL e o 2D só faz as molduras (vidro vazado)
      const camH = [0, 1.2, 1.25, 1.5, 2.0, 2.6][S.veh], rv = { W: 360, H: 90, hor: 34, F: 200, dir: -1, flip: false, camX: P.x, camZ: P.z - 1, camH, N: Math.min(34, viewN), main: false };
      const rects = [[W * 0.39, H * 0.045, W * 0.22, H * 0.085, 60, 240, true], [W * 0.012, H * 0.215, W * 0.105, H * 0.11, 0, 150, !!P.mirrorL], [W * 0.883, H * 0.215, W * 0.105, H * 0.11, 210, 150, true]];
      const okm = W3D.mirror(rv, G.frame % 2 === 0, rects.filter(r => r[6]), Math.round(360 * MS), Math.round(90 * MS), W, H);
      for (const r of rects) {
        const [x, y, w, h] = r; c.fillStyle = '#0a0a0a'; c.fillRect(x - 4, y - 4, w + 8, h + 8);
        if (r[6] && okm) { c.clearRect(x, y, w, h); c.fillStyle = 'rgba(180,200,220,0.06)'; c.fillRect(x, y, w, h * 0.4); }
        else { c.fillStyle = '#15181a'; c.fillRect(x, y, w, h); c.strokeStyle = '#789'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 7; i++) { c.moveTo(x + w / 2, y + h / 2); c.lineTo(x + DRAW.hash(i) * w, y + DRAW.hash(i * 5) * h); } c.stroke(); }
      }
      if (S.up.pneu >= 2) { c.fillStyle = '#bbb'; c.fillRect(W * 0.1, H * 0.31, 10, 3); c.fillRect(W * 0.885, H * 0.31, 10, 3); }
      return;
    }
    if (G.frame % 2 === 0) { mc.setTransform(MS, 0, 0, MS, 0, 0); const camH = [0, 1.2, 1.25, 1.5, 2.0, 2.6][S.veh]; world(mc, { W: 360, H: 90, hor: 34, F: 200, dir: -1, flip: false, camX: P.x, camZ: P.z - 1, camH, N: Math.min(34, viewN), main: false }); if (G.night) { mc.fillStyle = 'rgba(2,3,8,0.6)'; mc.fillRect(0, 0, 360, 90); } }
    const frame = (x, y, w, h, sx, sw, broken) => { c.fillStyle = '#0a0a0a'; c.fillRect(x - 4, y - 4, w + 8, h + 8); if (broken) { c.fillStyle = '#15181a'; c.fillRect(x, y, w, h); c.strokeStyle = '#789'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 7; i++) { c.moveTo(x + w / 2, y + h / 2); c.lineTo(x + DRAW.hash(i) * w, y + DRAW.hash(i * 5) * h); } c.stroke(); } else c.drawImage(mcv, sx * MS, 0, sw * MS, 90 * MS, x, y, w, h); };
    frame(W * 0.39, H * 0.045, W * 0.22, H * 0.085, 60, 240, false);
    frame(W * 0.012, H * 0.215, W * 0.105, H * 0.11, 0, 150, !P.mirrorL); frame(W * 0.883, H * 0.215, W * 0.105, H * 0.11, 210, 150, false);
    if (S.up.pneu >= 2) { c.fillStyle = '#bbb'; c.fillRect(W * 0.1, H * 0.31, 10, 3); c.fillRect(W * 0.885, H * 0.31, 10, 3); }
  }
  // a cabine/arma 3D só substituem o 2D quando o WebGL desenhou este quadro (se o contexto cair, volta tudo para o 2D)
  let frame3D = false;
  const cab3 = () => frame3D && typeof CAB3D !== 'undefined', vm3 = () => frame3D && typeof VM3D !== 'undefined';
  /* cabine 3D: o 2D só põe o que fica no vidro (sangue, chuva, ácido, óleo, rachaduras) recortado no contorno do para-brisa,
     a fumaça das saídas de ar e a área de toque do rádio */
  function cockpit3D() {
    const poly = CAB3D.poly; if (!poly) return;
    const dashY = Math.max(poly[0][1], poly[1][1]);
    drawLatchers(H * 0.4, CAB3D.dashY + H * 0.03, false);   // posição na tela dos agarrados (efeitos, marcações)
    c.save(); c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < 4; i++) c.lineTo(poly[i][0], poly[i][1]); c.closePath(); c.clip();
    windshield(dashY, true); c.restore();
    G.radioRect = CAB3D.radioRect;
    const vs = CAB3D.vents; if (P.over && vs) for (const p of vs) if (Math.random() < 0.4) puffs.push({ x: p[0], y: p[1], r: 6, l: 1 });
    for (const p of puffs) { p.y -= 1.4; p.r += 0.6; p.l -= 0.02; c.fillStyle = `rgba(200,200,200,${p.l * 0.3})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); } puffs = puffs.filter(p => p.l > 0); if (puffs.length > 80) puffs.splice(0, 20);
    if (S.veh === 4) { c.fillStyle = 'rgba(160,10,10,0.08)'; c.fillRect(0, 0, W, H); }
  }
  function cockpit(sh) {
    if (cab3()) { cockpit3D(); return; }
    const dashY = H * 0.64 + sh, v = VEHICLES[S.veh], u = S.up, cl = cls(), t = G.t;
    // capô
    const hoodH = [0, 0.085, 0.09, 0.1, 0.05, 0.04][S.veh] * H, hc = rgb(v.cor), hcol = `rgb(${hc[0] * 0.75 | 0},${hc[1] * 0.75 | 0},${hc[2] * 0.75 | 0})`;
    if (!frame3D) { c.fillStyle = hcol; c.beginPath(); c.moveTo(W * 0.1, dashY + 2); c.lineTo(W * 0.2, dashY - hoodH); c.lineTo(W * 0.8, dashY - hoodH); c.lineTo(W * 0.9, dashY + 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(W * 0.3, dashY - hoodH, W * 0.4, 3); }
    const hy = dashY - hoodH;
    if (u.frente >= 1) { c.fillStyle = '#2a2a2a'; c.fillRect(W * 0.22, hy - 6, W * 0.56, 6); if (u.frente >= 3) { c.beginPath(); c.moveTo(W * 0.24, hy - 6); c.lineTo(W * 0.5, hy - 26); c.lineTo(W * 0.76, hy - 6); c.fill(); } else if (u.frente >= 2) c.fillRect(W * 0.22, hy - 16, W * 0.56, 12); }
    if (u.serra > 0 || u.frente >= 4) { const nb = u.frente >= 4 ? 6 : u.serra; for (let i = 0; i < nb; i++) { const bx = W * (0.5 + (i - (nb - 1) / 2) * (nb > 2 ? 0.09 : 0.2)), j = P.saws ? Math.sin(t * 90 + i) * 1.5 : 0; c.fillStyle = '#c85a1a'; c.fillRect(bx - 12, hy - 8 + j, 24, 10); c.fillStyle = '#999'; c.fillRect(bx - 4, hy - 46 + j, 8, 40); c.fillStyle = '#222'; for (let k = 0; k < 6; k++) c.fillRect(bx - 6, hy - 44 + k * 7 + (P.saws ? (t * 200 % 7) : 0) + j, 12, 2); if (P.saws) { if (G.frame % 3 === 0) fxSpark(bx, hy - 40, 1); c.fillStyle = 'rgba(120,140,200,0.12)'; c.beginPath(); c.arc(bx, hy - 30, 22, 0, 7); c.fill(); } } }
    if (u.capo > 0) { const j = P.gfire > 0 ? rnd(-2, 2) : 0, hot = P.gheat; c.fillStyle = hot > 0.7 ? `rgb(${90 + hot * 160 | 0},40,20)` : '#151515'; c.beginPath(); c.moveTo(W * 0.5 - 9 + j, dashY); c.lineTo(W * 0.5 - 4 + j, hy - 10); c.lineTo(W * 0.5 + 4 + j, hy - 10); c.lineTo(W * 0.5 + 9 + j, dashY); c.fill(); if (P.gfire > 0) { c.fillStyle = 'rgba(255,220,120,0.9)'; c.beginPath(); c.arc(W / 2, hy - 16, 16 + u.capo * 3, 0, 7); c.fill(); } }
    c.fillStyle = '#0a0a0a'; c.fillRect(W / 2 - 1.5, hy - 22, 3, 14); c.fillRect(W / 2 - 7, hy - 9, 14, 3);
    // inimigos no capô/portas + para-brisa
    drawLatchers(H * 0.4, dashY + H * 0.04, false);
    windshield(dashY);
    // colunas e teto
    c.fillStyle = '#121110'; c.fillRect(0, 0, W, H * 0.035 + sh * 0.3);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.16, 0); c.lineTo(W * 0.115, dashY); c.lineTo(W * 0.0, dashY); c.fill(); c.beginPath(); c.moveTo(W, 0); c.lineTo(W * 0.84, 0); c.lineTo(W * 0.885, dashY); c.lineTo(W, dashY); c.fill();
    c.fillStyle = '#c9b060'; c.fillRect(W * 0.17, H * 0.05, 26, 20); c.fillStyle = '#2a6a3a'; c.fillRect(W * 0.17 + 30, H * 0.05, 20, 20); c.fillStyle = '#111'; c.font = '7px Arial'; c.textAlign = 'left'; c.fillText('SEM', W * 0.17 + 3, H * 0.05 + 9); c.fillText('PARAR', W * 0.17 + 1, H * 0.05 + 17);
    mirrors();
    // penduricalho (terço) com física
    const pa = -P.steer * 0.45 + Math.sin(t * 3) * 0.05 * Math.min(1, P.speed / 10) + G.shake * Math.sin(t * 40) * 0.1, px = W * 0.5, py = H * 0.135, L = H * 0.12;
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.sin(pa) * L, py + Math.cos(pa) * L); c.stroke(); const ex = px + Math.sin(pa) * L, ey = py + Math.cos(pa) * L;
    if (cl.id === 'cobra' || cl.id === 'falcao') { c.fillStyle = '#b22'; c.beginPath(); c.ellipse(ex, ey + 8, 7, 10, pa, 0, 7); c.fill(); } else if (cl.id === 'graxa') { c.fillStyle = '#eee'; c.fillRect(ex - 7, ey, 14, 14); c.fillStyle = '#111'; c.fillRect(ex - 3, ey + 4, 2, 2); c.fillRect(ex + 2, ey + 9, 2, 2); } else { c.fillStyle = '#c9a030'; c.fillRect(ex - 1.5, ey, 3, 16); c.fillRect(ex - 6, ey + 4, 12, 3); }
    // painel
    c.fillStyle = '#17150f'; c.beginPath(); c.moveTo(0, dashY); c.quadraticCurveTo(W * 0.5, dashY - 12, W, dashY); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#211e17'; c.beginPath(); c.moveTo(W * 0.255, dashY + 6); c.quadraticCurveTo(W * 0.4, dashY - 22, W * 0.545, dashY + 6); c.lineTo(W * 0.545, H * 0.93); c.lineTo(W * 0.255, H * 0.93); c.fill();
    const gy = dashY + H * 0.115, gr = H * 0.085;
    gauge(W * 0.345, gy, gr, P.rpm, 0.8, 'RPM x1000', '' + P.gear);
    gauge(W * 0.46, gy, gr, Math.abs(P.speed) * 3.6 / 200, null, 'km/h', '' + Math.round(Math.abs(P.speed) * 3.6));
    gauge(W * 0.282, gy + gr * 0.5, gr * 0.5, P.fuel, null, 'COMB');
    gauge(W * 0.523, gy + gr * 0.5, gr * 0.5, P.temp / 1.15, 0.85, 'TEMP');
    // luzes de alerta
    const led = (x, on, cor, txt) => { c.fillStyle = on ? cor : '#2a2a26'; c.beginPath(); c.arc(x, dashY + H * 0.022, 6, 0, 7); c.fill(); c.fillStyle = on ? '#fff' : '#555'; c.font = 'bold 8px Arial'; c.textAlign = 'center'; c.fillText(txt, x, dashY + H * 0.022 + 16); };
    const bl = Math.sin(t * 16) > 0;
    led(W * 0.32, G.led.L > 0 && bl, '#ff3a1a', '◀ ESQ'); led(W * 0.40, G.led.H > 0 && bl, '#ffb020', 'CAPÔ'); led(W * 0.48, G.led.R > 0 && bl, '#ff3a1a', 'DIR ▶');
    led(W * 0.36, P.over && bl, '#ff2a2a', 'TEMP'); led(W * 0.44, P.fuel < 0.15 && bl, '#ffb020', 'COMB');
    // blindagem (régua de LEDs soldada no painel)
    const ar = P.armor / G.V.armorMax; c.fillStyle = '#0c0c0c'; c.fillRect(W * 0.29, H * 0.905, W * 0.25, 12); for (let i = 0; i < 14; i++) { c.fillStyle = i / 14 < ar ? (ar < 0.3 ? '#e22' : ar < 0.6 ? '#e8a020' : '#4ac04a') : '#222'; c.fillRect(W * 0.292 + i * W * 0.0176, H * 0.908, W * 0.0145, 8); } c.fillStyle = (P.tires && u.pneu < 1) ? '#f84' : '#888'; c.font = '8px Arial'; c.textAlign = 'left'; c.fillText('BLINDAGEM' + (P.tires && u.pneu < 1 ? '   ⚠ PNEU FURADO x' + P.tires : ''), W * 0.292, H * 0.9);
    // rádio (toque para trocar de estação)
    const rx = W * 0.565, ry = dashY + H * 0.05, rw = W * 0.15, rh = H * 0.1; G.radioRect = [rx, ry, rw, rh];
    c.fillStyle = '#0a0a0a'; c.fillRect(rx, ry, rw, rh); c.fillStyle = '#12301a'; c.fillRect(rx + 8, ry + 6, rw - 44, rh - 12); const r = RADIO[G.radio]; c.fillStyle = '#6aff8a'; c.font = 'bold 11px monospace'; c.textAlign = 'left'; c.fillText(G.radio === 0 ? (G.st.musica || '').toUpperCase() + ' · AUTO' : r.nome, rx + 13, ry + 20, rw - 50); c.font = '10px monospace'; c.fillText(r.freq + '  ' + '▮'.repeat(1 + (Math.abs(Math.sin(t * 6)) * 6 | 0)), rx + 13, ry + 36);
    c.fillStyle = '#333'; c.beginPath(); c.arc(rx + rw - 18, ry + rh / 2, 11, 0, 7); c.fill(); c.fillStyle = '#888'; c.fillRect(rx + rw - 19, ry + rh / 2 - 10, 2, 8);
    // saídas de ar (fumaça ao ferver)
    for (const vx of [W * 0.553, W * 0.735]) { c.fillStyle = '#0a0a0a'; c.fillRect(vx - 12, dashY + H * 0.03, 24, 30); c.strokeStyle = '#333'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(vx - 10, dashY + H * 0.03 + 5 + i * 7); c.lineTo(vx + 10, dashY + H * 0.03 + 5 + i * 7); c.stroke(); } if (P.over && Math.random() < 0.4) puffs.push({ x: vx, y: dashY + H * 0.04, r: 6, l: 1 }); }
    // mapa de papel no porta-luvas
    const mx = W * 0.8, my = dashY + H * 0.06, mw = W * 0.15, mh = H * 0.2; c.save(); c.translate(mx, my); c.rotate(0.04); c.fillStyle = '#d8cfae'; c.fillRect(0, 0, mw, mh); c.strokeStyle = '#8a8266'; c.lineWidth = 1; c.beginPath(); c.moveTo(mw * 0.45, mh * 0.05); c.lineTo(mw * 0.95, mh * 0.2); c.lineTo(mw * 0.8, mh * 0.6); c.lineTo(mw * 0.55, mh * 0.95); c.lineTo(mw * 0.35, mh * 0.7); c.lineTo(mw * 0.08, mh * 0.4); c.lineTo(mw * 0.25, mh * 0.12); c.closePath(); c.stroke();
    const pts = [[0.5, 0.82], [0.53, 0.76], [0.5, 0.68], [0.47, 0.6], [0.54, 0.56], [0.62, 0.45], [0.66, 0.42], [0.78, 0.3], [0.82, 0.26], [0.84, 0.22], [0.86, 0.12]]; const done = (G.arena ? 3 : S.stage) + G.prog;
    c.strokeStyle = '#c22'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i === 0) c.moveTo(p[0] * mw, p[1] * mh); else if (i <= done) c.lineTo(p[0] * mw, p[1] * mh); else { const q = pts[i - 1], f = clamp(done - (i - 1), 0, 1); c.lineTo((q[0] + (p[0] - q[0]) * f) * mw, (q[1] + (p[1] - q[1]) * f) * mh); break; } } c.stroke(); c.fillStyle = '#333'; for (const p of pts) c.fillRect(p[0] * mw - 1.5, p[1] * mh - 1.5, 3, 3); c.font = '7px Arial'; c.textAlign = 'left'; c.fillText('BAURU', mw * 0.2, mh * 0.87); c.fillText('FORTALEZA', mw * 0.5, mh * 0.08); c.restore();
    // volante + mãos
    const wx = W * 0.4, wy = H * 1.03, wr = H * 0.25; c.save(); c.translate(wx, wy); c.rotate(P.steer * 1.5);
    // volante com aro de couro (brilho em cima) e raios
    c.strokeStyle = '#0c0c0c'; c.lineWidth = H * 0.046; c.beginPath(); c.arc(0, 0, wr, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(120,118,112,0.55)'; c.lineWidth = H * 0.009; c.beginPath(); c.arc(0, 0, wr - H * 0.011, -Math.PI * 0.95 - P.steer * 1.5, -Math.PI * 0.05 - P.steer * 1.5); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = H * 0.006; c.beginPath(); c.arc(0, 0, wr + H * 0.018, 0, 7); c.stroke();
    c.lineWidth = H * 0.03; c.strokeStyle = '#141414'; c.beginPath(); c.moveTo(-wr, 0); c.lineTo(wr, 0); c.moveTo(0, 0); c.lineTo(0, wr); c.stroke();
    const hg = c.createRadialGradient(-wr * 0.08, -wr * 0.08, 0, 0, 0, wr * 0.27); hg.addColorStop(0, '#3a3a3a'); hg.addColorStop(1, '#0e0e0e'); c.fillStyle = hg; c.beginPath(); c.arc(0, 0, wr * 0.25, 0, 7); c.fill();
    for (const s of [-1, 1]) { const a = -Math.PI / 2 + s * 0.85, hx = Math.cos(a) * wr, hyy = Math.sin(a) * wr; DRAW.limb(c, hx + s * wr * 0.5, hyy + wr * 1.1, hx + s * 8, hyy + 26, H * 0.08, H * 0.07, cl.sleeve); DRAW.limb(c, hx + s * 8, hyy + 28, hx, hyy + 6, H * 0.058, H * 0.05, cl.skin); DRAW.fist(c, hx, hyy, H * 0.042, cl.glove); if (s < 0) { c.fillStyle = cl.id === 'falcao' ? '#111' : cl.id === 'cobra' ? '#3a4a2a' : cl.id === 'graxa' ? '#888' : '#c9b060'; c.fillRect(hx - 16, hyy + 22, 26, 9); } if (cl.id === 'trovao' && s > 0) { c.fillStyle = '#2a4a8a'; c.beginPath(); c.ellipse(hx + 18, hyy + 50, 7, 12, 0.3, 0, 7); c.fill(); } }
    c.lineCap = 'butt'; c.restore();
    // fumaça das saídas de ar
    for (const p of puffs) { p.y -= 1.4; p.r += 0.6; p.l -= 0.02; c.fillStyle = `rgba(200,200,200,${p.l * 0.3})`; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); } puffs = puffs.filter(p => p.l > 0); if (puffs.length > 80) puffs.splice(0, 20);
    if (S.veh === 4) { c.fillStyle = 'rgba(160,10,10,0.10)'; c.fillRect(0, 0, W, H); }
  }

  /* ---------- visão do artilheiro ---------- */
  function gunnerView() {
    const cl = cls(), v = VEHICLES[S.veh], t = G.t;
    if (!A.exposed || A.down > 0) {
      c.fillStyle = '#14110e'; c.fillRect(0, H * 0.34, W, H); c.fillRect(0, 0, W * 0.5, H); c.fillRect(W * 0.93, 0, W, H); c.fillRect(0, 0, W, H * 0.07);
      c.fillStyle = S.veh === 4 ? 'rgba(120,10,10,0.25)' : 'rgba(0,0,0,0.2)'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#3a2a1c'; c.fillRect(W * 0.04, H * 0.42, W * 0.4, H * 0.6); c.fillStyle = '#2c2016'; for (let i = 0; i < 5; i++) c.fillRect(W * 0.04, H * 0.42 + i * H * 0.11, W * 0.4, 4); c.strokeStyle = '#c9b88a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.2, H * 0.5); c.lineTo(W * 0.26, H * 0.62); c.lineTo(W * 0.23, H * 0.7); c.stroke();
      DRAW.hands(c, W, H, cl, 'cover', W / 2, H / 2, { t });
      c.fillStyle = '#c9b88a'; c.font = 'bold 15px Arial'; c.textAlign = 'center'; c.fillText(A.down > 0 ? 'FERIDO — recuperando (' + Math.ceil(A.down) + 's)' : A.reloadT > 0 ? 'Recarregando em cobertura...' : 'EM COBERTURA — toque em EXPOR para combater', W / 2, H * 0.3 + 60);
      if (Math.random() < 0.02) SFX.ric();
      return;
    }
    // moldura do veículo conforme o assento (no 3D a própria lataria, as chapas e a arma são desenhadas pelo WebGL)
    const hc = rgb(v.cor), col = `rgb(${hc[0] * 0.6 | 0},${hc[1] * 0.6 | 0},${hc[2] * 0.6 | 0})`, seat = A.seat, side = seat === 0 ? 1 : seat === 1 ? -1 : 0, sd = side * A.look, v3d = vm3();
    c.fillStyle = col;
    if (v3d) { /* lataria 3D */ }
    else
    if (seat === 2) { c.beginPath(); c.moveTo(W * 0.2, H); c.lineTo(W * 0.3, H * 0.9); c.lineTo(W * 0.7, H * 0.9); c.lineTo(W * 0.8, H); c.fill(); }
    else if (sd > 0) { c.beginPath(); c.moveTo(W, H * 0.3); c.lineTo(W * 0.9, H * 0.42); c.lineTo(W * 0.84, H); c.lineTo(W, H); c.fill(); }
    else { c.beginPath(); c.moveTo(0, H * 0.3); c.lineTo(W * 0.1, H * 0.42); c.lineTo(W * 0.16, H); c.lineTo(0, H); c.fill(); }
    if (S.up.lateral >= 2 && seat !== 2 && !v3d) { const bx = sd > 0 ? W * 0.86 : W * 0.06, j = P.saws ? Math.sin(t * 90) * 2 : 0; c.fillStyle = '#c33'; c.fillRect(bx + j, H * 0.86, W * 0.08, 12); }
    drawLatchers(H * 0.46, H * 1.12, true);
    if (v3d) { /* chapas e telas em 3D */ }
    else if (S.veh === 4 && seat !== 2 || S.up.janela >= 2 && seat !== 2) { c.fillStyle = '#100e0c'; c.fillRect(0, 0, W, H * 0.14); c.fillRect(0, H * 0.82, W, H * 0.18); c.fillRect(0, 0, W * 0.07, H); c.fillRect(W * 0.93, 0, W * 0.07, H); }
    else if (S.up.janela === 1 && seat !== 2) { c.strokeStyle = 'rgba(40,40,40,0.35)'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x < W; x += 30) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0; y < H; y += 30) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
    // arma
    const w = WEAPONS[A.w];
    if (v3d) { /* arma e braços em 3D */ }
    else if (A.reloadT > 0 && !A.useMelee) DRAW.hands(c, W, H, cl, 'reload', A.ax, A.ay, { t });
    else if (A.useMelee) { const m = S.melee; DRAW.hands(c, W, H, cl, m === 'serraInd' ? 'serra' : m, A.ax, A.ay, { t, swing: A.swing, rev: A.rev > 0.2, ind: m === 'serraInd' }); }
    else DRAW.hands(c, W, H, cl, w.cat === 'lanca' ? 'lanca40' : w.cat === 'fuzil' ? 'fuzil' : w.cat, A.ax, A.ay, { t, ads: A.ads, kick: A.kick, flash: A.flash > 0, pump: A.pump, hot: A.heat });
    // mira
    if (!A.useMelee && A.ads < 0.5 && S.mode !== 'expresso') { c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; const g = 7 + G.shake * 10 + w.spread * 0.4; c.beginPath(); c.moveTo(A.ax - g - 8, A.ay); c.lineTo(A.ax - g, A.ay); c.moveTo(A.ax + g, A.ay); c.lineTo(A.ax + g + 8, A.ay); c.moveTo(A.ax, A.ay - g - 8); c.lineTo(A.ax, A.ay - g); c.moveTo(A.ax, A.ay + g); c.lineTo(A.ax, A.ay + g + 8); c.stroke(); c.fillStyle = 'rgba(255,60,60,0.9)'; c.fillRect(A.ax - 1, A.ay - 1, 2, 2); }
    if (A.ads >= 0.5 && !A.useMelee) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, W, H * 0.06); c.fillRect(0, H * 0.94, W, H * 0.06); if (!v3d) { c.strokeStyle = '#0a0a0a'; c.lineWidth = 5; c.beginPath(); c.moveTo(A.ax - 20, A.ay + 26); c.lineTo(A.ax - 20, A.ay + 8); c.moveTo(A.ax + 20, A.ay + 26); c.lineTo(A.ax + 20, A.ay + 8); c.moveTo(A.ax - 22, A.ay + 26); c.lineTo(A.ax + 22, A.ay + 26); c.stroke(); c.fillStyle = '#0a0a0a'; c.fillRect(A.ax - 2, A.ay, 4, 22); } { if (w.pen >= 5) { c.strokeStyle = 'rgba(60,255,90,0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(A.ax, A.ay, 60, 0, 7); c.moveTo(A.ax - 80, A.ay); c.lineTo(A.ax + 80, A.ay); c.moveTo(A.ax, A.ay - 80); c.lineTo(A.ax, A.ay + 80); c.stroke(); } } }
    // munição (contador riscado na coronha)
    c.textAlign = 'right'; c.font = 'bold 20px Arial'; c.fillStyle = '#e8e0c0'; c.strokeStyle = '#000'; c.lineWidth = 3;
    const txt = A.useMelee ? MELEE[S.melee].nome : (A.mag[A.w] || 0) + ' / ' + S.ammo[w.ammo]; c.strokeText(txt, W * 0.72, H * 0.07); c.fillText(txt, W * 0.72, H * 0.07);
    c.font = '11px Arial'; const t2 = (A.useMelee ? 'arma branca' : w.nome) + ' · ' + v.seats[A.seat] + (A.look < 0 ? ' · OLHANDO P/ TRÁS' : ''); c.strokeText(t2, W * 0.72, H * 0.1); c.fillText(t2, W * 0.72, H * 0.1);
    if (w.heat && !A.useMelee) { c.fillStyle = '#222'; c.fillRect(W * 0.6, H * 0.115, W * 0.12, 6); c.fillStyle = A.hlock ? '#f22' : '#f80'; c.fillRect(W * 0.6, H * 0.115, W * 0.12 * Math.min(1, A.heat), 6); }
    if (G.gas > 0) { c.fillStyle = `rgba(150,200,90,${Math.min(0.55, G.gas * 0.2)})`; c.fillRect(0, 0, W, H); }
  }

  function hud(role) {
    const t = G.t; c.textAlign = 'center';
    // partículas e traçantes
    for (const tr of G.tracers) { c.strokeStyle = tr.cor; c.lineWidth = 2; c.globalAlpha = Math.min(1, tr.life * 14); c.beginPath(); c.moveTo(tr.x1, tr.y1); c.lineTo(tr.x2, tr.y2); c.stroke(); } c.globalAlpha = 1;
    for (const f of G.fx) { if (f.cor === 'boom') { const p = 1 - f.life / f.max; c.fillStyle = `rgba(255,${200 - p * 150 | 0},${60 - p * 60 | 0},${1 - p})`; c.beginPath(); c.arc(f.x, f.y, f.s * (0.3 + p * 0.9), 0, 7); c.fill(); } else { c.fillStyle = f.cor; c.fillRect(f.x, f.y, f.s, f.s); } }
    if (G.smokeIn > 0.02) { c.fillStyle = `rgba(40,30,25,${G.smokeIn * 0.7})`; c.fillRect(0, 0, W, H); c.fillStyle = `rgba(255,120,20,${G.smokeIn * 0.25})`; c.fillRect(0, H * 0.75, W, H * 0.25); }
    if (G.blind > 0.02) { c.fillStyle = `rgba(255,255,240,${Math.min(0.96, G.blind)})`; c.fillRect(0, 0, W, H); }
    if (G.flash > 0.02) { c.fillStyle = `rgba(255,255,255,${Math.min(1, G.flash)})`; c.fillRect(0, 0, W, H); }
    if (G.hurt > 0.02) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${Math.min(0.7, G.hurt)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (role === 'gunner' && A.hp < 60) { c.fillStyle = `rgba(120,0,0,${(60 - A.hp) / 150})`; c.fillRect(0, 0, W, H); }
    // HUD mínimo fora do cockpit
    if (G.cam === 'tpp' || role === 'gunner') { const ar = P.armor / G.V.armorMax; c.textAlign = 'left'; c.font = 'bold 12px Arial'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(W * 0.3, 6, W * 0.22, role === 'gunner' ? 22 : 40); c.fillStyle = ar < 0.3 ? '#f44' : '#e8e0c0'; c.fillText('BLINDAGEM ' + Math.round(ar * 100) + '%', W * 0.3 + 6, 21); if (role !== 'gunner') { c.fillStyle = P.over ? '#f44' : '#e8e0c0'; c.fillText(Math.round(P.speed * 3.6) + ' km/h · comb ' + Math.round(P.fuel * 100) + '% · ' + (P.over ? 'FERVENDO!' : 'temp ok'), W * 0.3 + 6, 38); } }
    // chefe
    const b = G.boss; if (b && b.parts && b.parts.length) { const f = BOSS.hpFrac(); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(W * 0.3, H * 0.165, W * 0.4, 20); c.fillStyle = '#b01818'; c.fillRect(W * 0.3 + 2, H * 0.165 + 2, (W * 0.4 - 4) * f, 16); c.fillStyle = '#fff'; c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.fillText(b.def.nome + ' — ' + b.def.sub, W / 2, H * 0.165 + 14); }
    if (G.phase === 'saque') { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(W * 0.35, H * 0.165, W * 0.3, 20); c.fillStyle = '#c9a030'; c.fillRect(W * 0.35 + 2, H * 0.165 + 2, (W * 0.3 - 4) * (1 - G.saqueT / (G.saqueMax || 40)), 16); c.fillStyle = '#fff'; c.font = 'bold 11px Arial'; c.fillText('CARREGANDO MUNIÇÃO  ' + Math.ceil(G.saqueT) + 's', W / 2, H * 0.165 + 14); }
    if (G.phase === 'arena') { c.fillStyle = '#fff'; c.font = 'bold 13px Arial'; c.strokeStyle = '#000'; c.lineWidth = 3; const s = 'ONDA ' + G.wave + ' · ' + Math.ceil(G.waveT) + 's · sucata ' + Math.round(S.sucata); c.strokeText(s, W / 2, H * 0.19); c.fillText(s, W / 2, H * 0.19); }
    if (G.eventBar > 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(W * 0.35, H * 0.22, W * 0.3, 16); c.fillStyle = '#3ad06a'; c.fillRect(W * 0.35 + 2, H * 0.22 + 2, (W * 0.3 - 4) * G.eventBar, 12); c.fillStyle = '#fff'; c.font = 'bold 10px Arial'; c.fillText('SEGURE A POSIÇÃO', W / 2, H * 0.22 + 12); }
    if (b && b.fase === 3) { c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.strokeStyle = '#000'; c.lineWidth = 3; const s = 'RAMPA DO NAVIO: ' + Math.max(0, Math.round(G.portoLeft)) + ' m  ·  ' + Math.round(P.speed * 3.6) + ' km/h (mín. 110)'; c.strokeText(s, W / 2, H * 0.2); c.fillText(s, W / 2, H * 0.2); }
    c.fillStyle = '#ffd040'; c.font = 'bold 12px Arial'; if (G.abil.on > 0 && cls().dur > 1 && cls().id !== 'trovao') c.fillText(cls().ativa.toUpperCase() + ' ' + G.abil.on.toFixed(1) + 's', W / 2, H * 0.25); if (G.turboT > 0) c.fillText('🔥 PÉ NO PORÃO — TURBO ' + G.turboT.toFixed(1) + 's', W / 2, H * 0.275);
    // co-op
    if (NET.host || NET.client) { c.textAlign = 'left'; c.font = 'bold 11px Arial'; const tx = '📶 CO-OP ' + NET.count() + '/4' + (NET.client ? ' · ' + cls().nome : ''); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(8, H * 0.35, c.measureText(tx).width + 12, 18); c.fillStyle = '#9adfff'; c.fillText(tx, 14, H * 0.35 + 13); c.textAlign = 'center'; }
    if (G.netClient && NET.silence() > 3) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, H * 0.42, W, H * 0.12); c.fillStyle = '#ff8a6a'; c.font = `bold ${H * 0.045 | 0}px Impact, Arial Black, Arial`; c.fillText('SEM SINAL DO PILOTO… ' + Math.round(NET.silence()) + 's', W / 2, H * 0.5); }
    else if (G.hostPaused) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, H * 0.42, W, H * 0.12); c.fillStyle = '#ffd870'; c.font = `bold ${H * 0.05 | 0}px Impact, Arial Black, Arial`; c.fillText('PAUSADO PELO PILOTO', W / 2, H * 0.5); }
    // faixa de título
    c.textAlign = 'center'; if (G.banner) { const a = Math.min(1, G.banner.t, 1); c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(0, H * 0.24, W, H * 0.16); c.fillStyle = '#e8b020'; c.font = `bold ${H * 0.055 | 0}px Impact, Arial Black, Arial`; c.fillText(G.banner.a, W / 2, H * 0.31); c.fillStyle = '#e8e0c0'; c.font = `${H * 0.03 | 0}px Arial`; c.fillText(G.banner.b, W / 2, H * 0.365); c.globalAlpha = 1; }
    // legendas (rádio / gritos)
    let y = H * 0.58; c.font = 'bold 14px Arial'; c.textAlign = 'center';
    for (let i = G.msgs.length - 1; i >= 0; i--) { const m = G.msgs[i]; c.globalAlpha = Math.min(1, m.t * 2); const wd = Math.min(W * 0.8, c.measureText(m.txt).width + 20); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(W / 2 - wd / 2, y - 15, wd, 21); c.fillStyle = m.who === 'ai' ? '#ffd870' : m.who === 'sys' ? '#ff8a6a' : '#9adfff'; c.fillText(m.txt, W / 2, y, W * 0.78); y -= 24; } c.globalAlpha = 1;
  }

  // vinheta: bordas escurecidas (clima pesado), uma imagem pequena esticada na tela
  let vigC = null;
  function vignette() {
    if (!vigC) { vigC = document.createElement('canvas'); vigC.width = 256; vigC.height = 144; const x = vigC.getContext('2d'), g = x.createRadialGradient(128, 72, 40, 128, 72, 150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = g; x.fillRect(0, 0, 256, 144); }
    c.drawImage(vigC, 0, 0, W, H);
  }
  /* por cima do mundo 3D: o que ainda é desenhado em 2D na posição projetada (corrente/cabo dos chefes, marcação do Falcão, perigos) */
  function overlay3D(v) {
    const W = v.W, H = v.H, b = G.boss, F = v.F, fs = v.flip ? -1 : 1, pan = v.pan || 0, Xs = W3D.X;
    if (typeof FX3D === 'undefined' && G.haz && G.haz.length) {
      const base = Math.floor(v.camZ / SEG), frac = v.camZ / SEG - base, off = v.dir > 0 ? frac : 1 - frac;
      const center = (dz) => { const nf = dz / SEG + off, n0 = Math.max(0, Math.floor(nf)), t = nf - n0; return Xs[n0] + (Xs[n0 + 1] - Xs[n0]) * t; };
      for (const h of G.haz) {
        const dz = v.dir * (h.z - v.camZ); if (dz < 1 || dz > v.N * SEG) continue;
        const k = F / dz, sx = W / 2 + pan + fs * (center(dz) + h.x - v.camX) * k, sy = v.hor + v.camH * k, rx = h.r * k, ry = Math.max(1.5, h.r * v.camH * k / dz * 1.4);
        if (h.kind === 'fogo') { if (h.t > h.delay) { c.fillStyle = `rgba(255,${110 + Math.sin(G.t * 20 + h.x) * 50 | 0},10,0.8)`; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.fill(); } else { c.strokeStyle = '#ff8a1a'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.stroke(); } }
        else if (!h.done) { const p = h.t / h.delay; c.strokeStyle = Math.sin(G.t * 20) > 0 ? '#ff2a2a' : '#ffd040'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, 7); c.stroke(); c.fillStyle = '#5a4a3a'; const fy = sy - (1 - p) * (1 - p) * H * 0.9; c.fillRect(sx - rx * 0.5, fy - rx * 0.6, rx, rx * 0.6); }
      }
    }
    if (b && b.chainOn && b.esc) { const es = b.esc.filter(e => !e.dead && e.vf === G.frame); if (es.length === 2) { c.strokeStyle = `rgb(255,${100 + Math.sin(G.t * 30) * 60 | 0},20)`; c.lineWidth = 5; c.beginPath(); c.moveTo(es[0].sx, es[0].sy - es[0].sh * 0.5); c.quadraticCurveTo(W / 2, H * 0.62, es[1].sx, es[1].sy - es[1].sh * 0.5); c.stroke(); } }
    if (b && b.cable && b.vf === G.frame) { c.strokeStyle = '#c8c8c8'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.sx, b.sy - b.k * 1); c.lineTo(W / 2 + pan, H * 0.72); c.stroke(); }
    if (G.abil.on > 0 && S.cls === 'falcao') {
      c.fillStyle = '#ff1a1a'; c.globalAlpha = 0.9;
      for (const e of G.ents) { if (e.dead || e.vf !== G.frame || e.st === 'latch') continue; const d = ENEMY[e.type]; if (d.estatico) continue; const k = e.sh / d.h; if (d.veh) { c.fillRect(e.sx - d.w * k / 2, e.sy - d.h * k * 0.2, d.w * k * 0.25, d.h * k * 0.2); c.fillRect(e.sx + d.w * k / 4, e.sy - d.h * k * 0.2, d.w * k * 0.25, d.h * k * 0.2); } else c.fillRect(e.sx - 0.2 * k, e.sy - e.sh, 0.4 * k, e.sh * 0.22); }
      c.globalAlpha = 1;
    }
    if (b && b.vf === G.frame && b.parts) {   // barra de vida dos pontos fracos
      for (const p of b.parts) { if (p.dead || !p.vuln || (p.id === 'cabo' && !p.vuln)) continue; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(b.sx + (p.ox - p.w / 2) * b.k, b.sy - (p.oy + p.h + 0.25) * b.k, p.w * b.k, Math.max(2, 0.1 * b.k)); c.fillStyle = '#e22'; c.fillRect(b.sx + (p.ox - p.w / 2) * b.k, b.sy - (p.oy + p.h + 0.25) * b.k, p.w * b.k * (p.hp / p.max), Math.max(2, 0.1 * b.k)); }
    }
  }

  /* zumbis luminescentes à noite: redesenhados opacos por cima da escuridão, de trás para a frente — o corpo escurece como a cena,
     a pele, os olhos e as feridas continuam acesos (com halo fora do facho do farol). Quem está atrás de um veículo/chefe não é redesenhado. */
  function glowPass(c, v) {
    if (!glowList.length) return;
    const lv = P.lights, r0 = H * 0.06, r1 = H * (lv === 2 ? 0.95 : lv === 1 ? 0.62 : 0.2), cx = W / 2 + (v.pan || 0), cy = v.hor + H * 0.16;
    for (const g of glowList) {
      const e = g.e, d = ENEMY[e.type], k = g.k, u = clamp((Math.hypot(g.sx - cx, g.sy - d.h * k * 0.6 - cy) - r0) / Math.max(1, r1 - r0), 0, 1);
      const dark = u < 0.5 ? 0.05 + u * 0.8 : 0.45 + (u - 0.5) * 0.98;   // mesma escuridão do farol (atmosphere)
      if (dark < 0.1) continue;
      const x0 = g.sx - d.w * k * 0.9, x1 = g.sx + d.w * k * 0.9, y0 = g.sy - d.h * k;
      if (occl.some(o => o[0] > g.i && o[1] < x1 && o[3] > x0 && o[2] < g.sy && o[4] > y0)) continue;
      if (dark > 0.6) {
        const hw = d.w * k * 1.5, hh = d.h * k * 0.7;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = (dark - 0.6) * (1 - g.f * 0.6); c.drawImage(DRAW.halo(e), g.sx - hw, g.sy - d.h * k * 0.6 - hh, hw * 2, hh * 2);
        c.globalCompositeOperation = 'source-over';
      }
      const s = clamp((dark - 0.1) / 0.5, 0, 1);   // força do brilho: some suavemente perto do facho
      c.globalAlpha = 1; c.save(); c.translate(g.sx, g.sy); c.scale(k, k); DRAW.fog(g.fc, g.f); DRAW.night(dark, dark * (1 - 0.88 * s));
      if (e.type === 'boi') DRAW.boi(c, e, G.t, g.lod); else DRAW.zombie(c, e, G.t, g.lod);
      DRAW.night(0, 0); DRAW.fog(null); c.restore();
    }
    c.globalAlpha = 1; glowList.length = 0;
  }

  function frame() {
    const role = G.role, fpp = G.cam === 'fpp', st = G.st; if (!st) return;
    adapt();
    if (typeof CARFX !== 'undefined') CARFX.update();
    base(c);
    G.hits.length = 0;
    const tn = Math.min(CLIMA_N[G.clima] || 110, G.night ? (P.lights === 2 ? 60 : P.lights === 1 ? 42 : 16) : 999); viewN += (tn - viewN) * 0.04;
    const shk = G.shake * (drv() === 'trovao' ? 0.7 : 1), sx = (Math.random() - 0.5) * shk * 10, sy = (Math.random() - 0.5) * shk * 12 + Math.sin(G.t * 31) * Math.min(1.5, P.speed * 0.03);
    const jumpY = P.jump > 0 ? Math.sin(Math.min(1, P.jump / 2.2) * Math.PI) * H * 0.3 : 0;
    let v;
    if (role === 'pilot' && fpp) { const camH = [0, 1.15, 1.2, 1.5, 2.0, 2.6][S.veh]; v = { W, H, hor: H * 0.4 + sy + jumpY, F: H * 0.92, dir: 1, flip: false, camX: P.x - 0.3, camZ: P.z, camH, N: viewN, main: true, pan: sx - P.steer * 14 }; }
    else if (role === 'pilot') { v = { W, H, hor: H * 0.36 + sy * 0.5 + jumpY, F: H * 0.9, dir: 1, flip: false, camX: P.x * 0.85, camZ: P.z - 7.5, camH: 3.4 + S.veh * 0.35, N: viewN, main: true, pan: sx * 0.5 }; }
    else { const seat = A.seat, camH = [0, 1.25, 1.3, 1.6, 2.1, 2.7][S.veh] + (seat === 2 ? 0.8 : 0), zoom = 1 + A.ads * 0.6; v = { W, H, hor: H * 0.47 + sy - (A.ay - H * 0.45) * 0.3, F: H * 0.9 * zoom, dir: A.look, flip: A.look < 0, camX: P.x + (seat === 0 ? -1 : seat === 1 ? 1 : 0) * G.V.w * 0.9, camZ: P.z + (A.exposed ? 0 : 0), camH, N: viewN, main: true, pan: sx - (A.ax - W / 2) * 0.35 * zoom }; }
    let o3 = null;
    if (use3D) {
      if (role === 'pilot' && fpp && typeof CAB3D !== 'undefined') {
        // retrovisores primeiro: a cabine 3D cola a imagem de trás nos espelhos
        const mh = [0, 1.2, 1.25, 1.5, 2.0, 2.6][S.veh], rv = { W: 360, H: 90, hor: 34, F: 200, dir: -1, flip: false, camX: P.x, camZ: P.z - 1, camH: mh, N: Math.min(34, viewN), main: false };
        CAB3D.mirTex = W3D.mirrorTex(rv, G.frame % 2 === 0, Math.round(360 * MS), Math.round(90 * MS));
        const light = CAB3D.update(v);
        o3 = { near: (R, cx) => CAB3D.draw(R, cx), latch: latchPlace(H * 0.4, CAB3D.dashY + H * 0.03, false), light };
      }
      else if (role === 'pilot' && fpp) { const dashY = H * 0.64 + sy * 0.4; o3 = { hood: { dashY, hoodH: [0, 0.085, 0.09, 0.1, 0.05, 0.04][S.veh] * H }, latch: latchPlace(H * 0.4, dashY + H * 0.04, false) }; }
      else if (role === 'pilot') { const k = v.F / 7.5; o3 = { player: { jumpH: jumpY * 0.5 / k }, latch: latchPlace(k, v.hor + v.camH * k, false) }; }
      else if (A.exposed && !(A.down > 0)) { const vmOK = typeof VM3D !== 'undefined', light = vmOK ? VM3D.update(v) : null; o3 = { near: vmOK ? (R, cx) => VM3D.draw(R, cx) : null, latch: latchPlace(H * 0.46, H * 1.12, true), light }; }
    }
    frame3D = !!(use3D && W3D.render(v, o3));
    if (frame3D) { c.clearRect(0, 0, W, H); overlay3D(v); atmosphere(c, W, H, v.hor, v.pan, true); if (!(role === 'pilot' && fpp)) vignette(); }
    else { world(c, v); atmosphere(c, W, H, v.hor, v.pan); glowPass(c, v); }
    if (role === 'pilot' && fpp) cockpit(sy * 0.4);
    else if (role === 'pilot') { const k = v.F / 7.5, py = v.hor + v.camH * k; if (!frame3D) { c.save(); c.translate(W / 2 + (P.x - v.camX) * k, py - (P.jump > 0 ? jumpY * 0.5 : 0)); c.scale(k, k); DRAW.playerCar(c, S.veh, S.up, P.steer, P.saws, G.t); c.restore(); } drawLatchers(k, py, false); if (P.blood > 0.4) { c.fillStyle = `rgba(110,8,8,${(P.blood - 0.4) * 0.3})`; c.fillRect(0, 0, W, H); } if (P.acid > 0.05) { c.fillStyle = `rgba(110,190,30,${P.acid * 0.5})`; c.fillRect(0, 0, W, H); } if (P.oil > 0.05) { c.fillStyle = `rgba(8,6,4,${P.oil * 0.7})`; c.fillRect(0, 0, W, H); } }
    else gunnerView();
    hud(role);
  }
  return { init, frame, resize, base, get W() { return W; }, get H() { return H; }, get resW() { return cv.width; }, get resH() { return cv.height; }, get is3D() { return use3D; } };
})();
