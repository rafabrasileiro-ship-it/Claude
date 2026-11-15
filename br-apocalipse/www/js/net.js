'use strict';
/* BR-APOCALIPSE — co-op local (Wi-Fi, até 4 celulares).
   Arquitetura Host/Client: o celular do Jogador 1 (Piloto) é o servidor da partida. Ele simula tudo (física, hordas, IA,
   chefes) e envia "snapshots" ~15x por segundo. Os outros celulares são Artilheiros: desenham o mundo recebido, cuidam da
   própria mira/arma/recarga e mandam os acertos para o host aplicar.
   Transporte: no app Android, a ponte nativa BRApp (TCP + descoberta por UDP broadcast). No navegador, abas do mesmo
   navegador conversam por BroadcastChannel (serve para testar o co-op sem celulares). */
const NET = (() => {
  const PROTO = 1, SNAP_HZ = 15;
  const PH = ['road', 'boss', 'saque', 'arena', 'fim'], CL = ['limpo', 'chuva', 'neblina', 'fumaca', 'queimada', 'areia'];
  const FWD = ['boom', 'crash', 'horn', 'glass', 'pssh', 'turbo', 'ping', 'buy'];
  let TY = null, BK = null, tr = null;
  const r2 = (v) => Math.round((v || 0) * 100) / 100;
  const N = {
    host: false, client: false, connected: false, scanning: false, kind: '',
    peers: {}, rooms: [], myId: 0, myCls: null, lobby: null, garage: null,
    msgq: [], sfxq: [], gd: 0, hitq: {}, fuelUse: 0, pullUse: 0, emap: {},
    lastRx: 0, snapT: 0, hbT: 0, flushT: 0, wrapped: false, lastScore: null, lastOver: null,
  };

  /* ---------------- transportes ---------------- */
  function nativeTr() {
    const B = window.BRApp;
    return { kind: 'wifi', host: (n) => B.host(n), scan: (on) => B.scan(!!on), join: (ip) => B.join(ip), send: (s) => B.send(s), sendTo: (id, s) => B.sendTo(id, s),
      broadcast: (s) => B.broadcast(s), kick: (id) => B.kick(id), poll: () => B.poll(), stop: () => B.stop(), ip: () => B.myIp() };
  }
  function tabsTr() {
    if (typeof BroadcastChannel === 'undefined') return null;
    const ch = new BroadcastChannel('brapoc-net'), me = Math.random().toString(36).slice(2, 8), q = [];
    let role = null, hostTab = null, peersTab = {}, nextId = 1, beacon = null, scanning = false, name = '';
    const idOf = (tab) => { for (const k in peersTab) if (peersTab[k] === tab) return +k; return 0; };
    ch.onmessage = (ev) => {
      const m = ev.data;
      if (m.k === 'beacon') { if (scanning) q.push('0\t' + JSON.stringify({ t: '_host', ip: m.from, name: m.name })); }
      else if (m.k === 'join') { if (role === 'host' && m.to === me) { const id = nextId++; peersTab[id] = m.from; ch.postMessage({ k: 'acc', to: m.from, from: me }); q.push(id + '\t{"t":"_join"}'); } }
      else if (m.k === 'acc') { if (m.to === me) { hostTab = m.from; q.push('0\t{"t":"_conn"}'); } }
      else if (m.k === 'm') {
        if (role === 'host' && m.to === me) { const id = idOf(m.from); if (id) q.push(id + '\t' + m.d); }
        else if (role === 'client' && m.from === hostTab && (m.to === me || m.to === '*')) q.push('0\t' + m.d);
      } else if (m.k === 'bye') {
        if (role === 'host') { const id = idOf(m.from); if (id) { delete peersTab[id]; q.push(id + '\t{"t":"_bye"}'); } }
        else if (role === 'client' && m.from === hostTab) { hostTab = null; q.push('0\t{"t":"_bye"}'); }
      }
    };
    addEventListener('pagehide', () => ch.postMessage({ k: 'bye', from: me }));
    return { kind: 'tabs',
      host: (n) => { role = 'host'; name = n; clearInterval(beacon); beacon = setInterval(() => ch.postMessage({ k: 'beacon', from: me, name }), 700); return true; },
      scan: (on) => { scanning = !!on; },
      join: (ip) => { role = 'client'; hostTab = null; ch.postMessage({ k: 'join', from: me, to: ip }); setTimeout(() => { if (!hostTab && role === 'client') q.push('0\t{"t":"_fail"}'); }, 3000); return true; },
      send: (s) => { if (hostTab) ch.postMessage({ k: 'm', from: me, to: hostTab, d: s }); },
      sendTo: (id, s) => { if (peersTab[id]) ch.postMessage({ k: 'm', from: me, to: peersTab[id], d: s }); },
      broadcast: (s) => { if (role === 'host') ch.postMessage({ k: 'm', from: me, to: '*', d: s }); },
      kick: (id) => { if (peersTab[id]) { ch.postMessage({ k: 'm', from: me, to: peersTab[id], d: '{"t":"close","why":"Removido pelo Piloto."}' }); delete peersTab[id]; } },
      poll: () => { if (!q.length) return ''; const s = q.join('\n'); q.length = 0; return s; },
      stop: () => { ch.postMessage({ k: 'bye', from: me }); clearInterval(beacon); role = null; hostTab = null; peersTab = {}; scanning = false; q.length = 0; },
      ip: () => 'aba ' + me };
  }
  function transport() { if (!tr) { tr = (window.BRApp && window.BRApp.poll) ? nativeTr() : tabsTr(); N.kind = tr ? tr.kind : ''; } return tr; }

  /* ---------------- sessão ---------------- */
  function startHost() {
    if (!transport()) return false; leave(true);
    N.host = true; N.peers = {}; N.msgq = []; N.sfxq = []; N.gd = 0; N.lastScore = N.lastOver = null;
    if (!N.wrapped) { N.wrapped = true; for (const n of FWD) { const f = SFX[n]; SFX[n] = function () { f.apply(SFX, arguments); if (N.host && G.mode === 'play' && N.sfxq.length < 8) N.sfxq.push(n); }; } }
    return !!tr.host(roomName());
  }
  function roomName() { return (META.nick || 'Piloto') + ' · ' + (S ? CLASSES.find(c => c.id === S.cls).nome : ''); }
  function scan(on) { if (!transport()) return false; N.scanning = !!on; if (on) N.rooms = []; tr.scan(!!on); return true; }
  function join(ip) { if (!transport()) return; if (N.host) leave(true); N.client = true; N.connected = false; N.myCls = null; N.lobby = null; tr.join(String(ip).trim()); }
  function leave(silent) {
    if (tr) { if (N.host && !silent) try { tr.broadcast('{"t":"close","why":"O Piloto fechou a sala."}'); } catch (e) {} try { tr.stop(); } catch (e) {} }
    const was = N.host || N.client;
    N.host = N.client = N.connected = N.scanning = false; N.peers = {}; N.emap = {}; N.hitq = {}; N.myCls = null;
    G.netClient = false; G.humanCls = []; G.drvCls = null; G.hostPaused = false;
    return was;
  }
  function send(o) { if (tr && N.client && N.connected) tr.send(JSON.stringify(o)); }
  function bcast(o) { if (tr && N.host) tr.broadcast(JSON.stringify(o)); }
  function sendTo(id, o) { if (tr && N.host) tr.sendTo(id, JSON.stringify(o)); }

  /* ---------------- laço de rede ---------------- */
  function pump() {
    if (!tr || !(N.host || N.client || N.scanning)) return;
    const raw = tr.poll();
    if (raw) {
      const evs = [];
      for (const ln of raw.split('\n')) { const k = ln.indexOf('\t'); if (k < 0) continue; let m; try { m = JSON.parse(ln.slice(k + 1)); } catch (e) { continue; } evs.push([+ln.slice(0, k), m]); }
      let last = -1; for (let i = 0; i < evs.length; i++) if (evs[i][1].t === 's') last = i;
      let carry = null;
      for (let i = 0; i < evs.length; i++) {
        const from = evs[i][0], m = evs[i][1];
        if (N.host) { if (N.peers[from]) N.peers[from].rx = performance.now(); onHost(from, m); continue; }
        N.lastRx = performance.now();
        if (m.t === 's') {   // snapshots atrasados: só o último é aplicado, mas os eventos de todos são mantidos
          if (carry) { m.m = carry.m.concat(m.m || []); m.x = carry.x.concat(m.x || []); m.d = (m.d || 0) + carry.d; }
          if (i === last) { applySnap(m); carry = null; } else carry = { m: m.m || [], x: m.x || [], d: m.d || 0 };
        } else onClient(m);
      }
    }
    const now = performance.now();
    if (N.client && N.connected && now - N.lastRx > 25000) lost('Sem sinal do Piloto há 25 segundos.');
    if (N.host) for (const id in N.peers) if (now - N.peers[id].rx > 30000) { tr.kick(+id); bye(+id); }
  }
  function tick() {
    if (!tr) return; const now = performance.now();
    if (N.host) {
      if (now - N.hbT > 2000) { N.hbT = now; tr.broadcast('{"t":"hb"}'); }
      if (G.mode === 'play' && Object.keys(N.peers).length && now - N.snapT >= 1000 / SNAP_HZ) { N.snapT = now; tr.broadcast(JSON.stringify(buildSnap())); }
    } else if (N.client && N.connected) {
      if (now - N.hbT > 2000) { N.hbT = now; tr.send('{"t":"hb"}'); }
      if (now - N.flushT > 50) { N.flushT = now; flush(); }
    }
  }

  /* ---------------- host ---------------- */
  function humanCls() { return Object.values(N.peers).filter(p => p.cls).map(p => p.cls); }
  function takenBy(c, id) { return (S && S.cls === c) || Object.values(N.peers).some(p => p.id !== id && p.cls === c); }
  function lobby() { return { host: { name: META.nick || 'Piloto', cls: S ? S.cls : null }, players: Object.values(N.peers).map(p => ({ id: p.id, name: p.name, cls: p.cls })), mode: S ? S.mode : 'normal', stage: S ? S.stage : 0, arena: !!G.arena }; }
  function lobbyChanged() { bcast({ t: 'lobby', lobby: lobby() }); UI.netEvent('lobby'); }
  function startMsg() { return { t: 'start', S, arena: !!G.arena, wave: G.wave || 1 }; }
  function garageMsg() {
    const nx = G.arena ? ARENA : STAGES[Math.min(9, S.stage)];
    return { t: 'garage', veh: VEHICLES[S.veh].nome, classe: VEHICLES[S.veh].classe, sucata: Math.round(S.sucata), armor: Math.round(S.armorFrac * 100), stage: S.stage, arena: !!G.arena, wave: G.wave || 1,
      aqui: G.arena ? 'Mega-posto BR-153' : S.stage === 0 ? 'Bauru' : STAGES[S.stage - 1].cidade, prox: nx.cidade, estrada: nx.estrada, intro: nx.intro };
  }
  function onHost(from, m) {
    const p = N.peers[from];
    switch (m.t) {
      case '_join': N.peers[from] = { id: from, name: 'Jogador', cls: null, rx: performance.now(), kills: 0, heads: 0, amput: 0, vex: 0, salva: 0 }; break;
      case '_bye': bye(from); break;
      case 'hello':
        if (!p) return; p.name = String(m.name || 'Jogador').slice(0, 16);
        if (m.proto !== PROTO) { sendTo(from, { t: 'close', why: 'Versões diferentes do jogo. Atualizem todos os celulares.' }); return; }
        sendTo(from, { t: 'welcome', id: from, lobby: lobby() }); lobbyChanged(); break;
      case 'pick': {
        if (!p) return; const c = CLASSES.find(c => c.id === m.cls);
        if (!c || takenBy(c.id, from)) { sendTo(from, { t: 'lobby', lobby: lobby(), err: 'Esse sobrevivente já foi escolhido.' }); return; }
        p.cls = c.id; lobbyChanged(); if (G.mode === 'play' || G.mode === 'pause') say(p.name + ' entrou na sala como ' + c.nome + '!', 'sys', 4);
        catchUp(from); break; }
      case 'hits': if (p && p.cls && G.mode === 'play') applyHits(from, m); break;
      case 'aoe': if (G.mode === 'play') aoe(+m.x, +m.z, +m.r, +m.d, null); break;
      case 'ammo': if (S && S.ammo[m.k] != null) S.ammo[m.k] = clamp(S.ammo[m.k] - (+m.n || 0), 0, ammoMax(m.k)); break;
      case 'abil': {
        if (G.mode !== 'play' || !p || !p.cls) return; const c = CLASSES.find(c => c.id === m.c); if (!c) return;
        say(c.nome + ': "' + pick(c.falas) + '" — ' + c.ativa.toUpperCase() + '!', 'ai', 4); SFX.ping();
        if (c.id === 'trovao' || c.id === 'graxa') applyAbility(c.id); break; }
      case 'ping': if (G.mode === 'play' && p && p.cls) pingAI(+m.d || 0, CLASSES.find(c => c.id === p.cls).nome); break;
      case 'qte': if (G.mode === 'play' && G.qte) G.qte.ok = true; break;
    }
  }
  function applyHits(from, m) {
    if (m.f) P.fuel = Math.max(0, P.fuel - m.f); if (m.pl) P.pull += clamp(+m.pl, -12, 12);
    for (const h of m.a || []) {
      const id = h[0], d = +h[1] || 0, pen = +h[2] || 1, fl = h[3] | 0;
      const src = { by: 'player', peer: from, head: !!(fl & 1), melee: !!(fl & 2), saw: !!(fl & 4), ads: !!(fl & 16), wid: h[4] || undefined };
      if (id < 0) { const part = G.boss && G.boss.parts && G.boss.parts[-id - 1]; if (part) BOSS.hitPart(part, d, pen, src); }
      else { const e = G.ents.find(x => x.id === id); if (!e || e.dead) continue; if (fl & 8) knock(e, src); if (d > 0) damageEnt(e, d, pen, src); }
      if (G.mode !== 'play') return;
    }
  }
  function catchUp(id) {   // jogador entrou com a partida já rolando
    const p = N.peers[id]; if (!p || !p.cls) return;
    if (G.mode === 'play' || G.mode === 'pause') {
      G.humanCls = humanCls(); G.ai = G.ai.filter(a => a.cls.id !== p.cls);
      if (G.role !== 'pilot' && !G.ai.length) { G.role = 'pilot'; say('Todos os lugares têm jogadores: você voltou ao volante!', 'sys', 4, true); UI.sync(); }
      sendTo(id, startMsg()); if (G.mode === 'pause') sendTo(id, { t: 'pause', on: 1 });
    } else if (G.mode === 'garage') sendTo(id, garageMsg());
    else if (G.mode === 'score' && N.lastScore) sendTo(id, N.lastScore);
    else if (G.mode === 'over' && N.lastOver) sendTo(id, N.lastOver);
  }
  function bye(id) {
    const p = N.peers[id]; if (!p) return; delete N.peers[id];
    if (p.cls && (G.mode === 'play' || G.mode === 'pause') && S) {
      const c = CLASSES.find(c => c.id === p.cls);
      if (c && c.id !== S.cls && !G.ai.some(a => a.cls.id === c.id)) G.ai.push({ cls: c, cd: 1, kills: 0, heads: 0, salva: 0, ab: 20, buff: 0 });
      say(p.name + (c ? ' (' + c.nome + ')' : '') + ' saiu da sala — a IA assumiu o lugar.', 'sys', 4);
    }
    G.humanCls = humanCls(); lobbyChanged();
  }
  function buildSnap() {
    if (!TY) { TY = Object.keys(ENEMY); BK = Object.keys(BOSSES); }
    const e = [];
    for (const x of G.ents) {
      if (x.dead) continue; const dz = x.z - P.z; if (dz < -70 || dz > 480) continue;
      const a = [x.id, TY.indexOf(x.type), r2(x.x), r2(x.z), x.st === 'latch' ? 1 : x.st === 'jump' ? 2 : 0, x.side || 0, x.flash > 0 ? 1 : 0];
      if (ENEMY[x.type].veh) a.push(r2(dz), x.cor || '');
      e.push(a);
    }
    const b = G.boss;
    const bs = b ? [BK.indexOf(b.key), r2(b.x), r2(b.rel), b.front ? 1 : 0, b.fase || 0, b.cable ? 1 : 0, b.chainOn ? 1 : 0, b.esc ? b.esc.filter(q => !q.dead).map(q => q.id) : 0,
      (b.parts || []).map(q => [q.ox, q.oy, q.w, q.h, Math.round(q.hp), Math.round(q.max), q.dead ? 1 : 0, q.vuln ? 1 : 0, q.flash > 0 ? 1 : 0, q.req ? 1 : 0, q.cor, q.ads ? 1 : 0, q.meleeOk ? 1 : 0])] : 0;
    const s = {
      t: 's',
      p: [r2(P.x), r2(P.z), r2(P.speed), r2(P.steer), r2(P.armor), G.V.armorMax, P.saws ? 1 : 0, r2(P.rpm), r2(P.fuel), r2(P.temp), P.over ? 1 : 0, P.lights, r2(P.jump)],
      g: [r2(G.prog), PH.indexOf(G.phase), CL.indexOf(G.clima), G.night ? 1 : 0, r2(G.blind / (G.role === 'pilot' ? 1 : 0.55)), r2(G.gas), r2(G.flash), r2(G.shake), r2(G.smokeIn), r2(G.saqueT), G.wave || 1, r2(G.waveT), r2(G.eventBar), r2(G.turboT), r2(G.portoLeft), CLASSES.findIndex(c => c.id === drv())],
      l: [r2(G.led.L), r2(G.led.R), r2(G.led.H)], e, b: bs,
      h: (G.haz || []).map(h => [r2(h.x), r2(h.z), h.r, h.kind === 'fogo' ? 0 : 1, h.delay, r2(h.t), h.done ? 1 : 0, h.life]),
      a: [S.ammo.leve, S.ammo.cartucho, S.ammo.fuzil, S.ammo.pesada],
      q: G.qte ? [G.qte.txt, r2(G.qte.t)] : 0, bn: G.banner ? [G.banner.a, G.banner.b, r2(G.banner.t)] : 0,
    };
    if (N.msgq.length) { s.m = N.msgq; N.msgq = []; }
    if (N.sfxq.length) { s.x = N.sfxq; N.sfxq = []; }
    if (N.gd) { s.d = r2(N.gd); N.gd = 0; }
    return s;
  }
  /* avisos que o host manda para todos */
  function hostSay(txt, who, dur) { if (N.host && N.msgq.length < 12) N.msgq.push([txt, who, dur]); }
  function hostGunnerDmg(n) { if (N.host) N.gd += n; }
  function stageStarted() { if (!N.host) return; for (const id in N.peers) if (N.peers[id].cls) sendTo(+id, startMsg()); }
  function beforeStage() {
    if (!N.host) return; G.humanCls = humanCls();
    if (S.stage === 0 && !G.arena && !(S.tot && S.tot.t) && S.mode === 'normal') S.ammo.leve = Math.max(S.ammo.leve, 18 * (1 + G.humanCls.length));   // 18 balas de revólver por jogador em Bauru
  }
  function hostScore(rows, extra) { if (!N.host) return; N.lastScore = Object.assign({}, extra, { t: 'score', rows }); bcast(N.lastScore); }
  function hostGarage() { if (N.host) bcast(garageMsg()); }
  function hostOver(why) { if (!N.host) return; N.lastOver = { t: 'over', why, arena: !!G.arena, wave: G.wave || 1, estrada: G.st ? G.st.estrada : '' }; bcast(N.lastOver); }
  function hostEnd() { if (N.host) bcast({ t: 'end', kills: S.tot.kills, min: Math.round(S.tot.t / 60) }); }
  function hostPause(on) { if (N.host) bcast({ t: 'pause', on: on ? 1 : 0 }); }
  function hostAch(id) { if (N.host) bcast({ t: 'ach', id }); }
  function peerRows() { return Object.values(N.peers).filter(p => p.cls).map(p => ({ cls: p.cls, nome: p.name, papel: 'Artilheiro', carne: '—', abalro: '—', abates: p.kills, heads: p.heads, amput: p.amput, vex: p.vex, salva: p.salva })); }
  function resetPeerStats() { for (const id in N.peers) Object.assign(N.peers[id], { kills: 0, heads: 0, amput: 0, vex: 0, salva: 0 }); }
  function peerStat(id, k) { const p = N.peers[id]; if (p) p[k]++; }

  /* ---------------- cliente ---------------- */
  function onClient(m) {
    switch (m.t) {
      case '_host': { const r = N.rooms.find(r => r.ip === m.ip); if (r) { r.name = m.name; r.t = performance.now(); } else { N.rooms.push({ ip: m.ip, name: m.name, t: performance.now() }); UI.netEvent('rooms'); } break; }
      case '_conn': N.connected = true; N.lastRx = performance.now(); send({ t: 'hello', name: META.nick || 'Jogador', proto: PROTO }); break;
      case '_fail': N.client = false; UI.netEvent('fail'); break;
      case '_bye': lost('A conexão com o Piloto caiu.'); break;
      case 'close': lost(m.why || 'O Piloto fechou a sala.'); break;
      case 'welcome': N.myId = m.id; N.lobby = m.lobby; UI.netEvent('welcome'); break;
      case 'lobby': N.lobby = m.lobby; UI.netEvent('lobby', m.err); break;
      case 'start': clientStart(m); break;
      case 'garage': N.garage = m; clientStop(); UI.netEvent('garage'); break;
      case 'score': clientStop(); UI.netEvent('score', m); break;
      case 'over': clientStop(); UI.netEvent('over', m); break;
      case 'end': clientStop(); S.tot = { kills: m.kills, t: m.min * 60 }; UI.netEvent('end', m); break;
      case 'pause': G.hostPaused = !!m.on; break;
      case 'ach': unlockAch(m.id); break;
    }
  }
  function pickCls(c) { N.myCls = c; send({ t: 'pick', cls: c }); }
  function clientStart(m) {
    if (!N.myCls) return;
    S = m.S; S.cls = N.myCls; G.arena = !!m.arena; G.wave = m.wave || 1; G.humanCls = []; G.role = 'gunner';
    N.emap = {}; G.hostPaused = false; UI.clientGo();
  }
  function clientStop() {   // fim de trecho: devolve ao grupo as balas que estavam no pente
    if (!G.netClient) return;
    if (A.mag) for (const k in A.mag) { if (A.mag[k] > 0 && WEAPONS[k]) send({ t: 'ammo', k: WEAPONS[k].ammo, n: -A.mag[k] }); A.mag[k] = 0; }
    flush(); G.netClient = false; if (G.mode === 'play') G.mode = 'wait';
    SFX.engine(0, 0, false); SFX.saw(false, 0); SFX.wind(0, false); SFX.music(null);
  }
  function lost(why) { const was = N.client; leave(true); loadMeta(); if (was) UI.netEvent('lost', why); }
  function hit(id, dmg, pen, src) {
    src = src || {};
    const fl = (src.head ? 1 : 0) | (src.melee ? 2 : 0) | (src.saw ? 4 : 0) | (src.knock ? 8 : 0) | (src.ads ? 16 : 0), w = src.wid || '', k = id + '|' + fl + '|' + w, q = N.hitq[k];
    if (q) { q[1] += dmg; q[2] = Math.max(q[2], pen); } else N.hitq[k] = [id, dmg, pen, fl, w];
  }
  function flush() {
    const a = []; for (const k in N.hitq) { const q = N.hitq[k]; q[1] = Math.round(q[1] * 10) / 10; a.push(q); } N.hitq = {};
    if (!a.length && N.fuelUse < 1e-5 && Math.abs(N.pullUse) < 0.01) return;
    send({ t: 'hits', a, f: Math.round(N.fuelUse * 1e5) / 1e5, pl: r2(N.pullUse) }); N.fuelUse = 0; N.pullUse = 0;
  }
  function deathFx(e) {
    if (!(e.vf >= G.frame - 2) || e.st === 'latch') return; const d = ENEMY[e.type]; if (!d || d.estatico) return;
    const x = e.sx, y = e.sy - (e.sh || 0) * 0.5;
    if (d.veh) fxBoom(x, y, (e.sh || 40) * 1.2, true); else { fxBlood(x, y, e.type === 'colosso' ? 30 : 8, e.type === 'boiadeiro' ? '#9ad13a' : null); if (e.type === 'boiadeiro') fxBoom(x, y, e.sh || 30, true); }
  }
  function applySnap(s) {
    if (!G.netClient || G.mode !== 'play') return;
    if (!TY) { TY = Object.keys(ENEMY); BK = Object.keys(BOSSES); }
    const p = s.p, g = s.g, first = !G.snapInit, tz = p[1] + p[2] * 0.04;
    if (first || Math.abs(tz - P.z) > 10) P.z = tz; else P.z += (tz - P.z) * 0.3;
    P.x = first ? p[0] : P.x + (p[0] - P.x) * 0.5;
    if (!first && p[4] < P.armor - 0.3) G.hurt = Math.min(1, (G.hurt || 0) + (P.armor - p[4]) * 0.03);
    P.speed = p[2]; P.steer = p[3]; P.armor = p[4]; G.V.armorMax = p[5]; P.saws = !!p[6]; P.rpm = p[7]; P.fuel = p[8]; P.temp = p[9]; P.over = !!p[10]; P.lights = p[11]; P.jump = p[12];
    G.prog = g[0]; G.phase = PH[g[1]] || 'road'; G.clima = CL[g[2]] || 'limpo'; G.night = !!g[3]; G.blind = g[4] * 0.55; G.gas = g[5]; G.flash = Math.max(G.flash, g[6]); G.shake = Math.max(G.shake, g[7]);
    G.smokeIn = g[8]; G.saqueT = g[9]; G.wave = g[10]; G.waveT = g[11]; G.eventBar = g[12]; G.turboT = g[13]; G.portoLeft = g[14]; G.drvCls = (CLASSES[g[15]] || {}).id || null;
    G.led.L = Math.max(G.led.L, s.l[0]); G.led.R = Math.max(G.led.R, s.l[1]); G.led.H = Math.max(G.led.H, s.l[2]);
    G.qte = s.q ? { txt: s.q[0], t: s.q[1], max: 3 } : null;
    if (s.a) { S.ammo.leve = s.a[0]; S.ammo.cartucho = s.a[1]; S.ammo.fuzil = s.a[2]; S.ammo.pesada = s.a[3]; }
    if (s.bn && (!G.banner || G.banner.a !== s.bn[0])) G.banner = { a: s.bn[0], b: s.bn[1], t: s.bn[2] };
    for (const mm of s.m || []) say(mm[0], mm[1], mm[2], true);
    for (const n of s.x || []) if (SFX[n]) SFX[n]();
    if (s.d) gunnerDmg(s.d);
    // entidades
    const seen = {}, ents = [];
    for (const a of s.e) {
      const id = a[0]; let e = N.emap[id];
      if (!e) e = N.emap[id] = { id, x: a[2], z: a[3], t: Math.random() * 3, hp: 1, vf: -1 };
      e.type = TY[a[1]]; e.side = a[5]; e.st = a[4] === 1 ? 'latch' : a[4] === 2 ? 'jump' : 'idle'; if (a[6]) e.flash = 0.08;
      if (a.length > 7) { e.rel = a[7]; e.cor = a[8] || undefined; e.isRel = true; e.x = first ? a[2] : e.x + (a[2] - e.x) * 0.5; e.z = P.z + e.rel; }
      else { e.isRel = false; e.x = a[2]; e.z = a[3]; }
      seen[id] = 1; ents.push(e);
    }
    for (const id in N.emap) if (!seen[id]) { deathFx(N.emap[id]); delete N.emap[id]; }
    G.ents = ents;
    // chefe
    if (s.b) {
      const a = s.b, key = BK[a[0]]; let b = G.boss;
      if (!b || b.key !== key) b = G.boss = { key, def: BOSSES[key], w: BOSSES[key].w, h: BOSSES[key].h, parts: [], t: 0, vf: -1, sx: 0, sy: 0, sh: 0, k: 1, x: a[1] };
      b.x += (a[1] - b.x) * 0.5; b.rel = a[2]; b.front = !!a[3]; b.fase = a[4]; b.cable = !!a[5]; b.chainOn = !!a[6]; b.esc = a[7] ? a[7].map(id => N.emap[id]).filter(Boolean) : null;
      const ps = a[8]; if (b.parts.length !== ps.length) b.parts = ps.map(() => ({ dead: true }));
      ps.forEach((q, i) => {
        const pt = b.parts[i], wasAlive = pt.dead === false;
        Object.assign(pt, { ox: q[0], oy: q[1], w: q[2], h: q[3], hp: q[4], max: q[5], dead: !!q[6], vuln: !!q[7], req: !!q[9], cor: q[10], ads: !!q[11], meleeOk: !!q[12] });
        if (q[8]) pt.flash = 0.08;
        if (wasAlive && pt.dead && b.vf >= G.frame - 2) fxBoom(b.sx + pt.ox * b.k, b.sy - (pt.oy + pt.h / 2) * b.k, 60, true);
      });
    } else G.boss = null;
    G.haz = (s.h || []).map(q => ({ x: q[0], z: q[1], r: q[2], kind: q[3] ? 'alvo' : 'fogo', delay: q[4], t: q[5], done: !!q[6], life: q[7] }));
    G.snapInit = true;
  }

  function silence() { return N.client && N.connected ? (performance.now() - N.lastRx) / 1000 : 0; }
  function count() { if (N.host) return 1 + humanCls().length; if (N.client && N.lobby) return 1 + N.lobby.players.filter(p => p.cls).length; return 1; }
  return {
    get host() { return N.host; }, get client() { return N.client; }, get connected() { return N.connected; }, get kind() { transport(); return N.kind; },
    get rooms() { return N.rooms; }, get lobbyInfo() { return N.lobby; }, get garageInfo() { return N.garage; }, get myCls() { return N.myCls; }, get peers() { return N.peers; },
    get fuelUse() { return N.fuelUse; }, set fuelUse(v) { N.fuelUse = v; }, get pullUse() { return N.pullUse; }, set pullUse(v) { N.pullUse = v; },
    available: () => !!transport(), myIp: () => (transport() ? tr.ip() : ''), count, lobby, silence,
    startHost, scan, join, leave, pump, tick, send, hit, flush, pickCls, takenBy, kick: (id) => { if (tr && N.host) { sendTo(id, { t: 'close', why: 'O Piloto removeu você da sala.' }); tr.kick(id); bye(id); } },
    hostSay, hostGunnerDmg, stageStarted, beforeStage, hostScore, hostGarage, hostOver, hostEnd, hostPause, hostAch, peerRows, resetPeerStats, peerStat,
  };
})();

/* Acertos do jogador local: aplicados direto (host / jogo solo) ou enviados ao host (cliente). */
const HIT = {
  ent(e, dmg, pen, src) { if (NET.client) { NET.hit(e.id, dmg, pen, src); e.flash = 0.08; return dmg; } return damageEnt(e, dmg, pen, src); },
  part(p, dmg, pen, src) { if (NET.client) { const i = G.boss ? G.boss.parts.indexOf(p) : -1; if (i >= 0) NET.hit(-(i + 1), dmg, pen, src); p.flash = 0.08; return; } BOSS.hitPart(p, dmg, pen, src); },
  aoe(x, z, r, dmg, skip) { if (NET.client) { NET.send({ t: 'aoe', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, d: Math.round(dmg) }); return; } aoe(x, z, r, dmg, skip); },
  knock(e, src) { if (NET.client) { NET.hit(e.id, 0, 0, Object.assign({ knock: true }, src)); return; } knock(e, src); },
};
