'use strict';
/* Áudio 100% sintetizado (WebAudio): motor, tiros, motosserra, rádio */
const SFX = (() => {
  let ac = null, master, eng, engG, eng2, saw, sawG, windG, noiseBuf, musG, dist, muffle;
  let musOn = null, musT = 0, musStep = 0, musTimer = null, vol = 0.8;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = vol;
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 9000;
    muffle.connect(master); master.connect(ac.destination);
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
    musG = ac.createGain(); musG.gain.value = 0.16;
    dist = ac.createWaveShaper(); const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 6); } dist.curve = c;
    const ml = ac.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 2600;
    dist.connect(ml); ml.connect(musG); musG.connect(muffle);
  }

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
    },
    shot(pen) { noise(0.12 + pen * 0.03, 1800 - pen * 220, 0.5, 0.35 + pen * 0.06); tone(180 - pen * 18, 0.08 + pen * 0.02, 'square', 0.18, 0.4); },
    shotFar() { noise(0.08, 1200, 0.5, 0.1); },
    click() { tone(1400, 0.03, 'square', 0.12); },
    reload() { tone(700, 0.04, 'square', 0.1); setTimeout(() => tone(500, 0.05, 'square', 0.1), 140); },
    hit() { noise(0.14, 420, 0.8, 0.4); tone(90, 0.12, 'sine', 0.3, 0.5); },
    splat() { noise(0.2, 700, 1.2, 0.3, 'bandpass'); },
    crash() { noise(0.5, 900, 0.5, 0.7); tone(60, 0.4, 'sawtooth', 0.4, 0.4); },
    glass() { noise(0.3, 5200, 2, 0.35, 'highpass'); },
    ric() { tone(2400 + Math.random() * 1500, 0.12, 'sine', 0.08, 0.5); },
    boom() { noise(0.9, 320, 0.4, 0.9); tone(70, 0.7, 'sine', 0.6, 0.3); },
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
      if (kind === 'marinha') { musTimer = setInterval(() => { noise(0.5, 2500 + Math.random() * 2000, 0.3, 0.05, 'bandpass'); if (Math.random() < 0.3) tone(880, 0.25, 'sine', 0.05); }, 420); return; }
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
