import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Avatar, Btn, Card, H1, P, ProgressBar } from '../components/ui';
import { Connector, NODE, OFFSETS, TrailNode, type NodeState } from '../components/Trail';
import { useStore } from '../store';
import { curriculum, levelContent, people } from '../engine/content';
import { AVAILABLE, blockOf, eraOf, isDone, lessonId, lessonUnlocked, lessonsDone, levelDef, levelUnlocked, nextSlot } from '../engine/levels';
import { hash } from '../engine/game';
import { fx } from '../engine/fx';
import type { LessonRef } from '../nav';

const ROW = 124; const NODE_TOP = 44;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
type Item = { kind: 'lesson'; slot: number } | { kind: 'chest'; k: number };
const PATH: Item[] = [1, 2, 3, 'a1', 4, 5, 6, 'a2', 7, 8, 9, 'a3', 10].map((x) =>
  typeof x === 'number' ? { kind: 'lesson', slot: x } : { kind: 'chest', k: Number(x.slice(1)) });
export const chestReward = (id: string) => 15 + (hash(id) % 26);

/** Tela do nível: as 10 lições na cadência padrão, com Arcas de Talentos a cada 3 lições. */
export default function LevelScreen({ levelId, onStart, onBack, onOpenLevel }: { levelId: string; onStart: (r: LessonRef) => void; onBack: () => void; onOpenLevel: (id: string) => void }) {
  const { profile, updateProfile } = useStore();
  const [toast, setToast] = useState('');
  const def = levelDef(levelId)!; const lv = levelContent(levelId)!;
  const era = eraOf(def); const block = blockOf(def);
  const done = lessonsDone(profile, levelId);
  const next = nextSlot(profile, levelId);
  const { width } = useWindowDimensions();
  const half = (width - space.md * 2) / 2;

  const openChest = (k: number) => {
    const id = `${levelId}-a${k}`;
    const reward = chestReward(id);
    fx('combo');
    updateProfile((p) => (p.chests.includes(id) ? p : { ...p, talents: p.talents + reward, chests: [...p.chests, id] }));
    setToast(`🎁 Arca de Talentos aberta: +${reward} 🪙`);
    setTimeout(() => setToast(''), 3500);
  };

  const rows = PATH.map((it, i) => {
    const x = OFFSETS[i % OFFSETS.length]; const prevX = i > 0 ? OFFSETS[(i - 1) % OFFSETS.length] : null;
    let st: NodeState; let icon: string; let title: string; let sub: string; let gold = false; let onPress: (() => void) | undefined;
    if (it.kind === 'lesson') {
      const sd = curriculum.slots[it.slot - 1]; const spec = lv.lessons[it.slot - 1];
      const stars = profile.completed[lessonId(levelId, it.slot)] ?? 0;
      st = stars > 0 ? 'done' : lessonUnlocked(profile, levelId, it.slot) ? 'current' : 'locked';
      if (st === 'current' && next !== it.slot) st = 'done';
      icon = sd.icon; gold = it.slot === 10 || it.slot === 8;
      title = sd.title; sub = `${it.slot}/10 · ${spec.title}${stars > 0 ? `  ${'⭐'.repeat(stars)}` : ''}`;
      onPress = () => onStart({ kind: 'lesson', levelId, slot: it.slot });
    } else {
      const id = `${levelId}-a${it.k}`;
      const open = isDone(profile, levelId, it.k * 3); const claimed = profile.chests.includes(id);
      st = claimed ? 'done' : open ? 'current' : 'locked'; icon = claimed ? '📭' : '🎁'; gold = true;
      title = 'Arca de Talentos'; sub = claimed ? 'Aberta' : open ? 'Toque para abrir!' : `Após a lição ${it.k * 3}`;
      onPress = claimed ? undefined : () => openChest(it.k);
    }
    const leftLabel = x > 0 || (x === 0 && i % 2 === 1);
    const labelW = Math.min(170, half + (leftLabel ? x : -x) - NODE / 2 - 14);
    return (
      <View key={i} style={{ height: ROW }}>
        {prevX !== null && <Connector fromX={prevX} toX={x} gap={ROW} centerY={NODE_TOP + NODE / 2} />}
        <View style={{ position: 'absolute', top: NODE_TOP, left: '50%', marginLeft: x - NODE / 2, width: NODE }}>
          <TrailNode icon={icon} state={st} gold={gold} onPress={onPress} label={`${title}: ${sub}`} startText={it.kind === 'chest' ? 'ABRIR' : 'COMEÇAR'} />
        </View>
        <View pointerEvents="none" style={[s.label, { top: NODE_TOP - 2, width: labelW }, leftLabel ? { right: '50%', marginRight: -x + NODE / 2 + 10, alignItems: 'flex-end' } : { left: '50%', marginLeft: x + NODE / 2 + 10 }]}>
          <Text style={[s.nT, leftLabel && { textAlign: 'right' }]} numberOfLines={2}>{title}</Text>
          <Text style={[s.nS, leftLabel && { textAlign: 'right' }]} numberOfLines={2}>{sub}</Text>
        </View>
      </View>
    );
  });

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button"><Text style={s.back}>← Trilha</Text></Pressable>
      <Card style={{ gap: 6 }}>
        <Text style={s.kicker}>ERA {ROMAN[era.era - 1]} · CEFR {era.cefr} · NÍVEL {def.n} DE 130</Text>
        <H1>{def.title}</H1>
        <P style={{ fontSize: fs(13), color: colors.muted }}>{block.theme}</P>
        <P style={{ fontSize: fs(13) }}>📐 {lv.grammar}</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {block.cast.slice(0, 6).map((c) => (
            <View key={c} style={s.castChip}><Avatar emoji={people[c]?.emoji ?? '🙂'} color={people[c]?.color ?? colors.navy} size={28} /><Text style={s.castT}>{people[c]?.name}</Text></View>
          ))}
        </View>
        <View style={{ gap: 4, marginTop: 6 }}>
          <ProgressBar value={done / 10} color={colors.gold} height={12} />
          <Text style={s.small}>{done}/10 lições{lv.origin === 'adaptado' ? ' · conteúdo adaptado das versões anteriores' : ''}</Text>
        </View>
        {next !== null && <Btn title={next === 1 && done === 0 ? 'Começar o nível' : `Continuar: lição ${next}`} onPress={() => onStart({ kind: 'lesson', levelId, slot: next })} />}
        {next === null && (() => {
          const i = AVAILABLE.findIndex((l) => l.id === levelId); const nx = AVAILABLE[i + 1];
          return (
            <View style={{ gap: space.sm }}>
              <Text style={s.doneT}>🏅 Nível concluído! Checkpoint de Honra superado.</Text>
              {nx && levelUnlocked(profile, nx.id) && <Btn kind="success" title={`Ir para o Nível ${nx.n}`} onPress={() => onOpenLevel(nx.id)} />}
            </View>
          );
        })()}
      </Card>
      {toast ? <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View> : null}
      <View style={{ paddingTop: 6 }}>{rows}</View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 80 },
  back: { fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.navy },
  kicker: { fontFamily: fonts.sansBold, fontSize: fs(11), color: colors.gold, letterSpacing: 1.2 },
  small: { fontFamily: fonts.sans, fontSize: fs(12), color: colors.muted },
  castChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.navySoft, borderRadius: 20, paddingRight: 10 },
  castT: { fontFamily: fonts.sansMedium, fontSize: fs(12), color: colors.navy },
  label: { position: 'absolute' },
  nT: { fontFamily: fonts.sansBold, fontSize: fs(13), color: colors.navy },
  nS: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
  doneT: { fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.olive, textAlign: 'center' },
  toast: { backgroundColor: colors.olive, borderRadius: radius.md, padding: space.md },
  toastT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(15) },
});
