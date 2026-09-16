import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SpendHeader from '../components/SpendHeader';
import { useTheme } from '../../context/ThemeContext';
import { spendTheme } from '../constants/spendTheme';
import { RootStackParamList } from '../../types/navigation';
import { useSpendAuth } from '../context/SpendAuthContext';
import { spendApi, SpendApiError } from '../services/api';
import { SpendRecipient } from '../types';
import { PAYOUT_COUNTRIES, PayoutCountry } from '../constants/countries';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendLinkAccount'>;
}

type Step = 'COUNTRY' | 'BANK' | 'ACCOUNT';

const LinkAccountScreen: React.FC<Props> = ({ navigation }) => {
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const cardBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
    const { session, updateUser } = useSpendAuth();
    const authToken = session?.token;

    const [step, setStep] = useState<Step>('COUNTRY');
    const [preset, setPreset] = useState<PayoutCountry | null>(null);

    const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [banksError, setBanksError] = useState<string | null>(null);
    const [bankSearch, setBankSearch] = useState('');
    const [selectedBank, setSelectedBank] = useState<{ code: string; name: string } | null>(null);

    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [saving, setSaving] = useState(false);

    const [linked, setLinked] = useState<SpendRecipient[]>([]);

    // Effective payout country for the form (presets only).
    const effCode = preset?.code || '';
    const effCurrency = preset?.currency || '';
    const effPreset = preset;
    const canLeaveCountry = !!preset;

    const goDashboard = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: 'SpendDashboard' }] });
    }, [navigation]);

    const loadLinked = useCallback(async () => {
        if (!authToken) return;
        try {
            const j = await spendApi.recipients(authToken);
            setLinked(j.recipients || []);
        } catch { /* best-effort */ }
    }, [authToken]);

    useEffect(() => {
        loadLinked();
    }, [loadLinked]);

    const loadBanks = useCallback(async () => {
        if (!effCode || !effCurrency) return;
        setBanksLoading(true);
        setBanksError(null);
        setBanks([]);
        try {
            const j = await spendApi.getInstitutions(effCurrency, effCode);
            setBanks(j.banks || []);
            if ((j.banks || []).length === 0) setBanksError('No banks found for this country yet.');
        } catch (e: any) {
            setBanksError(e?.message || 'Could not load banks for this country.');
        } finally {
            setBanksLoading(false);
        }
    }, [effCode, effCurrency]);

    useEffect(() => {
        if (step === 'BANK') loadBanks();
    }, [step, loadBanks]);

    // Auto-verify the account via Flipeet (NG presets verify the same way).
    useEffect(() => {
        const minLen = effCode === 'NG' ? 10 : 3;
        if (!selectedBank || accountNumber.trim().length < minLen) {
            setAccountName(null);
            return;
        }
        if (effCode === 'NG' && accountNumber.trim().length !== 10) {
            setAccountName(null);
            return;
        }
        setVerifying(true);
        setAccountName(null);
        const t = setTimeout(async () => {
            try {
                const j = await spendApi.resolveInstitution(accountNumber.trim(), selectedBank.code, effCode);
                setAccountName(j.accountName || null);
            } catch {
                setAccountName(null);
            } finally {
                setVerifying(false);
            }
        }, 500);
        return () => clearTimeout(t);
    }, [accountNumber, selectedBank, effCode]);

    const handleSave = async () => {
        if (!authToken || !selectedBank || !accountName || saving) return;
        setSaving(true);
        try {
            await spendApi.addRecipient(authToken, {
                account_number: accountNumber.trim(),
                bank_code: selectedBank.code,
                bank_name: selectedBank.name,
                country: effCode,
                currency: effCurrency,
            });
            try {
                const me = await spendApi.me(authToken);
                if (me.user) updateUser(me.user);
            } catch { /* refresh is best-effort */ }
            await loadLinked();
            Alert.alert('Account linked', `${accountName} · ${selectedBank.name} (${effCurrency})`, [
                { text: 'Link another', onPress: resetForm },
                { text: 'Continue', onPress: goDashboard },
            ]);
        } catch (e: any) {
            Alert.alert('Could not link account', e?.message || 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setStep('COUNTRY');
        setPreset(null);
        setBanks([]);
        setSelectedBank(null);
        setAccountNumber('');
        setAccountName(null);
        setBankSearch('');
    };

    const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));

    // ─── STEP 1: COUNTRY ─────────────────────────────────────────────────────
    const renderCountry = () => (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: currentTheme.text }]}>Where should payouts go?</Text>
            <Text style={[styles.sub, { color: currentTheme.textLight }]} numberOfLines={1}>
                Pick a country to link your bank account.
            </Text>

            <View style={styles.grid}>
                {PAYOUT_COUNTRIES.map(c => {
                    const active = preset?.code === c.code;
                    return (
                        <TouchableOpacity
                            key={c.code}
                            style={[styles.tile, { backgroundColor: cardBg }, active && styles.tileActive, !c.payoutLive && styles.tileDisabled]}
                            onPress={() => {
                                if (!c.payoutLive) {
                                    Alert.alert(
                                        'Coming soon',
                                        `Payouts to ${c.name} (${c.currency}) aren't supported by our provider yet. Link a Nigerian, Kenyan, Ghanaian, South African, Tanzanian or UAE account instead.`
                                    );
                                    return;
                                }
                                setPreset(c);
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.tileFlag}>{c.flag}</Text>
                            <Text style={[styles.tileName, { color: currentTheme.textLight }]} numberOfLines={1}>{c.name}</Text>
                            <Text style={[styles.tileCur, { color: currentTheme.textLight }]}>
                                {c.payoutLive ? `${c.code} · ${c.currency}` : 'Coming soon'}
                            </Text>
                            {active && (
                                <View style={styles.tileCheck}>
                                    <Ionicons name="checkmark-circle" size={20} color={spendTheme.btnGreen} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {linked.length > 0 && (
                <View style={[styles.linkedCard, { backgroundColor: cardBg }]}>
                    <Text style={[styles.linkedTitle, { color: currentTheme.text }]}>Linked accounts ({linked.length})</Text>
                    {linked.map(r => (
                        <View key={r.id} style={styles.linkedRow}>
                            <View style={styles.linkedAvatar}>
                                <Text style={styles.linkedAvatarText}>{(r.name || r.bank_name || '?').charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.linkedName, { color: currentTheme.text }]} numberOfLines={1}>{r.name || r.bank_name}</Text>
                                <Text style={[styles.linkedMeta, { color: currentTheme.textLight }]}>
                                    {r.bank_name} · {r.currency || ''} {r.country ? `· ${r.country}` : ''}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );

    // ─── STEP 2: BANK ────────────────────────────────────────────────────────
    const renderBank = () => (
        <View style={{ flex: 1 }}>
            <View style={[styles.searchBox, { backgroundColor: cardBg }]}>
                <Ionicons name="search" size={18} color={currentTheme.textLight} />
                <TextInput
                    style={[styles.searchInput, { color: currentTheme.text }]}
                    placeholder={`Search ${effCode} banks...`}
                    placeholderTextColor={currentTheme.textLight}
                    value={bankSearch}
                    onChangeText={setBankSearch}
                />
            </View>
            {banksLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={spendTheme.btnGreen} /></View>
            ) : banksError ? (
                <View style={styles.center}>
                    <Text style={[styles.errorText, { color: currentTheme.textLight }]}>{banksError}</Text>
                    <TouchableOpacity onPress={loadBanks} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    {filteredBanks.map(b => {
                        const active = selectedBank?.code === b.code;
                        return (
                            <TouchableOpacity
                                key={`${b.code}-${b.name}`}
                                style={[styles.bankRow, active && styles.bankRowActive]}
                                onPress={() => { setSelectedBank(b); setStep('ACCOUNT'); }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.bankDot}>
                                    <Text style={styles.bankDotText}>{b.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <Text style={[styles.bankName, { color: currentTheme.text }]}>{b.name}</Text>
                                <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                            </TouchableOpacity>
                        );
                    })}
                    {filteredBanks.length === 0 && (
                        <Text style={[styles.errorText, { color: currentTheme.textLight }]}>No banks match your search.</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );

    // ─── STEP 3: ACCOUNT ─────────────────────────────────────────────────────
    const renderAccount = () => {
        const minLen = effCode === 'NG' ? 10 : 3;
        const validLen = effCode === 'NG'
            ? accountNumber.trim().length === 10
            : accountNumber.trim().length >= minLen;
        const canSave = !!selectedBank && validLen && !!accountName && !saving && !verifying;
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
                        <Text style={[styles.summaryLabel, { color: currentTheme.textLight }]}>Linking a {effCurrency} account in {effCode}</Text>
                        <Text style={[styles.summaryBank, { color: currentTheme.text }]}>{selectedBank?.name}</Text>
                        <TouchableOpacity onPress={() => setStep('BANK')}>
                            <Text style={styles.changeBank}>Change bank</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.fieldLabel, { color: currentTheme.textLight }]}>
                        {effPreset ? effPreset.accountHint : 'Account number / IBAN'}
                    </Text>
                    <TextInput
                        style={[styles.fieldInput, { color: currentTheme.text, borderBottomColor: currentTheme.border }]}
                        placeholder={effPreset?.accountHint || 'Account number'}
                        placeholderTextColor={currentTheme.textLight}
                        keyboardType={effPreset?.numericOnly ? 'number-pad' : 'default'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={effPreset?.accountMaxLength || 34}
                        value={accountNumber}
                        onChangeText={t => setAccountNumber(effPreset?.numericOnly ? t.replace(/[^0-9]/g, '') : t)}
                        autoFocus
                    />

                    <View style={[styles.verifyBox, { backgroundColor: cardBg }]}>
                        {verifying ? (
                            <View style={styles.verifyRow}>
                                <ActivityIndicator size="small" color={spendTheme.btnGreen} />
                                <Text style={[styles.verifyText, { color: currentTheme.textLight }]}>Verifying account...</Text>
                            </View>
                        ) : accountName ? (
                            <View style={styles.verifyRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                                <Text style={[styles.verifiedName, { color: currentTheme.text }]}>{accountName}</Text>
                            </View>
                        ) : (
                            <Text style={[styles.verifyText, { color: currentTheme.textLight }]}>
                                Enter your details — we'll verify the account name before linking.
                            </Text>
                        )}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <LinearGradient
                        colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                        style={[styles.cta, !canSave && styles.ctaDisabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <TouchableOpacity style={styles.ctaInner} onPress={handleSave} disabled={!canSave}>
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Link account</Text>}
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </KeyboardAvoidingView>
        );
    };

    const titles: Record<Step, string> = { COUNTRY: 'Link your account', BANK: `Banks · ${effCode}`, ACCOUNT: 'Account details' };
    const onBack = () => {
        if (step === 'COUNTRY') goDashboard();
        else if (step === 'BANK') setStep('COUNTRY');
        else setStep('BANK');
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
                <StatusBar barStyle="light-content" />
                <SpendHeader title={titles[step]} onBack={onBack} titleFont={spendTheme.font} titleSize={20} />
                {step === 'COUNTRY' && (
                    <>
                        {renderCountry()}
                        <View style={styles.footer}>
                            <LinearGradient
                                colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                                style={[styles.cta, !canLeaveCountry && styles.ctaDisabled]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <TouchableOpacity
                                    style={styles.ctaInner}
                                    disabled={!canLeaveCountry}
                                    onPress={() => { setSelectedBank(null); setBankSearch(''); setStep('BANK'); }}
                                >
                                    <Text style={styles.ctaText}>Continue</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                            <TouchableOpacity style={styles.skipBtn} onPress={goDashboard} activeOpacity={0.7}>
                                <Text style={[styles.skipText, { color: currentTheme.text }]}>Skip for now</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
                {step === 'BANK' && renderBank()}
                {step === 'ACCOUNT' && renderAccount()}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
    body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
    title: { fontFamily: spendTheme.font, fontSize: 22, fontWeight: '700', marginBottom: 6 },
    sub: { fontFamily: spendTheme.font, fontSize: 13, lineHeight: 19, marginBottom: 18 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
        width: '31%',
        borderRadius: 16,
        padding: 12,
        minHeight: 96,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    tileActive: { borderColor: spendTheme.btnGreen },
    tileDisabled: { opacity: 0.55 },
    tileCode: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700' },
    tileFlag: { fontSize: 30 },
    tileName: { fontFamily: spendTheme.font, fontSize: 11, marginTop: 4 },
    tileCur: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '600', marginTop: 1 },
    tileCheck: { position: 'absolute', top: 8, right: 8 },
    otherCard: { borderRadius: 16, padding: 16, marginTop: 14 },
    fieldLabel: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    fieldInput: { borderBottomWidth: 1, fontSize: 17, paddingVertical: 10, fontFamily: spendTheme.font },
    linkedCard: { borderRadius: 16, padding: 14, marginTop: 16 },
    linkedTitle: { fontFamily: spendTheme.font, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    linkedAvatar: {
        width: 34, height: 34, borderRadius: 12,
        backgroundColor: 'rgba(31,95,92,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    linkedAvatarText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', color: spendTheme.btnGreen },
    linkedName: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600' },
    linkedMeta: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 1 },
    searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 8, paddingHorizontal: 14, borderRadius: 14, height: 46 },
    searchInput: { flex: 1, fontFamily: spendTheme.font, fontSize: 15, marginLeft: 8 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorText: { fontFamily: spendTheme.font, fontSize: 14, textAlign: 'center' },
    retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: spendTheme.btnGreen },
    retryText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    bankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    bankRowActive: { opacity: 0.7 },
    bankDot: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: 'rgba(31,95,92,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    bankDotText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', color: spendTheme.btnGreen },
    bankName: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '500', flex: 1 },
    summaryCard: { borderRadius: 16, padding: 16, marginBottom: 20 },
    summaryLabel: { fontFamily: spendTheme.font, fontSize: 12 },
    summaryBank: { fontFamily: spendTheme.font, fontSize: 18, fontWeight: '700', marginTop: 4 },
    changeBank: { fontFamily: spendTheme.font, fontSize: 13, fontWeight: '600', color: spendTheme.btnGreen, marginTop: 6 },
    verifyBox: { borderRadius: 12, padding: 14, marginTop: 16 },
    verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    verifyText: { fontFamily: spendTheme.font, fontSize: 13 },
    verifiedName: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 16 : 24 },
    cta: { height: 58, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    ctaInner: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' },
    ctaDisabled: { opacity: 0.35 },
    ctaText: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    skipBtn: { marginTop: 12, alignItems: 'center', padding: 8 },
    skipText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600' },
});

export default LinkAccountScreen;
