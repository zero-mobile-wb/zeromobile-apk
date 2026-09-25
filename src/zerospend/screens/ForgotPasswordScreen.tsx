import React, { useRef, useState } from 'react';
import { Text, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import SpendInput from '../components/SpendInput';
import SpendButton from '../components/SpendButton';
import { spendApi, SpendApiError } from '../services/api';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendForgotPassword'>;
}

const CODE_LENGTH = 6;

const PASSWORD_REQUIREMENTS = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'An uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { label: 'A number (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'A symbol (!@#$% etc.)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';

    // Step management: 'email' | 'otp' | 'password'
    const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
    const [email, setEmail] = useState('');
    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const refs = useRef<Array<TextInput | null>>([]);

    const code = digits.join('');
    const allMet = PASSWORD_REQUIREMENTS.every(r => r.test(password));
    const passwordValid = allMet && password === confirm && password.length > 0;

    // Step 1: Send OTP to email
    const sendOtp = async () => {
        if (!email.includes('@')) return;
        setLoading(true);
        setError(null);
        try {
            await spendApi.forgotPasswordSendOtp(email.trim().toLowerCase());
            setStep('otp');
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Failed to send code. Try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const verifyOtp = async () => {
        if (code.length !== CODE_LENGTH) return;
        setLoading(true);
        setError(null);
        try {
            await spendApi.forgotPasswordCheckOtp(email.trim().toLowerCase(), code);
            setOtp(code);
            setStep('password');
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Invalid code. Try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Reset password
    const resetPassword = async () => {
        if (!passwordValid) return;
        setLoading(true);
        setError(null);
        try {
            await spendApi.forgotPasswordReset(email.trim().toLowerCase(), otp, password);
            navigation.reset({ index: 0, routes: [{ name: 'SpendLogin', params: { email: email.trim().toLowerCase() } }] });
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Failed to reset password. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDigitChange = (index: number, value: string) => {
        const clean = value.replace(/[^0-9]/g, '');
        const next = [...digits];
        next[index] = clean.slice(0, 1);
        setDigits(next);
        setError(null);
        if (clean && index < CODE_LENGTH - 1) {
            refs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (index: number, key: string) => {
        if (key === 'Backspace' && !digits[index] && index > 0) {
            refs.current[index - 1]?.focus();
        }
    };

    const resend = async () => {
        setResending(true);
        setError(null);
        try {
            await spendApi.forgotPasswordSendOtp(email.trim().toLowerCase());
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Failed to resend code.');
        } finally {
            setResending(false);
        }
    };

    // ── Step 1: Email ──
    if (step === 'email') {
        return (
            <SpendScreen>
                <SpendHeader
                    title="Reset password"
                    subtitle="Enter your email to receive a verification code"
                    onBack={() => navigation.goBack()}
                />
                <SpendInput
                    label="Email address"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={t => { setEmail(t); setError(null); }}
                    error={error}
                    onSubmitEditing={sendOtp}
                />
                <SpendButton title="Send code" onPress={sendOtp} loading={loading} disabled={!email.includes('@')} />
            </SpendScreen>
        );
    }

    // ── Step 2: OTP ──
    if (step === 'otp') {
        return (
            <SpendScreen>
                <SpendHeader
                    title="Check your inbox"
                    subtitle={`We sent a 6-digit code to ${email}`}
                    onBack={() => { setStep('email'); setError(null); }}
                />
                <Text style={[styles.hint, { color: currentTheme.textLight }]}>
                    Enter the verification code we emailed you.
                </Text>

                <View style={styles.codeRow}>
                    {digits.map((d, i) => (
                        <TextInput
                            key={i}
                            ref={el => { refs.current[i] = el; }}
                            style={[
                                styles.cell,
                                {
                                    backgroundColor: isDark ? '#1E1E1E' : 'rgba(255,255,255,0.92)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)',
                                    color: currentTheme.text,
                                },
                                d ? styles.cellFilled : null,
                            ]}
                            value={d}
                            onChangeText={v => handleDigitChange(i, v)}
                            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <SpendButton title="Verify code" onPress={verifyOtp} loading={loading} disabled={code.length !== CODE_LENGTH} />
                <Text style={[styles.resend, { color: currentTheme.text }]} onPress={resend}>
                    {resending ? 'Resending…' : "Didn't get it? Resend code"}
                </Text>
            </SpendScreen>
        );
    }

    // ── Step 3: New Password ──
    return (
        <SpendScreen>
            <SpendHeader
                title="New password"
                subtitle="Choose a strong password for your account"
                onBack={() => { setStep('otp'); setError(null); }}
            />

            <SpendInput
                label="New password"
                placeholder="Enter a strong password"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={t => { setPassword(t); setError(null); }}
            />
            <SpendInput
                label="Confirm password"
                placeholder="Re-enter password"
                secureTextEntry
                autoCapitalize="none"
                value={confirm}
                onChangeText={t => { setConfirm(t); setError(null); }}
                error={error}
            />

            <View style={styles.checklist}>
                {PASSWORD_REQUIREMENTS.map(r => {
                    const met = r.test(password);
                    return (
                        <View key={r.label} style={styles.checkRow}>
                            <MaterialCommunityIcons
                                name={met ? 'check-circle' : 'circle-outline'}
                                size={18}
                                color={met ? '#16A34A' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(31,41,55,0.55)'}
                            />
                            <Text style={[styles.checkLabel, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(31,41,55,0.7)' }, met && styles.checkLabelMet]}>
                                {r.label}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <SpendButton title="Reset password" onPress={resetPassword} loading={loading} disabled={!passwordValid} />
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    hint: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 24,
        lineHeight: 20,
    },
    codeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    cell: {
        flex: 1,
        height: 58,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        fontSize: 22,
        fontFamily: spendTheme.font,
        color: spendTheme.text,
    },
    cellFilled: {
        borderColor: spendTheme.accent,
    },
    error: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: spendTheme.danger,
        marginTop: 10,
    },
    resend: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: '#FFFFFF',
        textDecorationLine: 'underline',
        textAlign: 'center',
        marginTop: 20,
    },
    checklist: { marginBottom: 8, gap: 8 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkLabel: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: 'rgba(31,41,55,0.7)',
    },
    checkLabelMet: { color: '#16A34A' },
});

export default ForgotPasswordScreen;
