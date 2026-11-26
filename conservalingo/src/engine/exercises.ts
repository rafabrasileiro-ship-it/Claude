import type { Exercise, LevelContent, LessonSpec, Profile, Step } from '../types';
import { shuffle, pick } from './rng';
import { people, levelContent, pronTips } from './content';
import { AVAILABLE, allItems, itemOf, lessonsDone, levelNumber, voiceOf, type Item } from './levels';
import { dictationOk, firstLetters, weakWords, writeOk, tipFor } from './pron';
import { dueKeys, weakestKeys } from './srs';

const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:"“”]/g, '').replace(/\s+/g, ' ').trim();
export const normalize = norm;
export const tokens = (s: string) => s.replace(/([.,!?;:"“”])/g, '').split(/\s+/).filter(Boolean);
const name = (who?: string) => (who ? people[who]?.name ?? '' : '');
const itemKey = (levelId: string, ref: string) => `${levelId}:${ref}`;
const stepKey = (levelId: string, slot: number, i: number) => `${levelId}@${slot}.${i}`;
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function distinct(pool: string[], exclude: string[], n: number, rnd: () => number) {
  const ex = new Set(exclude.map(norm));
  const uniq = Array.from(new Map(pool.filter((p) => !ex.has(norm(p))).map((p) => [norm(p), p])).values());
  return pick(uniq, n, rnd);
}
const chunkPool = (lv: LevelContent) => allItems(lv).filter((i) => i.kind === 'chunk');
const linePool = (lv: LevelContent) => allItems(lv).filter((i) => i.kind === 'line');
const poolFor = (lv: LevelContent, it: Item) => {
  const own = it.kind === 'chunk' ? chunkPool(lv) : linePool(lv);
  return own.length >= 4 ? own : allItems(lv);
};

function choose(lv: LevelContent, it: Item, dir: 'en-pt' | 'pt-en', rnd: () => number, id: string): Exercise {
  const pool = poolFor(lv, it);
  const toPt = dir === 'en-pt';
  const answer = toPt ? it.pt : it.en;
  return {
    id, kind: 'choose', prompt: toPt ? 'Qual é a tradução?' : 'Como se diz em inglês?', question: toPt ? it.en : it.pt,
    speak: it.en, voice: it.voice, answer,
    options: shuffle([answer, ...distinct(pool.map((p) => (toPt ? p.pt : p.en)), [answer], 3, rnd)], rnd),
    explain: `“${it.en}” = “${it.pt}”.${it.note ? ` ${it.note}` : ''}`, srsKey: itemKey(lv.id, it.ref),
  };
}
function listen(lv: LevelContent, it: Item, rnd: () => number, id: string): Exercise {
  return {
    id, kind: 'listen', prompt: 'Ouça e escolha o que você ouviu', question: '🔊', speak: it.en, voice: it.voice, answer: it.en,
    options: shuffle([it.en, ...distinct(poolFor(lv, it).map((p) => p.en), [it.en], 3, rnd)], rnd),
    explain: `Você ouviu “${it.en}” — ${it.pt}. Ouça de novo no botão 🐢.`, srsKey: itemKey(lv.id, it.ref),
  };
}
function bank(lv: LevelContent, it: Item, dir: 'pt-en' | 'en-pt', rnd: () => number, id: string): Exercise {
  const toEn = dir === 'pt-en';
  const target = toEn ? it.en : it.pt;
  const words = tokens(target);
  const pool = linePool(lv).flatMap((x) => tokens(toEn ? x.en : x.pt));
  const lower = new Set(words.map((w) => w.toLowerCase()));
  const extra = distinct(pool.filter((w) => !lower.has(w.toLowerCase())), [], 2, rnd);
  return {
    id, kind: toEn ? 'bank_en' : 'bank_pt', prompt: toEn ? 'Traduza para o inglês' : 'Traduza para o português',
    question: toEn ? it.pt : it.en, speak: it.en, voice: it.voice, bank: shuffle([...words, ...extra], rnd), answer: target,
    explain: `Frase certa: “${target}”.${lv.grammar ? ` Foco do nível: ${lv.grammar}` : ''}`, srsKey: itemKey(lv.id, it.ref),
  };
}
function dictation(lv: LevelContent, it: Item, id: string): Exercise {
  return {
    id, kind: 'dictation', prompt: 'Ditado: escreva em inglês o que você ouviu', question: '🔊', speak: it.en, voice: it.voice, answer: it.en,
    explain: `Frase certa: “${it.en}” — ${it.pt}`, srsKey: itemKey(lv.id, it.ref),
  };
}
function write(lv: LevelContent, it: Item, hint: 'first' | 'none', id: string): Exercise {
  return {
    id, kind: 'write', prompt: hint === 'first' ? 'Traduza para o inglês (dica: primeiras letras)' : 'Traduza para o inglês, sem dicas',
    question: it.pt, answer: it.en, accept: [it.en, ...(it.alt ?? [])], hint: hint === 'first' ? firstLetters(it.en) : undefined,
    speak: it.en, voice: it.voice, explain: `Uma tradução correta: “${it.en}”.`, srsKey: itemKey(lv.id, it.ref),
  };
}
function speak(it: Item, id: string): Exercise {
  return { id, kind: 'speak', prompt: 'Leia em voz alta com boa dicção', question: it.en, speak: it.en, voice: it.voice, answer: it.en, hint: it.pt };
}
export function roleplay(lv: LevelContent, id: string): Exercise {
  const r = lv.roleplay;
  return {
    id, kind: 'roleplay', prompt: `${name(r.who) || 'O personagem'} pergunta. Responda em inglês, falando.`, question: r.askPt, speak: r.ask,
    voice: voiceOf(r.who), answer: r.model, accept: r.accept, hint: r.modelPt, explain: `Resposta modelo: “${r.model}” — ${r.modelPt}`,
  };
}
function question(lv: LevelContent, qi: number, rnd: () => number, id: string): Exercise {
  const q = lv.listening.questions[qi];
  return {
    id, kind: 'choose', prompt: `Pergunta sobre o áudio “${lv.listening.title}”`, question: q.q, options: shuffle([...q.options], rnd), answer: q.answer,
    speak: q.lang === 'pt' ? undefined : q.answer, voice: 'M', explain: `Resposta: “${q.answer}”. Ouça o diálogo de novo para confirmar.`, srsKey: `${lv.id}@q${qi}`,
  };
}
export function wordSpeak(w: string, id: string): Exercise {
  return { id, kind: 'speak', word: true, prompt: 'Registro de Fonemas: diga a palavra', question: w, speak: w, voice: 'M', answer: w, hint: tipFor(w).title };
}

/** Converte um passo do JSON do nível em exercício(s) concreto(s). */
export function buildStep(lv: LevelContent, slot: number, i: number, step: Step, rnd: () => number, id = stepKey(lv.id, slot, i)): Exercise[] {
  const item = (ref: string) => {
    const it = itemOf(lv, ref);
    if (!it) throw new Error(`${lv.id}: referência inexistente ${ref}`);
    return it;
  };
  switch (step.kind) {
    case 'learn': {
      const it = item(step.ref);
      return [{ id, kind: 'learn', prompt: 'Novo bloco de expressão', question: it.en, answer: it.pt, speak: it.en, voice: it.voice, hint: it.note }];
    }
    case 'note': {
      const examples = (step.examples ?? []).map((r) => { const it = item(r); return { en: it.en, pt: it.pt, voice: it.voice }; });
      return [{ id, kind: 'note', prompt: step.title, question: step.title, answer: '', note: { title: step.title, body: step.body, examples, tip: step.tip } }];
    }
    case 'choose': return [choose(lv, item(step.ref), step.dir, rnd, id)];
    case 'context':
      return [{ id, kind: 'choose', prompt: 'Escolha a resposta certa', question: step.q, options: shuffle([...step.options], rnd), answer: step.answer,
        speak: step.speak, voice: 'M', explain: step.explain, srsKey: stepKey(lv.id, slot, i) }];
    case 'listen': return [listen(lv, item(step.ref), rnd, id)];
    case 'fill': {
      const it = item(step.ref);
      const q = it.en.replace(new RegExp(`\\b${escapeRx(step.blank)}\\b`), '___');
      return [{ id, kind: 'choose', prompt: 'Complete a frase', question: q, hint: it.pt, options: shuffle([...step.options], rnd), answer: step.blank,
        speak: it.en, voice: it.voice, explain: step.explain ?? `Frase completa: “${it.en}” — ${it.pt}`, srsKey: stepKey(lv.id, slot, i) }];
    }
    case 'bank': return [bank(lv, item(step.ref), step.dir, rnd, id)];
    case 'next': {
      const m = /^(d\d+)\.(\d+)$/.exec(step.ref)!;
      const dlg = lv.dialogues.find((d) => d.id === m[1])!;
      const k = Number(m[2]); const line = dlg.lines[k]; const prev = dlg.lines[k - 1];
      const pool = [...dlg.lines.filter((_, j) => j !== k && j !== k - 1).map((l) => l.en), ...linePool(lv).map((x) => x.en)];
      return [{ id, kind: 'choose', prompt: `Qual é a resposta de ${name(line.who)}?`, question: `${name(prev.who)}: “${prev.en}”`,
        options: shuffle([line.en, ...distinct(pool, [line.en, prev.en], 2, rnd)], rnd), answer: line.en, speak: line.en, voice: voiceOf(line.who),
        explain: `${name(line.who)} responde: “${line.en}” — ${line.pt}`, srsKey: itemKey(lv.id, step.ref) }];
    }
    case 'dictation': return [dictation(lv, item(step.ref), id)];
    case 'speak': return [speak(item(step.ref), id)];
    case 'write': return [write(lv, item(step.ref), step.hint, id)];
    case 'roleplay': return [roleplay(lv, id)];
    case 'questions': return lv.listening.questions.map((_, qi) => question(lv, qi, rnd, `${id}.${qi}`));
    case 'question': return [question(lv, step.index, rnd, id)];
    default: return []; // 'interleave' e 'review' dependem do histórico do aluno (ver buildLesson)
  }
}

/** Exercício de revisão a partir de uma chave do Caderno/FSRS ("L001:c3", "L001@2.5", "L001@q1"). */
export function exerciseForKey(key: string, rnd: () => number, id: string): Exercise | null {
  const m = /^(L\d{3})([:@])(.+)$/.exec(key);
  if (!m) return null;
  const lv = levelContent(m[1]);
  if (!lv) return null;
  if (m[2] === ':') {
    const it = itemOf(lv, m[3]);
    if (!it) return null;
    const r = rnd();
    if (it.kind === 'chunk') return r < 0.4 ? choose(lv, it, 'en-pt', rnd, id) : r < 0.7 ? choose(lv, it, 'pt-en', rnd, id) : listen(lv, it, rnd, id);
    const short = tokens(it.en).length <= 9;
    return r < 0.35 ? bank(lv, it, 'pt-en', rnd, id) : r < 0.55 ? listen(lv, it, rnd, id) : r < 0.8 || !short ? dictation(lv, it, id) : write(lv, it, 'first', id);
  }
  const q = /^q(\d+)$/.exec(m[3]);
  if (q) return lv.listening.questions[Number(q[1])] ? question(lv, Number(q[1]), rnd, id) : null;
  const st = /^(\d+)\.(\d+)$/.exec(m[3]);
  if (!st) return null;
  const step = lv.lessons[Number(st[1]) - 1]?.steps[Number(st[2])];
  if (!step) return null;
  const ex = buildStep(lv, Number(st[1]), Number(st[2]), step, rnd, id)[0];
  return ex ? { ...ex, id } : null;
}

const graded = (e: Exercise) => e.kind !== 'learn' && e.kind !== 'note' && e.kind !== 'speak' && e.kind !== 'roleplay';

/** Intercalação: mistura o nível atual com itens de níveis anteriores já iniciados. */
export function interleave(lv: LevelContent, p: Profile, count: number, rnd: () => number): Exercise[] {
  const n = levelNumber(lv.id);
  const prevLevels = AVAILABLE.filter((l) => l.n < n && lessonsDone(p, l.id) > 0).map((l) => levelContent(l.id)!).filter(Boolean);
  const prevKeys = prevLevels.flatMap((x) => allItems(x).map((it) => itemKey(x.id, it.ref)));
  const seenPrev = prevKeys.filter((k) => p.srs[k]);
  const nPrev = prevKeys.length ? Math.floor(count / 2) : 0;
  const fromPrev = pick(seenPrev.length >= nPrev ? seenPrev : prevKeys, nPrev, rnd);
  const cur = allItems(lv).map((it) => itemKey(lv.id, it.ref));
  const seenCur = cur.filter((k) => p.srs[k]);
  const fromCur = pick(seenCur.length >= count - fromPrev.length ? seenCur : cur, count - fromPrev.length, rnd);
  return shuffle([...fromPrev, ...fromCur], rnd).map((k, i) => exerciseForKey(k, rnd, `mix.${i}`)).filter(Boolean) as Exercise[];
}

/** Revisão Cirúrgica: itens com menor probabilidade de lembrança (FSRS) + palavras de pronúncia mais fraca. */
export function surgicalReview(lv: LevelContent, p: Profile, count: number, rnd: () => number): Exercise[] {
  const n = levelNumber(lv.id);
  const words = weakWords(p, 2);
  const keys = weakestKeys(p.srs, (k) => /^L\d{3}/.test(k) && Number(k.slice(1, 4)) <= n, count - words.length);
  const out = keys.map((k, i) => exerciseForKey(k, rnd, `rev.${i}`)).filter(Boolean) as Exercise[];
  if (out.length < count - words.length) {
    const extra = pick(allItems(lv).map((it) => itemKey(lv.id, it.ref)).filter((k) => !keys.includes(k)), count - words.length - out.length, rnd);
    extra.forEach((k, i) => { const e = exerciseForKey(k, rnd, `rev.x${i}`); if (e) out.push(e); });
  }
  words.forEach((w, i) => out.push(wordSpeak(w.w, `rev.w${i}`)));
  return shuffle(out, rnd);
}

/** Monta a lição (slot 1–10) de um nível. */
export function buildLesson(lv: LevelContent, slot: number, p: Profile, rnd: () => number): { spec: LessonSpec; exercises: Exercise[] } {
  const spec = lv.lessons[slot - 1];
  const exercises: Exercise[] = [];
  spec.steps.forEach((st, i) => {
    if (st.kind === 'interleave') exercises.push(...interleave(lv, p, st.count, rnd));
    else if (st.kind === 'review') exercises.push(...surgicalReview(lv, p, st.count, rnd));
    else exercises.push(...buildStep(lv, slot, i, st, rnd));
  });
  return { spec, exercises };
}

/** Treino de Revisão & Pronúncia: itens vencidos (FSRS) + palavras do Registro de Fonemas. Restaura 1 escudo. */
export function buildPractice(p: Profile, rnd: () => number, now = Date.now()): Exercise[] {
  const keys = dueKeys(p.srs, now, 8);
  const out = keys.map((k, i) => exerciseForKey(k, rnd, `prc.${i}`)).filter(Boolean) as Exercise[];
  weakWords(p, 3).forEach((w, i) => out.push(wordSpeak(w.w, `prc.w${i}`)));
  return shuffle(out, rnd);
}
/** Treino só de pronúncia (Caderno → Registro de Fonemas). */
export function buildPhonPractice(p: Profile): Exercise[] {
  return weakWords(p, 8).map((w, i) => wordSpeak(w.w, `phon.${i}`));
}

export const isGraded = graded;
export function checkAnswer(ex: Exercise, given: string): boolean {
  if (ex.kind === 'dictation') return dictationOk(ex.answer, given);
  if (ex.kind === 'write') return writeOk(ex.accept ?? [ex.answer], given);
  return norm(given) === norm(ex.answer);
}
export { pronTips };
