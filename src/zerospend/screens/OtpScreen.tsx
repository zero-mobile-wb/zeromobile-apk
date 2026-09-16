import React, { useRef, useState } from 'react';
import {
    Text,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import SpendButton from '../components/SpendButton';
import { spendApi, SpendApiError } from '../services/api';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendOtp'>;
    route: { params: { email: string } };
}

const CODE_LENGTH = 6;

const OtpScreen: React.FC<Props> = ({ navigation, route }) => {
    const { email } = route.params;
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const refs = useRef<Array<TextInput | null>>([]);

    const code = digits.join('');
    const valid = code.length === CODE_LENGTH;

    const handleChange = (index: number, value: string) => {
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

    const continuePress = async () => {
        if (!valid) return;
        setLoading(true);
        setError(null);
        try {
            await spendApi.checkOtp(email, code);
            navigation.navigate('SpendPassword', { email, otp: code });
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Verification failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setResending(true);
        setError(null);
        try {
            await spendApi.sendOtp(email);
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Failed to resend code.');
        } finally {
            setResending(false);
        }
    };

    return (
        <SpendScreen>
            <SpendHeader title="Check your inbox" subtitle={`We sent a code to ${email}`} onBack={() => navigation.goBack()} />
            <Text style={[styles.hint, { color: currentTheme.textLight }]}>Enter the 6-digit verification code we emailed you.</Text>

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
                        onChangeText={v => handleChange(i, v)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                    />
                ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <SpendButton title="Verify code" onPress={continuePress} loading={loading} disabled={!valid} />
            <Text style={[styles.resend, { color: currentTheme.text }]} onPress={resend}>
                {resending ? 'Resending…' : "Didn't get it? Resend code"}
            </Text>
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
});

export default OtpScreen;