'use strict';
/* Física da carroceria (só visual, não mexe no jogo): molas e amortecedores dão à lataria rolagem nas curvas,
   mergulho na freada, agachamento na arrancada, trancos em buracos, atropelamentos e batidas, a trepidação do asfalto
   e da terra, e o pulo da rampa. Cada veículo tem o seu peso e a sua suspensão. A cabine 3D do Piloto, o carro em
   3ª pessoa e a lataria que o Artilheiro vê usam o mesmo estado; as armas e os braços usam as acelerações. */
const CARFX = (() => {
  // f = frequência da mola (Hz), z = amortecimento, roll/pitch = inclinação (rad) por 1 g, hv = curso vertical (m por impulso)
  const VP = [null,
    { f: 1.75, z: 0.3, roll: 0.075, pitch: 0.055, hv: 1.0, rc: 0.45 },    // Uno de firma: molinha cansada
    { f: 1.35, z: 0.26, roll: 0.09, pitch: 0.06, hv: 0.9, rc: 0.5 },      // Opala: banheira
    { f: 1.6, z: 0.34, roll: 0.07, pitch: 0.045, hv: 1.15, rc: 0.62 },    // Hilux: alta, quica
    { f: 1.85, z: 0.46, roll: 0.045, pitch: 0.032, hv: 0.7, rc: 0.7 },    // carro-forte: pesado e duro
    { f: 1.15, z: 0.38, roll: 0.055, pitch: 0.035, hv: 0.85, rc: 1.1 },   // Scania: a cabine balança sobre o chassi
  ];
  const ST = {
    roll: 0, vr: 0, pitch: 0, vp: 0, heave: 0, vh: 0, yaw: 0, vy: 0,   // estado das molas (rad, rad/s, m, m/s)
    alat: 0, alon: 0, avert: 0, jolt: 0,                               // acelerações sentidas (m/s²) e solavanco do quadro (para armas e braços)
    vibX: 0, vibY: 0, t: -1, lsp: 0, lshake: 0, llat: 0, veh: 1, rough: 0, steer: 0,
  };
  const n1 = (t) => Math.sin(t * 1.7) * 0.5 + Math.sin(t * 2.9 + 1.3) * 0.3 + Math.sin(t * 5.3 + 0.4) * 0.2;   // ruído suave
  function spring(x, v, w, z, force, dt) { const a = force - w * w * x - 2 * z * w * v; v += a * dt; x += v * dt; return [x, v]; }

  function update() {
    if (typeof P === 'undefined' || !G.st || !S) return ST;
    const now = G.t; let dt = now - ST.t;
    if (ST.t < 0 || dt < 0 || dt > 0.5) { ST.t = now; ST.lsp = P.speed; ST.lshake = G.shake; ST.llat = P.lat || 0; return ST; }
    ST.t = now; if (dt <= 0) return ST; dt = Math.min(dt, 0.05);
    const vp = VP[ST.veh = S.veh || 1] || VP[1], w = vp.f * Math.PI * 2, sp = P.speed, asp = Math.abs(sp);
    // acelerações sentidas: longitudinal pela variação de velocidade; lateral pela curva da estrada, pelo volante e pelos trancos de lado
    const alon = (sp - ST.lsp) / dt; ST.lsp = sp;
    const cv = curveAt(Math.floor(P.z / SEG)), lat = P.lat || 0, dlat = (lat - ST.llat) / dt; ST.llat = lat;
    ST.steer += (P.steer - ST.steer) * Math.min(1, dt * 8);
    const alat = Math.max(-9, Math.min(9, ST.steer * Math.min(asp, 35) * 0.36 + cv * sp * sp * 0.09 + dlat * 0.12));
    ST.alon += (Math.max(-14, Math.min(9, alon)) - ST.alon) * Math.min(1, dt * 10); ST.alat += (alat - ST.alat) * Math.min(1, dt * 8);
    // trancos: cada aumento do tremor do jogo (atropelamento, batida, explosão) vira um impulso na mola
    const jump = G.shake - ST.lshake; ST.lshake = G.shake; let jolt = 0;
    if (jump > 0.04) { jolt = Math.min(2.2, jump); const sg = Math.random() < 0.5 ? -1 : 1; ST.vh += jolt * 0.55 * vp.hv; ST.vp += (Math.random() - 0.35) * jolt * 0.35; ST.vr += sg * jolt * 0.22; ST.vy += sg * jolt * 0.05; }
    // chão: asfalto trepida pouco; terra, acostamento e pneu furado trepidam muito
    const off = Math.abs(P.x) > ROADW, flat = S && S.up && S.up.pneu < 1 ? (P.tires || 0) : 0;
    ST.rough += ((off ? (S.up.susp ? 0.55 : 1) : 0.12) + flat * 0.25 - ST.rough) * Math.min(1, dt * 4);
    const r = ST.rough * Math.min(1, asp / 18), tt = now * (2 + asp * 0.35);
    const road = r * (n1(tt) * 0.9 + n1(tt * 2.3 + 5) * 0.5);
    // molas: rolagem (+ = lado direito sobe: deita para fora na curva à direita), arfagem (+ = bico desce: freada), altura
    let q = spring(ST.roll, ST.vr, w * 1.05, vp.z, ST.alat / 9.8 * vp.roll * (w * 1.05) * (w * 1.05) + r * n1(tt * 1.3 + 2) * 1.2, dt); ST.roll = q[0]; ST.vr = q[1];
    q = spring(ST.pitch, ST.vp, w * 1.2, vp.z, -ST.alon / 9.8 * vp.pitch * (w * 1.2) * (w * 1.2) + r * n1(tt * 0.9 + 7) * 0.8, dt); ST.pitch = q[0]; ST.vp = q[1];
    q = spring(ST.heave, ST.vh, w, vp.z, road * 6 * vp.hv, dt); ST.heave = q[0]; ST.vh = q[1];
    q = spring(ST.yaw, ST.vy, w * 0.8, 0.5, (P.slideT > 0 ? Math.sign(P.steer) * 0.25 : 0) * w * w * 0.64, dt); ST.yaw = q[0]; ST.vy = q[1];
    ST.roll = Math.max(-0.16, Math.min(0.16, ST.roll)); ST.pitch = Math.max(-0.1, Math.min(0.1, ST.pitch)); ST.heave = Math.max(-0.18, Math.min(0.18, ST.heave));
    // vibração do motor e do asfalto (alta frequência, para volante, painel e mira)
    const rpm = P.rpm || 0, ev = 0.0012 + rpm * 0.0016 + r * 0.004;
    ST.vibX = Math.sin(now * 61) * ev * 0.6 + Math.sin(now * 97 + 1) * ev * 0.4; ST.vibY = Math.sin(now * 53 + 2) * ev + Math.sin(now * 83) * ev * 0.5;
    ST.avert = -ST.vh * 4 + road * 2; ST.jolt = jolt;
    return ST;
  }
  /* matriz da carroceria no espaço do próprio carro: altura, arfagem (frente sobe/desce em volta do centro) e rolagem
     (em volta do centro de rolagem, à altura rc). Coluna (GL). k = quanto da física usar (1 = toda). */
  function bodyM(o, k, pivotZ) {
    const vp = VP[ST.veh] || VP[1], kk = k === undefined ? 1 : k, rl = ST.roll * kk, pt = ST.pitch * kk, yw = ST.yaw * kk, h = ST.heave * kk, rc = vp.rc, pz = pivotZ || 0;
    const cr = Math.cos(rl), sr = Math.sin(rl), cp = Math.cos(pt), sp = Math.sin(pt), cy = Math.cos(yw), sy = Math.sin(yw);
    // R = Ry(yaw) · Rx(pitch) · Rz(roll); depois translada para manter o pivô (0, rc, pz) no lugar e soma a altura
    const m00 = cy * cr + sy * sp * sr, m01 = -cy * sr + sy * sp * cr, m02 = sy * cp;
    const m10 = cp * sr, m11 = cp * cr, m12 = -sp;
    const m20 = -sy * cr + cy * sp * sr, m21 = sy * sr + cy * sp * cr, m22 = cy * cp;
    o[0] = m00; o[1] = m10; o[2] = m20; o[3] = 0; o[4] = m01; o[5] = m11; o[6] = m21; o[7] = 0; o[8] = m02; o[9] = m12; o[10] = m22; o[11] = 0;
    o[12] = -(m01 * rc + m02 * pz); o[13] = rc + h - (m11 * rc + m12 * pz); o[14] = pz - (m21 * rc + m22 * pz); o[15] = 1;
    return o;
  }
  // deslocamento vertical da carroceria em cima de uma roda (x, z no carro): o quanto a mola encolhe ali
  function wheelLift(x, z) { return ST.heave + ST.roll * x - ST.pitch * z; }
  function reset() { ST.roll = ST.vr = ST.pitch = ST.vp = ST.heave = ST.vh = ST.yaw = ST.vy = 0; ST.alat = ST.alon = ST.avert = 0; ST.t = -1; }
  return { update, bodyM, wheelLift, reset, S: ST, VP };
})();
