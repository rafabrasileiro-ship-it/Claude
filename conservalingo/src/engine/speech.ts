import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export interface ListenHandlers {
  onResult: (text: string, confidence: number, final: boolean) => void;
  onEnd: (audioUri: string | null) => void;
  onError: (code: string) => void;
}
type Sub = { remove: () => void };

export function asrAvailable(): boolean {
  try { return !!ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { return false; }
}

/** Reconhecimento de fala em inglês dos EUA (microfone). Retorna função para parar. */
export async function listen(h: ListenHandlers, contextual: string[] = []): Promise<() => void> {
  const M = ExpoSpeechRecognitionModule;
  const subs: Sub[] = [];
  let uri: string | null = null; let finished = false;
  const clean = () => subs.forEach((s) => { try { s.remove(); } catch { /* noop */ } });
  const end = () => { if (finished) return; finished = true; clean(); h.onEnd(uri); };
  try {
    const perm = await M.requestPermissionsAsync();
    if (!perm.granted) { h.onError('not-allowed'); return () => {}; }
    subs.push(M.addListener('result', (e) => {
      const r = e.results?.[0]; if (r) h.onResult(r.transcript, r.confidence ?? -1, e.isFinal);
    }));
    subs.push(M.addListener('audioend', (e) => { uri = e.uri ?? null; }));
    subs.push(M.addListener('error', (e) => { if (!finished) { finished = true; clean(); h.onError(e.error); } }));
    subs.push(M.addListener('end', end));
    M.start({
      lang: 'en-US', interimResults: true, maxAlternatives: 1, continuous: false, contextualStrings: contextual,
      recordingOptions: { persist: true },
    });
  } catch { h.onError('unavailable'); }
  return () => { try { M.stop(); } catch { /* noop */ } };
}
