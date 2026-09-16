import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert,
} from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import SpendButton from '../components/SpendButton';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTwoFactor } from '../context/TwoFactorContext';
import { spendApi } from '../services/api';
import { SpendEvent, FundraiserDonor } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendFundraiser'>;
    route: RouteProp<RootStackParamList, 'SpendFundraiser'>;
}

const FundraiserScreen: React.FC<Props> = ({ navigation, route }) => {
    const { slug } = route.params;
    const { themeId } = useTheme();
    const isDark = themeId === 'dark';
    const { session, refreshUser } = useSpendAuth();
    const { authorize } = useTwoFactor();

    const [campaign, setCampaign] = useState<SpendEvent | null>(null);
    const [donors, setDonors] = useState<FundraiserDonor[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [amount, setAmount] = useState('');
    const [donorName, setDonorName] = useState('');
    const [message, setMessage] = useState('');
    const [donating, setDonating] = useState(false);
    const [donateError, setDonateError] = useState<string | null>(null);

    const available = Number(session?.user?.balanceNGN || 0);

    const fieldBg = isDark ? '#1E1E1E' : 'rgba(255,255,255,0.92)';
    const fieldBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)';
    const ink = isDark ? '#FFFFFF' : spendTheme.text;
    const sub = isDark ? 'rgba(255,255,255,0.65)' : spendTheme.textLight;
    const cardBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';

    const load = useCallback(async () => {
        try {
            const res = await spendApi.getEvent(slug);
            setCampaign(res.event);
            setDonors(res.recentDonations || []);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Could not load fundraiser');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [slug]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load])
    );

    const submitDonation = async () => {
        const amt = Number(amount);
        if (!amt || amt <= 0) {
            setDonateError('Enter an amount');
            return;
        }
        if (!session?.token) {
            setDonateError('Log in to donate');
            return;
        }
        if (amt > available) {
            setDonateError(`Insufficient balance. You have ₦${available.toLocaleString()}.`);
            return;
        }
        const twoFactorToken = await authorize(`Donate ₦${amt.toLocaleString()} to ${campaign?.title || 'fundraiser'}`);
        if (!twoFactorToken) return;
        setDonating(true);
        setDonateError(null);
        try {
            await spendApi.donate(session.token, slug, {
                amount: amt,
                donorName: donorName.trim(),
                message: message.trim(),
            }, twoFactorToken);
            setAmount('');
            setDonorName('');
            setMessage('');
            await load();
            refreshUser().catch(() => {});
            Alert.alert('Donation sent', `₦${amt.toLocaleString()} donated. Thank you!`);
        } catch (e: any) {
            setDonateError(e.message || 'Donation failed. Please try again.');
        } finally {
            setDonating(false);
        }
    };

    const pct = campaign && campaign.goalNGN > 0
        ? Math.min(100, (campaign.raisedNGN / campaign.goalNGN) * 100)
        : 0;

    return (
        <SpendScreen scroll={false}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={spendTheme.accent} />
                </View>
            ) : error || !campaign ? (
                <>
                    <View style={styles.headerWrap}>
                        <SpendHeader title="Fundraiser" onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} style={styles.header} />
                    </View>
                    <View style={styles.center}>
                        <Text style={[styles.errorText, { color: sub }]}>{error || 'Fundraiser not found'}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={spendTheme.accent} />}
                    showsVerticalScrollIndicator={false}
                >
                    <SpendHeader title="Fundraiser" onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} style={styles.header} />
                    {!!campaign.imageUrl && (
                        <Image source={{ uri: campaign.imageUrl }} style={styles.banner} resizeMode="cover" />
                    )}
                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.title, { color: ink }]}>{campaign.title}</Text>
                            <View style={[styles.statusPill, { backgroundColor: campaign.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)' }]}>
                                <Text style={[styles.statusText, { color: campaign.status === 'active' ? '#22C55E' : '#6B7280' }]}>
                                    {campaign.status === 'active' ? 'Active' : 'Closed'}
                                </Text>
                            </View>
                        </View>
                        {!!campaign.description && <Text style={[styles.desc, { color: sub }]}>{campaign.description}</Text>}
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={[styles.progressText, { color: ink }]}>
                            ₦{Number(campaign.raisedNGN).toLocaleString()} of ₦{Number(campaign.goalNGN).toLocaleString()}
                        </Text>
                        <Text style={[styles.donorCount, { color: sub }]}>{campaign.donorCount} donor{campaign.donorCount === 1 ? '' : 's'}</Text>
                    </View>

                    {campaign.status === 'active' && (
                        <View style={[styles.card, { backgroundColor: cardBg }]}>
                            <Text style={[styles.sectionTitle, { color: ink }]}>Make a donation</Text>
                            <Text style={[styles.balanceLine, { color: sub }]}>
                                From your ZeroSpend balance: <Text style={{ color: ink, fontWeight: '700' }}>₦{available.toLocaleString()}</Text>
                            </Text>
                            <Text style={[styles.label, { color: ink }]}>Amount (₦)</Text>
                            <TextInput
                                style={[styles.field, { backgroundColor: fieldBg, borderColor: fieldBorder, color: ink }]}
                                placeholder="e.g. 5000"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="number-pad"
                                value={amount}
                                onChangeText={t => { setAmount(t.replace(/[^0-9]/g, '')); setDonateError(null); }}
                            />
                            <Text style={[styles.label, { color: ink }]}>Your name (optional)</Text>
                            <TextInput
                                style={[styles.field, { backgroundColor: fieldBg, borderColor: fieldBorder, color: ink }]}
                                placeholder="Anonymous"
                                placeholderTextColor="#9CA3AF"
                                value={donorName}
                                onChangeText={setDonorName}
                            />
                            <Text style={[styles.label, { color: ink }]}>Message (optional)</Text>
                            <TextInput
                                style={[styles.field, { backgroundColor: fieldBg, borderColor: fieldBorder, color: ink }]}
                                placeholder="Good luck!"
                                placeholderTextColor="#9CA3AF"
                                value={message}
                                onChangeText={setMessage}
                            />
                            {donateError && <Text style={styles.intentError}>{donateError}</Text>}
                            <SpendButton title="Donate" onPress={submitDonation} loading={donating} disabled={!Number(amount)} />
                        </View>
                    )}

                    {donors.length > 0 && (
                        <View style={[styles.card, { backgroundColor: cardBg }]}>
                            <Text style={[styles.sectionTitle, { color: ink }]}>Recent donations</Text>
                            {donors.map((d, i) => (
                                <View key={i} style={styles.donorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.donorName, { color: ink }]}>{d.donorName || 'Anonymous'}</Text>
                                        {!!d.message && <Text style={[styles.donorMsg, { color: sub }]}>{d.message}</Text>}
                                    </View>
                                    <Text style={styles.donorAmount}>₦{Number(d.amount).toLocaleString()}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    headerWrap: { paddingHorizontal: 24 },
    header: { marginTop: 8, marginBottom: 20 },
    content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    errorText: { fontFamily: spendTheme.font, fontSize: 14, textAlign: 'center' },
    retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
    retryText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    card: { borderRadius: 22, padding: 20, marginBottom: 14 },
    banner: { height: 180, borderRadius: 22, marginBottom: 14, backgroundColor: 'rgba(128,128,128,0.2)' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    title: { fontFamily: spendTheme.font, fontSize: 20, fontWeight: '700', flex: 1 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    statusText: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700' },
    desc: { fontFamily: spendTheme.font, fontSize: 13, marginTop: 8, lineHeight: 19 },
    progressTrack: { height: 10, borderRadius: 6, backgroundColor: 'rgba(128,128,128,0.25)', marginTop: 16, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#22C55E' },
    progressText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', marginTop: 10 },
    donorCount: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },
    balanceLine: { fontFamily: spendTheme.font, fontSize: 13, marginBottom: 4 },
    sectionTitle: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', marginBottom: 12 },
    label: { fontFamily: spendTheme.font, fontSize: 13, marginBottom: 6, marginTop: 10 },
    field: {
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 16,
        fontFamily: spendTheme.font,
        borderWidth: 1,
    },
    intentError: { fontFamily: spendTheme.font, fontSize: 13, color: '#EF4444', marginTop: 10 },
    intentNote: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 12, lineHeight: 18 },
    donorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)' },
    donorName: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600' },
    donorMsg: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },
    donorAmount: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: '#22C55E' },
});

export default FundraiserScreen;
