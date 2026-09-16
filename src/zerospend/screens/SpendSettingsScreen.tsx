import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    StatusBar,
    SafeAreaView,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import SpendHeader from '../components/SpendHeader';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTwoFactor } from '../context/TwoFactorContext';
import { spendApi } from '../services/api';
import { isNigeria, findCountry } from '../constants/countries';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendSettings'>;
}

const SpendSettingsScreen: React.FC<Props> = ({ navigation }) => {
    const { session, updateUser, refreshUser } = useSpendAuth();
    const { authorize } = useTwoFactor();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [identifier, setIdentifier] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pinStep, setPinStep] = useState<'enter' | 'otp'>('enter');
    const [pinValue, setPinValue] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [otpValue, setOtpValue] = useState('');
    const [pinSaving, setPinSaving] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);

    const va = session?.user?.virtualAccount || null;
    const twoFactor = session?.user?.twoFactor;
    const userCountry = (session?.user?.country || '').toUpperCase();
    // Nigeria-only mode: always display Nigeria. Old accounts with no stored
    // country get migrated to NG once (server treats unset as non-NG, which
    // would wrongly hide their NIN panel).
    const shownCountry = findCountry(userCountry) || findCountry('NG');

    useEffect(() => {
        if (!session?.token || session.user?.country) return;
        (async () => {
            try {
                const json = await spendApi.updateCountry(session.token, 'NG');
                if (json.user) updateUser(json.user);
            } catch { /* leave unset — link-account still works */ }
        })();
    }, [session?.token]);

    // Card background — same as Recent Activity card
    const cardBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
    const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

    const copyVa = async () => {
        if (!va) return;
        await Clipboard.setStringAsync(va.account_number);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    const valid = /^\d{11}$/.test(identifier.trim());

    const submit = async () => {
        if (!valid || !session?.token) return;
        setSubmitting(true);
        try {
            const json = await spendApi.verifyNin(session.token, identifier.trim(), 'nin');
            updateUser(json.user);
            Alert.alert('Verified', json.alreadyProvisioned ? 'Your virtual account is ready.' : 'Virtual account created successfully.');
            setIdentifier('');
        } catch (e: any) {
            Alert.alert('Verification failed', e.message || 'Please check your details and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const openPinModal = () => {
        setPinStep('enter');
        setPinValue('');
        setPinConfirm('');
        setOtpValue('');
        setPinError(null);
        setPinModalOpen(true);
    };

    const startPinSetup = async () => {
        if (!session?.token || pinValue.length !== 4 || pinConfirm.length !== 4) {
            setPinError('Enter a 4-digit PIN in both fields');
            return;
        }
        if (pinValue !== pinConfirm) {
            setPinError('PINs do not match');
            return;
        }
        setPinSaving(true);
        setPinError(null);
        try {
            await spendApi.setPin(session.token, pinValue);
            setPinStep('otp');
            setOtpValue('');
        } catch (e: any) {
            setPinError(e.message || 'Could not start PIN setup');
        } finally {
            setPinSaving(false);
        }
    };

    const confirmPinSetup = async () => {
        if (!session?.token || otpValue.length !== 6) {
            setPinError('Enter the 6-digit code from your email');
            return;
        }
        setPinSaving(true);
        setPinError(null);
        try {
            const json = await spendApi.confirmPin(session.token, otpValue);
            if (json.user) updateUser(json.user);
            else await refreshUser();
            setPinModalOpen(false);
            Alert.alert('PIN saved', 'Your 4-digit transaction PIN is now active.');
        } catch (e: any) {
            setPinError(e.message || 'Invalid or expired code');
        } finally {
            setPinSaving(false);
        }
    };

    const togglePasskey = async () => {
        if (!session?.token) return;
        const currentlyOn = !!twoFactor?.passkeySet;
        if (currentlyOn) {
            Alert.alert(
                'Disable passkey?',
                'You will need to use your 4-digit PIN for transactions instead.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const json = await spendApi.setBiometric(session.token, false);
                                if (json.user) updateUser(json.user);
                                else await refreshUser();
                            } catch (e: any) {
                                Alert.alert('Could not disable passkey', e.message);
                            }
                        },
                    },
                ]
            );
            return;
        }
        try {
            const hardware = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!hardware || !enrolled) {
                Alert.alert('Not available on this device', 'Enable Face ID / fingerprint in your device settings, then try again.');
                return;
            }
            const res = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirm device identity to enable Passkey',
                disableDeviceFallback: false,
            });
            if (!res.success) {
                Alert.alert('Not enabled', 'Device verification was cancelled.');
                return;
            }
            // Step-up: enabling a 2FA method needs a 2FA token (PIN). Without
            // any method set up yet, the user must create a PIN first.
            const twoFactorToken = await authorize('Enable passkey');
            if (!twoFactorToken) {
                Alert.alert('Set a PIN first', 'Create your 4-digit transaction PIN below, then enable passkey.');
                return;
            }
            const json = await spendApi.setBiometric(session.token, true, twoFactorToken);
            if (json.user) updateUser(json.user);
            else await refreshUser();
            Alert.alert('Passkey enabled', 'Passkey is now the default way to confirm transactions.');
        } catch (e: any) {
            Alert.alert('Could not enable passkey', e.message);
        }
    };

    return (
        <View style={[styles.safe, { backgroundColor: currentTheme.primary }]}>
            <View style={styles.topGradient} pointerEvents="none">
                <LinearGradient
                    colors={[currentTheme.gradientStart, 'transparent']}
                    style={{ flex: 1 }}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>
            <SafeAreaView style={styles.safe}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
                <View style={styles.headerWrap}>
                    <SpendHeader title="Settings" onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} style={{ marginTop: 8, marginBottom: 16 }} />
                </View>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    {/* ACCOUNT */}
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight }]}>ACCOUNT</Text>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.accountRow}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarInitial}>{(session?.user?.email || 'Z').charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={[styles.accountEmail, { color: currentTheme.text }]} numberOfLines={1}>{session?.user?.email}</Text>
                                <Text style={[styles.accountMeta, { color: currentTheme.textLight }]}>ZeroSpend member</Text>
                            </View>
                        </View>
                        <View style={[styles.divider, { backgroundColor: dividerColor, marginTop: 14 }]} />
                        <View style={styles.countryRow}>
                            <Text style={styles.countryFlag}>{shownCountry?.flag || '🇳🇬'}</Text>
                            <View style={styles.linkInfo}>
                                <Text style={[styles.linkText, { color: currentTheme.text }]}>{shownCountry?.name || 'Nigeria'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* VIRTUAL ACCOUNT — Nigerians only; everyone else links a bank account */}
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight }]}>VIRTUAL ACCOUNT</Text>
                    {va ? (
                        <TouchableOpacity style={[styles.card, { backgroundColor: cardBg }]} onPress={copyVa} activeOpacity={0.85}>
                            <View style={styles.vaHeader}>
                                <View style={styles.checkBadge}>
                                    <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.vaHeaderText, { color: currentTheme.text }]}>Account active</Text>
                            </View>
                            <Text style={[styles.vaNumber, { color: currentTheme.text }]}>{va.account_number}</Text>
                            <Text style={[styles.vaBank, { color: currentTheme.textLight }]}>{va.bank_name}</Text>
                            <View style={styles.vaCopyRow}>
                                <MaterialCommunityIcons
                                    name={copied ? 'check' : 'content-copy'}
                                    size={16}
                                    color={currentTheme.text}
                                />
                                <Text style={[styles.vaCopyText, { color: currentTheme.text }]}>{copied ? 'Copied!' : 'Tap to copy account number'}</Text>
                            </View>
                        </TouchableOpacity>
                    ) : !isNigeria(session?.user?.country) ? (
                        <View style={[styles.card, { backgroundColor: cardBg }]}>
                            <Text style={[styles.provisionTitle, { color: currentTheme.text }]}>Link a bank account instead</Text>
                            <Text style={[styles.provisionSub, { color: currentTheme.textLight }]} numberOfLines={1}>
                                Link a bank account to receive payouts.
                            </Text>
                            <LinearGradient
                                colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                                style={[styles.cta, { marginTop: 16 }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <TouchableOpacity style={styles.ctaInner} onPress={() => navigation.navigate('SpendLinkAccount')}>
                                    <Text style={styles.ctaText}>Link bank account</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>
                    ) : (
                        <View style={[styles.card, { backgroundColor: cardBg }]}>
                            <Text style={[styles.provisionTitle, { color: currentTheme.text }]}>Verify your NIN to activate your account</Text>
                            <Text style={[styles.provisionSub, { color: currentTheme.textLight }]}>
                                ZeroSpend needs a valid NIN to create your personal bank account number for receiving naira.
                            </Text>
                            <TextInput
                                style={[styles.idInput, {
                                    color: currentTheme.text,
                                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#E5E7EB',
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FAFAFA',
                                }]}
                                placeholder="Enter your 11-digit NIN"
                                placeholderTextColor={currentTheme.textLight}
                                keyboardType="number-pad"
                                maxLength={11}
                                value={identifier}
                                onChangeText={t => setIdentifier(t.replace(/\D/g, ''))}
                            />
                            <LinearGradient
                                colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                                style={[styles.cta, (!valid || submitting) && styles.ctaDisabled]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <TouchableOpacity style={styles.ctaInner} onPress={submit} disabled={!valid || submitting}>
                                    {submitting ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.ctaText}>Verify &amp; create account</Text>
                                    )}
                                </TouchableOpacity>
                            </LinearGradient>
                            <Text style={[styles.lockNote, { color: currentTheme.textLight }]}>
                                Your NIN is used only to create your account number with Flutterwave.
                            </Text>
                        </View>
                    )}

                    {/* TWO-FACTOR AUTH */}
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight }]}>TWO-FACTOR AUTH</Text>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <TouchableOpacity style={styles.linkRow} onPress={togglePasskey} activeOpacity={0.7}>
                            <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                                <Ionicons name="finger-print-outline" size={18} color={currentTheme.text} />
                            </View>
                            <View style={styles.linkInfo}>
                                <View style={styles.linkTitleRow}>
                                    <Text style={[styles.linkText, { color: currentTheme.text }]}>Passkey</Text>
                                    {twoFactor?.passkeySet && (
                                        <View style={styles.defaultBadge}>
                                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.linkSub, { color: currentTheme.textLight }]}>
                                    {twoFactor?.passkeySet ? 'Face ID / fingerprint · default method' : 'Face ID / fingerprint for transactions'}
                                </Text>
                            </View>
                            <Ionicons
                                name={twoFactor?.passkeySet ? 'toggle' : 'toggle-outline'}
                                size={26}
                                color={twoFactor?.passkeySet ? spendTheme.btnGreen : currentTheme.textLight}
                            />
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

                        <TouchableOpacity style={styles.linkRow} onPress={openPinModal} activeOpacity={0.7}>
                            <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                                <Ionicons name="keypad-outline" size={18} color={currentTheme.text} />
                            </View>
                            <View style={styles.linkInfo}>
                                <Text style={[styles.linkText, { color: currentTheme.text }]}>{twoFactor?.pinSet ? 'Change PIN' : 'Set 4-digit PIN'}</Text>
                                <Text style={[styles.linkSub, { color: currentTheme.textLight }]}>
                                    {twoFactor?.pinSet ? 'Used as your PIN fallback' : 'Backup method when passkey is unavailable'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                        </TouchableOpacity>
                    </View>

                    {/* SECURITY */}
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight }]}>SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => navigation.navigate('SpendTransactions')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                                <Ionicons name="receipt-outline" size={18} color={currentTheme.text} />
                            </View>
                            <Text style={[styles.linkText, { color: currentTheme.text, flex: 1 }]}>Transaction history</Text>
                            <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                        </TouchableOpacity>
                    </View>

                </ScrollView>

                <Modal visible={pinModalOpen} transparent animationType="fade" onRequestClose={() => setPinModalOpen(false)}>
                    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={styles.pinCard}>
                            {pinStep === 'enter' ? (
                                <>
                                    <Text style={styles.pinTitle}>{twoFactor?.pinSet ? 'Change transaction PIN' : 'Set transaction PIN'}</Text>
                                    <Text style={styles.pinSub}>We'll email a verification code to {session?.user?.email} before saving your new PIN.</Text>
                                    <TextInput
                                        style={styles.pinInput}
                                        value={pinValue}
                                        onChangeText={t => { setPinValue(t.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(null); }}
                                        keyboardType="number-pad"
                                        secureTextEntry
                                        maxLength={4}
                                        autoFocus
                                        placeholder="New PIN"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                    <TextInput
                                        style={[styles.pinInput, styles.pinInputGap]}
                                        value={pinConfirm}
                                        onChangeText={t => { setPinConfirm(t.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(null); }}
                                        keyboardType="number-pad"
                                        secureTextEntry
                                        maxLength={4}
                                        placeholder="Confirm PIN"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                    {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                                    <TouchableOpacity style={styles.pinSave} onPress={startPinSetup} disabled={pinSaving} activeOpacity={0.8}>
                                        {pinSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.pinSaveText}>Send code</Text>}
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.pinTitle}>Check your inbox</Text>
                                    <Text style={styles.pinSub}>Enter the 6-digit code we emailed to {session?.user?.email} to confirm your new PIN.</Text>
                                    <TextInput
                                        style={styles.pinInput}
                                        value={otpValue}
                                        onChangeText={t => { setOtpValue(t.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(null); }}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoFocus
                                        placeholder="••••••"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                    {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                                    <TouchableOpacity style={styles.pinSave} onPress={confirmPinSetup} disabled={pinSaving} activeOpacity={0.8}>
                                        {pinSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.pinSaveText}>Verify &amp; save</Text>}
                                    </TouchableOpacity>
                                </>
                            )}
                            <TouchableOpacity style={styles.pinCancel} onPress={() => setPinModalOpen(false)} activeOpacity={0.7}>
                                <Text style={styles.pinCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
    safe: { flex: 1 },
    headerWrap: { paddingHorizontal: 24 },
    content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

    eyebrow: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.6,
        marginBottom: 12,
        marginTop: 24,
    },

    // Card — matches Recent Activity card style
    card: {
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },

    // Account card
    accountRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: spendTheme.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: { fontFamily: spendTheme.font, fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    accountInfo: { flex: 1, marginLeft: 14 },
    accountEmail: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700' },
    accountMeta: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },

    // Virtual account card
    vaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    checkBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    vaHeaderText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600' },
    vaNumber: { fontFamily: spendTheme.fontLight, fontSize: 30, letterSpacing: 0.5 },
    vaBank: { fontFamily: spendTheme.font, fontSize: 14, marginTop: 4 },
    vaCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
    vaCopyText: { fontFamily: spendTheme.font, fontSize: 13, color: spendTheme.btnGreen, fontWeight: '600' },

    // NIN provision
    provisionTitle: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700' },
    provisionSub: { fontFamily: spendTheme.font, fontSize: 13, marginTop: 8, lineHeight: 20 },
    idInput: {
        marginTop: 16,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontFamily: spendTheme.font,
        fontSize: 16,
        letterSpacing: 2,
    },
    cta: { marginTop: 16, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    ctaInner: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    lockNote: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        marginTop: 14,
        lineHeight: 17,
        textAlign: 'center',
    },

    // Link rows (2FA + Security)
    iconBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    linkInfo: { flex: 1 },
    linkTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    linkText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600' },
    linkSub: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 3 },
    defaultBadge: {
        backgroundColor: spendTheme.btnGreen,
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    defaultBadgeText: { fontFamily: spendTheme.font, fontSize: 9, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.6 },
    divider: { height: 1, marginVertical: 4 },

    // Country row (account card) — Nigeria-only, display only
    countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14 },
    countryFlag: { fontSize: 26 },

    // PIN modal — stays white (modal context)
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    pinCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
    },
    pinTitle: { fontFamily: spendTheme.font, fontSize: 22, color: spendTheme.text, textAlign: 'center' },
    pinSub: { fontFamily: spendTheme.font, fontSize: 13, color: spendTheme.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 18, lineHeight: 18 },
    pinInput: {
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontFamily: spendTheme.font,
        fontSize: 18,
        letterSpacing: 6,
        textAlign: 'center',
        color: spendTheme.text,
        backgroundColor: '#FAFAFA',
    },
    pinInputGap: { marginTop: 10 },
    pinError: { color: '#DC2626', fontFamily: spendTheme.font, fontSize: 13, marginTop: 10, textAlign: 'center' },
    pinSave: {
        marginTop: 16,
        height: 52,
        borderRadius: 14,
        backgroundColor: spendTheme.btnGreen,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinSaveText: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    pinCancel: { marginTop: 12, padding: 6, alignItems: 'center' },
    pinCancelText: { fontFamily: spendTheme.font, fontSize: 14, color: spendTheme.textMuted },
});

export default SpendSettingsScreen;