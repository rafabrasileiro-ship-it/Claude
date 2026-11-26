import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { useStore } from '../store';
import { curriculum, dailyWisdom, people } from '../engine/content';
import { LEVELS, blockOf, currentLevel, eraOf, lessonsDone, levelDone, levelUnlocked } from '../engine/levels';
import { activeStreak, dayKey, lessonsToday, vaultAvailable } from '../engine/game';
import { dueKeys } from '../engine/srs';
import { weakWords } from '../engine/pron';
import { Connector, NODE, OFFSETS, TrailNode, type NodeState } from '../components/Trail';
import type { BlockDef, EraDef, LevelDef } from '../types';
import type { LessonRef } from '../nav';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const H = { tip: 104, era: 118, block: 96, level: 132 };
const NODE_TOP = 48; // espaço para o balão "COMEÇAR" acima do nó
type Row =
  | { type: 'tip' }
  | { type: 'era'; era: EraDef }
  | { type: 'block'; block: BlockDef }
  | { type: 'level'; level: LevelDef; x: number; prevX: number | null };

function buildRows(): Row[] {
  const rows: Row[] = [{ type: 'tip' }];
  let prevBlock = -1; let prevEra = 0; let prevX: number | null = null;
  for (const l of LEVELS) {
    if (l.era !== prevEra) { rows.push({ type: 'era', era: curriculum.eras[l.era - 1] }); prevEra = l.era; }
    if (l.block !== prevBlock) { rows.push({ type: 'block', block: curriculum.blocks[l.block] }); prevBlock = l.block; prevX = null; }
    const x = OFFSETS[(l.n - 1) % OFFSETS.length];
    rows.push({ type: 'level', level: l, x, prevX });
    prevX = x;
  }
  return rows;
}
const ROWS = buildRows();
const OFFS = ROWS.reduce<number[]>((acc, r, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + H[ROWS[i - 1].type]); return acc; }, []);
const names = (ids: string[]) => ids.slice(0, 4).map((c) => people[c]?.name).join(', ').replace(/, ([^,]*)$/, ' e $1') + (ids.length > 4 ? ' e todos os núcleos' : '');

/** Mapa Vertical Interativo (Caminho da Virtude): 5 Eras, 130 níveis. */
export default function Home({ onOpenLevel, onStart }: { onOpenLevel: (levelId: string) => void; onStart: (r: LessonRef) => void }) {
  const { profile } = useStore();
  const list = useRef<FlatList<Row>>(null);
  const cur = currentLevel(profile);
  const curIndex = ROWS.findIndex((r) => r.type === 'level' && r.level.id === cur.id);
  const due = dueKeys(profile.srs).length + weakWords(profile, 3).length;
  const tip = dailyWisdom(Number(dayKey().replace(/-/g, '')));
  const today = lessonsToday(profile);
  const goal = profile.goal ?? 2;
  const vault = vaultAvailable(profile);
  const initial = useMemo(() => Math.max(0, curIndex - 2), []);
  const { width } = useWindowDimensions();
  const half = (width - space.md * 2) / 2; // centro da trilha
  const [scrollY, setScrollY] = useState(0);
  const farFromCurrent = Math.abs(scrollY - (OFFS[curIndex] ?? 0)) > 500;

  const stateOf = (l: LevelDef): NodeState => {
    if (l.status === 'planned') return 'planned';
    if (levelDone(profile, l.id)) return 'done';
    return levelUnlocked(profile, l.id) ? 'current' : 'locked';
  };

  const render = ({ item }: { item: Row }) => {
    if (item.type === 'tip') {
      return (
        <View style={[s.tip, { height: H.tip - 14 }]}>
          <Text style={{ fontSize: fs(24) }}>🦅</Text>
          <Text style={s.tipText} numberOfLines={3}>“{tip.en}”{'\n'}<Text style={s.tipSrc}>{tip.source}</Text></Text>
        </View>
      );
    }
    if (item.type === 'era') {
      const e = item.era;
      const avail = LEVELS.filter((l) => l.era === e.era && l.status === 'available').length;
      return (
        <View style={[s.era, { height: H.era - 16 }]}>
          <Text style={s.eraK}>ERA {ROMAN[e.era - 1]} · CEFR {e.cefr} · NÍVEIS {e.from}–{e.to}</Text>
          <Text style={s.eraT} numberOfLines={2}>{e.title}</Text>
          <Text style={s.eraS}>{e.to - e.from + 1} níveis · {(e.to - e.from + 1) * 10} lições · {avail} disponíve{avail === 1 ? 'l' : 'is'} agora</Text>
        </View>
      );
    }
    if (item.type === 'block') {
      const b = item.block;
      return (
        <View style={[s.block, { height: H.block - 12 }]}>
          <Text style={s.blockK}>NÍVEIS {b.label}</Text>
          <Text style={s.blockT} numberOfLines={2}>{b.theme}</Text>
          <Text style={s.blockC} numberOfLines={1}>Com {names(b.cast)}</Text>
        </View>
      );
    }
    const l = item.level; const st = stateOf(l); const done = lessonsDone(profile, l.id);
    const leftLabel = item.x > 0 || (item.x === 0 && l.n % 2 === 0);
    const labelW = Math.min(170, half + (leftLabel ? item.x : -item.x) - NODE / 2 - 14);
    return (
      <View style={{ height: H.level }}>
        {item.prevX !== null && <Connector fromX={item.prevX} toX={item.x} gap={H.level} centerY={NODE_TOP + NODE / 2} faded={l.status === 'planned'} />}
        <View style={{ position: 'absolute', top: NODE_TOP, left: '50%', marginLeft: item.x - NODE / 2, width: NODE }}>
          <TrailNode icon={st === 'done' ? '✓' : String(l.n)} state={st} gold={l.n % 26 === 0} label={`Nível ${l.n}: ${l.title}`}
            startText={done > 0 ? 'CONTINUAR' : 'COMEÇAR'} onPress={() => onOpenLevel(l.id)} />
        </View>
        <Pressable onPress={() => (st === 'done' || st === 'current') && onOpenLevel(l.id)} accessibilityElementsHidden
          style={[s.label, { top: NODE_TOP - 6, width: labelW }, leftLabel ? { right: '50%', marginRight: -item.x + NODE / 2 + 10, alignItems: 'flex-end' } : { left: '50%', marginLeft: item.x + NODE / 2 + 10 }]}>
          <Text style={[s.lvN, st === 'planned' && { color: colors.muted }]}>NÍVEL {l.n}</Text>
          <Text style={[s.lvT, st === 'planned' && { color: colors.muted }, leftLabel && { textAlign: 'right' }]} numberOfLines={2}>{l.title}</Text>
          <Text style={[s.lvS, st === 'done' && { color: colors.olive }]}>
            {st === 'planned' ? 'Em preparação' : st === 'done' ? '✔ Concluído' : st === 'locked' ? '🔒 Bloqueado' : `${done}/10 lições`}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.chip}><Text style={s.chipT}>🧭 {activeStreak(profile)}</Text></View>
        <View style={s.chip}><Text style={[s.chipT, { color: colors.gold }]}>🪙 {profile.talents}</Text></View>
        <View style={s.chip}><Text style={s.chipT}>🥇 {profile.gold ?? 0}</Text></View>
        <View style={s.chip}><Text style={[s.chipT, profile.shields.count === 0 && { color: '#F2A3AF' }]}>🛡️ {profile.shields.count}</Text></View>
      </View>
      <View style={s.today}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.todayT}>Meta de hoje: {Math.min(today, goal)}/{goal} {goal === 1 ? 'lição' : 'lições'}{today >= goal ? ' ✔' : ''}</Text>
          <View style={s.goalBar}><View style={[s.goalFill, { width: `${Math.min(1, today / goal) * 100}%` }]} /></View>
        </View>
        {due > 0 && (
          <Pressable style={s.practice} onPress={() => onStart({ kind: 'practice' })} accessibilityRole="button" accessibilityLabel="Treino de Revisão e Pronúncia">
            <Text style={s.practiceT}>🎯 Treino ({due})</Text>
          </Pressable>
        )}
      </View>
      {vault && <Text style={s.vault}>🔐 Cofre Diário do Tio Bento liberado! Abra na aba Honra.</Text>}
      <FlatList
        ref={list}
        data={ROWS}
        keyExtractor={(r, i) => (r.type === 'level' ? r.level.id : `${r.type}${i}`)}
        renderItem={render}
        getItemLayout={(_, index) => ({ length: H[ROWS[index].type], offset: OFFS[index], index })}
        initialScrollIndex={initial}
        initialNumToRender={14}
        windowSize={9}
        removeClippedSubviews={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={200}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 90 }}
      />
      {farFromCurrent && <Pressable style={s.fab} onPress={() => list.current?.scrollToIndex({ index: Math.max(0, curIndex - 1), animated: true })} accessibilityRole="button" accessibilityLabel="Ir para o nível atual">
        <Text style={s.fabT}>📍 Nível {cur.n}</Text>
      </Pressable>}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', gap: 8, paddingHorizontal: space.md, paddingBottom: 10, backgroundColor: colors.navy, flexWrap: 'wrap' },
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#ffffff1f' },
  chipT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(14) },
  today: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  todayT: { fontFamily: fonts.sansBold, fontSize: fs(13), color: colors.navy },
  goalBar: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden' },
  goalFill: { height: 10, borderRadius: 5, backgroundColor: colors.gold },
  practice: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 3, borderBottomColor: '#8A6508' },
  practiceT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(13) },
  vault: { backgroundColor: colors.olive, color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(13), paddingVertical: 8, paddingHorizontal: space.md, textAlign: 'center' },
  tip: { marginTop: 14, flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radius.lg, padding: space.md, overflow: 'hidden' },
  tipText: { flex: 1, fontFamily: fonts.serif, fontSize: fs(13), color: colors.navy },
  tipSrc: { fontFamily: fonts.sans, color: colors.muted, fontSize: fs(11) },
  era: { marginTop: 16, backgroundColor: colors.gold, borderRadius: radius.lg, padding: space.md, borderBottomWidth: 5, borderBottomColor: '#8A6508', overflow: 'hidden', justifyContent: 'center' },
  eraK: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(11), letterSpacing: 1.2 },
  eraT: { color: '#fff', fontFamily: fonts.serif, fontSize: fs(17) },
  eraS: { color: '#FFF6DA', fontFamily: fonts.sansMedium, fontSize: fs(11) },
  block: { marginTop: 12, backgroundColor: colors.navy, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: 10, borderBottomWidth: 4, borderBottomColor: '#0F2142', overflow: 'hidden', justifyContent: 'center' },
  blockK: { color: colors.gold, fontFamily: fonts.sansBold, fontSize: fs(11), letterSpacing: 1.2 },
  blockT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(13) },
  blockC: { color: '#B8C4D8', fontFamily: fonts.sans, fontSize: fs(11) },
  label: { position: 'absolute' },
  lvN: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.gold, letterSpacing: 1 },
  lvT: { fontFamily: fonts.sansBold, fontSize: fs(12), color: colors.navy },
  lvS: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
  fab: { position: 'absolute', right: space.md, bottom: space.md, backgroundColor: colors.cobalt, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 4, borderBottomColor: '#142C52' },
  fabT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(13) },
});
