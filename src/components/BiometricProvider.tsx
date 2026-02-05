import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View, StyleSheet, Modal, Text, TouchableOpacity } from 'react-native';
import BiometricService from '../services/biometricService';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const appState = useRef(AppState.currentState);
    const [isLocked, setIsLocked] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        const initBiometrics = async () => {
            const isEnabled = await BiometricService.isEnabled();
            if (isEnabled) {
                console.log('[BiometricProvider] Cold start, locking wallet');
                setIsLocked(true);
                authenticate();
            }
        };

        initBiometrics();

        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            const isEnabled = await BiometricService.isEnabled();

            if (!isEnabled) {
                return;
            }

            // If app is coming to foreground
            if (
                (appState.current === 'background' || appState.current === 'inactive') &&
                nextAppState === 'active'
            ) {
                console.log('[BiometricProvider] App coming to foreground, locking wallet');
                setIsLocked(true);
                authenticate();
            }

            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    const authenticate = async () => {
        if (isAuthenticating) return;

        setIsAuthenticating(true);
        const success = await BiometricService.authenticate('Unlock your wallet');

        if (success) {
            setIsLocked(false);
        }
        setIsAuthenticating(false);
    };

    return (
        <>
            {children}
            <Modal
                visible={isLocked}
                transparent={false}
                animationType="fade"
            >
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="lock-closed" size={80} color={colors.black} />
                        </View>
                        <Text style={styles.title}>Wallet Locked</Text>
                        <Text style={styles.subtitle}>Authentication required to access your wallet</Text>

                        <TouchableOpacity style={styles.unlockButton} onPress={authenticate}>
                            <Ionicons name="finger-print" size={24} color={colors.white} style={styles.buttonIcon} />
                            <Text style={styles.unlockButtonText}>Unlock Wallet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        elevation: 4,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: colors.gray,
        textAlign: 'center',
        marginBottom: 48,
        lineHeight: 24,
    },
    unlockButton: {
        flexDirection: 'row',
        backgroundColor: colors.black,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 2,
    },
    buttonIcon: {
        marginRight: 12,
    },
    unlockButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: '600',
    },
});
