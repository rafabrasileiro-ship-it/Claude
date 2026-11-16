'use strict';
/* Os 10 Chefes de Estrada */
ENEMY.escolta = { nome: 'F-350 do Cangaço', hp: 2400, w: 2.2, h: 2.2, cor: '#5a4a3a', veh: 1, armor: 3 };
ENEMY.rampa = { nome: 'Rampa do Navio', hp: 1e9, w: 8, h: 6, cor: '#555', estatico: 1 };

const BOSS = (() => {
  const part = (id, nome, ox, oy, w, h, hp, pen, o) => Object.assign({ id, nome, ox, oy, w, h, hp, max: hp, pen, vuln: true, dead: false, req: true }, o || {});
  const R = DRAW.R;
  let b = null;

  function start(key) {
    const def = BOSSES[key], f = (S.mode === 'furia' ? 1.6 : 1);
    b = G.boss = { key, def, x: 0, rel: 60, w: def.w, h: def.h, parts: [], t: 0, ph: 'intro', pt: 0, at: [0, 0, 0, 0], front: false, hordas: false, vf: -1, sx: 0, sy: 0, sh: 0, n: 0 };
    G.haz = []; G.offroadBoss = false; G.stats.bossSrc = {};
    const P_ = b.parts;
    switch (key) {
      case 'usineiro': P_.push(part('pino1', 'Pino de engate', -0.7, 0.7, 0.5, 0.5, 300, 1, { cor: '#e22' }), part('pino2', 'Pino de engate', 0.7, 0.7, 0.5, 0.5, 300, 1, { cor: '#e22' }), part('g1', 'Galão de etanol', -1.2, 2.5, 0.6, 0.8, 220, 1, { cor: '#3a8ad0' }), part('g2', 'Galão de etanol', 0, 2.5, 0.6, 0.8, 220, 1, { cor: '#3a8ad0' }), part('g3', 'Galão de etanol', 1.2, 2.5, 0.6, 0.8, 220, 1, { cor: '#3a8ad0' })); break;
      case 'guincho': P_.push(part('cabo', 'Cabo de aço', 0, 0.8, 0.5, 0.5, 300, 1, { cor: '#ccc', vuln: false, req: false, meleeOk: true }), part('motor', 'Motor do guincho', 0, 2.2, 1.4, 0.9, 800, 1, { cor: '#c82', vuln: false })); b.cycles = 0; break;
      case 'reidograu': [-1.5, -0.95, 0.95, 1.5].forEach((ox, i) => P_.push(part('pneu' + i, 'Pneu gigante', ox, 0.1, 0.5, 1.6, 520, 1, { cor: '#111', vuln: false }))); b.rel = -40; b.front = true; b.bikers = 12; break;
      case 'tatuzao': P_.push(part('gr1', 'Grade de ventilação', -0.9, 0.9, 0.6, 0.5, 750, 2, { cor: '#555', ads: true }), part('gr2', 'Grade de ventilação', 0.9, 0.9, 0.6, 0.5, 750, 2, { cor: '#555', ads: true }), part('visor', 'Fresta do visor', 0, 2.5, 1.0, 0.25, 550, 2, { cor: '#8ac', ads: true })); break;
      case 'ceifador': P_.push(part('pi1', 'Pistão hidráulico', -3.6, 2.0, 0.7, 1.1, 1200, 3, { cor: '#ddd' }), part('pi2', 'Pistão hidráulico', 3.6, 2.0, 0.7, 1.1, 1200, 3, { cor: '#ddd' })); b.rel = 420; b.front = true; b.ph = 'contramao'; b.shoulder = true; break;
      case 'derrubador': P_.push(part('cab', 'Cabine da escavadeira', 0, 3.2, 1.2, 1.0, 1500, 3, { cor: '#8cf' }), part('m1', 'Mangueira hidráulica', -0.9, 2.2, 0.4, 0.9, 650, 2, { cor: '#222' }), part('m2', 'Mangueira hidráulica', 0.9, 2.2, 0.4, 0.9, 650, 2, { cor: '#222' })); break;
      case 'carrasco': P_.push(part('rampa', 'Rampa dos carros-bomba', 0, 3.3, 2.4, 0.8, 2300, 3, { cor: '#a33' }), part('cab', 'Gaiola / cabine', 0, 1.4, 1.8, 1.0, 1900, 3, { cor: '#445' })); b.hordas = true; b.col = 0; break;
      case 'corisco': P_.push(part('cor', 'Caminhonete do Coronel', 0, 0.9, 2.0, 1.4, 2800, 3, { cor: '#7a5a2a', vuln: false })); b.esc = [-1, 1].map(s => spawn('escolta', s * 5, P.z + 30, { rel: 30, side: s, script: true })); break;
      case 'iluminado': for (let i = 0; i < 4; i++) P_.push(part('ger' + i, 'Gerador do paredão', -1.35 + i * 0.9, 0.9, 0.6, 0.7, 950, 3, { cor: '#dd3' })); b.hordas = true; break;
      case 'leviata': P_.push(part('comp', 'Comporta dos buggies', 0, 1.0, 2.2, 1.4, 2600, 3, { cor: '#633' }), part('tq1', 'Tanque de combustível', 0, 3.0, 2.4, 1.0, 3600, 4, { cor: '#aaa', vuln: false })); b.fase = 1; break;
    }
    const hm = f * (1.5 + def.n * 0.2); b.hm = hm; for (const p of P_) { p.hp *= hm; p.max *= hm; }
    G.banner = { t: 6, a: 'CHEFE DE ESTRADA ' + def.n + '/10 — ' + def.nome, b: def.sub };
    SFX.horn(); say('ALGUÉM BLOQUEOU A RODOVIA! É ' + def.nome + '!', 'ai', 5);
  }
  const alive = () => b.parts.filter(p => !p.dead);
  const hpFrac = () => { b = G.boss; if (!b) return 0; let a = 0, m = 0; for (const p of b.parts) if (p.req) { a += Math.max(0, p.hp); m += p.max; } return m ? a / m : 0; };
  const follow = (rel, sp, x, xs, dt) => { b.rel += clamp(rel - b.rel, -sp * dt, sp * dt); if (x != null) b.x += clamp(x - b.x, -xs * dt, xs * dt); };
  const every = (i, s, dt) => { b.at[i] += dt; if (b.at[i] >= s) { b.at[i] = 0; return true; } return false; };
  function hazard(x, zAhead, r, kind, delay, life) { G.haz.push({ x, z: P.z + zAhead, r, kind, delay: delay || 0, life: life || 4, t: 0 }); }

  function hitPart(p, dmg, pen, src) {
    b = G.boss; if (!b || !p || p.dead) return;
    if (!p.vuln) { if (src.by === 'player' && !src.peer) SFX.ric(); return; }
    if (pen < p.pen) dmg *= 0.18;
    if (p.ads) { if (src.by === 'player' && !src.ads) { dmg *= 0.1; if (!src.peer && Math.random() < 0.3) say('Blindagem! Use a Mira de Ferro nas grades e no visor.', 'sys', 2, true); } else if (src.by === 'ai') dmg *= 0.5; else if (src.by === 'pilot') dmg *= 0.6; }
    p.hp -= dmg; p.flash = 0.08; G.stats.bossSrc[src.wid || src.by || 'x'] = 1;
    if (p.hp <= 0) { p.dead = true; p.hp = 0; if (b.vf >= G.frame - 1) fxBoom(b.sx + p.ox * b.k, b.sy - (p.oy + p.h / 2) * b.k, 60); else SFX.boom(); say(p.nome + ' DESTRUÍDO!', 'sys', 2.5); onPart(p); }
  }
  function onPart(p) {
    if (b.key === 'guincho' && p.id === 'cabo') { b.ph = 'exposto'; b.pt = 0; b.cable = false; b.parts[1].vuln = true; say('CABO SERRADO! O motor do guincho está exposto — FOGO!', 'ai', 4); return; }
    if (b.key === 'leviata') { if (p.id === 'comp') { b.parts[1].vuln = true; say('Comporta destruída! Explodam o TANQUE com os canhões!', 'ai', 4); } if (p.id === 'tq1') { fase2(); return; } if (p.id.startsWith('ch') && b.parts.filter(q => q.id.startsWith('ch') && !q.dead).length === 0) { b.parts.find(q => q.id === 'nuc').vuln = true; say('NÚCLEO BLINDADO EXPOSTO!', 'ai', 4); } }
    if (b.parts.every(q => q.dead || !q.req)) dead();
  }
  function dead() {
    const key = b.key; addScrap(200 + b.def.n * 45); G.flash = 1; G.shake = 2.5; fxBoom(G.W / 2, G.H * 0.4, 220); say(b.def.nome + ' FOI PRO FERRO-VELHO!', 'sys', 5);
    if (key === 'corisco') { const k = Object.keys(G.stats.bossSrc).filter(s => s !== 'ai' && s !== 'aoe'); if (k.length && k.every(s => s === 'c20' || s === 'serralat')) unlockAch('cangaceiro'); }
    if (key === 'iluminado' && G.cam === 'fpp' && !G.offroadBoss) unlockAch('aguia');
    G.haz = []; G.qte = null;
    if (key === 'leviata') { porto(); return; }
    startSaque();
  }
  function fase2() {
    b.fase = 2; b.ph = 'lado'; G.flash = 1; fxBoom(G.W / 2, G.H * 0.4, 260); G.shake = 3;
    say('O VAGÃO TRASEIRO SE SOLTOU NUMA BOLA DE FOGO! Emparelhem com o vagão central!', 'ai', 6);
    b.parts = [part('ch1', 'Chapa de aço', 0, 0.8, 2.6, 0.9, 1700, 4, { cor: '#555' }), part('ch2', 'Chapa de aço', 0, 1.8, 2.6, 0.9, 1700, 4, { cor: '#5a5a5a' }), part('ch3', 'Chapa de aço', 0, 2.8, 2.6, 0.9, 1700, 4, { cor: '#606060' }), part('nuc', 'Núcleo blindado', 0, 1.5, 1.4, 1.4, 4200, 4, { cor: '#e62', vuln: false })]; for (const p of b.parts) { p.hp *= b.hm * 0.6; p.max = p.hp; }
    for (let i = 0; i < 6; i++) hazard(rnd(-6, 6), 60 + i * 30, 2.5, 'fogo', 0, 6);
  }
  function porto() {
    b.fase = 3; b.ph = 'porto'; b.parts = []; b.hordas = true; b.dist = P.z + 1100; b.rel = 2000; G.phase = 'boss';
    G.banner = { t: 7, a: 'O SALTO NO PORTO DO MUCURIPE', b: 'O navio soltou as amarras! Rampa a 110+ km/h, alinhado no centro!' };
    say('TURBO MÁXIMO E MOTOSSERRAS LIGADAS! Atravessa a parede de carne!', 'ai', 6);
    b.ramp = spawn('rampa', 0, b.dist); for (let i = 0; i < 4; i++) spawn('colosso', rnd(-5, 5), P.z + 300 + i * 190);
  }

  function update(dt) {
    b = G.boss; if (!b) return; b.t += dt; b.pt += dt; const V = G.V;
    for (const p of b.parts) if (p.flash > 0) p.flash -= dt;
    // perigos na pista
    for (const h of G.haz) { h.t += dt; const dz = h.z - P.z, hit = Math.abs(dz) < h.r + 1.5 && Math.abs(h.x - P.x) < h.r + V.w * 0.6;
      if (h.kind === 'fogo' && h.t > h.delay && hit) { armorDmg(7 * dt, 'Queimado no etanol.'); P.temp += dt * 0.08; G.smokeIn = Math.min(0.6, G.smokeIn + dt); }
      if (h.kind === 'alvo' && !h.done && h.t >= h.delay) { h.done = true; h.life = h.delay + 0.3; const vis = dz > 2 && dz < 200; if (vis) fxBoom(G.W / 2 + (h.x - P.x) * 30, G.H * 0.55, 90); else SFX.boom(); if (hit) { armorDmg(h.dmg || 16, 'Esmagado por destroços.'); crack(); G.shake = 2; } else if (h.wreck && Math.random() < 0.4) spawn('carcaca', h.x, h.z, {}); aoe(h.x, h.z, h.r + 1, 200); } }
    G.haz = G.haz.filter(h => h.t < h.life && h.z > P.z - 30);
    if (b.ph === 'intro') { follow(38, 30, 0, 3, dt); if (b.rel <= 39 || b.key === 'reidograu') { b.ph = 'luta'; b.pt = 0; } return; }
    switch (b.key) {
      case 'usineiro': {
        follow(34, 6, Math.sin(b.t * 0.4) * 3, 2, dt);
        if (every(0, 4.2, dt)) { say('Comporta aberta: zumbis em chamas!', 'ai', 2); for (let i = 0; i < 3; i++) spawn('engolidor', b.x + rnd(-2.5, 2.5), P.z + b.rel - 4 - i * 3); if (Math.random() < 0.3 && latchCount(0) < 1) { const e = spawn('engolidor', P.x, P.z + 2); latch(e, 0); } }
        if (every(1, 5.5, dt)) { const x = clamp(P.x + rnd(-2, 2), -5, 5); hazard(x, 30 + P.speed * 1.2, 2.2, 'fogo', 0.8, 7); say('Molotov na pista!', 'ai', 1.5); }
        break; }
      case 'guincho': {
        if (b.ph === 'luta') { follow(30, 6, P.x * 0.7, 2.5, dt); if (b.pt > 4.5) { b.ph = 'preso'; b.pt = 0; b.cable = true; const c = b.parts[0]; c.dead = false; c.hp = c.max; c.vuln = true; say('ARPÃO TRAVOU NO PARA-CHOQUE! Pisa fundo e SERRA O CABO!', 'ai', 5); SFX.crash(); G.shake = 1.5; } else if (b.pt > 3) G.led.H = 0.3; }
        else if (b.ph === 'preso') {
          follow(22, 8, 0, 2, dt); const ctl = G.role === 'pilot' ? I : { gas: 1, steer: -1 };
          const drag = 2.6 - (ctl.gas > 0 ? 1.1 : 0) - (ctl.steer < -0.3 ? 1.0 : 0); P.x += (drag + 10.5 * Math.max(0, P.steer) * 0 + (P.lat > 0 ? 0 : -P.lat * 0.55)) * dt; P.speed = Math.min(P.speed, 16); P.rpm = Math.max(P.rpm, ctl.gas > 0 ? 0.97 : 0.3); P.temp += ctl.gas > 0 ? dt * 0.02 : 0;
          if (G.frame % 4 === 0 && ctl.gas > 0) G.fx.push({ x: G.W / 2 + rnd(-80, 80), y: G.H * 0.9, vx: rnd(-30, 30), vy: -60, g: 0, life: 0.6, cor: '#888', s: 8 });
          if (P.x >= ROADW - V.w) { armorDmg(34, 'Arrastado para fora da ponte do Rio Grande.'); P.x = 0; b.ph = 'luta'; b.pt = 0; b.cable = false; b.parts[0].vuln = false; say('O CARRO BATEU NA MURETA QUEBRADA! Quase caiu no Rio Grande!', 'sys', 4); G.shake = 2.5; SFX.crash(); crack(); }
        } else if (b.ph === 'exposto') { follow(26, 6, P.x * 0.5, 2, dt); if (b.pt > 12) { b.ph = 'luta'; b.pt = 0; b.parts[1].vuln = false; say('O guincho recolheu o motor. Lá vem outro arpão!', 'ai', 3); } }
        break; }
      case 'reidograu': {
        const tires = b.parts;
        if (b.bikers > 0 && every(0, 5, dt) && G.ents.filter(e => e.type === 'moto' && !e.dead).length < 3) { b.bikers--; spawn('moto', rnd(-4, 4), P.z - 50, { rel: -50 }); }
        if (b.ph === 'luta') { b.front = true; for (const p of tires) p.vuln = false; follow(-26, 14, P.x, 3, dt); if (b.pt > 7) { b.ph = 'investida'; b.pt = 0; b.ok = false; SFX.horn(); say('MONSTER TRUCK VAI SUBIR NO TETO! FREIO DE MÃO AGORA!', 'ai', 2.5); G.led.H = 2; } }
        else if (b.ph === 'investida') {
          follow(-6, 16, P.x, 6, dt); G.flash = Math.max(G.flash, 0.12);
          if (G.role === 'pilot' ? (P.brakeT > 0.15) : b.pt > 0.8) b.ok = true;
          if (b.pt > 1.7) { if (b.ok) say('PASSOU POR CIMA! Rasga os pneus dele com as motosserras!', 'ai', 3.5); else { armorDmg(26, 'Esmagado pela Monster Truck.'); crack(); crack(); G.shake = 3; SFX.crash(); say('ELE ESMAGOU O TETO!', 'sys', 3); } b.ph = 'frente'; b.pt = 0; b.rel = 8; b.dur = b.ok ? 10 : 5; }
        } else {
          b.front = false; for (const p of tires) p.vuln = true; const close = P.speed > 20 && (G.role !== 'pilot' || I.gas > 0);
          follow(close ? 4.5 : 15, 6, b.x + Math.sin(b.t) * 0.5, 2, dt);
          if (b.rel < 6.5 && Math.abs(b.x - P.x) < 2.6) { const a = alive(); if (a.length) { const sw = P.saws && S.up.serra > 0; hitPart(pick(a), (sw ? 420 * S.up.serra : 90) * dt * (G.turboT > 0 ? 2 : 1), 5, { by: 'car' }); if (!sw) armorDmg(2 * dt); if (G.frame % 3 === 0) fxSpark(G.W / 2 + rnd(-60, 60), G.H * 0.6, 3); G.shake = Math.max(G.shake, 0.4); } }
          if (b.pt > b.dur) { b.ph = 'luta'; b.pt = 0; b.rel = -40; }
        }
        break; }
      case 'tatuzao': {
        follow(32, 6, Math.sin(b.t * 0.5) * 3.5, 2, dt);
        if (every(0, 5, dt) && Math.abs(b.x - P.x) < 3.5) { P.oil = 1; splat(3, '#0a0a0a'); say('JATO DE ÓLEO no para-brisa! Limpador!', 'ai', 2.5); SFX.splat(); }
        if (every(1, 9, dt)) { G.gas = 5; say('Granada de gás lacrimogêneo!', 'ai', 2.5); }
        if (every(2, 1, dt)) { armorDmg(1.6 * (S.up.janela >= 2 ? 0.5 : 1)); gunnerDmg(5); SFX.gun('lmg', { dist: Math.max(6, Math.abs(b.rel)), pan: clamp((b.x - P.x) / 8, -0.8, 0.8) }); if (Math.random() < 0.04) crack(); }
        break; }
      case 'ceifador': {
        if (b.ph === 'contramao') {
          b.front = true; b.shoulder = b.rel < 260; b.x = 0; b.rel -= (20 + P.speed * 0.5) * dt;
          if (b.rel < 240 && b.rel > 60) G.led.H = 0.3; if (b.rel < 250 && !b.warned) { b.warned = true; SFX.horn(); say('COLHEITADEIRA NA CONTRAMÃO! Joga pro acostamento de terra!', 'ai', 4); }
          if (b.rel < 3) { if (Math.abs(P.x) < b.w / 2 + V.w) { armorDmg(38, 'Engolido pelo cilindro de corte.'); P.speed *= 0.3; crack(); crack(); G.shake = 3; SFX.crash(); splat(3); } b.ph = 'persegue'; b.pt = 0; b.rel = -8; b.warned = false; b.shoulder = false; say('Ela deu meia-volta! Está na nossa traseira — atirem nos PISTÕES!', 'ai', 4); }
        } else {
          b.front = true; const want = P.speed > 30 ? -26 : -9; follow(want, P.speed > 30 ? 5 : 3.5, P.x * 0.5, 2, dt);
          if (b.rel > -15) { armorDmg(5 * dt, 'Torrado pelo lança-chamas.'); G.smokeIn = Math.min(0.7, G.smokeIn + dt); if (every(1, 1.5, dt)) say('LANÇA-CHAMAS! Acelera!', 'ai', 1.5); }
          if (b.rel > -10) { armorDmg(22 * dt, 'Triturado pelo cilindro de corte.'); G.shake = 1.2; }
          if (b.pt > 15) { b.ph = 'contramao'; b.pt = 0; b.rel = 430; say('Ela sumiu no meio da soja... vai voltar pela contramão!', 'ai', 3); }
        }
        break; }
      case 'derrubador': {
        follow(44, 6, Math.sin(b.t * 0.6) * 2.5, 2, dt);
        if (every(0, alive().some(p => p.id !== 'cab') ? 2.1 : 3.4, dt)) { const x = clamp(P.x + P.lat * 0.9 + rnd(-1.5, 1.5), -6, 6); const h = { x, z: P.z + P.speed * 1.5 + 6, r: 2.3, kind: 'alvo', delay: 1.5, life: 3, t: 0, wreck: true, dmg: 17 }; G.haz.push(h); if (Math.random() < 0.3) say(pick(['Carro voando! Desvia!', 'Barril explosivo vindo!', 'Pedregulho na curva!']), 'ai', 1.5); }
        break; }
      case 'carrasco': {
        follow(42, 6, 0, 2, dt);
        if (!b.parts[0].dead && every(0, 4.5, dt)) { spawn('carrobomba', pick([-4, 0, 4]), P.z + b.rel - 3, { rel: b.rel - 3 }); say('CARRO-BOMBA descendo a rampa! Explode antes de chegar!', 'ai', 2.5); }
        if ((b.col === 0 && b.t > 7) || (b.col === 1 && hpFrac() < 0.5)) { b.col++; spawn('colosso', -3, P.z + b.rel - 5); if (b.col === 1) spawn('colosso', 3, P.z + b.rel - 12); say('SOLTARAM OS COLOSSOS DA GAIOLA!', 'ai', 4); }
        break; }
      case 'corisco': {
        const esc = b.esc.filter(e => !e.dead); follow(30, 6, Math.sin(b.t * 0.4) * 2, 2, dt);
        b.parts[0].vuln = esc.length === 0; if (esc.length === 0 && !b.said) { b.said = true; say('Escoltas partidas ao meio! O Coronel está isolado!', 'ai', 4); }
        b.chainOn = false;
        for (const e of esc) {
          const flank = b.pt % 16 < 10; e.rel += clamp((flank ? 1 : 16) - e.rel, -9 * dt, 9 * dt); const tx = flank ? P.x + e.side * (V.w + 2.6) : e.side * 4; e.x += clamp(tx - e.x, -4 * dt, 4 * dt); e.z = P.z + e.rel;
          if (flank && Math.abs(e.rel) < 4) { if (S.up.lateral >= 2 && P.saws && Math.abs(e.x - P.x) < V.w + 2.9) { e.hp -= 320 * dt; G.stats.bossSrc.serralat = 1; if (G.frame % 3 === 0) fxSpark(e.side < 0 ? 60 : G.W - 60, G.H * 0.6, 3); if (e.hp <= 0) killEnt(e, { by: 'car' }); } if (every(e.side < 0 ? 2 : 3, 0.8, dt)) { armorDmg(2.2); gunnerDmg(5); SFX.gun('fer', { dist: 3 + Math.abs(e.rel), pan: e.side * 0.8 }); } }
        }
        if (esc.length === 2 && Math.abs(esc[0].rel) < 4 && Math.abs(esc[1].rel) < 4) { b.chainOn = true; b.ct = (b.ct || 0) + dt; if (b.ct > 3.5 && !b.cw) { b.cw = true; say('CORRENTE INCANDESCENTE! Freia pra sair do meio!', 'ai', 2.5); SFX.horn(); } if (b.ct > 5.8) { b.ct = 0; b.cw = false; armorDmg(20, 'Cortado pela corrente incandescente.'); crack(); crack(); G.shake = 2; SFX.crash(); } if (P.brakeT > 0.3 || (G.role !== 'pilot' && b.cw)) { for (const e of esc) e.rel = 14; b.ct = 0; b.cw = false; } } else { b.ct = 0; b.cw = false; }
        if (!G.qte && every(0, 8, dt)) { G.qte = { txt: 'CHUTAR A DINAMITE!', t: 3, max: 3 }; say('BANANA DE DINAMITE ACESA NA CAÇAMBA!', 'ai', 3); SFX.beep(); }
        if (G.qte) { G.qte.t -= dt; if (G.qte.ok) { G.qte = null; say('Dinamite devolvida!', 'sys', 2); const t = esc[0]; if (t) { damageEnt(t, 500, 5, { by: 'aoe' }); } else hitPart(b.parts[0], 400, 5, { by: 'aoe' }); SFX.boom(); } else if (G.qte.t <= 0) { G.qte = null; armorDmg(20, 'Dinamite explodiu na caçamba.'); gunnerDmg(45); fxBoom(G.W / 2, G.H * 0.8, 160); } }
        break; }
      case 'iluminado': {
        follow(40, 6, Math.sin(b.t * 0.35) * 3, 2, dt); const g = alive().length;
        const face = clamp(1 - Math.abs(b.x - P.x) / 9, 0.3, 1); G.blind = Math.max(G.blind, (g / 4) * (0.72 + 0.25 * Math.sin(b.t * 5)) * face * (G.role === 'pilot' ? 1 : 0.55));
        if (every(0, 1.1, dt) && g > 0) { armorDmg(1.5 * (g / 4 + 0.4)); gunnerDmg(4); SFX.gun('tiro', { dist: Math.max(8, Math.abs(b.rel)), pan: clamp((b.x - P.x) / 8, -0.8, 0.8) }); }
        if (every(1, 2.2, dt)) for (let i = 0; i < 2; i++) spawn('corredor', (Math.random() < 0.5 ? -1 : 1) * rnd(5, 9), P.z + rnd(60, 110));
        if (G.role === 'pilot' && every(2, 2.8, dt) && g > 1) { const bl = bestLane(); if (Math.abs(bl - P.x) > 1.4) say((G.ai[0] ? G.ai[0].cls.nome : 'Rádio') + ': "' + (bl < P.x ? 'VIRA PRA ESQUERDA AGORA!' : 'VIRA PRA DIREITA AGORA!') + '"', 'ai', 2); }
        break; }
      case 'leviata': {
        if (b.fase === 1) {
          follow(40, 6, Math.sin(b.t * 0.3) * 2.5, 1.5, dt);
          if (!b.parts[0].dead && every(0, 3.6, dt)) { spawn('buggy', b.x, P.z + b.rel - 3, { rel: b.rel - 3 }); if (Math.random() < 0.4) say('Buggy suicida saindo da rampa!', 'ai', 2); }
          if (every(1, 3, dt)) G.haz.push({ x: clamp(P.x + rnd(-2.5, 2.5), -6, 6), z: P.z + P.speed * 1.6 + 5, r: 2.4, kind: 'alvo', delay: 1.6, life: 3, t: 0, dmg: 14 });
          if (every(2, 1, dt)) { armorDmg(1.8); gunnerDmg(4); SFX.gun('fz762', { dist: Math.max(10, Math.abs(b.rel)), pan: clamp((b.x - P.x) / 8, -0.8, 0.8) }); }
        } else if (b.fase === 2) {
          follow(11, 8, -4.2, 2, dt);
          if (P.x < b.x + b.w / 2 + V.w + 0.2) { P.x = b.x + b.w / 2 + V.w + 0.2; armorDmg(6 * dt, 'Rasgado pelos espinhos do Leviatã.'); if (G.frame % 4 === 0) fxSpark(40, G.H * 0.6, 4); G.shake = Math.max(G.shake, 0.5); }
          if (every(0, 4.5, dt)) { const e = spawn('corredor', P.x - 2, P.z, {}); if (latch(e, -1)) say('BANDIDO PULOU DA PASSARELA! Motosserra nele!', 'ai', 2.5); else e.dead = true; }
          if (Math.abs(P.x - b.x) < 6 && every(1, 0.5, dt)) { armorDmg(1.6, 'Torrado pelos lança-chamas.'); G.smokeIn = Math.min(0.5, G.smokeIn + 0.1); }
          if (every(2, 1.2, dt)) { armorDmg(1.6); gunnerDmg(4); SFX.gun('smg9', { dist: 6, pan: -0.7 }); }
          if (every(3, 4, dt)) G.haz.push({ x: clamp(P.x + rnd(-1, 3), 0, 6.5), z: P.z + P.speed * 1.6 + 5, r: 2.2, kind: 'alvo', delay: 1.6, life: 3, t: 0, dmg: 14 });
        } else {
          const left = b.dist - P.z; G.portoLeft = left; if (b.ramp) b.ramp.z = b.dist;
          if (every(0, 0.25, dt)) for (let i = 0; i < 2; i++) spawn(pick(['andarilho', 'andarilho', 'corredor', 'encouracado']), rnd(-6.5, 6.5), P.z + rnd(250, 420));
          if (left < 300 && !b.said) { b.said = true; say('RAMPA À VISTA! 110 km/h, no centro da pista!', 'ai', 4); }
          if (left <= 4) {
            if (P.speed * 3.6 >= 105 && Math.abs(P.x) < 3.4) { G.phase = 'fim'; crack(); crack(); crack(); G.flash = 1; SFX.crash(); P.jump = 0.001; b.ph = 'salto'; say('SEGURA!!!', 'ai', 3); G.boss = b; b.fase = 4; }
            else { armorDmg(18, 'Errou a rampa do navio.'); say(P.speed * 3.6 < 105 ? 'DEVAGAR DEMAIS! Deu a volta no cais — de novo, mais rápido!' : 'DESALINHADO! Volta e alinha no centro!', 'sys', 4); b.dist = P.z + 650; b.said = false; P.speed *= 0.5; G.shake = 2; SFX.crash(); }
          }
        }
        if (b.fase === 4) { P.jump += dt; P.speed = Math.max(P.speed, 30); if (P.jump > 2.6) { G.mode = 'end'; unlockAch('mar'); META.zerou = true; S.stage = 10; saveAll(); SFX.music(null); SFX.engine(0, 0, false); SFX.saw(false, 0); UI.ending(); } }
        break; }
    }
  }

  function bestLane() { let best = 0, bc = 1e9; for (const lx of [-4.8, -2.4, 0, 2.4, 4.8]) { let c = 0; for (const e of G.ents) { if (e.dead || e.st === 'latch') continue; const dz = e.z - P.z; if (dz < 5 || dz > 90) continue; if (Math.abs(e.x - lx) < 1.8 && (e.type === 'boiadeiro' || e.type === 'carcaca' || e.type === 'colosso')) c += 10; } c += laneCost(lx); if (c < bc) { bc = c; best = lx; } } return best; }
  function laneCost(lx) {
    b = G.boss; if (!b) return 0; let c = 0;
    for (const h of G.haz) { const dz = h.z - P.z; if (dz > -2 && dz < 100 && Math.abs(h.x - lx) < h.r + 1.4) c += 28; }
    if (b.shoulder && Math.abs(lx) < 7.5) c += 80;
    if (b.ph === 'preso') c += (lx + 5) * 4;
    if (b.key === 'leviata' && b.fase === 2 && lx < 1) c += 50;
    if (b.key === 'leviata' && b.fase === 3) c += Math.abs(lx) * (G.portoLeft < 250 ? 6 : 0);
    if (b.key === 'reidograu' && b.ph === 'frente') c += Math.abs(lx - b.x) * 3;
    if ((b.key === 'tatuzao' || b.key === 'iluminado') && Math.abs(lx - b.x) < 2) c += 3;
    return c;
  }
  function aiSpeed() { b = G.boss; if (!b) return 30; if (b.key === 'ceifador') return 40; if (b.fase === 3 || b.fase === 4) return 60; return 30; }
  function pilotTarget(maxDz) {
    b = G.boss; if (!b || b.rel < 2 || b.rel > Math.min(maxDz, 200) || b.front && b.key === 'reidograu') return null;
    let best = null, bd = 1e9; for (const p of b.parts) { if (p.dead || !p.vuln) continue; const d = Math.abs(b.x + p.ox - P.x); if (d < p.w / 2 + (p.ads ? 0.3 : 0.7) && d < bd) { bd = d; best = p; } } return best;
  }
  function aiTarget() { b = G.boss; if (!b || Math.abs(b.rel) > 150) return null; const a = b.parts.filter(p => !p.dead && p.vuln); if (!a.length) { if (b.esc) { const e = b.esc.find(e => !e.dead); if (e) { damageEnt(e, 60 + cityLevel() * 30, 4, { by: 'ai' }); } } return null; } return a.find(p => p.id === 'cabo') || pick(a); }
  function aoe(x, z, r, dmg) { b = G.boss; if (!b || !b.parts.length) return; const dz = P.z + b.rel - z; if (Math.abs(dz) < r + 3 && Math.abs(b.x - x) < r + b.w / 2) for (const p of b.parts) if (!p.dead && p.vuln) hitPart(p, dmg * 0.5, 4, { by: 'aoe' }); }

  /* desenho em metros, pés no (0,0) */
  function draw(c, t, front) {
    b = G.boss; const w = b.w, h = b.h, cor = b.def.cor, k = b.key;
    const wheels = (wh, ww) => { R(c, -w / 2 - 0.05, -wh, ww, wh, '#0a0a0a'); R(c, w / 2 + 0.05 - ww, -wh, ww, wh, '#0a0a0a'); };
    if (k === 'ceifador') {
      R(c, -1.8, -h, 3.6, h - 0.6, cor); R(c, -1.4, -h + 0.3, 2.8, 1.2, '#1a2a2a'); R(c, -2.3, -1.6, 0.9, 1.6, '#0a0a0a'); R(c, 1.4, -1.6, 0.9, 1.6, '#0a0a0a');
      R(c, 2, -h - 1.2, 0.4, 2.4, '#3a3a3a'); c.fillStyle = `rgba(255,${120 + Math.sin(t * 30) * 60 | 0},20,0.9)`; c.beginPath(); c.arc(2.2, -h - 1.4, 0.5 + Math.sin(t * 25) * 0.15, 0, 7); c.fill();
      R(c, -w / 2, -1.7, w, 1.5, '#7a1a12'); c.fillStyle = '#d8d8d8'; for (let i = 0; i < 22; i++) { const x = -w / 2 + i * 0.5 + (t * 3 % 0.5); c.beginPath(); c.moveTo(x, -1.7 + ((i + (t * 12 | 0)) % 2) * 0.7); c.lineTo(x + 0.25, -0.2 - ((i + (t * 12 | 0)) % 2) * 0.7); c.lineTo(x + 0.4, -0.95); c.fill(); }
    } else if (k === 'reidograu') {
      R(c, -1.7, -1.7, 0.9, 1.7, '#0a0a0a'); R(c, 0.8, -1.7, 0.9, 1.7, '#0a0a0a'); R(c, -1.3, -h + 0.3, 2.6, 1.2, cor); R(c, -1.0, -h, 2.0, 0.8, cor); R(c, -0.85, -h + 0.08, 1.7, 0.5, '#111');
      R(c, -1.2, -h + 0.75, 0.4, 0.2, front ? '#ffd' : '#e22'); R(c, 0.8, -h + 0.75, 0.4, 0.2, front ? '#ffd' : '#e22'); c.fillStyle = Math.sin(t * 12) > 0 ? '#3f3' : '#f3f'; c.fillRect(-0.9, -h - 0.25, 1.8, 0.2);
    } else if (k === 'corisco') {
      wheels(0.6, 0.5); R(c, -w / 2, -1.7, w, 1.2, cor); R(c, -w / 2 + 0.2, -h, w - 0.4, 1.0, '#4a3a22'); R(c, -0.7, -h + 0.15, 1.4, 0.3, '#0a0a0a'); c.fillStyle = '#c9a030'; for (let i = 0; i < 6; i++) c.fillRect(-w / 2 + 0.2 + i * 0.4, -1.6, 0.08, 0.08);
      R(c, -0.25, -h - 0.5, 0.5, 0.5, '#5a3a1a'); R(c, -0.5, -h - 0.62, 1.0, 0.12, '#5a3a1a');
    } else if (k === 'leviata' && b.fase === 2) {
      R(c, -w / 2, -0.7, 0.5, 0.7, '#0a0a0a'); R(c, w / 2 - 0.5, -0.7, 0.5, 0.7, '#0a0a0a'); R(c, -w / 2, -h, w, h - 0.5, '#2a2420');
      c.fillStyle = '#888'; for (let y = 0.8; y < h; y += 0.5) { c.beginPath(); c.moveTo(w / 2, -y); c.lineTo(w / 2 + 0.5, -y - 0.12); c.lineTo(w / 2, -y - 0.24); c.fill(); }
      R(c, -1.2, -h - 0.5, 0.6, 0.5, '#333'); R(c, 0.6, -h - 0.5, 0.6, 0.5, '#333');
    } else {
      const tall = k === 'iluminado';
      wheels(0.75, 0.6); R(c, -w / 2, -h, w, h - 0.5, cor); R(c, -w / 2, -h, w, 0.18, '#111'); R(c, -w / 2, -0.75, w, 0.25, '#222');
      R(c, -w / 2 + 0.1, -0.7, 0.4, 0.2, '#e01818'); R(c, w / 2 - 0.5, -0.7, 0.4, 0.2, '#e01818');
      if (k === 'usineiro') { c.fillStyle = '#6a8a2a'; for (let i = 0; i < 9; i++) c.fillRect(-w / 2 + 0.15 + i * 0.35, -h + 0.3, 0.14, h - 1.4); c.fillStyle = `rgba(255,${130 + Math.sin(t * 22) * 60 | 0},20,0.85)`; c.beginPath(); c.moveTo(-w / 2, -h); c.lineTo(-0.8, -h - 1.4 - Math.sin(t * 15) * 0.4); c.lineTo(0, -h - 0.4); c.lineTo(0.9, -h - 1.6 - Math.cos(t * 13) * 0.4); c.lineTo(w / 2, -h); c.fill(); }
      if (k === 'guincho') { R(c, -0.2, -h - 1.2, 0.4, 1.4, '#c82'); R(c, -1.2, -h - 1.3, 2.4, 0.25, '#c82'); c.fillStyle = '#4a3f38'; c.fillRect(-w / 2 + 0.2, -h + 0.4, 0.9, 0.9); c.fillRect(0.4, -h + 0.8, 0.9, 0.6); }
      if (k === 'tatuzao') { R(c, -w / 2 - 0.2, -1.3, w + 0.4, 0.35, '#111'); R(c, -0.2, -h - 0.5, 0.4, 0.5, '#333'); R(c, -0.08, -h - 0.5, 1.4, 0.16, '#333'); c.fillStyle = '#fff'; c.save(); c.scale(0.02, 0.02); c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.fillText('CHOQUE', 0, -95); c.restore(); }
      if (k === 'derrubador') { c.strokeStyle = '#c98a1a'; c.lineWidth = 0.4; const a = Math.sin(t * 2) * 0.4; c.beginPath(); c.moveTo(0, -h + 0.6); c.lineTo(1.6 + a, -h - 2.4); c.lineTo(3 + a * 2, -h - 0.8 + a); c.stroke(); R(c, 2.6 + a * 2, -h - 0.9 + a, 0.9, 0.7, '#555'); R(c, -w / 2, -1.9, w, 0.3, '#333'); }
      if (k === 'carrasco') { R(c, -w / 2, -h + 0.9, w, 0.15, '#222'); R(c, -w / 2, -2.6, w, 0.15, '#222'); c.strokeStyle = '#111'; c.lineWidth = 0.08; for (let x = -w / 2 + 0.3; x < w / 2; x += 0.4) { c.beginPath(); c.moveTo(x, -2.5); c.lineTo(x, -0.9); c.stroke(); } }
      if (tall) { for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { const on = b.parts.some(p => !p.dead); c.fillStyle = on ? (Math.sin(t * 9 + x + y) > -0.5 ? '#fffbe0' : '#cfe0ff') : '#222'; c.beginPath(); c.arc(-w / 2 + 0.3 + x * 0.43, -2.0 - y * 0.5, 0.17, 0, 7); c.fill(); } R(c, -w / 2, -h - 0.3, w, 0.3, '#c2a'); }
      if (k === 'leviata') { c.fillStyle = '#999'; for (let x = -w / 2; x < w / 2; x += 0.4) { c.beginPath(); c.moveTo(x, -h); c.lineTo(x + 0.2, -h - 0.5); c.lineTo(x + 0.4, -h); c.fill(); } R(c, -w / 2 - 0.3, -2, 0.3, 0.3, '#444'); R(c, w / 2, -2, 0.3, 0.3, '#444'); }
    }
    // partes / pontos fracos
    const falc = G.abil.on > 0 && S.cls === 'falcao';
    for (const p of b.parts) {
      if (p.dead) { R(c, p.ox - p.w / 2, -p.oy - p.h, p.w, p.h, '#0a0a0a'); continue; }
      if (p.id === 'cabo' && !p.vuln) continue; if (b.key === 'reidograu' && front) continue;
      R(c, p.ox - p.w / 2, -p.oy - p.h, p.w, p.h, p.flash > 0 ? '#fff' : p.cor);
      if (p.vuln) { c.strokeStyle = falc || Math.sin(t * 8) > 0 ? '#ff2a2a' : '#ffd040'; c.lineWidth = 0.07; c.strokeRect(p.ox - p.w / 2, -p.oy - p.h, p.w, p.h); R(c, p.ox - p.w / 2, -p.oy - p.h - 0.2, p.w * (p.hp / p.max), 0.1, '#e22'); }
    }
  }
  return { start, update, hitPart, laneCost, aiSpeed, pilotTarget, aiTarget, aoe, draw, hpFrac, bestLane, get cur() { return b; } };
})();
