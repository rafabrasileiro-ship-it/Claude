import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { clips, marks } from '../audio/manifest';

/**
 * Inglês: vozes neurais pré-gravadas (masculina/feminina, normal/lenta) — pronúncia nativa dos EUA.
 * Português: voz pt-BR do aparelho, sempre com o idioma explícito, nunca misturado com o inglês.
 * Cada texto é falado SOMENTE na sua língua.
 */
type Voice = 'M' | 'F';
let player: AudioPlayer | null = null;
let modeSet = false;

const ptVoice: { id?: string } = {};
const enVoice: { id?: string } = {};

async function bestVoice(prefix: string): Promise<string | undefined> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const list = all.filter((v) => v.language?.replace('_', '-').toLowerCase().startsWith(prefix.toLowerCase()));
    const score = (v: (typeof list)[number]) =>
      (v.quality === 'Enhanced' ? 4 : 0) + (/network|neural|wavenet|premium|enhanced/i.test(v.identifier + v.name) ? 3 : 0) + (/compact|espeak|legacy/i.test(v.identifier) ? -3 : 0);
    return list.sort((a, b) => score(b) - score(a))[0]?.identifier;
  } catch { return undefined; }
}

let active: { stop: () => void } | null = null;

function stopAll() {
  const a = active; active = null; a?.stop();
  try { Speech.stop(); } catch { /* noop */ }
  try { player?.pause(); } catch { /* noop */ }
}

function speakDevice(text: string, language: 'en-US' | 'pt-BR', slow: boolean, voice?: string) {
  Speech.speak(text, { language, voice, rate: slow ? 0.7 : 0.95 }); // sem alterar pitch: evita som robótico
}

/** Existe clipe pré-gravado para este texto em inglês? (evita ler português com voz inglesa) */
export const hasClip = (text: string) => clips[`M|n|${text}`] !== undefined || clips[`F|n|${text}`] !== undefined;

/** Fala um texto em INGLÊS (clipe pré-gravado; se faltar, usa a melhor voz en-US do aparelho). */
export function say(text: string, voice: Voice = 'M', slow = false) {
  try {
    stopAll();
    const isSlow = slow;
    const src = clips[`${voice}|${isSlow ? 's' : 'n'}|${text}`] ?? clips[`${voice}|n|${text}`] ?? clips[`M|${isSlow ? 's' : 'n'}|${text}`] ?? clips[`M|n|${text}`];
    if (src !== undefined) {
      if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
      if (!player) player = createAudioPlayer(src);
      else player.replace(src);
      player.play();
      return;
    }
    const go = (id?: string) => speakDevice(text, 'en-US', slow, id);
    if (enVoice.id) go(enVoice.id);
    else bestVoice('en-US').then((id) => { enVoice.id = id; go(id); });
  } catch { /* áudio indisponível */ }
}

/** Fala um texto em PORTUGUÊS do Brasil com a melhor voz pt-BR disponível. */
export function sayPt(text: string, slow = false) {
  try {
    stopAll();
    const go = (id?: string) => speakDevice(text, 'pt-BR', slow, id);
    if (ptVoice.id) go(ptVoice.id);
    else bestVoice('pt-BR').then((id) => { ptVoice.id = id; go(id); });
  } catch { /* áudio indisponível */ }
}

export function stopSpeaking() { stopAll(); }

/**
 * Fala em inglês e avisa, palavra por palavra, qual está sendo pronunciada AGORA.
 * onWord(i): índice da palavra (texto.split(/\s+/)); onEnd(completed): true se terminou, false se foi interrompida.
 * Retorna uma função para cancelar.
 */
export function sayTimed(text: string, voice: Voice, slow: boolean, onWord: (i: number) => void, onEnd: (completed: boolean) => void): () => void {
  stopAll();
  const key = `${voice}|${slow ? 's' : 'n'}|${text}`;
  const k2 = clips[key] !== undefined ? key : clips[`M|${slow ? 's' : 'n'}|${text}`] !== undefined ? `M|${slow ? 's' : 'n'}|${text}` : '';
  let done = false; let timer: ReturnType<typeof setInterval> | null = null; let last = -1;
  const handle = { stop: () => { try { Speech.stop(); player?.pause(); } catch { /* noop */ } finish(false); } };
  const finish = (ok: boolean) => {
    if (done) return; done = true;
    if (timer) clearInterval(timer);
    if (active === handle) active = null;
    onEnd(ok);
  };
  active = handle;
  const advance = (ms: number, ts: number[]) => {
    let i = -1;
    for (let j = 0; j < ts.length; j++) { if (ts[j] <= ms) i = j; else break; }
    if (i !== last) { last = i; if (i >= 0) onWord(i); }
  };
  try {
    if (k2) {
      const ts = marks[k2] ?? [];
      if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
      if (!player) player = createAudioPlayer(clips[k2]); else player.replace(clips[k2]);
      player.play();
      const t0 = Date.now(); let started = false;
      timer = setInterval(() => {
        const p = player; if (!p) return;
        if (p.playing) started = true;
        advance((p.currentTime || 0) * 1000, ts);
        const dur = p.duration || 0;
        if ((started && !p.playing) || (dur > 0 && p.currentTime >= dur - 0.03) || Date.now() - t0 > 30000) finish(true);
      }, 30);
    } else {
      // sem clipe: voz do aparelho, tempos estimados pelas letras
      const words = text.split(/\s+/).filter(Boolean);
      const unit = slow ? 105 : 70;
      const ts: number[] = []; let acc = 0;
      words.forEach((w) => { ts.push(acc * unit); acc += Math.max(2, w.replace(/\W/g, '').length + (/[,.;:!?]$/.test(w) ? 3 : 0)); });
      const go = (id?: string) => {
        if (done) return;
        const t0 = Date.now();
        timer = setInterval(() => advance(Date.now() - t0, ts), 40);
        Speech.speak(text, { language: 'en-US', voice: id, rate: slow ? 0.7 : 0.95, onDone: () => finish(true), onStopped: () => finish(false), onError: () => finish(false) });
      };
      if (enVoice.id) go(enVoice.id); else bestVoice('en-US').then((id) => { enVoice.id = id; go(id); });
    }
  } catch { finish(false); }
  return () => handle.stop();
}

/** Toca a gravação do próprio aluno (arquivo local gerado pelo reconhecimento de fala). */
export function playUri(uri: string) {
  try {
    stopAll();
    if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
    const p = createAudioPlayer({ uri }); p.play();
  } catch { /* sem áudio */ }
}
