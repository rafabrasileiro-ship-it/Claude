'use strict';
/* Kit de modelagem do motor 3D: primitivas com faces sempre orientadas para fora (o triângulo é girado conforme a normal pedida),
   para montar carros, cenário e chefes em poucas linhas. */
const K3 = (() => {
  const S = GL3.STRIDE, PI = Math.PI, TAU = PI * 2;
  // triângulo orientado pela normal n (corrige o sentido sozinho)
  function triN(b, a, c, d, n) {
    const v = b.v, A = a * S, B = c * S, C = d * S;
    const ux = v[B] - v[A], uy = v[B + 1] - v[A + 1], uz = v[B + 2] - v[A + 2], wx = v[C] - v[A], wy = v[C + 1] - v[A + 1], wz = v[C + 2] - v[A + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.tri(a, c, d); else b.tri(a, d, c);
  }
  // quadrilátero p0..p3 (em volta), normal n, uv = [u0,v0,u1,v1]: p0→(u0,v1) p1→(u0,v0) p2→(u1,v0) p3→(u1,v1)
  function quad(b, p0, p1, p2, p3, n, uv, twoSided) {
    const i0 = b.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0], uv[3]), i1 = b.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv[0], uv[1]);
    const i2 = b.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[2], uv[1]), i3 = b.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv[2], uv[3]);
    triN(b, i0, i1, i2, n); triN(b, i0, i2, i3, n);
    if (twoSided) { const m = [-n[0], -n[1], -n[2]]; const j0 = b.vert(p0[0], p0[1], p0[2], m[0], m[1], m[2], uv[0], uv[3]), j1 = b.vert(p1[0], p1[1], p1[2], m[0], m[1], m[2], uv[0], uv[1]), j2 = b.vert(p2[0], p2[1], p2[2], m[0], m[1], m[2], uv[2], uv[1]), j3 = b.vert(p3[0], p3[1], p3[2], m[0], m[1], m[2], uv[2], uv[3]); triN(b, j0, j1, j2, m); triN(b, j0, j2, j3, m); }
  }
  // caixa; uv pode ser um retângulo só ou { side, top, front, back, bottom }; rep = repetições da textura por metro (opcional)
  function box(b, x0, x1, y0, y1, z0, z1, uv, rep) {
    const U = (k) => (uv && uv.length === 4 ? uv : (uv[k] || uv.side));
    const sc = (r, w, h) => { if (!rep) return r; return [r[0], r[1], r[0] + (r[2] - r[0]) * w * rep, r[1] + (r[3] - r[1]) * h * rep]; };
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0, fl = (r) => [r[2], r[1], r[0], r[3]];   // faces verticais: u espelhado (mundo mão esquerda)
    quad(b, [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1], fl(sc(U('front'), sx, sy)));
    quad(b, [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [0, 0, -1], fl(sc(U('back'), sx, sy)));
    quad(b, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], fl(sc(U('side'), sz, sy)));
    quad(b, [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [1, 0, 0], fl(sc(U('side'), sz, sy)));
    if (!uv || uv.length === 4 || uv.top !== null) quad(b, [x0, y1, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [0, 1, 0], sc(U('top'), sx, sz));
    if (uv && uv.bottom) quad(b, [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, -1, 0], sc(U('bottom'), sx, sz));
  }
  // cilindro/cone ao longo de um eixo ('y', 'x' ou 'z'), r0 na base e r1 no topo
  function cyl(b, c, r0, r1, h, sides, axis, uvSide, uvCap, caps, a0) {
    const P = (r, t, a) => { const ca = Math.cos(a) * r, sa = Math.sin(a) * r; return axis === 'x' ? [c[0] + t, c[1] + ca, c[2] + sa] : axis === 'z' ? [c[0] + ca, c[1] + sa, c[2] + t] : [c[0] + ca, c[1] + t, c[2] + sa]; };
    const N = (a, ny) => { const ca = Math.cos(a), sa = Math.sin(a); return axis === 'x' ? [ny, ca, sa] : axis === 'z' ? [ca, sa, ny] : [ca, ny, sa]; };
    const slope = (r0 - r1) / (h || 1), base = b.v.length / S, A0 = a0 || 0;
    for (let k = 0; k <= sides; k++) {
      const a = A0 + k / sides * TAU, n = N(a, slope), l = Math.hypot(n[0], n[1], n[2]), u = uvSide[0] + (uvSide[2] - uvSide[0]) * k / sides;
      const p0 = P(r0, 0, a), p1 = P(r1, h, a);
      b.vert(p0[0], p0[1], p0[2], n[0] / l, n[1] / l, n[2] / l, u, uvSide[3]); b.vert(p1[0], p1[1], p1[2], n[0] / l, n[1] / l, n[2] / l, u, uvSide[1]);
    }
    for (let k = 0; k < sides; k++) {
      const i = base + k * 2, am = A0 + (k + 0.5) / sides * TAU, nm = N(am, slope);
      triN(b, i, i + 1, i + 3, nm); triN(b, i, i + 3, i + 2, nm);
    }
    if (caps) for (const [t, r, sg] of [[0, r0, -1], [h, r1, 1]]) {
      if (r < 0.001) continue; const n = axis === 'x' ? [sg, 0, 0] : axis === 'z' ? [0, 0, sg] : [0, sg, 0], cu = uvCap || uvSide;
      const mu = (cu[0] + cu[2]) / 2, mv = (cu[1] + cu[3]) / 2, ru = (cu[2] - cu[0]) / 2, rv = (cu[3] - cu[1]) / 2;
      const pc = P(0, t, 0), c0 = b.vert(pc[0], pc[1], pc[2], n[0], n[1], n[2], mu, mv), s0 = b.v.length / S;
      for (let k = 0; k <= sides; k++) { const a = A0 + k / sides * TAU, p = P(r, t, a); b.vert(p[0], p[1], p[2], n[0], n[1], n[2], mu + Math.cos(a) * ru, mv + Math.sin(a) * rv); }
      for (let k = 0; k < sides; k++) triN(b, c0, s0 + k, s0 + k + 1, n);
    }
  }
  // perfil convexo (z,y) extrudado em x de x0 a x1; lados com uvSide (mapeado pela caixa do perfil), bordas com uvEdge(i) → uv
  function extrude(b, prof, x0, x1, uvSide, uvEdge, insetTop) {
    let zmin = 1e9, zmax = -1e9, ymin = 1e9, ymax = -1e9;
    for (const p of prof) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
    const cz = prof.reduce((s, p) => s + p[0], 0) / prof.length, cy = prof.reduce((s, p) => s + p[1], 0) / prof.length;
    const xi = (p, side) => { const t = insetTop ? (p[1] - ymin) / ((ymax - ymin) || 1) * insetTop : 0; return side < 0 ? x0 + t : x1 - t; };
    for (const side of [-1, 1]) {   // tampas laterais (leque)
      const n = [side, 0, 0], uz = (z) => uvSide[0] + (uvSide[2] - uvSide[0]) * (z - zmin) / ((zmax - zmin) || 1), vy = (y) => uvSide[3] - (uvSide[3] - uvSide[1]) * (y - ymin) / ((ymax - ymin) || 1);
      const c0 = b.vert(side < 0 ? x0 + (insetTop || 0) * 0.5 * (cy - ymin) / ((ymax - ymin) || 1) : x1 - (insetTop || 0) * 0.5 * (cy - ymin) / ((ymax - ymin) || 1), cy, cz, n[0], 0, 0, uz(cz), vy(cy)), s0 = b.v.length / S;
      for (const p of prof) b.vert(xi(p, side), p[1], p[0], n[0], 0, 0, uz(p[0]), vy(p[1]));
      for (let i = 0; i < prof.length; i++) triN(b, c0, s0 + i, s0 + (i + 1) % prof.length, n);
    }
    for (let i = 0; i < prof.length; i++) {   // faixas do contorno
      const p = prof[i], q = prof[(i + 1) % prof.length], dz = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dz, dy) || 1;
      let n = [0, -dz / l, dy / l]; if (n[1] * ((p[1] + q[1]) / 2 - cy) + n[2] * ((p[0] + q[0]) / 2 - cz) < 0) n = [0, -n[1], -n[2]];
      const uv = uvEdge(i, n, l);
      if (!uv) continue;
      quad(b, [xi(p, -1), p[1], p[0]], [xi(q, -1), q[1], q[0]], [xi(q, 1), q[1], q[0]], [xi(p, 1), p[1], p[0]], n, uv);
    }
  }
  // esfera irregular (pedras, copas): anéis × gomos com deslocamento por ruído
  function blob(b, c, rx, ry, rz, seg, rings, uv, jit, seed) {
    const H = (n) => { const x = Math.sin(n * 127.1 + (seed || 1) * 311.7) * 43758.5453; return x - Math.floor(x); }, base = b.v.length / S, pts = [];
    for (let j = 0; j <= rings; j++) for (let k = 0; k <= seg; k++) {
      const th = j / rings * PI, ph = k / seg * TAU, kk = k % seg, jit2 = (j === 0 || j === rings) ? 0 : (H(j * 31 + kk * 7) - 0.5) * (jit || 0);
      const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph), f = 1 + jit2;
      b.vert(c[0] + nx * rx * f, c[1] + ny * ry * f, c[2] + nz * rz * f, nx, ny, nz, uv[0] + (uv[2] - uv[0]) * k / seg, uv[1] + (uv[3] - uv[1]) * j / rings);
    }
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) {
      const a = base + j * (seg + 1) + k, bb = a + 1, c2 = a + seg + 1, d = c2 + 1, th = (j + 0.5) / rings * PI, ph = (k + 0.5) / seg * TAU;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      triN(b, a, bb, d, n); triN(b, a, d, c2, n);
    }
  }
  // cartões cruzados com alfa (folhagem): n planos verticais girados em volta de y, dupla face
  function cards(b, c, w, h, n, uv, tilt) {
    for (let i = 0; i < n; i++) {
      const a = i / n * PI, ca = Math.cos(a) * w / 2, sa = Math.sin(a) * w / 2, nn = [-Math.sin(a), 0, Math.cos(a)], t = tilt || 0;
      quad(b, [c[0] - ca, c[1], c[2] - sa], [c[0] - ca + nn[0] * t, c[1] + h, c[2] - sa + nn[2] * t], [c[0] + ca + nn[0] * t, c[1] + h, c[2] + sa + nn[2] * t], [c[0] + ca, c[1], c[2] + sa], nn, uv, true);
    }
  }
  // transforma (Ry·Rz·Rx + translação + escala) os vértices criados desde 'from'
  function xf(b, from, rx, ry, rz, tx, ty, tz, sc) { Z3D.xform(b, from, rx, ry, rz, tx, ty, tz, sc); }
  const mark = (b) => b.v.length / S;
  // atlas: retângulo em px → uv com margem de meio texel
  const R = (W) => (x0, y0, x1, y1) => [(x0 + 0.5) / W, (y0 + 0.5) / W, (x1 - 0.5) / W, (y1 - 0.5) / W];
  // modelo = lista de submalhas {mesh, tex, atest}
  function model(parts) { return parts.filter(p => p.b.v.length).map(p => ({ mesh: p.b.mesh(), tex: p.tex, atest: !!p.atest })); }

  return { triN, quad, box, cyl, extrude, blob, cards, xf, mark, R, model, PI, TAU };
})();
