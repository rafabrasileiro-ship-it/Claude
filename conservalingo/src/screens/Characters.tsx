import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { Avatar, Btn, Card, H1, P } from '../components/ui';
import { families, mascot, people } from '../engine/content';
import { useStore } from '../store';

const OUTFITS = [
  { id: 'outfit-sunday', label: 'Traje de domingo', cost: 30 },
  { id: 'outfit-formal', label: 'Traje de gala', cost: 60 },
  { id: 'outfit-field', label: 'Roupa de campo', cost: 40 },
];

export default function Characters() {
  const { profile, updateProfile } = useStore();
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>Personagens</H1>
      <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.navySoft }}>
        <Avatar emoji={mascot.emoji} color={mascot.color} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{mascot.name} — {mascot.species}</Text>
          <P>{mascot.description}</P>
        </View>
      </Card>
      {families.map((f) => (
        <Card key={f.id} style={{ gap: space.sm }}>
          <View style={s.row}>
            <Avatar emoji={f.sex === 'M' ? '👨' : '👩'} color={f.color} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{f.name} <Text style={s.prof}>· {f.profession}</Text></Text>
              <P style={{ fontSize: 13 }}>{f.archetype}</P>
            </View>
          </View>
          <P style={{ fontSize: 13 }}>💍 Cônjuge: {f.spouse.name} ({f.spouse.profession})</P>
          <P style={{ fontSize: 13 }}>👨‍👩‍👧‍👦 Filhos: {f.children.map((c) => `${c.name} (${c.age})`).join(' e ')}</P>
          <P style={{ fontSize: 12, color: colors.muted }}>Foco: {f.focus}</P>
        </Card>
      ))}
      <H1>Loja de Talentos</H1>
      <P>Use seus talentos de ouro para vestir a família com trajes tradicionais. Você tem 🪙 {profile.talents}.</P>
      {OUTFITS.map((o) => {
        const has = profile.unlocked.includes(o.id);
        return (
          <Card key={o.id} style={s.row}>
            <Text style={[s.name, { flex: 1 }]}>{o.label}</Text>
            {has ? <Text style={{ color: colors.olive, fontFamily: fonts.sansBold }}>✔ Seu</Text> : (
              <Btn kind="gold" title={`${o.cost} 🪙`} disabled={profile.talents < o.cost}
                onPress={() => updateProfile((p) => ({ ...p, talents: p.talents - o.cost, unlocked: [...p.unlocked, o.id] }))} />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontFamily: fonts.serif, fontSize: 15, color: colors.navy },
  prof: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
});
