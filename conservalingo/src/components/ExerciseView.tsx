import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

  useEffect(() => { setChosen(null); setBuilt([]); setChecked(null); if (ex.kind === 'listen') say(ex.speak ?? ex.question); }, [ex.id]);

  const isBank = ex.kind === 'bank_en' || ex.kind === 'bank_pt';
  const answerText = isBank ? built.map((i) => ex.bank![i]).join(' ') : chosen ?? '';

  const check = () => {
    const ok = checkAnswer(ex, answerText);
    setChecked(ok);
    if (ok && ex.speak) say(ex.speak);
  };

  if (ex.kind === 'speak') {
    return (
      <View style={s.wrap}>
        <P style={s.prompt}>{ex.prompt}</P>
        <H1 style={{ textAlign: 'center', fontSize: fs(20) }}>{ex.question}</H1>
        <Btn kind="ghost" title="🔊 Ouvir pronúncia" onPress={() => say(ex.speak!)} />
        <Btn kind="ghost" title="🐢 Ouvir devagar" onPress={() => say(ex.speak!, 'M', true)} />
        {/* Reconhecimento de fala: trocar a autoavaliação por expo-speech-recognition quando disponível. */}
        <P style={{ textAlign: 'center', color: colors.muted }}>Repita em voz alta e avalie sua dicção com honestidade.</P>
        <Btn title="Falei com clareza ✓" onPress={() => onDone(true)} />
        <Btn kind="ghost" title="Vou praticar mais" onPress={() => onDone(true)} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <P style={s.prompt}>{ex.prompt}</P>
      {ex.kind === 'listen' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
          <Btn title="🔊 Ouvir" onPress={() => say(ex.speak!)} />
          <Btn kind="ghost" title="🐢 Devagar" onPress={() => say(ex.speak!, 'M', true)} />
        </View>
      ) : (
        <Pressable onPress={() => ex.speak && say(ex.speak)} accessibilityRole="button" accessibilityLabel="Ouvir frase">
          <H1 style={{ textAlign: 'center' }}>{ex.question} {ex.speak ? '🔊' : ''}</H1>
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
                style={[s.chip, built.includes(i) && { opacity: 0.25 }]}>
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
              <Pressable key={o} disabled={show} onPress={() => setChosen(o)} accessibilityRole="button"
                style={[s.opt, sel && { borderColor: colors.navy, backgroundColor: colors.navySoft }, good && { borderColor: colors.olive, backgroundColor: colors.oliveSoft }, bad && { borderColor: colors.crimson, backgroundColor: colors.crimsonSoft }]}>
                <Text style={s.optText}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {checked === null ? (
        <Btn title="Verificar" disabled={!answerText} onPress={check} />
      ) : (
        <View style={[s.feedback, { backgroundColor: checked ? colors.oliveSoft : colors.crimsonSoft }]}>
          <Text style={[s.fbTitle, { color: checked ? colors.olive : colors.crimson }]}>
            {checked ? 'Muito bem!' : 'Atenção: um escudo foi perdido'}
          </Text>
          {!checked && <P>Resposta correta: {ex.answer}</P>}
          <Btn kind={checked ? 'primary' : 'danger'} title="Continuar" onPress={() => onDone(checked)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.md },
  prompt: { fontFamily: fonts.sansMedium, color: colors.muted, textAlign: 'center' },
  opt: { padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  optText: { fontFamily: fonts.sansMedium, fontSize: fs(16), color: colors.ink },
  answerBox: { minHeight: 56, flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8, borderBottomWidth: 2, borderBottomColor: colors.line },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.sansMedium, fontSize: fs(16), color: colors.ink },
  feedback: { padding: space.md, borderRadius: radius.md, gap: space.sm },
  fbTitle: { fontFamily: fonts.serif, fontSize: fs(16) },
});
