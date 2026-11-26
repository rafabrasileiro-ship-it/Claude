import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppState, Profile } from './types';
import { initialState, loadState, saveState } from './engine/storage';
import { regenShields, weekKey } from './engine/game';

interface Store {
  state: AppState;
  profile: Profile;
  setState: (fn: (s: AppState) => AppState) => void;
  updateProfile: (fn: (p: Profile) => Profile) => void;
}
const Ctx = createContext<Store | null>(null);

/** Perfil "ao vivo": escudos regenerados e XP semanal da semana atual. */
function live(p: Profile): Profile {
  const q = regenShields(p);
  return q.weekXp.week !== weekKey() ? { ...q, weekXp: { week: weekKey(), xp: 0 } } : q;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<AppState | null>(null);

  useEffect(() => { loadState().then(setStateRaw); }, []);

  const setState = useCallback((fn: (s: AppState) => AppState) => {
    setStateRaw((prev) => {
      const next = fn(prev ?? initialState());
      saveState(next);
      return next;
    });
  }, []);

  const value = useMemo<Store | null>(() => {
    if (!state) return null;
    const raw = state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
    const profile = live(raw);
    return {
      state, profile, setState,
      // Sempre aplica a alteração sobre o estado MAIS RECENTE (várias atualizações no mesmo toque não se perdem).
      updateProfile: (fn) => setState((s) => {
        const id = s.profiles.some((p) => p.id === s.activeProfileId) ? s.activeProfileId : s.profiles[0].id;
        return { ...s, profiles: s.profiles.map((p) => (p.id === id ? fn(live(p)) : p)) };
      }),
    };
  }, [state, setState]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider ausente');
  return v;
}
