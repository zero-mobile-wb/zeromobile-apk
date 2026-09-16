import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View, StyleSheet, Modal, Text, TouchableOpacity, Image } from 'react-native';
import BiometricService from '../services/biometricService';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentTheme } = useTheme();
    const { isWalletConfirmed } = useWallet();
    const isWalletConfirmedRef = useRef(isWalletConfirmed);
    const appState = useRef(AppState.currentState);
    const [isLocked, setIsLocked] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        isWalletConfirmedRef.current = isWalletConfirmed;
    }, [isWalletConfirmed]);

    useEffect(() => {
        const initBiometrics = async () => {
            const isEnabled = await BiometricService.isEnabled();
            if (isEnabled && isWalletConfirmedRef.current) {
                console.log('[BiometricProvider] Cold start, locking wallet');
                setIsLocked(true);
                authenticate();
            }
        };

        initBiometrics();

        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            const isEnabled = await BiometricService.isEnabled();

            if (!isEnabled || !isWalletConfirmedRef.current) {
                appState.current = nextAppState;
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
                <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
                    <View style={styles.content}>
                        <TouchableOpacity style={styles.imageButton} onPress={authenticate}>
                            <Image
                                source={require('../../assets/images/zero-logo.png')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
        marginBottom: 80, // Pushes the image up from absolute center
    },
    imageButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    logoImage: {
        width: 150,
        height: 150,
        borderRadius: 24,
        overflow: 'hidden',
    },
});

export default BiometricProvider;
