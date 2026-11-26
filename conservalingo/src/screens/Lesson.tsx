import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar } from '../components/ui';
import ExerciseView from '../components/ExerciseView';
import Bento, { type BentoMood } from '../components/Bento';
import { Bubbles, useDialogue } from '../components/Dialogue';
import ChronicleScreen from './Chronicle';
import { useStore } from '../store';
import { levelContent, people, wisdom, wisdomById } from '../engine/content';
import { blockOf, itemOf, lessonId, levelDef, slotDef } from '../engine/levels';
import { buildLesson, buildPhonPractice, buildPractice, isGraded } from '../engine/exercises';
import { mulberry32 } from '../engine/rng';
import { review } from '../engine/srs';
import { bump, dayKey, hash, stars } from '../engine/game';
import { completeLesson, type LessonResult } from '../engine/progress';
import { recordPhon } from '../engine/pron';
import { say, sayPt } from '../engine/audio';
import { fx } from '../engine/fx';
import { futurePacing, identityLine, praise, presupposition, seedOf } from '../engine/pnl';
import type { LessonRef } from '../nav';
import type { Dialogue, Exercise, LevelContent, LessonSpec, Listening } from '../types';

type Phase = 'intro' | 'story' | 'station' | 'quiz' | 'done' | 'future' | 'failed';
const MOOD: Record<string, BentoMood> = { fundamento: 'orgulhoso', construcao: 'pensativo', escuta: 'pensativo', dialogo: 'incentivador', fala: 'incentivador',
  escrita: 'pensativo', intercalacao: 'alerta', cronica: 'saudacao', revisao: 'alerta', checkpoint: 'saudacao' };

export default function LessonScreen({ target, onExit }: { target: LessonRef; onExit: () => void }) {
  if (target.kind === 'lesson' && levelContent(target.levelId)?.lessons[target.slot - 1]?.type === 'cronica') {
    return <ChronicleScreen levelId={target.levelId} onExit={onExit} />;
  }
  return <Session target={target} onExit={onExit} />;
}

function Session({ target, onExit }: { target: LessonRef; onExit: () => void }) {
  const { profile, updateProfile } = useStore();
  const rnd = useMemo(() => mulberry32(Date.now() & 0xffffff), []);

  const meta = useMemo(() => {
    if (target.kind === 'lesson') {
      const lv = levelContent(target.levelId)!;
      const { spec, exercises } = buildLesson(lv, target.slot, profile, rnd);
      return { id: lessonId(lv.id, target.slot), lv, spec, exercises, title: spec.title, type: spec.type };
    }
    if (target.kind === 'practice') return { id: 'practice', exercises: buildPractice(profile, rnd), title: 'Treino de Revisão & Pronúncia', type: 'practice' as const };
    return { id: 'phon', exercises: buildPhonPractice(profile), title: 'Treino de Pronúncia', type: 'phon' as const };
  }, []);
  const lv = 'lv' in meta ? meta.lv : undefined;
  const spec = 'spec' in meta ? meta.spec : undefined;
  const recovery = meta.type === 'practice' || meta.type === 'phon'; // sessões de recuperação não gastam escudos

  const [phase, setPhase] = useState<Phase>(spec ? 'intro' : 'quiz');
  const [queue, setQueue] = useState<Exercise[]>(meta.exercises);
  const [idx, setIdx] = useState(0);
  const [errors, setErrors] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [wisdomId, setWisdomId] = useState<string | null>(null);
  const [shieldsLeft, setShieldsLeft] = useState(profile.shields.count);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [comboTalents, setComboTalents] = useState(0);

  if (!queue.length) return <Empty onExit={onExit} phon={meta.type === 'phon'} />;
  if (!recovery && profile.shields.count === 0 && (phase === 'quiz' || phase === 'intro')) {
    return (
      <View style={s.center}>
        <Bento mood="alerta" size={110} />
        <H1 style={{ textAlign: 'center' }}>Sem Escudos de Atenção</H1>
        <P style={{ textAlign: 'center' }}>Os escudos se recuperam com o tempo (1 a cada 30 min) ou com o Treino de Revisão & Pronúncia na Trilha.</P>
        <Btn title="Voltar" onPress={onExit} />
      </View>
    );
  }

  const onAnswer = (ex: Exercise, correct: boolean) => {
    const g = isGraded(ex);
    updateProfile((p) => ({
      ...p,
      srs: g && ex.srsKey ? { ...p.srs, [ex.srsKey]: review(p.srs[ex.srsKey], correct) } : p.srs,
      shields: correct || !g || recovery ? p.shields : { count: Math.max(0, p.shields.count - 1), updatedAt: p.shields.count >= 5 ? Date.now() : p.shields.updatedAt },
    }));
    let nextQueue = queue;
    let nextErrors = errors;
    if (g) {
      if (correct) {
        const c = combo + 1;
        setCombo(c); setBestCombo((b) => Math.max(b, c));
        setComboTalents((t) => t + (c >= 5 ? 2 : 1));
        if (c === 3 || c === 5) fx('combo');
      } else {
        setCombo(0);
        nextErrors += 1; setErrors(nextErrors);
        nextQueue = [...queue, { ...ex, id: `${ex.id}~${queue.length}` }]; // o erro volta no fim da lição
        setQueue(nextQueue);
        if (!recovery) {
          setShieldsLeft((n) => n - 1);
          if (shieldsLeft - 1 <= 0) { setPhase('failed'); return; }
        }
      }
    }
    if (idx + 1 >= nextQueue.length) finish(nextErrors);
    else setIdx(idx + 1);
  };

  const finish = (errs: number) => {
    const wid = meta.type === 'checkpoint' && lv ? lv.wisdom : wisdom[(hash(meta.id + dayKey()) >>> 0) % wisdom.length].id;
    setWisdomId(wid);
    fx('level');
    const opts = { lessonId: lv ? meta.id : undefined, type: meta.type, errors: errs, bonusTalents: comboTalents, wisdomId: wid };
    setResult(completeLesson(profile, opts).r); // números exibidos na tela
    updateProfile((p0) => completeLesson(p0, opts).p);
    setPhase('done');
  };

  if (phase === 'intro' && spec && lv) return <Intro lv={lv} spec={spec} onStart={() => setPhase(spec.type === 'dialogo' ? 'story' : spec.type === 'escuta' ? 'station' : 'quiz')} onExit={onExit} />;
  if (phase === 'story' && spec && lv) {
    const dlg = lv.dialogues.find((d) => d.id === spec.dialogue) ?? lv.dialogues[0];
    return <Story lv={lv} dialogue={dlg} onStart={() => setPhase('quiz')} onExit={onExit} />;
  }
  if (phase === 'station' && lv) return <Station listening={lv.listening} onStart={() => setPhase('quiz')} onExit={onExit} />;

  if (phase === 'failed') {
    return (
      <View style={s.center}>
        <Bento mood="alerta" size={110} />
        <H1 style={{ textAlign: 'center' }}>Escudos esgotados</H1>
        <P style={{ textAlign: 'center' }}>Ajuste de Rota: estude com calma e atenção. Volte quando os escudos se recuperarem, ou faça o Treino de Revisão & Pronúncia.</P>
        <Btn title="Voltar" onPress={onExit} />
      </View>
    );
  }

  if (phase === 'future' && lv) {
    return <FuturePacing lines={futurePacing(lv.pnl.futurePacing, profile.anchor)} title={levelDef(lv.id)?.title ?? lv.title} onExit={onExit} />;
  }

  if (phase === 'done') {
    const w = wisdomById(wisdomId ?? '') ?? wisdom[0];
    const res = result ?? { talents: 0, xp: 0, gold: 0, stars: stars(errors) };
    const checkpoint = meta.type === 'checkpoint';
    const def = lv ? levelDef(lv.id) : undefined;
    const cast0 = def ? blockOf(def).cast[0] : 'bento';
    const pr = praise(cast0, profile.name);
    const seed = seedOf(meta.id + profile.xp);
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <View style={{ alignItems: 'center' }}><Bento mood={errors === 0 || checkpoint ? 'celebracao' : 'orgulhoso'} size={110} /></View>
        {errors === 0 && !recovery ? <WaxSeal /> : <Text style={{ fontSize: fs(40), textAlign: 'center' }}>{'⭐'.repeat(res.stars)}</Text>}
        <H1 style={{ textAlign: 'center' }}>{checkpoint ? 'Checkpoint de Honra concluído!' : recovery ? 'Treino concluído!' : errors === 0 ? 'Sem nenhum erro!' : 'Lição concluída!'}</H1>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6 }}>
          <P>🪙 +{res.talents}</P><P>🎖️ +{res.xp} XP</P>{res.gold > 0 && <P style={{ fontFamily: fonts.sansBold, color: colors.gold }}>🥇 +{res.gold} Talento{res.gold > 1 ? 's' : ''} de Ouro</P>}
          <P>❌ {errors} erro{errors === 1 ? '' : 's'}</P>{bestCombo >= 3 && <P>🔥 Foco Firme ×{bestCombo}</P>}
          {recovery && <P>🛡️ +1 escudo</P>}
        </Card>
        <Card style={{ backgroundColor: colors.goldSoft, gap: space.sm }}>
          <Text style={s.kicker}>QUEM VOCÊ ESTÁ SE TORNANDO</Text>
          <P style={{ fontFamily: fonts.serif, color: colors.navy }}>{checkpoint && lv ? lv.pnl.identity : identityLine(seed)}</P>
          {profile.anchor ? <P>⚓ Sua âncora: <Text style={{ fontFamily: fonts.sansBold }}>{profile.anchor}</Text></P> : null}
          <P style={{ color: colors.muted }}>{checkpoint && lv ? lv.pnl.presupposition : presupposition(seed)}</P>
        </Card>
        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Text style={{ fontSize: fs(34) }}>{pr.emoji}</Text>
          <P style={{ flex: 1 }}>{pr.text}</P>
        </Card>
        {meta.type === 'escuta' && lv && <Transcript listening={lv.listening} />}
        <Card style={{ backgroundColor: colors.navy, gap: space.sm }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansBold, letterSpacing: 1 }}>SABEDORIA DO DIA</Text>
          <Text style={{ color: '#fff', fontFamily: fonts.serif, fontSize: fs(17), lineHeight: fs(17) * 1.5 }}>“{w.en}”</Text>
          <Text style={{ color: '#D7DEEA', fontFamily: fonts.sans, fontSize: fs(14) }}>{w.pt}</Text>
          <Text style={{ color: colors.gold, fontFamily: fonts.sansMedium }}>— {w.source}</Text>
          <Btn kind="gold" title="🔊 Ouvir em inglês" onPress={() => say(w.en, 'M')} />
          <Btn kind="ghost" title="🇧🇷 Ouvir tradução" onPress={() => sayPt(w.pt)} />
          <Text style={{ color: '#B8C4D8', fontFamily: fonts.sans, fontSize: fs(12) }}>Guardado no Caderno de Campo → Provérbios.</Text>
        </Card>
        <Btn title={checkpoint ? 'Ensaio mental do nível' : 'Continuar'} onPress={() => (checkpoint ? setPhase('future') : onExit())} />
      </ScrollView>
    );
  }

  const cur = queue[idx];
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
        <Pressable onPress={onExit} accessibilityLabel="Sair da lição" hitSlop={12}><Text style={{ fontSize: fs(24), color: colors.muted }}>✕</Text></Pressable>
        <View style={{ flex: 1 }}><ProgressBar value={idx / queue.length} color={colors.gold} /></View>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: fs(16), color: shieldsLeft ? colors.olive : colors.crimson }}>{recovery ? '🛡️ ∞' : `🛡️ ${Math.max(0, shieldsLeft)}`}</Text>
      </View>
      {combo >= 3 && (
        <View style={[s.combo, combo >= 5 && { backgroundColor: colors.navy }]}>
          <Text style={s.comboT}>{combo >= 5 ? `💎 2× Talentos! · ${combo} seguidas` : `🔥 Foco Firme! · ${combo} seguidas`}</Text>
        </View>
      )}
      <ExerciseView key={`${cur.id}-${idx}`} ex={cur} onDone={(ok) => onAnswer(cur, ok)} asrAllowed={profile.asr !== false}
        onSpeakScore={(acc, words) => updateProfile((p) => { const q = recordPhon(p, words); return acc >= 0.9 ? bump(q, 'speakGood') : q; })} />
    </View>
  );
}

function Intro({ lv, spec, onStart, onExit }: { lv: LevelContent; spec: LessonSpec; onStart: () => void; onExit: () => void }) {
  const sd = slotDef(spec.slot);
  const def = levelDef(lv.id)!;
  return (
    <ScrollView contentContainerStyle={[s.pad, { alignItems: 'stretch', paddingTop: space.xl }]}>
      <View style={{ alignItems: 'center' }}><Bento mood={MOOD[spec.type] ?? 'orgulhoso'} size={120} /></View>
      <Text style={s.kickerC}>NÍVEL {def.n} · LIÇÃO {spec.slot} DE 10</Text>
      <Text style={s.slotT}>{sd.icon} {sd.title}</Text>
      <H1 style={{ textAlign: 'center' }}>{spec.title}</H1>
      <P style={{ textAlign: 'center' }}>{spec.objective}</P>
      <Card style={{ backgroundColor: colors.goldSoft }}><P style={{ fontStyle: 'italic', color: colors.navy, textAlign: 'center' }}>{spec.intro}</P></Card>
      <Btn title="Começar" onPress={onStart} />
      <Btn kind="ghost" title="Voltar" onPress={onExit} />
    </ScrollView>
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

function Empty({ onExit, phon }: { onExit: () => void; phon: boolean }) {
  return (
    <View style={s.center}>
      <Bento mood="orgulhoso" size={110} />
      <H1 style={{ textAlign: 'center' }}>{phon ? 'Nenhuma palavra para treinar' : 'Tudo em dia!'}</H1>
      <P style={{ textAlign: 'center' }}>{phon ? 'Quando o reconhecimento de fala marcar uma palavra em dourado ou vermelho, ela aparece aqui.' : 'Nenhum item precisa de revisão agora. Continue a trilha.'}</P>
      <Btn title="Voltar" onPress={onExit} />
    </View>
  );
}

function FuturePacing({ lines, title, onExit }: { lines: string[]; title: string; onExit: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= lines.length) return;
    const t = setTimeout(() => setI((x) => x + 1), 2500);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <View style={s.center}>
      <Bento mood="saudacao" size={110} />
      <H1 style={{ textAlign: 'center' }}>Ensaio Mental</H1>
      <Text style={s.kickerC}>{title.toUpperCase()}</Text>
      <Text style={{ fontFamily: fonts.serif, fontSize: fs(19), color: colors.navy, textAlign: 'center', lineHeight: fs(19) * 1.5, minHeight: 150 }}>{lines[Math.min(i, lines.length - 1)]}</Text>
      <View style={{ alignSelf: 'stretch' }}><ProgressBar value={Math.min(1, i / lines.length)} color={colors.gold} /></View>
      <Btn title={i >= lines.length ? 'Concluir' : 'Pular'} kind={i >= lines.length ? 'success' : 'ghost'} onPress={onExit} />
    </View>
  );
}

function Transcript({ listening }: { listening: Listening }) {
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={s.kicker}>TRANSCRIÇÃO · {listening.title.toUpperCase()}</Text>
      {listening.lines.map((d, i) => (
        <Pressable key={i} onPress={() => say(d.en, people[d.who]?.sex ?? 'M')}>
          <P><Text style={{ fontFamily: fonts.sansBold }}>{people[d.who]?.name}: </Text>{d.en}{'\n'}<Text style={{ color: colors.muted }}>{d.pt}</Text></P>
        </Pressable>
      ))}
    </Card>
  );
}

function Story({ lv, dialogue, onStart, onExit }: { lv: LevelContent; dialogue: Dialogue; onStart: () => void; onExit: () => void }) {
  const [slow, setSlow] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<number[]>([]);
  const { play, stop, playLine, playAll } = useDialogue(dialogue.lines, slow, (i) => scroll.current?.scrollTo({ y: Math.max(0, (ys.current[i] ?? 0) - 120), animated: true }));
  const vocab = (dialogue.vocab ?? []).map((r) => itemOf(lv, r)).filter(Boolean);
  return (
    <ScrollView ref={scroll} contentContainerStyle={s.pad}>
      <H1>{dialogue.title}</H1>
      <P style={{ color: colors.muted }}>Ouça a conversa: cada palavra aparece no instante em que é falada. Toque em um balão para ouvir só ele.</P>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title="▶ Ouvir" onPress={playAll} />}
        </View>
        <View style={{ flex: 1 }}>
          <Btn kind={slow ? 'success' : 'ghost'} style={{ paddingHorizontal: 6 }} title={slow ? '🐢 Devagar ✓' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
        </View>
      </View>
      <Bubbles lines={dialogue.lines} play={play} onTap={(i) => playLine(i, false)} onLayoutLine={(i, y) => { ys.current[i] = y; }} />
      {vocab.length > 0 && (
        <Card style={{ backgroundColor: colors.goldSoft }}>
          <Text style={s.kicker}>BLOCOS DE EXPRESSÃO</Text>
          {vocab.map((v) => (
            <Pressable key={v!.ref} onPress={() => say(v!.en, 'M')}><P>🔊 <Text style={{ fontFamily: fonts.sansBold }}>{v!.en}</Text> — {v!.pt}</P></Pressable>
          ))}
        </Card>
      )}
      <Btn title="Praticar a conversa" onPress={() => { stop(); onStart(); }} />
      <Btn kind="ghost" title="Sair" onPress={() => { stop(); onExit(); }} />
    </ScrollView>
  );
}

/** Escuta Ativa: áudio SEM texto; o aluno entende pelo ouvido e depois responde. */
function Station({ listening, onStart, onExit }: { listening: Listening; onStart: () => void; onExit: () => void }) {
  const [slow, setSlow] = useState(false);
  const [heard, setHeard] = useState(0);
  const { play, stop, playAll } = useDialogue(listening.lines, slow, undefined, () => setHeard((n) => n + 1));
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>🎧 {listening.title}</H1>
      <P style={{ color: colors.muted }}>Ouça sem ler. Depois responda às perguntas e faça o ditado. Ouça quantas vezes quiser, inclusive devagar.</P>
      <View style={s.radio}>
        <Bento mood={play ? 'incentivador' : 'pensativo'} size={90} />
        <Text style={{ fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.navy, textAlign: 'center' }}>
          {play ? `Falando: ${people[listening.lines[play.line].who]?.name}` : heard ? 'Ouvido! Ouça de novo ou responda.' : 'Toque para ouvir'}
        </Text>
      </View>
      {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title={heard ? '🔁 Ouvir de novo' : '▶ Ouvir o diálogo'} onPress={playAll} />}
      <Btn kind={slow ? 'success' : 'ghost'} title={slow ? '🐢 Devagar ✓' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
      <Btn title="Responder" disabled={!heard} onPress={() => { stop(); onStart(); }} />
      <Btn kind="ghost" title="Sair" onPress={() => { stop(); onExit(); }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  kicker: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, letterSpacing: 1 },
  kickerC: { fontFamily: fonts.sansBold, fontSize: fs(12), color: colors.muted, letterSpacing: 1.2, textAlign: 'center' },
  slotT: { fontFamily: fonts.sansBold, fontSize: fs(16), color: colors.cobalt, textAlign: 'center' },
  combo: { marginHorizontal: space.md, marginBottom: space.sm, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center' },
  comboT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(14) },
  seal: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.gold, borderWidth: 6, borderColor: '#8A6508', alignItems: 'center', justifyContent: 'center' },
  sealT: { color: '#fff', fontSize: fs(30) },
  sealS: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(14) },
  radio: { alignItems: 'center', gap: 6, padding: space.lg, backgroundColor: colors.navySoft, borderRadius: radius.lg },
});
