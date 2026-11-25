import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { colors, fonts, radius, space, fs } from '../theme';

export function Btn({ title, onPress, kind = 'primary', disabled, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'gold' | 'ghost' | 'danger'; disabled?: boolean; style?: ViewStyle;
}) {
  const bg = kind === 'primary' ? colors.navy : kind === 'gold' ? colors.gold : kind === 'danger' ? colors.crimson : 'transparent';
  const fg = kind === 'ghost' ? colors.navy : '#fff';
  return (
    <Pressable
      accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, borderWidth: kind === 'ghost' ? 1.5 : 0, borderColor: colors.navy }, style]}
    >
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function P({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.p, style]}>{children}</Text>;
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.olive }: { value: number; color?: string }) {
  return (
    <View style={s.barBg}>
      <View style={[s.barFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 18, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center' },
  btnText: { fontFamily: fonts.sansBold, fontSize: fs(16), letterSpacing: 0.3 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.line },
  h1: { fontFamily: fonts.serif, fontSize: fs(22), color: colors.navy },
  p: { fontFamily: fonts.sans, fontSize: fs(15), color: colors.ink, lineHeight: 22 },
  stat: { alignItems: "center", flex: 1, paddingHorizontal: 2 },
  statVal: { fontFamily: fonts.sansBold, fontSize: fs(18) },
  statLabel: { fontFamily: fonts.sans, fontSize: fs(11), color: colors.muted },
  barBg: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
});
