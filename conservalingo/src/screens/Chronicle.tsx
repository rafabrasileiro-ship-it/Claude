import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar } from '../components/ui';
import { Bubbles, useDialogue } from '../components/Dialogue';
import Bento from '../components/Bento';
import { useStore } from '../store';
import { levelContent, people, wisdom } from '../engine/content';
import { lessonId, levelDef } from '../engine/levels';
import { completeLesson, type LessonResult } from '../engine/progress';
import { dayKey, hash } from '../engine/game';
import { fx } from '../engine/fx';
import { hasClip, say } from '../engine/audio';
import { identityLine, seedOf } from '../engine/pnl';
import { mulberry32, shuffle } from '../engine/rng';
import type { ChronicleData } from '../types';

const KIND = { deduce: '🔎 Deduza o desfecho', moral: '⚖️ Escolha a atitude correta', complete: '✍️ Complete a fala' } as const;

function Segment({ seg, slow, onAnswer, answered, seed }: { seg: ChronicleData['segments'][number]; slow: boolean; onAnswer: (ok: boolean, pick: string) => void; answered: string | null; seed: number }) {
  const { play, stop, playLine, playAll } = useDialogue(seg.lines, slow);
  const st = seg.stop;
  const options = useMemo(() => shuffle(st.options, mulberry32(seed)), [seed]);
  return (
    <View style={{ gap: space.md }}>
      <Bubbles lines={seg.lines} play={play} onTap={(i) => playLine(i, false)} />
      {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title="▶ Ouvir a cena" onPress={playAll} />}
      <Card style={{ gap: space.sm, borderColor: colors.gold, borderWidth: 2 }}>
        <Text style={s.kicker}>PONTO DE PARADA · {KIND[st.kind]}</Text>
        <Text style={s.q}>{st.q}</Text>
        {options.map((o) => {
          const picked = answered === o; const show = answered !== null;
          const good = show && o === st.answer; const bad = show && picked && !good;
          return (
            <Pressable key={o} disabled={show} onPress={() => { onAnswer(o === st.answer, o); if (st.lang !== 'pt' && hasClip(o)) say(o, 'M'); }}
              accessibilityRole="button" style={[s.opt, good && { borderColor: colors.olive, backgroundColor: colors.oliveSoft }, bad && { borderColor: colors.crimson, backgroundColor: colors.crimsonSoft }]}>
              <Text style={[s.optT, good && { color: colors.olive }, bad && { color: colors.crimson }]}>{o}</Text>
            </Pressable>
          );
        })}
        {answered !== null && (
          <P style={{ color: answered === st.answer ? colors.olive : colors.crimson }}>
            {answered === st.answer ? '✔ Muito bem! ' : '🧭 Ajuste de Rota. '}{st.why}
          </P>
        )}
      </Card>
    </View>
  );
}

/** Lição 8 de cada nível: Crônica Interativa com 4 pontos de parada. */
export default function ChronicleScreen({ levelId, onExit }: { levelId: string; onExit: () => void }) {
  const lv = levelContent(levelId)!;
  const c = lv.chronicle;
  const def = levelDef(levelId)!;
  const id = lessonId(levelId, 8);
  const { profile, updateProfile } = useStore();
  const [seg, setSeg] = useState(-1); // -1 = abertura
  const [answers, setAnswers] = useState<(string | null)[]>(c.segments.map(() => null));
  const [errors, setErrors] = useState(0);
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const baseSeed = useMemo(() => Date.now() & 0xffff, []);

  const finish = () => {
    fx('level');
    const wid = wisdom[(hash(id + dayKey()) >>> 0) % wisdom.length].id;
    const opts = { lessonId: id, type: 'cronica' as const, errors, wisdomId: wid };
    setResult(completeLesson(profile, opts).r);
    updateProfile((p0) => completeLesson(p0, opts).p);
  };

  if (result) {
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <View style={{ alignItems: 'center' }}><Bento mood="celebracao" size={110} /></View>
        <H1 style={{ textAlign: 'center' }}>{c.icon} Crônica concluída!</H1>
        <Card style={{ alignItems: 'center', gap: 4 }}>
          <P>{'⭐'.repeat(result.stars)} · {errors} ajuste{errors === 1 ? '' : 's'} de rota</P>
          <P>🪙 +{result.talents} · 🎖️ +{result.xp} XP</P>
        </Card>
        <Card style={{ backgroundColor: colors.goldSoft, gap: space.sm }}>
          <Text style={s.kicker}>QUEM VOCÊ ESTÁ SE TORNANDO</Text>
          <P style={{ fontFamily: fonts.serif, color: colors.navy }}>{identityLine(seedOf(id + profile.xp))}</P>
          {profile.anchor ? <P>⚓ Sua âncora: <Text style={{ fontFamily: fonts.sansBold }}>{profile.anchor}</Text></P> : null}
        </Card>
        <Btn title="Continuar" onPress={onExit} />
      </ScrollView>
    );
  }

  if (seg < 0) {
    return (
      <ScrollView contentContainerStyle={[s.pad, { paddingTop: space.xl }]}>
        <View style={{ alignItems: 'center' }}><Bento mood="saudacao" size={120} /></View>
        <Text style={s.kickerC}>NÍVEL {def.n} · LIÇÃO 8 DE 10 · 📜 CRÔNICA INTERATIVA</Text>
        <H1 style={{ textAlign: 'center' }}>{c.icon} {c.title}</H1>
        <P style={{ textAlign: 'center' }}>{c.intro}</P>
        <P style={{ textAlign: 'center', color: colors.muted }}>Com {c.cast.map((x) => people[x]?.name).join(', ').replace(/, ([^,]*)$/, ' e $1')}.</P>
        <Card style={{ backgroundColor: colors.goldSoft }}><P style={{ fontStyle: 'italic', color: colors.navy, textAlign: 'center' }}>{lv.lessons[7]?.intro}</P></Card>
        <Btn title="Começar a crônica" onPress={() => setSeg(0)} />
        <Btn kind="ghost" title="Voltar" onPress={onExit} />
      </ScrollView>
    );
  }

  const last = seg === c.segments.length - 1;
  return (
    <ScrollView ref={scroll} contentContainerStyle={s.pad}>
      <Pressable onPress={onExit} hitSlop={12}><Text style={{ fontSize: fs(20), color: colors.muted }}>✕ Sair</Text></Pressable>
      <H1>{c.icon} {c.title}</H1>
      <ProgressBar value={(seg + (answers[seg] !== null ? 1 : 0)) / c.segments.length} color={colors.gold} />
      <Btn kind={slow ? 'success' : 'ghost'} title={slow ? '🐢 Devagar ✓' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
      {c.segments.map((sg, i) => i <= seg && (
        <Segment key={i} seg={sg} slow={slow} answered={answers[i]} seed={baseSeed + i}
          onAnswer={(ok, pick) => { setAnswers((a) => a.map((x, k) => (k === i ? pick : x))); fx(ok ? 'ok' : 'bad'); if (!ok) setErrors((e) => e + 1); }} />
      ))}
      {answers[seg] !== null && (last
        ? <Btn kind="success" title="Concluir a crônica" onPress={finish} />
        : <Btn title="Próximo trecho" onPress={() => { setSeg(seg + 1); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250); }} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 80 },
  kicker: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, letterSpacing: 1 },
  kickerC: { fontFamily: fonts.sansBold, fontSize: fs(12), color: colors.muted, letterSpacing: 1.2, textAlign: 'center' },
  q: { fontFamily: fonts.sansBold, fontSize: fs(17), color: colors.navy },
  opt: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, backgroundColor: '#fff' },
  optT: { fontFamily: fonts.sansMedium, fontSize: fs(16), color: colors.ink },
});
