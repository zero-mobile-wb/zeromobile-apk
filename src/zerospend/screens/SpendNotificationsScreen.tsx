import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { spendApi } from '../services/api';
import { SpendNotification } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendNotifications'>;
}

const TEAL = spendTheme.btnGreen;
const TEAL_BG = 'rgba(95,150,156,0.14)';

const KIND_ICONS: Record<string, any> = {
    send: 'arrow-up',
    receive: 'arrow-down',
    buy: 'cart-outline',
    sell: 'bank-transfer-out',
    va: 'credit-card-outline',
    onramp: 'bank-transfer-in',
    offramp: 'bank-transfer-out',
    card: 'credit-card',
    transfer: 'swap-horizontal',
    default: 'bell-outline',
};

const timeAgo = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
};

const SpendNotificationsScreen: React.FC<Props> = ({ navigation }) => {
    const { session, refreshUser } = useSpendAuth();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<SpendNotification[]>([]);

    const load = useCallback(async (silent = false) => {
        if (!session?.token) {
            setLoading(false);
            return;
        }
        if (!silent) setLoading(true);
        try {
            const json = await spendApi.notifications(session.token);
            setItems(json.notifications || []);
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Could not load notifications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [session?.token]);

    React.useEffect(() => {
        load();
    }, [load]);

    const markRead = async (id?: string) => {
        if (!session?.token) return;
        try {
            await spendApi.markNotificationsRead(session.token, id);
            await load(true);
            refreshUser();
        } catch (e) {
            /* best-effort */
        }
    };

    const unread = items.filter(n => !n.read).length;

    return (
        <SpendScreen scroll={false}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); load(true); }}
                        colors={[spendTheme.accent]}
                        tintColor={spendTheme.accent}
                        progressBackgroundColor="#FFFFFF"
                    />
                }
            >
                {/* Header */}
                <View style={styles.headerWrap}>
                    <SpendHeader
                        title="Notifications"
                        onBack={() => navigation.goBack()}
                        titleFont={spendTheme.font}
                        titleSize={24}
                    />
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="small" color={spendTheme.accent} />
                    </View>
                ) : error ? (
                    <View style={styles.errorCard}>
                        <MaterialCommunityIcons name="cloud-off-outline" size={40} color={currentTheme.textLight} />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => { setLoading(true); load(); }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : items.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <MaterialCommunityIcons name="bell-outline" size={48} color={currentTheme.textLight} />
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptySub}>
                            You'll be notified here when you{'\n'}send, receive, buy or sell.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Section header */}
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: currentTheme.textLight }]}>
                                {unread > 0 ? `${unread} UNREAD` : 'ALL ACTIVITY'}
                            </Text>
                            {unread > 0 && (
                                <TouchableOpacity onPress={() => markRead()} activeOpacity={0.7}>
                                    <Text style={[styles.markAllText, { color: TEAL }]}>Mark all read</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Individual notification cards - matching historyRow style */}
                        {items.map(n => {
                            const iconName = KIND_ICONS[n.kind] || KIND_ICONS.default;
                            const unreadRow = !n.read;
                            return (
                                <TouchableOpacity
                                    key={n.id}
                                    style={[
                                        styles.notificationCard,
                                        { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' },
                                    ]}
                                    onPress={() => unreadRow && markRead(n.id)}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : TEAL_BG }]}>
                                        <MaterialCommunityIcons
                                            name={iconName}
                                            size={16}
                                            color={isDark ? '#FFFFFF' : TEAL}
                                        />
                                    </View>
                                    <View style={styles.infoWrap}>
                                        <Text style={[styles.title, { color: currentTheme.text }]} numberOfLines={1}>
                                            {n.title}
                                        </Text>
                                        <Text style={[styles.body, { color: currentTheme.textLight }]} numberOfLines={2}>
                                            {n.body}
                                        </Text>
                                        <Text style={[styles.meta, { color: currentTheme.textLight }]} numberOfLines={1}>
                                            {timeAgo(n.createdAt)}
                                            {n.ref ? ` · ${n.ref.slice(0, 10)}…` : ''}
                                        </Text>
                                    </View>
                                    {unreadRow && <View style={styles.unreadDot} />}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    headerWrap: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        marginTop: 8,
    },
    sectionTitle: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.6,
        color: 'rgba(255,255,255,0.85)',
    },
    markAllText: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        fontWeight: '600',
    },

    // Loading state
    loadingCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },

    // Error state
    errorCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
        gap: 12,
    },
    errorText: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: spendTheme.textMuted,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 12,
        backgroundColor: TEAL,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 14,
    },
    retryText: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // Empty state
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyTitle: {
        fontFamily: spendTheme.font,
        fontSize: 18,
        fontWeight: '700',
        color: spendTheme.text,
    },
    emptySub: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        color: spendTheme.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Individual notification card - matches historyRow style
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 22,
        marginBottom: 10,
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoWrap: {
        flex: 1,
    },
    title: {
        fontFamily: spendTheme.font,
        fontSize: 14,
        fontWeight: '700',
    },
    body: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: spendTheme.textLight,
        marginTop: 3,
        lineHeight: 18,
    },
    meta: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        color: spendTheme.textLight,
        marginTop: 4,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: TEAL,
    },
});

export default SpendNotificationsScreen;
