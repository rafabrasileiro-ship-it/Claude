import assert from 'node:assert/strict';
import { units } from '../src/engine/content';
import { buildLessonExercises, buildReviewExercises, buildPracticeFromKeys, checkAnswer } from '../src/engine/exercises';
import { review, dueKeys } from '../src/engine/srs';
import { mulberry32 } from '../src/engine/rng';
import { newProfile, rankFor, regenShields, touchStreak, activeStreak, dayKey, MAX_SHIELDS, SHIELD_REGEN_MS, stars } from '../src/engine/game';

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
assert.equal(rankFor(0, 'F').name, 'Aprendiz'); assert.equal(rankFor(2500, 'F').name, 'Matriarca'); assert.equal(rankFor(2500, 'M').name, 'Patriarca');
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
console.log(`✔ Motor OK (${count} exercícios gerados e verificados)`);
