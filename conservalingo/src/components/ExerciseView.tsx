import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Exercise } from '../types';
import { colors, fonts, radius, space, fs } from '../theme';
import { Btn, P } from './ui';
import WordFeedback from './WordFeedback';
import { say, stopSpeaking } from '../engine/audio';
import { checkAnswer } from '../engine/exercises';
import { asrAvailable, listen } from '../engine/speech';
import { bestMatch, cleanWord, scoreWords, type ScoredWord } from '../engine/pron';
import { fx } from '../engine/fx';
import { REFRAME } from '../engine/pnl';

interface Props { ex: Exercise; onDone: (correct: boolean) => void; onSpeakScore?: (accuracy: number) => void }

type SpeakState = { status: 'idle' | 'listening' | 'done' | 'error'; text: string; conf: number; uri: string | null; err?: string };

export default function ExerciseView({ ex, onDone, onSpeakScore }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  const [sp, setSp] = useState<SpeakState>({ status: 'idle', text: '', conf: -1, uri: null });
  const stopRef = useRef<() => void>(() => {});
  const voice = ex.voice ?? 'M';
  const asr = useMemo(() => asrAvailable(), []);

  useEffect(() => {
    setChosen(null); setBuilt([]); setTyped(''); setChecked(null); setSp({ status: 'idle', text: '', conf: -1, uri: null });
    if (ex.kind === 'listen' || ex.kind === 'dictation' || ex.kind === 'roleplay') say(ex.speak ?? ex.question, voice);
    return () => { stopRef.current(); stopSpeaking(); };
  }, [ex.id]);

  const isBank = ex.kind === 'bank_en' || ex.kind === 'bank_pt';
  const answerText = isBank ? built.map((i) => ex.bank![i]).join(' ') : ex.kind === 'dictation' ? typed : chosen ?? '';
  const check = () => {
    const ok = checkAnswer(ex, answerText);
    setChecked(ok);
    fx(ok ? 'ok' : 'bad');
    if (ex.speak) say(ex.speak, voice); // ouve a frase correta em inglês
  };

  const speakable = ex.kind === 'speak' || ex.kind === 'roleplay';
  const target = ex.kind === 'roleplay' ? ex.answer : ex.speak ?? ex.answer;

  const startListening = async () => {
    stopSpeaking();
    setSp({ status: 'listening', text: '', conf: -1, uri: null });
    const contextual = target.split(/\s+/).map(cleanWord);
    stopRef.current = await listen({
      onResult: (text, conf) => setSp((s) => ({ ...s, text, conf })),
      onEnd: (uri) => setSp((s) => {
        const next: SpeakState = { ...s, status: s.text.trim() ? 'done' : 'error', uri, err: s.text.trim() ? undefined : 'silence' };
        return next;
      }),
      onError: (code) => setSp((s) => ({ ...s, status: 'error', err: code })),
    }, contextual);
  };

  // Resultado da fala (pontuação palavra por palavra)
  const result = useMemo(() => {
    if (!speakable) return null;
    const heard = sp.text;
    if (sp.status !== 'done' && !(ex.kind === 'roleplay' && checked !== null)) return null;
    if (ex.kind === 'roleplay') {
      const bm = bestMatch(heard, ex.accept ?? [ex.answer]);
      const sc = scoreWords(bm.model, heard, sp.conf);
      return { words: sc.words as ScoredWord[], accuracy: sc.accuracy, ok: bm.f1 >= 0.75, model: bm.model };
    }
    const sc = scoreWords(target, heard, sp.conf);
    return { words: sc.words, accuracy: sc.accuracy, ok: sc.accuracy >= 0.9, model: target };
  }, [sp.status, sp.text, sp.conf, checked]);

  const reported = useRef<string>('');
  useEffect(() => {
    if (result && ex.kind === 'speak' && reported.current !== ex.id + sp.text) { reported.current = ex.id + sp.text; onSpeakScore?.(result.accuracy); fx(result.ok ? 'ok' : 'bad'); }
    if (result && ex.kind === 'roleplay' && sp.status === 'done' && reported.current !== ex.id + sp.text) { reported.current = ex.id + sp.text; fx(result.ok ? 'ok' : 'bad'); }
  }, [result]);

  if (speakable) {
    const spoken = sp.status === 'done';
    const listening = sp.status === 'listening';
    const canType = ex.kind === 'roleplay' && (!asr || sp.status === 'error');
    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.prompt}>{ex.prompt}</Text>
          {ex.kind === 'roleplay' ? (
            <>
              <Pressable onPress={() => say(ex.speak!, voice)}><Text style={s.big}>🔊 {ex.speak}</Text></Pressable>
              <P style={{ textAlign: 'center', color: colors.muted }}>{ex.question}</P>
            </>
          ) : (
            result ? <WordFeedback words={result.words} uri={sp.uri} voice={voice} /> : <Text style={s.big}>{ex.question}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Btn kind="ghost" title="🔊 Ouvir" onPress={() => say(ex.speak!, voice)} /></View>
            <View style={{ flex: 1 }}><Btn kind="ghost" title="🐢 Devagar" onPress={() => say(ex.speak!, voice, true)} /></View>
          </View>
          {listening && <P style={{ textAlign: 'center', color: colors.cobalt }}>🎙️ Ouvindo… {sp.text ? `“${sp.text}”` : 'fale agora'}</P>}
          {sp.status === 'error' && asr && <P style={{ textAlign: 'center', color: colors.crimson }}>{sp.err === 'not-allowed' ? 'Permita o microfone para treinar a pronúncia.' : 'Não consegui ouvir. Fale mais perto do microfone e tente de novo.'}</P>}
          {!asr && <P style={{ textAlign: 'center', color: colors.muted }}>Reconhecimento de fala indisponível neste aparelho. {ex.kind === 'roleplay' ? 'Digite a resposta.' : 'Repita em voz alta e avalie você mesmo.'}</P>}
          {canType && (
            <TextInput value={typed} onChangeText={setTyped} placeholder="Digite sua resposta em inglês" autoCapitalize="none" autoCorrect={false} style={s.input} />
          )}
          {spoken && result && (
            <P style={{ textAlign: 'center', fontFamily: fonts.sansBold, color: result.ok ? colors.olive : colors.crimson }}>
              {ex.kind === 'roleplay'
                ? (result.ok ? '✔ Resposta adequada!' : `Ajuste de Rota. Resposta modelo: “${result.model}”`)
                : `Precisão: ${Math.round(result.accuracy * 100)}%${result.ok ? ' ✔' : ''}`}
            </P>
          )}
          {ex.kind === 'roleplay' && checked !== null && !spoken && (
            <P style={{ textAlign: 'center', fontFamily: fonts.sansBold, color: result?.ok ? colors.olive : colors.crimson }}>
              {result?.ok ? '✔ Resposta adequada!' : `Ajuste de Rota. Resposta modelo: “${ex.answer}”`}
            </P>
          )}
        </ScrollView>
        <View style={s.bar}>
          {asr && !listening && sp.status !== 'done' && <Btn title="🎙️ Falar" onPress={startListening} />}
          {asr && listening && <Btn kind="danger" title="⏹ Parar" onPress={() => stopRef.current()} />}
          {spoken && <Btn kind="ghost" title="🎙️ Tentar de novo" onPress={startListening} />}
          {canType && checked === null && <Btn title="Verificar" disabled={!typed.trim()} onPress={() => { setSp((x) => ({ ...x, text: typed })); setChecked(true); }} />}
          {(spoken || checked !== null) && <Btn kind="success" title="Continuar" onPress={() => onDone(true)} />}
          {!asr && ex.kind === 'speak' && <Btn title="Falei!" onPress={() => onDone(true)} />}
          {asr && !spoken && !listening && <Btn kind="ghost" title="Pular" onPress={() => onDone(true)} />}
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.prompt}>{ex.prompt}</Text>
        {ex.kind === 'listen' || ex.kind === 'dictation' ? (
          <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
            <Pressable onPress={() => say(ex.speak!, voice)} style={s.speaker} accessibilityLabel="Ouvir"><Text style={{ fontSize: fs(34) }}>🔊</Text></Pressable>
            <Pressable onPress={() => say(ex.speak!, voice, true)} style={[s.speaker, { backgroundColor: colors.goldSoft, borderColor: colors.gold }]} accessibilityLabel="Ouvir devagar"><Text style={{ fontSize: fs(34) }}>🐢</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => ex.speak && say(ex.speak, voice)} accessibilityRole="button" accessibilityLabel="Ouvir frase">
            <Text style={s.big}>{ex.question}{ex.speak ? '  🔊' : ''}</Text>
          </Pressable>
        )}

        {ex.kind === 'dictation' ? (
          <TextInput value={typed} onChangeText={setTyped} editable={checked === null} placeholder="Escreva o que você ouviu" autoCapitalize="none" autoCorrect={false}
            multiline style={[s.input, checked !== null && { borderColor: checked ? colors.olive : colors.crimson }]} />
        ) : isBank ? (
          <>
            <View style={s.answerBox}>
              {built.map((bi, i) => (
                <Pressable key={i} disabled={checked !== null} onPress={() => setBuilt(built.filter((_, k) => k !== i))} style={s.chip}>
                  <Text style={s.chipText}>{ex.bank![bi]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.bank}>
              {ex.bank!.map((w, i) => (
                <Pressable key={i} disabled={built.includes(i) || checked !== null} onPress={() => setBuilt([...built, i])}
                  style={[s.chip, built.includes(i) && { opacity: 0.2 }]}>
                  <Text style={s.chipText}>{w}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={{ gap: space.sm }}>
            {ex.options!.map((o) => {
              const sel = chosen === o;
              const show = checked !== null;
              const good = show && o === ex.answer;
              const bad = show && sel && !good;
              return (
                <Pressable key={o} disabled={show} onPress={() => { setChosen(o); if (ex.kind === 'listen') say(o, voice); }} accessibilityRole="button"
                  style={[s.opt, sel && s.optSel, good && s.optGood, bad && s.optBad]}>
                  <Text style={[s.optText, sel && { color: colors.navy }, good && { color: colors.olive }, bad && { color: colors.crimson }]}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {checked === null ? (
        <View style={s.bar}><Btn title="Verificar" disabled={!answerText.trim()} onPress={check} /></View>
      ) : (
        <View style={[s.bar, { backgroundColor: checked ? colors.oliveSoft : colors.crimsonSoft }]}>
          <Text style={[s.fbTitle, { color: checked ? colors.olive : colors.crimson }]}>{checked ? '✔ Muito bem!' : '🧭 Ajuste de Rota · perdeu um escudo'}</Text>
          {!checked && (
            <>
              <P style={{ color: colors.crimson }}>Resposta: <Text style={{ fontFamily: fonts.sansBold }}>{ex.answer}</Text></P>
              {ex.explain ? <P style={{ color: colors.ink, fontSize: fs(13) }}>{ex.explain}</P> : null}
              <P style={{ color: colors.muted, fontSize: fs(12) }}>{REFRAME}</P>
            </>
          )}
          <Btn kind={checked ? 'success' : 'danger'} title="Continuar" onPress={() => onDone(checked)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  prompt: { fontFamily: fonts.sansBold, fontSize: fs(17), color: colors.navy },
  big: { fontFamily: fonts.serif, fontSize: fs(24), color: colors.navy, textAlign: 'center', lineHeight: fs(24) * 1.35 },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, minHeight: 90, fontFamily: fonts.sansMedium, fontSize: fs(18), color: colors.ink, backgroundColor: '#fff', textAlignVertical: 'top' },
  speaker: { width: 96, height: 84, borderRadius: radius.lg, backgroundColor: colors.navySoft, borderWidth: 2, borderColor: colors.navy, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center' },
  opt: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 5, borderColor: colors.line, backgroundColor: '#fff' },
  optSel: { borderColor: colors.cobalt, backgroundColor: colors.navySoft },
  optGood: { borderColor: colors.olive, backgroundColor: colors.oliveSoft },
  optBad: { borderColor: colors.crimson, backgroundColor: colors.crimsonSoft },
  optText: { fontFamily: fonts.sansMedium, fontSize: fs(17), color: colors.ink },
  answerBox: { minHeight: 70, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.line, backgroundColor: '#fff' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: fs(17), color: colors.ink },
  bar: { padding: space.md, paddingBottom: space.lg + 16, gap: space.sm, borderTopWidth: 2, borderTopColor: colors.line },
  fbTitle: { fontFamily: fonts.serif, fontSize: fs(18) },
});
