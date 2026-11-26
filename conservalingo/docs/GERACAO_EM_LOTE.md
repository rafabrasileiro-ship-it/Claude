# Geração em lote dos níveis (molde: Nível 01)

O app lê cada nível de `src/data/levels/LXXX.json`. O **Nível 01** (`L001.json`) é o molde completo e autoral.
Para criar um novo nível (ex.: `L003`):

1. **Estrutura** — consulte `src/data/curriculum.json`: número, Era, CEFR, bloco (tema, gramática e **elenco obrigatório**)
   e o título do nível. O elenco permitido é o do bloco, seus núcleos familiares e o Tio Bento.
2. **Conteúdo** — preencha os campos documentados em `docs/level.schema.json`:
   - `chunks` (blocos lexicais, ~10–13, no máx. 15% inéditos), `sentences` (frases-alvo com falante),
     `dialogues` (cena do Diálogo Familiar, com `vocab`), `listening` (6 falas + 3 perguntas),
     `chronicle` (4 trechos, cada um com parada `deduce` | `moral` | `complete`), `roleplay`, `wisdom`, `tips`, `pnl`.
   - `lessons`: exatamente 10, na cadência oficial. Cada passo aponta para um item por referência
     (`c3`, `s2`, `d1.4`, `l.2`) e o motor monta o exercício (distratores, embaralhamento, áudio).
     Tipos de passo: `learn`, `note`, `choose`, `context`, `listen`, `fill`, `bank`, `next`, `dictation`, `speak`, `write`,
     `roleplay`, `questions`, `question`, `interleave` (lição 7) e `review` (lição 9). A lição 8 (crônica) não leva passos.
     O Checkpoint (lição 10) precisa cobrir escuta, fala, gramática e tradução.
3. **Registro** — mude `status` do nível para `"available"` em `curriculum.json` e acrescente o import em `src/data/levels/index.ts`.
4. **Áudio** — `npx tsx scripts/audio-jobs.ts` e `python scripts/generate-audio.py <modelos Piper>`.
5. **Validação** — `npm test` (elenco do bloco, cadência, referências, inglês americano, cobertura de áudio, 3–12 micro-exercícios por lição).
6. **Revisão editorial humana** — valores, naturalidade do inglês, citações e traduções.

## Prompt-modelo para um gerador (LLM)

> Você vai escrever o nível {N} do CONSERVALINGO no formato JSON de `docs/level.schema.json`, usando `L001.json` como exemplo.
> Era {ERA} (CEFR {CEFR}); bloco {BLOCO}: tema "{TEMA}", gramática "{GRAMÁTICA}", elenco {ELENCO}; título do nível "{TÍTULO}".
> Regras: inglês padrão dos EUA; nada de conteúdo woke, pronome neutro, relacionamentos fora do modelo da família tradicional
> ou relativismo moral; valores de família, fé, pátria, trabalho e mérito; crianças inocentes e respeitosas; frases curtas e
> naturais para o nível CEFR; no máx. 15% de vocabulário inédito; 10 lições na cadência oficial; o checkpoint cobre escuta,
> fala, gramática e tradução. Responda apenas com o JSON.

Todo nível gerado precisa passar em `npm test` **e** em revisão humana antes de ir para o app.
