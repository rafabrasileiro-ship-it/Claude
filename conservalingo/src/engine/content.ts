import characters from '../data/characters.json';
import unitsData from '../data/units.json';
import wisdomData from '../data/wisdom.json';
import readingData from '../data/reading.json';
import listeningData from '../data/listening.json';
import chroniclesData from '../data/chronicles.json';
import pronData from '../data/pronunciation.json';
import type { Unit, DialogueLine } from '../types';

export const units = unitsData.units as Unit[];
export const wisdom = wisdomData as { id: string; en: string; pt: string; source: string; kind: string }[];
export const readings = readingData as { id: string; title: string; author: string; level: number; cost: number; words: [string, string][]; sourceNote: string }[];
export const levels = (unitsData as { levels: { level: number; cefr: string; title: string; tag: string }[] }).levels;
export interface Station {
  unitId: string; title: string; lines: DialogueLine[];
  questions: { q: string; options: string[]; answer: string }[];
  roleplay: { who: string; ask: string; askPt: string; model: string; modelPt: string; accept: string[] };
}
export const stations = listeningData as Station[];
export const stationOf = (unitId: string) => stations.find((x) => x.unitId === unitId);
export interface Chronicle {
  id: string; title: string; icon: string; cast: string[]; unlockAfterUnit: string; intro: string;
  segments: { lines: DialogueLine[]; stop: { kind: 'deduce' | 'moral' | 'complete'; q: string; options: string[]; answer: string; why: string } }[];
}
export const chronicles = chroniclesData as Chronicle[];
export interface PronTip { id: string; title: string; words: string[]; rx: string; tip: string }
export const pronTips = pronData as PronTip[];
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

/** Protagonista da família de qualquer personagem (para o elogio de cada arquétipo). */
export const headOf: Record<string, string> = {};
for (const f of families) { headOf[f.id] = f.id; headOf[f.spouse.id] = f.id; f.children.forEach((c) => (headOf[c.id] = f.id)); }
