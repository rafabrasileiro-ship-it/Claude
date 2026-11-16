'use strict';
/* Texturas procedurais do motor 3D (desenhadas em canvas na hora, nada de arquivo de imagem).
   O canal alfa é escrito à parte (Uint8Array): nos modelos ele marca o que BRILHA (pele luminescente, olhos, faróis);
   nas folhagens/cercas ele é o recorte. */
const TEX3 = (() => {
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const hexRGB = (h) => h.length === 4 ? [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)] : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const css = (r, g, b, a) => a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  const shade = (rgb, k) => css(Math.min(255, rgb[0] * k), Math.min(255, rgb[1] * k), Math.min(255, rgb[2] * k));

  /* ruído de valor que fecha nas bordas (textura repetível) */
  function vnoise(w, h, cells, seed) {
    const r = rng(seed), gw = Math.max(1, cells | 0), gh = Math.max(1, Math.round(cells * h / w)), g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const out = new Float32Array(w * h), sx = gw / w, sy = gh / h;
    for (let y = 0; y < h; y++) {
      const fy = y * sy, y0 = fy | 0, ty = fy - y0, y1 = (y0 + 1) % gh, uy = ty * ty * (3 - 2 * ty), r0 = y0 * gw, r1 = y1 * gw;
      for (let x = 0; x < w; x++) {
        const fx = x * sx, x0 = fx | 0, tx = fx - x0, x1 = (x0 + 1) % gw, ux = tx * tx * (3 - 2 * tx);
        const a = g[r0 + x0], b = g[r0 + x1], c = g[r1 + x0], d = g[r1 + x1];
        out[y * w + x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
      }
    }
    return out;
  }
  function fbm(w, h, c0, oct, seed, gain) {
    const out = new Float32Array(w * h); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) { const n = vnoise(w, h, c0 << o, seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain || 0.5; }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  // base RGB a partir de um campo de ruído e duas cores
  function field(ctx, w, h, n, ca, cb, grain, seed) {
    const im = ctx.createImageData(w, h), d = im.data, r = rng(seed || 7);
    for (let i = 0, j = 0; i < n.length; i++, j += 4) {
      const t = n[i], g = grain ? (r() - 0.5) * grain : 0;
      d[j] = ca[0] + (cb[0] - ca[0]) * t + g; d[j + 1] = ca[1] + (cb[1] - ca[1]) * t + g; d[j + 2] = ca[2] + (cb[2] - ca[2]) * t + g; d[j + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  }
  // junta o canvas de cor (opaco) com um alfa explícito: número fixo, canvas de máscara (canal R) ou função (x,y,r,g,b)->0..255
  function pack(c, alpha) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
    out.set(d);
    if (alpha === undefined) { for (let i = 3; i < out.length; i += 4) out[i] = 255; }
    else if (typeof alpha === 'number') { for (let i = 3; i < out.length; i += 4) out[i] = alpha; }
    else if (alpha.getContext) { const m = alpha.getContext('2d').getImageData(0, 0, w, h).data; for (let i = 3; i < out.length; i += 4) out[i] = m[i - 3]; }
    else { for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) out[i + 3] = alpha(x, y, d[i], d[i + 1], d[i + 2]); }
    return { w, h, data: out };
  }
  // desenha uma vez dentro de um retângulo que se repete (copia o que passa da borda para o outro lado)
  function wrapDraw(ctx, w, h, x, y, fn) { for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { ctx.save(); ctx.translate(x + ox, y + oy); fn(ctx); ctx.restore(); } }

  const T = (make, o) => new GL3.Texture(make, o);
  const cache = {};
  const once = (k, f) => cache[k] || (cache[k] = f());
  // terreno: guarda só os dois últimos trechos (cada um ocupa ~1 MB de memória de vídeo)
  const gndKeys = [];
  function keepGround(k) { const i = gndKeys.indexOf(k); if (i >= 0) gndKeys.splice(i, 1); gndKeys.push(k); while (gndKeys.length > 2) { const old = gndKeys.shift(); if (cache[old]) { cache[old].free(); delete cache[old]; } } }

  /* ---------- pista ---------- */
  // asfalto: 14 m de largura (u 0..1) × 16 m (v 0..1 = 2 segmentos), com faixas pintadas
  function asphalt(duo) {
    return once('asf' + (duo ? 2 : 1), () => T(() => {
      const W = 512, H = 512, c = cnv(W, H), x = c.getContext('2d'), r = rng(duo ? 33 : 17);
      const n = fbm(W, H, 8, 5, duo ? 5 : 3, 0.55);
      field(x, W, H, n, [47, 47, 51], [74, 73, 76], 22, 11);
      const mPerPx = 14 / W, px = (m) => (m + 7) / 14 * W, py = (m) => m / 16 * H;
      // trilhas de pneu (mais escuras e lisas) e mancha de óleo no meio da faixa
      const lanes = duo ? [-5.25, -1.75, 1.75, 5.25] : [-3.5, 3.5];
      for (const L of lanes) {
        for (const o of [-0.85, 0.85]) { const g = x.createLinearGradient(px(L + o - 0.45), 0, px(L + o + 0.45), 0); g.addColorStop(0, 'rgba(20,20,22,0)'); g.addColorStop(0.5, 'rgba(20,20,22,0.22)'); g.addColorStop(1, 'rgba(20,20,22,0)'); x.fillStyle = g; x.fillRect(px(L + o - 0.45), 0, px(L + o + 0.45) - px(L + o - 0.45), H); }
        const g = x.createLinearGradient(px(L - 0.35), 0, px(L + 0.35), 0); g.addColorStop(0, 'rgba(12,10,10,0)'); g.addColorStop(0.5, 'rgba(12,10,10,0.25)'); g.addColorStop(1, 'rgba(12,10,10,0)'); x.fillStyle = g; x.fillRect(px(L - 0.35), 0, px(L + 0.35) - px(L - 0.35), H);
      }
      // remendos de asfalto novo
      for (let i = 0; i < 3; i++) {   // remendos discretos de bordas irregulares
        const w = 50 + r() * 110, h = 40 + r() * 100, j = () => (r() - 0.5) * 14, pts = [[j(), j()], [w + j(), j()], [w + j(), h + j()], [j(), h + j()]];
        x.fillStyle = `rgba(${30 + r() * 8 | 0},${30 + r() * 8 | 0},${33 + r() * 8 | 0},0.24)`;
        wrapDraw(x, W, H, r() * W, r() * H, (k) => { k.beginPath(); pts.forEach((p, q) => q ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1])); k.closePath(); k.fill(); k.strokeStyle = 'rgba(15,15,15,0.18)'; k.lineWidth = 1.5; k.stroke(); });
      }
      // rachaduras
      x.strokeStyle = 'rgba(10,10,12,0.75)'; x.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        let cx = r() * W, cy = r() * H, a = r() * 6.28; const len = 8 + (r() * 14 | 0);
        x.lineWidth = 0.8 + r() * 1.6; wrapDraw(x, W, H, 0, 0, (k) => { k.beginPath(); let X = cx, Y = cy, A = a; k.moveTo(X, Y); for (let s = 0; s < len; s++) { A += (r() - 0.5) * 1.1; X += Math.cos(A) * 7; Y += Math.sin(A) * 7; k.lineTo(X, Y); } k.stroke(); });
      }
      // borda do asfalto esfarelando
      for (let y = 0; y < H; y += 2) { const e1 = r() * 7, e2 = r() * 7; x.fillStyle = 'rgba(30,26,22,0.6)'; x.fillRect(0, y, e1, 2); x.fillRect(W - e2, y, e2, 2); }
      // pintura (gasta: buracos de ruído)
      const paint = (m0, m1, v0, v1, cor) => { x.fillStyle = cor; x.fillRect(px(m0), py(v0), px(m1) - px(m0), py(v1) - py(v0)); };
      const white = '#dcdcd2', yellow = '#d8a41c';
      paint(-6.58, -6.42, 0, 16, white); paint(6.42, 6.58, 0, 16, white);
      if (duo) { paint(-0.2, -0.06, 0, 16, yellow); paint(0.06, 0.2, 0, 16, yellow); paint(-3.33, -3.17, 8, 16, white); paint(3.17, 3.33, 8, 16, white); }
      else paint(-0.08, 0.08, 8, 16, yellow);
      // desgaste da tinta
      const im = x.getImageData(0, 0, W, H), d = im.data, wear = vnoise(W, H, 64, 91);
      for (let i = 0, j = 0; i < wear.length; i++, j += 4) { const lum = d[j] + d[j + 1] + d[j + 2]; if (lum > 330 && wear[i] < 0.28) { d[j] = d[j] * 0.45 + 30; d[j + 1] = d[j + 1] * 0.45 + 30; d[j + 2] = d[j + 2] * 0.45 + 32; } }
      x.putImageData(im, 0, 0);
      // alfa = refletividade da tinta (brilha um pouco no escuro, como faixa refletiva)
      return pack(c, (X, Y, R, G, B) => (R + G + B > 420 ? 255 : 0));
    }, { repeat: true }));
  }
  // cascalho/terra do acostamento (4 m × 4 m)
  function gravel() {
    return once('grav', () => T(() => {
      const W = 256, c = cnv(W, W), x = c.getContext('2d'), r = rng(5);
      field(x, W, W, fbm(W, W, 4, 5, 8, 0.6), [86, 70, 52], [134, 112, 84], 26, 3);
      for (let i = 0; i < 900; i++) { const s = 1 + r() * 3.2, v = 70 + r() * 120; x.fillStyle = css(v, v * 0.92, v * 0.82, 0.9); wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.beginPath(); k.ellipse(0, 0, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); k.fill(); }); }
      for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(30,24,18,0.5)'; x.fillRect(r() * W, r() * W, 1 + r() * 2, 1 + r() * 2); }
      return pack(c, 0);
    }, { repeat: true }));
  }
  /* terreno de cada trecho (8 m × 8 m): grama molhada, pasto, cerrado seco, terra vermelha, lavoura, pedregulho, caatinga */
  function ground(key, baseHex) {
    keepGround('gnd' + key + baseHex);
    return once('gnd' + key + baseHex, () => T(() => {
      const W = 512, c = cnv(W, W), x = c.getContext('2d'), r = rng(key * 31 + 7), b = hexRGB(baseHex);
      const lo = b.map(v => v * 1.35), hi = b.map(v => v * 2.25 + 8);
      field(x, W, W, fbm(W, W, 4, 6, key * 13 + 1, 0.58), lo, hi, 18, key);
      const kind = ['grama', 'pasto', 'cerrado', 'terra', 'lavoura', 'pedra', 'caatinga', 'caatinga', 'noite', 'litoral'][key] || 'grama';
      // manchas de terra
      const dirtN = kind === 'terra' || kind === 'caatinga' || kind === 'pedra' ? 26 : 10;
      for (let i = 0; i < dirtN; i++) { const s = 10 + r() * 46; const g0 = kind === 'terra' ? [150, 80, 50] : [120, 98, 70]; const gr = x.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, css(g0[0], g0[1], g0[2], 0.45)); gr.addColorStop(1, css(g0[0], g0[1], g0[2], 0)); wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.fillStyle = gr; k.fillRect(-s, -s, s * 2, s * 2); }); }
      // folhas de capim
      const blades = kind === 'caatinga' || kind === 'pedra' ? 1500 : kind === 'terra' ? 2200 : 5200;
      x.lineCap = 'round';
      for (let i = 0; i < blades; i++) {
        const k0 = 0.75 + r() * 0.9, dry = kind === 'cerrado' || kind === 'caatinga' ? r() * 0.8 : r() * 0.25;
        const cr = b[0] * 2.1 * k0 + dry * 70, cg = b[1] * 2.0 * k0 + dry * 30, cb = b[2] * 1.7 * k0;
        x.strokeStyle = css(cr, cg, cb, 0.85); x.lineWidth = 0.8 + r() * 1.3; const L = 3 + r() * 8, a = -Math.PI / 2 + (r() - 0.5) * 1.6;
        wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.beginPath(); k.moveTo(0, 0); k.lineTo(Math.cos(a) * L, Math.sin(a) * L); k.stroke(); });
      }
      // pedrinhas
      const stones = kind === 'pedra' ? 500 : kind === 'caatinga' ? 260 : 70;
      for (let i = 0; i < stones; i++) { const s = 1.2 + r() * (kind === 'pedra' ? 6 : 3), v = 110 + r() * 90; x.fillStyle = css(v, v * 0.95, v * 0.88); wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.beginPath(); k.ellipse(0, 0, s, s * 0.7, r() * 3, 0, 7); k.fill(); k.fillStyle = 'rgba(0,0,0,0.25)'; k.beginPath(); k.ellipse(s * 0.25, s * 0.3, s, s * 0.5, 0, 0, 7); k.fill(); }); }
      return pack(c, 0);
    }, { repeat: true }));
  }
  function water() {
    return once('agua', () => T(() => {
      const W = 256, c = cnv(W, W), x = c.getContext('2d');
      field(x, W, W, fbm(W, W, 4, 5, 77, 0.6), [22, 52, 70], [58, 104, 128], 10, 2);
      const r = rng(9); x.strokeStyle = 'rgba(190,220,235,0.35)'; x.lineWidth = 1.2;
      for (let i = 0; i < 140; i++) { const L = 6 + r() * 20; wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.beginPath(); k.moveTo(0, 0); k.quadraticCurveTo(L / 2, -2, L, 0); k.stroke(); }); }
      return pack(c, 0);
    }, { repeat: true }));
  }
  function cliff() {
    return once('penh', () => T(() => {
      const W = 256, c = cnv(W, W), x = c.getContext('2d'), r = rng(41);
      field(x, W, W, fbm(W, W, 4, 6, 61, 0.62), [86, 60, 38], [150, 112, 74], 30, 4);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(40,26,14,${0.2 + r() * 0.4})`; wrapDraw(x, W, W, r() * W, r() * W, (k) => { k.fillRect(0, 0, 2 + r() * 5, 20 + r() * 70); }); }
      return pack(c, 0);
    }, { repeat: true }));
  }
  /* ruído de detalhe (perto da câmera) e de macro-variação (quebra a repetição) */
  function detail() { return once('det', () => T(() => { const W = 128, c = cnv(W, W), x = c.getContext('2d'); const n = fbm(W, W, 16, 3, 123, 0.6); const r = rng(3); field(x, W, W, n, [92, 92, 92], [164, 164, 164], 40, 5); for (let i = 0; i < 200; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'; x.fillRect(r() * W, r() * W, 1 + r() * 2, 1 + r() * 2); } return pack(c, 0); }, { repeat: true })); }
  function macro() { return once('mac', () => T(() => { const W = 256, c = cnv(W, W), x = c.getContext('2d'); field(x, W, W, fbm(W, W, 3, 4, 321, 0.55), [96, 96, 96], [160, 160, 160], 0, 1); return pack(c, 0); }, { repeat: true })); }

  /* ---------- céu ---------- */
  function clouds() {
    return once('nuv', () => T(() => {
      const W = 256, c = cnv(W, W), x = c.getContext('2d'), n = fbm(W, W, 4, 6, 555, 0.55), im = x.createImageData(W, W), d = im.data;
      for (let i = 0, j = 0; i < n.length; i++, j += 4) { const v = n[i]; d[j] = d[j + 1] = d[j + 2] = Math.max(0, Math.min(255, (v - 0.3) * 600)); d[j + 3] = 255; }
      x.putImageData(im, 0, 0); return pack(c, (X, Y, R) => R);
    }, { repeat: true }));
  }
  // silhuetas do horizonte: 4 faixas (morros suaves, serra, mata, cidade), alfa = recorte
  function horizon() {
    return once('hor', () => T(() => {
      const W = 1024, H = 512, c = cnv(W, H), x = c.getContext('2d'), m = cnv(W, H), k = m.getContext('2d'), r = rng(808);
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); k.fillStyle = '#000'; k.fillRect(0, 0, W, H); k.fillStyle = '#fff';
      const band = (row, hf) => { const y0 = row * 128 + 128; k.beginPath(); k.moveTo(0, y0); for (let i = 0; i <= W; i += 2) k.lineTo(i, y0 - hf(i)); k.lineTo(W, y0); k.closePath(); k.fill(); };
      const p = (i, f, s) => Math.sin(i / W * Math.PI * 2 * f + s);
      band(0, (i) => 22 + 26 * (0.5 + 0.5 * p(i, 2, 1)) + 14 * p(i, 5, 2) + 6 * p(i, 11, 0.4));                       // morros
      band(1, (i) => 30 + 52 * Math.abs(p(i, 3, 0.7)) + 22 * p(i, 7, 1.3) + 9 * p(i, 17, 2));                       // serra / chapada
      const tops = []; for (let i = 0; i < 160; i++) tops.push([r() * W, 8 + r() * 26, 6 + r() * 16]);                  // mata
      band(2, (i) => { let h = 10 + 6 * p(i, 4, 0.2); for (const t of tops) { const d = Math.abs(i - t[0]); const dd = Math.min(d, W - d); if (dd < t[2]) h = Math.max(h, 10 + t[1] * Math.sqrt(1 - (dd / t[2]) ** 2)); } return h; });
      const bl = []; let bx = 0; while (bx < W) { const bw = 12 + r() * 40; bl.push([bx, bw, 14 + r() * (r() < 0.2 ? 90 : 45)]); bx += bw + r() * 6; }   // prédios
      band(3, (i) => { for (const b of bl) if (i >= b[0] && i < b[0] + b[1]) return b[2]; return 6; });
      return pack(c, m);
    }, { repeat: true, repeatS: true, mip: true }));
  }

  /* ---------- efeitos ---------- */
  function blob() { return once('blob', () => T(() => { const W = 64, c = cnv(W, W), x = c.getContext('2d'), m = cnv(W, W), k = m.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, W); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#d0d0d0'); g.addColorStop(0.55, '#8a8a8a'); g.addColorStop(1, '#000'); k.fillStyle = g; k.fillRect(0, 0, W, W); return pack(c, m); }, { repeat: false })); }
  function glow() { return once('glow', () => T(() => { const W = 64, c = cnv(W, W), x = c.getContext('2d'), m = cnv(W, W), k = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, W); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.25, '#9a9a9a'); g.addColorStop(0.6, '#2a2a2a'); g.addColorStop(1, '#000'); k.fillStyle = g; k.fillRect(0, 0, W, W); return pack(c, m); }, { repeat: false })); }
  // decalques no asfalto (4×4 células de 128 px): freada, óleo, sangue, buraco, rachadura, remendo, tampa de bueiro, entulho
  function decals() {
    return once('dec', () => T(() => {
      const W = 512, c = cnv(W, W), x = c.getContext('2d'), m = cnv(W, W), k = m.getContext('2d'), r = rng(2024);
      x.fillStyle = '#202022'; x.fillRect(0, 0, W, W); k.fillStyle = '#000'; k.fillRect(0, 0, W, W);
      const cell = (i, f) => { const cx = (i % 4) * 128, cy = (i / 4 | 0) * 128; x.save(); k.save(); x.translate(cx, cy); k.translate(cx, cy); x.beginPath(); x.rect(0, 0, 128, 128); x.clip(); k.beginPath(); k.rect(0, 0, 128, 128); k.clip(); f(x, k); x.restore(); k.restore(); };
      const blobPath = (ctx, cx, cy, R, n, j) => { ctx.beginPath(); for (let a = 0; a <= n; a++) { const t = a / n * 6.283, rr = R * (1 - j / 2 + r() * j); a ? ctx.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr) : ctx.moveTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); } ctx.closePath(); };
      // 0-1 marcas de freada
      for (const i of [0, 1]) cell(i, (a, b) => { a.fillStyle = '#0c0c0c'; for (const ox of [34, 94]) { const g = b.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.2, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.85)'); b.fillStyle = g; b.beginPath(); b.moveTo(ox - 9, 0); b.quadraticCurveTo(ox + (i ? 18 : -6), 64, ox - 7 + (i ? 22 : 0), 128); b.lineTo(ox + 9 + (i ? 22 : 0), 128); b.quadraticCurveTo(ox + 18 + (i ? 18 : -6), 64, ox + 9, 0); b.fill(); } });
      // 2 óleo
      cell(2, (a, b) => { const g = a.createRadialGradient(64, 64, 4, 64, 64, 60); g.addColorStop(0, '#08080a'); g.addColorStop(0.6, '#1a1620'); g.addColorStop(1, '#2a2430'); a.fillStyle = g; a.fillRect(0, 0, 128, 128); b.fillStyle = 'rgba(255,255,255,0.8)'; blobPath(b, 64, 64, 50, 22, 0.5); b.fill(); });
      // 3-4 sangue
      for (const i of [3, 4]) cell(i, (a, b) => { a.fillStyle = '#4a0604'; a.fillRect(0, 0, 128, 128); a.fillStyle = '#2a0202'; blobPath(a, 64, 64, 30, 18, 0.6); a.fill(); b.fillStyle = 'rgba(255,255,255,0.92)'; blobPath(b, 64, 64, 40, 24, 0.7); b.fill(); for (let s = 0; s < 14; s++) { const t = r() * 6.28, d = 42 + r() * 18; b.beginPath(); b.arc(64 + Math.cos(t) * d, 64 + Math.sin(t) * d, 2 + r() * 5, 0, 7); b.fill(); } });
      // 5 buraco
      cell(5, (a, b) => { a.fillStyle = '#121212'; a.fillRect(0, 0, 128, 128); a.fillStyle = '#3a3226'; blobPath(a, 64, 64, 40, 16, 0.4); a.fill(); a.fillStyle = '#0a0a0a'; blobPath(a, 62, 60, 30, 14, 0.4); a.fill(); b.fillStyle = '#fff'; blobPath(b, 64, 64, 46, 18, 0.35); b.fill(); });
      // 6 rachadura em teia
      cell(6, (a, b) => { a.fillStyle = '#0a0a0a'; a.fillRect(0, 0, 128, 128); b.strokeStyle = '#fff'; b.lineWidth = 2; for (let s = 0; s < 9; s++) { b.beginPath(); let X = 64, Y = 64, A = s * 0.7 + r(); b.moveTo(X, Y); for (let q = 0; q < 7; q++) { A += (r() - 0.5) * 0.8; X += Math.cos(A) * 9; Y += Math.sin(A) * 9; b.lineTo(X, Y); } b.stroke(); } });
      // 7 tampa de bueiro
      cell(7, (a, b) => { a.fillStyle = '#3c3a36'; a.beginPath(); a.arc(64, 64, 40, 0, 7); a.fill(); a.strokeStyle = '#262422'; a.lineWidth = 3; for (let s = -32; s <= 32; s += 9) { a.beginPath(); a.moveTo(64 + s, 30); a.lineTo(64 + s, 98); a.stroke(); } b.fillStyle = '#fff'; b.beginPath(); b.arc(64, 64, 42, 0, 7); b.fill(); });
      // 8 entulho / cacos
      cell(8, (a, b) => { for (let s = 0; s < 40; s++) { const v = 60 + r() * 140; a.fillStyle = css(v, v * 0.95, v * 0.9); const X = 14 + r() * 100, Y = 14 + r() * 100, w = 2 + r() * 8; a.fillRect(X, Y, w, w * 0.6); b.fillStyle = '#fff'; b.fillRect(X, Y, w, w * 0.6); } });
      // 9 sangue arrastado
      cell(9, (a, b) => { a.fillStyle = '#3a0403'; a.fillRect(0, 0, 128, 128); const g = b.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0.9)'); b.fillStyle = g; b.beginPath(); b.moveTo(50, 0); b.quadraticCurveTo(40, 70, 44, 128); b.lineTo(84, 128); b.quadraticCurveTo(88, 70, 76, 0); b.fill(); });
      // 10 marca de queimado / explosão
      cell(10, (a, b) => { a.fillStyle = '#060504'; a.fillRect(0, 0, 128, 128); const g = b.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); b.fillStyle = g; b.fillRect(0, 0, 128, 128); });
      // 12 anel de mira (tingido: aviso de fogo/queda)
      cell(12, (a, b) => { a.fillStyle = '#ffffff'; a.fillRect(0, 0, 128, 128); b.strokeStyle = '#fff'; b.lineWidth = 9; b.beginPath(); b.arc(64, 64, 52, 0, 7); b.stroke(); b.lineWidth = 4; b.beginPath(); b.arc(64, 64, 30, 0, 7); b.moveTo(64, 4); b.lineTo(64, 124); b.moveTo(4, 64); b.lineTo(124, 64); b.stroke(); });
      // 11 poça de ácido (verde luminescente)
      cell(11, (a, b) => { a.fillStyle = '#4ac014'; a.fillRect(0, 0, 128, 128); b.fillStyle = 'rgba(255,255,255,0.85)'; blobPath(b, 64, 64, 44, 20, 0.6); b.fill(); });
      return pack(c, m);
    }, { repeat: false }));
  }

  return { cnv, rng, vnoise, fbm, field, pack, wrapDraw, hexRGB, css, shade, T, once, asphalt, gravel, ground, water, cliff, detail, macro, clouds, horizon, blob, glow, decals };
})();
