// Gera db/seed.sql a partir dos JSON de src/data (fonte única de verdade).
const fs = require('fs'); const path = require('path');
const d = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data', f), 'utf8'));
const { mascot, families } = d('characters.json'); const { course, units, levels } = d('units.json');
const listening = d('listening.json'); const chronicles = d('chronicles.json'); const tips = d('pronunciation.json');
const wisdom = d('wisdom.json'); const reading = d('reading.json');
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Gerado por scripts/build-seed-sql.js — não editar à mão.', 'begin;'];
const ins = (t, cols, rows) => rows.length && out.push(`insert into ${t} (${cols.join(',')}) values\n${rows.map((r) => '  (' + r.join(',') + ')').join(',\n')};`);

const chars = [[q(mascot.id), q(mascot.name), q('mascot'), 'null', 'null', q(mascot.species), q(mascot.description), 'null', 'null', 'null', 'null']];
for (const f of families) {
  chars.push([q(f.id), q(f.name), q('protagonist'), q(f.sex), 'null', q(f.profession), q(f.archetype), q(f.focus), q(f.id), 'null', 'null']);
  chars.push([q(f.spouse.id), q(f.spouse.name), q('spouse'), q(f.spouse.sex), 'null', q(f.spouse.profession), 'null', 'null', q(f.id), 'null', 'null']);
  for (const c of f.children) chars.push([q(c.id), q(c.name), q('child'), q(c.sex), c.age, 'null', 'null', 'null', q(f.id), 'null', q(f.id)]);
}
ins('characters', ['id', 'name', 'role', 'sex', 'age', 'profession', 'archetype', 'pedagogical_focus', 'family_head_id', 'spouse_id', 'parent_id'], chars);
// cônjuges (referência cruzada após inserir todos)
for (const f of families) out.push(`update characters set spouse_id=${q(f.spouse.id)} where id=${q(f.id)};`, `update characters set spouse_id=${q(f.id)} where id=${q(f.spouse.id)};`);
out.push(`insert into courses (id,title,module,dialect) values (${q(course.id)},${q(course.title)},${course.module},${q(course.dialect)});`);
ins('levels', ['level', 'cefr', 'title', 'tag'], levels.map((l) => [l.level, q(l.cefr), q(l.title), q(l.tag)]));
ins('units', ['id', 'course_id', 'level', 'position', 'title', 'icon', 'topics'], units.map((u, i) => [q(u.id), q(course.id), u.level, i + 1, q(u.title), q(u.icon), q(u.topics)]));
ins('unit_cast', ['unit_id', 'character_id'], units.flatMap((u) => u.cast.map((c) => [q(u.id), q(c)])));
ins('lessons', ['id', 'unit_id', 'position', 'title'], units.flatMap((u) => u.lessons.map((l, i) => [q(l.id), q(u.id), i + 1, q(l.title)])));
ins('vocab_items', ['id', 'lesson_id', 'position', 'en', 'pt'], units.flatMap((u) => u.lessons.flatMap((l) => l.vocab.map((v, i) => [q(`${l.id}:v:${v.en}`), q(l.id), i + 1, q(v.en), q(v.pt)]))));
ins('dialogue_lines', ['id', 'lesson_id', 'position', 'character_id', 'en', 'pt'], units.flatMap((u) => u.lessons.flatMap((l) => l.dialogue.map((x, i) => [q(`${l.id}:d:${i}`), q(l.id), i + 1, q(x.who), q(x.en), q(x.pt)]))));
const j = (v) => q(JSON.stringify(v)) + '::jsonb';
ins('chronicles', ['id', 'title', 'icon', 'intro', 'unlock_after_unit'], chronicles.map((c) => [q(c.id), q(c.title), q(c.icon), q(c.intro), q(c.unlockAfterUnit)]));
ins('chronicle_cast', ['chronicle_id', 'character_id'], chronicles.flatMap((c) => c.cast.map((x) => [q(c.id), q(x)])));
ins('chronicle_segments', ['id', 'chronicle_id', 'position', 'lines', 'stop_kind', 'stop_question', 'stop_options', 'stop_answer', 'stop_why'],
  chronicles.flatMap((c) => c.segments.map((sg, i) => [q(`${c.id}:${i + 1}`), q(c.id), i + 1, j(sg.lines), q(sg.stop.kind), q(sg.stop.q), j(sg.stop.options), q(sg.stop.answer), q(sg.stop.why)])));
ins('listening_stations', ['unit_id', 'title', 'lines', 'questions', 'roleplay'], listening.map((l) => [q(l.unitId), q(l.title), j(l.lines), j(l.questions), j(l.roleplay)]));
ins('pronunciation_tips', ['id', 'title', 'words', 'pattern', 'tip_pt'], tips.map((t) => [q(t.id), q(t.title), j(t.words), q(t.rx), q(t.tip)]));
ins('wisdom_quotes', ['id', 'kind', 'en', 'pt', 'source'], wisdom.map((w) => [q(w.id), q(w.kind), q(w.en), q(w.pt), q(w.source)]));
ins('readings', ['id', 'title', 'author', 'level', 'cost_talents', 'words', 'source_note'], reading.map((r) => [q(r.id), q(r.title), q(r.author), r.level, r.cost, q(JSON.stringify(r.words)) + '::jsonb', q(r.sourceNote)]));
out.push('commit;');
fs.writeFileSync(path.join(__dirname, '../db/seed.sql'), out.join('\n') + '\n');
console.log('✔ db/seed.sql gerado');
