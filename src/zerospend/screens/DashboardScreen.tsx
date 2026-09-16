import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import SpendScreen from '../components/SpendScreen';
import LiquidGlassButton from '../../components/LiquidGlassButton';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { spendApi } from '../services/api';
import { registerPushToken } from '../../services/notificationService';
import { SpendCard, SpendVirtualAccount, SpendTransaction } from '../types';
import { RootStackParamList } from '../../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendDashboard'>;
}

const mask = (pan?: string) => {
    const last4 = pan?.replace(/\D/g, '').slice(-4);
    return `•••• •••• •••• ${last4 || '0000'}`;
};

const KIND_LABEL: Record<string, string> = {
    onramp: 'Buy USDC',
    offramp: 'Sell USDC',
    card: 'Card',
    va: 'Virtual account',
    send: 'Send',
};

const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('expired')) return '#EF4444';
    if (s.includes('success') || s.includes('completed') || s.includes('paid')) return '#22C55E';
    if (s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('cancelled')) return '#EF4444';
    if (s.includes('awaiting') || s.includes('pending') || s.includes('process')) return '#F59E0B';
    return '#6B7280';
};

const statusBg = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('expired')) return 'rgba(239,68,68,0.12)';
    if (s.includes('success') || s.includes('completed') || s.includes('paid')) return 'rgba(34,197,94,0.12)';
    if (s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('cancelled')) return 'rgba(239,68,68,0.12)';
    if (s.includes('awaiting') || s.includes('pending') || s.includes('process')) return 'rgba(245,158,11,0.14)';
    return 'rgba(107,114,128,0.12)';
};

const statusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('expired')) return 'Expired';
    if (s.includes('awaiting')) return 'Awaiting payment';
    if (s.includes('completed') || s.includes('paid')) return 'Completed';
    if (s.includes('success')) return 'Success';
    if (s.includes('process')) return 'Processing';
    if (s.includes('fail')) return 'Failed';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const displayStatus = (t: SpendTransaction) => t.effectiveStatus || t.status;

const TEAL = spendTheme.btnGreen;
const TEAL_BG = 'rgba(95,150,156,0.14)';

const amountText = (t: SpendTransaction) => {
    if (t.amount == null) return '';
    if (t.kind === 'offramp') {
        return `${Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
    }
    const sym = '₦';
    const val = Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${sym}${val}`;
};

const timeAgo = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
};

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
    const { session, logout, updateUser } = useSpendAuth();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [copied, setCopied] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [txs, setTxs] = useState<SpendTransaction[]>([]);
    const [txLoading, setTxLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const user = session?.user;
    const va: SpendVirtualAccount | null = user?.virtualAccount || null;
    const cards: SpendCard[] = user?.virtualCards || [];
    const ngnCard = cards.find(c => c.currency === 'NGN');
    const usdCard = cards.find(c => c.currency === 'USD');

    const ngnBalance = Number(user?.balanceNGN || 0);
    const usdBalance = Number(usdCard?.amount || 0);

    const loadUser = useCallback(async () => {
        if (!session?.token) return;
        try {
            const json = await spendApi.me(session.token);
            const u = json.user;
            const cur = session?.user;
            const changed = !cur ||
                Number(u?.balanceNGN || 0) !== Number(cur.balanceNGN || 0) ||
                u?.virtualAccount?.account_number !== cur.virtualAccount?.account_number ||
                u?.verified !== cur.verified;
            if (changed && u) updateUser(u);
        } catch (e) {
            /* keep cached user */
        }
    }, [session?.token, session?.user, updateUser]);

    const loadTransactions = useCallback(async (silent = false) => {
        if (!session?.token) {
            setTxLoading(false);
            return;
        }
        if (!silent) setTxLoading(true);
        try {
            const json = await spendApi.transactions(session.token);
            setTxs(json.transactions?.slice(0, 4) || []);
        } catch (e) {
            setTxs([]);
        } finally {
            setTxLoading(false);
        }
    }, [session?.token]);

    const loadNotifications = useCallback(async () => {
        if (!session?.token) return;
        try {
            const json = await spendApi.notifications(session.token);
            setUnreadCount(json.notifications?.filter(n => !n.read).length || 0);
        } catch (e) {
            /* keep last count */
        }
    }, [session?.token]);

    useFocusEffect(
        useCallback(() => {
            loadUser();
            loadTransactions(true);
            loadNotifications();
            if (session?.token) registerPushToken(session.token);
        }, [loadUser, loadTransactions, loadNotifications, session?.token])
    );

    const refresh = useCallback(async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await Promise.all([loadUser(), loadTransactions(true), loadNotifications()]);
        } finally {
            setRefreshing(false);
        }
    }, [refreshing, loadUser, loadTransactions, loadNotifications]);

    const copy = async (label: string, value: string) => {
        await Clipboard.setStringAsync(value);
        setCopied(label);
        setTimeout(() => setCopied(null), 1600);
    };

    const doLogout = async () => {
        setProfileOpen(false);
        await logout();
        navigation.reset({ index: 0, routes: [{ name: 'SpendEmail' }] });
    };

    const initial = (user?.email || 'Z').charAt(0).toUpperCase();
    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

    const quickActions = [
        { label: 'Send', icon: 'send-outline' as const, onPress: () => navigation.navigate('SpendActions', { open: 'send' }) },
        { label: 'Deposit', icon: 'bank-transfer-in' as const, onPress: () => va ? copy('va', va.account_number) : navigation.navigate('SpendLinkAccount') },
        { label: 'Buy', icon: 'cart-outline' as const, onPress: () => navigation.navigate('Onramp') },
        { label: 'Sell', icon: 'bank-transfer-out' as const, onPress: () => navigation.navigate('Withdraw') },
    ];

    return (
        <SpendScreen scroll={false}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        colors={[spendTheme.accent]}
                        tintColor={spendTheme.accent}
                        progressBackgroundColor="#FFFFFF"
                    />
                }
            >
                {/* Settlement warning */}
                <View style={styles.settleWarning}>
                    <Ionicons name="alert-circle-outline" size={14} color="#5A2E00" />
                    <Text style={[styles.settleWarningText, { color: '#5A2E00' }]} numberOfLines={2}>
                        Funds may take 24–48 hours to settle with our provider, Flutterwave. This occurs rarely.
                    </Text>
                </View>

                {/* Top bar */}
                <View style={styles.topRow}>
                    <TouchableOpacity style={styles.profileBtn} onPress={() => setProfileOpen(true)} activeOpacity={0.7}>
                        <Ionicons name="person-outline" size={24} color={currentTheme.text} />
                    </TouchableOpacity>
                    <View style={styles.topRight}>
                    <TouchableOpacity
                        style={[styles.bellBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={() => navigation.navigate('SpendNotifications')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="notifications-outline" size={20} color={currentTheme.text} />
                        {unreadCount > 0 && (
                            <View style={styles.bellBadge}>
                                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.refreshBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={refresh}
                        disabled={refreshing}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.vaPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={() => va ? copy('va', va.account_number) : navigation.navigate('SpendLinkAccount')}
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons
                            name={copied === 'va' ? 'check' : 'content-copy'}
                            size={14}
                            color={currentTheme.text}
                        />
                        <Text style={[styles.vaPillText, { color: currentTheme.text }]}>{va?.account_number || 'Link account'}</Text>
                    </TouchableOpacity>
                    </View>
                </View>

                {/* Total balance */}
                <View style={styles.balanceSection}>
                    <Text style={[styles.balanceLabel, { color: currentTheme.textLight }]}>TOTAL BALANCE</Text>
                    <View style={styles.balanceRow}>
                        <Text style={[styles.currencySymbol, { color: currentTheme.text }]}>₦</Text>
                        <Text style={[styles.balanceNumber, { color: currentTheme.text }]}>
                            {ngnBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <Text style={[styles.vaBank, { color: currentTheme.textLight }]}>{va?.bank_name || 'Virtual account'}</Text>
                </View>

                {/* Quick actions → individual flows; "…" opens Actions hub */}
                <View style={styles.quickActions}>
                    {quickActions.map(a => (
                        <TouchableOpacity key={a.label} style={styles.quickItem} onPress={a.onPress} activeOpacity={0.7}>
                            <View pointerEvents="none">
                                <LiquidGlassButton size={52} isCircle={false} borderRadius={18}>
                                    <MaterialCommunityIcons name={a.icon} size={24} color={currentTheme.text} />
                                </LiquidGlassButton>
                            </View>
                            <Text style={[styles.quickLabel, { color: currentTheme.text }]}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Transaction history */}
                <Text style={[styles.sectionTitle, { color: currentTheme.textLight }]}>RECENT ACTIVITY</Text>
                <View style={[styles.historyCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                    {txLoading ? (
                        <View style={styles.historyEmpty}>
                            <ActivityIndicator size="small" color={spendTheme.accent} />
                        </View>
                    ) : txs.length === 0 ? (
                        <TouchableOpacity
                            style={styles.historyEmpty}
                            onPress={() => navigation.navigate('SpendActions')}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="receipt-text-outline" size={26} color={currentTheme.textLight} />
                            <Text style={[styles.historyEmptyText, { color: currentTheme.textLight }]}>No activity yet — buy or sell USDC</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {txs.slice(0, 3).map((t, i) => (
                                <View key={t.reference} style={styles.historyRow}>
                                    <View style={[styles.historyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : TEAL_BG }]}>
                                        <MaterialCommunityIcons
                                            name={t.direction === 'in' ? 'arrow-down' : 'arrow-up'}
                                            size={16}
                                            color={isDark ? '#FFFFFF' : TEAL}
                                        />
                                    </View>
                                    <View style={styles.historyInfo}>
                                        <Text style={[styles.historyTitle, { color: currentTheme.text }]}>{KIND_LABEL[t.kind] || t.kind}</Text>
                                        <Text style={[styles.historyMeta, { color: currentTheme.textLight }]}>{timeAgo(t.createdAt)} · {t.asset?.toUpperCase() || t.currency || ''}</Text>
                                    </View>
                                    <View style={styles.historyRight}>
                                        <Text style={[styles.historyAmount, { color: currentTheme.text }]}>
                                            {amountText(t)}
                                        </Text>
                                        <View style={[styles.statusPill, { backgroundColor: statusBg(displayStatus(t)) }]}>
                                            <Text style={[styles.statusPillText, { color: statusColor(displayStatus(t)) }]}>{statusLabel(displayStatus(t))}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.viewAll} onPress={() => navigation.navigate('SpendTransactions')} activeOpacity={0.8}>
                                <Text style={[styles.viewAllText, { color: currentTheme.text }]}>View all transactions</Text>
                                <Ionicons name="chevron-forward" size={16} color={currentTheme.text} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Fundraisers + Events — rectangle cards, sideways scroll */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.twoCards}
                >
                    <TouchableOpacity
                        style={[styles.bigCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={() => navigation.navigate('SpendFundraisers', { kind: 'fundraiser' })}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="hand-heart-outline" size={32} color={currentTheme.text} />
                        <View style={styles.bigCardInfo}>
                            <Text style={[styles.bigCardTitle, { color: currentTheme.text }]}>Fundraisers</Text>
                            <Text style={[styles.bigCardSub, { color: currentTheme.textLight }]}>Give & track goals</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color={currentTheme.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.bigCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={() => navigation.navigate('SpendFundraisers', { kind: 'regular' })}
                        activeOpacity={0.85}
                    >
                        <MaterialCommunityIcons name="calendar-month-outline" size={32} color={currentTheme.text} />
                        <View style={styles.bigCardInfo}>
                            <Text style={[styles.bigCardTitle, { color: currentTheme.text }]}>Events</Text>
                            <Text style={[styles.bigCardSub, { color: currentTheme.textLight }]}>Explore & join</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={22} color={currentTheme.textLight} />
                    </TouchableOpacity>
                </ScrollView>
            </ScrollView>

            {/* Profile dropdown */}
            {profileOpen && (
                <>
                    <TouchableOpacity
                        style={styles.dropdownBackdrop}
                        activeOpacity={1}
                        onPress={() => setProfileOpen(false)}
                    />
                    <View style={[styles.dropdown, { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' }]}>
                        <View style={styles.dropdownHeader}>
                            <View style={[styles.dropdownAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                                <Text style={[styles.dropdownInitial, { color: currentTheme.text }]}>{initial}</Text>
                            </View>
                            <View style={styles.dropdownId}>
                                <Text style={[styles.dropdownEmail, { color: currentTheme.text }]} numberOfLines={1}>{user?.email}</Text>
                                <Text style={[styles.dropdownMeta, { color: currentTheme.textLight }]}>Member since {memberSince}</Text>
                            </View>
                        </View>
                        <View style={[styles.dropdownDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEF0F2' }]} />
                        <View style={styles.dropdownRow}>
                            <Text style={[styles.dropdownLabel, { color: currentTheme.textLight }]}>Country</Text>
                            <Text style={[styles.dropdownValue, { color: currentTheme.text }]}>{user?.country || '—'}</Text>
                        </View>
                        <View style={styles.dropdownRow}>
                            <Text style={[styles.dropdownLabel, { color: currentTheme.textLight }]}>Virtual account</Text>
                            <Text style={[styles.dropdownValue, { color: currentTheme.text }]}>{va?.account_number || '—'}</Text>
                        </View>
                        <View style={[styles.dropdownDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEF0F2' }]} />
                        <TouchableOpacity
                            style={styles.dropdownLink}
                            onPress={() => { setProfileOpen(false); navigation.navigate('Wallet'); }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="wallet-outline" size={17} color={currentTheme.textLight} />
                            <Text style={[styles.dropdownLinkText, { color: currentTheme.text }]}>Back to wallet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dropdownLink}
                            onPress={() => { setProfileOpen(false); navigation.navigate('SpendActions'); }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="flash-outline" size={17} color={currentTheme.textLight} />
                            <Text style={[styles.dropdownLinkText, { color: currentTheme.text }]}>Actions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dropdownLink}
                            onPress={() => { setProfileOpen(false); navigation.navigate('SpendTransactions'); }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="receipt-outline" size={17} color={currentTheme.textLight} />
                            <Text style={[styles.dropdownLinkText, { color: currentTheme.text }]}>Transactions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.dropdownLink}
                            onPress={() => { setProfileOpen(false); navigation.navigate('SpendSettings'); }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="settings-outline" size={17} color={currentTheme.textLight} />
                            <Text style={[styles.dropdownLinkText, { color: currentTheme.text }]}>Settings</Text>
                        </TouchableOpacity>
                        <View style={[styles.dropdownDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#EEF0F2' }]} />
                        <TouchableOpacity style={[styles.dropdownLogout, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)' }]} onPress={doLogout} activeOpacity={0.8}>
                            <Ionicons name="log-out-outline" size={17} color="#EF4444" />
                            <Text style={styles.dropdownLogoutText}>Log out</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    content: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 36,
    },
    settleWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF5EC',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 14,
    },
    settleWarningText: {
        fontFamily: spendTheme.font,
        fontSize: 11,
        flex: 1,
        flexWrap: 'wrap',
    },
    profileBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownBackdrop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        zIndex: 40,
    },
    dropdown: {
        position: 'absolute',
        top: 56,
        left: 20,
        right: 20,
        borderRadius: 20,
        padding: 18,
        zIndex: 50,
    },
    dropdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dropdownAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownInitial: { fontFamily: spendTheme.font, fontSize: 20, fontWeight: '700' },
    dropdownId: { flex: 1 },
    dropdownEmail: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700' },
    dropdownMeta: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },
    dropdownDivider: { height: 1, marginVertical: 14 },
    dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    dropdownLabel: { fontFamily: spendTheme.font, fontSize: 13 },
    dropdownValue: { fontFamily: spendTheme.font, fontSize: 13, fontWeight: '600' },
    dropdownLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    dropdownLinkText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600' },
    dropdownLogout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(239,68,68,0.3)',
        marginTop: 4,
    },
    dropdownLogoutText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600', color: '#EF4444' },
    vaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    vaPillText: { fontFamily: spendTheme.font, fontSize: 13, color: '#FFFFFF', letterSpacing: 0.5 },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bellBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: spendTheme.danger,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: '#70a7ac',
    },
    bellBadgeText: { fontFamily: spendTheme.font, fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
    refreshBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    balanceSection: { marginBottom: 8 },
    balanceLabel: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        letterSpacing: 1.6,
        color: 'rgba(255,255,255,0.85)',
    },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
    currencySymbol: {
        fontFamily: spendTheme.font,
        fontSize: 30,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 8,
        marginRight: 6,
    },
    balanceNumber: {
        fontFamily: spendTheme.font,
        fontSize: 52,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    vaBank: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 6,
    },

    quickActions: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginTop: 24,
        paddingHorizontal: 4,
    },
    quickItem: { flex: 1, alignItems: 'center', gap: 8 },
    quickLabel: { fontFamily: spendTheme.font, fontSize: 12, fontWeight: '600' },
    twoCards: { gap: 12, marginTop: 20, paddingBottom: 8 },
    bigCard: {
        width: 280,
        height: 132,
        borderRadius: 22,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    bigCardInfo: { flex: 1 },
    bigCardTitle: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700' },
    bigCardSub: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },

    sectionTitle: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.4,
        color: 'rgba(255,255,255,0.92)',
        marginTop: 32,
        marginBottom: 14,
    },
    historyCard: {
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    historyEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 26,
        gap: 8,
    },
    historyEmptyText: { fontFamily: spendTheme.font, fontSize: 13, color: spendTheme.textMuted },
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    historyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    historyInfo: { flex: 1, marginLeft: 12 },
    historyTitle: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: spendTheme.text },
    historyMeta: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textLight, marginTop: 2 },
    historyRight: { alignItems: 'flex-end', gap: 4 },
    historyAmount: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: TEAL },
    statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusPillText: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700' },
    viewAll: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        marginTop: 4,
    },
    viewAllText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: spendTheme.btnGreen },
});

export default DashboardScreen;