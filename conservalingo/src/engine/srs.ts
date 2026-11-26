import type { SrsCard } from '../types';

/**
 * FSRS v4.5 (Free Spaced Repetition Scheduler) com os parâmetros-padrão públicos.
 * Acerto = nota "Good" (3); erro = "Again" (1). Retenção desejada: 90%.
 */
const DAY = 24 * 60 * 60 * 1000;
export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const RETENTION = 0.9;
const RELEARN_MS = 10 * 60 * 1000; // após um erro, o item volta em 10 minutos

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initD = (g: number) => clampD(W[4] - (g - 3) * W[5]);
const intervalDays = (s: number) => Math.max(1, Math.min(365, Math.round((s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1))));

/** Probabilidade (0–1) de o aluno ainda lembrar do item agora. */
export function retrievability(c: SrsCard | undefined, now = Date.now()): number {
  if (!c || !(c.s > 0)) return 0;
  const t = Math.max(0, (now - c.last) / DAY);
  return Math.pow(1 + (FACTOR * t) / c.s, DECAY);
}

export function review(card: SrsCard | undefined, correct: boolean, now = Date.now()): SrsCard {
  const g = correct ? 3 : 1;
  if (!card || !(card.s > 0)) {
    const s = W[g - 1];
    return { s, d: initD(g), last: now, due: correct ? now + intervalDays(s) * DAY : now + RELEARN_MS, reps: 1, lapses: correct ? 0 : 1 };
  }
  const r = retrievability(card, now);
  const d = clampD(W[7] * initD(4) + (1 - W[7]) * (card.d - W[6] * (g - 3)));
  const s = correct
    ? card.s * (Math.exp(W[8]) * (11 - card.d) * Math.pow(card.s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) + 1)
    : Math.min(card.s, W[11] * Math.pow(card.d, -W[12]) * (Math.pow(card.s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
  return { s, d, last: now, due: correct ? now + intervalDays(s) * DAY : now + RELEARN_MS, reps: card.reps + 1, lapses: card.lapses + (correct ? 0 : 1) };
}

/** Itens vencidos, do mais esquecido para o menos esquecido. */
export function dueKeys(srs: Record<string, SrsCard>, now = Date.now(), limit = 10): string[] {
  return Object.entries(srs)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => retrievability(a[1], now) - retrievability(b[1], now))
    .slice(0, limit)
    .map(([k]) => k);
}

/** Itens com menor probabilidade de lembrança (vencidos ou não) — base da Revisão Cirúrgica. */
export function weakestKeys(srs: Record<string, SrsCard>, filter: (key: string) => boolean, limit: number, now = Date.now()): string[] {
  return Object.entries(srs)
    .filter(([k]) => filter(k))
    .sort((a, b) => retrievability(a[1], now) - retrievability(b[1], now))
    .slice(0, limit)
    .map(([k]) => k);
}
