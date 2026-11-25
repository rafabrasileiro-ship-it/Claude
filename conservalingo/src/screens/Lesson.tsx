import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Avatar, Btn, Card, H1, P, ProgressBar } from '../components/ui';
import ExerciseView from '../components/ExerciseView';
import { useStore } from '../store';
import { findLesson, people, units, dailyWisdom, wisdom } from '../engine/content';
import { buildLessonExercises, buildPracticeFromKeys, buildReviewExercises } from '../engine/exercises';
import { mulberry32 } from '../engine/rng';
import { dueKeys, review } from '../engine/srs';
import { rankFor, stars, touchStreak, weekKey } from '../engine/game';
import { say } from '../engine/audio';
import type { LessonRef } from './Home';
import type { Exercise } from '../types';

export default function LessonScreen({ target, onExit }: { target: LessonRef; onExit: () => void }) {
  const { profile, updateProfile } = useStore();
  const rnd = useMemo(() => mulberry32(Date.now() & 0xffffff), []);

  const meta = useMemo(() => {
    if (target.kind === 'lesson') {
      const f = findLesson(target.id)!;
      return { id: f.lesson.id, title: f.lesson.title, lesson: f.lesson, exercises: buildLessonExercises(f.unit, f.lesson, rnd), practice: false };
    }
    if (target.kind === 'review') {
      const u = units.find((x) => x.id === target.unitId)!;
      return { id: `${u.id}rev`, title: `Revisão: ${u.title}`, lesson: null, exercises: buildReviewExercises(u, rnd), practice: false };
    }
    return { id: 'practice', title: 'Treino de Virtude', lesson: null, exercises: buildPracticeFromKeys(dueKeys(profile.srs, Date.now(), 8), rnd), practice: true };
  }, []);

  const [phase, setPhase] = useState<'story' | 'quiz' | 'done' | 'failed'>(meta.lesson ? 'story' : 'quiz');
  const [queue, setQueue] = useState<Exercise[]>(meta.exercises);
  const [idx, setIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [gain, setGain] = useState({ talents: 0, xp: 0 });
  const [shieldsLeft, setShieldsLeft] = useState(profile.shields.count);

  if (!queue.length) {
    return <Empty onExit={onExit} />;
  }
  if (profile.shields.count === 0 && phase !== 'done') {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: fs(48) }}>🛡️</Text>
        <H1>Sem escudos de atenção</H1>
        <P style={{ textAlign: 'center' }}>Os escudos se recuperam com o tempo (1 a cada 30 min). Faça o Treino de Virtude para revisar o que já aprendeu.</P>
        <Btn title="Voltar" onPress={onExit} />
      </View>
    );
  }

  const onAnswer = (ex: Exercise, correct: boolean) => {
    const isSpeak = ex.kind === 'speak';
    updateProfile((p) => ({
      ...p,
      srs: isSpeak ? p.srs : { ...p.srs, [ex.id]: review(p.srs[ex.id], correct) },
      shields: correct || isSpeak ? p.shields : { count: Math.max(0, p.shields.count - 1), updatedAt: p.shields.count >= 5 ? Date.now() : p.shields.updatedAt },
    }));
    let nextQueue = queue;
    let nextErrors = errors;
    if (!correct && !isSpeak) {
      nextErrors += 1; setErrors(nextErrors);
      setShieldsLeft((n) => n - 1);
      nextQueue = [...queue, ex]; // repete o erro no fim da lição
      setQueue(nextQueue);
      if (shieldsLeft - 1 <= 0) { setPhase('failed'); return; }
    }
    if (idx + 1 >= nextQueue.length) finish(nextErrors);
    else setIdx(idx + 1);
  };

  const finish = (errs: number) => {
    const st = stars(errs);
    const talents = 10 + (errs === 0 ? 5 : 0) + (meta.practice ? 0 : 0);
    const xp = 20 + st * 5;
    setGain({ talents, xp });
    updateProfile((p0) => {
      const p = touchStreak(p0);
      const wk = p.weekXp.week === weekKey() ? p.weekXp.xp : 0;
      return {
        ...p, talents: p.talents + talents, xp: p.xp + xp, weekXp: { week: weekKey(), xp: wk + xp },
        completed: meta.practice ? p.completed : { ...p.completed, [meta.id]: Math.max(p.completed[meta.id] ?? 0, st) },
        // Treino de Virtude restaura um escudo.
        shields: meta.practice ? { count: Math.min(5, p.shields.count + 1), updatedAt: Date.now() } : p.shields,
      };
    });
    setPhase('done');
  };

  if (phase === 'story' && meta.lesson) {
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <H1>{meta.lesson.title}</H1>
        <P style={{ color: colors.muted }}>Leia o diálogo ilustrado. Toque em um balão para ouvir.</P>
        {meta.lesson.dialogue.map((d, i) => {
          const who = people[d.who];
          const right = i % 2 === 1;
          return (
            <Pressable key={i} onPress={() => say(d.en, who?.sex ?? 'M')} style={[s.row, right && { flexDirection: 'row-reverse' }]}>
              <View style={{ alignItems: 'center', width: 76 }}>
                <Avatar emoji={who?.emoji ?? '🙂'} color={who?.color ?? colors.navy} />
                <Text style={s.who}>{who?.name}</Text>
              </View>
              <View style={[s.bubble, right && { backgroundColor: colors.navySoft }]}>
                <Text style={s.en}>{d.en} 🔊</Text>
                <Text style={s.pt}>{d.pt}</Text>
              </View>
            </Pressable>
          );
        })}
        <Card style={{ backgroundColor: colors.goldSoft }}>
          <Text style={s.who}>Vocabulário</Text>
          {meta.lesson.vocab.map((v) => (
            <Pressable key={v.en} onPress={() => say(v.en)}><P>🔊 <Text style={{ fontFamily: fonts.sansBold }}>{v.en}</Text> — {v.pt}</P></Pressable>
          ))}
        </Card>
        <Btn title="Começar exercícios" onPress={() => setPhase('quiz')} />
        <Btn kind="ghost" title="Sair" onPress={onExit} />
      </ScrollView>
    );
  }

  if (phase === 'failed') {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: fs(48) }}>🛡️</Text>
        <H1>Escudos esgotados</H1>
        <P style={{ textAlign: 'center' }}>Estude com calma e atenção. Volte quando os escudos se recuperarem, ou use o Treino de Virtude.</P>
        <Btn title="Voltar à trilha" onPress={onExit} />
      </View>
    );
  }

  if (phase === 'done') {
    const w = wisdom[(meta.id.length * 7 + idx + gain.xp) % wisdom.length];
    const st = stars(errors);
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={{ fontSize: fs(52), textAlign: 'center' }}>{'⭐'.repeat(st)}</Text>
        <H1 style={{ textAlign: 'center' }}>Lição concluída!</H1>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <P>🪙 +{gain.talents} Talentos</P><P>🎖️ +{gain.xp} XP</P><P>❌ {errors} erros</P>
        </Card>
        <Card style={{ backgroundColor: colors.navy, gap: space.sm }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansBold, letterSpacing: 1 }}>SABEDORIA DO DIA</Text>
          <Text style={{ color: '#fff', fontFamily: fonts.serif, fontSize: fs(18), lineHeight: 28 }}>“{w.en}”</Text>
          <Text style={{ color: '#D7DEEA', fontFamily: fonts.sans }}>{w.pt}</Text>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansMedium }}>— {w.source}</Text>
          <Btn kind="gold" title="🔊 Ouvir" onPress={() => say(w.en)} />
        </Card>
        <Btn title="Continuar" onPress={onExit} />
      </ScrollView>
    );
  }

  const cur = queue[idx];
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable onPress={onExit} accessibilityLabel="Sair da lição"><Text style={{ fontSize: fs(22), color: colors.muted }}>✕</Text></Pressable>
        <View style={{ flex: 1 }}><ProgressBar value={idx / queue.length} /></View>
        <Text style={{ fontFamily: fonts.sansBold, color: shieldsLeft ? colors.olive : colors.crimson }}>🛡️ {Math.max(0, shieldsLeft)}</Text>
      </View>
      <ExerciseView key={`${cur.id}-${idx}`} ex={cur} onDone={(ok) => onAnswer(cur, ok)} />
    </ScrollView>
  );
}

function Empty({ onExit }: { onExit: () => void }) {
  return (
    <View style={s.center}>
      <Text style={{ fontSize: fs(48) }}>🌾</Text>
      <H1>Nada para revisar</H1>
      <Btn title="Voltar" onPress={onExit} />
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.line, gap: 4 },
  en: { fontFamily: fonts.serif, fontSize: fs(15), color: colors.navy, lineHeight: 22 },
  pt: { fontFamily: fonts.sans, fontSize: fs(13), color: colors.muted },
  who: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, marginTop: 2, textAlign: 'center' },
});
