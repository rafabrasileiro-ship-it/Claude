import { people, headOf } from './content';
import { hash } from './game';

export const ANCHORS = ['Educar melhor meus filhos', 'Honrar minha família', 'Crescer profissionalmente', 'Servir bem à minha pátria'];

export const REFRAME = 'Ajuste de Rota: grandes construtores corrigem a fundação antes de subir as paredes.';

const IDENTITY = [
  'Você é o tipo de pessoa disciplinada que honra seus compromissos e constrói seu legado dia após dia.',
  'Quem estuda todos os dias, como você, constrói com as próprias mãos o futuro da sua família.',
  'Você é alguém que termina o que começa. É assim que se forma o caráter.',
  'Pessoas firmes como você transformam pequenos passos em grandes conquistas.',
];
export const identityLine = (seed: number) => IDENTITY[Math.abs(seed) % IDENTITY.length];

const PRESUP = [
  'Quando você concluir seus 3 minutos de amanhã, o inglês já vai soar mais natural aos seus ouvidos.',
  'Quando você completar a próxima lição, vai perceber o quanto já avançou.',
  'Depois do seu próximo passo na trilha, o que hoje parece difícil será parte do seu hábito.',
];
export const presupposition = (seed: number) => PRESUP[Math.abs(seed) % PRESUP.length];

// Rapport: cada protagonista valida o aluno do seu jeito.
const PRAISE: Record<string, string> = {
  ayrton: 'Que precisão, e que pontualidade! Assim se constrói o domínio de um idioma.',
  beto: 'Muito bem contado! Quem aprende com bom humor nunca esquece.',
  jose: 'Você enxergou o valor do que aprendeu. Isso é visão de quem constrói.',
  alice: 'Firmeza de princípios e disciplina no estudo. Seu esforço honra a sua palavra.',
  maria: 'Que bela hospitalidade com as palavras! Você já sabe receber o inglês em casa.',
  flavia: 'Trabalho duro gera riqueza, e você acaba de plantar mais uma semente.',
};
export function praise(castFirst: string, name: string) {
  const head = headOf[castFirst] ?? castFirst;
  const who = people[castFirst]?.name ?? 'Tio Bento';
  return { who, emoji: people[castFirst]?.emoji ?? '🦅', text: `${who}: “${name}, ${(PRAISE[head] ?? PRAISE.ayrton).replace(/^./, (c) => c.toLowerCase())}”` };
}

/** Ensaio Mental Futuro (≈10 s): os passos do nível + a Frase-Âncora do aluno. */
export function futurePacing(levelLines: string[], anchor?: string) {
  const base = levelLines.length ? levelLines : [
    'Feche os olhos por um instante e respire fundo.',
    'Imagine-se daqui a um ano, falando inglês com segurança.',
    'Sinta a voz firme, o sorriso tranquilo e a confiança de quem se preparou.',
  ];
  return [...base, anchor ? `E lembre-se do motivo que move você: “${anchor}”.` : 'Veja o que isso muda na sua vida e na da sua família.'];
}
export const seedOf = (s: string) => hash(s);
