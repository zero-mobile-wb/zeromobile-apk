import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface GlassmorphismButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

// Octagon points - 8-sided polygon
// Normalized to a coordinate system where the shape fits in a box
const getOctagonPoints = (size: number) => {
  // For a regular octagon inscribed in a square
  const inset = Math.round(size * 0.29); // How far in from corners
  const points = [
    `${inset},0`,
    `${size - inset},0`,
    `${size},${inset}`,
    `${size},${size - inset}`,
    `${size - inset},${size}`,
    `${inset},${size}`,
    `0,${size - inset}`,
    `0,${inset}`,
  ];
  return points.join(' ');
};

const GlassmorphismButton: React.FC<GlassmorphismButtonProps> = ({
  onPress,
  children,
  size = 64,
  style,
  accessibilityLabel,
}) => {
  const { themeId } = useTheme();
  const isDark = themeId === 'dark';
  const octagonPoints = getOctagonPoints(size);

  const shadow = Platform.select({
    ios: {
      shadowColor: isDark ? '#000' : '#666',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.6 : 0.2,
      shadowRadius: 6,
    },
    android: { elevation: 5 },
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }, shadow, style]}>
      {/* Glass blur with SVG octagon clip */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Polygon points={octagonPoints} fill="transparent" />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.clipContainer]}>
          <BlurView
            intensity={60}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      {/* Octagon border */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
      >
        <Polygon
          points={octagonPoints}
          fill="transparent"
          stroke={isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.5)'}
          strokeWidth={1.5}
        />
      </Svg>

      {/* Touchable area */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel}
        style={[styles.touchable, { width: size, height: size }]}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default GlassmorphismButton;
