import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { clips } from '../audio/manifest';

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

function stopAll() {
  try { Speech.stop(); } catch { /* noop */ }
  try { player?.pause(); } catch { /* noop */ }
}

function speakDevice(text: string, language: 'en-US' | 'pt-BR', slow: boolean, voice?: string) {
  Speech.speak(text, { language, voice, rate: slow ? 0.7 : 0.95 }); // sem alterar pitch: evita som robótico
}

/** Fala um texto em INGLÊS (clipe pré-gravado; se faltar, usa a melhor voz en-US do aparelho). */
export function say(text: string, voice: Voice = 'M', slow = false) {
  try {
    stopAll();
    const isSlow = slow && text.trim().split(/\s+/).length >= 3;
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
