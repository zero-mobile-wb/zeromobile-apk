import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Animated,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { spendApi } from '../services/api';
import { SpendTransaction } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendTransactions'>;
}

const KIND_LABEL: Record<string, string> = {
    onramp: 'Buy USDC',
    offramp: 'Sell USDC',
    card: 'Card',
    va: 'Virtual account',
    send: 'Send',
};

const fmtMoney = (n: number | null | undefined, cur: string | null | undefined) => {
    if (n == null) return '—';
    const sym = cur?.toUpperCase() === 'NGN' ? '₦' : cur?.toUpperCase() === 'USD' || cur?.toUpperCase() === 'USDC' ? '$' : '';
    return `${sym}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
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

const ReceiptRow = ({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) => {
    const { themeId } = useTheme();
    const dark = themeId === 'dark';
    return (
        <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{label}</Text>
            <Text
                style={[
                    styles.receiptValue,
                    { color: dark ? '#FFFFFF' : spendTheme.text },
                    mono && styles.receiptValueMono,
                    accent && styles.receiptValueAccent,
                    accent && dark && { color: spendTheme.accent },
                ]}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
};

const ReceiptCard = React.forwardRef<View, { t: SpendTransaction }>(({ t }, ref) => {
    const { themeId } = useTheme();
    const dark = themeId === 'dark';
    const paper = dark ? '#262626' : '#FFFFFF';
    const sheet = dark ? '#1F1F1F' : '#FFFFFF';
    const brand = dark ? spendTheme.accent : spendTheme.btnGreen;
    const line = dark ? 'rgba(255,255,255,0.28)' : '#D8DDE2';
    return (
    <View ref={ref} collapsable={false} style={[styles.receipt, { backgroundColor: paper, borderColor: dark ? 'rgba(255,255,255,0.12)' : '#EEF0F2' }]}>
        <View style={styles.receiptHead}>
            <Text style={[styles.receiptBrand, { color: brand }]}>ZEROSPEND</Text>
            <Text style={styles.receiptTitle}>Transaction Receipt</Text>
        </View>

        <View style={styles.receiptAmountRow}>
            <Text style={[styles.receiptAmount, { color: brand }]}>{amountText(t)}</Text>
            <Text style={styles.receiptKind}>{KIND_LABEL[t.kind] || t.kind}</Text>
        </View>

        <View style={[styles.receiptDivider, { borderColor: line }]} />
        <ReceiptRow label="Status" value={statusLabel(displayStatus(t))} accent />
        <ReceiptRow label="Date" value={fullDate(t.createdAt)} />
        <ReceiptRow label="Reference" value={t.reference} mono />

        {t.kind === 'onramp' && (
            <>
                <ReceiptRow label="Paid" value={fmtMoney(t.amount, t.currency)} />
                <ReceiptRow label="Rate" value={t.details?.rate != null ? `₦${Number(t.details.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'} />
                <ReceiptRow label="USDC received" value={fmtMoney(t.details?.assetAmount, t.details?.assetCurrency || 'usdc')} />
                {t.details?.assetNetwork ? <ReceiptRow label="Network" value={t.details.assetNetwork} /> : null}
                {t.details?.bankName ? <ReceiptRow label="Deposit bank" value={t.details.bankName} /> : null}
                {t.details?.accountNumber ? <ReceiptRow label="Deposit account" value={t.details.accountNumber} mono /> : null}
                {t.details?.accountName ? <ReceiptRow label="Account name" value={t.details.accountName} /> : null}
                {t.details?.fee != null ? <ReceiptRow label="Fee" value={fmtMoney(t.details.fee, t.details.feeCurrency)} /> : null}
            </>
        )}

        {t.kind === 'offramp' && (
            <>
                <ReceiptRow label="USDC sent" value={fmtMoney(t.details?.assetAmount, t.details?.assetCurrency || 'usdc')} />
                {t.details?.assetNetwork ? <ReceiptRow label="Network" value={t.details.assetNetwork} /> : null}
                {t.details?.bankName ? <ReceiptRow label="Bank" value={t.details.bankName} /> : null}
                {t.details?.accountNumber ? <ReceiptRow label="Account" value={t.details.accountNumber} mono /> : null}
                {t.details?.fee != null ? <ReceiptRow label="Fee" value={fmtMoney(t.details.fee, t.details.feeCurrency)} /> : null}
            </>
        )}

        {t.kind === 'send' && (
            <>
                <ReceiptRow label="Amount" value={fmtMoney(t.amount, t.currency)} />
                {t.details?.bankName ? <ReceiptRow label="Bank" value={t.details.bankName} /> : null}
                {t.details?.accountNumber ? <ReceiptRow label="Account" value={t.details.accountNumber} mono /> : null}
                {t.details?.accountName ? <ReceiptRow label="Recipient" value={t.details.accountName} /> : null}
            </>
        )}

        {t.kind === 'va' && (
            <ReceiptRow label="Amount" value={fmtMoney(t.amount, t.currency)} />
        )}

        {t.details?.expiresAt && (
            <ReceiptRow label="Expires" value={fullDate(t.details.expiresAt)} />
        )}

        <View style={styles.notchRow}>
            <View style={[styles.notch, { left: -30, backgroundColor: sheet }]} />
            <View style={[styles.receiptDivider, { borderColor: line, flex: 1, marginVertical: 0 }]} />
            <View style={[styles.notch, { right: -30, backgroundColor: sheet }]} />
        </View>
        <Text style={styles.receiptFooter}>ZeroSpend · zeromobile.xyz</Text>
    </View>
    );
});

const amountText = (t: SpendTransaction) => {
    if (t.amount == null) return '';
    if (t.kind === 'offramp') {
        return `${Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
    }
    const sym = t.kind === 'onramp' || t.kind === 'va' ? '₦' : t.currency === 'USD' ? '$' : '₦';
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

const fullDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const SpendTransactionsScreen: React.FC<Props> = ({ navigation }) => {
    const { session } = useSpendAuth();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [txs, setTxs] = useState<SpendTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState<SpendTransaction | null>(null);
    const sheetY = useRef(new Animated.Value(1)).current;
    const windowH = Dimensions.get('window').height;
    const receiptRef = useRef<View>(null);
    const [downloading, setDownloading] = useState(false);

    const openModal = (t: SpendTransaction) => {
        setSelected(t);
        sheetY.setValue(1);
        Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 210,
            mass: 0.9,
        }).start();
    };

    const closeModal = () => {
        Animated.timing(sheetY, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
        }).start(() => setSelected(null));
    };

    const downloadReceipt = async () => {
        if (!selected || downloading) return;
        // Receipt capture (view-shot) + gallery save (media-library) need
        // native modules that only exist in a built app. expo-media-library
        // v57 eagerly requires 'ExpoMediaLibraryNext' at import time, which
        // Expo Go does not ship — so these are lazy-loaded below and skipped
        // entirely in Expo Go.
        if (Constants.appOwnership === 'expo') {
            Alert.alert(
                'Built app required',
                'Saving receipts needs the production build. Your receipt is still visible here anytime.'
            );
            return;
        }
        setDownloading(true);
        try {
            const { captureRef } = await import('react-native-view-shot');
            const MediaLibrary = await import('expo-media-library');
            const Sharing = await import('expo-sharing');
            const uri = await captureRef(receiptRef, { format: 'png', quality: 1 });
            let saved = false;
            try {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    await MediaLibrary.saveToLibraryAsync(uri);
                    saved = true;
                }
            } catch (e) {
                // media library unavailable on this build — fall through to sharing
            }
            if (saved) {
                Alert.alert('Receipt saved', 'The receipt image was saved to your photo library.');
            } else if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Transaction receipt' });
            } else {
                Alert.alert('Receipt ready', `Saved to: ${uri}`);
            }
        } catch (e: any) {
            Alert.alert('Could not save receipt', e?.message || 'Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const load = useCallback(async () => {
        if (!session?.token) {
            setLoading(false);
            return;
        }
        try {
            const json = await spendApi.transactions(session.token);
            setTxs(json.transactions || []);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Could not load transactions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [session?.token]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load])
    );

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    return (
        <SpendScreen scroll={false}>
            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator color={spendTheme.accent} />
                </View>
            ) : error ? (
                <>
                    <View style={styles.headerWrap}>
                        <SpendHeader
                            title="Transactions"
                            onBack={() => navigation.goBack()}
                            titleFont={spendTheme.font}
                            titleSize={20}
                            style={styles.header}
                        />
                    </View>
                    <View style={styles.center}>
                        <MaterialCommunityIcons name="cloud-off-outline" size={40} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)'} />
                        <Text style={[styles.errorText, { color: currentTheme.text }]}>{error}</Text>
                        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)' }]} onPress={() => { setLoading(true); load(); }}>
                            <Text style={[styles.retryText, { color: currentTheme.text }]}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : txs.length === 0 ? (
                <>
                    <View style={styles.headerWrap}>
                        <SpendHeader
                            title="Transactions"
                            onBack={() => navigation.goBack()}
                            titleFont={spendTheme.font}
                            titleSize={20}
                            style={styles.header}
                        />
                    </View>
                    <ScrollView
                        contentContainerStyle={styles.center}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spendTheme.accent} />}
                    >
                        <MaterialCommunityIcons name="receipt-text-outline" size={40} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)'} />
                        <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>No transactions yet</Text>
                        <Text style={[styles.emptySub, { color: currentTheme.textLight }]}>Buy or sell USDC and it will show up here.</Text>
                    </ScrollView>
                </>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spendTheme.accent} />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerInset}>
                        <SpendHeader
                            title="Transactions"
                            onBack={() => navigation.goBack()}
                            titleFont={spendTheme.font}
                            titleSize={20}
                            style={styles.header}
                        />
                    </View>
                    <Text style={[styles.allTitle, { color: isDark ? 'rgba(255,255,255,0.92)' : '#000000' }]}>ALL TRANSACTIONS</Text>
                    {txs.map(t => (
                        <TouchableOpacity
                            key={t.reference}
                            style={[
                                styles.card,
                                { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' },
                            ]}
                            onPress={() => openModal(t)}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.rowIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : TEAL_BG }]}>
                                <MaterialCommunityIcons
                                    name={t.direction === 'in' ? 'arrow-down' : 'arrow-up'}
                                    size={16}
                                    color={isDark ? '#FFFFFF' : TEAL}
                                />
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={[styles.rowTitle, { color: currentTheme.text }]}>{KIND_LABEL[t.kind] || t.kind}</Text>
                                <Text style={[styles.rowMeta, { color: currentTheme.textLight }]}>
                                    {timeAgo(t.createdAt)} · {t.asset?.toUpperCase() || t.currency || ''}
                                </Text>
                            </View>
                            <View style={styles.rowRight}>
                                <Text style={[styles.rowAmount, { color: currentTheme.text }]}>
                                    {amountText(t)}
                                </Text>
                                <View style={[styles.statusPill, { backgroundColor: statusBg(displayStatus(t)) }]}>
                                    <Text style={[styles.statusPillText, { color: statusColor(displayStatus(t)) }]}>{statusLabel(displayStatus(t))}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <Modal
                visible={!!selected}
                transparent
                animationType="none"
                onRequestClose={closeModal}
            >
                <View style={styles.modalContainer}>
                    <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
                    <Animated.View
                        style={[
                            styles.modalSheet,
                            { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' },
                            {
                                transform: [
                                    { translateY: sheetY.interpolate({ inputRange: [0, 1], outputRange: [0, windowH] }) },
                                ],
                            },
                        ]}
                    >
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#DDE1E4' }]} />
                        {selected && (
                            <>
                                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: windowH * 0.72 }}>
                                    <ReceiptCard t={selected} />

                                    <LinearGradient
                                        colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                                        style={styles.downloadBtn}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <TouchableOpacity style={styles.downloadBtnInner} onPress={downloadReceipt} disabled={downloading} activeOpacity={0.85}>
                                            {downloading ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                                                    <Text style={styles.downloadBtnText}>Download Receipt</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </LinearGradient>
                                </ScrollView>
                            </>
                        )}
                    </Animated.View>
                </View>
            </Modal>

            {/* Off-screen receipt used for image capture (view-shot can't capture inside a Modal on Android) */}
            <View pointerEvents="none" style={styles.captureHost}>
                {selected && <ReceiptCard ref={receiptRef} t={selected} />}
            </View>
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    headerWrap: { paddingHorizontal: 24 },
    header: { marginTop: 8, marginBottom: 20 },
    headerInset: { paddingHorizontal: 4 },
    content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
    captureHost: { position: 'absolute', top: 0, left: -20000, width: Dimensions.get('window').width },
    allTitle: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.4,
        alignSelf: 'flex-end',
        marginBottom: 12,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    errorText: { fontFamily: spendTheme.font, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 12, textAlign: 'center' },
    retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
    retryText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    emptyTitle: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 14 },
    emptySub: { fontFamily: spendTheme.font, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 22,
        marginBottom: 10,
        gap: 12,
    },
    rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowInfo: { flex: 1 },
    rowTitle: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700' },
    rowMeta: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textLight, marginTop: 2 },
    rowRight: { alignItems: 'flex-end', gap: 4 },
    rowAmount: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statusPillText: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700' },

    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
    },
    modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#DDE1E4', alignSelf: 'center', marginBottom: 18 },

    receipt: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#EEF0F2',
        marginBottom: 16,
    },
    receiptHead: { alignItems: 'center' },
    receiptBrand: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700', letterSpacing: 2, color: spendTheme.btnGreen, marginBottom: 4 },
    receiptTitle: { fontFamily: spendTheme.font, fontSize: 14, color: spendTheme.textMuted, marginBottom: 14 },
    receiptAmountRow: { alignItems: 'center', marginBottom: 18 },
    receiptAmount: { fontFamily: spendTheme.font, fontSize: 30, fontWeight: '700', color: spendTheme.btnGreen },
    receiptKind: { fontFamily: spendTheme.font, fontSize: 13, color: spendTheme.textMuted, marginTop: 4 },
    receiptDivider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#EEF0F2', marginVertical: 16 },
    notchRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    notch: { position: 'absolute', width: 20, height: 20, borderRadius: 10, top: -10 },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    receiptLabel: { fontFamily: spendTheme.font, fontSize: 13, color: spendTheme.textMuted, marginRight: 16 },
    receiptValue: { fontFamily: spendTheme.font, fontSize: 13, fontWeight: '600', color: spendTheme.text, flexShrink: 1, textAlign: 'right' },
    receiptValueMono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
    receiptValueAccent: { color: spendTheme.btnGreen, fontWeight: '700' },
    receiptFooter: { textAlign: 'center', fontFamily: spendTheme.font, fontSize: 11, color: spendTheme.textMuted, letterSpacing: 0.5 },

    downloadBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
    downloadBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    downloadBtnText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

export default SpendTransactionsScreen;