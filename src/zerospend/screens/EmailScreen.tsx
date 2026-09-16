import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
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
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendEmail'>;
}

const EmailScreen: React.FC<Props> = ({ navigation }) => {
    const { session } = useSpendAuth();
    const { currentTheme } = useTheme();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    React.useEffect(() => {
        if (session) {
            navigation.replace('SpendDashboard');
        }
    }, [session, navigation]);

    const goBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace('Wallet');
        }
    };

    const valid = email.includes('@') && email.includes('.') && acceptedTerms;

    const continuePress = async () => {
        if (!valid) return;
        setLoading(true);
        setError(null);
        try {
            // Nigeria-only for now — the server defaults country to NG.
            await spendApi.register(email.trim().toLowerCase());
            navigation.navigate('SpendOtp', { email: email.trim().toLowerCase() });
        } catch (e) {
            if (e instanceof SpendApiError) {
                if (e.message.includes('already exists')) {
                    setError('Account already exists. Please log in.');
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

    return (
        <SpendScreen>
            <SpendHeader onBack={goBack} />
            <Text style={[styles.hint, { color: currentTheme.textLight }]}>We'll send a verification code to this email.</Text>
            <Text style={[styles.title, { color: currentTheme.text }]}>Welcome to ZeroSpend</Text>
            <SpendInput
                label="Email address"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={t => { setEmail(t); setError(null); }}
                error={error}
                onSubmitEditing={continuePress}
            />

            <Text style={[styles.fieldLabel, { color: currentTheme.textLight }]}>Country</Text>
            <View style={styles.countryRow}>
                <Text style={styles.flag}>🇳🇬</Text>
                <Text style={[styles.countryName, { color: currentTheme.text }]}>Nigeria</Text>
            </View>

            <View style={styles.termsRow}>
                <TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)} style={[styles.checkbox, { borderColor: currentTheme.textLight }]} activeOpacity={0.8}>
                    {acceptedTerms && <View style={[styles.checkboxInner, { backgroundColor: currentTheme.text }]} />}
                </TouchableOpacity>
                <Text style={[styles.termsText, { color: currentTheme.textLight }]}>
                    I accept the{' '}
                    <Text style={[styles.link, { color: currentTheme.text }]} onPress={() => Linking.openURL('https://www.zeromobile.site/terms')}>
                        Terms & Conditions
                    </Text>
                    {' '}and{' '}
                    <Text style={[styles.link, { color: currentTheme.text }]} onPress={() => Linking.openURL('https://www.zeromobile.site/privacy')}>
                        Privacy Policy
                    </Text>
                </Text>
            </View>

            <SpendButton title="Continue" onPress={continuePress} loading={loading} disabled={!valid} />
            <TouchableOpacity onPress={() => navigation.navigate('SpendLogin')} style={styles.loginLink} activeOpacity={0.8}>
                <Text style={[styles.loginText, { color: currentTheme.text }]}>Already have an account? Log in</Text>
            </TouchableOpacity>
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    hint: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 4,
        lineHeight: 20,
    },
    title: {
        fontFamily: spendTheme.font,
        fontSize: 36,
        color: '#FFFFFF',
        marginBottom: 28,
    },
    loginLink: { marginTop: 22, alignItems: 'center' },
    loginText: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: '#FFFFFF',
        textDecorationLine: 'underline',
    },
    fieldLabel: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginTop: 18,
        marginBottom: 8,
    },
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    flag: {
        fontSize: 30,
    },
    countryName: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600' },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 16,
        marginBottom: 24,
        gap: 12,
        paddingRight: 20,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    checkboxInner: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    termsText: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        lineHeight: 20,
        flex: 1,
    },
    link: {
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
});

export default EmailScreen;
