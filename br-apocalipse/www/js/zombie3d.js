'use strict';
/* Zumbis 3D: malhas poligonais com esqueleto de 13 ossos (como os personagens de PS1, cada parte presa a um osso),
   textura procedural com a pele luminescente da paleta de cada um, animação procedural por tipo e cadáveres. */
const Z3D = (() => {
  const M4 = GL3.M4, PI = Math.PI, TAU = PI * 2;
  const clampv = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, hsh = (n) => DRAW.hash(n);

  /* ================= TEXTURAS (atlas 512×512 por paleta) ================= */
  const RG = { HEAD: [0, 0, 256, 256], SKIN: [256, 0, 512, 128], PANTS: [256, 128, 384, 256], HAND: [384, 128, 448, 192], SHOE: [448, 128, 512, 192],
    MOUTH: [384, 192, 448, 256], BONE: [448, 192, 512, 256], SHIRT: [0, 256, 256, 384], SLEEVE: [256, 256, 384, 320], HAT: [384, 256, 512, 320],
    BELLY: [0, 384, 256, 512], ARMOR: [256, 320, 384, 448], CONC: [384, 320, 512, 448], VISOR: [256, 448, 384, 512], HAIR: [384, 448, 512, 512] };
  const uvOf = (r) => [(r[0] + 1) / 512, (r[1] + 1) / 512, (r[2] - 1) / 512, (r[3] - 1) / 512];
  const atlases = new Map();
  let pending = null;
  function atlasFor(P) {
    let a = atlases.get(P);
    if (a) return a;
    // um atlas novo por quadro, no máximo (gerar custa alguns ms): enquanto isso usa o primeiro pronto
    if (pending && pending !== P) { const first = atlases.values().next().value; if (first) return first; }
    pending = P; a = makeAtlas(P); atlases.set(P, a); setTimeout(() => { pending = null; }, 0);
    return a;
  }
  function makeAtlas(P) {
    return TEX3.T(() => {
      const S = 512, c = TEX3.cnv(S, S), x = c.getContext('2d'), m = TEX3.cnv(S, S), k = m.getContext('2d');
      const rgb = TEX3.hexRGB, css = TEX3.css, base = rgb(P[0]), shd = rgb(P[1]), brt = rgb(P[2]), con = rgb(P[3]), human = !!P.human, charcoal = !human && shd[0] + shd[1] + shd[2] < 120;
      const r = TEX3.rng(base[0] * 7 + base[1] * 13 + con[2] * 3 + 11);
      x.fillStyle = '#808080'; x.fillRect(0, 0, S, S); k.fillStyle = '#000'; k.fillRect(0, 0, S, S);
      const reg = (R, f) => {
        const w = R[2] - R[0], h = R[3] - R[1];
        for (const q of [x, k]) { q.save(); q.beginPath(); q.rect(R[0], R[1], w, h); q.clip(); q.translate(R[0], R[1]); }
        f(w, h); x.restore(); k.restore();
      };
      const fld = (w, h, n, ca, cb, grain, seed) => { const t = TEX3.cnv(w, h); TEX3.field(t.getContext('2d'), w, h, n, ca, cb, grain, seed); x.drawImage(t, 0, 0); };
      // pele luminescente: manchas entre sombra e brilho; máscara de brilho acompanha
      const skin = (w, h, seed, glowK) => {
        const t = TEX3.cnv(w, h), tx = t.getContext('2d'), tm = TEX3.cnv(w, h), tk = tm.getContext('2d');
        const n = TEX3.fbm(w, h, 4, 5, seed, 0.6), im = tx.createImageData(w, h), mm = tk.createImageData(w, h), rr = TEX3.rng(seed);
        for (let i = 0, j = 0; i < n.length; i++, j += 4) {
          let v = clampv((n[i] - 0.28) * 2.3, 0, 1); const g = (rr() - 0.5) * 0.08; v = clampv(v + g, 0, 1);
          let cr, cg, cb, gl;
          if (charcoal) {   // brasa: carvão rachado aceso por dentro
            const crack = v > 0.62 ? (v - 0.62) / 0.38 : 0;
            cr = lerp(shd[0], base[0], crack); cg = lerp(shd[1], base[1], crack); cb = lerp(shd[2], base[2], crack); gl = crack;
          } else if (v < 0.5) { const q = v * 2; cr = lerp(shd[0], base[0], q); cg = lerp(shd[1], base[1], q); cb = lerp(shd[2], base[2], q); gl = 0.45 + q * 0.25; }
          else { const q = (v - 0.5) * 2; cr = lerp(base[0], brt[0], q * 0.7); cg = lerp(base[1], brt[1], q * 0.7); cb = lerp(base[2], brt[2], q * 0.7); gl = 0.7 + q * 0.2; }
          im.data[j] = cr; im.data[j + 1] = cg; im.data[j + 2] = cb; im.data[j + 3] = 255;
          mm.data[j] = mm.data[j + 1] = mm.data[j + 2] = human ? 0 : gl * 255 * glowK; mm.data[j + 3] = 255;
        }
        tx.putImageData(im, 0, 0); tk.putImageData(mm, 0, 0); x.drawImage(t, 0, 0); k.drawImage(tm, 0, 0);
      };
      // veias ramificadas e bolhas na cor de contraste (brilham)
      const veins = (w, h, n, wid) => { if (human) return;
        for (let i = 0; i < n; i++) {
          let X = r() * w, Y = r() * h, A = r() * TAU; const L = 6 + (r() * 10 | 0), lw = wid * (0.6 + r() * 0.8);
          const path = (q, col, lw2) => { q.strokeStyle = col; q.lineWidth = lw2; q.lineCap = 'round'; q.beginPath(); let XX = X, YY = Y, AA = A; q.moveTo(XX, YY); const rs = TEX3.rng(i * 31 + 7); for (let s = 0; s < L; s++) { AA += (rs() - 0.5) * 1.2; XX += Math.cos(AA) * 5; YY += Math.sin(AA) * 5; q.lineTo(XX, YY); } q.stroke(); };
          path(x, css(con[0], con[1], con[2], 0.35), lw * 2.4); path(x, css(con[0], con[1], con[2]), lw); path(k, '#fff', lw * 1.6);
        }
      };
      const bubbles = (w, h, n, rmax) => { if (human) return;
        for (let i = 0; i < n; i++) {
          const X = r() * w, Y = r() * h, R = 1.5 + r() * rmax;
          x.fillStyle = css(con[0] * 0.55, con[1] * 0.55, con[2] * 0.55); x.beginPath(); x.arc(X, Y, R * 1.25, 0, 7); x.fill();
          x.fillStyle = css(con[0], con[1], con[2]); x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill();
          x.fillStyle = css(Math.min(255, con[0] + 90), Math.min(255, con[1] + 90), Math.min(255, con[2] + 90)); x.beginPath(); x.arc(X - R * 0.35, Y - R * 0.35, R * 0.35, 0, 7); x.fill();
          k.fillStyle = '#fff'; k.beginPath(); k.arc(X, Y, R * 1.15, 0, 7); k.fill();
        }
      };
      const wounds = (w, h, n) => { if (human) return;
        for (let i = 0; i < n; i++) {
          const X = r() * w, Y = r() * h, L = 6 + r() * 14, A = r() * PI;
          x.save(); x.translate(X, Y); x.rotate(A); x.fillStyle = '#2a0604'; x.beginPath(); x.ellipse(0, 0, L, 2.5 + r() * 2.5, 0, 0, 7); x.fill(); x.fillStyle = css(brt[0], brt[1] * 0.8, brt[2] * 0.5); x.beginPath(); x.ellipse(0, 0, L * 0.7, 1.1, 0, 0, 7); x.fill(); x.restore();
          k.save(); k.translate(X, Y); k.rotate(A); k.fillStyle = '#000'; k.beginPath(); k.ellipse(0, 0, L, 3.5, 0, 0, 7); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.ellipse(0, 0, L * 0.7, 1.3, 0, 0, 7); k.fill(); k.restore();
        }
      };
      // tecido em tons de cinza (tingido pela cor da roupa no shader): trama, rasgos, sangue, sujeira
      const cloth = (w, h, seed, opt) => {
        const t = TEX3.cnv(w, h), tx = t.getContext('2d'); TEX3.field(tx, w, h, TEX3.fbm(w, h, 4, 4, seed, 0.55), [150, 150, 150], [222, 222, 222], 26, seed); x.drawImage(t, 0, 0);
        x.globalAlpha = 0.25; x.strokeStyle = '#000'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < w; i += 3) { x.moveTo(i, 0); x.lineTo(i, h); } x.stroke(); x.globalAlpha = 1;
        for (let i = 0; i < (opt.dirt || 8); i++) { x.fillStyle = `rgba(70,52,30,${0.12 + r() * 0.2})`; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 20, 4 + r() * 12, r() * 3, 0, 7); x.fill(); }
        for (let i = 0; i < (opt.blood || 4); i++) {
          const X = r() * w, Y = r() * h * 0.7; x.fillStyle = `rgba(${90 + r() * 40 | 0},8,6,${0.55 + r() * 0.35})`; x.beginPath(); x.ellipse(X, Y, 5 + r() * 16, 4 + r() * 10, r() * 3, 0, 7); x.fill();
          for (let d = 0; d < 3; d++) { const dx = X + (r() - 0.5) * 16; x.fillRect(dx, Y, 2 + r() * 2, 8 + r() * 26); }
        }
        for (let i = 0; i < (opt.tears || 3); i++) {   // rasgos com borda desfiada
          const X = r() * w, Y = r() * h, R = 4 + r() * 9; x.fillStyle = '#1a1414'; x.beginPath(); for (let a = 0; a <= 12; a++) { const t2 = a / 12 * TAU, rr = R * (0.5 + r() * 0.8); a ? x.lineTo(X + Math.cos(t2) * rr * 1.4, Y + Math.sin(t2) * rr) : x.moveTo(X + Math.cos(t2) * rr * 1.4, Y + Math.sin(t2) * rr); } x.closePath(); x.fill();
          x.strokeStyle = '#d8d8d8'; x.lineWidth = 0.8; x.stroke();
        }
      };

      /* cabeça: volta inteira (u: costas→direita→frente→esquerda→costas; v: topo→queixo) */
      reg(RG.HEAD, (w, h) => {
        skin(w, h, 101, 1);
        // cabelo ralo no topo e na nuca (não brilha)
        for (let i = 0; i < 1600; i++) {
          const u = r(), back = u < 0.3 || u > 0.7, vmax = back ? 0.62 : 0.17 + Math.abs(u - 0.5) * 0.3;
          const v = Math.pow(r(), 1.6) * vmax; if (r() < 0.22) continue;   // falhas (careca)
          const X = u * w, Y = v * h; x.strokeStyle = r() < 0.5 ? '#1c140c' : '#2e2216'; x.lineWidth = 1 + r(); x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 6, Y + 3 + r() * 7); x.stroke();
          k.strokeStyle = '#000'; k.lineWidth = 2; k.beginPath(); k.moveTo(X, Y); k.lineTo(X, Y + 8); k.stroke();
        }
        const cx = w / 2;
        // orelhas
        for (const ex of [w * 0.25, w * 0.75]) { x.fillStyle = css(shd[0], shd[1], shd[2]); x.beginPath(); x.ellipse(ex, 118, 9, 17, 0, 0, 7); x.fill(); x.fillStyle = '#1a0806'; x.beginPath(); x.ellipse(ex, 120, 3, 7, 0, 0, 7); x.fill(); }
        if (human) {
          for (const s2 of [-1, 1]) { const ex = cx + s2 * 17, ey = 110; x.fillStyle = '#f0ece0'; x.beginPath(); x.ellipse(ex, ey, 8, 4.5, 0, 0, 7); x.fill(); x.fillStyle = '#3a2414'; x.beginPath(); x.arc(ex, ey, 3.4, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(ex, ey, 1.6, 0, 7); x.fill(); x.fillStyle = '#2a1a0e'; x.fillRect(ex - 9, ey - 11, 18, 3.5); }
          x.fillStyle = css(shd[0], shd[1], shd[2], 0.55); x.beginPath(); x.moveTo(cx - 5, 146); x.lineTo(cx, 124); x.lineTo(cx + 5, 146); x.fill();
          x.fillStyle = '#6a2a22'; x.fillRect(cx - 13, 192, 26, 3.5); x.fillStyle = 'rgba(40,24,14,0.5)'; for (let i = 0; i < 260; i++) x.fillRect(cx - 34 + r() * 68, 178 + r() * 60, 1.2, 1.2);   // barba por fazer
          return;
        }
        // sobrancelha funda, maçãs encovadas
        x.fillStyle = css(shd[0] * 0.8, shd[1] * 0.8, shd[2] * 0.8, 0.55); x.beginPath(); x.ellipse(cx, 94, 40, 9, 0, 0, 7); x.fill();
        for (const s of [-1, 1]) { x.fillStyle = css(shd[0] * 0.7, shd[1] * 0.7, shd[2] * 0.7, 0.5); x.beginPath(); x.ellipse(cx + s * 24, 152, 11, 17, s * 0.3, 0, 7); x.fill(); }
        // órbitas escuras e olhos acesos
        for (const s of [-1, 1]) {
          const ex = cx + s * 17, ey = 110;
          x.fillStyle = css(shd[0] * 0.35, shd[1] * 0.35, shd[2] * 0.35); x.beginPath(); x.ellipse(ex, ey, 13, 10, s * 0.15, 0, 7); x.fill();
          x.fillStyle = '#0a0604'; x.beginPath(); x.ellipse(ex, ey + 1, 9.5, 7, s * 0.15, 0, 7); x.fill();
          k.fillStyle = '#000'; k.beginPath(); k.ellipse(ex, ey, 13, 10, 0, 0, 7); k.fill();
          const g = x.createRadialGradient(ex + s, ey + 1, 0, ex + s, ey + 1, 6); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.5, '#fff4c4'); g.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = g; x.beginPath(); x.arc(ex + s, ey + 1, 6, 0, 7); x.fill();
          k.fillStyle = '#fff'; k.beginPath(); k.arc(ex + s, ey + 1, 4.5, 0, 7); k.fill();
        }
        // nariz carcomido
        x.fillStyle = css(shd[0] * 0.6, shd[1] * 0.6, shd[2] * 0.6); x.beginPath(); x.moveTo(cx - 7, 146); x.lineTo(cx, 124); x.lineTo(cx + 7, 146); x.fill();
        x.fillStyle = '#120404'; x.beginPath(); x.ellipse(cx - 4, 145, 3, 4.5, 0.3, 0, 7); x.ellipse(cx + 4, 145, 3, 4.5, -0.3, 0, 7); x.fill();
        k.fillStyle = '#000'; k.fillRect(cx - 8, 140, 16, 10);
        // boca rasgada com dentes
        x.fillStyle = '#2a0404'; x.beginPath(); x.ellipse(cx, 196, 23, 9, 0, 0, 7); x.fill();
        x.fillStyle = '#e8e0c4'; for (let i = -5; i <= 5; i++) { if (r() < 0.25) continue; const hh = 4 + r() * 4; x.fillRect(cx + i * 3.6 - 1.4, 189, 2.8, hh); x.fillRect(cx + i * 3.6 - 1.4, 203 - hh * 0.8, 2.8, hh * 0.8); }
        x.strokeStyle = '#3a0606'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 23, 196); x.lineTo(cx - 34, 188); x.moveTo(cx + 23, 196); x.lineTo(cx + 33, 202); x.stroke();
        k.fillStyle = '#000'; k.beginPath(); k.ellipse(cx, 196, 26, 11, 0, 0, 7); k.fill();
        k.fillStyle = '#555'; for (let i = -5; i <= 5; i++) k.fillRect(cx + i * 3.6 - 1.4, 189, 2.8, 5);
        // veias na testa e têmporas, uma mordida no rosto
        x.save(); k.save(); x.translate(cx - 40, 40); k.translate(cx - 40, 40); veins(80, 50, 4, 1.4); x.restore(); k.restore();
        wounds(w, h, 2);
        if (!charcoal) bubbles(w, h * 0.8, 5, 3.5);
      });
      reg(RG.SKIN, (w, h) => { skin(w, h, 202, 1); veins(w, h, 16, 1.6); bubbles(w, h, 12, 4.5); wounds(w, h, 4); });
      reg(RG.HAND, (w, h) => { skin(w, h, 303, 1); x.strokeStyle = css(shd[0] * 0.5, shd[1] * 0.5, shd[2] * 0.5); x.lineWidth = 1.5; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(i * w / 5, h * 0.45); x.lineTo(i * w / 5, h); x.stroke(); } x.fillStyle = '#1a120c'; for (let i = 0; i < 5; i++) x.fillRect(i * w / 5 + 2, h - 7, w / 5 - 4, 7); k.fillStyle = '#000'; k.fillRect(0, h - 7, w, 7); });
      reg(RG.BELLY, (w, h) => { skin(w, h, 404, 1.15); x.strokeStyle = css(shd[0], shd[1], shd[2], 0.6); x.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.quadraticCurveTo(X + 6, Y + 4, X + 14, Y + 1); x.stroke(); } veins(w, h, 12, 2); bubbles(w, h, 26, 7); });
      reg(RG.MOUTH, (w, h) => { x.fillStyle = '#3a0808'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a1010'; x.beginPath(); x.ellipse(w / 2, h * 0.6, w * 0.3, h * 0.25, 0, 0, 7); x.fill(); x.fillStyle = '#ddd4b8'; for (let i = 0; i < 8; i++) { if (r() < 0.3) continue; x.fillRect(4 + i * 7, 2, 5, 6 + r() * 4); } k.fillStyle = '#222'; k.fillRect(0, 0, w, h); });
      reg(RG.SHIRT, (w, h) => {
        cloth(w, h, 505, { blood: 6, tears: 5, dirt: 10 });
        x.strokeStyle = 'rgba(30,30,30,0.7)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * 0.4, 0); x.quadraticCurveTo(w * 0.5, 22, w * 0.6, 0); x.stroke();   // gola
        x.fillStyle = 'rgba(40,40,40,0.8)'; for (let y = 26; y < h - 8; y += 18) { x.beginPath(); x.arc(w * 0.5, y, 2.2, 0, 7); x.fill(); }                 // botões
        x.strokeStyle = 'rgba(60,60,60,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(w * 0.25, 0); x.lineTo(w * 0.25, h); x.moveTo(w * 0.75, 0); x.lineTo(w * 0.75, h); x.stroke();   // costuras laterais
      });
      reg(RG.SLEEVE, (w, h) => cloth(w, h, 606, { blood: 2, tears: 2, dirt: 4 }));
      reg(RG.PANTS, (w, h) => {
        cloth(w, h, 707, { blood: 3, tears: 2, dirt: 12 });
        x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < w; i += 2) { x.moveTo(i, 0); x.lineTo(i + 3, h); } x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.08, 0, 0, 7); x.fill();   // joelho gasto
        x.fillStyle = 'rgba(60,40,20,0.35)'; x.fillRect(0, h * 0.85, w, h * 0.15);
      });
      reg(RG.SHOE, (w, h) => { fld(w, h, TEX3.fbm(w, h, 2, 3, 808, 0.5), [34, 24, 18], [70, 50, 36], 12, 3); x.strokeStyle = '#8a7a60'; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(w * 0.3, 10 + i * 8); x.lineTo(w * 0.7, 14 + i * 8); x.stroke(); } x.fillStyle = '#141010'; x.fillRect(0, h - 8, w, 8); });
      reg(RG.BONE, (w, h) => { fld(w, h, TEX3.fbm(w, h, 2, 3, 909, 0.5), [190, 176, 150], [236, 228, 206], 14, 4); x.fillStyle = 'rgba(90,20,10,0.5)'; x.fillRect(0, h * 0.75, w, h * 0.25); });
      reg(RG.HAT, (w, h) => {
        fld(w, h, TEX3.fbm(w, h, 4, 4, 111, 0.6), [74, 48, 26], [124, 86, 48], 18, 5);
        x.strokeStyle = 'rgba(30,18,8,0.7)'; x.setLineDash([3, 3]); x.lineWidth = 1; x.strokeRect(4, 4, w - 8, h - 8); x.setLineDash([]);
        x.fillStyle = '#d8b040'; for (let i = 0; i < 5; i++) { const X = 14 + i * 25, Y = h / 2; x.beginPath(); for (let a = 0; a < 10; a++) { const t2 = a / 10 * TAU - PI / 2, rr = a % 2 ? 3 : 7; a ? x.lineTo(X + Math.cos(t2) * rr, Y + Math.sin(t2) * rr) : x.moveTo(X + Math.cos(t2) * rr, Y + Math.sin(t2) * rr); } x.fill(); }
      });
      reg(RG.ARMOR, (w, h) => {
        fld(w, h, TEX3.fbm(w, h, 4, 4, 222, 0.6), [20, 26, 34], [44, 54, 66], 10, 6);
        x.strokeStyle = 'rgba(120,135,150,0.6)'; x.lineWidth = 2; for (let y = 16; y < h; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
        x.strokeStyle = 'rgba(160,170,180,0.35)'; x.lineWidth = 1; for (let i = 0; i < 30; i++) { const X = r() * w, Y = r() * h; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 18, Y + (r() - 0.5) * 6); x.stroke(); }
        x.fillStyle = '#9aa4ae'; for (let y = 8; y < h; y += 32) for (let X = 8; X < w; X += 24) { x.beginPath(); x.arc(X, y, 1.8, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(110,10,8,0.7)'; x.beginPath(); x.ellipse(w * 0.6, h * 0.4, 14, 9, 0.4, 0, 7); x.fill();
      });
      reg(RG.VISOR, (w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a3a44'); g.addColorStop(0.5, '#0a1014'); g.addColorStop(1, '#1a2228'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(200,230,255,0.25)'; x.fillRect(0, h * 0.2, w, 4); for (const s of [-1, 1]) { x.fillStyle = css(brt[0], brt[1], brt[2]); x.beginPath(); x.arc(w / 2 + s * 14, h * 0.55, 3, 0, 7); x.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(w / 2 + s * 14, h * 0.55, 4, 0, 7); k.fill(); } });
      reg(RG.CONC, (w, h) => { fld(w, h, TEX3.fbm(w, h, 4, 5, 333, 0.6), [96, 96, 92], [150, 150, 144], 30, 7); for (let i = 0; i < 160; i++) { const v = 70 + r() * 110; x.fillStyle = css(v, v, v * 0.95); x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } x.strokeStyle = '#6a3a1a'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(r() * w, 0); x.lineTo(r() * w, h); x.stroke(); } });
      reg(RG.HAIR, (w, h) => { x.fillStyle = '#1c140c'; x.fillRect(0, 0, w, h); });
      return TEX3.pack(c, m);
    }, { repeat: false });
  }

  /* ================= MALHAS ================= */
  // anéis elípticos ao longo de y no espaço do osso: [y, rx, rz, cx, cz]; u dá a volta (frente = meio da região), v de cima p/ baixo
  function loft(b, rings, sides, uv, capTop, capBot, capUV) {
    const n = rings.length, ymin = rings[0][0], ymax = rings[n - 1][0], base = b.v.length / GL3.STRIDE;
    const P = (j, kk) => { const R = rings[j], a = kk / sides * TAU; return [(R[3] || 0) + R[1] * Math.sin(a), R[0], (R[4] || 0) - R[2] * Math.cos(a)]; };
    for (let j = 0; j < n; j++) for (let kk = 0; kk <= sides; kk++) {
      const p = P(j, kk), a1 = P(j, kk + 1), a0 = P(j, kk - 1), b1 = P(Math.min(n - 1, j + 1), kk), b0 = P(Math.max(0, j - 1), kk);
      const tx = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], ty = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      let nx = ty[1] * tx[2] - ty[2] * tx[1], ny = ty[2] * tx[0] - ty[0] * tx[2], nz = ty[0] * tx[1] - ty[1] * tx[0];
      const R = rings[j]; if (nx * (p[0] - (R[3] || 0)) + nz * (p[2] - (R[4] || 0)) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1;
      b.vert(p[0], p[1], p[2], nx / l, ny / l, nz / l, uv[0] + (uv[2] - uv[0]) * kk / sides, uv[3] - (uv[3] - uv[1]) * (p[1] - ymin) / ((ymax - ymin) || 1));
    }
    for (let j = 0; j < n - 1; j++) for (let kk = 0; kk < sides; kk++) { const A = base + j * (sides + 1) + kk, B = A + 1, Dd = A + sides + 1, C = Dd + 1; b.tri(A, Dd, C); b.tri(A, C, B); }
    const cap = (j, up) => {
      const R = rings[j], cu = capUV || uv, mu = (cu[0] + cu[2]) / 2, mv = up ? cu[1] + (cu[3] - cu[1]) * 0.1 : cu[3] - (cu[3] - cu[1]) * 0.1;
      const c0 = b.vert(R[3] || 0, R[0], R[4] || 0, 0, up ? 1 : -1, 0, mu, mv), s0 = b.v.length / GL3.STRIDE;
      for (let kk = 0; kk <= sides; kk++) { const p = P(j, kk), a = kk / sides * TAU; b.vert(p[0], p[1], p[2], 0, up ? 1 : -1, 0, mu + Math.sin(a) * (cu[2] - cu[0]) * 0.4, mv - Math.cos(a) * (cu[3] - cu[1]) * 0.4); }
      for (let kk = 0; kk < sides; kk++) { if (up) b.tri(c0, s0 + kk + 1, s0 + kk); else b.tri(c0, s0 + kk, s0 + kk + 1); }
    };
    if (capTop) cap(n - 1, true); if (capBot) cap(0, false);
  }
  // caixa alinhada (no espaço do osso)
  function boxP(b, x0, x1, y0, y1, z0, z1, uv) {
    const f = (nx, ny, nz, pts, u0, v0, u1, v1) => { const i = [b.vert(pts[0][0], pts[0][1], pts[0][2], nx, ny, nz, u0, v1), b.vert(pts[1][0], pts[1][1], pts[1][2], nx, ny, nz, u0, v0), b.vert(pts[2][0], pts[2][1], pts[2][2], nx, ny, nz, u1, v0), b.vert(pts[3][0], pts[3][1], pts[3][2], nx, ny, nz, u1, v1)]; b.tri(i[0], i[1], i[2]); b.tri(i[0], i[2], i[3]); };
    const [u0, v0, u1, v1] = uv;
    f(0, 0, -1, [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], u0, v0, u1, v1);
    f(0, 0, 1, [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], u0, v0, u1, v1);
    f(-1, 0, 0, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], u0, v0, u1, v1);
    f(1, 0, 0, [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], u0, v0, u1, v1);
    f(0, 1, 0, [[x0, y1, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1]], u0, v0, u1, v1);
    f(0, -1, 0, [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], u0, v0, u1, v1);
  }
  // aplica rotação (euler y·z·x) + translação aos últimos vértices criados (para pôr chifres, espinhos, escudo no lugar)
  function xform(b, from, rx, ry, rz, tx, ty, tz, sc) {
    const m = rot(rx, ry, rz), S = GL3.STRIDE, s = sc || 1;
    for (let o = from * S; o < b.v.length; o += S) {
      const x = b.v[o] * s, y = b.v[o + 1] * s, z = b.v[o + 2] * s, nx = b.v[o + 3], ny = b.v[o + 4], nz = b.v[o + 5];
      b.v[o] = m[0] * x + m[1] * y + m[2] * z + tx; b.v[o + 1] = m[3] * x + m[4] * y + m[5] * z + ty; b.v[o + 2] = m[6] * x + m[7] * y + m[8] * z + tz;
      b.v[o + 3] = m[0] * nx + m[1] * ny + m[2] * nz; b.v[o + 4] = m[3] * nx + m[4] * ny + m[5] * nz; b.v[o + 5] = m[6] * nx + m[7] * ny + m[8] * nz;
    }
  }
  // rotação Ry·Rz·Rx em linhas (3×3)
  function rot(ax, ay, az) {
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
    return [cb * cc, -cb * sc * ca + sb * sa, cb * sc * sa + sb * ca, sc, cc * ca, -cc * sa, -sb * cc, sb * sc * ca + cb * sa, -sb * sc * sa + cb * ca];
  }

  /* esqueleto humanoide: [pai, x, y, z] (1,75 m de referência) */
  const HB = { HIP: 0, CHEST: 1, HEAD: 2, UA: 3, FA: 4, UB: 5, FB: 6, TA: 7, SA: 8, TB: 9, SB: 10, JAW: 11, PROP: 12 };
  function skeleton(o) {
    const s = o.s, w = o.w, ar = o.arms || 1, lg = o.legs || 1;
    return [
      [-1, 0, 0.95 * s * lg + (1 - lg) * 0.02, 0], [0, 0, 0.09 * s, 0], [1, 0, 0.42 * s * (o.neck || 1), 0.015 * s], [1, 0.185 * s * w, 0.365 * s, 0], [3, 0, -0.29 * s * ar, 0],
      [1, -0.185 * s * w, 0.365 * s, 0], [5, 0, -0.29 * s * ar, 0], [0, 0.095 * s * w, -0.04 * s, 0], [7, 0, -0.45 * s * lg, 0], [0, -0.095 * s * w, -0.04 * s, 0], [9, 0, -0.45 * s * lg, 0],
      [2, 0, 0.075 * s * (o.hs || 1), -0.005 * s], [1, 0, 0.95 * s, 0.05 * s],
    ];
  }
  const meshes = {};
  function humanoid(key, o) {
    if (meshes[key]) return meshes[key];
    const b = new GL3.Builder(), s = o.s, w = o.w, hs = (o.hs || 1) * s, ar = o.arms || 1, lg = o.legs || 1, SD = 10;
    const R = (y, rx, rz, cx, cz) => [y * s, rx * s * w, rz * s * w, (cx || 0) * s * w, (cz || 0) * s];
    const part = (bone, mat, rings, sides, region, ct, cb, cuv) => { b.bone = bone; b.mat = mat; loft(b, rings, sides, uvOf(region), ct, cb, cuv && uvOf(cuv)); };
    const pants = o.pants === false ? 0 : 2, torsoMat = o.bare ? 0 : 1, torsoRG = o.bare ? RG.SKIN : RG.SHIRT;
    // quadril
    part(HB.HIP, pants ? 2 : 0, [R(-0.12, 0.13, 0.095), R(-0.04, 0.155, 0.105), R(0.06, 0.15, 0.1), R(0.12, 0.14, 0.095)], SD, pants ? RG.PANTS : RG.SKIN, false, true);
    // tronco (barrigudo no Boiadeiro)
    const bel = o.belly || 0;
    part(HB.CHEST, torsoMat, [R(-0.04, 0.142, 0.094), R(0.06, 0.15 + bel * 0.2, 0.102 + bel * 0.26, 0, bel * 0.12), R(0.16, 0.162 + bel * 0.22, 0.11 + bel * 0.27, 0, bel * 0.14), R(0.26, 0.18 + bel * 0.12, 0.115 + bel * 0.14, 0, 0.01 + bel * 0.06), R(0.34, 0.19, 0.11, 0, 0.005), R(0.4, 0.165, 0.095), R(0.44, 0.09, 0.06)], SD, torsoRG, true, false);
    if (bel) part(HB.CHEST, 0, [R(-0.02, 0.15, 0.16, 0, 0.08), R(0.06, 0.25, 0.3, 0, 0.15), R(0.16, 0.29, 0.36, 0, 0.19), R(0.26, 0.25, 0.3, 0, 0.14), R(0.33, 0.14, 0.15, 0, 0.07)], SD + 2, RG.BELLY, true, true);   // barriga inchada exposta
    // pescoço, cabeça e mandíbula (bone 2/11)
    b.bone = HB.HEAD; b.mat = 0;
    const H = (y, rx, rz, cz) => [y * hs, rx * hs, rz * hs, 0, (cz || 0) * hs];
    loft(b, [[-0.07 * s, 0.045 * hs, 0.05 * hs, 0, 0], [0.04 * s, 0.047 * hs, 0.052 * hs, 0, 0.005 * hs], [0.09 * hs, 0.05 * hs, 0.055 * hs, 0, 0.0]], 8, uvOf(RG.SKIN), false, false);
    loft(b, [H(0.072, 0.072, 0.083, 0.02), H(0.12, 0.083, 0.097, 0.01), H(0.165, 0.087, 0.1, 0.004), H(0.205, 0.086, 0.098, 0), H(0.245, 0.07, 0.082, -0.006), H(0.272, 0.034, 0.04, -0.01)], 12, [0, (256 * 0.0 + 1) / 512, 255 / 512, (256 * 0.76) / 512], true, true, RG.MOUTH);
    b.bone = HB.JAW; loft(b, [H(-0.07, 0.038, 0.045, 0.045), H(-0.035, 0.062, 0.074, 0.03), H(0.0, 0.07, 0.082, 0.022)], 12, [0, (256 * 0.76) / 512, 255 / 512, 255 / 512], true, false, RG.MOUTH);
    // braços
    const sl = o.sleeve === undefined ? 2 : o.sleeve, aw = o.armW || 1;
    for (const [ua, fa, sx] of [[HB.UA, HB.FA, 1], [HB.UB, HB.FB, -1]]) {
      const A = (y, r1, r2) => [y * s * ar, r1 * s * w * aw, r2 * s * w * aw, 0, 0];
      part(ua, sl ? 1 : 0, [A(0.035, 0.05, 0.05), A(-0.02, 0.058, 0.056), A(-0.16, 0.05, 0.048), A(-0.3, 0.043, 0.042)], 8, sl ? RG.SLEEVE : RG.SKIN, true, false);
      part(fa, sl > 1 ? 1 : 0, [A(0.01, 0.043, 0.042), A(-0.1, 0.044, 0.039), A(-0.25, 0.032, 0.029)], 8, sl > 1 ? RG.SLEEVE : RG.SKIN, false, false);
      // mão em garra
      part(fa, 0, [A(-0.235, 0.03, 0.024), A(-0.29, 0.046, 0.022), A(-0.36, 0.044, 0.018, 0, 0.01), A(-0.41, 0.026, 0.012, 0, 0.02)], 6, RG.HAND, false, true);
    }
    // pernas e pés
    for (const [th, sh] of [[HB.TA, HB.SA], [HB.TB, HB.SB]]) {
      const Lg = (y, r1, r2, cz) => [y * s * lg, r1 * s * w, r2 * s * w, 0, (cz || 0) * s];
      part(th, pants ? 2 : 0, [Lg(0.05, 0.08, 0.08), Lg(-0.1, 0.079, 0.081), Lg(-0.3, 0.062, 0.066), Lg(-0.45, 0.052, 0.056)], 8, pants ? RG.PANTS : RG.SKIN, false, false);
      const shorts = o.shorts;
      part(sh, shorts ? 0 : pants ? 2 : 0, [Lg(0.01, 0.053, 0.057), Lg(-0.13, 0.054, 0.06, -0.01), Lg(-0.32, 0.039, 0.043), Lg(-0.4, 0.035, 0.039)], 8, shorts || !pants ? RG.SKIN : RG.PANTS, false, false);
      const bare = o.shoes === 0 || (o.shoes === 1 && th === HB.TB);
      b.bone = sh; b.mat = 0; boxP(b, -0.048 * s * w, 0.048 * s * w, -0.47 * s * lg, -0.39 * s * lg, -0.06 * s, 0.17 * s, uvOf(bare ? RG.SKIN : RG.SHOE));
    }
    // acessórios
    if (o.hat === 'boiadeiro' || o.hat === 'cangaceiro') {
      b.bone = HB.HEAD; b.mat = 0; const hu = uvOf(RG.HAT);
      loft(b, [H(0.2, 0.094, 0.106, -0.004), H(0.27, 0.088, 0.098, -0.006), H(0.32, 0.07, 0.08, -0.008)], 10, hu, true, false);
      if (o.hat === 'boiadeiro') { loft(b, [H(0.205, 0.2, 0.22, -0.004), H(0.215, 0.205, 0.225, -0.004), H(0.222, 0.1, 0.11, -0.004)], 14, hu, true, true); }
      else {   // chapéu de couro em meia-lua, aba dobrada para cima na frente
        const s0 = b.v.length / GL3.STRIDE; loft(b, [[-0.005, 0.2 * hs, 0.012 * hs, 0, 0], [0.005, 0.2 * hs, 0.012 * hs, 0, 0], [0.11 * hs, 0.17 * hs, 0.01 * hs, 0, 0], [0.16 * hs, 0.09 * hs, 0.008 * hs, 0, 0]], 12, hu, true, true);
        xform(b, s0, -0.15, 0, 0, 0, 0.21 * hs, 0.05 * hs);
      }
    }
    if (o.helmet) {   // capacete com viseira (Encouraçado)
      b.bone = HB.HEAD; b.mat = 0;
      loft(b, [H(0.1, 0.098, 0.112, 0.004), H(0.17, 0.101, 0.114, 0.002), H(0.23, 0.094, 0.106, -0.004), H(0.275, 0.07, 0.08, -0.008), H(0.3, 0.03, 0.035, -0.01)], 12, uvOf(RG.ARMOR), true, true);
      const s0 = b.v.length / GL3.STRIDE; boxP(b, -0.085 * hs, 0.085 * hs, 0.085 * hs, 0.19 * hs, -0.01 * hs, 0.012 * hs, uvOf(RG.VISOR)); xform(b, s0, 0.08, 0, 0, 0, 0, 0.11 * hs);
    }
    if (o.armor) {   // colete, ombreiras, caneleiras e escudo no antebraço B
      b.bone = HB.CHEST; b.mat = 0; const au = uvOf(RG.ARMOR);
      loft(b, [R(0.02, 0.16, 0.11), R(0.12, 0.172, 0.122, 0, 0.004), R(0.26, 0.198, 0.13, 0, 0.012), R(0.36, 0.205, 0.12, 0, 0.006), R(0.41, 0.15, 0.09)], 10, au, true, true);
      for (const ua of [HB.UA, HB.UB]) { b.bone = ua; loft(b, [[-0.12 * s, 0.07 * s * w, 0.07 * s * w, 0, 0], [0.0, 0.08 * s * w, 0.078 * s * w, 0, 0], [0.06 * s, 0.05 * s * w, 0.05 * s * w, 0, 0]], 8, au, true, true); }
      for (const sh of [HB.SA, HB.SB]) { b.bone = sh; loft(b, [[-0.33 * s, 0.05 * s * w, 0.06 * s * w, 0, 0.012 * s], [-0.03 * s, 0.062 * s * w, 0.072 * s * w, 0, 0.012 * s]], 8, au, true, true); }
      b.bone = HB.CHEST; const s0 = b.v.length / GL3.STRIDE; boxP(b, -0.26 * s, 0.26 * s, -0.48 * s, 0.5 * s, -0.025 * s, 0.025 * s, au); xform(b, s0, 0.06, 0.28, 0, -0.1 * s, 0.12 * s, 0.33 * s);   // escudo de choque à frente do peito
    }
    if (o.spikes) {   // espinhos de osso saindo das costas, ombros e antebraços
      const spike = (bone, x, y, z, ax, az, len) => { b.bone = bone; b.mat = 0; const s0 = b.v.length / GL3.STRIDE; loft(b, [[0, 0.022 * s, 0.022 * s, 0, 0], [len * 0.55 * s, 0.012 * s, 0.012 * s, 0, 0], [len * s, 0.002 * s, 0.002 * s, 0, 0]], 5, uvOf(RG.BONE), false, true); xform(b, s0, ax, 0, az, x * s * w, y * s, z * s); };
      for (let i = 0; i < 7; i++) spike(HB.CHEST, (i % 2 ? 1 : -1) * (0.04 + (i % 3) * 0.04), 0.06 + i * 0.05, -0.1, -1.2 - (i % 3) * 0.2, (i % 2 ? -1 : 1) * 0.4, 0.18 + (i % 3) * 0.06);
      for (const [ua, sx] of [[HB.UA, 1], [HB.UB, -1]]) spike(ua, sx * 0.03, -0.02, -0.02, -0.4, sx * 1.1, 0.16);
      for (const [fa, sx] of [[HB.FA, 1], [HB.FB, -1]]) { spike(fa, 0, -0.08, -0.03, -1.9, sx * 0.4, 0.14); spike(fa, 0, -0.16, -0.03, -1.9, sx * 0.3, 0.12); }
    }
    if (o.block) {   // bloco de concreto acima da cabeça (osso PROP)
      b.bone = HB.PROP; b.mat = 0; boxP(b, -0.55 * s, 0.55 * s, -0.05 * s, 0.38 * s, -0.3 * s, 0.3 * s, uvOf(RG.CONC));
    }
    const mesh = b.mesh(); mesh.skel = skeleton(o); mesh.spec = o;
    return (meshes[key] = mesh);
  }

  /* tipos: proporções e roupas */
  const SPEC = {
    andarilhoA: { s: 1.0, w: 1.0, sleeve: 2, shoes: 2 },
    andarilhoB: { s: 0.98, w: 0.95, sleeve: 1, shoes: 1 },
    corredor: { s: 1.0, w: 0.95, sleeve: 1, shoes: 2, legs: 1.03 },
    carrapato: { s: 0.9, w: 0.82, sleeve: 0, bare: true, shorts: true, shoes: 0, arms: 1.3, hs: 1.08 },
    boiadeiro: { s: 1.0, w: 1.12, sleeve: 1, shoes: 2, belly: 1, hat: 'boiadeiro', legs: 0.9 },
    engolidor: { s: 1.0, w: 0.92, sleeve: 0, bare: true, shorts: true, shoes: 0 },
    encouracado: { s: 1.04, w: 1.12, sleeve: 2, shoes: 2, armor: true, helmet: true },
    cangaceiro: { s: 0.97, w: 0.98, sleeve: 2, shoes: 2, hat: 'cangaceiro', spikes: true },
    colosso: { s: 1.78, w: 1.45, sleeve: 0, bare: true, shoes: 0, block: true, armW: 1.35, hs: 0.8 },
  };
  // cores das roupas (tingem as regiões cinza do atlas)
  const SHIRTS = [[0.42, 0.46, 0.55], [0.55, 0.38, 0.28], [0.36, 0.45, 0.33], [0.5, 0.42, 0.55], [0.62, 0.22, 0.2], [0.66, 0.6, 0.48], [0.75, 0.75, 0.72], [0.3, 0.32, 0.36]];
  const PANTS = [[0.28, 0.36, 0.5], [0.3, 0.3, 0.32], [0.4, 0.34, 0.26], [0.22, 0.26, 0.38], [0.45, 0.42, 0.36]];
  const TYPE_TINT = { corredor: [[0.58, 0.14, 0.12], [0.24, 0.2, 0.22]], encouracado: [[0.2, 0.25, 0.32], [0.17, 0.2, 0.26]], cangaceiro: [[0.5, 0.34, 0.2], [0.38, 0.27, 0.16]], boiadeiro: [[0.6, 0.52, 0.38], [0.3, 0.36, 0.48]], engolidor: [[0.2, 0.15, 0.12], [0.18, 0.13, 0.1]], carrapato: [[0.3, 0.28, 0.26], [0.25, 0.22, 0.2]], colosso: [[0.3, 0.3, 0.3], [0.22, 0.22, 0.22]] };
  function specKey(e) { if (e.type === 'andarilho') return (Math.abs(e.id | 0) % 3) === 1 ? 'andarilhoB' : 'andarilhoA'; return SPEC[e.type] ? e.type : 'andarilhoA'; }

  return { RG, uvOf, atlasFor, loft, boxP, xform, rot, humanoid, SPEC, SHIRTS, PANTS, TYPE_TINT, specKey, HB, clampv, lerp, hsh };
})();
