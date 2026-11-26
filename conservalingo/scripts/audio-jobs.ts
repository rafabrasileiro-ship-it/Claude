/**
 * Lista TODO texto em inglês que o app pode falar (voz, velocidade, texto), na mesma forma que o app pede o clipe.
 * Uso: npx tsx scripts/audio-jobs.ts  →  grava scripts/audio-jobs.json (lido por scripts/generate-audio.py)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { levelContent, wisdom, readings } from '../src/engine/content';
import { AVAILABLE, itemOf, voiceOf } from '../src/engine/levels';
import { cleanWord, tipById } from '../src/engine/pron';
import type { Voice } from '../src/types';

export type Job = [Voice, 'n' | 's', string];

export function audioJobs(): Job[] {
  const jobs = new Map<string, Job>();
  const add = (v: Voice, text: string, slow = true) => {
    if (!text) return;
    jobs.set(`${v}|n|${text}`, [v, 'n', text]);
    if (slow) jobs.set(`${v}|s|${text}`, [v, 's', text]);
  };
  const words = (text: string) => text.split(/\s+/).map(cleanWord).filter(Boolean).forEach((w) => add('M', w));
  for (const l of AVAILABLE) {
    const lv = levelContent(l.id)!;
    lv.chunks.forEach((c) => add('M', c.en));
    lv.sentences.forEach((s) => add(voiceOf(s.who), s.en));
    lv.dialogues.forEach((d) => d.lines.forEach((ln) => add(voiceOf(ln.who), ln.en)));
    lv.listening.lines.forEach((ln) => add(voiceOf(ln.who), ln.en));
    lv.listening.questions.forEach((q) => { if (q.lang !== 'pt') add('M', q.answer, false); });
    lv.chronicle.segments.forEach((sg) => {
      sg.lines.forEach((ln) => add(voiceOf(ln.who), ln.en));
      if (sg.stop.lang !== 'pt') sg.stop.options.forEach((o) => add('M', o, false));
    });
    add(voiceOf(lv.roleplay.who), lv.roleplay.ask);
    lv.roleplay.accept.forEach(words);
    for (const les of lv.lessons) for (const st of les.steps) {
      if (st.kind === 'speak') words(itemOf(lv, st.ref)!.en);
      if (st.kind === 'context' && st.speak) add('M', st.speak, false);
      if (st.kind === 'note' && st.tip) tipById(st.tip)?.words.slice(0, 4).forEach((w) => add('M', w, false));
    }
  }
  wisdom.forEach((w) => add('M', w.en));
  readings.forEach((r) => { add('M', r.words.map((w) => w[0]).join(' ')); r.words.forEach((w) => add('M', w[0], false)); });
  return [...jobs.values()].sort((a, b) => (a.join('|') < b.join('|') ? -1 : 1));
}

if (process.argv[1]?.endsWith('audio-jobs.ts')) {
  const jobs = audioJobs();
  writeFileSync(join(__dirname, 'audio-jobs.json'), JSON.stringify(jobs, null, 0));
  console.log(`${jobs.length} trechos de áudio`);
}
