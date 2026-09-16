import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface LiquidGlassChainButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderRadius?: number;
}

const LiquidGlassChainButton: React.FC<LiquidGlassChainButtonProps> = ({
  onPress,
  children,
  style,
  paddingHorizontal = 18,
  paddingVertical = 12,
  borderRadius = 24,
}) => {
  const { themeId } = useTheme();
  const isDark = themeId === 'dark';

  const shadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
  });

  return (
    <View
      style={[
        styles.wrapper,
        { borderRadius, paddingHorizontal, paddingVertical },
        shadow,
        style,
      ]}
    >
      {/* Outer puffy border */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(255, 255, 255, 0.55)',
          },
          isDark
            ? {
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
              }
            : {
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

      {/* Inner depth layer — adds the puffy 3D look matching the action buttons */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            margin: 2,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.25)',
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

      {/* Top highlight — light source from top */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '38%',
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.35)',
        }}
      />

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
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
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
});

export default LiquidGlassChainButton;
