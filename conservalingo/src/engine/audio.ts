import * as Speech from 'expo-speech';

/** Voz masculina mais grave/firme; feminina mais suave/articulada. `slow` para leitura lenta. */
export function say(text: string, sex: 'M' | 'F' = 'M', slow = false) {
  try {
    Speech.stop();
    Speech.speak(text, {
      language: 'en-US',
      pitch: sex === 'M' ? 0.8 : 1.1,
      rate: slow ? 0.6 : 0.92,
    });
  } catch { /* áudio indisponível */ }
}
export function stopSpeaking() { try { Speech.stop(); } catch { /* noop */ } }
