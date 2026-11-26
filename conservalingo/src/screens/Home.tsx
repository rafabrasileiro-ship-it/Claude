import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, ProgressBar } from '../components/ui';
import { useStore } from '../store';
import { units, dailyWisdom, people, levels, chronicles, stationOf } from '../engine/content';
import { TIERS, activeStreak, dayKey, hash, standings, tierName, weekProgress } from '../engine/game';
import { fx } from '../engine/fx';
import { dueKeys } from '../engine/srs';

export type LessonRef = { kind: 'lesson'; id: string } | { kind: 'review'; unitId: string } | { kind: 'practice' } | { kind: 'listening'; unitId: string } | { kind: 'chronicle'; id: string };

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

function Bounce({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: -6, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v }] }}>{children}</Animated.View>;
}

function Node({ label, icon, state, stars, offset, onPress, gold, hideStart }: {
  label: string; icon: string; state: 'locked' | 'current' | 'done'; stars: number; offset: number; onPress: () => void; gold?: boolean; hideStart?: boolean;
}) {
  const bg = state === 'locked' ? '#D8D4C6' : gold ? colors.gold : state === 'done' ? colors.olive : colors.cobalt;
  const edge = state === 'locked' ? '#BDB8A6' : gold ? '#8A6508' : state === 'done' ? '#134226' : '#142C52';
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }], marginVertical: 8 }}>
      {state === 'current' && !hideStart && (
        <Bounce>
          <View style={s.start}><Text style={s.startText}>COMEÇAR</Text></View>
          <View style={s.startArrow} />
        </Bounce>
      )}
      <Pressable disabled={state === 'locked'} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {({ pressed }) => (
          <View style={[s.node, { backgroundColor: bg, borderBottomColor: edge }, pressed && { borderBottomWidth: 3, marginTop: 4 }]}>
            <Text style={{ fontSize: fs(30) }}>{state === 'locked' ? '🔒' : icon}</Text>
          </View>
        )}
      </Pressable>
      <Text style={[s.nodeLabel, state === 'locked' && { color: colors.muted }]}>{label}</Text>
      {state === 'done' && <Text style={{ fontSize: fs(14) }}>{'⭐'.repeat(stars)}</Text>}
    </View>
  );
}

export default function Home({ onStart }: { onStart: (r: LessonRef) => void }) {
  const { profile, updateProfile } = useStore();
  const [toast, setToast] = useState('');
  const due = dueKeys(profile.srs).length;
  const tip = dailyWisdom(Number(dayKey().replace(/-/g, '')));
  const me = standings(profile, weekProgress()).find((r) => r.me)!;
  const tier = profile.league.tier;
  let prevDone = true;
  let n = 0;
  const done = (id: string) => (profile.completed[id] ?? 0) > 0;

  const openChest = (uid: string) => {
    const reward = 20 + (hash(uid) % 41);
    fx('combo');
    updateProfile((p) => ({ ...p, talents: p.talents + reward, chests: [...p.chests, uid] }));
    setToast(`🎁 Arca aberta! Você encontrou ${reward} Talentos.`);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.chip}><Text style={s.chipT}>🧭 {activeStreak(profile)}</Text></View>
        <View style={s.chip}><Text style={[s.chipT, { color: colors.gold }]}>🪙 {profile.talents}</Text></View>
        <View style={s.chip}><Text style={[s.chipT, profile.shields.count === 0 && { color: '#F2A3AF' }]}>🛡️ {profile.shields.count}</Text></View>
      </View>
      <ScrollView contentContainerStyle={s.wrap}>
        {toast ? <View style={s.toast}><Text style={s.toastT}>{toast}</Text></View> : null}
        <View style={s.tip}>
          <Text style={{ fontSize: fs(26) }}>🦅</Text>
          <Text style={s.tipText} numberOfLines={3}>“{tip.en}”{'\n'}<Text style={{ fontFamily: fonts.sans, color: colors.muted, fontSize: fs(12) }}>{tip.source}</Text></Text>
        </View>

        <View style={{ gap: 4 }}>
          <ProgressBar value={Math.min(1, me.xp / 400)} color={colors.gold} height={14} />
          <Text style={s.small}>{TIERS[tier].icon} Liga {tierName(tier, profile.sex)} · {me.pos}º lugar · {me.xp} XP na semana</Text>
        </View>

        {due > 0 && <Btn kind="gold" title={`Treino de Virtude · ${due} para revisar`} onPress={() => onStart({ kind: 'practice' })} />}

        {units.map((u, ui) => {
          const lv = levels.find((l) => l.level === (u.level ?? 1))!;
          const firstOfLevel = ui === 0 || (units[ui - 1].level ?? 1) !== (u.level ?? 1);
          const chron = chronicles.find((c) => c.unlockAfterUnit === u.id);
          const lessonsDone = u.lessons.every((l) => done(l.id));
          return (
            <View key={u.id}>
              {firstOfLevel && (
                <View style={s.level}>
                  <Text style={s.levelK}>NÍVEL {lv.level} · CEFR {lv.cefr}</Text>
                  <Text style={s.levelT}>{lv.title}</Text>
                </View>
              )}
              <View style={s.banner}>
                <View style={{ flex: 1 }}>
                  <Text style={s.bannerKicker}>UNIDADE {ui + 1}</Text>
                  <Text style={s.bannerTitle}>{u.title}</Text>
                  <Text style={s.bannerCast}>Com {u.cast.slice(0, 4).map((c) => people[c]?.name).join(', ')}{u.cast.length > 4 ? ' e mais' : ''}</Text>
                </View>
                <Text style={{ fontSize: fs(38) }}>{u.icon}</Text>
              </View>
              <View style={{ paddingVertical: space.md }}>
                {u.lessons.map((l) => {
                  const unlocked = prevDone;
                  const st = profile.completed[l.id] ?? 0;
                  prevDone = st > 0;
                  const state = st > 0 ? 'done' : unlocked ? 'current' : 'locked';
                  return <Node key={l.id} label={l.title} icon={st > 0 ? '✔' : '📖'} state={state} stars={st} offset={OFFSETS[n++ % OFFSETS.length]} onPress={() => onStart({ kind: 'lesson', id: l.id })} />;
                })}
                {stationOf(u.id) && (
                  <Node gold label={`Escuta: ${stationOf(u.id)!.title}`} icon="🎧" hideStart
                    state={done(`${u.id}lis`) ? 'done' : lessonsDone ? 'current' : 'locked'} stars={profile.completed[`${u.id}lis`] ?? 0}
                    offset={OFFSETS[n++ % OFFSETS.length]} onPress={() => onStart({ kind: 'listening', unitId: u.id })} />
                )}
                {(() => {
                  const unlocked = prevDone;
                  const st = profile.completed[`${u.id}rev`] ?? 0;
                  prevDone = st > 0;
                  const state = st > 0 ? 'done' : unlocked ? 'current' : 'locked';
                  return <Node gold label="Desafio" icon="🏅" state={state} stars={st} offset={OFFSETS[n++ % OFFSETS.length]} onPress={() => onStart({ kind: 'review', unitId: u.id })} />;
                })()}
                {(() => {
                  const open = done(`${u.id}rev`); const claimed = profile.chests.includes(u.id);
                  return <Node gold label={claimed ? 'Arca aberta' : 'Arca de Talentos'} icon={claimed ? '✔' : '🎁'} hideStart
                    state={claimed ? 'done' : open ? 'current' : 'locked'} stars={0} offset={OFFSETS[n++ % OFFSETS.length]} onPress={() => !claimed && openChest(u.id)} />;
                })()}
                {chron && (
                  <Node gold label={`Crônica: ${chron.title}`} icon={chron.icon} hideStart
                    state={done(chron.id) ? 'done' : done(`${u.id}rev`) ? 'current' : 'locked'} stars={profile.completed[chron.id] ?? 0}
                    offset={OFFSETS[n++ % OFFSETS.length]} onPress={() => onStart({ kind: 'chronicle', id: chron.id })} />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', gap: 8, paddingHorizontal: space.md, paddingBottom: 12, backgroundColor: colors.navy },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#ffffff1f' },
  chipT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(15) },
  wrap: { padding: space.md, gap: space.md, paddingBottom: 80 },
  tip: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radius.lg, padding: space.md },
  tipText: { flex: 1, fontFamily: fonts.serif, fontSize: fs(13), color: colors.navy },
  small: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy, borderRadius: radius.lg, padding: space.md, borderBottomWidth: 5, borderBottomColor: '#0F2142', marginTop: space.md },
  toast: { backgroundColor: colors.olive, borderRadius: radius.md, padding: space.md },
  toastT: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(15) },
  level: { backgroundColor: colors.gold, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  levelK: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs(12), letterSpacing: 1.5 },
  levelT: { color: '#fff', fontFamily: fonts.serif, fontSize: fs(18) },
  bannerKicker: { color: colors.gold, fontFamily: fonts.sansBold, fontSize: fs(12), letterSpacing: 1.5 },
  bannerTitle: { color: '#fff', fontFamily: fonts.serif, fontSize: fs(17), marginVertical: 2 },
  bannerCast: { color: '#B8C4D8', fontFamily: fonts.sans, fontSize: fs(12) },
  node: { width: 82, height: 76, borderRadius: 41, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 7 },
  nodeLabel: { fontFamily: fonts.sansBold, fontSize: fs(13), color: colors.navy, marginTop: 6, textAlign: 'center', maxWidth: 170 },
  start: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.line, borderBottomWidth: 4, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  startText: { color: colors.navy, fontFamily: fonts.sansBold, fontSize: fs(13), letterSpacing: 1 },
  startArrow: { alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.line, marginBottom: 4 },
});
