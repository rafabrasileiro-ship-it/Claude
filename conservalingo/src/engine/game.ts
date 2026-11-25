import type { Profile } from '../types';

export const MAX_SHIELDS = 5;
export const SHIELD_REGEN_MS = 30 * 60 * 1000;

export const RANKS = [
  { min: 0, m: 'Aprendiz', f: 'Aprendiz' },
  { min: 200, m: 'Escudeiro', f: 'Escudeira' },
  { min: 600, m: 'Guardião', f: 'Guardiã' },
  { min: 1200, m: 'Embaixador', f: 'Embaixadora' },
  { min: 2500, m: 'Patriarca', f: 'Matriarca' },
] as const;

export function rankFor(xp: number, sex: 'M' | 'F') {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.min) idx = i; });
  const next = RANKS[idx + 1];
  return { index: idx, name: RANKS[idx][sex === 'M' ? 'm' : 'f'], next: next ? next.min : null, base: RANKS[idx].min };
}

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Recupera escudos com o tempo. */
export function regenShields(p: Profile, now = Date.now()): Profile {
  if (p.shields.count >= MAX_SHIELDS) return { ...p, shields: { count: MAX_SHIELDS, updatedAt: now } };
  const gained = Math.floor((now - p.shields.updatedAt) / SHIELD_REGEN_MS);
  if (gained <= 0) return p;
  const count = Math.min(MAX_SHIELDS, p.shields.count + gained);
  return { ...p, shields: { count, updatedAt: count >= MAX_SHIELDS ? now : p.shields.updatedAt + gained * SHIELD_REGEN_MS } };
}

/** Atualiza a Bússola de Constância ao estudar hoje. */
export function touchStreak(p: Profile, today = dayKey()): Profile {
  if (p.streak.last === today) return p;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const count = p.streak.last === dayKey(y) ? p.streak.count + 1 : 1;
  return { ...p, streak: { count, last: today } };
}

export function activeStreak(p: Profile, today = dayKey()): number {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return p.streak.last === today || p.streak.last === dayKey(y) ? p.streak.count : 0;
}

export function newProfile(id: string, name: string, isChild: boolean, sex: 'M' | 'F', age?: number): Profile {
  return {
    id, name, isChild, sex, age,
    streak: { count: 0, last: null }, talents: 0,
    shields: { count: MAX_SHIELDS, updatedAt: Date.now() },
    xp: 0, weekXp: { week: weekKey(), xp: 0 },
    completed: {}, srs: {}, unlocked: [],
  };
}

export function stars(errors: number) { return errors === 0 ? 3 : errors <= 2 ? 2 : 1; }
