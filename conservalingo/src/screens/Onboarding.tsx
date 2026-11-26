import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, H1, P } from '../components/ui';
import { useStore } from '../store';
import { ANCHORS } from '../engine/pnl';

export default function Onboarding() {
  const { profile, updateProfile } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const value = (custom.trim() || sel || '').trim();
  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: fs(56), textAlign: 'center' }}>🦅</Text>
      <H1 style={{ textAlign: 'center' }}>Bem-vindo, {profile.name}!</H1>
      <P style={{ textAlign: 'center' }}>Sou o Tio Bento. Antes de começar, escolha a sua Frase-Âncora: o motivo que vai sustentar a sua jornada. Eu a lembrarei a cada conquista.</P>
      <Text style={s.q}>Por que você quer aprender inglês?</Text>
      {ANCHORS.map((a) => (
        <Pressable key={a} onPress={() => { setSel(a); setCustom(''); }} style={[s.opt, sel === a && !custom && s.optSel]}>
          <Text style={[s.optT, sel === a && !custom && { color: colors.navy }]}>⚓ {a}</Text>
        </Pressable>
      ))}
      <TextInput value={custom} onChangeText={setCustom} placeholder="Ou escreva a sua própria frase" style={s.input} maxLength={60} />
      <View style={{ height: space.sm }} />
      <Btn title="Começar a jornada" disabled={!value} onPress={() => updateProfile((p) => ({ ...p, anchor: value }))} />
      <Btn kind="ghost" title="Escolher depois" onPress={() => updateProfile((p) => ({ ...p, anchor: '' }))} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md, paddingTop: space.xl },
  q: { fontFamily: fonts.sansBold, fontSize: fs(17), color: colors.navy, marginTop: space.sm },
  opt: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 5, borderColor: colors.line, backgroundColor: '#fff' },
  optSel: { borderColor: colors.cobalt, backgroundColor: colors.navySoft },
  optT: { fontFamily: fonts.sansMedium, fontSize: fs(17), color: colors.ink },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, fontFamily: fonts.sansMedium, fontSize: fs(17), backgroundColor: '#fff', color: colors.ink },
});
