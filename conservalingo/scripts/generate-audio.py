#!/usr/bin/env python3
"""Gera as vozes neurais em inglês (Piper) pré-gravadas do app.

Uso: python scripts/generate-audio.py <pasta_com_modelos_piper>
Modelos esperados: en_US-ryan-high.onnx (voz masculina) e en_US-amy-medium.onnx (voz feminina).
Saída: src/audio/clips/*.m4a e src/audio/manifest.ts (chave "voz|velocidade|texto" -> arquivo).
Só o texto em INGLÊS é pré-gravado; português é falado pelo aparelho em pt-BR (ver src/engine/audio.ts).
"""
import hashlib, json, subprocess, sys, tempfile, wave
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

for u in json.loads((DATA / "units.json").read_text())["units"]:
    for l in u["lessons"]:
        for v in l["vocab"]: add(v["en"], "M")
        for d in l["dialogue"]: add(d["en"], sex.get(d["who"], "M"))
        # frases do diálogo também na outra voz não são necessárias
for w in json.loads((DATA / "wisdom.json").read_text()): add(w["en"], "M")
for r in json.loads((DATA / "reading.json").read_text()):
    add(" ".join(x[0] for x in r["words"]), "M")
    for en, _ in r["words"]: add(en, "M")

OUT.mkdir(parents=True, exist_ok=True)
loaded = {v: PiperVoice.load(models / f) for v, f in VOICES.items()}
manifest = {}
for (voice, speed, text) in sorted(jobs):
    key = f"{voice}|{speed}|{text}"
    name = hashlib.sha1(key.encode()).hexdigest()[:12] + ".m4a"
    manifest[key] = name
    dest = OUT / name
    if dest.exists(): continue
    cfg = SynthesisConfig(length_scale=SLOW if speed == "s" else 1.0, noise_scale=0.6, noise_w_scale=0.7)
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        with wave.open(tmp.name, "wb") as wf:
            loaded[voice].synthesize_wav(text, wf, syn_config=cfg)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-ar", "24000",
                        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08",
                        "-c:a", "aac", "-b:a", "40k", str(dest)], check=True)

# remove clipes órfãos
for f in OUT.glob("*.m4a"):
    if f.name not in manifest.values(): f.unlink()

lines = ["// GERADO por scripts/generate-audio.py — não editar à mão.",
         "/* eslint-disable */",
         "export const clips: Record<string, number> = {"]
for k, n in sorted(manifest.items()):
    lines.append(f"  {json.dumps(k, ensure_ascii=False)}: require('./clips/{n}'),")
lines.append("};")
(ROOT / "src/audio/manifest.ts").write_text("\n".join(lines) + "\n")
print(f"{len(manifest)} clipes, {sum(p.stat().st_size for p in OUT.glob('*.m4a'))/1e6:.1f} MB")
