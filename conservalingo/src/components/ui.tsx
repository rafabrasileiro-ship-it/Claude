import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';

type Kind = 'primary' | 'gold' | 'ghost' | 'danger' | 'success';
const SHADES: Record<Kind, { bg: string; edge: string; fg: string }> = {
  primary: { bg: colors.navy, edge: '#0F2142', fg: '#fff' },
  gold: { bg: colors.gold, edge: '#8F6C12', fg: '#fff' },
  danger: { bg: colors.crimson, edge: '#5E1823', fg: '#fff' },
  success: { bg: colors.olive, edge: '#1B3A21', fg: '#fff' },
  ghost: { bg: '#fff', edge: colors.line, fg: colors.navy },
};

/** Botão "tátil": borda inferior grossa que afunda ao toque. */
export function Btn({ title, onPress, kind = 'primary', disabled, style }: {
  title: string; onPress: () => void; kind?: Kind; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = disabled ? { bg: '#D8D4C6', edge: '#BDB8A6', fg: '#8A8574' } : SHADES[kind];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <View style={[s.btn, { backgroundColor: c.bg, borderBottomColor: c.edge, borderColor: kind === 'ghost' ? colors.line : c.bg }, pressed && { borderBottomWidth: 2, marginTop: 3, marginBottom: -3 }, style]}>
          <Text style={[s.btnText, { color: c.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function P({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.p, style]}>{children}</Text>;
}

/** Pílula de status do topo (ícone + valor). */
export function Chip({ icon, value, color, label }: { icon: string; value: string | number; color: string; label: string }) {
  return (
    <View style={s.chip} accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ fontSize: fs(18) }}>{icon}</Text>
      <Text style={[s.chipVal, { color }]}>{value}</Text>
    </View>
  );
}
export function Stat({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <View style={s.stat} accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ fontSize: fs(18) }}>{icon}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export function Avatar({ emoji, color, size = 52 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff55' }}>
      <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.olive, height = 16 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.line, overflow: 'hidden' }}>
      <View style={{ height, borderRadius: height / 2, width: `${Math.max(0.04, Math.min(1, value)) * 100}%`, backgroundColor: color }}>
        <View style={{ height: height / 4, marginTop: height / 5, marginHorizontal: height / 2, borderRadius: height, backgroundColor: '#ffffff55' }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 15, paddingHorizontal: space.lg, borderRadius: radius.lg, alignItems: 'center', borderWidth: 2, borderBottomWidth: 5 },
  btnText: { fontFamily: fonts.sansBold, fontSize: fs(15), letterSpacing: 0.8, textTransform: 'uppercase' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, borderWidth: 2, borderColor: colors.line, borderBottomWidth: 4 },
  h1: { fontFamily: fonts.serif, fontSize: fs(22), color: colors.navy },
  p: { fontFamily: fonts.sans, fontSize: fs(15), color: colors.ink, lineHeight: fs(15) * 1.45 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#ffffff22' },
  chipVal: { fontFamily: fonts.sansBold, fontSize: fs(16) },
  stat: { alignItems: 'center', flex: 1, paddingHorizontal: 2 },
  statVal: { fontFamily: fonts.sansBold, fontSize: fs(18) },
  statLabel: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
});
