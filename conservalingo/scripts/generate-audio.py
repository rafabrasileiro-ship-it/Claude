#!/usr/bin/env python3
"""Gera as vozes neurais em inglês (Piper) pré-gravadas do app.

Uso: python scripts/generate-audio.py <pasta_com_modelos_piper>
Modelos esperados: en_US-ryan-high.onnx (voz masculina) e en_US-amy-medium.onnx (voz feminina).
Saída: src/audio/clips/*.m4a e src/audio/manifest.ts (chave "voz|velocidade|texto" -> arquivo).
Só o texto em INGLÊS é pré-gravado; português é falado pelo aparelho em pt-BR (ver src/engine/audio.ts).
"""
import hashlib, json, re, subprocess, sys, tempfile, wave
import numpy as np
from pathlib import Path
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src/data"
OUT = ROOT / "src/audio/clips"
models = Path(sys.argv[1])
VOICES = {"M": "en_US-ryan-high.onnx", "F": "en_US-amy-medium.onnx"}
SLOW = 1.9  # length_scale: maior = mais devagar (alonga fonemas, mantém o tom)

chars = json.loads((DATA / "characters.json").read_text())
sex = {}
for f in chars["families"]:
    sex[f["id"]] = f["sex"]; sex[f["spouse"]["id"]] = f["spouse"]["sex"]
    for c in f["children"]: sex[c["id"]] = c["sex"]
sex["bento"] = "M"

jobs = {}  # (voice, speed, text)
def add(text, voice="M"):
    jobs[(voice, "n", text)] = 1
    jobs[(voice, "s", text)] = 1  # toda fala tem versão lenta (botão 🐢)

def add_n(text, voice="M"):
    jobs[(voice, "n", text)] = 1  # só velocidade normal (palavras isoladas)

def clean(w): return re.sub(r"[.,!?;:\"“”()]", "", w)

for u in json.loads((DATA / "units.json").read_text())["units"]:
    for l in u["lessons"]:
        for v in l["vocab"]: add(v["en"], "M")
        for d in l["dialogue"]: add(d["en"], sex.get(d["who"], "M"))
        # palavras da frase de fala (cartão de dica de pronúncia: "ouça a palavra correta")
        last = l["dialogue"][-1]
        for tok in last["en"].split(): add_n(clean(tok), "M")
for st in json.loads((DATA / "listening.json").read_text()):
    for d in st["lines"]: add(d["en"], sex.get(d["who"], "M"))
    r = st["roleplay"]
    add(r["ask"], sex.get(r["who"], "M"))
    for a in r["accept"]:
        for tok in a.split(): add_n(clean(tok), "M")
for c in json.loads((DATA / "chronicles.json").read_text()):
    for sg in c["segments"]:
        for d in sg["lines"]: add(d["en"], sex.get(d["who"], "M"))
for w in json.loads((DATA / "wisdom.json").read_text()): add(w["en"], "M")
for r in json.loads((DATA / "reading.json").read_text()):
    add(" ".join(x[0] for x in r["words"]), "M")
    for en, _ in r["words"]: add(en, "M")

OUT.mkdir(parents=True, exist_ok=True)
loaded = {v: PiperVoice.load(models / f) for v, f in VOICES.items()}
manifest = {}
CACHE = ROOT / "src/audio/marks.cache.json"
cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
marks = {}  # chave -> início (ms) de cada palavra do texto (para mostrar/realçar palavra a palavra)
SKIP = set("ˈˌːˑ,.;:!?—-\"'()")
PAUSE = {",": 2.0, ";": 2.0, ":": 2.0, ".": 4.0, "!": 4.0, "?": 4.0}

def word_marks(text, chunks, sr):
    """Estima o início de cada palavra: duração real de cada frase (Piper) repartida por nº de fonemas + pausas."""
    toks = text.split()
    groups = []  # por chunk: lista de (peso, pausa)
    for ch in chunks:
        for g in "".join(ch["ph"]).split(" "):
            if not g: continue
            w = sum(1 for c in g if c not in SKIP) or 1
            groups.append((ch["i"], w, PAUSE.get(g[-1], 0.0)))
    if len(groups) != len(toks):  # fallback: letras
        groups = [(0, max(1, len(re.sub(r"\W", "", t))), PAUSE.get(t[-1], 0.0)) for t in toks]
        chunks = [{"i": 0, "n": sum(c["n"] for c in chunks)}]
    starts = []; t0 = 0
    for ch in chunks:
        gs = [g for g in groups if g[0] == ch["i"]]
        total = sum(w + p for _, w, p in gs) or 1
        # a pausa final da frase fica no fim do trecho (não conta para a próxima palavra)
        acc = 0.0
        for _, w, p in gs:
            starts.append(t0 + ch["n"] * acc / total)
            acc += w + p
        t0 += ch["n"]
    return starts

for (voice, speed, text) in sorted(jobs):
    key = f"{voice}|{speed}|{text}"
    name = hashlib.sha1(key.encode()).hexdigest()[:12] + ".m4a"
    manifest[key] = name
    dest = OUT / name
    if dest.exists() and key in cache:
        marks[key] = cache[key]; continue
    cfg = SynthesisConfig(length_scale=SLOW if speed == "s" else 1.0, noise_scale=0.6, noise_w_scale=0.7)
    chunks = []; audio = []; sr = 22050
    for i, ch in enumerate(loaded[voice].synthesize(text, cfg)):
        sr = ch.sample_rate
        audio.append(ch.audio_float_array)
        chunks.append({"i": i, "ph": ch.phonemes, "n": len(ch.audio_float_array)})
    full = np.concatenate(audio)
    loud = np.nonzero(np.abs(full) > 0.0032)[0]
    lead = int(loud[0]) if len(loud) else 0
    st = [max(0, int(round((x - lead) / sr * 1000))) for x in word_marks(text, chunks, sr)]
    marks[key] = st
    if len(marks) % 100 == 0: CACHE.write_text(json.dumps({**cache, **marks}))
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        with wave.open(tmp.name, "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr)
            wf.writeframes(np.clip(full * 32767, -32767, 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-ar", "24000",
                        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08",
                        "-c:a", "aac", "-b:a", "40k", str(dest)], check=True)

CACHE.write_text(json.dumps(marks))

# remove clipes órfãos
for f in OUT.glob("*.m4a"):
    if f.name not in manifest.values(): f.unlink()

lines = ["// GERADO por scripts/generate-audio.py — não editar à mão.",
         "/* eslint-disable */",
         "export const clips: Record<string, number> = {"]
for k, n in sorted(manifest.items()):
    lines.append(f"  {json.dumps(k, ensure_ascii=False)}: require('./clips/{n}'),")
lines.append("};")
lines.append("")
lines.append("/** início (ms) de cada palavra, por chave de clipe */")
lines.append("export const marks: Record<string, number[]> = {")
for k, v in sorted(marks.items()):
    lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v)},")
lines.append("};")
(ROOT / "src/audio/manifest.ts").write_text("\n".join(lines) + "\n")
print(f"{len(manifest)} clipes, {sum(p.stat().st_size for p in OUT.glob('*.m4a'))/1e6:.1f} MB")
