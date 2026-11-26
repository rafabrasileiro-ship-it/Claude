import type { Exercise, Lesson, Unit } from '../types';
import { shuffle, pick } from './rng';
import { units, people, stationOf } from './content';
import { dictationOk } from './pron';

const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:"“”]/g, '').replace(/\s+/g, ' ').trim();
export const normalize = norm;
export const tokens = (s: string) => s.replace(/([.,!?;:])/g, '').split(/\s+/).filter(Boolean);

function distractors(pool: string[], correct: string, n: number, rnd: () => number) {
  return pick(pool.filter((p) => norm(p) !== norm(correct)), n, rnd);
}

/** Gera os exercícios de uma lição a partir do vocabulário e do diálogo (JSON seed). */
export function buildLessonExercises(unit: Unit, lesson: Lesson, rnd: () => number): Exercise[] {
  const ex: Exercise[] = [];
  const allEn = unit.lessons.flatMap((l) => l.vocab.map((v) => v.en));
  const allPt = unit.lessons.flatMap((l) => l.vocab.map((v) => v.pt));

  lesson.vocab.slice(0, 4).forEach((v) => {
    ex.push({
      id: `${lesson.id}:v:${v.en}`, kind: 'choose', prompt: 'Qual é a tradução?', question: v.en, speak: v.en,
      options: shuffle([v.pt, ...distractors(allPt, v.pt, 3, rnd)], rnd), answer: v.pt,
      explain: `“${v.en}” significa “${v.pt}”.`,
    });
  });
  lesson.vocab.slice(4).concat(lesson.vocab.slice(0, 1)).slice(0, 2).forEach((v) => {
    ex.push({
      id: `${lesson.id}:l:${v.en}`, kind: 'listen', prompt: 'Ouça e escolha o que você ouviu', question: '🔊', speak: v.en,
      options: shuffle([v.en, ...distractors(allEn, v.en, 3, rnd)], rnd), answer: v.en,
      explain: `Você ouviu “${v.en}”, que significa “${v.pt}”. Ouça de novo, devagar, no botão 🐢.`,
    });
  });
  lesson.dialogue.forEach((d, i) => {
    const toEn = i % 2 === 0;
    const target = toEn ? d.en : d.pt;
    const words = tokens(target);
    const pool = toEn ? lesson.dialogue.flatMap((x) => tokens(x.en)) : lesson.dialogue.flatMap((x) => tokens(x.pt));
    const extra = distractors(Array.from(new Set(pool)), '', 2, rnd).filter((w) => !words.includes(w));
    ex.push({
      id: `${lesson.id}:d:${i}`, kind: toEn ? 'bank_en' : 'bank_pt',
      prompt: toEn ? 'Traduza para o inglês' : 'Traduza para o português',
      question: toEn ? d.pt : d.en, speak: d.en, voice: people[d.who]?.sex ?? 'M',
      bank: shuffle([...words, ...extra], rnd), answer: target,
      explain: `Frase certa: “${target}”. Foco desta unidade: ${unit.topics}`,
    });
  });
  // Ditado (escuta pura): a frase mais curta com 3+ palavras, sem texto na tela.
  const dictIdx = lesson.dialogue.map((d, i) => ({ i, n: tokens(d.en).length })).filter((x) => x.n >= 3 && x.i < lesson.dialogue.length - 1).sort((a, b) => a.n - b.n)[0]?.i;
  if (dictIdx !== undefined) {
    const d = lesson.dialogue[dictIdx];
    ex.push({ id: `${lesson.id}:t:${dictIdx}`, kind: 'dictation', prompt: 'Ditado: escreva em inglês o que você ouviu', question: '🔊', speak: d.en, voice: people[d.who]?.sex ?? 'M', answer: d.en, explain: `Frase certa: “${d.en}” — ${d.pt}` });
  }
  const last = lesson.dialogue[lesson.dialogue.length - 1];
  ex.push({ id: `${lesson.id}:s`, kind: 'speak', prompt: 'Leia em voz alta com boa dicção', question: last.en, speak: last.en, voice: people[last.who]?.sex ?? 'M', answer: last.en });
  return ex;
}

/** Desafio de revisão da unidade: amostra de todas as lições. */
export function buildReviewExercises(unit: Unit, rnd: () => number): Exercise[] {
  const all = unit.lessons.flatMap((l) => buildLessonExercises(unit, l, rnd).filter((e) => e.kind !== 'speak'));
  const rp = buildRoleplay(unit.id);
  return rp ? [...pick(all, 9, rnd), rp] : pick(all, 10, rnd);
}

/** Conversação guiada: o personagem pergunta em áudio e o aluno responde falando. */
export function buildRoleplay(unitId: string): Exercise | null {
  const st = stationOf(unitId); if (!st) return null;
  const r = st.roleplay;
  return { id: `${unitId}:r`, kind: 'roleplay', prompt: `${people[r.who]?.name ?? 'O personagem'} pergunta. Responda em inglês, falando.`, question: r.askPt, speak: r.ask,
    voice: people[r.who]?.sex ?? 'M', answer: r.model, accept: r.accept, hint: r.modelPt, explain: `Resposta modelo: “${r.model}” — ${r.modelPt}` };
}

/** Estação de Escuta: 3 perguntas de interpretação sobre o áudio. */
export function buildStationExercises(unitId: string, rnd: () => number): Exercise[] {
  const st = stationOf(unitId); if (!st) return [];
  const ex: Exercise[] = st.questions.map((q, i) => ({
    id: `${unitId}lis:q:${i}`, kind: 'choose', prompt: 'Pergunta sobre o áudio', question: q.q, options: shuffle([...q.options], rnd), answer: q.answer,
    explain: `Ouça de novo o diálogo para confirmar. Resposta: “${q.answer}”.`,
  }));
  const rp = buildRoleplay(unitId); if (rp) ex.push(rp);
  return ex;
}

/** Treino de Virtude: reconstrói exercícios a partir das chaves SRS vencidas. */
export function buildPracticeFromKeys(keys: string[], rnd: () => number): Exercise[] {
  const out: Exercise[] = [];
  const cache = new Map<string, Exercise[]>();
  for (const key of keys) {
    const lessonId = key.split(':')[0];
    let list = cache.get(lessonId);
    if (!list) {
      const unit = units.find((u) => u.lessons.some((l) => l.id === lessonId));
      const lesson = unit?.lessons.find((l) => l.id === lessonId);
      list = unit && lesson ? buildLessonExercises(unit, lesson, rnd) : [];
      cache.set(lessonId, list);
    }
    const found = list.find((e) => e.id === key);
    if (found) out.push(found);
  }
  return out;
}

export function checkAnswer(ex: Exercise, given: string): boolean {
  if (ex.kind === 'dictation') return dictationOk(ex.answer, given);
  return norm(given) === norm(ex.answer);
}
