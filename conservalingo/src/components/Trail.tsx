import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fs } from '../theme';

export const NODE = 64; // nós circulares de 64dp (handoff v4)
export const OFFSETS = [0, 48, 72, 48, 0, -48, -72, -48];

export type NodeState = 'locked' | 'current' | 'done' | 'planned';

/**
 * Segmento da trilha dourada entre o nó da linha anterior e o nó desta linha.
 * fromX/toX: deslocamento horizontal dos nós a partir do centro; gap: distância vertical entre os centros;
 * centerY: altura do centro do nó nesta linha. O traço para antes dos círculos para não sobrepô-los.
 */
export function Connector({ fromX, toX, gap, centerY, faded }: { fromX: number; toX: number; gap: number; centerY: number; faded?: boolean }) {
  const dx = toX - fromX;
  const len = Math.max(0, Math.hypot(dx, gap) - NODE - 8);
  const angle = -Math.atan2(dx, gap);
  const xMid = (fromX + toX) / 2; const yMid = centerY - gap / 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', marginLeft: xMid - 3, top: yMid - len / 2, width: 6, height: len,
      borderRadius: 3, backgroundColor: faded ? '#E6DCC0' : colors.gold, transform: [{ rotate: `${angle}rad` }] }} />
  );
}

function Bounce({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: -6, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v }] }}>{children}</Animated.View>;
}

export function TrailNode({ icon, state, gold, onPress, label, startText = 'COMEÇAR' }: {
  icon: string; state: NodeState; gold?: boolean; onPress?: () => void; label: string; startText?: string;
}) {
  const bg = state === 'locked' || state === 'planned' ? '#D8D4C6' : gold ? colors.gold : state === 'done' ? colors.olive : colors.cobalt;
  const edge = state === 'locked' || state === 'planned' ? '#BDB8A6' : gold ? '#8A6508' : state === 'done' ? '#134226' : '#142C52';
  return (
    <View style={{ alignItems: 'center' }}>
      {state === 'current' && (
        <View style={s.startWrap} pointerEvents="none">
          <Bounce>
            <View style={s.start}><Text style={s.startText}>{startText}</Text></View>
            <View style={s.startArrow} />
          </Bounce>
        </View>
      )}
      <Pressable disabled={state === 'locked' || state === 'planned' || !onPress} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
        accessibilityState={{ disabled: state === 'locked' || state === 'planned' }}>
        {({ pressed }) => (
          <View style={[s.node, { backgroundColor: bg, borderBottomColor: edge }, state === 'planned' && s.planned, pressed && { borderBottomWidth: 2, marginTop: 4 }]}>
            <Text style={{ fontSize: fs(22), color: '#fff', fontFamily: fonts.sansBold }}>{state === 'locked' ? '🔒' : icon}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6 },
  planned: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#BDB8A6', backgroundColor: '#EEEAE0' },
  startWrap: { position: 'absolute', bottom: NODE + 6, alignItems: 'center', zIndex: 5, width: 200 },
  start: { backgroundColor: '#fff', borderWidth: 2, borderColor: colors.line, borderBottomWidth: 4, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12 },
  startText: { color: colors.navy, fontFamily: fonts.sansBold, fontSize: fs(12), letterSpacing: 1 },
  startArrow: { alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.line },
});
