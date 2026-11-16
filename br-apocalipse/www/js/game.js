'use strict';
/* BR-APOCALIPSE — núcleo: estado, física do veículo, hordas, artilheiros e IA */
const SEG = 8, ROADW = 7;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = (a) => a[Math.random() * a.length | 0];

const G = { mode: 'menu', role: 'pilot', cam: 'fpp', t: 0, frame: 0, ents: [], fx: [], tracers: [], msgs: [], hits: [], boss: null, stats: {}, led: { L: 0, R: 0, H: 0 }, abil: { cd: 0, on: 0 }, ai: [], W: 960, H: 540 };
const P = {};   // veículo dos jogadores
const A = {};   // estado do artilheiro (jogador)
const I = { steer: 0, gas: 0, brake: 0, hand: 0, fire: 0, ads: 0, tilt: 0 };
let S = null;   // save da jornada
let META = { ach: {}, zerou: false, opts: { gyro: false, fpp: false, vol: 0.8 } };
let EID = 1;

/* ---------- persistência ---------- */
function loadMeta() { try { const m = JSON.parse(localStorage.getItem('brapoc_meta')); if (m) META = Object.assign(META, m); } catch (e) {} try { S = JSON.parse(localStorage.getItem('brapoc_save')); } catch (e) { S = null; } }
function saveAll() { try { localStorage.setItem('brapoc_meta', JSON.stringify(META)); if (S && !G.arena && !NET.client) localStorage.setItem('brapoc_save', JSON.stringify(S)); } catch (e) {} }
function newSave(cls, mode) {
  const s = { cls, mode: mode || 'normal', stage: 0, veh: 1, up: { frente: 0, serra: 0, lateral: 0, janela: 0, pneu: 0, turbo: 0, susp: 0, tanque: 0, blind: 0, capo: 0 }, sucata: 40, ammo: { leve: 18, cartucho: 0, fuzil: 0, pesada: 0 }, armorFrac: 1, melee: 'facao', tot: { kills: 0, t: 0 } };
  if (mode === 'furia' || mode === 'arena') { s.veh = 5; s.up = { frente: 4, serra: 2, lateral: 2, janela: 1, pneu: 2, turbo: 1, susp: 1, tanque: 1, blind: 1, capo: 6 }; s.ammo = { leve: 300, cartucho: 100, fuzil: 500, pesada: 400 }; s.sucata = 300; s.melee = 'serraInd'; }
  return s;
}
function cityLevel() { if (!S) return 0; if (S.mode === 'furia' || S.mode === 'arena') return 10; return S.stage + (S.stage === 9 && G.prog > 0.6 ? 1 : 0); }
function cls() { return CLASSES.find(c => c.id === S.cls); }
function vstats() {
  const v = VEHICLES[S.veh], u = S.up;
  return { v, w: v.w, mass: v.mass, armorMax: Math.round(v.armor * (u.blind ? 1.5 : 1) + u.lateral * 20 + u.frente * 15), vmax: v.vmax / 3.6 * (u.turbo ? 1.1 : 1), tank: u.tanque ? 1.5 : 1 };
}
function ammoMax(k) { return Math.round(AMMO[k].max * (k === 'pesada' ? 1.25 : 1)); }   // Cobra (sempre no grupo): +25% de munição pesada
function drv() { if (G.drvCls) return G.drvCls; return G.role === 'pilot' ? S.cls : (G.ai[0] ? G.ai[0].cls.id : S.cls); }   // classe de quem está no volante
function aiGunners() { return G.role === 'pilot' ? G.ai : G.ai.slice(1); }
function usableWeapons() { const c = cityLevel(); return Object.keys(WEAPONS).filter(k => WEAPONS[k].city <= c && (WEAPONS[k].minVeh || 1) <= S.veh).slice(-4); }
function usableMelee() { const c = cityLevel(); let m = Object.keys(MELEE).filter(k => MELEE[k].city <= c); if (m.includes('serraInd')) m = m.filter(k => k !== 'serra'); return m; }
function unlockAch(id) { NET.hostAch(id); if (META.ach[id]) return; META.ach[id] = 1; saveAll(); say('🏆 CONQUISTA: ' + CONQUISTAS[id].nome, 'sys', 6, true); SFX.buy(); }

/* ---------- mensagens / efeitos ---------- */
function say(txt, who, dur, local) { G.msgs.push({ txt, who: who || 'radio', t: dur || 3.5 }); if (G.msgs.length > 4) G.msgs.shift(); if (!local) NET.hostSay(txt, who || 'radio', dur || 3.5); }   // local = só neste celular
const callCd = {};
function callout(kind, led) { if ((callCd[kind] || 0) > G.t) return; callCd[kind] = G.t + 7; const n = G.ai.length ? pick(G.ai).cls.nome : 'Rádio'; say(n + ': "' + pick(CALLOUTS[kind]) + '"', 'ai'); if (led) G.led[led] = 2.5; SFX.beep(); }
function fxBlood(x, y, n, cor) { for (let i = 0; i < n; i++) G.fx.push({ x, y, vx: rnd(-160, 160), vy: rnd(-220, 60), g: 500, life: rnd(0.3, 0.7), cor: cor || '#8a0a0a', s: rnd(2, 6) }); }
function fxSpark(x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ x, y, vx: rnd(-200, 200), vy: rnd(-200, 100), g: 300, life: rnd(0.15, 0.4), cor: '#ffd060', s: 2 }); }
function fxBoom(x, y, size, silent) { G.fx.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, cor: 'boom', s: size }); for (let i = 0; i < 10; i++) G.fx.push({ x, y, vx: rnd(-260, 260), vy: rnd(-300, 40), g: 300, life: rnd(0.3, 0.8), cor: i % 2 ? '#ff8a1a' : '#333', s: rnd(3, 8) }); if (!silent) SFX.boom(); G.shake = Math.max(G.shake, Math.min(1.5, size / 80)); }
function tracer(x1, y1, x2, y2, cor) { G.tracers.push({ x1, y1, x2, y2, life: 0.07, cor: cor || '#ffe9a0' }); }
function splat(n, cor) { for (let i = 0; i < n; i++) P.splats.push({ x: Math.random(), y: Math.random() * 0.8, r: rnd(0.03, 0.09), cor: cor || '#7a0808' }); if (P.splats.length > 40) P.splats.splice(0, P.splats.length - 40); P.blood = clamp(P.blood + n * 0.05, 0, 1); }
function crack() { if (P.cracks.length < 9) P.cracks.push({ x: rnd(0.15, 0.85), y: rnd(0.1, 0.7), r: rnd(0.05, 0.12), a: Math.random() * 6 }); SFX.glass(); }

function armorDmg(n, why) {
  if (G.phase === 'fim') return;
  n *= (S.up.blind ? 0.75 : 1); P.armor -= n; G.hurt = Math.min(1, (G.hurt || 0) + n * 0.03);
  if (P.armor <= 0) { P.armor = 0; gameOver(why || 'O veículo foi destruído.'); }
}
function gunnerDmg(n) {
  if (!G.netClient) NET.hostGunnerDmg(n);   // os Artilheiros remotos recebem o mesmo dano e aplicam se estiverem expostos
  if (G.role !== 'gunner' || !A.exposed || A.down > 0) return;
  if (S.up.janela >= 2) n *= 0.2;
  A.hp -= n; G.hurt = Math.min(1, (G.hurt || 0) + 0.3);
  if (A.hp <= 0) { A.hp = 0; A.down = 5; A.exposed = false; say('Você foi atingido! Recolhendo para dentro do carro...', 'sys', 3.5, true); }
}

/* ---------- início de jornada / trecho ---------- */
function startRun(clsId, mode) {
  G.arena = mode === 'arena';
  S = newSave(clsId, mode); if (!G.arena) saveAll();
}
function startStage() {
  const st = G.arena ? ARENA : STAGES[S.stage];
  G.st = st; G.V = vstats(); G.mode = 'play'; G.phase = 'road'; G.t = 0; G.prog = 0; G.boss = null; G.ents = []; G.fx = []; G.tracers = []; G.msgs = []; G.hits = [];
  G.spawnZ = 80; G.bandT = 28; G.shake = 0; G.hurt = 0; G.flash = 0; G.smokeIn = 0; G.gas = 0; G.blind = 0; G.wave = G.wave || 1; G.waveT = 45; G.saqueT = 0; G.event = null; G.eventsLeft = G.arena ? [] : planEvents(st); G.qte = null;
  G.haz = []; G.eventBar = 0; G.portoLeft = 0; G.pedDone = false; G.c30 = false; P.noFuel = false; G.aiHint = null;
  G.night = !!st.noite || S.mode === 'expresso'; G.clima = 'limpo'; G.pedOk = false; G.offroadBoss = false; G.abil = { cd: 0, on: 0 }; G.turboT = 0; G.drvCls = null; G.snapInit = false; G.hostPaused = false; if (NET.host) NET.resetPeerStats(); G.skyX = 0; G.banner = null;
  G.stats = { kills: 0, gk: 0, abalro: 0, acid: 0, over: 0, shots: 0, hitsN: 0, heads: 0, amput: 0, vex: 0, salva: 0, sucata: 0, t: 0, bossSrc: {} };
  if (S.mode === 'expresso' || META.opts.fpp) G.cam = 'fpp';
  Object.assign(P, { x: 0, z: 0, speed: 0, steer: 0, rpm: 0.1, gear: 1, temp: 0.4, over: false, clog: 0, fuel: 1, armor: Math.max(G.V.armorMax * 0.15, G.V.armorMax * S.armorFrac), saws: false, lights: G.night ? 1 : 0, wipe: 0, blood: 0, acid: 0, oil: 0, rain: 0, splats: [], cracks: [], tires: 0, gheat: 0, glock: false, gcd: 0, gfire: 0, pull: 0, mirrorL: true, slideT: 0, brakeT: 0, lat: 0, jump: 0 });
  Object.assign(A, { ax: G.W / 2, ay: G.H * 0.45, ads: 0, exposed: true, seat: 0, look: 1, mag: {}, reloadT: 0, cd: 0, useMelee: false, swing: 0, swingT: 0, heat: 0, hlock: false, hp: 100, down: 0, kick: 0, flash: 0, pump: 0, rev: 0 });
  const uw = usableWeapons(); A.w = uw[uw.length - 1]; if (G.role === 'gunner') uw.forEach(fillMag);   // o Piloto não segura balas no pente
  if (!usableMelee().includes(S.melee)) S.melee = usableMelee().slice(-1)[0];
  G.ai = CLASSES.filter(c => c.id !== S.cls && !(G.humanCls || []).includes(c.id)).map((c, i) => ({ cls: c, cd: 1 + i * 0.6, kills: 0, heads: 0, salva: 0, ab: 15 + i * 9, buff: 0 }));
  SFX.music(st.musica); G.radio = 0;
  G.banner = { t: 5, a: st.origem + '  →  ' + st.cidade + (st.uf ? ' (' + st.uf + ')' : ''), b: st.estrada };
  say(st.intro, 'radio', 7);
  if (G.arena) { G.phase = 'arena'; say('ONDA ' + G.wave + ' — segurem o posto!', 'sys', 4); }
}
function fillMag(k) { const w = WEAPONS[k], need = w.mag - (A.mag[k] || 0), got = Math.max(0, Math.min(need, S.ammo[w.ammo])); A.mag[k] = (A.mag[k] || 0) + got; S.ammo[w.ammo] -= got; if (got && NET.client) NET.send({ t: 'ammo', k: w.ammo, n: got }); }
function planEvents(st) {
  const idx = STAGES.indexOf(st), pool = ['resgate', 'boiada', 'emboscada']; if (idx >= 2) pool.push('comboio');
  const ev = []; const n = 2; const used = {};
  for (let i = 0; i < n; i++) { let k = pick(pool); if (used[k]) k = pool.find(p => !used[p]) || k; used[k] = 1; ev.push({ k, at: 0.2 + i * 0.3 + Math.random() * 0.12 }); }
  return ev;
}
function gameOver(why) { if (G.mode !== 'play') return; G.mode = 'over'; SFX.crash(); SFX.music(null); SFX.engine(0, 0, false); SFX.saw(false, 0); UI.over(why); }

/* ---------- entidades ---------- */
function spawn(type, x, z, o) { const d = ENEMY[type]; const e = Object.assign({ id: EID++, type, x, z, hp: d.hp * (S.mode === 'furia' && !d.estatico ? 1.3 : 1), st: 'idle', t: 0, side: 0, vf: -1 }, o || {}); G.ents.push(e); return e; }
function weightOf(v) { return Array.isArray(v) ? (G.prog >= v[0] ? v[1] : 0) : v; }
function spawnAhead() {
  const st = G.st, dens = st.dens * (S.mode === 'furia' ? 3 : 1) * (G.arena ? 1 + G.wave * 0.2 : 1) * ((st.megahorda && G.prog > st.megahorda) || (st.mar && G.prog > st.mar) ? 3 : 1);
  while (G.spawnZ < P.z + 460 && G.ents.length < 170) {
    const z = G.spawnZ; G.spawnZ += rnd(16, 40) / dens;
    if (G.phase === 'boss' && !(G.boss && G.boss.hordas)) continue;
    let tot = 0; for (const k in st.spawn) tot += weightOf(st.spawn[k]); let r = Math.random() * tot, type = 'andarilho';
    for (const k in st.spawn) { r -= weightOf(st.spawn[k]); if (r <= 0) { type = k; break; } }
    const onBridge = isBridge(z);
    if (Math.random() < 0.05 && !onBridge) { const wx = pick([-4.5, -1.5, 1.5, 4.5]); spawn('carcaca', wx, z, { cor: pick(['#4a3f38', '#6a2a1a', '#3a4a5a', '#7a7a70']) }); if (Math.random() < 0.6) spawn('carrapato', wx + rnd(-1, 1), z + 2.5, { hide: true }); continue; }
    if (type === 'andarilho') { const n = 1 + (Math.random() * 3.5 | 0), cx = rnd(-5.5, 5.5); for (let i = 0; i < n; i++) spawn('andarilho', clamp(cx + rnd(-1.6, 1.6), -6.3, 6.3), z + rnd(0, 6)); }
    else if (type === 'corredor' || type === 'engolidor') spawn(type, (Math.random() < 0.5 ? -1 : 1) * rnd(5, onBridge ? 6 : 10), z);
    else if (type === 'carrapato') spawn('carrapato', rnd(-5, 5), z, { hide: false });
    else if (type === 'colosso') { if (!G.ents.some(e => e.type === 'colosso' && e.z > P.z)) spawn('colosso', rnd(-3.5, 3.5), z); }
    else spawn(type, rnd(-5.8, 5.8), z);
  }
}
function isBridge(z) { const st = G.st; if (!st.ponte) return false; const p = z / st.len; return p > st.ponte[0]; }
function latchCount(side) { let n = 0; for (const e of G.ents) if (e.st === 'latch' && e.side === side) n++; return n; }
function latch(e, side) { if (latchCount(side) >= (side === 0 ? 1 : 2)) return false; e.st = 'latch'; e.side = side; e.t = 0; if (side === 0) callout('hood', 'H'); else callout(side < 0 ? 'latchL' : 'latchR', side < 0 ? 'L' : 'R'); return true; }

function damageEnt(e, dmg, pen, src) {
  if (e.dead) return 0; const d = ENEMY[e.type]; src = src || {};
  if (d.estatico) return 0;
  if (e.script) G.stats.bossSrc[src.wid || src.by || 'x'] = 1;
  if (d.armor && pen < d.armor && !src.head && !src.saw) { dmg *= 0.12; if (src.by === 'player' && !src.peer) SFX.ric(); }
  if (src.head) dmg *= 3;
  e.hp -= dmg; e.flash = 0.08;
  if (e.hp <= 0) killEnt(e, src);
  return dmg;
}
function killEnt(e, src) {
  if (e.dead) return; e.dead = true; src = src || {}; const d = ENEMY[e.type]; e.killed = src.by || 'x'; e.kHead = !!src.head;   // para o cadáver 3D
  const vis = e.vf >= G.frame - 1, sx = e.sx || G.W / 2, sy = (e.sy || G.H / 2) - (e.sh || 0) * 0.5;
  if (e.st === 'latch' && src.by === 'player') { if (src.peer) NET.peerStat(src.peer, 'salva'); else G.stats.salva++; }
  if (e.st === 'latch' && src.ai) src.ai.salva++;
  if (d.veh) {
    if (vis) fxBoom(sx, sy, (e.sh || 40) * 1.2); else SFX.boom();
    addScrap(e.type === 'moto' ? 10 : e.type === 'pickup' ? 30 : e.type === 'blindado' ? 60 : 8);
    if (src.by === 'player') { if (src.peer) NET.peerStat(src.peer, 'vex'); else G.stats.vex++; } if (src.by === 'car') G.stats.abalro++;
    if ((e.type === 'buggy' || e.type === 'carrobomba') && Math.abs(e.z - P.z) < 9 && Math.abs(e.x - P.x) < 4) { armorDmg(e.type === 'buggy' ? 22 : 30, 'Carro-bomba.'); G.shake = 1.5; }
    if (e.type === 'carrobomba' || e.type === 'buggy') aoe(e.x, e.z, 9, 400, e);
  } else {
    if (vis) fxBlood(sx, sy, e.type === 'colosso' ? 30 : 8, e.type === 'boiadeiro' ? '#9ad13a' : null);
    if (e.type === 'boiadeiro') { if (vis) fxBoom(sx, sy, (e.sh || 30)); aoe(e.x, e.z, 6, 160, e); }
    addScrap(e.type === 'colosso' ? 60 : e.type === 'encouracado' ? 3 : 0.7);
    if (src.by === 'player' && !src.peer) { G.stats.gk++; if (src.head) G.stats.heads++; if (src.melee) G.stats.amput++; }
    if (src.peer) { NET.peerStat(src.peer, 'kills'); if (src.head) NET.peerStat(src.peer, 'heads'); if (src.melee) NET.peerStat(src.peer, 'amput'); }
    if (src.ai) src.ai.kills++;
  }
}
/* Porrete: empurrão forte (solta zumbi da porta, derruba motoqueiro) */
function knock(e, src) { if (!e || e.dead) return; src = src || {}; if (e.st === 'latch') { e.st = 'idle'; e.passed = true; e.z = P.z - 5; if (src.peer) NET.peerStat(src.peer, 'salva'); else G.stats.salva++; } else if (e.type === 'moto') { e.hp -= 60; if (e.hp <= 0) killEnt(e, src); else { e.ph = 'recua'; e.t = 0; } } }
function aoe(x, z, r, dmg, skip) { for (const o of G.ents) { if (o === skip || o.dead) continue; const dz = o.z - z, dx = o.x - x; if (dz * dz + dx * dx < r * r) damageEnt(o, dmg, 3, { by: 'aoe' }); } if (G.boss) BOSS.aoe(x, z, r, dmg); }
function addScrap(n) { S.sucata += n; G.stats.sucata += n; }

function hitByCar(e) {
  const d = ENEMY[e.type], V = G.V, u = S.up, turbo = G.turboT > 0, sx = G.W / 2 + (e.x - P.x) * 40, sy = G.H * 0.6;
  if (e.type === 'carcaca') { P.speed *= 0.3; armorDmg(Math.max(4, 16 - u.frente * 3), 'Bateu numa carcaça.'); G.shake = 1.6; SFX.crash(); crack(); e.dead = true; fxSpark(sx, sy, 20); return; }
  if (e.type === 'pregos') { e.dead = true; if (u.pneu < 1) { P.tires = Math.min(4, P.tires + 2); say('PNEUS FURADOS no tapete de pregos!', 'sys'); SFX.pssh(); } armorDmg(4); return; }
  if (e.type === 'sobrevivente' || e.type === 'bau') return;
  if (d.veh) {
    const rel = Math.abs(P.speed - (e.vz || P.speed)) + 6; let dm = 60 * V.mass * (1 + u.frente * 0.3) * (turbo ? 2 : 1) * (P.saws ? 2 : 1) + (P.saws && u.serra ? 120 * u.serra : 0);
    if (e.type === 'buggy' || e.type === 'carrobomba') { killEnt(e, { by: 'crash' }); return; }
    damageEnt(e, dm, 5, { by: 'car' }); armorDmg(Math.max(1, 6 - u.frente * 1.2) * (e.type === 'moto' ? 0.4 : 1)); P.speed *= 0.9; G.shake = 1; SFX.crash(); fxSpark(sx, sy, 12); e.rel = (e.rel || 0) + 6; return;
  }
  if (e.type === 'colosso') {
    const can = S.veh >= 4 || u.frente >= 3;
    if (can) { damageEnt(e, 900 * (turbo ? 2 : 1), 5, { by: 'car' }); P.speed *= 0.6; armorDmg(6); e.x += (e.x < P.x ? -1 : 1) * 4; e.z = P.z - 2; e.passed = true; }
    else { P.speed = 0; armorDmg(18, 'Bateu de frente num Colosso.'); e.x += (e.x < P.x ? -1 : 1) * 4.5; e.z = P.z - 2; e.passed = true; say('O Colosso PAROU o carro! Precisa de Furgão Nível 4 ou Limpa-Trilhos.', 'sys', 5); crack(); }
    G.shake = 2; SFX.crash(); return;
  }
  if (e.type === 'boi') { if (u.frente >= 3) { killEnt(e, { by: 'car' }); P.speed *= 0.95; } else { armorDmg(10, 'A boiada amassou a frente.'); P.speed *= 0.55; killEnt(e, { by: 'car' }); G.shake = 1.5; SFX.crash(); } splat(2); return; }
  // zumbis
  if (P.speed < 6) { if (e.type !== 'boiadeiro') { if (!latch(e, e.x < P.x ? -1 : 1)) e.z = P.z + 3; } return; }
  let slow = (0.035 / Math.sqrt(V.mass)) * (1 - u.frente * 0.18) * (drv() === 'trovao' ? 0.75 : 1) * (e.type === 'encouracado' ? 2 : 1);
  P.speed *= 1 - clamp(slow, 0.004, 0.2);
  const sawOn = P.saws && u.serra > 0;
  if (!sawOn) P.clog = Math.min(0.6, P.clog + 0.03); if (u.frente < 1) armorDmg(0.25);
  if (e.type === 'boiadeiro') { P.acid = 1; armorDmg(12, 'Ácido corroeu o motor.'); P.temp += 0.15; G.stats.acid++; say('ÁCIDO NO PARA-BRISA! O limpador leva 10s pra limpar.', 'sys'); splat(4, '#7ac020'); SFX.splat(); }
  if (e.type === 'cangaceiro' && u.pneu < 1 && P.tires < 4) { P.tires++; say('Pneu furado pelos espinhos!', 'sys'); SFX.pssh(); }
  if (e.type === 'engolidor') { P.temp += 0.04; }
  splat(sawOn ? 2 : 1); SFX.hit(); if (sawOn) fxBlood(sx, sy, 10); G.shake = Math.max(G.shake, 0.35);
  G.stats.kills++; killEnt(e, { by: 'car' });
}

function updateEnts(dt) {
  const V = G.V, u = S.up, slowCar = P.speed < 5;
  for (const e of G.ents) {
    if (e.dead) continue; e.t += dt; if (e.flash > 0) e.flash -= dt;
    const d = ENEMY[e.type], dz = e.z - P.z, dx = e.x - P.x;
    if (e.st === 'latch') { updateLatched(e, dt); continue; }
    if (d.veh) { updateVeh(e, dt); continue; }
    if (d.estatico) { if (dz < 2.5 && dz > -1.5 && Math.abs(dx) < V.w + d.w / 2 && Math.abs(P.speed) > 2 && e.type !== 'sobrevivente' && e.type !== 'bau' && e.type !== 'rampa') hitByCar(e); if (dz < -50) e.dead = true; continue; }
    if (e.type === 'boi') { e.z -= 11 * dt; }
    else if (e.st === 'jump') { e.z = P.z + 2; e.x = P.x; if (e.t > 0.35) { if (!latch(e, 0)) e.dead = true; } continue; }
    else if (dz > 0 && dz < 70) {
      let sp = e.type === 'corredor' || e.type === 'engolidor' ? 4.5 : e.type === 'cangaceiro' ? (dz < 24 ? 7 : 2) : e.type === 'colosso' ? 2 : e.type === 'boiadeiro' ? 0.1 : 0.6;
      if (e.type === 'carrapato') { if (dz < 26 && Math.abs(dx) < 4.5 && P.speed > 6 && !e.jumped) { e.jumped = true; if (latchCount(0) < 1) { e.st = 'jump'; e.t = 0; continue; } } sp = 1; }
      e.x += clamp(-dx, -1, 1) * sp * dt;
      if (slowCar || G.phase === 'saque') e.z -= (e.type === 'corredor' || e.type === 'engolidor' ? 6 : e.type === 'colosso' ? 4 : 1.4) * dt;
    } else if (dz <= 0 && dz > -40 && (slowCar || P.speed < 14)) {
      const sp = e.type === 'corredor' || e.type === 'engolidor' ? 15 : e.type === 'colosso' ? 13 : 2; e.z += sp * dt; e.x += clamp(-dx, -1, 1) * 3 * dt;
      if (e.z > P.z - 1.5 && Math.abs(dx) < V.w + 1.2 && e.type !== 'boiadeiro') { if (!latch(e, dx < 0 ? -1 : 1)) e.z = P.z - 3; }
    }
    // colisão frontal
    if (dz < 2.4 && dz > -1 && Math.abs(dx) < V.w + d.w / 2) { hitByCar(e); continue; }
    // passou raspando: tenta agarrar na porta
    if (dz < 0 && !e.passed) {
      e.passed = true;
      if (Math.abs(dx) < V.w + 1.7 && (e.type === 'corredor' || e.type === 'engolidor' || (e.type === 'andarilho' && Math.random() < 0.15) || e.type === 'colosso')) {
        const pr = clamp(0.8 - P.speed / 50, 0.14, 0.9) * (u.janela >= 1 ? 0.7 : 1);
        if (Math.random() < pr) latch(e, dx < 0 ? -1 : 1);
      }
    }
    if (dz < -60) e.dead = true;
  }
  if (G.ents.length > 60 || G.frame % 30 === 0) G.ents = G.ents.filter(e => !e.dead);
}
function updateLatched(e, dt) {
  const u = S.up; e.z = P.z + (e.side === 0 ? 2 : 0); e.x = P.x + e.side * (G.V.w + 0.3);
  if (e.side !== 0) {
    if (u.lateral >= 2 && P.saws) { if (e.t > 0.3) { G.stats.kills++; fxBlood(e.side < 0 ? 40 : G.W - 40, G.H * 0.6, 14); SFX.splat(); killEnt(e, { by: 'car' }); return; } }
    armorDmg((e.type === 'colosso' ? 6 : u.lateral >= 1 ? 0.5 : 1.0) * dt, 'Arrancaram as portas.');
    if (e.type === 'engolidor') { G.smokeIn = Math.min(1, G.smokeIn + dt * 0.6); armorDmg(2 * dt); gunnerDmg(5 * dt); }
    if (e.type === 'cangaceiro' && G.role === 'gunner' && A.exposed && ((A.seat === 0 && e.side < 0) || (A.seat === 1 && e.side > 0))) gunnerDmg(8 * dt);
    if (P.slideT > 0.25 && Math.random() < dt * 2.5) { e.st = 'idle'; e.passed = true; e.z = P.z - 4; say('Zumbi arremessado no cavalo de pau!', 'sys', 2); }
  } else {
    if (e.type === 'engolidor') { G.smokeIn = Math.min(1, G.smokeIn + dt * 0.5); armorDmg(2.5 * dt); }
    e.bt = (e.bt || 0) + dt; if (e.bt > 2.2) { e.bt = 0; if (u.janela >= 1) armorDmg(1); else { crack(); armorDmg(3, 'O Carrapato quebrou o para-brisa.'); } G.shake = 0.8; }
    if (P.brakeT > (P.saws && u.serra ? 0.35 : 0.9) && P.speed > 3) {
      if (P.saws && u.serra) { splat(4); fxBlood(G.W / 2, G.H * 0.6, 20); SFX.splat(); G.stats.kills++; killEnt(e, { by: 'car' }); say('O Carrapato escorregou direto nas motosserras!', 'sys', 2.5); }
      else { e.st = 'idle'; e.passed = true; e.z = P.z + 4; e.jumped = true; hitByCar(e); }
    }
  }
}
function updateVeh(e, dt) {
  const V = G.V; e.ph = e.ph || 'chega'; if (e.rel === undefined) e.rel = e.z - P.z;
  const tgt = (rel, sp) => { e.rel += clamp(rel - e.rel, -sp * dt, sp * dt); };
  const lane = (x, sp) => { e.x += clamp(x - e.x, -sp * dt, sp * dt); };
  const lim = isBridge(P.z) ? ROADW - 1 : ROADW + 2;
  if (e.type === 'moto') {
    if (!e.side) e.side = Math.random() < 0.5 ? -1 : 1;
    if (e.ph === 'chega') { tgt(-0.5, 14); lane(P.x + e.side * (V.w + 2.6), 5); if (e.rel > -8) callout('moto', e.side < 0 ? 'L' : 'R'); if (e.rel > -1.5) { e.ph = 'ataca'; e.t = 0; } }
    else if (e.ph === 'ataca') {
      tgt(-0.5, 10); lane(P.x + e.side * (V.w + 1.15), 3.2); e.at = (e.at || 0) + dt;
      if (e.at > 0.9 && Math.abs(e.x - P.x) < V.w + 1.6) { e.at = 0; armorDmg(S.up.lateral >= 1 ? 0.8 : 1.4); gunnerDmg(6); fxSpark(e.side < 0 ? 30 : G.W - 30, G.H * 0.62, 5); SFX.ric(); }
      if (S.up.lateral >= 2 && P.saws && Math.abs(e.x - P.x) < V.w + 1.3) { killEnt(e, { by: 'car' }); return; }
      if (e.t > 10) { e.ph = 'recua'; e.t = 0; }
    } else { tgt(-35, 9); lane(P.x + e.side * 4, 3); if (e.t > 5) { e.ph = 'chega'; e.side = -e.side; } }
    if (P.speed > 44 && e.ph !== 'recua') { e.ph = 'recua'; e.t = 3; }
  } else if (e.type === 'pickup' || e.type === 'blindado') {
    if (!e.side) e.side = Math.random() < 0.5 ? -1 : 1;
    if (e.ph === 'chega') { tgt(-16, 12); lane(clamp(P.x + e.side * 2, -5, 5), 3); if (e.rel > -30) callout('pickup'); if (e.t > 9) { e.ph = 'lado'; e.t = 0; } }
    else if (e.ph === 'lado') { tgt(0, 8); lane(P.x + e.side * (V.w + ENEMY[e.type].w / 2 + (e.t > 2 && e.t % 3 < 1 ? -0.2 : 1.2)), 3.5); if (e.t > 8) { e.ph = 'frente'; e.t = 0; } }
    else if (e.ph === 'frente') { tgt(22, 9); lane(P.x * 0.6, 2); if (e.t > 9) { e.ph = 'chega'; e.t = 0; e.side = -e.side; } }
    e.at = (e.at || 0) + dt;
    if (e.at > 0.6 && Math.abs(e.rel) < 40) { e.at = 0; const dm = (e.type === 'blindado' ? 1.8 : 0.9) * (S.up.janela >= 2 ? 0.5 : 1); armorDmg(dm); gunnerDmg(4); if (Math.random() < 0.3) SFX.ric(); else SFX.shotFar(); if (Math.random() < 0.04 && P.mirrorL && e.side < 0) { P.mirrorL = false; say('Tiro quebrou o retrovisor esquerdo! Ponto cego até a próxima cidade.', 'sys', 4); SFX.glass(); } if (Math.random() < 0.05) crack(); }
  } else if (e.type === 'buggy' || e.type === 'carrobomba') {
    e.rel -= (e.type === 'buggy' ? 34 : 22) * dt; if (e.type === 'buggy') lane(P.x, 3.5);
    if (e.rel < -30) { e.dead = true; return; }
  }
  e.x = clamp(e.x, -lim, lim); e.z = P.z + e.rel; e.vz = P.speed;
  // contato / abalroamento
  const dx = e.x - P.x, ww = V.w + ENEMY[e.type].w / 2;
  if (Math.abs(e.rel) < 3.2 && Math.abs(dx) < ww) {
    if (e.type === 'buggy' || e.type === 'carrobomba') { killEnt(e, { by: 'crash' }); return; }
    if (e.rel > 1.5) { hitByCar(e); }
    else { const push = P.lat * Math.sign(dx) > 1.2; if (push || e.type !== 'moto') { const dm = (push ? 70 : 15) * V.mass * (G.turboT > 0 ? 2 : 1); damageEnt(e, dm, 5, { by: 'car' }); if (!push) armorDmg(5); G.shake = 0.9; SFX.crash(); fxSpark(dx < 0 ? 40 : G.W - 40, G.H * 0.6, 10); e.x += Math.sign(dx) * 1.6; if (!push) P.x -= Math.sign(dx) * 0.5; } }
  }
}
function spawnBandit() {
  const idx = G.arena ? 5 : S.stage, furia = S.mode === 'furia';
  let type = idx >= 1 && Math.random() < 0.35 ? 'pickup' : 'moto'; if ((furia || G.arena && G.wave > 3) && Math.random() < 0.35) type = 'blindado';
  if (G.ents.filter(e => ENEMY[e.type].veh && !e.dead).length >= (furia ? 5 : 3)) return;
  spawn(type, rnd(-4, 4), P.z - 60, { rel: -60, cor: pick(['#5a2a1a', '#2a2a2a', '#4a4a2a', '#3a1a3a']) });
}

/* ---------- eventos de estrada ---------- */
function updateEvents(dt) {
  if (G.phase !== 'road') return;
  if (!G.event && G.eventsLeft.length && G.prog >= G.eventsLeft[0].at) {
    const ev = G.eventsLeft.shift(), z = P.z + 420; G.event = { k: ev.k, z, t: 0, done: false };
    if (ev.k === 'resgate') { G.event.e = spawn('sobrevivente', -(ROADW + 2.5), z); say('RÁDIO: "SOCORRO! Tô no teto do ponto de ônibus, sinalizador vermelho! Encostem 8 segundos!"', 'radio', 7); for (let i = 0; i < 10; i++) spawn(pick(['andarilho', 'corredor']), rnd(-7, -2), z + rnd(-14, 14)); }
    else if (ev.k === 'boiada') { say('RÁDIO: "Carreta de gado tombada! BOIADA INFECTADA na contramão!"', 'radio', 6); for (let i = 0; i < 9; i++) spawn('boi', rnd(-6, 6), z + 200 + i * rnd(14, 26)); G.event.done = true; }
    else if (ev.k === 'emboscada') { say('RÁDIO: "...alguém ajuda... capotei aqui na pista..." (cheiro de emboscada)', 'radio', 6); spawn('carcaca', 2.5, z, { cor: '#7a1a1a' }); }
    else if (ev.k === 'comboio') { G.event.e = spawn('bau', ROADW + 4, z); say('RÁDIO: "Comboio militar tombado adiante. Baú trancado — parem 6s para saquear munição rara."', 'radio', 7); for (let i = 0; i < 8; i++) spawn('encouracado', rnd(-5, 7), z + rnd(-18, 18)); spawn('colosso', 0, z + 10); }
  }
  const ev = G.event; if (!ev) return; const dz = ev.z - P.z;
  if (ev.k === 'emboscada' && !ev.done && dz < 70) { ev.done = true; spawn('pregos', 0, P.z + 55, {}); say('TAPETE DE PREGOS! Joga pro acostamento de terra!', 'ai', 4); SFX.horn(); spawn('pickup', -3, P.z - 40, { rel: -40 }); spawn('pickup', 3, P.z - 55, { rel: -55 }); }
  if ((ev.k === 'resgate' || ev.k === 'comboio') && !ev.done && Math.abs(dz) < 26) {
    if (Math.abs(P.speed) < 3) { ev.t += dt; const need = ev.k === 'resgate' ? 8 : 6; G.eventBar = ev.t / need;
      if (Math.random() < dt * 1.6) spawn(pick(['andarilho', 'corredor']), rnd(-7, 7), P.z + (Math.random() < 0.5 ? rnd(20, 45) : rnd(-30, -12)));
      if (ev.t >= need) { ev.done = true; G.eventBar = 0; ev.e.dead = true; SFX.buy();
        if (ev.k === 'resgate') { const b = pick(['mun', 'rep', 'suc']); if (b === 'mun') { for (const k in S.ammo) S.ammo[k] = Math.min(ammoMax(k), Math.round(S.ammo[k] * 1.5 + (WEAPONS[A.w].ammo === k ? 20 : 0))); say('Resgatado um ARMEIRO: +50% de munição!', 'sys', 5); } else if (b === 'rep') { P.armor = Math.min(G.V.armorMax, P.armor + G.V.armorMax * 0.35); P.temp = 0.4; P.tires = 0; say('Resgatada uma ENGENHEIRA: reparo gratuito de motor e lataria!', 'sys', 5); } else { addScrap(150); P.fuel = 1; say('Resgatado um MÉDICO: +150 de sucata e tanque cheio!', 'sys', 5); A.hp = 100; } }
        else { S.ammo.pesada = Math.min(ammoMax('pesada'), S.ammo.pesada + 70); S.ammo.fuzil = Math.min(ammoMax('fuzil'), S.ammo.fuzil + 150); addScrap(120); say('BAÚ ABERTO: granadas 40mm, fitas de .50 e fuzil!', 'sys', 5); }
      } } else G.eventBar = 0;
  }
  if (dz < -80) { G.event = null; G.eventBar = 0; }
}

/* ---------- física do veículo ---------- */
function aiPilot() {
  const c = { steer: 0, gas: 1, brake: 0, hand: 0, fire: 0 }; const V = G.V;
  const lanes = [-4.8, -2.4, 0, 2.4, 4.8]; if (G.boss && G.boss.shoulder) lanes.push(-8.8, 8.8); let best = 0, bc = 1e9;
  for (const lx of lanes) {
    let cost = Math.abs(lx - P.x) * 0.25 + Math.abs(lx) * 0.05;
    for (const e of G.ents) { if (e.dead || e.st === 'latch') continue; const dz = e.z - P.z; if (dz < 0 || dz > 110) continue; const dx = Math.abs(e.x - lx), w = V.w + ENEMY[e.type].w / 2 + 0.5; if (dx > w) continue; const near = 1 + (110 - dz) / 40;
      if (e.type === 'boiadeiro' || e.type === 'carcaca' || e.type === 'pregos' || e.type === 'boi' || e.type === 'carrobomba' || e.type === 'buggy') cost += 30 * near; else if (e.type === 'colosso') cost += (S.veh >= 4 || S.up.frente >= 3 ? 4 : 40) * near; else if (e.type === 'cangaceiro' && S.up.pneu < 1) cost += 8 * near; else if (!ENEMY[e.type].veh) cost -= 0.4; }
    if (G.boss) cost += BOSS.laneCost(lx);
    if (G.aiHint && G.aiHint.t > G.t) cost -= (G.aiHint.dir * lx > 0 ? 6 : 0);
    if (cost < bc) { bc = cost; best = lx; }
  }
  c.steer = clamp((best - P.x) * 0.8, -1, 1);
  const want = G.phase === 'saque' ? 5 : G.boss ? BOSS.aiSpeed() : (G.event && !G.event.done && (G.event.k === 'resgate' || G.event.k === 'comboio') && Math.abs(G.event.z - P.z) < 30 ? 0 : 30);
  if (P.speed > want + 2) { c.gas = 0; c.brake = P.speed > want + 8 ? 1 : 0; } if (P.over) c.gas = 0.4;
  if (G.aiHint && G.aiHint.t > G.t && G.aiHint.dir === 0) { c.brake = 1; c.gas = 0; }
  if (P.blood > 0.5 || P.acid > 0.2 || P.rain > 0.6 || P.oil > 0.3) pressWiper();
  P.saws = S.up.serra > 0 || S.up.lateral >= 2 ? P.fuel > 0.12 : false;
  if (CAPO[S.up.capo] && P.gheat < 0.85) { for (const e of G.ents) { if (e.dead || e.st === 'latch' || ENEMY[e.type].estatico) continue; const dz = e.z - P.z; if (dz > 12 && dz < 150 && Math.abs(e.x - P.x) < ENEMY[e.type].w / 2 + 0.4) { c.fire = 1; break; } } if (!c.fire && G.boss && BOSS.pilotTarget(200)) c.fire = 1; }
  return c;
}
function pressWiper() { if (P.wipe <= 0) { P.wipe = 1.3; SFX.wiper(); } }
function updateCar(dt) {
  const V = G.V, u = S.up, c = G.role === 'pilot' ? I : aiPilot(), st = G.st;
  const turbo = G.turboT > 0;
  let steerIn = c.steer; if (G.role === 'pilot' && META.opts.gyro) steerIn = clamp(steerIn + I.tilt, -1, 1);
  P.steer += clamp(steerIn - P.steer, -dt * 5, dt * 5);
  let vmax = V.vmax * (turbo ? 1.3 : 1);
  const off = Math.abs(P.x) > ROADW;
  if (off) vmax *= u.susp ? 0.72 : 0.55; if (u.pneu < 1) vmax *= 1 - P.tires * 0.13; if (P.over) vmax *= 0.5; if (P.fuel <= 0) vmax = Math.min(vmax, 12);
  if (G.phase === 'saque') vmax = Math.min(vmax, 9);
  const acc = (9.5 / Math.pow(V.mass, 0.35)) * (u.turbo ? 1.2 : 1) * (turbo ? 2 : 1);
  if (c.gas > 0 && P.speed >= -0.5) P.speed += acc * c.gas * Math.max(0, 1 - P.speed / vmax) * dt;
  else if (P.speed > 0) P.speed -= 1.6 * dt;
  if (P.speed > vmax) P.speed -= Math.min(P.speed - vmax, 12 * dt);
  if (c.brake > 0) { if (P.speed > 0.3) { P.speed -= 16 * dt; P.brakeT += dt; } else { P.speed = Math.max(-7, P.speed - 6 * dt); P.brakeT = 0; } } else { P.brakeT = 0; if (P.speed < 0) P.speed = Math.min(0, P.speed + 8 * dt); }
  if (c.hand > 0 && P.speed > 1) { P.speed -= 10 * dt; P.brakeT += dt; if (Math.abs(P.steer) > 0.4 && P.speed > 10) P.slideT += dt; else P.slideT = 0; } else P.slideT = 0;
  // direção
  const grip = Math.min(1, Math.abs(P.speed) / 12), latSp = P.steer * (10.5 / Math.pow(V.mass, 0.18)) * grip * (c.hand > 0 ? 1.5 : 1) * (P.speed < 0 ? -1 : 1);
  const curve = curveAt(Math.floor(P.z / SEG));
  P.pull *= 1 - dt * 2;
  if (G.clima === 'chuva' && Math.random() < dt * 0.1 && P.speed > 25) { P.pull = rnd(-5, 5); if (G.role === 'pilot') say('Aquaplanagem!', 'sys', 1.5, true); }
  if (G.clima === 'areia') P.pull += Math.sin(G.t * 0.7) * dt * 3;
  if (u.pneu < 1 && P.tires > 0) P.pull += P.tires * 0.5 * dt * Math.sin(G.t * 2.1 + 1) + P.tires * 0.25 * dt;
  P.lat = latSp + P.pull - curve * (P.speed / 40) * 150;
  P.x += P.lat * dt;
  const lim = isBridge(P.z) ? ROADW - V.w + 0.3 : st.penhasco ? ROADW + 4 : ROADW + 9;
  if (Math.abs(P.x) > lim) { P.x = Math.sign(P.x) * lim; if (P.speed > 8) { armorDmg(st.penhasco && P.x > 0 ? 14 * dt * 4 : 5 * dt * 3, st.penhasco ? 'Despencou no precipício.' : 'Destruído na lateral.'); G.shake = Math.max(G.shake, 0.8); if (Math.random() < dt * 20) fxSpark(P.x > 0 ? G.W - 50 : 50, G.H * 0.6, 3); P.speed *= 1 - dt * 0.8; } }
  if (st.penhasco && P.x > ROADW + 3.5 && P.speed > 5) { armorDmg(30, 'Despencou no precipício.'); P.x = 0; P.speed *= 0.3; say('QUASE CAIU NO PRECIPÍCIO!', 'sys'); G.shake = 2; SFX.crash(); }
  if (off && P.speed > 5) G.shake = Math.max(G.shake, (u.susp ? 0.25 : 0.5) * (drv() === 'trovao' ? 0.6 : 1));
  if (off && G.phase === 'boss') G.offroadBoss = true;
  P.z += P.speed * dt;
  G.skyX += curve * P.speed * dt * 12;
  // motor
  const sp = Math.max(0, P.speed), gs = vmax / 5; P.gear = P.speed < -0.2 ? 'R' : clamp(1 + Math.floor(sp / gs), 1, 5); const inG = (sp % gs) / gs;
  const tr = 0.18 + inG * 0.72 + (c.gas > 0 && sp < 3 ? 0.3 : 0); P.rpm += (clamp(tr, 0.1, 1) - P.rpm) * dt * 6;
  P.fuel = Math.max(0, P.fuel - (0.0003 + c.gas * 0.0022 * (0.5 + P.rpm * 0.5) + (P.saws ? 0.0007 * 0.7 : 0) + (turbo ? 0.004 : 0)) * dt / V.tank);
  if (P.fuel <= 0 && !P.noFuel) { P.noFuel = true; say('TANQUE SECO! Rodando no cheiro até a cidade...', 'sys', 5); P.saws = false; }
  if (P.saws && !(u.serra > 0 || u.lateral >= 2 || u.frente >= 4)) P.saws = false;
  let hot = 0.42 + c.gas * P.rpm * 0.28 + P.clog + (G.clima === 'fumaca' ? 0.2 : G.clima === 'queimada' ? 0.4 : 0) + (turbo ? 0.25 : 0) + (P.speed > V.vmax * 0.93 ? 0.12 : 0);
  P.temp += (hot - P.temp) * dt * (drv() === 'trovao' ? 0.035 : 0.055) * (hot > P.temp ? 1 : 2.2);
  P.clog = Math.max(0, P.clog - dt * 0.02);
  if (!P.over && P.temp > 1) { P.over = true; G.stats.over++; say('MOTOR FERVENDO! Alivia o pé!', 'sys', 4); } if (P.over && P.temp < 0.8) P.over = false;
  if (P.over && G.frame % 20 === 0) SFX.beep();
  // para-brisa
  if (G.clima === 'chuva') P.rain = Math.min(1, P.rain + dt * 0.22);
  if (P.wipe > 0) { P.wipe -= dt; P.blood = Math.max(0, P.blood - dt * 0.5); P.rain = Math.max(0, P.rain - dt * 1.4); P.acid = Math.max(0, P.acid - dt * 0.1); P.oil = Math.max(0, P.oil - dt * 0.45); if (P.blood < 0.5 && P.splats.length && Math.random() < dt * 14) P.splats.shift(); }
  // arma fixa do capô
  P.gcd -= dt; P.gfire = Math.max(0, P.gfire - dt); P.gheat = Math.max(0, P.gheat - dt * 0.22); if (P.glock && P.gheat < 0.4) P.glock = false;
  const capo = CAPO[u.capo];
  if ((G.role === 'pilot' ? I.fire : c.fire) && capo) { if (P.glock) { if (P.gcd <= 0) { SFX.click(); P.gcd = 0.3; } } else if (P.gcd <= 0) pilotFire(capo); }
  // serras frontais contra chefe / veículos à frente tratadas em hitByCar
  SFX.engine(P.rpm, c.gas, true); SFX.saw(P.saws || (G.role === 'gunner' && A.useMelee && A.rev > 0), P.saws ? 0.5 + P.rpm * 0.5 : A.rev);
  SFX.wind(clamp(P.speed / 40, 0, 1), G.role === 'gunner' && A.exposed);
}
function pilotFire(g) {
  P.gcd = 1 / g.rof; P.gfire = 0.06; P.gheat += g.heat * 0.011 * (drv() === 'cobra' ? 0.5 : 1); if (P.gheat >= 1) { P.glock = true; say('Cano da arma fixa superaquecido!', 'sys', 2, true); }
  SFX.shot(g.pen); G.shake = Math.max(G.shake, 0.15 + g.pen * 0.05);
  const inc = G.abil.on > 0 && S.cls === 'cobra';
  // linha reta à frente do carro
  let best = null, bd = 220;
  for (const e of G.ents) { if (e.dead || e.st === 'latch') continue; const dz = e.z - P.z; if (dz < 1 || dz > bd) continue; if (Math.abs(e.x - P.x) < ENEMY[e.type].w / 2 + 0.35) { best = e; bd = dz; } }
  const bp = G.boss ? BOSS.pilotTarget(bd) : null;
  const tx = G.W / 2 + rnd(-3, 3), ty = G.H * (G.cam === 'fpp' ? 0.47 : 0.42);
  tracer(G.W / 2, G.H * 0.62, tx, ty, g.pen >= 4 ? '#ffb040' : null);
  if (bp) { BOSS.hitPart(bp, g.dmg, g.pen, { by: 'pilot' }); return; }
  if (best) { damageEnt(best, g.dmg * (inc ? 1.5 : 1), g.pen, { by: 'pilot' }); if (g.expl || inc) aoe(best.x, best.z, g.expl || 3, g.dmg * 0.5, best); }
}

/* ---------- artilheiro (jogador) ---------- */
function pickTarget(px, py, rad) {
  let best = null, bd = 1e9;
  for (const h of G.hits) {
    const inside = px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h;
    let d; if (inside) d = h.dz - (h.part ? 0.5 : 0); else if (rad) { const cx = clamp(px, h.x, h.x + h.w), cy = clamp(py, h.y, h.y + h.h), dd = Math.hypot(px - cx, py - cy); if (dd > rad) continue; d = h.dz + 1000 + dd; } else continue;
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function gunnerFire() {
  const w = WEAPONS[A.w], c = cls();
  if (A.reloadT > 0 || A.cd > 0 || !A.exposed || A.down > 0) return;
  if ((A.mag[A.w] || 0) <= 0) { SFX.click(); A.cd = 0.3; if (S.ammo[w.ammo] > 0) startReload(); else callout('semmun'); return; }
  if (w.heat && A.hlock) { SFX.click(); A.cd = 0.3; return; }
  A.mag[A.w] -= w.cost || 1; if (A.mag[A.w] < 0) A.mag[A.w] = 0; A.cd = 1 / w.rof; A.flash = 0.05; A.kick = 1; if (w.cat === 'escopeta') A.pump = 1;
  G.stats.shots++; SFX.shot(w.pen); if (w.pen >= 4) SFX.vibrate(30);
  if (w.heat) { A.heat += w.heat * 0.012 * (c.id === 'cobra' ? 0.5 : 1); if (A.heat >= 1) { A.hlock = true; say('Cano incandescente! Deixe esfriar.', 'sys', 2, true); } }
  const falc = G.abil.on > 0 && c.id === 'falcao', inc = G.abil.on > 0 && c.id === 'cobra';
  const spread = w.spread * (A.ads > 0.5 ? 0.25 : 1) * (1 + G.shake * 1.5);
  const px = A.ax + rnd(-spread, spread), py = A.ay + rnd(-spread, spread);
  const rec = w.recoil * (A.ads > 0.5 && c.id === 'falcao' ? 0.5 : 1) * (A.ads > 0.5 ? 0.7 : 1); A.ay -= rec * 0.6; A.ax += rnd(-rec, rec) * 0.25; G.shake = Math.max(G.shake, 0.1 + w.recoil * 0.012);
  if (w.kick) { const pl = (A.ax < G.W / 2 ? 1 : -1) * w.kick * 3 * (A.look); if (NET.client) NET.pullUse += pl; else P.pull += pl; }   // recuo puxa o carro
  tracer(G.W / 2 + (px - G.W / 2) * 0.4, G.H * 0.8, px, py, w.pen >= 4 || inc ? '#ffb040' : null);
  const pen = w.pen + (falc ? 2 : 0), dmgMul = inc ? 1.5 : 1;
  let hitAny = false;
  const apply = (h, mult) => {
    hitAny = true;
    if (h.part) { HIT.part(h.part, w.dmg * mult * dmgMul, pen, { by: 'player', wid: A.w, ads: A.ads > 0.5 }); fxSpark(px, py, 4); return; }
    const e = h.e, isZ = !ENEMY[e.type].veh; const head = isZ && py < h.y + h.h * 0.24 && (A.ads > 0.5 || falc || Math.random() < 0.35);
    const weak = !isZ && A.ads > 0.5 && (py > h.y + h.h * 0.75 || py < h.y + h.h * 0.4);
    HIT.ent(e, w.dmg * mult * dmgMul * (weak ? 1.8 : 1), pen, { by: 'player', head, wid: A.w });
    if (isZ) fxBlood(px, py, 4); else fxSpark(px, py, 4);
  };
  if (w.sg) { const r = w.sg * (A.ads > 0.5 ? 0.7 : 1); for (const h of G.hits.slice()) { const cx = clamp(px, h.x, h.x + h.w), cy = clamp(py, h.y, h.y + h.h); if (Math.hypot(px - cx, py - cy) < r) apply(h, clamp(1.3 - h.dz / 45, 0.25, 1)); } }
  else { const h = pickTarget(px, py, A.ads > 0.5 ? 6 : 26); if (h) { const bb = G.boss, ex = h.e ? h.e.x : bb ? bb.x : P.x, ez = h.e ? h.e.z : bb ? P.z + bb.rel : P.z + 30; apply(h, 1); if (w.expl || inc) { HIT.aoe(ex, ez, w.expl || 3, w.dmg * 0.5, h.e); fxBoom(px, py, 30 + (w.expl || 3) * 8); } } }
  if (hitAny) G.stats.hitsN++;
  if (A.mag[A.w] <= 0 && S.ammo[w.ammo] > 0) startReload();
}
function startReload() { const w = WEAPONS[A.w]; if (A.reloadT > 0 || A.mag[A.w] >= w.mag || S.ammo[w.ammo] <= 0) return; A.reloadT = w.reload * (S.cls === 'falcao' ? 0.65 : 1) * (A.exposed ? 1 : 0.8); SFX.reload(); }
function meleeHit(dps, dt) {
  const m = MELEE[S.melee], c = cls(); const mult = (c.id === 'graxa' ? 1.4 : 1);
  let n = 0;
  for (const h of G.hits.slice()) {
    const reach = m.reach ? 9 : 4.5; if (h.dz > reach) continue; if (Math.abs((h.x + h.w / 2) - A.ax) > G.W * 0.28 + h.w / 2) continue;
    const src = { by: 'player', melee: true, saw: !!m.saw };
    if (h.part) { if (h.part.meleeOk || m.saw) HIT.part(h.part, (dps ? dps * dt : m.dmg) * mult * (h.part.meleeOk ? 3 : 1), m.pen || 2, src); n++; continue; }
    const e = h.e; let dm = (dps ? dps * dt : m.dmg) * mult; if (ENEMY[e.type].veh && m.saw && c.id === 'graxa') dm *= 2;
    HIT.ent(e, dm, m.pen || 1, src); n++;
    if (!dps && m.kb > 2 && !e.dead) HIT.knock(e, src);
    if (Math.random() < (dps ? dt * 20 : 1)) fxBlood(h.x + h.w / 2, h.y + h.h * 0.4, dps ? 2 : 6);
    if (!dps && !m.reach) break;
  }
  return n;
}
function updateGunner(dt) {
  const c = cls();
  A.cd -= dt; A.kick = Math.max(0, A.kick - dt * 8); A.flash -= dt; A.pump = Math.max(0, A.pump - dt * 2.5); A.heat = Math.max(0, A.heat - dt * 0.2); if (A.hlock && A.heat < 0.4) A.hlock = false;
  A.ads += ((I.ads && A.exposed && !A.useMelee ? 1 : 0) - A.ads) * Math.min(1, dt * 12);
  if (A.down > 0) { A.down -= dt; if (A.down <= 0) A.hp = 50; }
  if (!A.exposed) A.hp = Math.min(100, A.hp + dt * 6); else A.hp = Math.min(100, A.hp + dt * 1);
  if (A.reloadT > 0) { A.reloadT -= dt; if (A.reloadT <= 0) { fillMag(A.w); SFX.reload(); } }
  // inércia da suspensão na mira
  const j = G.shake * 6 + (Math.abs(P.x) > ROADW && P.speed > 5 ? 3 : 0); A.ax += rnd(-j, j) * dt * 20; A.ay += rnd(-j, j) * dt * 20;
  A.ax = clamp(A.ax, 20, G.W - 20); A.ay = clamp(A.ay, G.H * 0.12, G.H * 0.9);
  if (A.swingT > 0) { A.swingT -= dt; A.swing = 1 - A.swingT / A.swingD; } else A.swing = 0;
  if (!A.exposed || A.down > 0) { A.rev = 0; return; }
  if (A.useMelee) {
    const m = MELEE[S.melee];
    if (m.saw) { A.rev = I.fire ? Math.min(1, A.rev + dt * 4) : Math.max(0, A.rev - dt * 3); if (I.fire && P.fuel > 0) { const fu = 0.0006 * dt * (c.id === 'graxa' ? 0.7 : 1); if (NET.client) NET.fuelUse += fu; else P.fuel = Math.max(0, P.fuel - fu); if (meleeHit(m.dps, dt) && G.frame % 6 === 0) SFX.vibrate(20); if (G.frame % 10 === 0) SFX.vibrate(12); } }
    else if (I.fire && A.swingT <= 0 && A.cd <= 0) { A.swingD = m.cd; A.swingT = m.cd; A.cd = m.cd; SFX.swing(); const n = meleeHit(0, 0); if (n) { SFX.hit(); SFX.vibrate(25); } }
  } else if (I.fire) { const w = WEAPONS[A.w]; if (w.auto || !A.fireHeld) gunnerFire(); A.fireHeld = true; }
  if (!I.fire) A.fireHeld = false;
}

/* ---------- artilheiros controlados pela IA ---------- */
function updateAI(dt) {
  const city = cityLevel(), gun = aiGunners();
  for (const a of G.ai) aiAbility(a, dt);
  for (let i = 0; i < gun.length; i++) {
    const a = gun[i]; a.cd -= dt; if (a.cd > 0) continue; a.cd = rnd(0.9, 1.7) * (G.gas > 0 ? 1.8 : 1);
    let tgt = null, pr = 0;
    for (const e of G.ents) {
      if (e.dead || ENEMY[e.type].estatico) continue; const dz = e.z - P.z; let p = 0;
      if (e.st === 'latch') p = e.side === 0 ? 90 + e.t * 10 : 80 + e.t * 5; else if (e.type === 'carrobomba' || e.type === 'buggy') p = 85; else if (e.type === 'boiadeiro' && dz > 8 && dz < 110 && Math.abs(e.x - P.x) < 3.5) p = 70; else if (ENEMY[e.type].veh && Math.abs(dz) < 45) p = 60; else if (e.type === 'colosso' && dz > 0 && dz < 90) p = 55; else if (dz > 5 && dz < 60 && Math.abs(e.x - P.x) < 4 && e.type !== 'boiadeiro') p = 20 + (e.type === 'cangaceiro' ? 20 : 0);
      if (e.st === 'latch' && e.t < 1.0) p = 0;
      if (p > pr) { pr = p; tgt = e; }
    }
    const bf = a.buff > 0, falc = bf && a.cls.id === 'falcao', inc = bf && a.cls.id === 'cobra';
    const dmg = (45 + city * 30) * (inc ? 1.5 : 1), pen = Math.min(6, 1 + (city / 2 | 0) + (falc ? 2 : 0)), tc = inc ? '#ff8a30' : '#ffe9a0';
    if (G.boss && (!tgt || pr < 80) && Math.random() < 0.75) { const part = BOSS.aiTarget(); if (part) { const bb = G.boss; if (bb.vf >= G.frame - 1) tracer(i % 2 ? G.W * 0.92 : G.W * 0.08, G.H * 0.72, bb.sx + rnd(-20, 20), bb.sy - bb.sh * 0.5, tc); SFX.shotFar(); BOSS.hitPart(part, dmg * 0.5, pen, { by: 'ai' }); if (G.mode !== 'play') return; continue; } }
    if (!tgt) continue;
    if (tgt.vf >= G.frame - 1 && tgt.st !== 'latch') tracer(i % 2 ? G.W * 0.92 : G.W * 0.08, G.H * 0.72, tgt.sx, tgt.sy - tgt.sh * 0.6, tc);
    if (tgt.st === 'latch') { SFX.swing(); damageEnt(tgt, 140 + city * 40, 3, { by: 'ai', ai: a, saw: true }); }
    else { SFX.shotFar(); if (Math.random() < (falc ? 0.9 : 0.72)) { const head = Math.random() < (falc ? 0.65 : 0.3); if (head) a.heads++; damageEnt(tgt, dmg, pen, { by: 'ai', ai: a, head }); if (inc && !tgt.dead) aoe(tgt.x, tgt.z, 3, dmg * 0.4, tgt); } }
  }
  // avisos
  if (G.frame % 20 === 0) for (const e of G.ents) { if (e.dead) continue; const dz = e.z - P.z; if (dz < 20 || dz > 150) continue; if (Math.abs(e.x - P.x) > 3) continue; if (e.type === 'boiadeiro') callout('boiadeiro'); else if (e.type === 'colosso') callout('colosso'); else if (e.type === 'cangaceiro' && dz < 60 && S.up.pneu < 1) callout('cang'); }
}
/* companheiros da IA também usam o Botão de Adrenalina */
function aiAbility(a, dt) {
  a.ab -= dt; if (a.buff > 0) a.buff -= dt; if (a.ab > 0) return;
  const id = a.cls.id, boss = !!G.boss && G.phase === 'boss', armor = P.armor / G.V.armorMax, horda = G.st.megahorda && G.prog > G.st.megahorda;
  const veh = G.ents.some(e => !e.dead && ENEMY[e.type].veh && !ENEMY[e.type].estatico && Math.abs(e.z - P.z) < 50);
  let go = false;
  if (id === 'graxa') go = armor < 0.45 || P.over || (P.tires >= 2 && S.up.pneu < 1);
  else if (id === 'trovao') go = G.turboT <= 0 && (boss || horda || G.phase === 'saque') && Math.random() < 0.4;
  else go = (boss || veh) && aiGunners().includes(a);
  if (!go) { a.ab = 2; return; }
  a.ab = 60; say(a.cls.nome + ' (IA): "' + pick(a.cls.falas) + '" — ' + a.cls.ativa.toUpperCase() + '!', 'ai', 3.5); SFX.ping();
  applyAbility(id, a);
}
/* efeitos que mexem no veículo (rodam no host) */
function applyAbility(id, a) {
  if (id === 'trovao') { G.turboT = 8; SFX.turbo(); }
  else if (id === 'graxa') { P.armor = Math.min(G.V.armorMax, P.armor + G.V.armorMax * 0.25); P.temp = Math.min(P.temp, 0.45); P.over = false; P.clog = 0; P.tires = 0; P.mirrorL = true; fxSpark(G.W / 2, G.H * 0.7, 30); }
  else if (a) a.buff = CLASSES.find(c => c.id === id).dur;
}

/* ---------- habilidade de classe (jogador local) ---------- */
function useAbility() {
  if (G.abil.cd > 0 || G.mode !== 'play') return; const c = cls(); G.abil.cd = 60; G.abil.on = c.dur;
  if (NET.client) { NET.send({ t: 'abil', c: c.id }); SFX.ping(); return; }   // o host anuncia para todos e aplica Turbo/Solda no carro
  say(c.nome + ': "' + pick(c.falas) + '" — ' + c.ativa.toUpperCase() + '!', 'ai', 4); SFX.ping();
  if (c.id === 'trovao' || c.id === 'graxa') applyAbility(c.id);
}

/* ---------- laço principal ---------- */
function update(dt) {
  G.t += dt; G.frame++; G.stats.t += dt; const st = G.st;
  G.prog = clamp(P.z / st.len, 0, 1);
  let cl = 'limpo'; for (const c of st.clima) if (G.prog >= c[0]) cl = c[1]; if (S.mode === 'expresso' && cl === 'limpo') cl = (S.stage % 2 ? 'neblina' : 'chuva'); if (G.phase !== 'road' && G.phase !== 'arena' && (cl === 'queimada')) cl = 'limpo'; G.clima = cl;
  if (G.abil.cd > 0) G.abil.cd -= dt; if (G.abil.on > 0) G.abil.on -= dt; if (G.turboT > 0) G.turboT -= dt;
  for (const k in G.led) if (G.led[k] > 0) G.led[k] -= dt;
  G.shake = Math.max(0, G.shake - dt * 3); G.hurt = Math.max(0, (G.hurt || 0) - dt * 1.2); G.flash = Math.max(0, G.flash - dt * 2); G.smokeIn = Math.max(0, G.smokeIn - dt * 0.25); G.gas = Math.max(0, G.gas - dt); G.blind = Math.max(0, G.blind - dt * 1.5);
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
  updateCar(dt); if (G.mode !== 'play') return;
  if (G.phase === 'road' || G.phase === 'arena' || G.phase === 'boss') spawnAhead();
  if (G.phase === 'saque') { if (Math.random() < dt * (1.15 + S.stage * 0.24) * st.dens) spawn(pick(['andarilho', 'andarilho', 'corredor', S.stage >= 2 ? 'encouracado' : 'corredor']), rnd(-7, 7), P.z + (Math.random() < 0.6 ? rnd(30, 70) : rnd(-45, -20))); }
  if (G.phase === 'road' || G.phase === 'arena') { G.bandT -= dt * st.band * (S.mode === 'furia' ? 2 : 1); if (G.bandT <= 0) { G.bandT = rnd(14, 26); spawnBandit(); } }
  updateEvents(dt); updateEnts(dt); if (G.mode !== 'play') return;
  if (G.boss) BOSS.update(dt); if (G.mode !== 'play') return;
  if (G.role === 'gunner') updateGunner(dt);
  updateAI(dt);
  updateFx(dt);
  // marcos do trecho
  if (st.pedagio && !G.pedDone && G.prog >= st.pedagio) { G.pedDone = true; if (P.speed * 3.6 >= 140 && G.stats.over === 0) unlockAch('pedagio'); say('Fortaleza do pedágio! ' + Math.round(P.speed * 3.6) + ' km/h', 'sys', 3); for (let i = 0; i < 3; i++) spawnBandit(); }
  if (st.pedagio && G.prog < st.pedagio - 0.02) G.pedDone = false;
  if (S.stage === 9 && !G.arena && !G.c30 && G.prog > 0.6 && S.mode !== 'furia') { G.c30 = true; S.up.capo = Math.max(S.up.capo, S.veh >= 4 ? 6 : S.up.capo); S.ammo.pesada = ammoMax('pesada'); say('MESSEJANA: Canhão 30mm saqueado do Guarani tombado e instalado!', 'sys', 6); SFX.buy(); const uw = usableWeapons(); A.w = uw[uw.length - 1]; fillMag(A.w); }
  if (G.phase === 'road' && P.z >= st.len) { G.phase = 'boss'; BOSS.start(st.boss); }
  if (G.phase === 'saque') { G.saqueT -= dt; if (G.saqueT <= 0) endStage(); }
  if (G.phase === 'arena') { G.waveT -= dt; if (G.waveT <= 0) { addScrap(120 + G.wave * 30); G.wave++; META.arenaBest = Math.max(META.arenaBest || 0, G.wave - 1); saveAll(); S.armorFrac = P.armor / G.V.armorMax; G.mode = 'garage'; SFX.music(null); SFX.engine(0, 0, false); SFX.saw(false, 0); UI.garage(); } }
  if (P.speed * 3.6 > 139 && G.frame % 240 === 0 && G.phase === 'road') { G.flash = 0.6; say('📸 Radar: ' + Math.round(P.speed * 3.6) + ' km/h. A multa vai pro apocalipse.', 'sys', 2.5); }
}
function updateFx(dt) {
  for (const f of G.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; } G.fx = G.fx.filter(f => f.life > 0); if (G.fx.length > 300) G.fx.splice(0, G.fx.length - 300);
  for (const t of G.tracers) t.life -= dt; G.tracers = G.tracers.filter(t => t.life > 0);
}
/* Celular de Artilheiro no co-op: o mundo vem do host; aqui só previsão do movimento, a própria arma e efeitos. */
function clientUpdate(dt) {
  G.t += dt; G.frame++; G.stats.t += dt;
  if (!G.hostPaused) { P.z += P.speed * dt; for (const e of G.ents) { e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.isRel) e.z = P.z + e.rel; } if (G.boss) G.boss.t += dt; for (const h of G.haz || []) h.t += dt; }
  if (G.boss && G.boss.parts) for (const p of G.boss.parts) if (p.flash > 0) p.flash -= dt;
  if (G.abil.cd > 0) G.abil.cd -= dt; if (G.abil.on > 0) G.abil.on -= dt; if (G.turboT > 0) G.turboT -= dt; if (G.qte) G.qte.t -= dt;
  for (const k in G.led) if (G.led[k] > 0) G.led[k] -= dt;
  G.shake = Math.max(0, G.shake - dt * 3); G.hurt = Math.max(0, (G.hurt || 0) - dt * 1.2); G.flash = Math.max(0, G.flash - dt * 2);
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
  updateGunner(dt); updateFx(dt);
  SFX.engine(P.rpm, 0.6, !G.hostPaused); SFX.saw(P.saws || (A.useMelee && A.rev > 0), P.saws ? 0.5 + P.rpm * 0.5 : A.rev); SFX.wind(clamp(P.speed / 40, 0, 1), A.exposed);
}
function startSaque() {
  G.phase = 'saque'; G.saqueT = G.saqueMax = S.stage <= 1 ? 30 : 40; G.boss = null; G.blind = 0; G.gas = 0;
  for (const e of G.ents) if (ENEMY[e.type].veh) e.dead = true;
  G.banner = { t: 5, a: 'ZONA DE SAQUE — ' + G.st.cidade, b: G.st.saque + ': segurem o perímetro por ' + G.saqueMax + 's' };
  say('Carregando caixas de munição! Triture quem chegar perto!', 'radio', 5);
}
function endStage() {
  const st = G.st, i = S.stage, s = G.stats; G.mode = 'score'; SFX.music(null); SFX.engine(0, 0, false); SFX.saw(false, 0); SFX.wind(0, false);
  const premio = 160 + i * 45; S.sucata += premio; s.premio = premio;
  if (i === 0 && s.shots === 0) unlockAch('lenhador');
  if (i === 3 && S.veh === 1) unlockAch('escada');
  S.armorFrac = clamp(P.armor / G.V.armorMax, 0.1, 1); S.stage = i + 1; S.tot.kills += s.kills; S.tot.t += s.t;
  for (const k in A.mag) { S.ammo[WEAPONS[k].ammo] += A.mag[k]; A.mag[k] = 0; }
  const city = cityLevel(), crate = { leve: 60, cartucho: city >= 1 ? 18 : 0, fuzil: city >= 4 ? 90 : 0, pesada: city >= 6 ? 50 : 0 };
  for (const k in crate) S.ammo[k] = Math.min(ammoMax(k), S.ammo[k] + crate[k]);
  S.sucata = Math.round(S.sucata); saveAll(); UI.score();
}

/* ---------- pista ---------- */
function curveAt(i) { const st = G.st; if (!st) return 0; const s = st.seed; const c = Math.sin(i / 41 + s) * Math.sin(i / 97 + s * 2.3); const t = 0.28; if (Math.abs(c) < t) return 0; if (st.ponte && i * SEG / st.len > st.ponte[0] - 0.02) return 0; return (c - Math.sign(c) * t) * st.curv; }

/* ---------- ações de UI ---------- */
function toggleRole() { if (G.mode !== 'play' || G.netClient) return; if (G.role === 'pilot' && !G.ai.length) { say('Todos os lugares têm jogadores — alguém precisa dirigir!', 'sys', 3, true); return; } G.role = G.role === 'pilot' ? 'gunner' : 'pilot'; if (G.role === 'gunner') usableWeapons().forEach(k => { if (!(A.mag[k] > 0)) fillMag(k); }); A.exposed = true; A.ax = G.W / 2; A.ay = G.H * 0.45; say(G.role === 'pilot' ? 'Você assumiu o VOLANTE.' : 'Você foi para a JANELA. A IA dirige.', 'sys', 2.5, true); I.fire = I.ads = I.gas = I.brake = I.hand = 0; I.steer = 0; UI.sync(); }
function toggleCam() { if (S.mode === 'expresso' || META.opts.fpp) { say('Câmera travada em 1ª pessoa.', 'sys', 2, true); return; } G.cam = G.cam === 'fpp' ? 'tpp' : 'fpp'; }
function cycleWeapon() { const u = usableWeapons(); if (A.useMelee) { A.useMelee = false; UI.sync(); return; } A.w = u[(u.indexOf(A.w) + 1) % u.length]; A.reloadT = 0; if (!(A.w in A.mag)) fillMag(A.w); SFX.reload(); say(WEAPONS[A.w].nome, 'sys', 1.5, true); UI.sync(); }
function toggleMelee() { const m = usableMelee(); if (A.useMelee) { S.melee = m[(m.indexOf(S.melee) + 1) % m.length]; } else A.useMelee = true; A.rev = 0; if (MELEE[S.melee].saw) { SFX.vibrate([40, 60, 40, 60, 120]); SFX.turbo(); } say(MELEE[S.melee].nome, 'sys', 1.5, true); UI.sync(); }
function toggleExpose() { A.exposed = !A.exposed && A.down <= 0; if (!A.exposed && A.mag[A.w] < WEAPONS[A.w].mag) startReload(); UI.sync(); }
function nextSeat() { A.seat = (A.seat + 1) % 3; say('Assento: ' + G.V.v.seats[A.seat], 'sys', 1.5, true); A.cd = 0.5; }
function toggleLook() { A.look = -A.look; }
function pingAI(dir, nome) { if (NET.client) { NET.send({ t: 'ping', d: dir }); SFX.ping(); return; } G.aiHint = { dir, t: G.t + 2.5 }; G.led[dir < 0 ? 'L' : dir > 0 ? 'R' : 'H'] = 2.5; SFX.ping(); say((nome || cls().nome) + ': "' + (dir < 0 ? 'Inimigo na ESQUERDA!' : dir > 0 ? 'Inimigo na DIREITA!' : 'MUTANTE NO CAPÔ! Freia!') + '"', 'ai', 2); }
function toggleSaws() { const u = S.up; if (!(u.serra > 0 || u.lateral >= 2 || u.frente >= 4)) { say('Sem motosserras acopladas. Compre o kit na oficina (Uberlândia em diante).', 'sys', 3, true); return; } if (P.fuel <= 0) return; P.saws = !P.saws; if (P.saws) { SFX.turbo(); SFX.vibrate(60); } UI.sync(); }
function toggleLights() { P.lights = (P.lights + 1) % 3; SFX.ui(); }
function nextRadio() { G.radio = (G.radio + 1) % RADIO.length; const r = RADIO[G.radio]; SFX.static_(); SFX.music(G.radio === 0 ? G.st.musica : r.m); if (r.m === 'marinha') say('RÁDIO: "' + pick(RADIO_MSGS) + '"', 'radio', 6, true); }
function qtePress() { if (!G.qte) return; if (NET.client) { NET.send({ t: 'qte' }); G.qte = null; } else G.qte.ok = true; }
