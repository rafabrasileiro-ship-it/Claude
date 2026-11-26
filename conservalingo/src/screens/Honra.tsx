import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P, ProgressBar } from '../components/ui';
import { useStore } from '../store';
import { DEMOTE_LAST, GUARD_COST_GOLD, LEAGUE_SIZE, MAX_GUARDS, MILESTONES, PROMOTE_TOP, TIERS, VAULT_TALENTS, activeStreak, claimVault, missionById, missionsAllDone, standings, tierName, vaultAvailable, weekProgress, dayKey } from '../engine/game';
import Bento from '../components/Bento';
import { ANCHORS } from '../engine/pnl';
import { fx } from '../engine/fx';

export default function Honra({ onOpenCast }: { onOpenCast: () => void }) {
  const { profile, updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const rows = standings(profile, weekProgress());
  const me = rows.find((r) => r.me)!;
  const tier = profile.league.tier;
  const last = profile.league.last;
  const best = Math.max(profile.bestStreak ?? 0, activeStreak(profile));
  const nextMs = MILESTONES.find((m) => best < m.days);

  const claim = (id: string) => {
    const m = missionById(id);
    fx('combo');
    updateProfile((p) => ({ ...p, talents: p.talents + m.reward, daily: { ...p.daily, claimed: [...p.daily.claimed, id] } }));
  };

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Btn kind="ghost" title="🦅 Elenco das famílias e Loja de Talentos" onPress={onOpenCast} />
      <Card style={{ backgroundColor: colors.navy, gap: 6 }}>
        <Text style={s.kickerGold}>MINHA FRASE-ÂNCORA</Text>
        <Text style={s.anchor}>⚓ {profile.anchor || 'Ainda não escolhida'}</Text>
        {editing ? (
          <>
            {ANCHORS.map((a) => <Btn key={a} kind="ghost" title={a} onPress={() => { updateProfile((p) => ({ ...p, anchor: a })); setEditing(false); }} />)}
            <TextInput value={custom} onChangeText={setCustom} placeholder="Escreva a sua" style={s.input} maxLength={60} />
            <Btn kind="gold" title="Salvar" disabled={!custom.trim()} onPress={() => { updateProfile((p) => ({ ...p, anchor: custom.trim() })); setCustom(''); setEditing(false); }} />
          </>
        ) : <Pressable onPress={() => setEditing(true)}><Text style={{ color: '#B8C4D8', fontFamily: fonts.sansMedium }}>Alterar frase</Text></Pressable>}
      </Card>

      <H1>Missões de Hoje</H1>
      {profile.daily.picked.length === 0 && <P style={{ color: colors.muted }}>As missões aparecem ao abrir o app a cada dia.</P>}
      {profile.daily.picked.map((id) => {
        const m = missionById(id);
        const v = Math.min(m.goal, profile.daily.c[m.counter] ?? 0);
        const done = v >= m.goal; const claimed = profile.daily.claimed.includes(id);
        return (
          <Card key={id} style={{ gap: 6 }}>
            <Text style={s.mTitle}>{done ? '✔ ' : '⚡ '}{m.title}</Text>
            <ProgressBar value={v / m.goal} color={done ? colors.olive : colors.gold} height={12} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.small}>{v}/{m.goal} · recompensa 🪙 {m.reward}</Text>
              {done && !claimed && <View style={{ width: 150 }}><Btn kind="gold" title="Resgatar" onPress={() => claim(id)} /></View>}
              {claimed && <Text style={[s.small, { color: colors.olive }]}>Resgatada ✔</Text>}
            </View>
          </Card>
        );
      })}

      <Card style={[{ gap: 6, alignItems: 'center' }, vaultAvailable(profile) ? { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.goldSoft } : null]}>
        <Bento mood={vaultAvailable(profile) ? 'celebracao' : profile.vault === dayKey() ? 'orgulhoso' : 'pensativo'} size={72} />
        <Text style={s.mTitle}>🔐 Cofre Diário do Tio Bento</Text>
        {profile.vault === dayKey() ? <P style={{ textAlign: 'center', color: colors.olive }}>Aberto hoje ✔ Volte amanhã para um novo cofre.</P>
          : missionsAllDone(profile) ? <Btn kind="gold" title={`Abrir: +${VAULT_TALENTS} 🪙 e escudos restaurados`} onPress={() => { fx('level'); updateProfile((p) => claimVault(p)); }} />
          : <P style={{ textAlign: 'center', color: colors.muted }}>Conclua as 3 missões de hoje para abrir o cofre: +{VAULT_TALENTS} 🪙 e todos os Escudos de Atenção restaurados.</P>}
      </Card>

      <H1>Talentos de Ouro</H1>
      <Card style={{ gap: 8 }}>
        <P>🥇 Você tem <Text style={{ fontFamily: fonts.sansBold }}>{profile.gold ?? 0}</Text> Talento{(profile.gold ?? 0) === 1 ? '' : 's'} de Ouro. Eles são conquistados nos Checkpoints de Honra (1 por nível, +1 se for sem erros).</P>
        <P>⚜️ Escudos de Guarda: <Text style={{ fontFamily: fonts.sansBold }}>{profile.guards ?? 0}/{MAX_GUARDS}</Text>. Cada um protege a sua ofensiva em um dia sem estudo.</P>
        <Btn kind="gold" title={`Comprar Escudo de Guarda (${GUARD_COST_GOLD} 🥇)`} disabled={(profile.gold ?? 0) < GUARD_COST_GOLD || (profile.guards ?? 0) >= MAX_GUARDS}
          onPress={() => { fx('combo'); updateProfile((p) => ((p.gold ?? 0) >= GUARD_COST_GOLD && (p.guards ?? 0) < MAX_GUARDS ? { ...p, gold: p.gold - GUARD_COST_GOLD, guards: (p.guards ?? 0) + 1 } : p)); }} />
      </Card>

      <H1>Liga Semanal · {TIERS[tier].icon} {tierName(tier, profile.sex)}</H1>
      {last && <P style={{ color: last.to > last.from ? colors.olive : last.to < last.from ? colors.crimson : colors.muted }}>
        Semana passada: {last.pos}º lugar → {last.to > last.from ? `promovido a ${tierName(last.to, profile.sex)}` : last.to < last.from ? `rebaixado para ${tierName(last.to, profile.sex)}` : 'você permaneceu na patente'}.
      </P>}
      <P style={{ color: colors.muted }}>Os {PROMOTE_TOP} primeiros sobem de patente e os {DEMOTE_LAST} últimos descem, ao virar a semana. Você está em {me.pos}º com {me.xp} XP.</P>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((r) => (
          <View key={r.name + r.pos} style={[s.row, r.me && { backgroundColor: colors.goldSoft }]}>
            <Text style={[s.pos, r.pos <= PROMOTE_TOP && { color: colors.olive }, r.pos > LEAGUE_SIZE - DEMOTE_LAST && { color: colors.crimson }]}>{r.pos <= PROMOTE_TOP ? '▲' : r.pos > LEAGUE_SIZE - DEMOTE_LAST ? '▼' : '•'} {r.pos}</Text>
            <Text style={[s.name, r.me && { fontFamily: fonts.sansBold }]} numberOfLines={1}>{r.name}{r.me ? ' (você)' : ''}</Text>
            <Text style={s.xp}>{r.xp} XP</Text>
          </View>
        ))}
      </Card>
      <Text style={s.small}>Liga local: os 29 competidores são simulados, pois o app ainda não tem servidor de ranking.</Text>

      <H1>Mural de Honra</H1>
      <P style={{ color: colors.muted }}>Maior ofensiva: 🧭 {best} dias{nextMs ? ` · próximo marco: ${nextMs.days} dias` : ''}</P>
      <View style={s.mural}>
        {MILESTONES.map((m) => {
          const ok = best >= m.days;
          return (
            <View key={m.days} style={[s.medal, !ok && { opacity: 0.35 }]}>
              <Text style={{ fontSize: fs(34) }}>{ok ? m.icon : '🔒'}</Text>
              <Text style={s.medalT}>{m.days} dias</Text>
              <Text style={s.small}>{m.title}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 80 },
  kickerGold: { color: colors.gold, fontFamily: fonts.sansBold, letterSpacing: 1, fontSize: fs(12) },
  anchor: { color: '#fff', fontFamily: fonts.serif, fontSize: fs(18) },
  input: { backgroundColor: '#fff', borderRadius: radius.md, padding: space.md, fontFamily: fonts.sansMedium, fontSize: fs(16) },
  mTitle: { fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.navy },
  small: { fontFamily: fonts.sans, fontSize: fs(12), color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  pos: { width: 62, fontFamily: fonts.sansBold, fontSize: fs(14), color: colors.muted },
  name: { flex: 1, fontFamily: fonts.sansMedium, fontSize: fs(15), color: colors.ink },
  xp: { fontFamily: fonts.sansBold, fontSize: fs(14), color: colors.navy },
  mural: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  medal: { width: '48%', alignItems: 'center', padding: space.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, gap: 2 },
  medalT: { fontFamily: fonts.sansBold, fontSize: fs(15), color: colors.navy },
});
