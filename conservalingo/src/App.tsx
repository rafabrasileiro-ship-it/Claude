import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Importa só as variações usadas (o índice do pacote embute todas e infla o APK).
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather/400Regular';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { colors, fonts, fs } from './theme';
import { StoreProvider, useStore } from './store';
import Home, { LessonRef } from './screens/Home';
import LessonScreen from './screens/Lesson';
import Reading from './screens/Reading';
import Characters from './screens/Characters';
import Family from './screens/Family';
import Honra from './screens/Honra';
import Chronicle from './screens/Chronicle';
import Onboarding from './screens/Onboarding';
import { ensureDaily, settleLeague, dayKey } from './engine/game';
import { chronicles } from './engine/content';
import { dueKeys } from './engine/srs';

type Tab = 'trilha' | 'leitura' | 'honra' | 'personagens' | 'familia';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'trilha', icon: '🧭', label: 'Trilha' },
  { id: 'leitura', icon: '📖', label: 'Leitura' },
  { id: 'honra', icon: '🎖️', label: 'Honra' },
  { id: 'personagens', icon: '🦅', label: 'Elenco' },
  { id: 'familia', icon: '🏡', label: 'Família' },
];

function Shell() {
  const [tab, setTab] = useState<Tab>('trilha');
  const [lesson, setLesson] = useState<LessonRef | null>(null);
  const { profile, state, setState } = useStore();

  // Ao abrir o app (ou virar o dia): fecha a liga da semana anterior e sorteia as 3 missões do dia.
  useEffect(() => {
    setState((st) => ({
      ...st,
      profiles: st.profiles.map((p0) => {
        const p = settleLeague(p0);
        const chronicleAvailable = chronicles.some((c) => (p.completed[`${c.unlockAfterUnit}rev`] ?? 0) > 0 && !(p.completed[c.id] ?? 0));
        return ensureDaily(p, { chronicleAvailable, hasDue: dueKeys(p.srs).length > 0, hour: new Date().getHours() });
      }),
    }));
  }, [dayKey(), state.activeProfileId]);

  if (profile.anchor === undefined) {
    return <SafeAreaView style={s.root}><Onboarding /></SafeAreaView>;
  }

  if (lesson && lesson.kind === 'chronicle') {
    return <SafeAreaView style={s.root}><Chronicle key={lesson.id} id={lesson.id} onExit={() => setLesson(null)} /></SafeAreaView>;
  }
  if (lesson) {
    return (
      <SafeAreaView style={s.root}>
        <LessonScreen key={JSON.stringify(lesson)} target={lesson} onExit={() => setLesson(null)} />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.brand}>CONSERVALINGO</Text>
        <Text style={s.who}>{profile.name}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'trilha' && <Home onStart={setLesson} />}
        {tab === 'leitura' && <Reading />}
        {tab === 'honra' && <Honra />}
        {tab === 'personagens' && <Characters />}
        {tab === 'familia' && <Family />}
      </View>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={s.tab} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={{ fontSize: fs(20) }}>{t.icon}</Text>
            <Text style={[s.tabLabel, tab === t.id && { color: colors.navy, fontFamily: fonts.sansBold }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [loaded] = useFonts({ Merriweather_400Regular, Merriweather_700Bold, Inter_400Regular, Inter_500Medium, Inter_700Bold });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
    <StoreProvider>
      <StatusBar style="light" />
      <Shell />
    </StoreProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  header: { backgroundColor: colors.navy, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.gold, fontFamily: fonts.serif, fontSize: fs(18), letterSpacing: 2 },
  who: { color: '#fff', fontFamily: fonts.sansMedium },
  tabs: { flexDirection: 'row', borderTopWidth: 2, borderTopColor: colors.line, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabLabel: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
});
