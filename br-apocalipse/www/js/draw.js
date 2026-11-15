'use strict';
/* Sprites procedurais. Todas as funções desenham em METROS, com os pés em (0,0) e y para cima negativo. */
const DRAW = (() => {
  const R = (c, x, y, w, h, cor) => { c.fillStyle = cor; c.fillRect(x, y, w, h); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function zombie(c, e, t, simple) {
    const d = ENEMY[e.type], h = d.h, w = d.w, ph = (e.id * 1.7 + t * (e.type === 'corredor' ? 14 : 5));
    if (simple) { R(c, -w / 2, -h, w, h, d.roupa || d.cor); if (d.fogo) R(c, -w / 2, -h * 1.15, w, h * 0.3, '#ff8a1a'); return; }
    const sw = Math.sin(ph) * 0.12;
    switch (e.type) {
      case 'boiadeiro': {
        R(c, -0.3, -0.7, 0.22, 0.7, '#3a3320'); R(c, 0.08, -0.7, 0.22, 0.7, '#3a3320');
        c.fillStyle = d.cor; c.beginPath(); c.ellipse(0, -1.1, 0.68 + Math.sin(t * 3 + e.id) * 0.03, 0.62, 0, 0, 7); c.fill();
        c.fillStyle = '#8fd13a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-0.4 + hash(e.id + i) * 0.8, -1.4 + hash(e.id * 3 + i) * 0.6, 0.09, 0, 7); c.fill(); }
        R(c, -0.75, -1.35, 0.2, 0.5, d.cor); R(c, 0.55, -1.35, 0.2, 0.5, d.cor);
        R(c, -0.17, -1.9, 0.34, 0.3, '#a8a060'); R(c, -0.3, -1.98, 0.6, 0.08, '#4a3a1a'); R(c, -0.18, -2.1, 0.36, 0.14, '#4a3a1a');
        break; }
      case 'colosso': {
        R(c, -0.6, -1.2, 0.45, 1.2, '#2e2e2e'); R(c, 0.15, -1.2, 0.45, 1.2, '#2e2e2e');
        R(c, -0.95, -2.6, 1.9, 1.5, d.cor); R(c, -0.8, -2.5, 1.6, 0.25, '#8a7a6a');
        R(c, -1.35, -2.7 + sw, 0.42, 1.5, d.cor); R(c, 0.93, -2.7 - sw, 0.42, 1.5, d.cor);
        R(c, -0.3, -3.1, 0.6, 0.5, '#6a5a4a'); R(c, -0.2, -2.95, 0.12, 0.08, '#e22'); R(c, 0.08, -2.95, 0.12, 0.08, '#e22');
        R(c, -1.5, -3.6 + sw, 1.1, 0.8, '#7d7d78'); R(c, -1.4, -3.5 + sw, 0.3, 0.2, '#5a5a56');
        break; }
      case 'carrapato': {
        R(c, -0.3, -0.5, 0.2, 0.5, d.roupa); R(c, 0.1, -0.5, 0.2, 0.5, d.roupa);
        R(c, -0.3, -1.0, 0.6, 0.55, d.cor); R(c, -0.65, -1.0, 0.3, 0.14, d.cor); R(c, 0.35, -1.0, 0.3, 0.14, d.cor);
        R(c, -0.75, -1.0, 0.12, 0.6, d.cor); R(c, 0.63, -1.0, 0.12, 0.6, d.cor);
        R(c, -0.17, -1.3, 0.34, 0.3, '#aab08a'); R(c, -0.1, -1.2, 0.2, 0.12, '#400');
        break; }
      default: {
        const lean = e.type === 'corredor' || e.type === 'cangaceiro' ? 0.12 : 0;
        R(c, -0.24, -0.85, 0.2, 0.85 + sw * 0.5, d.roupa); R(c, 0.04, -0.85, 0.2, 0.85 - sw * 0.5, d.roupa);
        R(c, -0.28 + lean, -1.48, 0.56, 0.66, e.type === 'andarilho' ? ['#4a4f58', '#6a4a3a', '#3a5a4a', '#5a5a6a'][e.id % 4] : d.roupa);
        R(c, -0.42 + lean, -1.45, 0.14, 0.2, d.cor); R(c, 0.28 + lean, -1.45, 0.14, 0.2, d.cor);
        R(c, -0.42 + lean * 2, -1.42, 0.5, 0.12, d.cor); R(c, 0.0 + lean * 2, -1.38 + sw * 0.3, 0.5, 0.12, d.cor);
        R(c, -0.15 + lean * 1.5, -1.76, 0.3, 0.28, d.cor); R(c, -0.08 + lean * 1.5, -1.62, 0.16, 0.07, '#4a0a0a');
        if (e.type === 'encouracado') {
          R(c, -0.3, -1.5, 0.6, 0.6, '#11161c'); R(c, -0.19, -1.84, 0.38, 0.3, '#0d1116'); R(c, -0.15, -1.72, 0.3, 0.1, '#5a7a8a');
          R(c, -0.55, -1.5, 0.4, 1.05, '#1a2026'); R(c, -0.5, -1.2, 0.3, 0.12, '#cfd3d6');
        } else if (e.type === 'cangaceiro') {
          c.strokeStyle = '#efe6c8'; c.lineWidth = 0.05; c.beginPath();
          for (let i = 0; i < 7; i++) { const a = hash(e.id + i) * 6.28, r = 0.25 + hash(e.id * 2 + i) * 0.3; c.moveTo(Math.cos(a) * 0.2, -1.2 + Math.sin(a) * 0.3); c.lineTo(Math.cos(a) * (0.2 + r), -1.2 + Math.sin(a) * (0.3 + r)); }
          c.stroke(); R(c, -0.3, -1.84, 0.6, 0.07, '#5a3a1a'); R(c, -0.16, -1.95, 0.32, 0.12, '#5a3a1a');
        } else if (e.type === 'engolidor') {
          c.fillStyle = `rgba(255,${120 + Math.sin(t * 20 + e.id) * 60 | 0},20,0.85)`;
          c.beginPath(); c.moveTo(-0.4, -1.3); c.lineTo(-0.15, -2.2 - Math.sin(t * 17 + e.id) * 0.2); c.lineTo(0, -1.8); c.lineTo(0.2, -2.35 - Math.cos(t * 13 + e.id) * 0.2); c.lineTo(0.42, -1.3); c.fill();
          R(c, -0.2, -1.2, 0.1, 0.1, '#ff6a00'); R(c, 0.1, -0.9, 0.1, 0.1, '#ff6a00');
        } else if (e.type === 'boi') {
          /* handled elsewhere */
        }
      }
    }
  }

  function boi(c, e, t) {
    R(c, -0.6, -1.45, 1.2, 0.9, '#4a3a2e'); R(c, -0.5, -0.6, 0.2, 0.6, '#3a2c22'); R(c, 0.3, -0.6, 0.2, 0.6, '#3a2c22');
    R(c, -0.3, -1.7, 0.6, 0.5, '#5a4636'); R(c, -0.55, -1.8, 0.25, 0.08, '#e8e0c8'); R(c, 0.3, -1.8, 0.25, 0.08, '#e8e0c8');
    R(c, -0.2, -1.55, 0.1, 0.08, '#e22'); R(c, 0.1, -1.55, 0.1, 0.08, '#e22');
  }

  /* veículo inimigo; front=true quando visto de frente (retrovisor / vindo na contramão) */
  function vehicle(c, e, t, front) {
    const d = ENEMY[e.type], w = d.w, h = d.h, cor = e.cor || d.cor;
    if (e.type === 'moto') {
      R(c, -0.12, -0.7, 0.24, 0.7, '#111'); R(c, -0.3, -1.0, 0.6, 0.35, cor); R(c, -0.26, -1.55, 0.52, 0.6, '#3a2a1a');
      R(c, -0.16, -1.85, 0.32, 0.3, '#222'); R(c, front ? -0.1 : -0.08, -0.95, 0.2, 0.1, front ? '#ffd' : '#e22');
      R(c, e.side > 0 ? -0.75 : 0.3, -1.45, 0.45, 0.1, '#3a2a1a'); R(c, e.side > 0 ? -1.2 : 0.7, -1.5, 0.5, 0.16, '#c33');
      return;
    }
    if (e.type === 'carcaca') {
      R(c, -w / 2, -0.9, w, 0.7, cor); R(c, -w / 2 + 0.25, -1.4, w - 0.5, 0.55, '#3a322c'); R(c, -w / 2 + 0.4, -1.3, w - 0.8, 0.35, '#1a1a1a');
      R(c, -w / 2, -0.25, 0.4, 0.25, '#111'); R(c, w / 2 - 0.4, -0.25, 0.4, 0.25, '#111'); R(c, -0.3, -1.0, 0.5, 0.2, '#6a2a1a');
      return;
    }
    if (e.type === 'pregos') { R(c, -w / 2, -0.08, w, 0.08, '#555'); c.fillStyle = '#ccc'; for (let x = -w / 2; x < w / 2; x += 0.25) { c.beginPath(); c.moveTo(x, -0.08); c.lineTo(x + 0.08, -0.3); c.lineTo(x + 0.16, -0.08); c.fill(); } return; }
    if (e.type === 'sobrevivente') {
      R(c, -1.5, -2.5, 3, 0.15, '#7a7a7a'); R(c, -1.4, -2.4, 0.12, 2.4, '#666'); R(c, 1.3, -2.4, 0.12, 2.4, '#666');
      R(c, -0.2, -3.35, 0.4, 0.85, '#2a5a9a'); R(c, -0.14, -3.65, 0.28, 0.28, '#d9a070'); R(c, 0.2, -3.6 - Math.abs(Math.sin(t * 6)) * 0.3, 0.1, 0.5, '#d9a070');
      c.fillStyle = `rgba(255,40,40,${0.6 + Math.sin(t * 9) * 0.4})`; c.beginPath(); c.arc(0.25, -4.1, 0.35, 0, 7); c.fill();
      return;
    }
    if (e.type === 'bau') {
      c.save(); c.rotate(-0.25); R(c, -w / 2, -h, w, h * 0.8, cor); R(c, -w / 2 + 0.2, -h + 0.3, w - 0.4, 0.5, '#2a3320'); c.restore();
      R(c, -0.5, -0.9, 1.0, 0.9, '#5a5a3a'); R(c, -0.4, -0.8, 0.8, 0.15, '#e8c020'); return;
    }
    const wh = h * 0.2;
    R(c, -w / 2, -wh, w * 0.22, wh, '#0a0a0a'); R(c, w / 2 - w * 0.22, -wh, w * 0.22, wh, '#0a0a0a');
    R(c, -w / 2, -h * 0.62, w, h * 0.5, cor);
    R(c, -w / 2 + w * 0.1, -h, w * 0.8, h * 0.42, cor); R(c, -w / 2 + w * 0.16, -h * 0.94, w * 0.68, h * 0.28, front ? '#1a2a33' : '#12181c');
    const lc = front ? '#fff6c0' : '#e01818';
    R(c, -w / 2 + 0.06, -h * 0.55, w * 0.16, h * 0.1, lc); R(c, w / 2 - 0.06 - w * 0.16, -h * 0.55, w * 0.16, h * 0.1, lc);
    if (e.type === 'pickup') { R(c, -w / 2 - 0.05, -h * 0.3, w + 0.1, h * 0.1, '#2a2a2a'); R(c, -0.25, -h - 0.45, 0.5, 0.5, '#3a2a1a'); R(c, -0.12, -h - 0.7, 0.24, 0.24, '#c9a070'); R(c, -0.05, -h - 0.35, 0.9, 0.08, '#111'); }
    if (e.type === 'blindado') { R(c, -w / 2, -h, w, h * 0.5, '#2a302a'); R(c, -0.5, -h * 0.9, 1.0, 0.15, '#0a0a0a'); R(c, -0.3, -h - 0.4, 0.6, 0.4, '#2a302a'); R(c, -0.05, -h - 0.3, 1.1, 0.1, '#111'); }
    if (e.type === 'buggy') { c.strokeStyle = '#111'; c.lineWidth = 0.08; c.strokeRect(-w / 2 + 0.2, -h - 0.2, w - 0.4, 0.6); R(c, -0.3, -h * 0.75, 0.6, 0.3, '#e02a1a'); }
    if (e.type === 'carrobomba') { R(c, -0.5, -h - 0.35, 1.0, 0.35, '#c22'); c.fillStyle = Math.sin(t * 20) > 0 ? '#ff3' : '#a00'; c.beginPath(); c.arc(0, -h - 0.5, 0.14, 0, 7); c.fill(); }
  }

  /* carro dos jogadores visto por trás (3ª pessoa) */
  function playerCar(c, veh, up, steer, saws, t) {
    const v = VEHICLES[veh], w = v.w * 2, tall = [0, 1.45, 1.5, 1.85, 2.5, 3.2][veh], wh = 0.36 + veh * 0.05;
    c.save(); c.rotate(steer * 0.04);
    R(c, -w / 2 - 0.02, -wh, 0.34, wh, '#0a0a0a'); R(c, w / 2 - 0.32, -wh, 0.34, wh, '#0a0a0a');
    if (up.pneu >= 2) { R(c, -w / 2 - 0.2, -wh * 0.6, 0.2, 0.08, '#bbb'); R(c, w / 2, -wh * 0.6, 0.2, 0.08, '#bbb'); }
    R(c, -w / 2, -tall * 0.62, w, tall * 0.5, v.cor);
    if (veh === 3) { R(c, -w / 2, -tall * 0.75, w, tall * 0.2, v.cor); R(c, -w / 2 + 0.25, -tall, w - 0.5, tall * 0.3, '#3a3f44'); R(c, -w / 2 + 0.1, -tall - 0.3, 0.1, 0.6, '#222'); R(c, w / 2 - 0.2, -tall - 0.3, 0.1, 0.6, '#222'); R(c, -w / 2 + 0.1, -tall - 0.3, w - 0.2, 0.08, '#222'); }
    else { R(c, -w / 2 + 0.1, -tall, w - 0.2, tall * 0.45, v.cor); R(c, -w / 2 + 0.25, -tall * 0.95, w - 0.5, tall * 0.28, up.janela >= 2 ? '#3a3a36' : '#141c22'); }
    if (up.janela === 1) { c.strokeStyle = '#888'; c.lineWidth = 0.02; for (let x = -w / 2 + 0.3; x < w / 2 - 0.25; x += 0.12) { c.beginPath(); c.moveTo(x, -tall * 0.95); c.lineTo(x, -tall * 0.67); c.stroke(); } }
    if (up.janela >= 2) R(c, -w / 2 + 0.4, -tall * 0.84, w - 0.8, 0.07, '#0a0a0a');
    R(c, -w / 2 + 0.08, -tall * 0.55, 0.3, 0.14, '#e01818'); R(c, w / 2 - 0.38, -tall * 0.55, 0.3, 0.14, '#e01818');
    R(c, -0.3, -tall * 0.34, 0.6, 0.16, '#e8e4d0');
    if (veh === 1) { R(c, -w / 2 + 0.05, -tall - 0.14, w - 0.1, 0.06, '#c8a020'); R(c, -w / 2 + 0.05, -tall - 0.28, w - 0.1, 0.06, '#c8a020'); for (let x = -w / 2 + 0.2; x < w / 2; x += 0.3) R(c, x, -tall - 0.28, 0.05, 0.2, '#c8a020'); }
    if (veh === 2) { R(c, -0.45, -tall - 0.12, 0.4, 0.12, '#e22'); R(c, 0.05, -tall - 0.12, 0.4, 0.12, '#22e'); }
    if (veh >= 4) { R(c, -0.4, -tall - 0.4, 0.8, 0.4, '#2a2f2a'); R(c, -0.06, -tall - 0.6, 0.12, 0.5, '#111'); }
    if (up.lateral >= 1) { R(c, -w / 2 - 0.08, -tall * 0.45, 0.08, 0.12, '#555'); R(c, w / 2, -tall * 0.45, 0.08, 0.12, '#555'); }
    if (up.lateral >= 2) { const j = saws ? Math.sin(t * 90) * 0.03 : 0; R(c, -w / 2 - 0.5 + j, -tall * 0.4, 0.5, 0.1, '#c33'); R(c, w / 2 - j, -tall * 0.4, 0.5, 0.1, '#c33'); }
    c.restore();
  }

  /* cenário de beira de estrada */
  function scenery(c, type, seed, t, st) {
    const r = hash(seed), r2 = hash(seed * 1.7 + 3);
    switch (type) {
      case 'arvore': { const h = 5 + r * 4; R(c, -0.25, -h * 0.5, 0.5, h * 0.5, '#3a2a1a'); c.fillStyle = r2 > 0.5 ? '#2f5a2a' : '#3a6a2f'; c.beginPath(); c.arc(0, -h * 0.72, h * 0.34, 0, 7); c.arc(-h * 0.2, -h * 0.55, h * 0.24, 0, 7); c.arc(h * 0.2, -h * 0.55, h * 0.24, 0, 7); c.fill(); break; }
      case 'cerrado': { const h = 3 + r * 2.5; c.strokeStyle = '#4a3a22'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.8, -h * 0.4, -0.3, -h * 0.7); c.moveTo(0.2, -h * 0.4); c.lineTo(1.2, -h * 0.75); c.stroke(); c.fillStyle = '#6a7a2f'; c.beginPath(); c.ellipse(-0.3, -h * 0.8, 1.6, 0.7, 0, 0, 7); c.ellipse(1.3, -h * 0.82, 1.1, 0.5, 0, 0, 7); c.fill(); break; }
      case 'cana': { const h = 3.2 + r; R(c, -5, -h, 10, h, '#3f6a24'); R(c, -5, -h - 0.3, 10, 0.5, '#5a8a30'); c.fillStyle = '#2f5a1c'; for (let i = 0; i < 8; i++) c.fillRect(-5 + i * 1.25, -h, 0.2, h); break; }
      case 'canafogo': { const h = 3.2 + r; R(c, -5, -h, 10, h, '#2a1c10'); for (let i = 0; i < 6; i++) { const fx = -4.5 + i * 1.8, fh = 2.5 + Math.sin(t * 9 + seed + i * 2) * 1.2 + r2 * 2; c.fillStyle = i % 2 ? '#ff7a10' : '#ffb020'; c.beginPath(); c.moveTo(fx - 0.9, -h + 0.5); c.quadraticCurveTo(fx - 0.3, -h - fh * 0.5, fx, -h - fh); c.quadraticCurveTo(fx + 0.4, -h - fh * 0.4, fx + 0.9, -h + 0.5); c.fill(); } break; }
      case 'poste': { R(c, -0.12, -8, 0.24, 8, '#4a4038'); R(c, -1.2, -7.6, 2.4, 0.15, '#4a4038'); break; }
      case 'cerca': { R(c, -4, -1.1, 8, 0.06, '#5a4a3a'); R(c, -4, -0.6, 8, 0.06, '#5a4a3a'); for (let i = -4; i <= 4; i += 2) R(c, i - 0.07, -1.3, 0.14, 1.3, '#4a3a2a'); break; }
      case 'pasto': { c.fillStyle = '#4a3a2e'; c.fillRect(-1, -1.3, 1.6, 0.8); c.fillRect(-1.3, -1.6, 0.5, 0.5); c.fillRect(-0.9, -0.5, 0.15, 0.5); c.fillRect(0.4, -0.5, 0.15, 0.5); break; }
      case 'carreta': { c.save(); c.rotate(r > 0.5 ? -0.12 : 0.1); R(c, -5, -2.9, 10, 2.6, ['#8a2a1a', '#2a4a6a', '#6a6a5a'][seed % 3 | 0] || '#6a6a5a'); R(c, -5, -3.0, 10, 0.15, '#333'); R(c, -4, -0.5, 1, 0.5, '#111'); R(c, 2, -0.5, 1, 0.5, '#111'); c.restore(); break; }
      case 'posto': { R(c, -7, -5.5, 14, 0.7, '#c22a1a'); R(c, -7, -4.9, 14, 0.2, '#e8e0c0'); R(c, -6, -4.8, 0.4, 4.8, '#888'); R(c, 5.6, -4.8, 0.4, 4.8, '#888'); R(c, -2, -1.8, 0.8, 1.8, '#aa3'); R(c, 1.2, -1.8, 0.8, 1.8, '#aa3'); break; }
      case 'predio': { const h = 8 + r * 14, w = 7 + r2 * 5; R(c, -w / 2, -h, w, h, '#4a4a48'); c.fillStyle = '#1e2226'; for (let y = 1.5; y < h - 1; y += 2.4) for (let x = -w / 2 + 0.8; x < w / 2 - 1; x += 1.9) c.fillRect(x, -y - 1.2, 1.1, 1.2); break; }
      case 'ministerio': { R(c, -6, -22, 12, 22, '#b8b8a8'); c.fillStyle = '#3a4a4a'; for (let y = 1; y < 21; y += 2) c.fillRect(-5.5, -y - 1.2, 11, 1.1); break; }
      case 'soja': { R(c, -6, -0.6, 12, 0.6, '#6a8a2a'); break; }
      case 'algodao': { R(c, -6, -0.8, 12, 0.8, '#7a7a4a'); c.fillStyle = '#eee'; for (let i = 0; i < 12; i++) c.fillRect(-6 + i, -0.9 - hash(seed + i) * 0.2, 0.3, 0.3); break; }
      case 'silo': { R(c, -2.5, -9, 5, 9, '#b8bcc0'); c.fillStyle = '#9a9ea2'; c.beginPath(); c.moveTo(-2.7, -9); c.lineTo(0, -11); c.lineTo(2.7, -9); c.fill(); R(c, -2.5, -6, 5, 0.1, '#888'); R(c, -2.5, -3, 5, 0.1, '#888'); break; }
      case 'pedra': { const s = 1.5 + r * 3; c.fillStyle = '#8a7458'; c.beginPath(); c.moveTo(-s, 0); c.lineTo(-s * 0.6, -s * 0.9); c.lineTo(s * 0.2, -s * 1.1); c.lineTo(s, -s * 0.4); c.lineTo(s * 1.1, 0); c.fill(); break; }
      case 'mandacaru': { const h = 3 + r * 2; R(c, -0.25, -h, 0.5, h, '#3f7a3a'); R(c, -1.0, -h * 0.6, 0.8, 0.3, '#3f7a3a'); R(c, -1.0, -h * 0.9, 0.3, h * 0.33, '#3f7a3a'); R(c, 0.25, -h * 0.5, 0.8, 0.3, '#3f7a3a'); R(c, 0.8, -h * 0.8, 0.3, h * 0.33, '#3f7a3a'); break; }
      case 'xique': { c.fillStyle = '#7a8a4a'; for (let i = 0; i < 5; i++) c.fillRect(-1 + i * 0.5, -0.8 - hash(seed + i) * 0.9, 0.22, 0.8 + hash(seed + i) * 0.9); break; }
      case 'coqueiro': { const h = 7 + r * 3; c.strokeStyle = '#6a5a3a'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.9, -h * 0.5, 0.3, -h); c.stroke(); c.strokeStyle = '#2f7a3a'; c.lineWidth = 0.3; for (let i = 0; i < 6; i++) { const a = -Math.PI + i * 0.63 + Math.sin(t + seed) * 0.05; c.beginPath(); c.moveTo(0.3, -h); c.quadraticCurveTo(0.3 + Math.cos(a) * 1.6, -h + Math.sin(a) * 1.6 - 0.8, 0.3 + Math.cos(a) * 3, -h + Math.sin(a) * 2 + 0.6); c.stroke(); } break; }
      case 'placa': { R(c, -0.1, -4.2, 0.2, 4.2, '#777'); R(c, 3.9, -4.2, 0.2, 4.2, '#777'); R(c, -0.3, -4.6, 4.6, 1.9, '#0c6a3a'); c.strokeStyle = '#fff'; c.lineWidth = 0.06; c.strokeRect(-0.2, -4.5, 4.4, 1.7);
        c.save(); c.scale(0.02, 0.02); c.fillStyle = '#fff'; c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.fillText(st.txt1, 100, -185); c.font = 'bold 34px Arial'; c.fillText(st.txt2, 100, -148); c.restore(); break; }
      case 'radar': { R(c, -0.08, -3.5, 0.16, 3.5, '#888'); R(c, -0.35, -4.1, 0.7, 0.6, '#ddd'); R(c, -0.15, -3.95, 0.3, 0.3, '#111'); break; }
      case 'guarda': { R(c, -4, -1.1, 8, 0.35, '#b8b8b0'); for (let i = -4; i <= 4; i += 2) R(c, i - 0.1, -1.1, 0.2, 1.1, '#777'); break; }
      case 'penhasco': { R(c, -6, -14, 12, 14, '#7a5a3a'); c.fillStyle = '#6a4c30'; for (let i = 0; i < 6; i++) c.fillRect(-6 + i * 2, -14 + hash(seed + i) * 5, 1, 9); break; }
      case 'pedagio': { R(c, -1, -6.5, 2, 6.5, '#555'); R(c, -1, -7.5, 30, 1.2, '#3a3a3a'); R(c, 2, -7.3, 10, 0.8, '#c22'); break; }
    }
  }

  /* marcos no horizonte (pixels) */
  function marco(c, tipo, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (tipo === 'congresso') { c.fillStyle = '#1a1420'; c.fillRect(-9, -60, 7, 60); c.fillRect(2, -60, 7, 60); c.fillRect(-2, -34, 4, 4); c.fillRect(-70, -8, 140, 8); c.beginPath(); c.arc(-38, -8, 16, Math.PI, 0); c.fill(); c.beginPath(); c.arc(40, -24, 18, 0, Math.PI); c.fill(); }
    else if (tipo === 'padre') { c.fillStyle = '#0d1016'; c.beginPath(); c.moveTo(-90, 0); c.quadraticCurveTo(0, -50, 90, 0); c.fill(); c.fillStyle = '#c8c8c0'; c.fillRect(-5, -92, 10, 55); c.fillRect(-4, -100, 8, 9); c.fillRect(-9, -103, 18, 3); c.fillRect(-8, -40, 16, 8); c.fillRect(4, -80, 3, 40); }
    else if (tipo === 'navio') { c.fillStyle = '#2a4a6a'; c.fillRect(-400, -4, 800, 6); c.fillStyle = '#3a3f44'; c.beginPath(); c.moveTo(-60, -4); c.lineTo(-50, -18); c.lineTo(50, -18); c.lineTo(66, -4); c.fill(); c.fillRect(10, -34, 22, 16); c.fillRect(18, -44, 5, 10); c.fillStyle = '#c22'; c.fillRect(-58, -8, 122, 3); }
    c.restore();
  }

  /* mãos + arma em 1ª pessoa (pixels). px,py = ponto para onde a arma aponta */
  function hands(c, W, H, cls, kind, px, py, opt) {
    const bx = W * 0.5 + (px - W * 0.5) * 0.35, by = H * 1.02, kick = opt.kick || 0, ads = opt.ads || 0;
    const tx = bx + (px - bx) * (0.45 + ads * 0.2), ty = by + (py - by) * (0.42 + ads * 0.18) + kick * 14;
    const ang = Math.atan2(py - by, px - bx) + Math.PI / 2;
    const arm = (x0, x1, y1) => { c.strokeStyle = cls.sleeve; c.lineWidth = H * 0.085; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, H * 1.08); c.lineTo(x1, y1 + H * 0.08); c.stroke(); c.strokeStyle = cls.skin; c.lineWidth = H * 0.06; c.beginPath(); c.moveTo(x1, y1 + H * 0.08); c.lineTo(x1, y1 + H * 0.02); c.stroke(); c.fillStyle = cls.glove; c.beginPath(); c.arc(x1, y1, H * 0.042, 0, 7); c.fill(); if (cls.id === 'falcao' || cls.id === 'trovao' || cls.id === 'cobra') { c.fillStyle = cls.id === 'falcao' ? '#111' : cls.id === 'cobra' ? '#3a4a2a' : '#c9b060'; c.fillRect(x1 - H * 0.03, y1 + H * 0.045, H * 0.06, H * 0.02); } };
    c.save();
    if (kind === 'reload' || kind === 'cover') { arm(W * 0.3, W * 0.42, H * 0.86 + Math.sin(opt.t * 9) * 6); arm(W * 0.7, W * 0.58, H * 0.88 - Math.sin(opt.t * 9) * 8); c.fillStyle = '#222'; c.fillRect(W * 0.46, H * 0.84, W * 0.08, H * 0.05); c.fillStyle = '#c9a030'; c.fillRect(W * 0.565, H * 0.85 - Math.sin(opt.t * 9) * 8, 5, 12); c.restore(); return; }
    if (kind === 'torreta') {
      const cx = W / 2 + (px - W / 2) * 0.3, cy = H * 0.78 + (py - H / 2) * 0.15 + kick * 10;
      c.fillStyle = opt.hot > 0.7 ? `rgb(${120 + opt.hot * 135 | 0},${50 * opt.hot | 0},20)` : '#1a1a1a';
      c.beginPath(); c.moveTo(cx - 12, cy); c.lineTo(px - 5, py + 20); c.lineTo(px + 5, py + 20); c.lineTo(cx + 12, cy); c.fill();
      c.fillStyle = '#2a2d2a'; c.fillRect(cx - 55, cy - 10, 110, 70); c.fillStyle = '#c9a030'; for (let i = 0; i < 6; i++) c.fillRect(cx - 100 + i * 9 - (opt.t * 80 % 9), cy + 5, 6, 16);
      c.fillStyle = '#111'; c.fillRect(cx - 62, cy + 60, 16, 44); c.fillRect(cx + 46, cy + 60, 16, 44);
      arm(W * 0.25, cx - 54, cy + 84); arm(W * 0.75, cx + 54, cy + 84); c.restore(); return;
    }
    const melee = kind === 'facao' || kind === 'lanca' || kind === 'porrete' || kind === 'serra';
    if (melee) {
      const sw = opt.swing || 0, hx = W * 0.62 - sw * W * 0.25, hy = H * 0.82 - Math.sin(sw * Math.PI) * H * 0.2;
      c.save(); c.translate(hx, hy); c.rotate(-0.5 - sw * 1.6 + (kind === 'lanca' ? 0.2 + sw * 1.2 : 0));
      if (kind === 'facao') { c.fillStyle = '#3a2a1a'; c.fillRect(-6, -10, 12, 46); c.fillStyle = '#c8ccd0'; c.beginPath(); c.moveTo(-8, -10); c.lineTo(-10, -190); c.lineTo(8, -210); c.lineTo(12, -10); c.fill(); c.fillStyle = '#7a1a1a'; c.fillRect(-9, -150, 16, 30); }
      else if (kind === 'porrete') { c.fillStyle = '#6a4a2a'; c.beginPath(); c.moveTo(-7, 40); c.lineTo(-16, -200); c.lineTo(16, -200); c.lineTo(7, 40); c.fill(); c.fillStyle = '#bbb'; for (let i = 0; i < 6; i++) { c.fillRect(-24, -190 + i * 14, 10, 3); c.fillRect(14, -183 + i * 14, 10, 3); } }
      else if (kind === 'lanca') { c.fillStyle = '#6a6a6a'; c.fillRect(-5, -320 - sw * 140, 10, 420); c.fillStyle = '#ddd'; c.beginPath(); c.moveTo(-9, -320 - sw * 140); c.lineTo(0, -380 - sw * 140); c.lineTo(9, -320 - sw * 140); c.fill(); }
      else { const j = opt.rev ? Math.sin(opt.t * 80) * 2 : 0; c.rotate(0.35); c.fillStyle = '#d86a1a'; c.fillRect(-40 + j, -40, 80, 80); c.fillStyle = '#222'; c.fillRect(-30 + j, -60, 60, 20); c.fillStyle = '#999'; c.fillRect(-14 + j, -260 - (opt.ind ? 70 : 0), 28, 220 + (opt.ind ? 70 : 0)); c.fillStyle = '#333'; for (let i = 0; i < 14; i++) c.fillRect(-18 + j, -255 + i * 16 + (opt.t * 300 % 16) * (opt.rev ? 1 : 0), 36, 4); }
      c.restore(); arm(W * 0.78, hx + 6, hy + 14); if (kind === 'lanca' || kind === 'serra') arm(W * 0.35, hx - 60, hy - 30); c.restore(); return;
    }
    // armas de fogo: vistas por trás, em perspectiva, apontando para a mira (hip-fire → mira de ferro)
    const long = kind !== 'pistola', hipF = kind === 'pistola' ? 0.5 : kind === 'smg' ? 0.62 : 0.7;
    const hRx = W * 0.7 + (px - W * 0.5) * 0.12, hRy = H * (long ? 1.06 : 0.9), hMx = hRx + (px - hRx) * hipF, hMy = hRy + (py - hRy) * hipF;
    const aRx = px, aRy = py + H * (long ? 0.56 : 0.42), aMx = px, aMy = py + H * 0.03, k = kick * (1 - ads * 0.4);
    const Rx = hRx + (aRx - hRx) * ads, Ry = hRy + (aRy - hRy) * ads + k * 20, Mx = hMx + (aMx - hMx) * ads, My = hMy + (aMy - hMy) * ads + k * 9;
    const big = kind === 'escopeta' || kind === 'lanca40', wR = H * (kind === 'pistola' ? 0.13 : big ? 0.23 : 0.2) * (1 + ads * 0.2), wM = H * (big ? 0.04 : 0.028);
    const dx = Mx - Rx, dy = My - Ry, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const wAt = (f) => (wR + (wM - wR) * f) / 2, at = (f, o) => [Rx + dx * f + nx * o, Ry + dy * f + ny * o];
    const quad = (f0, s0, f1, s1, cor) => { const a = at(f0, -wAt(f0) * s0), b = at(f0, wAt(f0) * s0), e = at(f1, wAt(f1) * s1), g = at(f1, -wAt(f1) * s1); c.fillStyle = cor; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(g[0], g[1]); c.fill(); };
    if (long) {
      quad(0.5, 0.42, 1.0, 0.9, '#0c0d0f');                                   // cano
      if (kind !== 'escopeta') { const m = at(0.27, 0); c.fillStyle = '#16171a'; c.beginPath(); c.moveTo(m[0] - wAt(0.27) * 0.5, m[1]); c.lineTo(m[0] + wAt(0.27) * 0.5, m[1]); c.lineTo(m[0] + wAt(0.27) * 0.42 + 6, m[1] + H * 0.11); c.lineTo(m[0] - wAt(0.27) * 0.42 + 6, m[1] + H * 0.11); c.fill(); } // carregador
      quad(-0.2, 1.15, 0.02, 1.0, '#131416');                                  // coronha
      quad(0.0, 1.0, 0.56, 1.0, '#1d1f23');                                    // caixa da culatra
      if (kind === 'escopeta') { const pf = 0.36 + (opt.pump || 0) * 0.1; quad(pf, 1.25, pf + 0.2, 1.2, '#6a4424'); c.strokeStyle = '#4a2e16'; c.lineWidth = 2; for (let q = 1; q < 5; q++) { const a = at(pf + q * 0.04, -wAt(pf) * 1.2), b = at(pf + q * 0.04, wAt(pf) * 1.2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
      else if (kind === 'lanca40') { const m = at(0.34, 0); c.fillStyle = '#2a2d2a'; c.beginPath(); c.arc(m[0], m[1], wAt(0.34) * 1.7, 0, 7); c.fill(); c.fillStyle = '#121312'; for (let q = 0; q < 6; q++) { const a = q * 1.047 + (opt.t || 0) * 0.2; c.beginPath(); c.arc(m[0] + Math.cos(a) * wAt(0.34) * 1.1, m[1] + Math.sin(a) * wAt(0.34) * 1.1, wAt(0.34) * 0.35, 0, 7); c.fill(); } }
      else { quad(0.34, 1.2, 0.6, 1.15, '#2a2d32'); c.fillStyle = '#121316'; for (let q = 1; q < 5; q++) { const a = at(0.34 + q * 0.05, 0); c.fillRect(a[0] - 2, a[1] - 2, 4, 4); } }
      quad(0.0, 0.14, 0.56, 0.14, '#3c4046');                                  // trilho superior (brilho)
    } else {
      quad(0.0, 1.0, 1.0, 1.0, '#1f2125'); quad(0.0, 0.18, 1.0, 0.3, '#3a3e44');    // ferrolho
      const g = at(0.1, 0); c.fillStyle = '#18191b'; c.fillRect(g[0] - wR * 0.32, g[1], wR * 0.64, H * 0.12); // empunhadura
    }
    const fs = at(0.98, 0); c.fillStyle = '#060606'; c.fillRect(fs[0] - 2.5, fs[1] - H * 0.03, 5, H * 0.032); c.fillStyle = '#e8d070'; c.fillRect(fs[0] - 1.5, fs[1] - H * 0.03, 3, 3); // massa de mira
    const r0 = at(0.05, 0), rsX = r0[0] + (px - r0[0]) * ads, rsY = r0[1] + (py + H * 0.058 - r0[1]) * ads;                                 // alça de mira (enquadra a massa na visada)
    const pw = wAt(0.05) * 1.6 + (H * 0.17 - wAt(0.05) * 1.6) * ads, nw = Math.max(6, wAt(0.05) * 0.45) + (H * 0.032 - Math.max(6, wAt(0.05) * 0.45)) * ads, ph = H * (0.03 + ads * 0.012);
    c.fillStyle = '#08090a'; c.fillRect(rsX - pw / 2, rsY - ph, pw / 2 - nw / 2, ph); c.fillRect(rsX + nw / 2, rsY - ph, pw / 2 - nw / 2, ph); c.fillRect(rsX - pw / 2, rsY - ph * 0.35, pw, ph * 0.35);
    if (ads > 0.5) { c.fillStyle = '#e8d070'; c.fillRect(rsX - nw / 2 - 5, rsY - ph * 0.6, 3, 3); c.fillRect(rsX + nw / 2 + 2, rsY - ph * 0.6, 3, 3); }
    if (opt.flash) { const f = at(1.06, 0); c.fillStyle = 'rgba(255,220,120,0.92)'; c.beginPath(); for (let q = 0; q < 10; q++) { const a = q * 0.628 + (opt.t || 0) * 7, r = q % 2 ? 9 : 26 + (big ? 10 : 0); q ? c.lineTo(f[0] + Math.cos(a) * r, f[1] + Math.sin(a) * r * 0.8) : c.moveTo(f[0] + Math.cos(a) * r, f[1] + Math.sin(a) * r * 0.8); } c.fill(); }
    c.setTransform(1, 0, 0, 1, 0, 0);
    const gr = at(long ? 0.07 : 0.1, 0); arm(W * 0.8, gr[0] + 4, gr[1] + H * 0.05);
    if (long) { const hg = at(0.45, 0); arm(W * 0.3, hg[0] - 6, hg[1] + H * 0.035); } else arm(W * 0.42, gr[0] - 14, gr[1] + H * 0.07);
    c.restore();
  }

  return { zombie, boi, vehicle, playerCar, scenery, marco, hands, hash, R };
})();
