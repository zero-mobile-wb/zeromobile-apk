import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Lock'>;
}

// Shown on cold start when an account already exists on this device (local
// keys or a Privy session) — instead of the Get Started screen. Just the
// logo and the wallet address; biometrics fire automatically and tapping the
// logo retries. Local keys are only derived from SecureStore after unlock.
const LockScreen: React.FC<Props> = ({ navigation }) => {
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const { wallets, activeWalletId, activeSolanaAddress, isPrivyUser, unlockWallet } = useWallet();

    const [checking, setChecking] = useState(true);
    const [settled, setSettled] = useState(false);
    const [biometricOk, setBiometricOk] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const busyRef = useRef(false);

    const hasKeys = wallets.length > 0;

    useEffect(() => {
        (async () => {
            try {
                const hw = await LocalAuthentication.hasHardwareAsync();
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                setBiometricOk(!!(hw && enrolled));
            } catch {
                setBiometricOk(false);
            } finally {
                setChecking(false);
            }
        })();
    }, []);

    // Account state arrives async (wallet index + Privy session) — wait for
    // either a detected account or a short timeout before deciding anything.
    useEffect(() => {
        if (hasKeys || isPrivyUser) {
            setSettled(true);
            return;
        }
        const t = setTimeout(() => setSettled(true), 1200);
        return () => clearTimeout(t);
    }, [hasKeys, isPrivyUser]);

    const address = isPrivyUser
        ? activeSolanaAddress
        : wallets.find(w => w.id === activeWalletId)?.address || wallets[0]?.address;
    const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

    const goWallet = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Wallet' }] });
    }, [navigation]);

    const tryUnlock = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setError(null);
        try {
            if (biometricOk) {
                try {
                    const res = await LocalAuthentication.authenticateAsync({
                        promptMessage: 'Unlock Zeroo',
                        fallbackLabel: 'Use passcode',
                        cancelLabel: 'Cancel',
                    });
                    if (!res.success) return; // user cancelled — stay on lock
                } catch {
                    setError('Authentication failed. Tap the logo to retry.');
                    return;
                }
            }
            setUnlocking(true);
            try {
                if (!isPrivyUser) {
                    const ok = await unlockWallet();
                    if (!ok) {
                        setError('Could not unlock wallet. Tap the logo to retry.');
                        return;
                    }
                }
                goWallet();
            } finally {
                setUnlocking(false);
            }
        } finally {
            busyRef.current = false;
        }
    }, [biometricOk, isPrivyUser, unlockWallet, goWallet]);

    // Fire biometrics whenever this screen gains focus and an account is
    // known — covers cold start AND returning from background without ever
    // remounting (no blank flash, no double prompt thanks to the busy guard).
    useFocusEffect(
        useCallback(() => {
            if (!checking && settled && (hasKeys || isPrivyUser)) {
                tryUnlock();
            }
        }, [checking, settled, hasKeys, isPrivyUser, tryUnlock])
    );

    // Safety net: nothing to unlock → back to onboarding.
    useEffect(() => {
        if (!checking && settled && !hasKeys && !isPrivyUser) {
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        }
    }, [checking, settled, hasKeys, isPrivyUser, navigation]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <View style={styles.topGradient} pointerEvents="none">
                <LinearGradient
                    colors={[currentTheme.gradientStart, 'transparent']}
                    style={{ flex: 1 }}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>
            <View style={styles.content}>
                <TouchableOpacity onPress={tryUnlock} activeOpacity={0.9} disabled={unlocking}>
                    <Image
                        source={require('../../assets/images/zero-logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
                {!!truncated && (
                    <View style={[styles.addrPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                        <Text style={[styles.addrText, { color: currentTheme.textLight }]}>{truncated}</Text>
                    </View>
                )}
                {unlocking && <ActivityIndicator color={currentTheme.textLight} style={styles.spinner} />}
                {!!error && !unlocking && <Text style={styles.error}>{error}</Text>}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, opacity: 0.3, zIndex: 0 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    logo: {
        width: 120,
        height: 120,
        borderRadius: 28,
        marginBottom: 20,
    },
    addrPill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    addrText: { fontSize: 14, fontFamily: 'monospace' },
    spinner: { marginTop: 20 },
    error: { fontSize: 13, color: '#EF4444', marginTop: 16, textAlign: 'center' },
});

export default LockScreen;
