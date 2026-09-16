import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

interface EqualizerLoaderProps {
    visible: boolean;
}

const EqualizerLoader: React.FC<EqualizerLoaderProps> = ({ visible }) => {
    const { currentTheme } = useTheme();
    // Animation refs for 4 bars
    const anim1 = useRef(new Animated.Value(0)).current;
    const anim2 = useRef(new Animated.Value(0)).current;
    const anim3 = useRef(new Animated.Value(0)).current;
    const anim4 = useRef(new Animated.Value(0)).current;

    const createAnimation = (value: Animated.Value, duration: number, delay: number) => {
        return Animated.loop(
            Animated.sequence([
                Animated.timing(value, {
                    toValue: 1,
                    duration: duration,
                    delay: delay,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(value, {
                    toValue: 0,
                    duration: duration,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
    };

    useEffect(() => {
        if (visible) {
            const animations = [
                createAnimation(anim1, 400, 0),
                createAnimation(anim2, 500, 100),
                createAnimation(anim3, 450, 50),
                createAnimation(anim4, 550, 150),
            ];
            animations.forEach(anim => anim.start());

            return () => animations.forEach(anim => anim.stop());
        }
    }, [visible]);

    const getBarStyle = (animValue: Animated.Value) => ({
        transform: [{
            scaleY: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1.5],
            })
        }],
    });

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View style={styles.container}>
                <BlurView intensity={20} tint={currentTheme.id === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

                <View style={[
                    styles.loaderSquare,
                    currentTheme.id === 'dark' && { shadowColor: 'transparent', elevation: 0 }
                ]}>
                    <View style={styles.equalizerContainer}>
                        <Animated.View style={[styles.bar, getBarStyle(anim1)]} />
                        <Animated.View style={[styles.bar, getBarStyle(anim2)]} />
                        <Animated.View style={[styles.bar, getBarStyle(anim3)]} />
                        <Animated.View style={[styles.bar, getBarStyle(anim4)]} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderSquare: {
        width: 60,
        height: 60,
        backgroundColor: '#000',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    equalizerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        gap: 3,
    },
    bar: {
        width: 3,
        height: 12, // Base height, scaling handles the rest
        backgroundColor: '#FFF',
        borderRadius: 2,
    },
});

export default EqualizerLoader;
