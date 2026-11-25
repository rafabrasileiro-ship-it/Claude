import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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

type Tab = 'trilha' | 'leitura' | 'personagens' | 'familia';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'trilha', icon: '🧭', label: 'Trilha' },
  { id: 'leitura', icon: '📖', label: 'Leitura' },
  { id: 'personagens', icon: '🦅', label: 'Elenco' },
  { id: 'familia', icon: '🏡', label: 'Família' },
];

function Shell() {
  const [tab, setTab] = useState<Tab>('trilha');
  const [lesson, setLesson] = useState<LessonRef | null>(null);
  const { profile } = useStore();

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
    <StoreProvider>
      <StatusBar style="light" />
      <Shell />
    </StoreProvider>
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
