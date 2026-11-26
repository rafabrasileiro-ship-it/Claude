import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
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
import Home from './screens/Home';
import LevelScreen from './screens/Level';
import LessonScreen from './screens/Lesson';
import Reading from './screens/Reading';
import Characters from './screens/Characters';
import Family from './screens/Family';
import Honra from './screens/Honra';
import Caderno from './screens/Caderno';
import Onboarding from './screens/Onboarding';
import { ensureDaily, settleLeague, dayKey } from './engine/game';
import { AVAILABLE, isDone, lessonUnlocked } from './engine/levels';
import { dueKeys } from './engine/srs';
import type { LessonRef } from './nav';

type Tab = 'trilha' | 'caderno' | 'leitura' | 'honra' | 'familia';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'trilha', icon: '🧭', label: 'Trilha' },
  { id: 'caderno', icon: '📓', label: 'Caderno' },
  { id: 'leitura', icon: '📖', label: 'Leitura' },
  { id: 'honra', icon: '🎖️', label: 'Honra' },
  { id: 'familia', icon: '🏡', label: 'Família' },
];

function Shell() {
  const [tab, setTab] = useState<Tab>('trilha');
  const [levelId, setLevelId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonRef | null>(null);
  const [cast, setCast] = useState(false);
  const { profile, state, setState } = useStore();

  // Ao abrir o app (ou virar o dia): fecha a liga da semana anterior e sorteia as 3 missões do dia.
  useEffect(() => {
    setState((st) => ({
      ...st,
      profiles: st.profiles.map((p0) => {
        const p = settleLeague(p0);
        const chronicleAvailable = AVAILABLE.some((l) => lessonUnlocked(p, l.id, 8) && !isDone(p, l.id, 8));
        return ensureDaily(p, { chronicleAvailable, hasDue: dueKeys(p.srs).length > 0, hour: new Date().getHours() });
      }),
    }));
  }, [dayKey(), state.activeProfileId]);

  // Botão "voltar" do Android: fecha a camada aberta antes de sair do app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (lesson) { setLesson(null); return true; }
      if (cast) { setCast(false); return true; }
      if (levelId && tab === 'trilha') { setLevelId(null); return true; }
      if (tab !== 'trilha') { setTab('trilha'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [lesson, cast, levelId, tab]);

  if (profile.anchor === undefined) {
    return <SafeAreaView style={s.root}><Onboarding /></SafeAreaView>;
  }
  if (lesson) {
    return (
      <SafeAreaView style={s.root}>
        <LessonScreen key={JSON.stringify(lesson)} target={lesson} onExit={() => setLesson(null)} />
      </SafeAreaView>
    );
  }
  if (cast) return <SafeAreaView style={s.root}><Characters onClose={() => setCast(false)} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.brand}>CONSERVALINGO</Text>
        <Text style={s.who}>{profile.name}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'trilha' && (levelId
          ? <LevelScreen key={levelId} levelId={levelId} onStart={setLesson} onBack={() => setLevelId(null)} onOpenLevel={setLevelId} />
          : <Home onOpenLevel={setLevelId} onStart={setLesson} />)}
        {tab === 'caderno' && <Caderno onStart={setLesson} />}
        {tab === 'leitura' && <Reading />}
        {tab === 'honra' && <Honra onOpenCast={() => setCast(true)} />}
        {tab === 'familia' && <Family />}
      </View>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={s.tab} onPress={() => { setTab(t.id); if (t.id === 'trilha' && tab === 'trilha') setLevelId(null); }}
            accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
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
