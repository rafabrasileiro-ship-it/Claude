import type { SrsCard } from '../types';

const DAY = 24 * 60 * 60 * 1000;

/** SM-2 simplificado. quality: 5 = acerto, 2 = erro. */
export function review(card: SrsCard | undefined, correct: boolean, now = Date.now()): SrsCard {
  const c: SrsCard = card ?? { ease: 2.5, interval: 0, due: now, reps: 0 };
  if (!correct) return { ease: Math.max(1.3, c.ease - 0.2), interval: 1, due: now + DAY / 4, reps: 0 };
  const reps = c.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(c.interval * c.ease);
  return { ease: Math.min(3, c.ease + 0.05), interval, due: now + interval * DAY, reps };
}

export function dueKeys(srs: Record<string, SrsCard>, now = Date.now(), limit = 10): string[] {
  return Object.entries(srs)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .slice(0, limit)
    .map(([k]) => k);
}
