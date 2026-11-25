# CONSERVALINGO

App móvel gamificado de ensino de inglês para falantes de português (React Native + Expo),
com identidade **Heritage & Classic UI** e valores conservadores, patrióticos e judaico-cristãos,
conforme o documento de handoff.

## Rodar

```bash
cd conservalingo
npm install
npm start          # Expo: escaneie o QR no Expo Go, ou use `npm run web`
npm test           # valida o conteúdo contra o handoff + testa o motor (264 exercícios)
npm run typecheck
```

## O que está implementado

| Handoff | Onde |
|---|---|
| Paleta e tipografia (Merriweather + Inter) | `src/theme.ts` |
| 6 protagonistas, cônjuges, 12 filhos, mascote Tio Bento | `src/data/characters.json` |
| Módulo 1: 6 unidades × 4 lições + desafio de revisão, com diálogos entre o elenco especificado | `src/data/units.json` |
| Sabedoria do Dia (18 provérbios/citações, com áudio) | `src/data/wisdom.json` |
| Leitura Clássica (Salmo 23, fábula da formiga, O Peregrino) com tradução palavra a palavra, áudio lento/normal | `src/data/reading.json`, `src/screens/Reading.tsx` |
| Bússola de Constância, Talentos de Ouro, Escudos de Atenção (máx. 5, +1/30 min), Patentes | `src/engine/game.ts` |
| Repetição espaçada (SM-2) e Treino de Virtude (restaura 1 escudo) | `src/engine/srs.ts` |
| Exercícios: escolha, tradução PT↔EN com banco de palavras, listening, speaking | `src/engine/exercises.ts`, `src/components/ExerciseView.tsx` |
| Diálogos em quadrinhos (balões com avatar do personagem, voz grave p/ homens e suave p/ mulheres) | `src/screens/Lesson.tsx` |
| Modo Família com PIN dos pais, perfis infantis e painel de desempenho | `src/screens/Family.tsx` |
| Loja de Talentos (trajes, leituras extras) | `src/screens/Characters.tsx`, `Reading.tsx` |
| Schema PostgreSQL/Supabase com RLS + seed gerado dos JSON | `db/schema.sql`, `npm run seed:sql` → `db/seed.sql` |

Os exercícios são gerados a partir do vocabulário e dos diálogos (fonte única: os JSON).
`npm run validate` falha se nomes, profissões, cônjuges, idades dos filhos, elenco por unidade
ou estrutura do Módulo 1 divergirem do handoff.

## Limitações conhecidas (próximos passos)

- **Reconhecimento de fala**: o exercício *Speaking* usa autoavaliação. Trocar por
  `expo-speech-recognition` (módulo nativo, exige dev build) — ponto marcado em `ExerciseView.tsx`.
- **Áudio**: usa TTS do dispositivo (`expo-speech`). Para vozes nativas gravadas, trocar `src/engine/audio.ts`.
- **Ilustrações**: avatares são emojis provisórios; prompts de arte em `docs/ILLUSTRATION_PROMPTS.md`.
- **Persistência**: local (AsyncStorage). O schema em `db/` está pronto para sincronizar com Supabase,
  e o PIN dos pais deve ser guardado com hash no servidor (hoje fica no dispositivo).
- **Ligas semanais**: patentes são por XP total; o XP semanal já é registrado (`weekXp`) para ligas com ranking online.
- **Citações**: revisar atribuições e traduções com um editor antes do lançamento.

## Dialeto do inglês

O Módulo 1 usa **inglês padrão dos Estados Unidos** (grafia americana, vozes `en_US` e fallback `en-US`).
`npm run validate` falha se aparecer grafia/vocabulário britânico ou inglês arcaico. O inglês britânico terá um
capítulo próprio (curso `en-GB`; o schema já prevê `courses.dialect`) com vozes e textos separados.
Os versículos usam inglês americano atual (ex.: "Honor your father and your mother").
