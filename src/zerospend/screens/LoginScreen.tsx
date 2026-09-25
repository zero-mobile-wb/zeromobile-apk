import React, { useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import SpendInput from '../components/SpendInput';
import SpendButton from '../components/SpendButton';
import { spendApi, SpendApiError } from '../services/api';
import { spendTheme } from '../constants/spendTheme';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendLogin'>;
    route: { params?: { email?: string } };
}

const LoginScreen: React.FC<Props> = ({ navigation, route }) => {
    const { setSession } = useSpendAuth();
    const { currentTheme } = useTheme();
    const [email, setEmail] = useState(route.params?.email || '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const valid = email.includes('@') && password.length >= 8;

    const submit = async () => {
        if (!valid) return;
        setLoading(true);
        setError(null);
        try {
            const res = await spendApi.login(email.trim().toLowerCase(), password);
            await setSession({ token: res.token, user: res.user });
            navigation.reset({ index: 0, routes: [{ name: 'SpendDashboard' }] });
        } catch (e) {
            if (e instanceof SpendApiError) {
                const payload = (e as any).payload;
                if (payload?.needsOtp) {
                    // Account exists but was never verified — continue with OTP.
                    navigation.navigate('SpendOtp', { email: email.trim().toLowerCase() });
                    return;
                }
                setError(e.message);
            } else {
                setError('Something went wrong. Try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace('Wallet');
        }
    };

    return (
        <SpendScreen>
            <SpendHeader title="Welcome back" subtitle="Log in to ZeroSpend" onBack={goBack} />
            <SpendInput
                label="Email address"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={t => { setEmail(t); setError(null); }}
            />
            <SpendInput
                label="Password"
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={t => { setPassword(t); setError(null); }}
                error={error}
            />
            <SpendButton title="Log in" onPress={submit} loading={loading} disabled={!valid} />
            <Text style={[styles.forgot, { color: currentTheme.text }]} onPress={() => navigation.navigate('SpendForgotPassword')}>
                Forgot password?
            </Text>
            <Text style={[styles.signup, { color: currentTheme.text }]} onPress={() => navigation.navigate('SpendEmail')}>
                New here? Create an account
            </Text>
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    forgot: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: spendTheme.text,
        textDecorationLine: 'underline',
        textAlign: 'center',
        marginTop: 16,
    },
    signup: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: spendTheme.text,
        textDecorationLine: 'underline',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default LoginScreen;