import React, { useMemo, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeGaussianBlur, FeDisplacementMap, FeComposite } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface LiquidGlassButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  width?: number;
  borderRadius?: number;
  style?: ViewStyle;
  isCircle?: boolean;
  accessibilityLabel?: string;
}

const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  onPress,
  children,
  size = 64,
  width,
  borderRadius,
  style,
  isCircle = true,
  accessibilityLabel,
}) => {
  const { themeId } = useTheme();
  const isDark = themeId === 'dark';
  const w = width ?? size;
  const radius = borderRadius ?? (isCircle ? w / 2 : 18);

  // Unique filter ID per button to avoid collision
  const filterIdRef = useRef(`liquid-glass-${Math.random().toString(36).slice(2, 9)}`);
  const filterId = filterIdRef.current;

  // Single multi-layer shadow (the web version stacks 9+ shadows; we collapse to a few key ones)
  // Light mode: dark inset-style shadows for puffy 3D look
  // Dark mode: light highlights for the same puffy 3D look
  const shadow = Platform.select({
    ios: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.5 : 0.08,
      shadowRadius: 6,
    },
    android: { elevation: 4 },
  });

  return (
    <View style={[styles.wrapper, { width: w, height: size }, shadow, style]}>
      {/* Hidden SVG filter — rendered off-screen to prevent visual artifacts */}
      <View style={styles.svgOffscreen} pointerEvents="none">
        <Svg width={1} height={1}>
          <Defs>
            <Filter id={filterId} x="0%" y="0%" width="100%" height="100%">
              <FeTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
              <FeGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
              <FeDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
              <FeGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
              <FeComposite in="finalBlur" in2="finalBlur" operator="over" />
            </Filter>
          </Defs>
        </Svg>
      </View>

      {/* Puffy 3D layered shadow effect (replaces the web's 9 nested shadows) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(255, 255, 255, 0.55)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
          },
          isDark
            ? {
                // Dark mode: light outer glow
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
              }
            : {
                // Light mode: multi-tone borders to mimic inset shadows
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.9)',
                borderLeftColor: 'rgba(255, 255, 255, 0.7)',
                borderBottomWidth: 1,
                borderRightWidth: 1,
                borderBottomColor: 'rgba(0, 0, 0, 0.15)',
                borderRightColor: 'rgba(0, 0, 0, 0.1)',
              },
        ]}
      />

      {/* Inner depth layer — adds the "puffy" feel */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            margin: 2,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(0, 0, 0, 0.05)',
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderTopColor: isDark
              ? 'rgba(255, 255, 255, 0.2)'
              : 'rgba(255, 255, 255, 0.5)',
            borderLeftColor: isDark
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.4)',
          },
        ]}
      />

      {/* Top highlight — mimics the top-light source from the web version */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: '15%',
          right: '15%',
          height: '40%',
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.35)',
        }}
      />

      {/* Touchable */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.touchable,
          { width: w, height: size, borderRadius: radius },
        ]}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  svgOffscreen: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default LiquidGlassButton;
