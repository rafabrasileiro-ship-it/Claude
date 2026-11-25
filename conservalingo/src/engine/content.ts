import characters from '../data/characters.json';
import unitsData from '../data/units.json';
import wisdomData from '../data/wisdom.json';
import readingData from '../data/reading.json';
import type { Unit } from '../types';

export const units = unitsData.units as Unit[];
export const wisdom = wisdomData as { id: string; en: string; pt: string; source: string; kind: string }[];
export const readings = readingData as { id: string; title: string; author: string; level: number; cost: number; words: [string, string][]; sourceNote: string }[];
export const mascot = characters.mascot;
export const families = characters.families;

export interface Person { id: string; name: string; emoji: string; color: string; sex: 'M' | 'F'; label: string }

// Índice de todas as pessoas (protagonistas, cônjuges e filhos) para exibir quadrinhos.
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

export function findLesson(id: string) {
  for (const u of units) for (const l of u.lessons) if (l.id === id) return { unit: u, lesson: l };
  return null;
}

export function dailyWisdom(seed: number) {
  return wisdom[Math.abs(seed) % wisdom.length];
}
