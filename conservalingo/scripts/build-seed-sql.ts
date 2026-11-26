// Gera db/seed.sql a partir dos JSON de src/data (fonte única de verdade). Uso: npx tsx scripts/build-seed-sql.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import characters from '../src/data/characters.json';
import { curriculum, levelContent, pronTips, readings, wisdom } from '../src/engine/content';
import { LEVELS, lessonId } from '../src/engine/levels';

const q = (v: unknown) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => (v === null || v === undefined ? 'null' : `${q(JSON.stringify(v))}::jsonb`);
const out: string[] = ['-- Gerado por scripts/build-seed-sql.ts — não editar à mão.', 'begin;'];
const ins = (t: string, cols: string[], rows: (string | number)[][]) => {
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    if (part.length) out.push(`insert into ${t} (${cols.join(',')}) values\n${part.map((r) => '  (' + r.join(',') + ')').join(',\n')};`);
  }
};
const { mascot, families } = characters;

const chars: (string | number)[][] = [[q(mascot.id), q(mascot.name), q('mascot'), 'null', 'null', q(mascot.species), q(mascot.description), 'null', 'null', 'null', 'null']];
for (const f of families) {
  chars.push([q(f.id), q(f.name), q('protagonist'), q(f.sex), 'null', q(f.profession), q(f.archetype), q(f.focus), q(f.id), 'null', 'null']);
  chars.push([q(f.spouse.id), q(f.spouse.name), q('spouse'), q(f.spouse.sex), 'null', q(f.spouse.profession), 'null', 'null', q(f.id), 'null', 'null']);
  for (const c of f.children) chars.push([q(c.id), q(c.name), q('child'), q(c.sex), c.age, 'null', 'null', 'null', q(f.id), 'null', q(f.id)]);
}
ins('characters', ['id', 'name', 'role', 'sex', 'age', 'profession', 'archetype', 'pedagogical_focus', 'family_head_id', 'spouse_id', 'parent_id'], chars);
for (const f of families) out.push(`update characters set spouse_id=${q(f.spouse.id)} where id=${q(f.id)};`, `update characters set spouse_id=${q(f.id)} where id=${q(f.spouse.id)};`);

out.push(`insert into courses (id,title,dialect) values ('en-for-pt','Inglês para Falantes de Português','en-US');`);
ins('eras', ['era', 'course_id', 'cefr', 'title', 'level_from', 'level_to'], curriculum.eras.map((e) => [e.era, q('en-for-pt'), q(e.cefr), q(e.title), e.from, e.to]));
ins('lesson_slot_types', ['slot', 'type', 'title', 'icon', 'description'], curriculum.slots.map((s) => [s.slot, q(s.type), q(s.title), q(s.icon), q(s.desc)]));
ins('level_blocks', ['id', 'era', 'level_from', 'level_to', 'theme', 'grammar'], curriculum.blocks.map((b, i) => [i, LEVELS[b.from - 1].era, b.from, b.to, q(b.theme), q(b.grammar)]));
ins('level_block_cast', ['block_id', 'character_id'], curriculum.blocks.flatMap((b, i) => b.cast.map((c) => [i, q(c)])));
ins('pronunciation_tips', ['id', 'title', 'words', 'pattern', 'tip_pt'], pronTips.map((t) => [q(t.id), q(t.title), j(t.words), q(t.rx), q(t.tip)]));
ins('wisdom_quotes', ['id', 'kind', 'en', 'pt', 'source'], wisdom.map((w) => [q(w.id), q(w.kind), q(w.en), q(w.pt), q(w.source)]));
ins('readings', ['id', 'title', 'author', 'level', 'cost_talents', 'words', 'source_note'], readings.map((r) => [q(r.id), q(r.title), q(r.author), r.level, r.cost, j(r.words), q(r.sourceNote)]));

const levels: (string | number)[][] = []; const lessons: (string | number)[][] = [];
const chunks: (string | number)[][] = []; const sentences: (string | number)[][] = []; const dialogues: (string | number)[][] = [];
const stations: (string | number)[][] = []; const chron: (string | number)[][] = []; const chronCast: (string | number)[][] = []; const segs: (string | number)[][] = [];
const roles: (string | number)[][] = []; const tips: (string | number)[][] = [];
for (const l of LEVELS) {
  const lv = l.status === 'available' ? levelContent(l.id) : undefined;
  levels.push([q(l.id), l.n, l.era, l.block, q(l.title), q(l.status), q(lv?.origin), q(lv?.grammar), q(lv?.wisdom), j(lv?.pnl)]);
  for (const s of curriculum.slots) {
    const spec = lv?.lessons[s.slot - 1];
    lessons.push([q(lessonId(l.id, s.slot)), q(l.id), s.slot, q(spec?.title ?? s.title), q(spec?.objective), q(spec?.intro), q(spec?.dialogue), j(spec?.steps ?? [])]);
  }
  if (!lv) continue;
  lv.chunks.forEach((c) => chunks.push([q(`${l.id}:${c.id}`), q(l.id), q(c.id), q(c.en), q(c.pt), q(c.note)]));
  lv.sentences.forEach((s) => sentences.push([q(`${l.id}:${s.id}`), q(l.id), q(s.id), q(s.who), q(s.en), q(s.pt), j(s.alt)]));
  lv.dialogues.forEach((d) => dialogues.push([q(`${l.id}:${d.id}`), q(l.id), q(d.id), q(d.title), j(d.vocab), j(d.lines)]));
  stations.push([q(l.id), q(lv.listening.title), j(lv.listening.lines), j(lv.listening.questions)]);
  chron.push([q(l.id), q(lv.chronicle.title), q(lv.chronicle.icon), q(lv.chronicle.intro)]);
  lv.chronicle.cast.forEach((c) => chronCast.push([q(l.id), q(c)]));
  lv.chronicle.segments.forEach((sg, i) => segs.push([q(`${l.id}:${i + 1}`), q(l.id), i + 1, j(sg.lines), q(sg.stop.kind), q(sg.stop.q), j(sg.stop.options), q(sg.stop.answer), q(sg.stop.why), q(sg.stop.lang ?? 'en')]));
  const r = lv.roleplay;
  roles.push([q(l.id), q(r.who), q(r.ask), q(r.askPt), q(r.model), q(r.modelPt), j(r.accept)]);
  lv.tips.forEach((t) => tips.push([q(l.id), q(t)]));
}
ins('levels', ['id', 'number', 'era', 'block_id', 'title', 'status', 'origin', 'grammar', 'wisdom_id', 'pnl'], levels);
ins('level_lessons', ['id', 'level_id', 'slot', 'title', 'objective', 'intro', 'dialogue_ref', 'steps'], lessons);
ins('level_chunks', ['id', 'level_id', 'ref', 'en', 'pt', 'note'], chunks);
ins('level_sentences', ['id', 'level_id', 'ref', 'character_id', 'en', 'pt', 'alt'], sentences);
ins('level_dialogues', ['id', 'level_id', 'ref', 'title', 'vocab', 'lines'], dialogues);
ins('listening_stations', ['level_id', 'title', 'lines', 'questions'], stations);
ins('chronicles', ['level_id', 'title', 'icon', 'intro'], chron);
ins('chronicle_cast', ['level_id', 'character_id'], chronCast);
ins('chronicle_segments', ['id', 'level_id', 'position', 'lines', 'stop_kind', 'stop_question', 'stop_options', 'stop_answer', 'stop_why', 'stop_lang'], segs);
ins('roleplays', ['level_id', 'character_id', 'ask', 'ask_pt', 'model', 'model_pt', 'accept'], roles);
ins('level_tips', ['level_id', 'tip_id'], tips);
out.push('commit;');
writeFileSync(join(__dirname, '../db/seed.sql'), out.join('\n') + '\n');
console.log(`✔ db/seed.sql gerado: ${levels.length} níveis, ${lessons.length} lições`);
