/** Destino de uma sessão de estudo. */
export type LessonRef = { kind: 'lesson'; levelId: string; slot: number } | { kind: 'practice' } | { kind: 'phon' };
