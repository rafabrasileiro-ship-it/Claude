import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar, Stat } from '../components/ui';
import { useStore } from '../store';
import { units, mascot, dailyWisdom, people } from '../engine/content';
import { activeStreak, MAX_SHIELDS, rankFor, dayKey } from '../engine/game';
import { dueKeys } from '../engine/srs';

export type LessonRef = { kind: 'lesson'; id: string } | { kind: 'review'; unitId: string } | { kind: 'practice' };

export default function Home({ onStart }: { onStart: (r: LessonRef) => void }) {
  const { profile } = useStore();
  const rank = rankFor(profile.xp, profile.sex);
  const due = dueKeys(profile.srs).length;
  const tip = dailyWisdom(Number(dayKey().replace(/-/g, '')));

  // Ordem linear: lições da unidade + desafio de revisão.
  let prevDone = true;
  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Card style={{ flexDirection: 'row', paddingVertical: space.sm }}>
        <Stat icon="🧭" value={activeStreak(profile)} label="Bússola" color={colors.navy} />
        <Stat icon="🪙" value={profile.talents} label="Talentos" color={colors.gold} />
        <Stat icon="🛡️" value={`${profile.shields.count}/${MAX_SHIELDS}`} label="Escudos" color={profile.shields.count ? colors.olive : colors.crimson} />
        <Stat icon="🎖️" value={rank.name} label="Patente" color={colors.navy} />
      </Card>
      {rank.next !== null && (
        <View style={{ gap: 4 }}>
          <ProgressBar value={(profile.xp - rank.base) / (rank.next - rank.base)} color={colors.gold} />
          <Text style={s.small}>{profile.xp} / {rank.next} XP para a próxima patente</Text>
        </View>
      )}

      <Card style={s.bento}>
        <Text style={{ fontSize: fs(38) }}>{mascot.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.bentoName}>{mascot.name} diz:</Text>
          <P style={{ fontFamily: fonts.serifRegular, fontSize: fs(13) }}>“{tip.en}”</P>
          <Text style={s.small}>{tip.pt} — {tip.source}</Text>
        </View>
      </Card>

      <Btn
        kind="gold"
        title={due ? `Treino de Virtude (${due} para revisar)` : 'Treino de Virtude (nada vencido)'}
        disabled={!due}
        onPress={() => onStart({ kind: 'practice' })}
      />

      {units.map((u, ui) => {
        const done = u.lessons.filter((l) => profile.completed[l.id]).length;
        return (
          <View key={u.id} style={{ gap: space.sm }}>
            <View style={s.unitHead}>
              <Text style={{ fontSize: fs(28) }}>{u.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.unitTitle}>Unidade {ui + 1}: {u.title}</Text>
                <Text style={s.small}>Com {u.cast.map((c) => people[c]?.name).join(', ')}</Text>
              </View>
              <Text style={s.small}>{done}/4</Text>
            </View>
            {u.lessons.map((l, li) => {
              const unlocked = prevDone;
              const st = profile.completed[l.id] ?? 0;
              prevDone = st > 0;
              return (
                <Pressable
                  key={l.id} disabled={!unlocked} onPress={() => onStart({ kind: 'lesson', id: l.id })}
                  accessibilityRole="button" accessibilityLabel={`Lição ${li + 1}: ${l.title}`}
                  style={[s.node, !unlocked && { opacity: 0.45 }, st > 0 && { borderColor: colors.olive, backgroundColor: colors.oliveSoft }]}
                >
                  <Text style={s.nodeNum}>{li + 1}</Text>
                  <Text style={s.nodeTitle}>{l.title}</Text>
                  <Text style={{ fontSize: fs(14) }}>{st > 0 ? '⭐'.repeat(st) : unlocked ? '▶' : '🔒'}</Text>
                </Pressable>
              );
            })}
            {(() => {
              const unlocked = prevDone;
              const st = profile.completed[`${u.id}rev`] ?? 0;
              prevDone = st > 0;
              return (
                <Pressable
                  disabled={!unlocked} onPress={() => onStart({ kind: 'review', unitId: u.id })}
                  style={[s.node, { borderColor: colors.gold, backgroundColor: colors.goldSoft }, !unlocked && { opacity: 0.45 }]}
                >
                  <Text style={s.nodeNum}>🏅</Text>
                  <Text style={s.nodeTitle}>Desafio de Revisão</Text>
                  <Text style={{ fontSize: fs(14) }}>{st > 0 ? '⭐'.repeat(st) : unlocked ? '▶' : '🔒'}</Text>
                </Pressable>
              );
            })()}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: space.md, gap: space.md, paddingBottom: 60 },
  small: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
  bento: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.navySoft },
  bentoName: { fontFamily: fonts.serif, color: colors.navy, fontSize: fs(14), marginBottom: 2 },
  unitHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  unitTitle: { fontFamily: fonts.serif, fontSize: fs(16), color: colors.navy },
  node: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  nodeNum: { fontFamily: fonts.sansBold, fontSize: fs(16), color: colors.gold, width: 24, textAlign: 'center' },
  nodeTitle: { flex: 1, fontFamily: fonts.sansMedium, fontSize: fs(15), color: colors.ink },
});
