import characters from '../data/characters.json';
import wisdomData from '../data/wisdom.json';
import readingData from '../data/reading.json';
import pronData from '../data/pronunciation.json';
import curriculumData from '../data/curriculum.json';
import { LEVEL_FILES } from '../data/levels';
import type { Curriculum, LevelContent } from '../types';

export const curriculum = curriculumData as Curriculum;
export const levelContent = (id: string): LevelContent | undefined => LEVEL_FILES[id];
export const wisdom = wisdomData as { id: string; en: string; pt: string; source: string; kind: string }[];
export const wisdomById = (id: string) => wisdom.find((w) => w.id === id);
export const readings = readingData as { id: string; title: string; author: string; level: number; cost: number; words: [string, string][]; sourceNote: string }[];
export interface PronTip { id: string; title: string; words: string[]; rx: string; tip: string }
export const pronTips = pronData as PronTip[];
export const mascot = characters.mascot;
export const families = characters.families;

export interface Person { id: string; name: string; emoji: string; color: string; sex: 'M' | 'F'; label: string }

// Índice de todas as pessoas (protagonistas, cônjuges e filhos) para exibir os quadrinhos.
export const people: Record<string, Person> = {};
for (const f of families) {
  people[f.id] = { id: f.id, name: f.name, emoji: f.sex === 'M' ? '👨' : '👩', color: f.color, sex: f.sex as 'M' | 'F', label: f.profession };
  const s = f.spouse;
  people[s.id] = { id: s.id, name: s.name, emoji: s.sex === 'M' ? '👨' : '👩', color: f.color, sex: s.sex as 'M' | 'F', label: s.profession };
  for (const c of f.children) {
    people[c.id] = { id: c.id, name: c.name, emoji: c.sex === 'M' ? '👦' : '👧', color: f.color, sex: c.sex as 'M' | 'F', label: `${c.age} anos` };
  }
}
people[mascot.id] = { id: mascot.id, name: mascot.name, emoji: mascot.emoji, color: mascot.color, sex: 'M', label: mascot.species };

/** Protagonista da família de qualquer personagem (para o elogio de cada arquétipo). */
export const headOf: Record<string, string> = {};
/** Membros do núcleo familiar de cada personagem. */
export const familyOf: Record<string, string[]> = {};
for (const f of families) {
  const members = [f.id, f.spouse.id, ...f.children.map((c) => c.id)];
  members.forEach((m) => { headOf[m] = f.id; familyOf[m] = members; });
}

export function dailyWisdom(seed: number) {
  return wisdom[Math.abs(seed) % wisdom.length];
}
