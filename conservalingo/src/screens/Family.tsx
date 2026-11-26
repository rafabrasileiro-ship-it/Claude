import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P } from '../components/ui';
import { useStore } from '../store';
import { activeStreak, lessonsToday, newProfile, tierName } from '../engine/game';
import { AVAILABLE, currentLevel, levelsCompleted } from '../engine/levels';
import { weakWords } from '../engine/pron';
import Bento from '../components/Bento';
import type { Profile } from '../types';

const GOALS = [1, 2, 3, 5];
const SHIELD_ITEMS = [
  'Sem chat aberto e sem contato com estranhos',
  'Sem anúncios e sem links para fora do app',
  'Conteúdo curado: família, fé, pátria e trabalho',
  'Ligas com competidores simulados (sem dados de outras pessoas)',
  'Progresso guardado só neste aparelho',
];

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
        <View style={{ alignItems: 'center' }}><Bento mood="saudacao" size={96} /></View>
        <H1>Painel Familiar</H1>
        <P>Área dos pais: gerencie os perfis dos filhos, defina metas diárias e acompanhe o progresso. Ambiente blindado: sem chat com estranhos, sem anúncios e sem conteúdo ideológico.</P>
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

  const edit = (id: string, fn: (p: Profile) => Profile) => setState((x) => ({ ...x, profiles: x.profiles.map((q) => (q.id === id ? fn(q) : q)) }));

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>Painel Familiar</H1>
      <Card style={{ gap: 6, backgroundColor: colors.oliveSoft, borderColor: colors.olive }}>
        <Text style={[s.name, { color: colors.olive }]}>🛡️ Ambiente 100% blindado</Text>
        {SHIELD_ITEMS.map((t) => <P key={t} style={{ fontSize: fs(13) }}>✔ {t}</P>)}
      </Card>
      {state.profiles.map((p) => {
        const r = { name: tierName(p.league?.tier ?? 0, p.sex) };
        const active = p.id === state.activeProfileId;
        const cur = currentLevel(p);
        const today = lessonsToday(p); const goal = p.goal ?? 2;
        const weak = weakWords(p, 99).length;
        return (
          <Card key={p.id} style={[{ gap: 8 }, active && { borderColor: colors.gold, borderWidth: 2 }]}>
            <Text style={s.name}>{p.isChild ? (p.sex === 'M' ? '👦' : '👧') : (p.sex === 'M' ? '👨' : '👩')} {p.name}{p.age ? `, ${p.age} anos` : ''}{active ? '  · em uso' : ''}</Text>
            <P style={{ fontSize: fs(13) }}>📍 Nível {cur.n}: {cur.title}</P>
            <P style={{ fontSize: fs(13) }}>🏅 {levelsCompleted(p)} de {AVAILABLE.length} níveis disponíveis concluídos (130 no total)</P>
            <P style={{ fontSize: fs(13) }}>📅 Hoje: {today}/{goal} {goal === 1 ? 'lição' : 'lições'}{today >= goal ? ' ✔ meta cumprida' : ''} · 🧭 {activeStreak(p)} dias</P>
            <P style={{ fontSize: fs(13) }}>🎖️ {r.name} · {p.xp} XP · 🪙 {p.talents} · 🥇 {p.gold ?? 0}</P>
            <P style={{ fontSize: fs(13) }}>🗣️ {weak ? `${weak} palavra${weak > 1 ? 's' : ''} para treinar a pronúncia` : 'Pronúncia sem pendências'}</P>
            <Text style={s.label}>Meta diária de lições</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {GOALS.map((g) => (
                <Pressable key={g} onPress={() => edit(p.id, (q) => ({ ...q, goal: g }))} style={[s.goal, goal === g && s.goalOn]} accessibilityRole="button" accessibilityState={{ selected: goal === g }}>
                  <Text style={[s.goalT, goal === g && { color: '#fff' }]}>{g}</Text>
                </Pressable>
              ))}
            </View>
            <Btn kind={p.asr !== false ? 'ghost' : 'danger'} title={p.asr !== false ? '🎙️ Microfone: liberado' : '🎙️ Microfone: desligado'}
              onPress={() => edit(p.id, (q) => ({ ...q, asr: q.asr === false }))} />
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
  label: { fontFamily: fonts.sansBold, fontSize: fs(13), color: colors.navy, marginTop: 4 },
  goal: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, alignItems: 'center', backgroundColor: '#fff' },
  goalOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  goalT: { fontFamily: fonts.sansBold, fontSize: fs(16), color: colors.navy },
  inputText: { fontFamily: fonts.sans, fontSize: fs(16), borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: space.md, backgroundColor: colors.card },
});
