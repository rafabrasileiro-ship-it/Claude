export type Sex = 'M' | 'F';
export type Voice = 'M' | 'F';

export interface DialogueLine { who: string; en: string; pt: string }

// ─────────────────────── Currículo v4: 5 Eras × 26 níveis × 10 lições ───────────────────────
export type SlotType = 'fundamento' | 'construcao' | 'escuta' | 'dialogo' | 'fala' | 'escrita' | 'intercalacao' | 'cronica' | 'revisao' | 'checkpoint';
export interface EraDef { era: number; cefr: string; title: string; from: number; to: number }
export interface SlotDef { slot: number; type: SlotType; title: string; icon: string; desc: string }
export interface BlockDef { from: number; to: number; label: string; theme: string; grammar: string; cast: string[] }
export interface LevelDef { n: number; id: string; era: number; cefr: string; block: number; title: string; status: 'available' | 'planned' }
export interface Curriculum { version: number; lessonsPerLevel: number; eras: EraDef[]; slots: SlotDef[]; blocks: BlockDef[]; levels: LevelDef[] }

/** Referência a um item de conteúdo do nível: "c3" (bloco lexical), "s2" (frase), "d1.4" (fala de diálogo), "l.2" (fala da escuta). */
export type Ref = string;
export interface Chunk { id: string; en: string; pt: string; note?: string }
export interface Sentence { id: string; who: string; en: string; pt: string; alt?: string[] }
export interface Dialogue { id: string; title: string; vocab?: string[]; lines: DialogueLine[] }
export interface Question { q: string; options: string[]; answer: string; lang?: 'en' | 'pt' }
export interface Listening { title: string; lines: DialogueLine[]; questions: Question[] }
export interface ChronicleStop extends Question { kind: 'deduce' | 'moral' | 'complete'; why: string }
export interface ChronicleData { title: string; icon: string; intro: string; cast: string[]; segments: { lines: DialogueLine[]; stop: ChronicleStop }[] }
export interface Roleplay { who: string; ask: string; askPt: string; model: string; modelPt: string; accept: string[] }

export type Step =
  | { kind: 'learn'; ref: Ref }
  | { kind: 'note'; title: string; body: string; examples?: Ref[]; tip?: string }
  | { kind: 'choose'; ref: Ref; dir: 'en-pt' | 'pt-en' }
  | { kind: 'context'; q: string; options: string[]; answer: string; explain?: string; speak?: string }
  | { kind: 'listen'; ref: Ref }
  | { kind: 'fill'; ref: Ref; blank: string; options: string[]; explain?: string }
  | { kind: 'bank'; ref: Ref; dir: 'pt-en' | 'en-pt' }
  | { kind: 'next'; ref: Ref }
  | { kind: 'dictation'; ref: Ref }
  | { kind: 'speak'; ref: Ref }
  | { kind: 'write'; ref: Ref; hint: 'first' | 'none' }
  | { kind: 'roleplay' }
  | { kind: 'questions' }
  | { kind: 'question'; index: number }
  | { kind: 'interleave'; count: number }
  | { kind: 'review'; count: number };

export interface LessonSpec { slot: number; type: SlotType; title: string; objective: string; intro: string; dialogue?: string; steps: Step[] }
export interface LevelContent {
  id: string; number: number; title: string; grammar: string; origin: 'autoral' | 'adaptado';
  chunks: Chunk[]; sentences: Sentence[]; dialogues: Dialogue[];
  listening: Listening; chronicle: ChronicleData; roleplay: Roleplay;
  wisdom: string; tips: string[];
  pnl: { identity: string; presupposition: string; futurePacing: string[] };
  lessons: LessonSpec[];
}

// ─────────────────────── Exercícios (gerados pelo motor a partir dos passos) ───────────────────────
export type ExerciseKind = 'learn' | 'note' | 'choose' | 'listen' | 'bank_en' | 'bank_pt' | 'speak' | 'dictation' | 'roleplay' | 'write';
export interface Exercise {
  id: string;            // único dentro da sessão
  kind: ExerciseKind;
  prompt: string;        // instrução curta em PT
  question: string;      // texto exibido (ou frase de áudio)
  speak?: string;        // texto em inglês a ser falado (clipe pré-gravado)
  voice?: Voice;         // voz do falante (masculina/feminina)
  options?: string[];    // 'choose' / 'listen'
  bank?: string[];       // palavras embaralhadas (inclui distratores)
  answer: string;        // resposta correta
  hint?: string;         // dica (nota do bloco lexical, primeiras letras na escrita…)
  accept?: string[];     // respostas aceitas ('roleplay' / 'write')
  explain?: string;      // "Ajuste de Rota": explicação gramatical/fonética
  srsKey?: string;       // item do Caderno/FSRS (ex.: "L001:c3", "L001@2.5")
  note?: { title: string; body: string; examples: { en: string; pt: string; voice: Voice }[]; tip?: string };
  word?: boolean;        // fala de palavra isolada (Registro de Fonemas)
}

/** Cartão FSRS (Free Spaced Repetition Scheduler, v4.5). */
export interface SrsCard { s: number; d: number; last: number; due: number; reps: number; lapses: number }
export interface PhonEntry { w: string; g: number; n: number; b: number; last: 'good' | 'near' | 'bad'; at: number }

export interface Profile {
  id: string; name: string; isChild: boolean; sex: Sex; age?: number;
  streak: { count: number; last: string | null };
  talents: number;
  gold: number;                      // Talentos de Ouro (Checkpoints de Honra)
  guards: number;                    // Escudos de Guarda (protegem a ofensiva)
  shields: { count: number; updatedAt: number };
  xp: number;
  weekXp: { week: string; xp: number };
  completed: Record<string, number>; // lessonId (L001-01…) -> estrelas (1..3)
  srs: Record<string, SrsCard>;
  phon: Record<string, PhonEntry>;   // Registro de Fonemas: histórico por palavra
  proverbs: Record<string, { seen: number; memorized?: boolean }>;
  unlocked: string[];                // itens da loja / leituras
  anchor?: string;                   // Frase-Âncora (PNL)
  bestStreak: number;                // maior ofensiva (Mural de Honra)
  league: { tier: number; week: string; last?: { from: number; to: number; pos: number } };
  daily: { day: string; picked: string[]; c: Record<string, number>; claimed: string[] };
  chests: string[];                  // Arcas de Talentos já abertas
  vault: string;                     // dia do último Cofre Diário resgatado
  goal: number;                      // meta diária de lições (definida pelos pais)
  asr: boolean;                      // microfone / reconhecimento de fala liberado
}

export interface AppState {
  version: 1;
  activeProfileId: string;
  profiles: Profile[];
  parentPin: string | null;
}
