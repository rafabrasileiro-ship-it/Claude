import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Avatar } from './ui';
import { people } from '../engine/content';
import { sayPt, sayTimed, stopSpeaking } from '../engine/audio';
import type { DialogueLine } from '../types';

export type Play = { line: number; word: number; seq: boolean } | null;

/** Reprodução de diálogo: fala por fala, com cada palavra aparecendo no instante em que é pronunciada. */
export function useDialogue(lines: DialogueLine[], slow: boolean, onFocus?: (i: number) => void, onFinish?: () => void) {
  const [play, setPlay] = useState<Play>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onFocus, onFinish }); cb.current = { onFocus, onFinish };

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; stopSpeaking(); setPlay(null); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); stopSpeaking(); }, []);

  const playLine = (i: number, seq: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    const d = lines[i]; const who = people[d.who];
    setPlay({ line: i, word: -1, seq });
    cb.current.onFocus?.(i);
    sayTimed(d.en, who?.sex ?? 'M', slow, (w) => setPlay({ line: i, word: w, seq }), (ok) => {
      if (!ok) return;
      if (seq && i + 1 < lines.length) { setPlay({ line: i, word: 999, seq }); timer.current = setTimeout(() => playLine(i + 1, true), 450); }
      else { setPlay(null); if (seq) cb.current.onFinish?.(); }
    });
  };
  return { play, stop, playLine, playAll: () => playLine(0, true) };
}

export function Bubbles({ lines, play, onTap, onLayoutLine, hideText }: {
  lines: DialogueLine[]; play: Play; onTap: (i: number) => void; onLayoutLine?: (i: number, y: number) => void; hideText?: boolean;
}) {
  return (
    <>
      {lines.map((d, i) => {
        const who = people[d.who];
        const right = i % 2 === 1;
        const words = d.en.split(/\s+/).filter(Boolean);
        const cur = play && play.line === i ? play.word : null;
        const upcoming = !!play && play.seq && i > play.line;
        const speaking = cur !== null && cur < 999;
        return (
          <View key={i} onLayout={(e) => onLayoutLine?.(i, e.nativeEvent.layout.y)} style={[s.row, right && { flexDirection: 'row-reverse' }, upcoming && { opacity: 0.22 }]}>
            <View style={{ alignItems: 'center', width: 76 }}>
              <Avatar emoji={who?.emoji ?? '🙂'} color={who?.color ?? colors.navy} />
              <Text style={s.who}>{who?.name}</Text>
            </View>
            <View style={[s.bubble, right && { backgroundColor: colors.navySoft }, speaking && { borderColor: colors.gold, borderWidth: 2 }]}>
              <Pressable onPress={() => onTap(i)} accessibilityLabel="Ouvir em inglês">
                <Text style={s.en}>
                  {words.map((w, k) => {
                    const shown = !hideText && (cur === null || k <= cur);
                    const now = cur !== null && k === cur;
                    return <Text key={k} style={[now && s.now, !shown && { color: 'transparent' }]}>{w}{k < words.length - 1 ? ' ' : ''}</Text>;
                  })}
                  {cur === null && !hideText ? ' 🔊' : ''}
                </Text>
              </Pressable>
              {!hideText && (
                <Pressable onPress={() => sayPt(d.pt)} accessibilityLabel="Ouvir em português">
                  <Text style={[s.pt, speaking && { opacity: 0 }]}>{d.pt} 🇧🇷</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.line, gap: 4 },
  en: { fontFamily: fonts.serif, fontSize: fs(15), color: colors.navy, lineHeight: 22 },
  now: { backgroundColor: colors.gold, color: '#fff' },
  pt: { fontFamily: fonts.sans, fontSize: fs(13), color: colors.muted },
  who: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, marginTop: 2, textAlign: 'center' },
});
