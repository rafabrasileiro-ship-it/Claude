import { pronTips, type PronTip } from './content';
import type { PhonEntry, Profile } from '../types';

export const cleanWord = (w: string) => w.replace(/[.,!?;:"“”()]/g, '');
const base = (w: string) => cleanWord(w).toLowerCase().replace(/[’‘]/g, "'");

// Contrações e números que o reconhecedor de voz costuma devolver de outro jeito.
const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is', "it's": 'it is',
  "that's": 'that is', "what's": 'what is', "there's": 'there is', "let's": 'let us', "i'll": 'i will', "you'll": 'you will', "we'll": 'we will',
  "won't": 'will not', "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'cannot', "isn't": 'is not', "aren't": 'are not',
  "wasn't": 'was not', "i've": 'i have', "we've": 'we have', "haven't": 'have not', "i'd": 'i would', "wouldn't": 'would not', "shouldn't": 'should not',
};
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** Normaliza o que foi ouvido/digitado: minúsculas, contrações por extenso, números por extenso. */
export function expand(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").split(/\s+/).filter(Boolean).map((w) => {
    const b = w.replace(/[.,!?;:"“”()]/g, '');
    if (CONTRACTIONS[b]) return CONTRACTIONS[b];
    if (/^\d+$/.test(b) && Number(b) <= 20) return NUMBERS[Number(b)];
    return w;
  }).join(' ');
}

/** Micro-dica de pronúncia para brasileiros, ligada à palavra que o aluno errou. */
export function tipFor(word: string): PronTip {
  const w = base(word);
  const exact = pronTips.find((t) => t.words.some((x) => x.toLowerCase() === w));
  if (exact) return exact;
  const rx = pronTips.find((t) => { if (t.id === 'generic') return false; try { return new RegExp(t.rx, 'i').test(w); } catch { return false; } });
  return rx ?? tipById('generic') ?? pronTips[0];
}
export const tipById = (id: string) => pronTips.find((t) => t.id === id);

export type WordStatus = 'good' | 'near' | 'bad';
export interface ScoredWord { word: string; status: WordStatus; heard?: string }

function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const sim = (a: string, b: string) => (a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length, 1));

/**
 * Compara o texto esperado com o que o reconhecedor ouviu, palavra por palavra (alinhamento por programação dinâmica).
 * good = palavra reconhecida igual (e com confiança razoável); near = parecida/hesitante; bad = omitida ou trocada.
 * Observação: o Android só informa a confiança da frase inteira, não de cada palavra.
 */
export function scoreWords(expected: string, heard: string, confidence = -1): { words: ScoredWord[]; accuracy: number } {
  const exp = expected.split(/\s+/).filter(Boolean);
  const hy = expand(heard).split(/\s+/).filter(Boolean).map(base);
  const e = exp.map(base);
  const m = e.length, n = hy.length;
  const cost = (i: number, j: number) => 1 - sim(e[i], hy[j]);
  const D = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) D[i][0] = i;
  for (let j = 1; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost(i - 1, j - 1));
  const words: ScoredWord[] = new Array(m);
  let i = m, j = n;
  while (i > 0) {
    if (j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + cost(i - 1, j - 1))) < 1e-9) {
      const s = sim(e[i - 1], hy[j - 1]);
      const shaky = confidence >= 0 && confidence < 0.6;
      words[i - 1] = { word: exp[i - 1], heard: hy[j - 1], status: s === 1 ? (shaky ? 'near' : 'good') : s >= 0.6 ? 'near' : 'bad' };
      i--; j--;
    } else if (Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9 || j === 0) {
      words[i - 1] = { word: exp[i - 1], status: 'bad' }; i--;
    } else j--;
  }
  const pts = words.reduce((a, w) => a + (w.status === 'good' ? 1 : w.status === 'near' ? 0.5 : 0), 0);
  return { words, accuracy: m ? pts / m : 0 };
}

/** F1 de palavras entre a resposta falada e a melhor resposta aceita (roleplay). */
export function bestMatch(heard: string, accept: string[]) {
  const h = expand(heard).split(/\s+/).filter(Boolean).map(base);
  let best = { f1: 0, model: accept[0] };
  for (const a of accept) {
    const t = a.split(/\s+/).filter(Boolean).map(base);
    const pool = [...t]; let hit = 0;
    for (const w of h) { const k = pool.indexOf(w); if (k >= 0) { hit++; pool.splice(k, 1); } }
    const p = h.length ? hit / h.length : 0, r = t.length ? hit / t.length : 0;
    const f1 = p + r ? (2 * p * r) / (p + r) : 0;
    if (f1 > best.f1) best = { f1, model: a };
  }
  return best;
}

/** Ditado: aceita diferença de 1 letra em frases longas (erro de digitação). */
export function dictationOk(answer: string, given: string) {
  const a = answer.toLowerCase().replace(/[.,!?;:"“”]/g, '').replace(/\s+/g, ' ').trim();
  const g = given.toLowerCase().replace(/[.,!?;:"“”]/g, '').replace(/\s+/g, ' ').trim();
  return a === g || (a.length >= 12 && lev(a, g) <= 1);
}

// ─────────────── Escrita / tradução livre ───────────────
const flat = (t: string) => expand(t).replace(/[^a-z0-9' ]/g, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
/** Tradução escrita: aceita qualquer resposta da lista, contrações, maiúsculas e 1 erro de digitação em frases longas. */
export function writeOk(accept: string[], given: string) {
  const g = flat(given);
  return accept.some((a) => { const t = flat(a); return t === g || (t.length >= 10 && lev(t, g) <= 1); });
}
/** Dica com as primeiras letras: "Hello, I am Alice." → "H____, I a_ A____." */
export function firstLetters(en: string) {
  return en.split(/\s+/).map((w) => w.replace(/[A-Za-z']+/, (m) => (m.length <= 1 ? m : m[0] + '_'.repeat(m.length - 1)))).join(' ');
}

// ─────────────── Registro de Fonemas (histórico por palavra) ───────────────
export const phonKey = (w: string) => base(w);
export function recordPhon(p: Profile, words: ScoredWord[], now = Date.now()): Profile {
  const phon = { ...p.phon };
  for (const x of words) {
    const w = cleanWord(x.word); const k = phonKey(w);
    if (!k) continue;
    const e: PhonEntry = phon[k] ?? { w, g: 0, n: 0, b: 0, last: x.status, at: now };
    phon[k] = { ...e, g: e.g + (x.status === 'good' ? 1 : 0), n: e.n + (x.status === 'near' ? 1 : 0), b: e.b + (x.status === 'bad' ? 1 : 0), last: x.status, at: now };
  }
  return { ...p, phon };
}
/** Palavras que mais precisam de treino (pronúncia fraca ou última tentativa ruim). */
export function weakWords(p: Profile, limit = 8): PhonEntry[] {
  const score = (e: PhonEntry) => (e.b + e.n * 0.5) / (e.g + e.n + e.b + 1) + (e.last === 'bad' ? 0.5 : e.last === 'near' ? 0.25 : 0);
  return Object.values(p.phon ?? {}).filter((e) => e.last !== 'good' || score(e) >= 0.3).sort((a, b) => score(b) - score(a)).slice(0, limit);
}
