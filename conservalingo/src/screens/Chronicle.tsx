import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar } from '../components/ui';
import { Bubbles, useDialogue } from '../components/Dialogue';
import { useStore } from '../store';
import { chronicles, people, type Chronicle } from '../engine/content';
import { bump, stars, touchStreak, weekKey } from '../engine/game';
import { fx } from '../engine/fx';
import { say } from '../engine/audio';
import { identityLine, seedOf } from '../engine/pnl';

const KIND = { deduce: '🔎 Deduza o desfecho', moral: '⚖️ Escolha a atitude correta', complete: '✍️ Complete a fala' } as const;

function Segment({ seg, slow, onAnswer, answered }: { seg: Chronicle['segments'][number]; slow: boolean; onAnswer: (ok: boolean, pick: string) => void; answered: string | null }) {
  const { play, stop, playLine, playAll } = useDialogue(seg.lines, slow);
  const st = seg.stop;
  return (
    <View style={{ gap: space.md }}>
      <Bubbles lines={seg.lines} play={play} onTap={(i) => playLine(i, false)} />
      {play ? <Btn kind="ghost" title="⏹ Parar" onPress={stop} /> : <Btn kind="gold" title="▶ Ouvir a cena" onPress={playAll} />}
      <Card style={{ gap: space.sm, borderColor: colors.gold, borderWidth: 2 }}>
        <Text style={s.kicker}>PONTO DE PARADA · {KIND[st.kind]}</Text>
        <Text style={s.q}>{st.q}</Text>
        {st.options.map((o) => {
          const picked = answered === o; const show = answered !== null;
          const good = show && o === st.answer; const bad = show && picked && !good;
          return (
            <Pressable key={o} disabled={show} onPress={() => { onAnswer(o === st.answer, o); say(o, 'M'); }}
              style={[s.opt, good && { borderColor: colors.olive, backgroundColor: colors.oliveSoft }, bad && { borderColor: colors.crimson, backgroundColor: colors.crimsonSoft }]}>
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

export default function ChronicleScreen({ id, onExit }: { id: string; onExit: () => void }) {
  const c = chronicles.find((x) => x.id === id)!;
  const { profile, updateProfile } = useStore();
  const [seg, setSeg] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(c.segments.map(() => null));
  const [errors, setErrors] = useState(0);
  const [slow, setSlow] = useState(false);
  const [done, setDone] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const finish = () => {
    const st = stars(errors);
    fx('level');
    updateProfile((p0) => {
      let p = touchStreak(p0);
      const wk = p.weekXp.week === weekKey() ? p.weekXp.xp : 0;
      const xp = 30 + st * 5;
      p = { ...p, talents: p.talents + 20 + (errors === 0 ? 10 : 0), xp: p.xp + xp, weekXp: { week: weekKey(), xp: wk + xp }, completed: { ...p.completed, [c.id]: Math.max(p.completed[c.id] ?? 0, st) } };
      p = bump(p, 'chronicles');
      if (new Date().getHours() < 8) p = bump(p, 'early');
      return p;
    });
    setDone(true);
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={{ fontSize: fs(52), textAlign: 'center' }}>{c.icon}</Text>
        <H1 style={{ textAlign: 'center' }}>Crônica concluída!</H1>
        <Card style={{ alignItems: 'center' }}><P>{'⭐'.repeat(stars(errors))} · {errors} ajuste(s) de rota · 🪙 +{20 + (errors === 0 ? 10 : 0)}</P></Card>
        <Card style={{ backgroundColor: colors.goldSoft, gap: space.sm }}>
          <Text style={s.kicker}>QUEM VOCÊ ESTÁ SE TORNANDO</Text>
          <P style={{ fontFamily: fonts.serif, color: colors.navy }}>{identityLine(seedOf(c.id + profile.xp))}</P>
          {profile.anchor ? <P>⚓ Sua âncora: <Text style={{ fontFamily: fonts.sansBold }}>{profile.anchor}</Text></P> : null}
        </Card>
        <Btn title="Voltar à trilha" onPress={onExit} />
      </ScrollView>
    );
  }

  const last = seg === c.segments.length - 1;
  return (
    <ScrollView ref={scroll} contentContainerStyle={s.pad}>
      <Pressable onPress={onExit}><Text style={{ fontSize: fs(22), color: colors.muted }}>✕ Sair</Text></Pressable>
      <H1>{c.icon} {c.title}</H1>
      <P style={{ color: colors.muted }}>{c.intro} Com {c.cast.map((x) => people[x]?.name).join(' e ')}.</P>
      <ProgressBar value={(seg + (answers[seg] !== null ? 1 : 0)) / c.segments.length} color={colors.gold} />
      <Btn kind={slow ? 'success' : 'ghost'} title={slow ? '🐢 Devagar: ligado' : '🐢 Devagar'} onPress={() => setSlow((v) => !v)} />
      {c.segments.map((sg, i) => i <= seg && (
        <Segment key={i} seg={sg} slow={slow} answered={answers[i]}
          onAnswer={(ok, pick) => { setAnswers((a) => a.map((x, k) => (k === i ? pick : x))); fx(ok ? 'ok' : 'bad'); if (!ok) setErrors((e) => e + 1); }} />
      ))}
      {answers[seg] !== null && (last
        ? <Btn kind="success" title="Concluir a crônica" onPress={finish} />
        : <Btn title="Próximo trecho" onPress={() => { setSeg(seg + 1); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 200); }} />)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 80 },
  kicker: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.muted, letterSpacing: 1 },
  q: { fontFamily: fonts.serif, fontSize: fs(17), color: colors.navy },
  opt: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, backgroundColor: '#fff' },
  optT: { fontFamily: fonts.sansMedium, fontSize: fs(16), color: colors.ink },
});
