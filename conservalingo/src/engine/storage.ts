import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '../types';
import { newProfile, migrateProfile } from './game';

const KEY = 'conservalingo:state:v1';

export function initialState(): AppState {
  return { version: 1, activeProfileId: 'p1', profiles: [newProfile('p1', 'Aluno', false, 'M')], parentPin: null };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s.version === 1 && s.profiles?.length) return { ...s, profiles: s.profiles.map(migrateProfile) };
    }
  } catch { /* estado corrompido: recomeça */ }
  return initialState();
}

export async function saveState(s: AppState) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem persistência */ }
}
