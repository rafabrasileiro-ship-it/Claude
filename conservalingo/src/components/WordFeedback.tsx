import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card } from './ui';
import { say, playUri } from '../engine/audio';
import { cleanWord, tipFor, type ScoredWord } from '../engine/pron';

const COLOR = { good: colors.olive, near: colors.gold, bad: colors.crimson } as const;

/** Frase com cada palavra colorida (verde/dourado/carmesim). Tocar numa palavra dourada/vermelha abre a dica de pronúncia. */
export default function WordFeedback({ words, uri, voice = 'M' }: { words: ScoredWord[]; uri?: string | null; voice?: 'M' | 'F' }) {
  const [sel, setSel] = useState<number | null>(null);
  const w = sel !== null ? words[sel] : null;
  const tip = w ? tipFor(w.word) : null;
  return (
    <View style={{ gap: space.md }}>
      <Text style={s.line}>
        {words.map((x, i) => (
          <Text key={i} onPress={() => x.status !== 'good' && setSel(i)}
            style={[{ color: COLOR[x.status] }, x.status === 'bad' && { textDecorationLine: 'underline' }]}>{x.word}{i < words.length - 1 ? ' ' : ''}</Text>
        ))}
      </Text>
      <Text style={s.legend}>
        <Text style={{ color: COLOR.good }}>● clara </Text><Text style={{ color: COLOR.near }}>● com sotaque/hesitação </Text><Text style={{ color: COLOR.bad }}>● omitida ou incorreta</Text>
        {'  '}Toque numa palavra colorida para ver a dica.
      </Text>
      {w && tip && (
        <Card style={{ gap: space.sm, borderColor: COLOR[w.status], borderWidth: 2 }}>
          <Text style={s.tipTitle}>“{cleanWord(w.word)}” · {tip.title}</Text>
          {w.heard ? <Text style={s.tipBody}>O app ouviu: “{w.heard}”.</Text> : <Text style={s.tipBody}>Esta palavra não foi ouvida.</Text>}
          <Text style={s.tipBody}>{tip.tip}</Text>
          <Text style={s.tipHead}>Ouça a diferença</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Btn kind="gold" title="🔊 Correta" onPress={() => say(cleanWord(w.word), voice)} /></View>
            <View style={{ flex: 1 }}><Btn kind="ghost" title={uri ? '🎙️ Você' : '🎙️ —'} disabled={!uri} onPress={() => uri && playUri(uri)} /></View>
          </View>
          {!uri && <Text style={s.legend}>A gravação da sua voz não está disponível neste aparelho.</Text>}
        </Card>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  line: { fontFamily: fonts.serif, fontSize: fs(18), lineHeight: fs(18) * 1.5, textAlign: 'center' },
  legend: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted, textAlign: 'center' },
  tipTitle: { fontFamily: fonts.serif, fontSize: fs(15), color: colors.navy },
  tipHead: { fontFamily: fonts.sansBold, fontSize: fs(13), color: colors.navy },
  tipBody: { fontFamily: fonts.sans, fontSize: fs(14), color: colors.ink, lineHeight: fs(14) * 1.4 },
});
