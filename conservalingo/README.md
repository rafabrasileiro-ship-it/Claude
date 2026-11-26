# True Lingo

App móvel gamificado de ensino de inglês para falantes de português (React Native + Expo),
com estilo próprio *Vector Heritage Flat* e valores conservadores, patrióticos e judaico-cristãos,
conforme os documentos de handoff (versão atual: **v4 — 130 níveis / 1.300 lições**).

## Rodar

```bash
cd conservalingo
npm install
npm start          # Expo (dev build para microfone) ou `npm run web`
npm test           # valida o conteúdo contra o handoff v4 + testa o motor pedagógico
npm run typecheck
```

## Arquitetura do currículo (handoff v4)

- **5 Eras × 26 níveis = 130 níveis**, cada um com **10 lições na cadência oficial**:
  1 Fundamento & Vocabulário · 2 Construção & Gramática · 3 Escuta Ativa · 4 Diálogo Familiar ·
  5 Fala & Precisão Fonética · 6 Produção Escrita & Tradução · 7 Intercalação · 8 Crônica Interativa ·
  9 Revisão Cirúrgica (FSRS) · 10 Checkpoint de Honra.
- `src/data/curriculum.json` — configuração estrutural dos 130 níveis (Eras, CEFR, blocos de níveis com tema,
  gramática e elenco do handoff, títulos, status `available` / `planned`).
- `src/data/levels/LXXX.json` — conteúdo de cada nível no formato-molde (blocos lexicais, frases, diálogos,
  escuta, crônica com 4 paradas, roleplay, dicas fonéticas, Sabedoria do Dia, microcopy de PNL e os passos das 10 lições).
  Formato documentado em `docs/level.schema.json`; guia de geração em lote em `docs/GERACAO_EM_LOTE.md`.
- **Nível 01** ("Saudações e Títulos de Respeito", Ayrton, Helena, Alice e Lucas) é **autoral e completo**: é o molde.
- Níveis **02, 06, 11, 16, 17, 21, 27, 53, 79 e 112** têm conteúdo **adaptado** das versões anteriores, encaixado no
  bloco certo e com o elenco do handoff. Os demais **119 níveis** aparecem no mapa como "Em preparação" e não bloqueiam a trilha.
- Motor: `src/engine/levels.ts` (níveis, desbloqueio, itens), `src/engine/exercises.ts` (passos → exercícios,
  intercalação, revisão cirúrgica, treinos), `src/engine/srs.ts` (FSRS v4.5), `src/engine/progress.ts` (recompensas).

## O que está implementado

| Handoff v4 | Onde |
|---|---|
| Mapa Vertical da Trilha (130 níveis por Era, nós de 64dp, trilha dourada) | `src/screens/Home.tsx`, `src/components/Trail.tsx` |
| Tela do nível: 10 lições + Arcas de Talentos a cada 3 lições | `src/screens/Level.tsx` |
| Player de Crônicas Interativas (4 pontos de parada) | `src/screens/Chronicle.tsx` |
| Escuta Ativa (áudio sem texto, 1.0x / devagar), ditado, roleplay falado | `src/screens/Lesson.tsx`, `ExerciseView.tsx` |
| Fala com correção por cores (verde/dourado/carmesim) + micro-dicas PT-BR → EN + gravação do aluno | `ExerciseView.tsx`, `WordFeedback.tsx`, `src/engine/pron.ts` |
| Caderno de Campo: Blocos de Expressão, Registro de Fonemas, Provérbios Memorizados | `src/screens/Caderno.tsx` |
| Painel Familiar: PIN, perfis, metas diárias, microfone por perfil, ambiente blindado | `src/screens/Family.tsx` |
| Combos (Foco Firme, 2× Talentos), selo de cera, Mural de Honra, Ligas (6 patentes), 3 missões + Cofre Diário | `src/engine/game.ts`, `Honra.tsx` |
| Talentos de Ouro (Checkpoints) e Escudos de Guarda (protegem a ofensiva) | `progress.ts`, `game.ts`, `Honra.tsx` |
| Escudos de Atenção (5) + Treino de Revisão & Pronúncia (restaura 1) | `game.ts`, `exercises.ts` |
| PNL: Frase-Âncora, acorde + vibração no acerto, identidade, pressuposições, Ajuste de Rota, Future Pacing | `pnl.ts`, `fx.ts`, `Lesson.tsx` |
| Tio Bento com 6 estados animados | `src/components/Bento.tsx` |
| Leitura Clássica (áudio normal/lento, tradução palavra por palavra) | `src/screens/Reading.tsx` |
| Schema PostgreSQL/Supabase com RLS + seed (5 Eras, 130 níveis, 1.300 lições) | `db/schema.sql`, `npm run seed:sql` |

`npm test` falha se nomes, profissões, cônjuges, filhos, faixas e elenco dos blocos de níveis, cadência das 10 lições,
referências dos passos, inglês americano ou a cobertura de áudio divergirem do handoff.

## Áudio

Vozes neurais en-US pré-gravadas (Piper: `en_US-ryan-high` masculina, `en_US-amy-medium` feminina), normal e devagar,
com o tempo de cada palavra para as histórias palavra a palavra. `npx tsx scripts/audio-jobs.ts` lista todo texto que o
app pode falar; `python scripts/generate-audio.py <modelos>` grava os clipes que faltam. Português usa a voz pt-BR do aparelho.

## Dialeto do inglês

Inglês padrão dos Estados Unidos (grafia americana, vozes `en_US`). O validador barra grafia britânica e inglês arcaico
(exceto O Peregrino, texto histórico). O inglês britânico terá curso próprio (`courses.dialect = 'en-GB'`).

## Limitações conhecidas

- **Conteúdo**: 11 de 130 níveis estão prontos (Nível 01 autoral + 10 adaptados). Os outros 119 seguem o molde do Nível 01
  e precisam de geração em lote com revisão editorial (`docs/GERACAO_EM_LOTE.md`).
- **Reconhecimento de fala**: o Android avalia a frase inteira; a cor por palavra vem do alinhamento do texto reconhecido
  (não há nota por fonema). Sem reconhecedor no aparelho, o app volta para autoavaliação.
- **Ligas**: competidores simulados localmente (não há servidor de ranking).
- **Tio Bento**: animações nativas (sem Lottie) sobre a arte do ícone; colete e gravata ainda não desenhados.
- **Persistência**: local (AsyncStorage); o schema está pronto para sincronizar com o Supabase.
- **Citações bíblicas e clássicas**: revisar atribuições e traduções com um editor antes do lançamento.
