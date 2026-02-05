import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface SuccessAnimationProps {
  size?: number;
  color?: string;
  backgroundColor?: string;
}

const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  size = 80,
  color = '#FFFFFF',
  backgroundColor = '#4CAF50'
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Circle scale animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      // Checkmark draw animation
      Animated.timing(checkmarkAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, checkmarkAnim]);

  const circleScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkmarkScale = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: backgroundColor,
            borderWidth: 0,
            transform: [{ scale: circleScale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.checkmarkContainer,
            {
              transform: [{ scale: checkmarkScale }],
            },
          ]}
        >
          <View style={[styles.checkmark, { borderColor: color }]}>
            <View style={[styles.checkmarkStem, { backgroundColor: color }]} />
            <View style={[styles.checkmarkKick, { backgroundColor: color }]} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    width: '60%',
    height: '60%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  checkmarkStem: {
    position: 'absolute',
    width: 4,
    height: '70%',
    bottom: 0,
    right: '35%',
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  checkmarkKick: {
    position: 'absolute',
    width: '45%',
    height: 4,
    bottom: '20%',
    left: 0,
    transform: [{ rotate: '-45deg' }],
    borderRadius: 2,
  },
});

export default SuccessAnimation;
