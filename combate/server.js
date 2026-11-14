'use strict';
// Combate (Stratego) - servidor para 2 jogadores na mesma rede Wi-Fi.
// Sem dependências: apenas Node.js 16+.  Uso: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const N = 10;
// 0 bandeira, 1 espião, 2 soldado, 3 cabo, 4 sargento, 5 tenente, 6 capitão,
// 7 major, 8 coronel, 9 general, 10 marechal, 11 bomba
const COUNTS = { 0: 1, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1, 11: 6 };
const rooms = new Map();

const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const lake = (r, c) => (r === 4 || r === 5) && (c === 2 || c === 3 || c === 6 || c === 7);
// jogador 0 joga embaixo (linhas 6-9), jogador 1 em cima. Cada um vê o tabuleiro
// girado para ficar sempre embaixo; flip converte entre absoluto e visão.
const flip = (p, r, c) => (p === 0 ? [r, c] : [N - 1 - r, N - 1 - c]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function mkPlayer() {
  return { token: crypto.randomBytes(12).toString('hex'), clients: new Set(), ready: false, rematch: false };
}
function resetGame(room) {
  room.board = null;
  room.setup = [null, null];
  room.turn = room.first;
  room.lost = [[], []];
  room.hist = [[], []];
  room.lastBattle = null;
  room.lastMove = null;
  room.winner = null;
  room.reason = null;
  room.nextId = 1;
  for (const p of room.players) if (p) { p.ready = false; p.rematch = false; }
}
function newRoom() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  const room = { code, players: [mkPlayer(), null], phase: 'waiting', first: 0, seq: 0, updated: Date.now() };
  resetGame(room);
  rooms.set(code, room);
  return room;
}

function validSetup(pl) {
  if (!Array.isArray(pl) || pl.length !== 40) return false;
  const seen = new Set(), cnt = {};
  for (const x of pl) {
    if (!x || !Number.isInteger(x.r) || !Number.isInteger(x.c) || !Number.isInteger(x.rank)) return false;
    if (x.r < 6 || x.r > 9 || x.c < 0 || x.c > 9 || !(x.rank in COUNTS)) return false;
    const k = x.r * 10 + x.c;
    if (seen.has(k)) return false;
    seen.add(k);
    cnt[x.rank] = (cnt[x.rank] || 0) + 1;
  }
  return Object.keys(COUNTS).every((k) => cnt[k] === COUNTS[k]);
}

function startGame(room) {
  room.board = Array.from({ length: N }, () => Array(N).fill(null));
  for (const p of [0, 1]) {
    for (const x of room.setup[p]) {
      room.board[x.r][x.c] = { id: room.nextId++, owner: p, rank: x.rank, known: false };
    }
  }
  room.phase = 'play';
  room.turn = room.first;
}

function violatesRepeat(room, pc, from, to) {
  const h = room.hist[pc.owner];
  if (h.length < 3) return false;
  const [a, b, c] = h.slice(-3);
  if (a.id !== pc.id || b.id !== pc.id || c.id !== pc.id) return false;
  return same(c.to, from) && same(c.from, to) && same(b.to, c.from) && same(b.from, c.to) &&
    same(a.to, b.from) && same(a.from, b.to);
}

function pieceMoves(room, r, c) {
  const pc = room.board[r][c];
  const out = [];
  if (!pc || pc.rank === 0 || pc.rank === 11) return out;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && !lake(rr, cc)) {
      const t = room.board[rr][cc];
      if (t) { if (t.owner !== pc.owner) out.push([rr, cc]); break; }
      out.push([rr, cc]);
      if (pc.rank !== 2) break; // só o soldado anda várias casas
      rr += dr; cc += dc;
    }
  }
  return out.filter(([a, b]) => !violatesRepeat(room, pc, [r, c], [a, b]));
}

function hasMoves(room, p) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const pc = room.board[r][c];
    if (pc && pc.owner === p && pieceMoves(room, r, c).length) return true;
  }
  return false;
}

function finish(room, winner, reason) {
  room.phase = 'over';
  room.winner = winner;
  room.reason = reason;
}

function doMove(room, p, from, to) {
  if (room.phase !== 'play') throw new Error('A partida não está em andamento');
  if (room.turn !== p) throw new Error('Não é a sua vez');
  const [fr, fc] = from, [tr, tc] = to;
  if (![fr, fc, tr, tc].every(Number.isInteger) || !inb(fr, fc) || !inb(tr, tc)) throw new Error('Movimento inválido');
  const att = room.board[fr][fc];
  if (!att || att.owner !== p) throw new Error('Peça inválida');
  if (!pieceMoves(room, fr, fc).some((m) => m[0] === tr && m[1] === tc)) {
    throw new Error('Movimento não permitido');
  }
  const def = room.board[tr][tc];
  room.lastMove = { from: [fr, fc], to: [tr, tc] };
  if (!def) {
    room.board[fr][fc] = null;
    room.board[tr][tc] = att;
    room.hist[p].push({ id: att.id, from: [fr, fc], to: [tr, tc] });
    if (room.hist[p].length > 6) room.hist[p].shift();
    if (Math.abs(fr - tr) + Math.abs(fc - tc) > 1) att.known = true; // soldado se revela
  } else {
    room.hist = [[], []];
    let result;
    if (def.rank === 0) result = 'att';
    else if (def.rank === 11) result = att.rank === 3 ? 'att' : 'def';
    else if (att.rank === 1 && def.rank === 10) result = 'att';
    else if (att.rank > def.rank) result = 'att';
    else if (att.rank === def.rank) result = 'both';
    else result = 'def';
    room.board[fr][fc] = null;
    if (result === 'att') {
      room.board[tr][tc] = att; att.known = true;
      room.lost[def.owner].push(def.rank);
    } else if (result === 'def') {
      def.known = true;
      room.lost[p].push(att.rank);
    } else {
      room.board[tr][tc] = null;
      room.lost[def.owner].push(def.rank);
      room.lost[p].push(att.rank);
    }
    room.lastBattle = { seq: ++room.seq, attacker: p, att: att.rank, def: def.rank, from: [fr, fc], to: [tr, tc], result };
    if (def.rank === 0) { finish(room, p, 'flag'); return; }
  }
  room.turn = 1 - p;
  if (!hasMoves(room, room.turn)) finish(room, p, 'nomoves');
}

function view(room, p) {
  const q = 1 - p, over = room.phase === 'over';
  const board = Array.from({ length: N }, () => Array(N).fill(null));
  const put = (r, c, cell) => { const [vr, vc] = flip(p, r, c); board[vr][vc] = cell; };
  if (room.board) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const pc = room.board[r][c];
      if (!pc) continue;
      const mine = pc.owner === p;
      if (mine || pc.known || over) put(r, c, { o: mine ? 1 : 0, r: pc.rank, k: pc.known ? 1 : 0 });
      else put(r, c, { o: 0 });
    }
  } else if (room.setup[p]) {
    for (const x of room.setup[p]) put(x.r, x.c, { o: 1, r: x.rank, k: 0 });
  }
  let moves = null;
  if (room.phase === 'play' && room.turn === p) {
    moves = {};
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const pc = room.board[r][c];
      if (!pc || pc.owner !== p) continue;
      const m = pieceMoves(room, r, c);
      if (m.length) {
        const [vr, vc] = flip(p, r, c);
        moves[vr + ',' + vc] = m.map(([a, b]) => flip(p, a, b));
      }
    }
  }
  const lb = room.lastBattle;
  const opp = room.players[q];
  return {
    code: room.code, you: p, phase: room.phase, turn: room.turn,
    meReady: room.players[p].ready,
    opp: { joined: !!opp, connected: !!opp && opp.clients.size > 0, ready: !!opp && opp.ready },
    board, moves, lost: room.lost, winner: room.winner, reason: room.reason,
    lastMove: room.lastMove && { from: flip(p, ...room.lastMove.from), to: flip(p, ...room.lastMove.to) },
    lastBattle: lb && {
      seq: lb.seq, mine: lb.attacker === p, att: lb.att, def: lb.def, result: lb.result,
      from: flip(p, ...lb.from), to: flip(p, ...lb.to),
    },
    rematch: { me: room.players[p].rematch, opp: !!opp && opp.rematch },
  };
}

function broadcast(room) {
  room.updated = Date.now();
  room.players.forEach((pl, i) => {
    if (!pl) return;
    const data = 'event: state\ndata: ' + JSON.stringify(view(room, i)) + '\n\n';
    for (const res of pl.clients) res.write(data);
  });
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 20000) { reject(new Error('grande demais')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}
function auth(code, token) {
  const room = rooms.get(String(code));
  if (!room) return null;
  const p = room.players.findIndex((x) => x && x.token === token);
  return p < 0 ? null : { room, p };
}
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  }
  return out;
}

const actions = {
  create() {
    const room = newRoom();
    return { code: room.code, token: room.players[0].token };
  },
  join({ code }) {
    const room = rooms.get(String(code));
    if (!room) throw Object.assign(new Error('Sala não encontrada'), { status: 404 });
    if (room.players[1]) throw Object.assign(new Error('Esta sala já está cheia'), { status: 409 });
    room.players[1] = mkPlayer();
    room.phase = 'setup';
    broadcast(room);
    return { code: room.code, token: room.players[1].token };
  },
  ready({ room, p, placement }) {
    if (room.phase !== 'setup') throw new Error('Fase inválida');
    if (!validSetup(placement)) throw new Error('Posicionamento inválido');
    room.setup[p] = placement.map((x) => { const [r, c] = flip(p, x.r, x.c); return { r, c, rank: x.rank }; });
    room.players[p].ready = true;
    if (room.players[0].ready && room.players[1] && room.players[1].ready) startGame(room);
    broadcast(room);
    return {};
  },
  move({ room, p, from, to }) {
    const [f, t] = [flip(p, ...(from || [])), flip(p, ...(to || []))];
    doMove(room, p, f, t);
    broadcast(room);
    return {};
  },
  resign({ room, p }) {
    if (room.phase !== 'play') throw new Error('Nada para desistir');
    finish(room, 1 - p, 'resign');
    broadcast(room);
    return {};
  },
  rematch({ room, p }) {
    if (room.phase !== 'over') throw new Error('Fase inválida');
    room.players[p].rematch = true;
    if (room.players[0].rematch && room.players[1] && room.players[1].rematch) {
      room.first = 1 - room.first;
      resetGame(room);
      room.phase = 'setup';
    }
    broadcast(room);
    return {};
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const a = auth(url.searchParams.get('code'), url.searchParams.get('token'));
      if (!a) return json(res, 404, { error: 'Sessão inválida' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1500\n\n');
      const pl = a.room.players[a.p];
      pl.clients.add(res);
      res.write('event: state\ndata: ' + JSON.stringify(view(a.room, a.p)) + '\n\n');
      broadcast(a.room);
      req.on('close', () => { pl.clients.delete(res); broadcast(a.room); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/check') {
      return auth(url.searchParams.get('code'), url.searchParams.get('token')) ? json(res, 200, {}) : json(res, 404, {});
    }
    if (req.method === 'GET' && url.pathname === '/api/info') return json(res, 200, { urls: lanUrls() });
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5);
      const b = await body(req);
      if (!actions[name]) return json(res, 404, { error: 'Ação desconhecida' });
      if (name === 'create' || name === 'join') return json(res, 200, actions[name](b));
      const a = auth(b.code, b.token);
      if (!a) return json(res, 403, { error: 'Sessão inválida' });
      return json(res, 200, actions[name]({ ...b, room: a.room, p: a.p }));
    }
    if (req.method === 'GET') {
      let f = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = path.normalize(path.join(PUB, f));
      if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
      return fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Não encontrado'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    }
    res.writeHead(405); res.end();
  } catch (e) {
    json(res, e.status || 400, { error: e.message || 'Erro' });
  }
});

setInterval(() => {
  for (const room of rooms.values()) for (const pl of room.players) if (pl) for (const r of pl.clients) r.write(': ping\n\n');
}, 20000);
setInterval(() => {
  for (const [code, room] of rooms) if (Date.now() - room.updated > 4 * 3600 * 1000) rooms.delete(code);
}, 600000);

module.exports = { server, PORT };
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  COMBATE - servidor rodando!\n');
    console.log('  Nos dois celulares (mesma rede Wi-Fi), abra no navegador:');
    const urls = lanUrls();
    (urls.length ? urls : [`http://localhost:${PORT}`]).forEach((u) => console.log('    ' + u));
    console.log('');
  });
}
