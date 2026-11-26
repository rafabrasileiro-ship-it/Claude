import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { fs } from '../theme';

/** Os 6 estados emocionais do Tio Bento (águia-real mentora). */
export type BentoMood = 'orgulhoso' | 'incentivador' | 'pensativo' | 'alerta' | 'celebracao' | 'saudacao';
const BADGE: Record<BentoMood, string> = { orgulhoso: '⭐', incentivador: '👍', pensativo: '💭', alerta: '❗', celebracao: '🎉', saudacao: '🎖️' };
const LABEL: Record<BentoMood, string> = {
  orgulhoso: 'Tio Bento, orgulhoso', incentivador: 'Tio Bento, incentivando', pensativo: 'Tio Bento, pensativo',
  alerta: 'Tio Bento, em alerta de foco', celebracao: 'Tio Bento, celebrando', saudacao: 'Tio Bento, saudando com respeito',
};
const IMG = require('../../assets/bento.png');

/** Mascote animado (substitui as animações Lottie do handoff por animações nativas, sem dependências extras). */
export default function Bento({ mood = 'orgulhoso', size = 96 }: { mood?: BentoMood; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const t = (to: number, duration: number, easing = Easing.inOut(Easing.quad)) => Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });
    const anims: Record<BentoMood, Animated.CompositeAnimation> = {
      orgulhoso: Animated.loop(Animated.sequence([t(1, 900), t(0, 900)])),
      incentivador: Animated.loop(Animated.sequence([t(1, 260), t(0, 260), t(1, 260), t(0, 260), Animated.delay(900)])),
      pensativo: Animated.loop(Animated.sequence([t(1, 1400), t(-1, 1400)])),
      alerta: Animated.sequence([t(1, 70), t(-1, 70), t(1, 70), t(-1, 70), t(0, 70)]),
      celebracao: Animated.loop(Animated.sequence([t(1, 320, Easing.out(Easing.quad)), t(0, 320, Easing.in(Easing.quad)), Animated.delay(250)])),
      saudacao: Animated.sequence([t(1, 450), Animated.delay(400), t(0, 450)]),
    };
    const a = anims[mood];
    a.start();
    return () => a.stop();
  }, [mood]);

  const transform =
    mood === 'orgulhoso' ? [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }]
    : mood === 'incentivador' ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }]
    : mood === 'pensativo' ? [{ rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) }]
    : mood === 'alerta' ? [{ translateX: v.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }]
    : mood === 'celebracao' ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] }) }]
    : [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] }) }];

  return (
    <View style={{ width: size * 1.1, height: size * 1.1, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={LABEL[mood]}>
      <Animated.View style={{ transform }}>
        <Image source={IMG} style={{ width: size * 0.965, height: size }} resizeMode="contain" />
      </Animated.View>
      <View style={[s.badge, { right: 0, top: 0 }]}><Text style={{ fontSize: fs(Math.max(12, size / 7)) }}>{BADGE[mood]}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { position: 'absolute', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#DCE1E7' },
});
