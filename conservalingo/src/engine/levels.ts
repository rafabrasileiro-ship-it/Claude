import { curriculum, levelContent, people, familyOf } from './content';
import type { LevelContent, LevelDef, Profile, Ref, Voice } from '../types';

/** Os 130 níveis (5 Eras × 26). */
export const LEVELS: LevelDef[] = curriculum.levels;
/** Níveis com conteúdo pronto, na ordem da trilha. */
export const AVAILABLE: LevelDef[] = LEVELS.filter((l) => l.status === 'available' && !!levelContent(l.id));

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const lessonId = (levelId: string, slot: number) => `${levelId}-${pad2(slot)}`;
export const slotDef = (slot: number) => curriculum.slots[slot - 1];
export const blockOf = (l: LevelDef) => curriculum.blocks[l.block];
export const eraOf = (l: LevelDef) => curriculum.eras[l.era - 1];
export const levelDef = (id: string) => LEVELS.find((l) => l.id === id);
export const levelNumber = (id: string) => Number(id.slice(1));

export const isDone = (p: Profile, levelId: string, slot: number) => (p.completed[lessonId(levelId, slot)] ?? 0) > 0;
export const levelDone = (p: Profile, levelId: string) => isDone(p, levelId, 10);
export const lessonsDone = (p: Profile, levelId: string) => curriculum.slots.filter((s) => isDone(p, levelId, s.slot)).length;
export const levelsCompleted = (p: Profile) => AVAILABLE.filter((l) => levelDone(p, l.id)).length;

/** Um nível disponível fica liberado quando o Checkpoint de Honra do nível disponível anterior é concluído. */
export function levelUnlocked(p: Profile, levelId: string): boolean {
  const i = AVAILABLE.findIndex((l) => l.id === levelId);
  if (i < 0) return false;
  return i === 0 || levelDone(p, AVAILABLE[i - 1].id);
}
export function lessonUnlocked(p: Profile, levelId: string, slot: number): boolean {
  if (!levelUnlocked(p, levelId)) return false;
  return slot === 1 || isDone(p, levelId, slot - 1);
}
/** Nível atual: o primeiro disponível ainda não concluído (ou o último, se todos estiverem concluídos). */
export function currentLevel(p: Profile): LevelDef {
  return AVAILABLE.find((l) => levelUnlocked(p, l.id) && !levelDone(p, l.id)) ?? AVAILABLE[AVAILABLE.length - 1];
}
/** Próxima lição a fazer no nível (1–10), ou null se o nível estiver completo. */
export function nextSlot(p: Profile, levelId: string): number | null {
  for (let s = 1; s <= 10; s++) if (!isDone(p, levelId, s)) return s;
  return null;
}

// ───────────── Itens de conteúdo ─────────────
export const voiceOf = (who?: string): Voice => (who ? people[who]?.sex ?? 'M' : 'M');
export interface Item { ref: Ref; kind: 'chunk' | 'line'; en: string; pt: string; who?: string; voice: Voice; alt?: string[]; note?: string }

export function itemOf(level: LevelContent, ref: Ref): Item | undefined {
  const c = level.chunks.find((x) => x.id === ref);
  if (c) return { ref, kind: 'chunk', en: c.en, pt: c.pt, voice: 'M', note: c.note };
  const s = level.sentences.find((x) => x.id === ref);
  if (s) return { ref, kind: 'line', en: s.en, pt: s.pt, who: s.who, voice: voiceOf(s.who), alt: s.alt };
  let m = /^(d\d+)\.(\d+)$/.exec(ref);
  if (m) {
    const ln = level.dialogues.find((d) => d.id === m![1])?.lines[Number(m[2])];
    return ln && { ref, kind: 'line', en: ln.en, pt: ln.pt, who: ln.who, voice: voiceOf(ln.who) };
  }
  m = /^l\.(\d+)$/.exec(ref);
  if (m) {
    const ln = level.listening.lines[Number(m[1])];
    return ln && { ref, kind: 'line', en: ln.en, pt: ln.pt, who: ln.who, voice: voiceOf(ln.who) };
  }
  return undefined;
}

/** Todos os itens revisáveis do nível (blocos, frases e falas). */
export function allItems(level: LevelContent): Item[] {
  const refs: Ref[] = [
    ...level.chunks.map((c) => c.id),
    ...level.sentences.map((s) => s.id),
    ...level.dialogues.flatMap((d) => d.lines.map((_, i) => `${d.id}.${i}`)),
    ...level.listening.lines.map((_, i) => `l.${i}`),
  ];
  return refs.map((r) => itemOf(level, r)!).filter(Boolean);
}

/** Elenco permitido num nível: personagens do bloco, seus núcleos familiares e o Tio Bento. */
export function allowedSpeakers(l: LevelDef): Set<string> {
  const out = new Set<string>(['bento']);
  blockOf(l).cast.forEach((c) => (familyOf[c] ?? [c]).forEach((m) => out.add(m)));
  return out;
}
