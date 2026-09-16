import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { spendTheme } from '../constants/spendTheme';
import { spendApi } from '../services/api';
import { useSpendAuth } from './SpendAuthContext';

interface TwoFactorContextValue {
    authorize: (reason?: string) => Promise<string | null>;
}

const TwoFactorContext = createContext<TwoFactorContextValue>({
    authorize: async () => null,
});

export const useTwoFactor = () => useContext(TwoFactorContext);

export const TwoFactorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useSpendAuth();
    const [visible, setVisible] = useState(false);
    const [pin, setPin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState('Confirm this transaction');
    const resolveRef = useRef<((token: string | null) => void) | null>(null);

    const close = useCallback((token: string | null) => {
        setVisible(false);
        setPin('');
        setError(null);
        setSubmitting(false);
        const resolve = resolveRef.current;
        resolveRef.current = null;
        if (resolve) resolve(token);
    }, []);

    const tryBiometric = useCallback(async (token: string): Promise<string | null> => {
        try {
            const hardware = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!hardware || !enrolled) return null;
            const res = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                disableDeviceFallback: true,
                cancelLabel: 'Use PIN instead',
            });
            if (!res.success) return null;
            const auth = await spendApi.authorize2FA(token, 'passkey');
            return auth.twoFactorToken;
        } catch {
            return null;
        }
    }, [reason]);

    const authorize = useCallback(
        async (reasonText?: string): Promise<string | null> => {
            const token = session?.token;
            const user = session?.user;
            if (!token || !user) {
                Alert.alert('Not signed in', 'Please sign in to ZeroSpend first.');
                return null;
            }

            const t = user.twoFactor;
            if (!t?.pinSet && !t?.passkeySet) {
                Alert.alert(
                    'Transaction security not set up',
                    'Set a 4-digit PIN or enable Passkey in Settings before making a transaction.'
                );
                return null;
            }

            if (reasonText) setReason(reasonText);

            // Passkey is the default method when enabled.
            if (t?.passkeySet) {
                const token2fa = await tryBiometric(token);
                if (token2fa) return token2fa;
            }

            // Fall back to the PIN modal.
            return new Promise<string | null>(resolve => {
                resolveRef.current = resolve;
                setPin('');
                setError(null);
                setVisible(true);
            });
        },
        [session, tryBiometric]
    );

    const submitPin = useCallback(async () => {
        const token = session?.token;
        if (!token || pin.length !== 4) {
            setError('Enter your 4-digit PIN');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const auth = await spendApi.authorize2FA(token, 'pin', pin);
            close(auth.twoFactorToken);
        } catch (e: any) {
            setError(e?.message || 'Incorrect PIN');
            setSubmitting(false);
        }
    }, [session, pin, close]);

    return (
        <TwoFactorContext.Provider value={{ authorize }}>
            {children}
            <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(null)}>
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.card}>
                        <View style={styles.lock}>
                            <Text style={styles.lockText}>🔒</Text>
                        </View>
                        <Text style={styles.title}>Two-factor confirmation</Text>
                        <Text style={styles.subtitle}>{reason}</Text>

                        <TextInput
                            value={pin}
                            onChangeText={text => {
                                setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
                                setError(null);
                            }}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={4}
                            autoFocus
                            placeholder="••••"
                            placeholderTextColor="rgba(31,95,92,0.35)"
                            style={styles.pinInput}
                        />

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <TouchableOpacity style={styles.confirm} onPress={submitPin} disabled={submitting} activeOpacity={0.8}>
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.confirmText}>Confirm</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancel} onPress={() => close(null)} activeOpacity={0.7}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </TwoFactorContext.Provider>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    lock: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: spendTheme.btnGreen,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    lockText: { fontSize: 24 },
    title: { fontFamily: spendTheme.font, fontSize: 22, color: '#111827', textAlign: 'center' },
    subtitle: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
        lineHeight: 18,
    },
    pinInput: {
        width: '100%',
        height: 56,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: spendTheme.btnGreen,
        textAlign: 'center',
        fontSize: 28,
        letterSpacing: 18,
        color: spendTheme.btnGreen,
        fontFamily: spendTheme.font,
    },
    error: { color: '#DC2626', fontFamily: spendTheme.font, fontSize: 13, marginTop: 12 },
    confirm: {
        width: '100%',
        height: 52,
        borderRadius: 14,
        backgroundColor: spendTheme.btnGreen,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    confirmText: { color: '#FFFFFF', fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700' },
    cancel: { marginTop: 14, padding: 6 },
    cancelText: { color: '#9CA3AF', fontFamily: spendTheme.font, fontSize: 14 },
});

export default TwoFactorProvider;