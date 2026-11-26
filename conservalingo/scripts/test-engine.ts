import assert from 'node:assert/strict';
import { levelContent, wisdom } from '../src/engine/content';
import { AVAILABLE, LEVELS, currentLevel, isDone, lessonId, lessonUnlocked, levelDone, levelUnlocked, nextSlot } from '../src/engine/levels';
import { buildLesson, buildPhonPractice, buildPractice, checkAnswer, exerciseForKey, interleave, surgicalReview } from '../src/engine/exercises';
import { RETENTION, dueKeys, retrievability, review, weakestKeys, W } from '../src/engine/srs';
import { mulberry32 } from '../src/engine/rng';
import {
  newProfile, tierName, regenShields, touchStreak, activeStreak, dayKey, MAX_SHIELDS, SHIELD_REGEN_MS, stars, ensureDaily, bump, MISSIONS,
  standings, settleLeague, TIERS, migrateProfile, claimVault, vaultAvailable, missionsAllDone, VAULT_TALENTS,
} from '../src/engine/game';
import { completeLesson } from '../src/engine/progress';
import { scoreWords, bestMatch, dictationOk, tipFor, writeOk, firstLetters, expand, recordPhon, weakWords } from '../src/engine/pron';
import type { Exercise, Profile } from '../src/types';

const rnd = mulberry32(42);
const DAY = 86400000;
const fresh = () => newProfile('t', 'Teste', false, 'M');
const complete = (p: Profile, levelId: string, upTo = 10): Profile => {
  const c = { ...p.completed };
  for (let s = 1; s <= upTo; s++) c[lessonId(levelId, s)] = 3;
  return { ...p, completed: c };
};
function checkExercise(e: Exercise, where: string) {
  if (e.options) { assert.ok(e.options.includes(e.answer), `${where}: opção correta ausente`); assert.equal(new Set(e.options).size, e.options.length, `${where}: opções repetidas`); assert.ok(e.options.length >= 2, `${where}: poucas opções`); }
  if (e.bank) {
    const pool = [...e.bank];
    for (const w of e.answer.replace(/[.,!?;:"“”]/g, '').split(/\s+/)) { const i = pool.indexOf(w); assert.ok(i >= 0, `${where}: palavra ${w} ausente do banco`); pool.splice(i, 1); }
    assert.ok(checkAnswer(e, e.answer), `${where}: resposta do banco não confere`);
  }
  if (e.kind === 'write') assert.ok(checkAnswer(e, e.answer) && writeOk(e.accept!, e.answer.toLowerCase()), `${where}: tradução correta recusada`);
  if (e.kind === 'dictation') assert.ok(checkAnswer(e, e.answer), `${where}: ditado correto recusado`);
  if (e.kind === 'choose' && e.question.includes('___')) assert.ok(!e.question.includes(` ${e.answer} `) || e.question.split('___').length === 2, `${where}: lacuna`);
  if (e.kind !== 'note') assert.ok(e.question, `${where}: sem enunciado`);
}

// ── Currículo e lições de todos os níveis disponíveis ──
assert.equal(LEVELS.length, 130);
assert.ok(AVAILABLE.length >= 1 && AVAILABLE[0].id === 'L001');
let count = 0;
for (const l of AVAILABLE) {
  const lv = levelContent(l.id)!;
  for (let slot = 1; slot <= 10; slot++) {
    if (lv.lessons[slot - 1].type === 'cronica') continue;
    const { exercises } = buildLesson(lv, slot, fresh(), rnd);
    assert.ok(exercises.length >= 3, `${l.id}-${slot}: exercícios`);
    exercises.forEach((e) => { count++; checkExercise(e, `${l.id}-${slot}/${e.id}`); });
    assert.equal(new Set(exercises.map((e) => e.id)).size, exercises.length, `${l.id}-${slot}: ids repetidos`);
  }
}
// Nível 01 completo: 10 lições na cadência oficial
const L1 = levelContent('L001')!;
assert.deepEqual(L1.lessons.map((x) => x.type), ['fundamento', 'construcao', 'escuta', 'dialogo', 'fala', 'escrita', 'intercalacao', 'cronica', 'revisao', 'checkpoint']);
assert.equal(L1.chronicle.segments.length, 4);
assert.equal(L1.origin, 'autoral');

// ── Desbloqueio ──
let p = fresh();
assert.ok(levelUnlocked(p, 'L001') && !levelUnlocked(p, AVAILABLE[1].id));
assert.ok(lessonUnlocked(p, 'L001', 1) && !lessonUnlocked(p, 'L001', 2));
assert.ok(!levelUnlocked(p, 'L003'), 'nível em preparação nunca é liberado');
p = complete(p, 'L001', 4);
assert.ok(lessonUnlocked(p, 'L001', 5) && !lessonUnlocked(p, 'L001', 6));
assert.equal(nextSlot(p, 'L001'), 5);
assert.equal(currentLevel(p).id, 'L001');
p = complete(p, 'L001');
assert.ok(levelDone(p, 'L001') && levelUnlocked(p, AVAILABLE[1].id));
assert.equal(currentLevel(p).id, AVAILABLE[1].id);

// ── FSRS ──
let c = review(undefined, true, 0);
assert.equal(c.s, W[2]); assert.equal(c.reps, 1); assert.equal(Math.round((c.due - 0) / DAY), Math.round(W[2]));
assert.ok(Math.abs(retrievability(c, 0) - 1) < 1e-9);
assert.ok(Math.abs(retrievability(c, c.s * DAY) - RETENTION) < 1e-6, 'R(S) = 90%');
const c2 = review(c, true, c.due);
assert.ok(c2.s > c.s && c2.due - c.due > c.due - 0, 'intervalo cresce após acerto');
const lapse = review(c2, false, c2.due);
assert.ok(lapse.s < c2.s && lapse.lapses === 1 && lapse.due - c2.due === 10 * 60 * 1000, 'erro reduz a estabilidade e volta em 10 min');
const same = review(c, true, 1000);
assert.ok(Math.abs(same.s - c.s) < 1e-3, 'revisão no mesmo instante não infla a memória');
const wrongFirst = review(undefined, false, 0);
assert.equal(wrongFirst.s, W[0]);
assert.deepEqual(dueKeys({ a: { ...c, due: 5 }, b: { ...c, due: 10 ** 15 } }, 10), ['a']);
assert.deepEqual(weakestKeys({ a: c, b: { ...c, last: -100 * DAY } }, () => true, 1, 0), ['b']);

// ── Exercícios a partir das chaves do Caderno ──
assert.ok(exerciseForKey('L001:c4', rnd, 'x'));
assert.ok(exerciseForKey('L001:s9', rnd, 'x'));
assert.ok(exerciseForKey('L001:d1.5', rnd, 'x'));
assert.ok(exerciseForKey('L001@2.5', rnd, 'x'));
assert.ok(exerciseForKey('L001@q1', rnd, 'x'));
assert.equal(exerciseForKey('u1l1:v:Sir', rnd, 'x'), null);

// ── Intercalação e Revisão Cirúrgica ──
let q = complete(fresh(), 'L001');
q = { ...q, srs: { 'L001:c4': review(undefined, true, Date.now() - 30 * DAY), 'L001:s9': review(undefined, true, Date.now()) } };
const second = levelContent(AVAILABLE[1].id)!;
const mix = interleave(second, q, 8, rnd);
assert.equal(mix.length, 8);
assert.ok(mix.some((e) => e.srsKey?.startsWith('L001')) && mix.some((e) => e.srsKey?.startsWith(second.id)), 'intercalação mistura níveis');
q = recordPhon(q, [{ word: 'thank', status: 'bad' }, { word: 'morning', status: 'near' }, { word: 'Good', status: 'good' }]);
const rev = surgicalReview(L1, q, 8, rnd);
assert.equal(rev.length, 8);
assert.equal(rev.filter((e) => e.word).length, 2, 'revisão inclui as palavras de pronúncia mais fraca');
assert.ok(rev.some((e) => e.srsKey === 'L001:c4'), 'revisão prioriza o item mais esquecido');
const prc = buildPractice(q, rnd, Date.now() + 365 * DAY);
assert.ok(prc.length >= 3 && prc.some((e) => e.word));
assert.equal(buildPhonPractice(q).length, 2);
assert.deepEqual(weakWords(q).map((w) => w.w), ['thank', 'morning']);

// ── Recompensas, Talentos de Ouro e Provérbios ──
let r = completeLesson(fresh(), { lessonId: 'L001-10', type: 'checkpoint', errors: 0, wisdomId: 'w19' });
assert.equal(r.r.gold, 2); assert.equal(r.p.gold, 2); assert.equal(r.p.proverbs.w19.seen, 1);
assert.equal(completeLesson(r.p, { lessonId: 'L001-10', type: 'checkpoint', errors: 0 }).r.gold, 0, 'ouro só na primeira vez');
r = completeLesson(fresh(), { lessonId: 'L001-08', type: 'cronica', errors: 1 });
assert.equal(r.p.daily.c.chronicles, 1); assert.equal(r.p.daily.c.lessons, 1); assert.equal(r.p.gold, 0);
const prac = completeLesson({ ...fresh(), shields: { count: 2, updatedAt: Date.now() } }, { type: 'practice', errors: 0 });
assert.equal(prac.p.shields.count, 3); assert.equal(prac.p.daily.c.practice, 1);
assert.ok(wisdom.some((w) => w.id === 'w19'));

// ── Ofensiva com Escudo de Guarda ──
let g = fresh();
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
g = touchStreak(g); assert.equal(g.streak.count, 1); g = touchStreak(g); assert.equal(g.streak.count, 1);
assert.equal(touchStreak({ ...g, streak: { count: 4, last: daysAgo(1) } }).streak.count, 5);
assert.equal(touchStreak({ ...g, streak: { count: 4, last: '2000-01-01' } }).streak.count, 1);
const guarded = touchStreak({ ...g, guards: 1, streak: { count: 9, last: daysAgo(2) } });
assert.equal(guarded.streak.count, 10); assert.equal(guarded.guards, 0);
assert.equal(activeStreak({ ...g, guards: 1, streak: { count: 9, last: daysAgo(2) } }), 9);
assert.equal(activeStreak({ ...g, guards: 0, streak: { count: 9, last: daysAgo(2) } }), 0);
assert.equal(touchStreak({ ...g, guards: 1, streak: { count: 9, last: daysAgo(3) } }).streak.count, 1);

// ── Missões diárias e Cofre Diário ──
const ctx = { chronicleAvailable: false, hasDue: false, hour: 15 };
let m = ensureDaily(fresh(), ctx, '2026-01-05');
assert.equal(m.daily.picked.length, 3); assert.equal(new Set(m.daily.picked).size, 3);
assert.ok(!m.daily.picked.includes('chron') && !m.daily.picked.includes('early') && !m.daily.picked.includes('practice'));
assert.deepEqual(ensureDaily(m, ctx, '2026-01-05').daily.picked, m.daily.picked);
m = bump(m, 'lessons', 2, '2026-01-05'); assert.equal(m.daily.c.lessons, 2);
assert.equal(ensureDaily(m, ctx, '2026-01-06').daily.c.lessons, undefined);
assert.ok(MISSIONS.length >= 6);
const today = dayKey();
let v = ensureDaily(fresh(), ctx, today);
assert.ok(!vaultAvailable(v));
for (const id of v.daily.picked) { const def = MISSIONS.find((x) => x.id === id)!; v = bump(v, def.counter, def.goal, today); }
assert.ok(missionsAllDone(v) && vaultAvailable(v));
v = { ...v, shields: { count: 1, updatedAt: Date.now() } };
const opened = claimVault(v);
assert.equal(opened.talents, v.talents + VAULT_TALENTS); assert.equal(opened.shields.count, MAX_SHIELDS);
assert.equal(claimVault(opened), opened, 'cofre abre uma vez por dia');

// ── Liga semanal ──
assert.equal(TIERS.length, 6); assert.equal(tierName(5, 'F'), 'Matriarca'); assert.equal(tierName(2, 'M'), 'Cavaleiro');
const lg = { ...fresh(), league: { tier: 1, week: '2026-W01' } };
assert.equal(settleLeague({ ...lg, weekXp: { week: '2026-W01', xp: 99999 } }, new Date('2026-01-12T10:00:00')).league.tier, 2);
assert.equal(settleLeague({ ...lg, weekXp: { week: '2026-W01', xp: 0 } }, new Date('2026-01-12T10:00:00')).league.tier, 0);
assert.equal(standings(lg, 0.5).length, 30);

// ── Migração de perfis antigos ──
const old = { ...fresh(), srs: { 'u1l1:v:Sir': { ease: 2.5, interval: 1, due: 0, reps: 1 } }, gold: undefined, phon: undefined, goal: undefined, chests: ['u1'] } as unknown as Profile;
const mig = migrateProfile(old);
assert.deepEqual(mig.srs, {}); assert.equal(mig.gold, 0); assert.equal(mig.goal, 2); assert.deepEqual(mig.phon, {}); assert.deepEqual(mig.chests, []); assert.equal(mig.asr, true);

// ── Fala, escrita e ditado ──
assert.equal(expand("I'm fine, it's 6"), 'i am fine, it is six');
const sc = scoreWords('Good morning, Sir.', 'good morning sir', 0.9);
assert.deepEqual(sc.words.map((w) => w.status), ['good', 'good', 'good']); assert.equal(sc.accuracy, 1);
assert.deepEqual(scoreWords('I am fine, thank you.', "I'm fine thank you", 0.9).words.map((w) => w.status), ['good', 'good', 'good', 'good', 'good']);
const sc2 = scoreWords('The truth is simple', 'the true is', 0.9);
assert.equal(sc2.words[1].status, 'near'); assert.equal(sc2.words[3].status, 'bad');
assert.equal(scoreWords('hello', 'hello', 0.3).words[0].status, 'near');
assert.ok(bestMatch('yes please thank you very much', ['Yes, please. Thank you very much.']).f1 > 0.9);
assert.ok(dictationOk('Good morning, Sir.', 'good morning sir') && !dictationOk('Good morning, Sir.', 'good evening sir'));
assert.ok(writeOk(['Hello, I am Alice.'], "hello, i'm alice") && writeOk(['Good morning, Ma\'am.'], 'good morning maam') && !writeOk(['Goodbye, Sir.'], 'good night sir'));
assert.ok(writeOk(['Thank you, Ma\'am. Punctuality is respect.'], 'thank you maam punctuality is respct'));
assert.equal(firstLetters('Hello, I am Alice.'), 'H____, I a_ A____.');
assert.equal(tipFor('truth').id, 'th_voiceless'); assert.equal(tipFor('school').id, 's_cluster'); assert.equal(tipFor("Ma'am").id, 'ae_sound'); assert.equal(tipFor('you').id, 'generic');

// ── Escudos e estrelas ──
let sh = { ...fresh(), shields: { count: 2, updatedAt: 0 } };
assert.equal(regenShields(sh, 3 * SHIELD_REGEN_MS + 1).shields.count, 5);
assert.equal(regenShields(sh, SHIELD_REGEN_MS).shields.count, 3);
assert.deepEqual([stars(0), stars(2), stars(5)], [3, 2, 1]);
assert.ok(!isDone(fresh(), 'L001', 1));

console.log(`✔ Motor OK (${count} exercícios gerados e verificados em ${AVAILABLE.length} níveis)`);
