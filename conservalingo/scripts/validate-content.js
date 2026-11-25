// Valida o seed contra o handoff: elenco, famílias, estrutura do Módulo 1 e integridade dos diálogos.
const fs = require('fs');
const path = require('path');
const d = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data', f), 'utf8'));
const { families, mascot } = d('characters.json');
const { units } = d('units.json');
const wisdom = d('wisdom.json');
const reading = d('reading.json');
const errs = [];
const err = (m) => errs.push(m);

const EXPECT = {
  ayrton: ['Helena', ['Miguel', 8], ['Heloísa', 4]], beto: ['Clara', ['Gael', 7], ['Laura', 3]],
  jose: ['Beatriz', ['Arthur', 9], ['Cecília', 5]], alice: ['Lucas', ['Theo', 6], ['Maitê', 2]],
  maria: ['Gabriel', ['Davi', 8], ['Liz', 4]], flavia: ['Rafael', ['Noah', 7], ['Antonella', 3]],
};
if (mascot.name !== 'Tio Bento') err('mascote deve ser Tio Bento');
if (families.length !== 6) err('esperados 6 protagonistas');
const ids = new Set(); const parentOf = {};
for (const f of families) {
  const e = EXPECT[f.id];
  if (!e) { err(`protagonista inesperado ${f.id}`); continue; }
  if (f.spouse.name !== e[0]) err(`${f.id}: cônjuge deveria ser ${e[0]}`);
  if (f.spouse.sex === f.sex) err(`${f.id}: cônjuge deve ser do sexo oposto`);
  if (f.children.length !== 2) err(`${f.id}: 2 filhos esperados`);
  f.children.forEach((c, i) => { if (c.name !== e[i + 1][0] || c.age !== e[i + 1][1]) err(`${f.id}: filho ${i} divergente`); });
  [f.id, f.spouse.id, ...f.children.map((c) => c.id)].forEach((i) => { if (ids.has(i)) err(`id duplicado ${i}`); ids.add(i); parentOf[i] = f.id; });
}
const spouses = families.map((f) => f.spouse.name);
if (new Set(spouses).size !== 6) err('cônjuges repetidos');

if (units.length !== 6) err('Módulo 1 deve ter 6 unidades');
const castExpect = {
  u1: ['ayrton', 'alice'], u2: ['maria', 'gabriel', 'davi', 'liz'], u3: ['jose', 'flavia'],
  u4: ['lucas', 'ayrton'], u5: ['beto', 'clara', 'gael', 'laura'],
  u6: ['miguel', 'heloisa', 'gael', 'laura', 'arthur', 'cecilia', 'theo', 'maite', 'davi', 'liz', 'noah', 'antonella'],
};
const lessonIds = new Set();
for (const u of units) {
  if (u.lessons.length !== 4) err(`${u.id}: 4 lições esperadas`);
  if (JSON.stringify(u.cast) !== JSON.stringify(castExpect[u.id])) err(`${u.id}: elenco diverge do handoff`);
  u.cast.forEach((c) => { if (!ids.has(c)) err(`${u.id}: personagem desconhecido ${c}`); });
  const allowed = new Set(u.cast);
  if (u.id === 'u6') u.cast.forEach((c) => allowed.add(parentOf[c]));
  for (const l of u.lessons) {
    if (lessonIds.has(l.id)) err(`lição duplicada ${l.id}`); lessonIds.add(l.id);
    if (l.vocab.length < 4) err(`${l.id}: vocabulário curto`);
    if (l.dialogue.length < 3) err(`${l.id}: diálogo curto`);
    const seen = new Set();
    l.vocab.forEach((v) => { if (!v.en || !v.pt) err(`${l.id}: vocab vazio`); if (seen.has(v.en)) err(`${l.id}: vocab duplicado ${v.en}`); seen.add(v.en); });
    l.dialogue.forEach((x, i) => {
      if (!ids.has(x.who)) err(`${l.id}#${i}: falante desconhecido ${x.who}`);
      else if (!allowed.has(x.who)) err(`${l.id}#${i}: ${x.who} fora do elenco da unidade`);
      if (!x.en || !x.pt) err(`${l.id}#${i}: texto vazio`);
    });
  }
}
if (wisdom.length < 10) err('banco de sabedoria pequeno');
wisdom.forEach((w) => { if (!w.en || !w.pt || !w.source) err(`sabedoria ${w.id} incompleta`); });
reading.forEach((r) => { if (!r.words.length || r.words.some((w) => w.length !== 2)) err(`leitura ${r.id} inválida`); });

if (errs.length) { console.error('✖ Falhas:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log(`✔ Conteúdo válido: ${units.length} unidades, ${lessonIds.size} lições, ${wisdom.length} citações, ${reading.length} leituras, ${ids.size} personagens.`);
