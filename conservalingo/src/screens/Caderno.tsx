import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P } from '../components/ui';
import Bento from '../components/Bento';
import { useStore } from '../store';
import { levelContent, wisdom } from '../engine/content';
import { AVAILABLE, itemOf } from '../engine/levels';
import { retrievability } from '../engine/srs';
import { tipFor, weakWords } from '../engine/pron';
import { say } from '../engine/audio';
import type { LessonRef } from '../nav';

type Tab = 'blocos' | 'fonemas' | 'proverbios';
const pct = (r: number) => `${Math.round(r * 100)}%`;
const memColor = (r: number) => (r >= 0.9 ? colors.olive : r >= 0.7 ? colors.gold : colors.crimson);
const STATUS = { good: colors.olive, near: colors.gold, bad: colors.crimson } as const;

/** Caderno de Campo & Acervo de Legado (Livro de Honra). */
export default function Caderno({ onStart }: { onStart: (r: LessonRef) => void }) {
  const { profile, updateProfile } = useStore();
  const [tab, setTab] = useState<Tab>('blocos');
  const [open, setOpen] = useState<string | null>(null);

  // Blocos de Expressão: blocos lexicais já estudados (com cartão FSRS), agrupados por nível.
  const groups = useMemo(() => AVAILABLE.map((l) => {
    const lv = levelContent(l.id)!;
    const items = lv.chunks.filter((c) => profile.srs[`${l.id}:${c.id}`]).map((c) => ({ ...itemOf(lv, c.id)!, key: `${l.id}:${c.id}` }));
    return { level: l, items };
  }).filter((g) => g.items.length), [profile.srs]);
  const totalChunks = groups.reduce((a, g) => a + g.items.length, 0);
  const weak = weakWords(profile, 30);
  const allPhon = Object.values(profile.phon ?? {}).sort((a, b) => b.at - a.at);
  const proverbs = wisdom.filter((w) => profile.proverbs?.[w.id]);
  const memorized = proverbs.filter((w) => profile.proverbs[w.id].memorized).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.tabs}>
        {([['blocos', '🧩 Blocos'], ['fonemas', '🗣️ Fonemas'], ['proverbios', '📜 Provérbios']] as [Tab, string][]).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[s.tab, tab === id && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
            <Text style={[s.tabT, tab === id && { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={s.pad}>
        {tab === 'blocos' && (
          <>
            <H1>Blocos de Expressão</H1>
            <P style={{ color: colors.muted }}>As expressões completas que você já aprendeu. A barra mostra a força da memória (FSRS): abaixo de 70%, revise.</P>
            {totalChunks === 0 && <EmptyState text="Conclua a primeira lição da trilha para começar o seu caderno." />}
            {groups.map((g) => (
              <View key={g.level.id} style={{ gap: space.sm }}>
                <Text style={s.group}>NÍVEL {g.level.n} · {g.level.title.toUpperCase()}</Text>
                {g.items.map((it) => {
                  const r = retrievability(profile.srs[it.key]);
                  return (
                    <Card key={it.key} style={s.row}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.en}>{it.en}</Text>
                        <Text style={s.pt}>{it.pt}</Text>
                        <View style={s.mem}><View style={[s.memFill, { width: pct(r) as `${number}%`, backgroundColor: memColor(r) }]} /></View>
                        <Text style={s.small}>Memória: {pct(r)}</Text>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Pressable onPress={() => say(it.en, 'M')} style={s.icon} accessibilityLabel={`Ouvir ${it.en}`}><Text style={s.iconT}>🔊</Text></Pressable>
                        <Pressable onPress={() => say(it.en, 'M', true)} style={s.icon} accessibilityLabel={`Ouvir devagar ${it.en}`}><Text style={s.iconT}>🐢</Text></Pressable>
                      </View>
                    </Card>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {tab === 'fonemas' && (
          <>
            <H1>Registro de Fonemas</H1>
            <P style={{ color: colors.muted }}>Palavras em que o reconhecimento de fala percebeu sotaque forte (dourado) ou erro (carmesim). Toque para ver a dica e treinar.</P>
            {weak.length > 0 && <Btn kind="gold" title={`🎙️ Treinar estas palavras (${Math.min(8, weak.length)})`} onPress={() => onStart({ kind: 'phon' })} />}
            {allPhon.length === 0 && <EmptyState text="Faça uma lição de Fala & Precisão Fonética. As palavras que precisarem de atenção aparecem aqui." />}
            {allPhon.map((e) => {
              const tip = tipFor(e.w); const isOpen = open === e.w;
              return (
                <Pressable key={e.w} onPress={() => setOpen(isOpen ? null : e.w)}>
                  <Card style={{ gap: 6, borderColor: STATUS[e.last], borderWidth: 2 }}>
                    <View style={s.row}>
                      <Text style={[s.en, { flex: 1, color: STATUS[e.last] }]}>{e.w}</Text>
                      <Text style={s.small}>✔ {e.g} · ~ {e.n} · ✖ {e.b}</Text>
                    </View>
                    <Text style={s.pt}>{tip.title}</Text>
                    {isOpen && (
                      <>
                        <P>{tip.tip}</P>
                        <View style={{ flexDirection: 'row', gap: space.sm }}>
                          <View style={{ flex: 1 }}><Btn kind="ghost" style={{ paddingHorizontal: 6 }} title="🔊 Ouvir" onPress={() => say(e.w, 'M')} /></View>
                          <View style={{ flex: 1 }}><Btn kind="ghost" style={{ paddingHorizontal: 6 }} title="🐢 Devagar" onPress={() => say(e.w, 'M', true)} /></View>
                        </View>
                      </>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}

        {tab === 'proverbios' && (
          <>
            <H1>Provérbios Memorizados</H1>
            <P style={{ color: colors.muted }}>Cada Sabedoria do Dia que você encontra fica guardada aqui. Marque os que já sabe de cor: {memorized}/{proverbs.length}.</P>
            {proverbs.length === 0 && <EmptyState text="Conclua uma lição para receber a primeira Sabedoria do Dia." />}
            {proverbs.map((w) => {
              const mem = !!profile.proverbs[w.id].memorized;
              return (
                <Card key={w.id} style={{ gap: 6, backgroundColor: mem ? colors.oliveSoft : colors.card }}>
                  <Text style={s.quote}>“{w.en}”</Text>
                  <Text style={s.pt}>{w.pt}</Text>
                  <Text style={[s.small, { color: colors.gold }]}>— {w.source}</Text>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Pressable onPress={() => say(w.en, 'M')} style={s.icon} accessibilityLabel="Ouvir"><Text style={s.iconT}>🔊</Text></Pressable>
                    <Pressable onPress={() => say(w.en, 'M', true)} style={s.icon} accessibilityLabel="Ouvir devagar"><Text style={s.iconT}>🐢</Text></Pressable>
                    <View style={{ flex: 1 }}>
                      <Btn kind={mem ? 'success' : 'ghost'} title={mem ? '✔ Memorizado' : 'Memorizei'}
                        onPress={() => updateProfile((p) => ({ ...p, proverbs: { ...p.proverbs, [w.id]: { ...p.proverbs[w.id], memorized: !mem } } }))} />
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
      <Bento mood="pensativo" size={90} />
      <P style={{ textAlign: 'center', color: colors.muted }}>{text}</P>
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  tabs: { flexDirection: 'row', gap: 6, padding: space.sm, backgroundColor: colors.navy },
  tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md, alignItems: 'center', backgroundColor: '#ffffff18' },
  tabOn: { backgroundColor: colors.cobalt },
  tabT: { fontFamily: fonts.sansBold, fontSize: fs(12), color: '#C9D3E3' },
  group: { fontFamily: fonts.sansBold, fontSize: fs(12), color: colors.gold, letterSpacing: 1, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  en: { fontFamily: fonts.sansBold, fontSize: fs(17), color: colors.navy },
  pt: { fontFamily: fonts.sans, fontSize: fs(14), color: colors.muted },
  small: { fontFamily: fonts.sans, fontSize: fs(12), color: colors.muted },
  quote: { fontFamily: fonts.serif, fontSize: fs(16), color: colors.navy, lineHeight: fs(16) * 1.5 },
  mem: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden', marginTop: 4 },
  memFill: { height: 8, borderRadius: 4 },
  icon: { width: 48, height: 44, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  iconT: { fontSize: fs(18) },
});
