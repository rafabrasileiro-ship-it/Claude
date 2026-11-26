import type { Profile, SlotType } from '../types';
import { MAX_SHIELDS, bump, stars, touchStreak, weekKey } from './game';

export interface LessonResult { talents: number; xp: number; gold: number; stars: number }
export type SessionType = SlotType | 'practice' | 'phon';

/** Aplica o resultado de uma sessão: talentos, XP, Talentos de Ouro, ofensiva, missões e Provérbios colecionados. */
export function completeLesson(p0: Profile, o: { lessonId?: string; type: SessionType; errors: number; bonusTalents?: number; wisdomId?: string }, now = new Date()): { p: Profile; r: LessonResult } {
  const st = stars(o.errors);
  const first = !!o.lessonId && !(p0.completed[o.lessonId] ?? 0);
  const talents = 10 + (o.errors === 0 ? 5 : 0) + (o.bonusTalents ?? 0);
  const xp = 20 + st * 5 + (o.type === 'checkpoint' || o.type === 'cronica' ? 10 : 0);
  const gold = o.type === 'checkpoint' && first ? 1 + (o.errors === 0 ? 1 : 0) : 0;
  let p = touchStreak(p0);
  const wk = p.weekXp.week === weekKey(now) ? p.weekXp.xp : 0;
  p = {
    ...p, talents: p.talents + talents, xp: p.xp + xp, gold: (p.gold ?? 0) + gold, weekXp: { week: weekKey(now), xp: wk + xp },
    completed: o.lessonId ? { ...p.completed, [o.lessonId]: Math.max(p.completed[o.lessonId] ?? 0, st) } : p.completed,
    // O Treino de Revisão & Pronúncia restaura um Escudo de Atenção.
    shields: o.type === 'practice' || o.type === 'phon' ? { count: Math.min(MAX_SHIELDS, p.shields.count + 1), updatedAt: Date.now() } : p.shields,
  };
  if (o.wisdomId) {
    const prev = p.proverbs?.[o.wisdomId];
    p = { ...p, proverbs: { ...(p.proverbs ?? {}), [o.wisdomId]: { ...prev, seen: (prev?.seen ?? 0) + 1 } } };
  }
  if (o.type === 'practice' || o.type === 'phon') p = bump(p, 'practice');
  else {
    p = bump(p, 'lessons');
    if (o.errors === 0) p = bump(p, 'perfect');
    if (o.type === 'cronica') p = bump(p, 'chronicles');
    if (o.type === 'escuta') p = bump(p, 'listening');
  }
  if (now.getHours() < 8) p = bump(p, 'early');
  return { p, r: { talents, xp, gold, stars: st } };
}
