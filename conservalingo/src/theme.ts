// Heritage & Classic UI — paleta oficial do handoff.
export const colors = {
  navy: '#1B365D',
  gold: '#C59B27',
  olive: '#2E5A36',
  ivory: '#F9F7F2',
  crimson: '#8B2635',
  ink: '#1F2430',
  muted: '#6B7280',
  line: '#E3DECF',
  card: '#FFFFFF',
  navySoft: '#E8ECF3',
  oliveSoft: '#E4EEE6',
  crimsonSoft: '#F4E4E7',
  goldSoft: '#F6EDD3',
} as const;

export const fonts = {
  serif: 'Merriweather_700Bold',
  serifRegular: 'Merriweather_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold: 'Inter_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 18 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

// Escala tipográfica para leitura confortável em telas de ~6" (+30%, mínimo 14).
export const FONT_SCALE = 1.3;
export const fs = (n: number) => Math.max(14, Math.round(n * FONT_SCALE));
