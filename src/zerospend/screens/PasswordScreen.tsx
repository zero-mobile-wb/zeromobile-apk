import React, { useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendPassword'>;
    route: { params: { email: string; otp: string } };
}

const REQUIREMENTS = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'An uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { label: 'A number (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'A symbol (!@#$% etc.)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const PasswordScreen: React.FC<Props> = ({ navigation, route }) => {
    const { email, otp } = route.params;
    const { setSession } = useSpendAuth();
    const { themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const allMet = REQUIREMENTS.every(r => r.test(password));
    const valid = allMet && password === confirm;

    const finish = async () => {
        if (!valid) return;
        setLoading(true);
        setError(null);
        try {
            const res = await spendApi.verifyOtp(email, otp, password);
            await setSession({ token: res.token, user: res.user });
            // Nigeria-only: the server provisions the Flutterwave virtual
            // account on verify. Linking stays available from Settings.
            navigation.reset({ index: 0, routes: [{ name: 'SpendDashboard' }] });
        } catch (e) {
            if (e instanceof SpendApiError) setError(e.message);
            else setError('Something went wrong. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SpendScreen>
            <SpendHeader
                title="Create a password"
                subtitle="Protect your ZeroSpend account"
                onBack={() => navigation.goBack()}
            />

            <SpendInput
                label="Password"
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
                {REQUIREMENTS.map(r => {
                    const met = r.test(password);
                    return (
                        <View key={r.label} style={styles.checkRow}>
                            <MaterialCommunityIcons
                                name={met ? 'check-circle' : 'circle-outline'}
                                size={18}
                                color={met ? '#16A34A' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(31,41,55,0.55)'}
                            />
                            <Text style={[styles.checkLabel, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(31,41,55,0.7)' }, met && styles.checkLabelMet]}>{r.label}</Text>
                        </View>
                    );
                })}
            </View>

            <SpendButton title="Create account" onPress={finish} loading={loading} disabled={!valid} />
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    checklist: { marginBottom: 8, gap: 8 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkLabel: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: 'rgba(31,41,55,0.7)',
    },
    checkLabelMet: { color: '#16A34A' },
});

export default PasswordScreen;