import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastProps {
    visible: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
    onHide: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({
    visible,
    message,
    type = 'info',
    onHide,
    duration = 4000
}) => {
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.spring(animation, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7,
                }),
                Animated.delay(duration),
                Animated.timing(animation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onHide();
            });
        }
    }, [visible, duration, animation, onHide]);

    if (!visible) return null;

    const getIconConfig = () => {
        switch (type) {
            case 'success': return { name: 'checkmark-circle', color: '#10B981' } as const;
            case 'error': return { name: 'close-circle', color: '#EF4444' } as const;
            default: return { name: 'information-circle', color: '#3B82F6' } as const;
        }
    };

    const translateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 0],
    });

    const scale = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
    });

    const iconConfig = getIconConfig();

    return (
        <View style={styles.wrapper}>
            <Animated.View style={[styles.content, { opacity: animation, transform: [{ translateY }, { scale }] }]}>
                <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} style={styles.icon} />
                <Text style={styles.message}>{message}</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        right: 20,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center', 
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: '100%',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    icon: {
        marginRight: 10,
    },
    message: {
        color: '#1F2937',
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1,
        lineHeight: 18,
    },
});

export default Toast;
