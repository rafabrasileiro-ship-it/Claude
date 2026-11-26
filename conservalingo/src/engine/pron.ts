import { pronTips, type PronTip } from './content';

export const cleanWord = (w: string) => w.replace(/[.,!?;:"“”()]/g, '');
const base = (w: string) => cleanWord(w).toLowerCase();

/** Micro-dica de pronúncia para brasileiros, ligada à palavra que o aluno errou. */
export function tipFor(word: string): PronTip {
  const w = base(word);
  const exact = pronTips.find((t) => t.words.some((x) => x.toLowerCase() === w));
  if (exact) return exact;
  const rx = pronTips.find((t) => { try { return new RegExp(t.rx, 'i').test(w); } catch { return false; } });
  return rx ?? pronTips[0];
}

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
  const hy = heard.split(/\s+/).filter(Boolean).map(base);
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
  const h = heard.split(/\s+/).filter(Boolean).map(base);
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
