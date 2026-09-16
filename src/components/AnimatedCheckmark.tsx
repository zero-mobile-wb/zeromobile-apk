/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface AnimatedCheckmarkProps {
  size?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({ size = 80 }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Circle scale animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Checkmark draw animation
      Animated.timing(checkAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Green Circle */}
          <AnimatedCircle
            cx="50"
            cy="50"
            r="45"
            fill="#4CAF50"
            stroke="none"
          />

          {/* White Checkmark */}
          <AnimatedPath
            d="M 25 50 L 40 65 L 75 30"
            stroke="#FFFFFF"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="100"
            strokeDashoffset={checkAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0],
            })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AnimatedCheckmark;
