import assert from 'node:assert/strict';
import { units } from '../src/engine/content';
import { buildLessonExercises, buildReviewExercises, buildPracticeFromKeys, checkAnswer } from '../src/engine/exercises';
import { review, dueKeys } from '../src/engine/srs';
import { mulberry32 } from '../src/engine/rng';
import { newProfile, tierName, regenShields, touchStreak, activeStreak, dayKey, MAX_SHIELDS, SHIELD_REGEN_MS, stars, ensureDaily, bump, MISSIONS, standings, settleLeague, weekKey, TIERS, migrateProfile } from '../src/engine/game';
import { buildRoleplay, buildStationExercises } from '../src/engine/exercises';
import { scoreWords, bestMatch, dictationOk, tipFor } from '../src/engine/pron';
import { chronicles, stations, pronTips, levels } from '../src/engine/content';

const rnd = mulberry32(42);
let count = 0;
for (const u of units) {
  for (const l of u.lessons) {
    const ex = buildLessonExercises(u, l, rnd);
    assert.ok(ex.length >= 8, `${l.id}: exercícios`);
    for (const e of ex) {
      count++;
      if (e.options) { assert.ok(e.options.includes(e.answer), `${e.id}: opção correta ausente`); assert.equal(new Set(e.options).size, e.options.length, `${e.id}: opções repetidas`); }
      if (e.bank) { assert.equal(e.bank.join(' ').split(' ').length, e.bank.length); assert.ok(checkAnswer(e, e.answer.replace(/[.,!?]/g, ''))); }
    }
    // frase do banco deve ser reconstruível
    for (const e of ex.filter((x) => x.bank)) {
      const need = e.answer.replace(/[.,!?;:]/g, '').split(/\s+/);
      const pool = [...e.bank!];
      for (const w of need) { const i = pool.indexOf(w); assert.ok(i >= 0, `${e.id}: palavra ${w} ausente do banco`); pool.splice(i, 1); }
    }
  }
  assert.equal(buildReviewExercises(u, rnd).length, 10);
}
const keys = ['u1l1:v:Sir', 'u2l1:d:0'];
assert.equal(buildPracticeFromKeys(keys, rnd).length, 2);

// SRS
let c = review(undefined, true, 0); assert.equal(c.interval, 1);
c = review(c, true, 0); assert.equal(c.interval, 3);
c = review(c, true, 0); assert.ok(c.interval >= 7);
c = review(c, false, 0); assert.equal(c.reps, 0);
assert.deepEqual(dueKeys({ a: { ...c, due: 5 }, b: { ...c, due: 10 ** 15 } }, 10), ['a']);

// Jogo
let p = newProfile('x', 'T', false, 'F');
assert.equal(TIERS.length, 6); assert.equal(tierName(0, 'F'), 'Aprendiz'); assert.equal(tierName(5, 'F'), 'Matriarca'); assert.equal(tierName(5, 'M'), 'Patriarca'); assert.equal(tierName(2, 'M'), 'Cavaleiro');
p = { ...p, shields: { count: 2, updatedAt: 0 } };
assert.equal(regenShields(p, 3 * SHIELD_REGEN_MS + 1).shields.count, 5);
assert.equal(regenShields(p, SHIELD_REGEN_MS).shields.count, 3);
assert.ok(MAX_SHIELDS === 5);
p = touchStreak(p); assert.equal(p.streak.count, 1); p = touchStreak(p); assert.equal(p.streak.count, 1);
assert.equal(activeStreak(p), 1);
const y = new Date(); y.setDate(y.getDate() - 1);
assert.equal(touchStreak({ ...p, streak: { count: 4, last: dayKey(y) } }).streak.count, 5);
assert.equal(touchStreak({ ...p, streak: { count: 4, last: '2000-01-01' } }).streak.count, 1);
assert.deepEqual([stars(0), stars(2), stars(5)], [3, 2, 1]);
// Missões diárias: 3 slots estáveis no dia, contadores, sem missão impossível
const ctx = { chronicleAvailable: false, hasDue: false, hour: 15 };
let q = ensureDaily(newProfile('m', 'M', false, 'M'), ctx, '2026-01-05');
assert.equal(q.daily.picked.length, 3); assert.equal(new Set(q.daily.picked).size, 3);
assert.ok(!q.daily.picked.includes('chron') && !q.daily.picked.includes('early') && !q.daily.picked.includes('practice'));
assert.deepEqual(ensureDaily(q, ctx, '2026-01-05').daily.picked, q.daily.picked);
q = bump(q, 'lessons', 2, '2026-01-05'); assert.equal(q.daily.c.lessons, 2);
assert.equal(ensureDaily(q, ctx, '2026-01-06').daily.c.lessons, undefined);
assert.ok(MISSIONS.length >= 6);

// Liga: top 10 sobe, últimos 5 descem
const lg = { ...newProfile('l', 'Liga', false, 'M'), league: { tier: 1, week: '2026-W01' } };
const top = settleLeague({ ...lg, weekXp: { week: '2026-W01', xp: 99999 } }, new Date('2026-01-12T10:00:00'));
assert.equal(top.league.tier, 2); assert.equal(top.league.last!.pos, 1);
const low = settleLeague({ ...lg, weekXp: { week: '2026-W01', xp: 0 } }, new Date('2026-01-12T10:00:00'));
assert.equal(low.league.tier, 0);
assert.equal(settleLeague(lg, new Date('2026-01-01T10:00:00')).league.tier, 1);
assert.equal(standings(lg, 0.5).length, 30);
assert.equal(migrateProfile({ ...lg, bestStreak: undefined as any, chests: undefined as any, daily: undefined as any }).chests.length, 0);

// Avaliação de fala por palavra e ditado
const sc = scoreWords('Good morning, Sir.', 'good morning sir', 0.9);
assert.deepEqual(sc.words.map((w) => w.status), ['good', 'good', 'good']); assert.equal(sc.accuracy, 1);
const sc2 = scoreWords('The truth is simple', 'the true is', 0.9);
assert.equal(sc2.words[0].status, 'good'); assert.equal(sc2.words[1].status, 'near'); assert.equal(sc2.words[3].status, 'bad');
assert.equal(scoreWords('hello', '', -1).words[0].status, 'bad');
assert.equal(scoreWords('hello', 'hello', 0.3).words[0].status, 'near');
assert.ok(bestMatch('yes please thank you very much', ['Yes, please. Thank you very much.']).f1 > 0.9);
assert.ok(bestMatch('banana', ['Yes, please.']).f1 === 0);
assert.ok(dictationOk('Good morning, Sir.', 'good morning sir')); assert.ok(dictationOk('Punctuality is a form of respect.', 'punctuality is a form of respct'));
assert.ok(!dictationOk('Good morning, Sir.', 'good evening sir'));
assert.equal(tipFor('truth').id, 'th_voiceless'); assert.equal(tipFor('school').id, 's_cluster');
assert.ok(pronTips.length >= 12);

// Níveis, crônicas e estações
assert.equal(levels.length, 5); assert.deepEqual(levels.map((l) => l.cefr), ['A1', 'A2', 'B1', 'B2', 'C1']);
assert.equal(chronicles.length, 4);
for (const c of chronicles) { assert.equal(c.segments.length, 4, c.id); for (const sg of c.segments) assert.ok(sg.stop.options.includes(sg.stop.answer), c.id); }
for (const st of stations) { assert.equal(st.questions.length, 3); st.questions.forEach((x) => assert.ok(x.options.includes(x.answer))); assert.ok(buildRoleplay(st.unitId)); assert.equal(buildStationExercises(st.unitId, rnd).length, 4); }
for (const u of units) assert.ok(buildReviewExercises(u, rnd).some((e) => e.kind === 'roleplay'), u.id);
assert.ok(units.every((u) => u.lessons.every((l) => buildLessonExercises(u, l, rnd).some((e) => e.kind === 'dictation'))));

console.log(`✔ Motor OK (${count} exercícios gerados e verificados)`);
