/**
 * Valida o seed contra o Handoff v4: elenco e famílias, 5 Eras × 26 níveis, cadência das 10 lições,
 * referências de cada passo, inglês americano e cobertura de áudio.  Uso: npx tsx scripts/validate-content.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import characters from '../src/data/characters.json';
import { curriculum, levelContent, people, pronTips, readings, wisdom } from '../src/engine/content';
import { AVAILABLE, LEVELS, allowedSpeakers, itemOf } from '../src/engine/levels';
import { buildLesson } from '../src/engine/exercises';
import { newProfile } from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import { audioJobs } from './audio-jobs';
import type { LevelContent, Step } from '../src/types';

const errs: string[] = [];
const err = (m: string) => errs.push(m);
const { families, mascot } = characters;

// ── Bíblia de personagens ──
const EXPECT: Record<string, [string, [string, number], [string, number]]> = {
  ayrton: ['Helena', ['Miguel', 8], ['Heloísa', 4]], beto: ['Clara', ['Gael', 7], ['Laura', 3]],
  jose: ['Beatriz', ['Arthur', 9], ['Cecília', 5]], alice: ['Lucas', ['Theo', 6], ['Maitê', 2]],
  maria: ['Gabriel', ['Davi', 8], ['Liz', 4]], flavia: ['Rafael', ['Noah', 7], ['Antonella', 3]],
};
const PROF: Record<string, string> = { ayrton: 'Engenheiro Civil', helena: 'Professora de piano clássico', beto: 'Historiador e Professor', clara: 'Médica pediatra',
  jose: 'Fundador e CEO de empresa familiar', beatriz: 'Arquiteta', alice: 'Advogada e líder comunitária', lucas: 'Oficial militar',
  maria: 'Escritora e colunista de culinária', gabriel: 'Chef de cozinha', flavia: 'Gestora de agronegócio e tecnologia', rafael: 'Engenheiro agrônomo' };
if (mascot.name !== 'Tio Bento') err('mascote deve ser Tio Bento');
if (families.length !== 6) err('esperados 6 protagonistas');
for (const f of families) {
  const e = EXPECT[f.id];
  if (!e) { err(`protagonista inesperado ${f.id}`); continue; }
  if (f.spouse.name !== e[0]) err(`${f.id}: cônjuge deveria ser ${e[0]}`);
  if (f.spouse.sex === f.sex) err(`${f.id}: cônjuge deve ser do sexo oposto`);
  f.children.forEach((c, i) => { if (c.name !== e[i + 1][0] || c.age !== e[i + 1][1]) err(`${f.id}: filho ${i} divergente`); });
  if (f.profession !== PROF[f.id]) err(`${f.id}: profissão diverge do handoff`);
  if (f.spouse.profession !== PROF[f.spouse.id]) err(`${f.spouse.id}: profissão diverge do handoff`);
}
if (new Set(families.map((f) => f.spouse.name)).size !== 6) err('cônjuges repetidos');

// ── Estrutura: 5 Eras × 26 níveis × 10 lições ──
const KIDS = ['miguel', 'heloisa', 'gael', 'laura', 'arthur', 'cecilia', 'theo', 'maite', 'davi', 'liz', 'noah', 'antonella'];
const BLOCKS: [number, number, string[]][] = [
  [1, 5, ['ayrton', 'helena', 'alice', 'lucas']], [6, 10, ['maria', 'gabriel', 'davi', 'liz']], [11, 15, ['jose', 'beatriz', 'flavia', 'rafael']],
  [16, 20, ['lucas', 'ayrton', 'beto', 'clara']], [21, 26, KIDS], [27, 32, ['beto', 'clara', 'gael', 'laura']], [33, 38, ['ayrton', 'helena', 'miguel', 'heloisa']],
  [39, 44, ['jose', 'beatriz', 'arthur', 'cecilia']], [45, 52, ['maria', 'gabriel', 'alice', 'lucas']], [53, 59, ['jose', 'beatriz', 'flavia']],
  [60, 66, ['beto', 'clara']], [67, 72, ['alice', 'lucas']], [73, 78, ['flavia', 'rafael']], [79, 85, ['alice', 'lucas']], [86, 92, ['ayrton', 'helena']],
  [93, 98, ['jose', 'beatriz', 'flavia', 'rafael']], [99, 104, ['beto', 'clara', 'maria', 'gabriel']], [105, 111, ['beto', 'clara']],
  [112, 118, ['alice', 'ayrton', 'jose']], [119, 125, ['jose', 'beatriz', 'flavia', 'rafael']], [126, 130, []],
];
const TYPES = ['fundamento', 'construcao', 'escuta', 'dialogo', 'fala', 'escrita', 'intercalacao', 'cronica', 'revisao', 'checkpoint'];
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'];
if (curriculum.eras.length !== 5) err('esperadas 5 Eras');
curriculum.eras.forEach((e, i) => {
  if (e.cefr !== CEFR[i] || e.from !== i * 26 + 1 || e.to !== (i + 1) * 26) err(`Era ${e.era}: faixa/CEFR incorretos`);
});
if (LEVELS.length !== 130) err('esperados 130 níveis');
LEVELS.forEach((l, i) => {
  if (l.n !== i + 1 || l.id !== `L${String(i + 1).padStart(3, '0')}`) err(`nível ${i + 1}: numeração/id`);
  if (l.cefr !== CEFR[l.era - 1] || l.era !== Math.floor(i / 26) + 1) err(`${l.id}: Era/CEFR`);
  if (!l.title) err(`${l.id}: sem título`);
});
if (JSON.stringify(curriculum.slots.map((s) => s.type)) !== JSON.stringify(TYPES)) err('cadência das 10 lições diverge do handoff');
if (curriculum.blocks.length !== BLOCKS.length) err('blocos de níveis divergem do handoff');
BLOCKS.forEach(([from, to, cast], i) => {
  const b = curriculum.blocks[i];
  if (!b || b.from !== from || b.to !== to) err(`bloco ${from}–${to}: faixa`);
  else if (cast.length && JSON.stringify(b.cast) !== JSON.stringify(cast)) err(`bloco ${from}–${to}: elenco diverge do handoff`);
  LEVELS.filter((l) => l.n >= from && l.n <= to).forEach((l) => { if (l.block !== i) err(`${l.id}: bloco errado`); });
});
if (LEVELS[0].status !== 'available' || !levelContent('L001')) err('o Nível 01 precisa estar completo');

// ── Conteúdo de cada nível disponível ──
const BRIT = /\b(honour|neighbour|favour|colour|labour|harbour|behaviour|centre|theatre|defence|licence|grey|programme|whilst|lorry|autumn|holiday|flat|mum|biscuit|petrol|organis\w*|realis\w*|recognis\w*)\b/i;
const ARCH = /\b(thy|thou|thee|thine|doth|hath|\w+eth)\b/i;
const checkUS = (where: string, t: string) => { if (BRIT.test(t)) err(`${where}: grafia britânica em "${t}"`); if (ARCH.test(t)) err(`${where}: inglês arcaico em "${t}"`); };
const tipIds = new Set(pronTips.map((t) => t.id));
const SKILL = { escuta: ['listen', 'dictation', 'questions', 'question'], fala: ['speak', 'roleplay'], gramatica: ['fill', 'bank', 'choose', 'context', 'next'], traducao: ['write', 'bank'] };

for (const def of LEVELS.filter((l) => l.status === 'available')) {
  const lv = levelContent(def.id) as LevelContent;
  const at = (m: string) => err(`${def.id}: ${m}`);
  if (!lv) { at('sem arquivo de conteúdo'); continue; }
  if (lv.id !== def.id || lv.number !== def.n) at('id/número não conferem com o currículo');
  if (lv.title !== def.title) at(`título difere do currículo ("${lv.title}" × "${def.title}")`);
  const allowed = allowedSpeakers(def);
  const speaker = (who: string, where: string) => { if (!people[who]) at(`${where}: personagem desconhecido ${who}`); else if (!allowed.has(who)) at(`${where}: ${who} fora do elenco do bloco ${curriculum.blocks[def.block].label}`); };
  const ids = new Set<string>();
  lv.chunks.forEach((c) => { if (!/^c\d+$/.test(c.id) || ids.has(c.id)) at(`bloco ${c.id} inválido/duplicado`); ids.add(c.id); if (!c.en || !c.pt) at(`${c.id} vazio`); checkUS(def.id, c.en); });
  lv.sentences.forEach((s) => { if (!/^s\d+$/.test(s.id) || ids.has(s.id)) at(`frase ${s.id} inválida/duplicada`); ids.add(s.id); speaker(s.who, s.id); checkUS(def.id, s.en); (s.alt ?? []).forEach((a) => checkUS(def.id, a)); });
  lv.dialogues.forEach((d) => { if (!/^d\d+$/.test(d.id)) at(`diálogo ${d.id} inválido`); d.lines.forEach((ln, i) => { speaker(ln.who, `${d.id}.${i}`); checkUS(def.id, ln.en); }); (d.vocab ?? []).forEach((r) => { if (!lv.chunks.some((c) => c.id === r)) at(`${d.id}: vocab ${r} inexistente`); }); });
  if (lv.listening.lines.length < 4) at('escuta curta');
  lv.listening.lines.forEach((ln, i) => { speaker(ln.who, `l.${i}`); checkUS(def.id, ln.en); });
  if (lv.listening.questions.length !== 3) at('a escuta precisa de 3 perguntas');
  lv.listening.questions.forEach((q, i) => { if (!q.options.includes(q.answer)) at(`pergunta ${i}: resposta fora das opções`); if (q.lang !== 'pt') q.options.forEach((o) => checkUS(def.id, o)); });
  const c = lv.chronicle;
  if (c.segments.length !== 4) at('a crônica precisa de 4 pontos de parada');
  c.cast.forEach((w) => speaker(w, 'crônica'));
  c.segments.forEach((sg, i) => {
    sg.lines.forEach((ln) => { speaker(ln.who, `crônica ${i}`); checkUS(def.id, ln.en); });
    if (!['deduce', 'moral', 'complete'].includes(sg.stop.kind)) at(`crônica ${i}: tipo de parada inválido`);
    if (!sg.stop.options.includes(sg.stop.answer) || !sg.stop.why) at(`crônica ${i}: parada inválida`);
    if (sg.stop.lang !== 'pt') sg.stop.options.forEach((o) => checkUS(def.id, o));
  });
  speaker(lv.roleplay.who, 'roleplay');
  if (!lv.roleplay.accept.includes(lv.roleplay.model)) at('roleplay: modelo fora das respostas aceitas');
  lv.roleplay.accept.forEach((a) => checkUS(def.id, a));
  if (!wisdom.some((w) => w.id === lv.wisdom)) at(`sabedoria ${lv.wisdom} inexistente`);
  lv.tips.forEach((t) => { if (!tipIds.has(t)) at(`dica ${t} inexistente`); });
  if (!lv.pnl.identity || !lv.pnl.presupposition || lv.pnl.futurePacing.length < 3) at('microcopy de PNL incompleto');

  if (lv.lessons.length !== 10) at('são 10 lições por nível');
  const usedChunks = new Set<string>(lv.dialogues.flatMap((d) => d.vocab ?? []));
  lv.lessons.forEach((les, i) => {
    const where = `lição ${i + 1}`;
    if (les.slot !== i + 1 || les.type !== TYPES[i]) at(`${where}: fora da cadência (${les.type})`);
    if (!les.title || !les.objective || !les.intro) at(`${where}: título/objetivo/intro`);
    if (les.type === 'dialogo' && !lv.dialogues.some((d) => d.id === les.dialogue)) at(`${where}: diálogo inexistente`);
    if (les.type === 'cronica' && les.steps.length) at(`${where}: a crônica não leva passos`);
    if (les.type === 'intercalacao' && !les.steps.some((s) => s.kind === 'interleave')) at(`${where}: sem intercalação`);
    if (les.type === 'revisao' && !les.steps.some((s) => s.kind === 'review')) at(`${where}: sem revisão FSRS`);
    les.steps.forEach((st: Step, k) => {
      const w = `${where}, passo ${k + 1}`;
      if ('ref' in st) {
        const it = itemOf(lv, st.ref);
        if (!it) { at(`${w}: referência ${st.ref} inexistente`); return; }
        if (it.kind === 'chunk') usedChunks.add(st.ref);
        if (st.kind === 'fill' && (!new RegExp(`\\b${st.blank}\\b`).test(it.en) || !st.options.includes(st.blank))) at(`${w}: lacuna inválida`);
        if (st.kind === 'next' && !/^d\d+\.[1-9]\d*$/.test(st.ref)) at(`${w}: "next" precisa de uma fala anterior`);
        if (st.kind === 'write' && it.en.split(/\s+/).length > 12) at(`${w}: frase longa demais para tradução livre`);
      }
      if (st.kind === 'context' && !st.options.includes(st.answer)) at(`${w}: resposta fora das opções`);
      if (st.kind === 'question' && !lv.listening.questions[st.index]) at(`${w}: pergunta inexistente`);
      if (st.kind === 'note') { (st.examples ?? []).forEach((r) => { if (!itemOf(lv, r)) at(`${w}: exemplo ${r} inexistente`); }); if (st.tip && !tipIds.has(st.tip)) at(`${w}: dica inexistente`); }
    });
    if (les.type === 'checkpoint') {
      const kinds = new Set(les.steps.map((s) => s.kind));
      Object.entries(SKILL).forEach(([skill, ks]) => { if (!ks.some((k) => kinds.has(k as Step['kind']))) at(`checkpoint sem ${skill}`); });
    }
    if (!['cronica', 'intercalacao', 'revisao'].includes(les.type)) {
      const n = buildLesson(lv, i + 1, newProfile('v', 'V', false, 'M'), mulberry32(7)).exercises.length;
      if (n < 3 || n > 12) at(`${where}: ${n} micro-exercícios (esperado 3–12)`);
    }
  });
  lv.chunks.forEach((ch) => { if (!usedChunks.has(ch.id)) at(`bloco ${ch.id} ("${ch.en}") não é usado em nenhuma lição`); });
}

// ── Sabedoria, leitura e áudio ──
if (wisdom.length < 10) err('banco de sabedoria pequeno');
wisdom.forEach((w) => { if (!w.en || !w.pt || !w.source) err(`sabedoria ${w.id} incompleta`); checkUS(w.id, w.en); });
const ARCH_OK = new Set(['r3']); // O Peregrino (1678) mantém o texto original
readings.forEach((r) => { if (!r.words.length || r.words.some((w) => w.length !== 2)) err(`leitura ${r.id} inválida`); if (!ARCH_OK.has(r.id)) r.words.forEach((x) => checkUS(r.id, x[0])); });
const manifest = readFileSync(join(__dirname, '../src/audio/manifest.ts'), 'utf8');
const have = new Set([...manifest.matchAll(/^ {2}("(?:[^"\\]|\\.)*"): require/gm)].map((m) => JSON.parse(m[1]) as string));
const missing = audioJobs().map((j) => j.join('|')).filter((k) => !have.has(k));
if (missing.length) err(`${missing.length} áudio(s) ausente(s), ex.: ${missing.slice(0, 3).join(' · ')} — rode scripts/generate-audio.py`);

if (errs.length) { console.error('✖ Falhas:\n - ' + errs.join('\n - ')); process.exit(1); }
const avail = AVAILABLE.length;
console.log(`✔ Conteúdo válido: 5 Eras, 130 níveis (${avail} com conteúdo, ${avail * 10} lições jogáveis), ${families.length * 4} personagens, ${wisdom.length} provérbios, ${readings.length} leituras.`);
