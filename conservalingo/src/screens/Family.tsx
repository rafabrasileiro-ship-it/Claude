import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P } from '../components/ui';
import { useStore } from '../store';
import { activeStreak, newProfile, tierName } from '../engine/game';

export default function Family() {
  const { state, setState } = useStore();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'M' | 'F'>('M');
  const [msg, setMsg] = useState('');

  if (!unlocked) {
    const hasPin = !!state.parentPin;
    return (
      <View style={s.pad}>
        <H1>Modo Família</H1>
        <P>Área dos pais: gerencie perfis infantis e acompanhe o desempenho. Ambiente fechado: sem chat com estranhos, sem anúncios e sem conteúdo ideológico.</P>
        <P style={{ fontFamily: fonts.sansBold }}>{hasPin ? 'Digite o PIN dos pais' : 'Crie um PIN de 4 dígitos'}</P>
        <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry style={s.input} placeholder="••••" maxLength={4} />
        {!!msg && <Text style={{ color: colors.crimson }}>{msg}</Text>}
        <Btn title={hasPin ? 'Entrar' : 'Criar PIN'} disabled={pin.length !== 4} onPress={() => {
          if (!hasPin) { setState((x) => ({ ...x, parentPin: pin })); setUnlocked(true); setMsg(''); }
          else if (pin === state.parentPin) { setUnlocked(true); setMsg(''); }
          else setMsg('PIN incorreto.');
          setPin('');
        }} />
      </View>
    );
  }

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const id = `p${Date.now()}`;
    setState((x) => ({ ...x, profiles: [...x.profiles, newProfile(id, n, true, sex, Number(age) || undefined)] }));
    setName(''); setAge('');
  };

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>Perfis da Família</H1>
      {state.profiles.map((p) => {
        const r = { name: tierName(p.league?.tier ?? 0, p.sex) };
        const active = p.id === state.activeProfileId;
        return (
          <Card key={p.id} style={[{ gap: 6 }, active && { borderColor: colors.gold, borderWidth: 2 }]}>
            <Text style={s.name}>{p.isChild ? (p.sex === 'M' ? '👦' : '👧') : (p.sex === 'M' ? '👨' : '👩')} {p.name}{p.age ? `, ${p.age} anos` : ''}</Text>
            <P style={{ fontSize: fs(13) }}>
              {r.name} · {p.xp} XP · 🧭 {activeStreak(p)} dias · 🪙 {p.talents} · {Object.keys(p.completed).length} lições concluídas
            </P>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!active && <Btn style={{ flex: 1 }} title="Usar este perfil" onPress={() => setState((x) => ({ ...x, activeProfileId: p.id }))} />}
              {state.profiles.length > 1 && (
                <Btn style={{ flex: 1 }} kind="ghost" title="Remover" onPress={() => setState((x) => {
                  const rest = x.profiles.filter((q) => q.id !== p.id);
                  return { ...x, profiles: rest, activeProfileId: x.activeProfileId === p.id ? rest[0].id : x.activeProfileId };
                })} />
              )}
            </View>
          </Card>
        );
      })}
      <H1 style={{ fontSize: fs(18) }}>Adicionar filho(a)</H1>
      <TextInput value={name} onChangeText={setName} placeholder="Nome" style={s.inputText} />
      <TextInput value={age} onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))} placeholder="Idade" keyboardType="number-pad" style={s.inputText} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Btn style={{ flex: 1 }} kind={sex === 'M' ? 'primary' : 'ghost'} title="Menino" onPress={() => setSex('M')} />
        <Btn style={{ flex: 1 }} kind={sex === 'F' ? 'primary' : 'ghost'} title="Menina" onPress={() => setSex('F')} />
      </View>
      <Btn kind="gold" title="Adicionar perfil" disabled={!name.trim()} onPress={add} />
      <Btn kind="ghost" title="Trancar área dos pais" onPress={() => setUnlocked(false)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  name: { fontFamily: fonts.serif, fontSize: fs(16), color: colors.navy },
  input: { fontFamily: fonts.sansBold, fontSize: fs(28), letterSpacing: 12, textAlign: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: space.md, backgroundColor: colors.card },
  inputText: { fontFamily: fonts.sans, fontSize: fs(16), borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: space.md, backgroundColor: colors.card },
});
