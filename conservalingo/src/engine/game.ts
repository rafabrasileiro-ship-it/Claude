import type { Profile } from '../types';

export const MAX_SHIELDS = 5;
export const SHIELD_REGEN_MS = 30 * 60 * 1000;

/** As 6 patentes das Ligas Semanais de Mérito. */
export const TIERS = [
  { m: 'Aprendiz', f: 'Aprendiz', icon: '🌱' },
  { m: 'Escudeiro', f: 'Escudeira', icon: '🛡️' },
  { m: 'Cavaleiro', f: 'Cavaleira', icon: '⚔️' },
  { m: 'Guardião', f: 'Guardiã', icon: '🏰' },
  { m: 'Embaixador', f: 'Embaixadora', icon: '🕊️' },
  { m: 'Patriarca', f: 'Matriarca', icon: '👑' },
] as const;
export const tierName = (tier: number, sex: 'M' | 'F') => TIERS[Math.max(0, Math.min(5, tier))][sex === 'M' ? 'm' : 'f'];

export const MILESTONES = [
  { days: 7, icon: '🥉', title: 'Sentinela', note: '7 dias seguidos' },
  { days: 30, icon: '🥈', title: 'Guardião da Constância', note: '30 dias seguidos' },
  { days: 90, icon: '🥇', title: 'Pilar da Disciplina', note: '90 dias seguidos' },
  { days: 365, icon: '🏆', title: 'Patriarca da Perseverança', note: '365 dias seguidos' },
] as const;

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
  return { ...p, streak: { count, last: today }, bestStreak: Math.max(p.bestStreak ?? 0, count) };
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
    bestStreak: 0, league: { tier: 0, week: weekKey() },
    daily: { day: '', picked: [], c: {}, claimed: [] }, chests: [],
  };
}

/** Completa campos novos em perfis salvos por versões anteriores. */
export function migrateProfile(p: Profile): Profile {
  return {
    ...p,
    bestStreak: Math.max(p.bestStreak ?? 0, p.streak?.count ?? 0),
    league: p.league ?? { tier: 0, week: weekKey() },
    daily: p.daily ?? { day: '', picked: [], c: {}, claimed: [] },
    chests: p.chests ?? [],
  };
}

export const stars = (errors: number) => (errors === 0 ? 3 : errors <= 2 ? 2 : 1);

// ───────────────────────── Missões Diárias Relâmpago (3 slots) ─────────────────────────
export interface MissionDef { id: string; title: string; counter: string; goal: number; reward: number }
export const MISSIONS: MissionDef[] = [
  { id: 'speak', title: 'Pronuncie 5 frases com mais de 90% de precisão', counter: 'speakGood', goal: 5, reward: 30 },
  { id: 'chron', title: 'Complete uma Crônica', counter: 'chronicles', goal: 1, reward: 30 },
  { id: 'early', title: 'Estude antes das 8h da manhã', counter: 'early', goal: 1, reward: 20 },
  { id: 'lessons', title: 'Conclua 2 lições', counter: 'lessons', goal: 2, reward: 20 },
  { id: 'perfect', title: 'Faça uma lição sem nenhum erro', counter: 'perfect', goal: 1, reward: 25 },
  { id: 'practice', title: 'Faça o Treino de Virtude', counter: 'practice', goal: 1, reward: 20 },
  { id: 'listen', title: 'Conclua uma Estação de Escuta', counter: 'listening', goal: 1, reward: 25 },
];
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id)!;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export { hash };

/** Garante o sorteio das 3 missões do dia (estável durante o dia) e zera contadores no dia novo. */
export function ensureDaily(p: Profile, ctx: { chronicleAvailable: boolean; hasDue: boolean; hour: number }, today = dayKey()): Profile {
  if (p.daily.day === today && p.daily.picked.length === 3) return p;
  const feasible = MISSIONS.filter((m) =>
    (m.id !== 'chron' || ctx.chronicleAvailable) && (m.id !== 'early' || ctx.hour < 8) && (m.id !== 'practice' || ctx.hasDue));
  const ranked = [...feasible].sort((a, b) => hash(today + a.id) - hash(today + b.id));
  // 1 missão de fala/lição, 1 de rotina e 1 de conteúdo especial, quando possível
  const picked: string[] = [];
  for (const group of [['speak', 'perfect'], ['lessons', 'early', 'practice'], ['chron', 'listen']]) {
    const m = ranked.find((x) => group.includes(x.id) && !picked.includes(x.id));
    if (m) picked.push(m.id);
  }
  for (const m of ranked) { if (picked.length >= 3) break; if (!picked.includes(m.id)) picked.push(m.id); }
  return { ...p, daily: { day: today, picked: picked.slice(0, 3), c: {}, claimed: [] } };
}

export function bump(p: Profile, counter: string, n = 1, today = dayKey()): Profile {
  const d = p.daily.day === today ? p.daily : { day: today, picked: [], c: {}, claimed: [] };
  return { ...p, daily: { ...d, c: { ...d.c, [counter]: (d.c[counter] ?? 0) + n } } };
}

// ───────────────────────── Ligas Semanais de Mérito ─────────────────────────
const RIVALS = ['Anderson', 'Bruna', 'Caio', 'Daniela', 'Eduardo', 'Fernanda', 'Gustavo', 'Isabela', 'João', 'Karina', 'Leandro', 'Marcela', 'Nelson', 'Olívia', 'Paulo', 'Renata', 'Samuel', 'Tatiana', 'Ulisses', 'Vanessa', 'Wagner', 'Yara', 'Zeca', 'Adriana', 'Breno', 'Camila', 'Davi M.', 'Elisa', 'Fábio'];
export const LEAGUE_SIZE = 30, PROMOTE_TOP = 10, DEMOTE_LAST = 5;

/** Fração da semana já decorrida (segunda 00h = 0, domingo 24h = 1). */
export function weekProgress(d = new Date()) {
  const day = (d.getDay() + 6) % 7; // segunda = 0
  return Math.min(1, (day + d.getHours() / 24) / 7);
}

/** Classificação da liga da semana. Os 29 competidores são SIMULADOS (liga local, sem servidor). */
export function standings(p: Profile, frac: number, week = p.league.week) {
  const rows = RIVALS.map((name) => {
    const target = 60 + (hash(`${week}:${p.league.tier}:${name}`) % 520) + p.league.tier * 40;
    return { name, xp: Math.round(target * Math.pow(frac, 0.85)), me: false };
  });
  const mine = p.weekXp.week === week ? p.weekXp.xp : 0;
  rows.push({ name: p.name, xp: mine, me: true });
  rows.sort((a, b) => b.xp - a.xp || (a.me ? 1 : 0) - (b.me ? 1 : 0));
  return rows.map((r, i) => ({ ...r, pos: i + 1 }));
}

/** Ao virar a semana: top 10 sobe de patente, os 5 últimos descem. */
export function settleLeague(p: Profile, now = new Date()): Profile {
  const wk = weekKey(now);
  if (!p.league) return { ...p, league: { tier: 0, week: wk } };
  if (p.league.week === wk) return p;
  const pos = standings(p, 1, p.league.week).find((r) => r.me)!.pos;
  const from = p.league.tier;
  const to = pos <= PROMOTE_TOP ? Math.min(5, from + 1) : pos > LEAGUE_SIZE - DEMOTE_LAST ? Math.max(0, from - 1) : from;
  return { ...p, league: { tier: to, week: wk, last: { from, to, pos } } };
}
