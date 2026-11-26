import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar } from '../components/ui';
import ExerciseView from '../components/ExerciseView';
import { Bubbles, useDialogue } from '../components/Dialogue';
import { useStore } from '../store';
import { findLesson, people, units, wisdom, stationOf } from '../engine/content';
import { buildLessonExercises, buildPracticeFromKeys, buildReviewExercises, buildStationExercises } from '../engine/exercises';
import { mulberry32 } from '../engine/rng';
import { dueKeys, review } from '../engine/srs';
import { bump, stars, touchStreak, weekKey } from '../engine/game';
import { say, sayPt } from '../engine/audio';
import { fx } from '../engine/fx';
import { ANCHORS, futurePacing, identityLine, praise, presupposition, seedOf } from '../engine/pnl';
import type { LessonRef } from './Home';
import type { Exercise } from '../types';

type Phase = 'story' | 'station' | 'quiz' | 'done' | 'future' | 'failed';
const isFree = (e: Exercise) => e.kind === 'speak' || e.kind === 'roleplay'; // fala: não gasta escudo

export default function LessonScreen({ target, onExit }: { target: LessonRef; onExit: () => void }) {
  const { profile, updateProfile } = useStore();
  const rnd = useMemo(() => mulberry32(Date.now() & 0xffffff), []);

  const meta = useMemo(() => {
    if (target.kind === 'lesson') {
      const f = findLesson(target.id)!;
      return { id: f.lesson.id, title: f.lesson.title, lesson: f.lesson, unitId: f.unit.id, exercises: buildLessonExercises(f.unit, f.lesson, rnd), practice: false, review: false, station: false };
    }
    if (target.kind === 'review') {
      const u = units.find((x) => x.id === target.unitId)!;
      return { id: `${u.id}rev`, title: `Desafio: ${u.title}`, lesson: null, unitId: u.id, exercises: buildReviewExercises(u, rnd), practice: false, review: true, station: false };
    }
    if (target.kind === 'listening') {
      const u = units.find((x) => x.id === target.unitId)!;
      return { id: `${u.id}lis`, title: `Estação de Escuta: ${stationOf(u.id)?.title ?? ''}`, lesson: null, unitId: u.id, exercises: buildStationExercises(u.id, rnd), practice: false, review: false, station: true };
    }
    return { id: 'practice', title: 'Treino de Virtude', lesson: null, unitId: '', exercises: buildPracticeFromKeys(dueKeys(profile.srs, Date.now(), 8), rnd), practice: true, review: false, station: false };
  }, []);

  const [phase, setPhase] = useState<Phase>(meta.lesson ? 'story' : meta.station ? 'station' : 'quiz');
  const [queue, setQueue] = useState<Exercise[]>(meta.exercises);
  const [idx, setIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [gain, setGain] = useState({ talents: 0, xp: 0 });
  const [shieldsLeft, setShieldsLeft] = useState(profile.shields.count);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [comboTalents, setComboTalents] = useState(0);

  if (!queue.length) return <Empty onExit={onExit} />;
  if (profile.shields.count === 0 && phase !== 'done' && phase !== 'future') {
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
    const free = isFree(ex);
    updateProfile((p) => ({
      ...p,
      srs: free ? p.srs : { ...p.srs, [ex.id]: review(p.srs[ex.id], correct) },
      shields: correct || free ? p.shields : { count: Math.max(0, p.shields.count - 1), updatedAt: p.shields.count >= 5 ? Date.now() : p.shields.updatedAt },
    }));
    let nextQueue = queue;
    let nextErrors = errors;
    if (!free) {
      if (correct) {
        const c = combo + 1;
        setCombo(c); setBestCombo((b) => Math.max(b, c));
        setComboTalents((t) => t + (c >= 5 ? 2 : 1));
        if (c === 3 || c === 5) fx('combo');
      } else setCombo(0);
    }
    if (!correct && !free) {
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
    const talents = 10 + (errs === 0 ? 5 : 0) + comboTalents;
    const xp = 20 + st * 5;
    setGain({ talents, xp });
    fx('level');
    updateProfile((p0) => {
      let p = touchStreak(p0);
      const wk = p.weekXp.week === weekKey() ? p.weekXp.xp : 0;
      p = {
        ...p, talents: p.talents + talents, xp: p.xp + xp, weekXp: { week: weekKey(), xp: wk + xp },
        completed: meta.practice ? p.completed : { ...p.completed, [meta.id]: Math.max(p.completed[meta.id] ?? 0, st) },
        // Treino de Virtude restaura um escudo.
        shields: meta.practice ? { count: Math.min(5, p.shields.count + 1), updatedAt: Date.now() } : p.shields,
      };
      if (meta.practice) p = bump(p, 'practice');
      else if (meta.station) p = bump(p, 'listening');
      else { p = bump(p, 'lessons'); if (errs === 0) p = bump(p, 'perfect'); }
      if (new Date().getHours() < 8) p = bump(p, 'early');
      return p;
    });
    setPhase('done');
  };

  if (phase === 'story' && meta.lesson) return <Story lesson={meta.lesson} onStart={() => setPhase('quiz')} onExit={onExit} />;
  if (phase === 'station') return <Station unitId={meta.unitId} onStart={() => setPhase('quiz')} onExit={onExit} />;

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

  if (phase === 'future') {
    const u = units.find((x) => x.id === meta.unitId);
    return <FuturePacing unitTitle={u?.title ?? ''} anchor={profile.anchor} onExit={onExit} />;
  }

  if (phase === 'done') {
    const w = wisdom[(meta.id.length * 7 + idx + gain.xp) % wisdom.length];
    const st = stars(errors);
    const unit = units.find((x) => x.id === meta.unitId);
    const pr = praise(unit?.cast[0] ?? 'bento', profile.name);
    const seed = seedOf(meta.id + profile.xp);
    return (
      <ScrollView contentContainerStyle={s.pad}>
        {errors === 0 && !meta.practice ? <WaxSeal /> : <Text style={{ fontSize: fs(52), textAlign: 'center' }}>{'⭐'.repeat(st)}</Text>}
        <H1 style={{ textAlign: 'center' }}>{errors === 0 ? 'Sem nenhum erro!' : meta.station ? 'Estação concluída!' : 'Lição concluída!'}</H1>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <P>🪙 +{gain.talents} Talentos</P><P>🎖️ +{gain.xp} XP</P><P>❌ {errors} erros</P>
          {bestCombo >= 3 && <P>🔥 Foco Firme ×{bestCombo}</P>}
        </Card>
        <Card style={{ backgroundColor: colors.goldSoft, gap: space.sm }}>
          <Text style={s.kicker}>QUEM VOCÊ ESTÁ SE TORNANDO</Text>
          <P style={{ fontFamily: fonts.serif, color: colors.navy }}>{identityLine(seed)}</P>
          {profile.anchor ? <P>⚓ Sua âncora: <Text style={{ fontFamily: fonts.sansBold }}>{profile.anchor}</Text></P> : null}
          <P style={{ color: colors.muted }}>{presupposition(seed)}</P>
        </Card>
        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Text style={{ fontSize: fs(34) }}>{pr.emoji}</Text>
          <P style={{ flex: 1 }}>{pr.text}</P>
        </Card>
        {meta.station && <Transcript unitId={meta.unitId} />}
        <Card style={{ backgroundColor: colors.navy, gap: space.sm }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansBold, letterSpacing: 1 }}>SABEDORIA DO DIA</Text>
          <Text style={{ color: '#fff', fontFamily: fonts.serif, fontSize: fs(18), lineHeight: 28 }}>“{w.en}”</Text>
          <Text style={{ color: '#D7DEEA', fontFamily: fonts.sans }}>{w.pt}</Text>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansMedium }}>— {w.source}</Text>
          <Btn kind="gold" title="🔊 Ouvir em inglês" onPress={() => say(w.en, 'M')} />
          <Btn kind="ghost" title="🇧🇷 Ouvir tradução" onPress={() => sayPt(w.pt)} />
        </Card>
        <Btn title={meta.review ? 'Ensaio mental da unidade' : 'Continuar'} onPress={() => (meta.review ? setPhase('future') : onExit())} />
      </ScrollView>
    );
  }

  const cur = queue[idx];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
        <Pressable onPress={onExit} accessibilityLabel="Sair da lição"><Text style={{ fontSize: fs(24), color: colors.muted }}>✕</Text></Pressable>
        <View style={{ flex: 1 }}><ProgressBar value={idx / queue.length} /></View>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: fs(16), color: shieldsLeft ? colors.olive : colors.crimson }}>🛡️ {Math.max(0, shieldsLeft)}</Text>
      </View>
      {combo >= 3 && (
        <View style={[s.combo, combo >= 5 && { backgroundColor: colors.navy }]}>
          <Text style={s.comboT}>{combo >= 5 ? `💎 2× Talentos! · ${combo} seguidas` : `🔥 Foco Firme! · ${combo} seguidas`}</Text>
        </View>
      )}
      <ExerciseView key={`${cur.id}-${idx}`} ex={cur} onDone={(ok) => onAnswer(cur, ok)}
        onSpeakScore={(acc) => { if (acc >= 0.9) updateProfile((p) => bump(p, 'speakGood')); }} />
    </View>
  );
}

function WaxSeal() {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={s.seal}><Text style={s.sealT}>✦</Text><Text style={s.sealS}>100%</Text></View>
      <Text style={{ fontFamily: fonts.sansBold, color: colors.gold, fontSize: fs(13), letterSpacing: 1 }}>SELO DE CERA DOURADO</Text>
    </View>
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

function FuturePacing({ unitTitle, anchor, onExit }: { unitTitle: string; anchor?: string; onExit: () => void }) {
  const steps = useMemo(() => futurePacing(unitTitle, anchor), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= steps.length) return;
    const t = setTimeout(() => setI((x) => x + 1), 2500);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <View style={s.center}>
      <Text style={{ fontSize: fs(48) }}>🦅</Text>
      <H1 style={{ textAlign: 'center' }}>Ensaio Mental</H1>
      <Text style={{ fontFamily: fonts.serif, fontSize: fs(20), color: colors.navy, textAlign: 'center', lineHeight: fs(20) * 1.5, minHeight: 130 }}>{steps[Math.min(i, steps.length - 1)]}</Text>
      <ProgressBar value={Math.min(1, i / steps.length)} color={colors.gold} />
      <Btn title={i >= steps.length ? 'Concluir' : 'Pular'} kind={i >= steps.length ? 'success' : 'ghost'} onPress={onExit} />
    </View>
  );
}

function Transcript({ unitId }: { unitId: string }) {
  const st = stationOf(unitId);
  if (!st) return null;
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={s.kicker}>TRANSCRIÇÃO</Text>
      {st.lines.map((d, i) => (
        <Pressable key={i} onPress={() => say(d.en, people[d.who]?.sex ?? 'M')}>
          <P><Text style={{ fontFamily: fonts.sansBold }}>{people[d.who]?.name}: </Text>{d.en}{'\n'}<Text style={{ color: colors.muted }}>{d.pt}</Text></P>
        </Pressable>
      ))}
    </Card>
  );
}

function Story({ lesson, onStart, onExit }: { lesson: NonNullable<ReturnType<typeof findLesson>>['lesson']; onStart: () => void; onExit: () => void }) {
  const [slow, setSlow] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<number[]>([]);
  const dlg = lesson.dialogue;
  const { play, stop, playLine, playAll } = useDialogue(dlg, slow, (i) => scroll.current?.scrollTo({ y: Math.max(0, (ys.current[i] ?? 0) - 120), animated: true }));
  return (
    <ScrollView ref={scroll} contentContainerStyle={s.pad}>
      <H1>{lesson.title}</H1>
      <P style={{ color: colors.muted }}>Ouça a história: cada palavra aparece no instante em que é falada. Toque em um balão para ouvir só ele.</P>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title="▶ Ouvir a história" onPress={playAll} />}
        </View>
        <View style={{ flex: 1 }}>
          <Btn kind={slow ? 'success' : 'ghost'} title={slow ? '🐢 Devagar: ligado' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
        </View>
      </View>
      <Bubbles lines={dlg} play={play} onTap={(i) => playLine(i, false)} onLayoutLine={(i, y) => { ys.current[i] = y; }} />
      <Card style={{ backgroundColor: colors.goldSoft }}>
        <Text style={s.kicker}>VOCABULÁRIO</Text>
        {lesson.vocab.map((v) => (
          <Pressable key={v.en} onPress={() => say(v.en, 'M')}><P>🔊 <Text style={{ fontFamily: fonts.sansBold }}>{v.en}</Text> — {v.pt}</P></Pressable>
        ))}
      </Card>
      <Btn title="Começar exercícios" onPress={() => { stop(); onStart(); }} />
      <Btn kind="ghost" title="Sair" onPress={() => { stop(); onExit(); }} />
    </ScrollView>
  );
}

/** Estação de Escuta: áudio SEM texto; o aluno entende pelo ouvido e depois responde 3 perguntas. */
function Station({ unitId, onStart, onExit }: { unitId: string; onStart: () => void; onExit: () => void }) {
  const st = stationOf(unitId)!;
  const [slow, setSlow] = useState(false);
  const [heard, setHeard] = useState(0);
  const { play, stop, playAll } = useDialogue(st.lines, slow, undefined, () => setHeard((n) => n + 1));
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>🎧 {st.title}</H1>
      <P style={{ color: colors.muted }}>Ouça o diálogo sem ler. Depois responda às perguntas. Você pode ouvir quantas vezes quiser, inclusive devagar.</P>
      <View style={s.radio}>
        <Text style={{ fontSize: fs(46) }}>{play ? '🔊' : '📻'}</Text>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.navy }}>{play ? `Falando: ${people[st.lines[play.line].who]?.name}` : heard ? 'Ouvido. Ouça de novo ou responda.' : 'Toque para ouvir'}</Text>
      </View>
      {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title={heard ? '🔁 Ouvir de novo' : '▶ Ouvir o diálogo'} onPress={playAll} />}
      <Btn kind={slow ? 'success' : 'ghost'} title={slow ? '🐢 Devagar: ligado' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
      <Btn title="Responder as perguntas" disabled={!heard} onPress={() => { stop(); onStart(); }} />
      <Btn kind="ghost" title="Sair" onPress={() => { stop(); onExit(); }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  kicker: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, letterSpacing: 1 },
  combo: { marginHorizontal: space.md, marginBottom: space.sm, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center' },
  comboT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(14) },
  seal: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.gold, borderWidth: 6, borderColor: '#8A6508', alignItems: 'center', justifyContent: 'center' },
  sealT: { color: '#fff', fontSize: fs(30) },
  sealS: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(14) },
  radio: { alignItems: 'center', gap: 6, padding: space.lg, backgroundColor: colors.navySoft, borderRadius: radius.lg },
});
