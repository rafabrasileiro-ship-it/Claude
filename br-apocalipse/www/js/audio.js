'use strict';
/* Áudio (WebAudio): tiros e explosões com as gravações de js/sons.js (uma por arma, adaptadas quando não há
   gravação própria); motor, motosserra, vento, rádio e efeitos sintetizados. */
const SFX = (() => {
  let musVol = 1, ac = null, master, eng, engG, eng2, saw, sawG, windG, noiseBuf, musG, dist, muffle, comp, gunBus, gunLP, hasPan = false;
  let musOn = null, musT = 0, musStep = 0, musTimer = null, vol = 0.8;
  const buf = {}, ons = {}, voices = []; let decoding = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = vol;
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 9000;
    // limitador no fim da cadeia: rajadas e explosões somadas não estouram o alto-falante
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -9; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
    muffle.connect(master); master.connect(comp); comp.connect(ac.destination);
    // barramento das armas: gravações com filtro próprio (abafa menos que o resto dentro da cabine)
    gunBus = ac.createGain(); gunBus.gain.value = 0.62; gunLP = ac.createBiquadFilter(); gunLP.type = 'lowpass'; gunLP.frequency.value = 16000; gunLP.Q.value = 0.5;
    gunBus.connect(gunLP); gunLP.connect(master); hasPan = typeof ac.createStereoPanner === 'function';
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // motor
    eng = ac.createOscillator(); eng.type = 'sawtooth'; eng2 = ac.createOscillator(); eng2.type = 'square';
    engG = ac.createGain(); engG.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    eng.connect(lp); eng2.connect(lp); lp.connect(engG); engG.connect(muffle); eng.start(); eng2.start();
    // motosserra
    saw = ac.createOscillator(); saw.type = 'sawtooth'; sawG = ac.createGain(); sawG.gain.value = 0;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    saw.connect(bp); bp.connect(sawG); sawG.connect(muffle); saw.start();
    // vento
    const wn = ac.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.4;
    windG = ac.createGain(); windG.gain.value = 0; wn.connect(wf); wf.connect(windG); windG.connect(master); wn.start();
    // música
    musG = ac.createGain(); musG.gain.value = 0.16 * musVol;
    dist = ac.createWaveShaper(); const c = new Float32Array(257);   // nº ímpar de pontos: silêncio sai como zero (sem nível DC)
    for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 6); } dist.curve = c;
    const ml = ac.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 2600;
    dist.connect(ml); ml.connect(musG); musG.connect(muffle);
    loadSamples();
  }

  /* ---------- gravações (js/sons.js) ---------- */
  function loadSamples() {
    if (decoding || typeof SONS === 'undefined') return; decoding = true;
    for (const k in SONS) {
      let u8; try { const bin = atob(SONS[k]); u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); } catch (e) { continue; }
      // o início exato do estampido (o MP3 traz alguns ms de silêncio do codificador): o som sai junto com o clarão
      const ok = (b) => { if (!b) return; const d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > pk) pk = a; }
        let i0 = 0; const th = pk * 0.04; while (i0 < d.length && (d[i0] < 0 ? -d[i0] : d[i0]) < th) i0++; ons[k] = Math.max(0, i0 - 24) / b.sampleRate; buf[k] = b; };
      try { const p = ac.decodeAudioData(u8.buffer, ok, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  }
  function prune() { const now = ac.currentTime; for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end < now) voices.splice(i, 1);
    while (voices.length > 22) { const v = voices.shift(); try { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.012); v.s.stop(now + 0.06); } catch (e) {} } }
  // uma gravação tocando: tom (velocidade), volume, corte da cauda (rajadas), filtros e posição esquerda/direita
  function voice(k, rate, gain, t, o) {
    const b = buf[k]; if (!b || gain <= 0.001) return;
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const off = ons[k] || 0, len = (b.duration - off) / rate, tail = Math.min(len, o.tail || len), g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    if (tail < len - 0.01) { g.gain.setValueAtTime(gain, t + Math.min(0.07, tail * 0.3)); g.gain.exponentialRampToValueAtTime(0.0006, t + tail); }
    let n = s;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.4; n.connect(f); n = f; }
    if (o.hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; f.Q.value = 0.5; n.connect(f); n = f; }
    n.connect(g); n = g;
    if (o.pan && hasPan) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); n.connect(p); n = p; }
    n.connect(gunBus); s.start(t, off); s.stop(t + tail + 0.03);
    voices.push({ s, g, end: t + tail });
  }
  // reforço grave sintetizado (canhões, .50, granada): o "soco" no peito que a gravação de fuzil não tem
  function sub(t, f0, f1, dur, gain, pan) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); let n = g; if (pan && hasPan) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); n = p; }
    n.connect(gunBus); o.start(t); o.stop(t + dur + 0.02);
  }
  // estalo metálico (ferrolho, bomba da escopeta, pente, cápsula): ruído em faixa estreita
  function clk(t, f, gain, d, pan, q) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q || 2.4;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(bp); bp.connect(g); let n = g; if (pan && hasPan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
    n.connect(gunBus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }
  function ping(t, f, gain, d) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0006, t + d); o.connect(g); g.connect(gunBus); o.start(t); o.stop(t + d + 0.02); }

  /* Cada arma com a sua gravação. Sem gravação própria, adapta a mais parecida:
     5,56 = 7,62 mais agudo e seco; FN MAG = 7,62 mais grave; .50 e canhões = tiro/7,62 bem mais graves + reforço grave
     (25/30 mm com um pedaço da explosão); lança-granadas = "tump" abafado; Cal. 20 = escopeta mais aguda. */
  const GUN = {
    rev38: { s: 'rev', r: 1, g: 0.62 },
    pist9: { s: 'p9', r: 1, g: 0.9 },
    cal20: { s: 'esc', r: 1.1, g: 1.1 },
    smg9: { s: 'p9', r: 1.12, g: 0.85, tail: 0.3 },
    cal12: { s: 'esc', r: 0.95, g: 1.28, pump: 0.3 },
    cal12a: { s: 'esc', r: 0.97, g: 1.1, tail: 0.5 },
    smg10: { s: 'm10', r: 1, g: 0.8, tail: 0.34 },
    fz556: { s: 'ak', r: 1.17, g: 0.95, tail: 0.42, hp: 180 },
    fz762: { s: 'ak', r: 1, g: 0.95, tail: 0.62 },
    lmg: { s: 'ak', r: 0.92, g: 0.9, tail: 0.36, sub: 0.25, sf: [110, 45] },
    mgl: { s: 'tiro', r: 0.48, g: 0.62, tail: 0.45, lp: 1400, sub: 0.9, sf: [140, 50] },
    m2: { s: 'ak', r: 0.72, g: 1, tail: 0.5, sub: 0.6, sf: [95, 36], lay: ['tiro', 0.6, 0.45] },
    m2x2: { s: 'ak', r: 0.74, g: 0.9, tail: 0.45, sub: 0.6, sf: [95, 36], lay: ['tiro', 0.62, 0.4], dual: 0.034 },
    c20: { s: 'tiro', r: 0.56, g: 0.95, tail: 0.55, sub: 0.85, sf: [82, 32], lay: ['ak', 0.6, 0.45] },
    c25: { s: 'tiro', r: 0.5, g: 1, tail: 0.65, sub: 1, sf: [72, 30], lay: ['exp', 1.7, 0.3] },
    c30: { s: 'tiro', r: 0.45, g: 1.05, tail: 0.75, sub: 1.1, sf: [64, 26], lay: ['exp', 1.5, 0.4] },
    fer: { s: 'fer', r: 1, g: 1.1 },
    tiro: { s: 'tiro', r: 1, g: 0.75, tail: 1.2 },
  };
  const PEN = { rev38: 1, pist9: 1, cal20: 1, smg9: 1, cal12: 2, cal12a: 2, smg10: 2, fz556: 3, fz762: 3, lmg: 3, mgl: 4, m2: 4, m2x2: 4, c20: 5, c25: 5, c30: 6, fer: 3, tiro: 2 };

  function noise(dur, freq, q, gain, type, dest) {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ac.createGain(); const t = ac.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || muffle); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function tone(freq, dur, type, gain, slide, dest) {
    if (!ac) return;
    const o = ac.createOscillator(); o.type = type || 'square'; const g = ac.createGain(); const t = ac.currentTime;
    o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || muffle); o.start(t); o.stop(t + dur + 0.02);
  }

  const api = {
    init,
    get ok() { return !!ac; },
    setVol(v) { vol = v; if (master) master.gain.value = v; },
    setMusVol(v) { musVol = Math.max(0, Math.min(1, v)); if (musG) musG.gain.value = 0.16 * musVol; },   // volume só da música (0..1)
    engine(rpm, load, on) {
      if (!ac) return; const t = ac.currentTime;
      const f = 38 + rpm * 110;
      eng.frequency.setTargetAtTime(f, t, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      engG.gain.setTargetAtTime(on ? 0.05 + load * 0.07 : 0, t, 0.08);
    },
    saw(on, rev) {
      if (!ac) return; const t = ac.currentTime;
      saw.frequency.setTargetAtTime(70 + rev * 150 + Math.random() * 12, t, 0.04);
      sawG.gain.setTargetAtTime(on ? 0.05 + rev * 0.06 : 0, t, 0.05);
    },
    wind(v, outside) {
      if (!ac) return; const t = ac.currentTime;
      windG.gain.setTargetAtTime(v * (outside ? 0.22 : 0.05), t, 0.1);
      muffle.frequency.setTargetAtTime(outside ? 12000 : 3800, t, 0.08);
      gunLP.frequency.setTargetAtTime(outside ? 17000 : 6800, t, 0.08);
    },
    /* tiro de qualquer arma: key = arma (WEAPONS / GUN), o = { pan: -1 esq. … 1 dir., dist: metros (atenua, abafa e atrasa
       pela velocidade do som), vol, delay (s), net: veio da rede (não reenviar), me: tiro do próprio jogador } */
    gun(key, o) {
      o = o || {};
      if (api.onGun && !o.net) try { api.onGun(key, o); } catch (e) {}
      if (!ac) return;
      if (!Object.prototype.hasOwnProperty.call(GUN, key)) key = 'tiro';
      const p = GUN[key], dist = Math.min(400, Math.max(0, +o.dist || 0));
      if (!buf[p.s]) { api.shot(PEN[key], dist); return; }   // gravações ainda decodificando: tiro sintetizado
      prune();
      const t = ac.currentTime + Math.max(0, Math.min(0.5, +o.delay || 0)) + dist / 343, att = 1 / (1 + dist / 16), vol = (o.vol || 1) * att * (0.9 + Math.random() * 0.18);
      const lpD = dist > 3 ? Math.max(1300, 17000 / (1 + (dist - 3) / 9)) : 0, lp = p.lp && lpD ? Math.min(p.lp, lpD) : (p.lp || lpD), pan = Math.max(-1, Math.min(1, +o.pan || 0));
      const rate = p.r * (0.965 + Math.random() * 0.07), opt = { tail: p.tail, lp, hp: p.hp, pan };
      voice(p.s, rate, p.g * vol, t, opt);
      if (p.dual) voice(p.s, rate * 1.03, p.g * vol * 0.85, t + p.dual, opt);
      if (p.lay) voice(p.lay[0], p.lay[1] * (0.97 + Math.random() * 0.06), p.lay[2] * vol, t, opt);
      if (p.sub) sub(t, p.sf[0], p.sf[1], 0.16 + p.sub * 0.12, Math.min(0.9, p.sub * 0.55 * vol), pan);
      if (p.pump) { const q = t + p.pump; clk(q, 1700, 0.3 * vol, 0.05, pan); clk(q + 0.01, 4300, 0.16 * vol, 0.03, pan); clk(q + 0.17, 2300, 0.3 * vol, 0.05, pan); clk(q + 0.18, 5400, 0.14 * vol, 0.03, pan); }
      // cápsulas caindo na lataria (só nas armas do próprio jogador; rajadas: uma a cada três)
      if (o.me && key !== 'cal12' && key !== 'cal20' && key !== 'mgl' && key !== 'rev38' && Math.random() < (p.tail && p.tail < 0.5 ? 0.34 : 0.8)) {
        const c = t + 0.22 + Math.random() * 0.2, f = (PEN[key] >= 4 ? 2400 : 4200) + Math.random() * 1500;
        ping(c, f, 0.035, 0.09); ping(c + 0.09 + Math.random() * 0.04, f * 1.07, 0.02, 0.07); if (Math.random() < 0.5) ping(c + 0.17, f * 0.96, 0.012, 0.05);
      }
    },
    shot(pen, dist) { const a = dist ? 1 / (1 + dist / 16) : 1; noise(0.12 + pen * 0.03, (1800 - pen * 220) * (dist > 6 ? 0.6 : 1), 0.5, (0.35 + pen * 0.06) * a); tone(180 - pen * 18, 0.08 + pen * 0.02, 'square', 0.18 * a, 0.4); },
    shotFar() { api.gun('tiro', { dist: 30 + Math.random() * 30, pan: Math.random() * 1.6 - 0.8 }); },
    click() { if (!ac) return; if (!gunBus) { tone(1400, 0.03, 'square', 0.12); return; } const t = ac.currentTime; clk(t, 3100, 0.45, 0.025, 0, 3); clk(t + 0.004, 6200, 0.2, 0.015, 0, 3); },
    reload() { if (!ac) return; const t = ac.currentTime; clk(t, 1300, 0.45, 0.06, 0, 1.6); clk(t + 0.012, 3600, 0.22, 0.03); clk(t + 0.13, 2500, 0.48, 0.045, 0, 2); clk(t + 0.135, 5600, 0.24, 0.03); },
    hit() { noise(0.14, 420, 0.8, 0.4); tone(90, 0.12, 'sine', 0.3, 0.5); },
    splat() { noise(0.2, 700, 1.2, 0.3, 'bandpass'); },
    crash() { noise(0.5, 900, 0.5, 0.7); tone(60, 0.4, 'sawtooth', 0.4, 0.4); },
    glass() { noise(0.3, 5200, 2, 0.35, 'highpass'); },
    ric() { tone(2400 + Math.random() * 1500, 0.12, 'sine', 0.08, 0.5); },
    // explosão gravada; k = tamanho (0,3 granada … 1,5 chefe): maior = mais grave e mais alta
    boom(k) {
      if (!ac) return; k = k == null ? 1 : Math.max(0.3, Math.min(1.6, k));
      if (buf.exp) { prune(); const t = ac.currentTime; voice('exp', (1.16 - k * 0.24) * (0.95 + Math.random() * 0.1), 0.9 * (0.55 + k * 0.45), t, { tail: 1.4 + k * 1.2 }); sub(t, 75, 26, 0.5 + k * 0.3, Math.min(0.85, 0.35 + k * 0.35), 0); return; }
      noise(0.9, 320, 0.4, 0.9); tone(70, 0.7, 'sine', 0.6, 0.3);
    },
    swing() { noise(0.12, 2400, 1.5, 0.15, 'bandpass'); },
    beep() { tone(1900, 0.08, 'square', 0.07); },
    horn() { tone(196, 0.9, 'sawtooth', 0.25); tone(247, 0.9, 'sawtooth', 0.22); },
    wiper() { noise(0.25, 900, 2, 0.08, 'bandpass'); },
    ui() { tone(520, 0.05, 'square', 0.08); },
    buy() { tone(660, 0.07, 'square', 0.1); setTimeout(() => tone(990, 0.1, 'square', 0.1), 80); },
    ping() { tone(1200, 0.1, 'sine', 0.2); setTimeout(() => tone(1600, 0.12, 'sine', 0.2), 110); },
    turbo() { noise(0.5, 3200, 3, 0.25, 'bandpass'); tone(300, 0.5, 'sawtooth', 0.12, 3); },
    pssh() { noise(0.25, 5000, 1, 0.12, 'highpass'); },
    starter(cb) {
      const crank = (n) => { for (let i = 0; i < n; i++) setTimeout(() => { tone(95, 0.09, 'sawtooth', 0.25); noise(0.08, 500, 1, 0.15); }, i * 110); };
      crank(6); setTimeout(() => crank(7), 1000); setTimeout(() => { crank(5); setTimeout(() => { tone(60, 0.6, 'sawtooth', 0.4, 2.2); cb && cb(); }, 560); }, 2100);
    },
    vibrate(ms) { try { if (window.BRApp && BRApp.vibrate) BRApp.vibrate(JSON.stringify(ms)); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} },
    static_() { noise(0.35, 3000, 0.3, 0.12, 'bandpass'); },
    music(kind) {
      if (kind === musOn) return; musOn = kind; musStep = 0;
      if (musTimer) { clearInterval(musTimer); musTimer = null; }
      if (!ac || !kind) return;
      if (kind === 'marinha') { musTimer = setInterval(() => { noise(0.5, 2500 + Math.random() * 2000, 0.3, 0.05 * musVol, 'bandpass'); if (Math.random() < 0.3) tone(880, 0.25, 'sine', 0.05 * musVol); }, 420); return; }
      const P = PATTERNS[kind]; musT = ac.currentTime + 0.1;
      musTimer = setInterval(() => {
        while (musT < ac.currentTime + 0.25) {
          const s = musStep % P.riff.length, n = P.riff[s];
          if (n != null) { const f = P.base * Math.pow(2, n / 12); note(f, musT, P.step * P.len, P.wave); if (P.fifth) note(f * 1.5, musT, P.step * P.len, P.wave); }
          const dch = P.drum[musStep % P.drum.length];
          if (dch === 'k') drum(musT, 1); else if (dch === 's') drum(musT, 2); else if (dch === 'h') drum(musT, 3);
          musT += P.step; musStep++;
        }
      }, 80);
    },
  };
  const PATTERNS = {
    rock: { base: 82.4, step: 0.14, len: 0.9, wave: 'sawtooth', fifth: 1, riff: [0, 0, 3, 0, 0, 5, 0, 3, 0, 0, 3, 0, 6, 5, 3, null], drum: 'khshkhsh' },
    viola: { base: 110, step: 0.16, len: 1.6, wave: 'sawtooth', fifth: 0, riff: [0, 7, 12, 16, 12, 7, 0, 7, 5, 12, 17, 21, 17, 12, 5, 12, -2, 5, 10, 14, 10, 5, 0, 7, 12, 16, 19, 16, 12, 7, 4, 7], drum: 'k..hk.h.' },
    baiao: { base: 98, step: 0.125, len: 0.8, wave: 'square', fifth: 1, riff: [0, null, null, 0, null, null, 7, null, 0, null, null, 10, null, 9, 7, null, 0, null, null, 0, null, null, 7, 5, 4, null, 5, 7, null, 10, 12, null], drum: 'k..ks.k.k..ks.hh' },
  };
  function note(f, t, d, wave) {
    const o = ac.createOscillator(); o.type = wave; o.frequency.value = f; const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + d); o.connect(g); g.connect(dist); o.start(t); o.stop(t + d + 0.02);
  }
  function drum(t, k) {
    if (k === 1) { const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.14); o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.16); return; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = k === 2 ? 1500 : 6000;
    const g = ac.createGain(); const d = k === 2 ? 0.12 : 0.04; g.gain.setValueAtTime(k === 2 ? 0.5 : 0.2, t); g.gain.exponentialRampToValueAtTime(0.01, t + d);
    s.connect(f); f.connect(g); g.connect(musG); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }
  return api;
})();
