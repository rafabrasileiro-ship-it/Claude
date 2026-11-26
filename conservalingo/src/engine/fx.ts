import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SRC = {
  ok: require('../audio/fx/ok.m4a'),
  bad: require('../audio/fx/bad.m4a'),
  combo: require('../audio/fx/combo.m4a'),
  level: require('../audio/fx/level.m4a'),
};
type Name = keyof typeof SRC;
const players: Partial<Record<Name, AudioPlayer>> = {};

/** Âncora multissensorial: acorde ascendente (harpa + sino) + dupla micro-vibração no acerto. */
export function fx(name: Name) {
  try {
    let p = players[name];
    if (!p) { p = createAudioPlayer(SRC[name]); players[name] = p; }
    p.seekTo(0).catch(() => {}); p.play();
  } catch { /* sem áudio */ }
  try {
    if (name === 'ok' || name === 'combo' || name === 'level') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 110);
    } else if (name === 'bad') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch { /* sem vibração */ }
}
