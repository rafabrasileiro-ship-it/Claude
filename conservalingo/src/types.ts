export type Sex = 'M' | 'F';

export interface VocabItem { en: string; pt: string }
export interface DialogueLine { who: string; en: string; pt: string }
export interface Lesson { id: string; title: string; vocab: VocabItem[]; dialogue: DialogueLine[] }
export interface Unit {
  level?: number;
  id: string; title: string; icon: string; cast: string[]; topics: string; lessons: Lesson[];
}

export type ExerciseKind = 'choose' | 'listen' | 'bank_en' | 'bank_pt' | 'speak' | 'dictation' | 'roleplay';
export interface Exercise {
  id: string;            // chave SRS (ex.: "u1l1:v:Sir" ou "u1l1:d:2")
  kind: ExerciseKind;
  prompt: string;        // instrução curta em PT
  question: string;      // texto exibido (ou frase de áudio)
  speak?: string;        // texto em inglês a ser falado (clipe pré-gravado)
  voice?: 'M' | 'F';     // voz do falante (masculina/feminina)
  options?: string[];    // 'choose' / 'listen'
  bank?: string[];       // palavras embaralhadas (inclui distratores)
  answer: string;        // resposta correta
  hint?: string;
  accept?: string[];     // 'roleplay': respostas aceitas
  explain?: string;      // "Ajuste de Rota": explicação gramatical/fonética
}

export interface SrsCard { ease: number; interval: number; due: number; reps: number }

export interface Profile {
  id: string; name: string; isChild: boolean; sex: Sex; age?: number;
  streak: { count: number; last: string | null };
  talents: number;
  shields: { count: number; updatedAt: number };
  xp: number;
  weekXp: { week: string; xp: number };
  completed: Record<string, number>; // lessonId -> estrelas (1..3)
  srs: Record<string, SrsCard>;
  unlocked: string[];                // itens da loja / leituras
  anchor?: string;                   // Frase-Âncora (PNL)
  bestStreak: number;                // maior ofensiva (Mural de Honra)
  league: { tier: number; week: string; last?: { from: number; to: number; pos: number } };
  daily: { day: string; picked: string[]; c: Record<string, number>; claimed: string[] };
  chests: string[];                  // Arcas de Talentos já abertas
}

export interface AppState {
  version: 1;
  activeProfileId: string;
  profiles: Profile[];
  parentPin: string | null;
}
