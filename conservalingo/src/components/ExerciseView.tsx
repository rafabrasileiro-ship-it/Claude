import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../types';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, H1, P } from './ui';
import { say } from '../engine/audio';
import { checkAnswer } from '../engine/exercises';

interface Props { ex: Exercise; onDone: (correct: boolean) => void }

export default function ExerciseView({ ex, onDone }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const voice = ex.voice ?? 'M';

  useEffect(() => {
    setChosen(null); setBuilt([]); setChecked(null);
    if (ex.kind === 'listen') say(ex.speak ?? ex.question, voice);
  }, [ex.id]);

  const isBank = ex.kind === 'bank_en' || ex.kind === 'bank_pt';
  const answerText = isBank ? built.map((i) => ex.bank![i]).join(' ') : chosen ?? '';
  const check = () => {
    const ok = checkAnswer(ex, answerText);
    setChecked(ok);
    if (ex.speak) say(ex.speak, voice); // ouve a frase correta em inglês
  };

  if (ex.kind === 'speak') {
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.prompt}>{ex.prompt}</Text>
          <Text style={s.big}>{ex.question}</Text>
          <Btn kind="ghost" title="🔊 Ouvir" onPress={() => say(ex.speak!, voice)} />
          <Btn kind="ghost" title="🐢 Ouvir devagar" onPress={() => say(ex.speak!, voice, true)} />
          <P style={{ textAlign: 'center', color: colors.muted }}>Repita em voz alta, imitando a pronúncia.</P>
        </ScrollView>
        <View style={s.bar}><Btn title="Falei!" onPress={() => onDone(true)} /></View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.prompt}>{ex.prompt}</Text>
        {ex.kind === 'listen' ? (
          <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
            <Pressable onPress={() => say(ex.speak!, voice)} style={s.speaker} accessibilityLabel="Ouvir"><Text style={{ fontSize: fs(34) }}>🔊</Text></Pressable>
            <Pressable onPress={() => say(ex.speak!, voice, true)} style={[s.speaker, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]} accessibilityLabel="Ouvir devagar"><Text style={{ fontSize: fs(34) }}>🐢</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => ex.speak && say(ex.speak, voice)} accessibilityRole="button" accessibilityLabel="Ouvir frase">
            <Text style={s.big}>{ex.question}{ex.speak ? '  🔊' : ''}</Text>
          </Pressable>
        )}

        {isBank ? (
          <>
            <View style={s.answerBox}>
              {built.map((bi, i) => (
                <Pressable key={i} disabled={checked !== null} onPress={() => setBuilt(built.filter((_, k) => k !== i))} style={s.chip}>
                  <Text style={s.chipText}>{ex.bank![bi]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.bank}>
              {ex.bank!.map((w, i) => (
                <Pressable key={i} disabled={built.includes(i) || checked !== null} onPress={() => setBuilt([...built, i])}
                  style={[s.chip, built.includes(i) && { opacity: 0.2 }]}>
                  <Text style={s.chipText}>{w}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={{ gap: space.sm }}>
            {ex.options!.map((o) => {
              const sel = chosen === o;
              const show = checked !== null;
              const good = show && o === ex.answer;
              const bad = show && sel && !good;
              return (
                <Pressable key={o} disabled={show} onPress={() => { setChosen(o); if (ex.kind === 'listen') say(o, voice); }} accessibilityRole="button"
                  style={[s.opt, sel && s.optSel, good && s.optGood, bad && s.optBad]}>
                  <Text style={[s.optText, sel && { color: colors.navy }, good && { color: colors.olive }, bad && { color: colors.crimson }]}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {checked === null ? (
        <View style={s.bar}><Btn title="Verificar" disabled={!answerText} onPress={check} /></View>
      ) : (
        <View style={[s.bar, { backgroundColor: checked ? colors.oliveSoft : colors.crimsonSoft }]}>
          <Text style={[s.fbTitle, { color: checked ? colors.olive : colors.crimson }]}>{checked ? '✔ Muito bem!' : '✖ Quase! Perdeu um escudo'}</Text>
          {!checked && <P style={{ color: colors.crimson }}>Resposta: <Text style={{ fontFamily: fonts.sansBold }}>{ex.answer}</Text></P>}
          <Btn kind={checked ? 'success' : 'danger'} title="Continuar" onPress={() => onDone(checked)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  prompt: { fontFamily: fonts.sansBold, fontSize: fs(17), color: colors.navy },
  big: { fontFamily: fonts.serif, fontSize: fs(24), color: colors.navy, textAlign: 'center', lineHeight: fs(24) * 1.35 },
  speaker: { width: 96, height: 84, borderRadius: radius.lg, backgroundColor: colors.navySoft, borderWidth: 2, borderColor: colors.navy, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center' },
  opt: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 5, borderColor: colors.line, backgroundColor: '#fff' },
  optSel: { borderColor: colors.navy, backgroundColor: colors.navySoft },
  optGood: { borderColor: colors.olive, backgroundColor: colors.oliveSoft },
  optBad: { borderColor: colors.crimson, backgroundColor: colors.crimsonSoft },
  optText: { fontFamily: fonts.sansMedium, fontSize: fs(17), color: colors.ink },
  answerBox: { minHeight: 70, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, backgroundColor: '#fff' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: fs(17), color: colors.ink },
  bar: { padding: space.md, gap: space.sm, borderTopWidth: 2, borderTopColor: colors.line },
  fbTitle: { fontFamily: fonts.serif, fontSize: fs(18) },
});
