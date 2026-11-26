// Valida o seed contra o handoff: elenco, famílias, estrutura do Módulo 1 e integridade dos diálogos.
const fs = require('fs');
const path = require('path');
const d = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data', f), 'utf8'));
const { families, mascot } = d('characters.json');
const { units, levels } = d('units.json');
const listening = d('listening.json');
const chronicles = d('chronicles.json');
const tips = d('pronunciation.json');
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

if (units.filter((u) => u.level === 1).length !== 6) err('Nível 1 deve ter 6 unidades');
if (JSON.stringify((levels || []).map((l) => l.cefr)) !== JSON.stringify(['A1', 'A2', 'B1', 'B2', 'C1'])) err('devem existir os 5 níveis CEFR A1–C1');
for (let lv = 2; lv <= 5; lv++) if (!units.some((u) => u.level === lv)) err(`nível ${lv} sem unidades de amostra`);
const castExpect = {
  u1: ['ayrton', 'alice'], u2: ['maria', 'gabriel', 'davi', 'liz'], u3: ['jose', 'flavia'],
  u4: ['lucas', 'ayrton'], u5: ['beto', 'clara', 'gael', 'laura'],
  u6: ['miguel', 'heloisa', 'gael', 'laura', 'arthur', 'cecilia', 'theo', 'maite', 'davi', 'liz', 'noah', 'antonella'],
  u7: ['ayrton', 'miguel', 'jose', 'arthur'], u8: ['jose', 'flavia', 'beto', 'gael'], u9: ['alice', 'lucas', 'flavia', 'rafael'], u10: ['beto', 'alice', 'jose', 'ayrton'],
};
const lessonIds = new Set();
for (const u of units) {
  if (u.lessons.length !== (u.level === 1 ? 4 : 2)) err(`${u.id}: nº de lições inesperado`);
  if (!u.level) err(`${u.id}: sem nível`);
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
// Crônicas (4 pontos de parada), Estações de Escuta (3 perguntas + roleplay) e dicas de pronúncia
const unitIds = new Set(units.map((u) => u.id));
if (chronicles.length !== 4) err('esperadas 4 crônicas');
const chronCast = { c1: ['ayrton', 'miguel'], c2: ['maria', 'gabriel', 'davi', 'liz'], c3: ['jose', 'arthur', 'cecilia'], c4: ['beto', 'gael', 'laura'] };
for (const c of chronicles) {
  if (JSON.stringify(c.cast) !== JSON.stringify(chronCast[c.id])) err(`${c.id}: elenco da crônica diverge do handoff`);
  if (!unitIds.has(c.unlockAfterUnit)) err(`${c.id}: unidade de desbloqueio inválida`);
  if (c.segments.length !== 4) err(`${c.id}: 4 pontos de parada esperados`);
  c.segments.forEach((sg, i) => {
    sg.lines.forEach((x) => { if (!ids.has(x.who)) err(`${c.id}#${i}: falante desconhecido ${x.who}`); else if (!c.cast.includes(x.who)) err(`${c.id}#${i}: ${x.who} fora do elenco`); });
    if (!sg.stop.options.includes(sg.stop.answer)) err(`${c.id}#${i}: resposta fora das opções`);
    if (!sg.stop.why) err(`${c.id}#${i}: sem explicação`);
  });
}
if (listening.length !== units.length) err('cada unidade precisa de uma Estação de Escuta');
for (const st of listening) {
  if (!unitIds.has(st.unitId)) err(`estação ${st.unitId}: unidade inexistente`);
  if (st.questions.length !== 3) err(`estação ${st.unitId}: 3 perguntas esperadas`);
  st.questions.forEach((q) => { if (!q.options.includes(q.answer)) err(`estação ${st.unitId}: resposta fora das opções`); });
  st.lines.forEach((x) => { if (!ids.has(x.who)) err(`estação ${st.unitId}: falante desconhecido ${x.who}`); });
  if (!ids.has(st.roleplay.who) || !st.roleplay.accept.includes(st.roleplay.model)) err(`estação ${st.unitId}: roleplay inválido`);
}
if (tips.length < 12) err('banco de dicas de pronúncia pequeno');
tips.forEach((t) => { if (!t.tip || !t.words.length) err(`dica ${t.id} incompleta`); });
if (wisdom.length < 10) err('banco de sabedoria pequeno');
wisdom.forEach((w) => { if (!w.en || !w.pt || !w.source) err(`sabedoria ${w.id} incompleta`); });
reading.forEach((r) => { if (!r.words.length || r.words.some((w) => w.length !== 2)) err(`leitura ${r.id} inválida`); });

// Inglês padrão dos EUA: sem grafias/vocabulário britânicos e sem inglês arcaico (exceto texto histórico marcado).
const BRIT = /\b(honour|neighbour|favour|colour|labour|harbour|behaviour|centre|theatre|defence|licence|grey|programme|whilst|lorry|autumn|holiday|flat|mum|biscuit|petrol|organis\w*|realis\w*|recognis\w*)\b/i;
const ARCH = /\b(thy|thou|thee|thine|doth|hath|\w+eth)\b/i;
const ARCH_OK = new Set(['r3']);
const checkUS = (where, t) => { if (BRIT.test(t)) err(`${where}: grafia/vocabulário britânico em "${t}"`); if (ARCH.test(t)) err(`${where}: inglês arcaico em "${t}"`); };
if (d('units.json').course.dialect !== 'en-US') err('curso deve declarar dialect en-US');
for (const u of units) for (const l of u.lessons) { l.vocab.forEach((v) => checkUS(l.id, v.en)); l.dialogue.forEach((x) => checkUS(l.id, x.en)); }
wisdom.forEach((w) => checkUS(w.id, w.en));
for (const st of listening) { st.lines.forEach((x) => checkUS(`estação ${st.unitId}`, x.en)); st.questions.forEach((q) => q.options.forEach((o) => checkUS(`estação ${st.unitId}`, o))); checkUS(`roleplay ${st.unitId}`, st.roleplay.model); }
for (const c of chronicles) c.segments.forEach((sg) => { sg.lines.forEach((x) => checkUS(c.id, x.en)); sg.stop.options.forEach((o) => checkUS(c.id, o)); });
reading.forEach((r) => { if (!ARCH_OK.has(r.id)) r.words.forEach((x) => checkUS(r.id, x[0])); });

// Cobertura de áudio: todo texto em inglês falado pelo app precisa ter clipe pré-gravado.
const manifest = fs.readFileSync(path.join(__dirname, '../src/audio/manifest.ts'), 'utf8');
const have = new Set([...manifest.matchAll(/^  ("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])));
const sexOf = {}; families.forEach((f) => { sexOf[f.id] = f.sex; sexOf[f.spouse.id] = f.spouse.sex; f.children.forEach((c) => (sexOf[c.id] = c.sex)); });
const need = (k) => { if (!have.has(k)) err(`áudio ausente: ${k}`); };
for (const u of units) for (const l of u.lessons) {
  l.vocab.forEach((v) => { need(`M|n|${v.en}`); need(`M|s|${v.en}`); });
  l.dialogue.forEach((x) => { const v = sexOf[x.who] || 'M'; need(`${v}|n|${x.en}`); need(`${v}|s|${x.en}`); });
}
const sexF = (w) => sexOf[w] || 'M';
for (const st of listening) {
  st.lines.forEach((x) => { need(`${sexF(x.who)}|n|${x.en}`); need(`${sexF(x.who)}|s|${x.en}`); });
  need(`${sexF(st.roleplay.who)}|n|${st.roleplay.ask}`);
  st.roleplay.accept.forEach((a) => a.split(/\s+/).forEach((t) => need(`M|n|${t.replace(/[.,!?;:"“”()]/g, '')}`)));
}
for (const c of chronicles) c.segments.forEach((sg) => sg.lines.forEach((x) => { need(`${sexF(x.who)}|n|${x.en}`); need(`${sexF(x.who)}|s|${x.en}`); }));
for (const u of units) for (const l of u.lessons) l.dialogue[l.dialogue.length - 1].en.split(/\s+/).forEach((t) => need(`M|n|${t.replace(/[.,!?;:"“”()]/g, '')}`));
wisdom.forEach((w) => { need(`M|n|${w.en}`); need(`M|s|${w.en}`); });
reading.forEach((r) => { need(`M|n|${r.words.map((w) => w[0]).join(' ')}`); need(`M|s|${r.words.map((w) => w[0]).join(' ')}`); r.words.forEach((w) => need(`M|n|${w[0]}`)); });

if (errs.length) { console.error('✖ Falhas:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log(`✔ Conteúdo válido: ${levels.length} níveis (A1–C1), ${units.length} unidades, ${chronicles.length} crônicas, ${listening.length} estações, ${lessonIds.size} lições, ${wisdom.length} citações, ${reading.length} leituras, ${ids.size} personagens.`);
