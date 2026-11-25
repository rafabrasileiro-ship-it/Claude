import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, Card, H1, P } from '../components/ui';
import { readings } from '../engine/content';
import { useStore } from '../store';
import { say, sayPt } from '../engine/audio';

export default function Reading() {
  const { profile, updateProfile } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [gloss, setGloss] = useState<[string, string] | null>(null);
  const [wordByWord, setWordByWord] = useState(true);
  const open = readings.find((r) => r.id === openId);

  if (open) {
    const full = open.words.map((w) => w[0]).join(' ');
    return (
      <ScrollView contentContainerStyle={s.pad}>
        <Pressable onPress={() => { setOpenId(null); setGloss(null); }}><Text style={s.back}>← Biblioteca</Text></Pressable>
        <H1>{open.title}</H1>
        <P style={{ color: colors.muted }}>{open.author}</P>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Btn style={{ flex: 1 }} title="🔊 Normal" onPress={() => say(full)} />
          <Btn style={{ flex: 1 }} kind="ghost" title="🐢 Lento" onPress={() => say(full, 'M', true)} />
        </View>
        <Btn kind="ghost" title={wordByWord ? 'Ocultar tradução' : 'Mostrar tradução palavra por palavra'} onPress={() => setWordByWord(!wordByWord)} />
        <Card style={s.text}>
          {open.words.map(([en, pt], i) => (
            <Pressable key={i} onPress={() => { setGloss([en, pt]); say(en, 'M'); }} style={s.word}>
              <Text style={s.en}>{en}</Text>
              {wordByWord && <Text style={s.pt}>{pt}</Text>}
            </Pressable>
          ))}
        </Card>
        {gloss && <Card style={{ backgroundColor: colors.goldSoft, gap: space.sm }}><P><Text style={{ fontFamily: fonts.sansBold }}>{gloss[0]}</Text> = {gloss[1]}</P><Btn kind="ghost" title="🇧🇷 Ouvir em português" onPress={() => sayPt(gloss[1])} /></Card>}
        <P style={{ color: colors.muted, fontSize: fs(12) }}>{open.sourceNote}</P>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <H1>Leitura Clássica</H1>
      <P>Textos curtos e graduados, com áudio lento ou normal e tradução palavra por palavra.</P>
      {readings.map((r) => {
        const unlocked = r.cost === 0 || profile.unlocked.includes(r.id);
        return (
          <Card key={r.id} style={{ gap: space.sm }}>
            <Text style={s.title}>{r.title}</Text>
            <P style={{ color: colors.muted }}>{r.author} · Nível {r.level}</P>
            {unlocked ? (
              <Btn title="Ler" onPress={() => setOpenId(r.id)} />
            ) : (
              <Btn kind="gold" title={`Desbloquear por ${r.cost} 🪙`} disabled={profile.talents < r.cost}
                onPress={() => updateProfile((p) => ({ ...p, talents: p.talents - r.cost, unlocked: [...p.unlocked, r.id] }))} />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.md, gap: space.md, paddingBottom: 60 },
  back: { fontFamily: fonts.sansBold, color: colors.navy },
  title: { fontFamily: fonts.serif, fontSize: fs(17), color: colors.navy },
  text: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: colors.ivory },
  word: { alignItems: 'center' },
  en: { fontFamily: fonts.serifRegular, fontSize: fs(17), color: colors.ink },
  pt: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.olive },
});
