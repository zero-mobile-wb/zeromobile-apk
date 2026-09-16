import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    StatusBar,
    SafeAreaView,
    Animated,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import SpendHeader from '../components/SpendHeader';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTwoFactor } from '../context/TwoFactorContext';
import { spendApi } from '../services/api';
import { SpendRecipient } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendActions'>;
    route: RouteProp<RootStackParamList, 'SpendActions'>;
}

interface Bank {
    code: string;
    name: string;
}

const KEYPAD_ROWS: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
];

const maskAccount = (acc: string) =>
    acc.length > 4 ? `•••• ${acc.slice(-4)}` : `•••• ${acc}`;

const SpendActionsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { session, updateUser } = useSpendAuth();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const { authorize } = useTwoFactor();

    // Send modal animation
    const [sendOpen, setSendOpen] = useState(false);
    const sendAnim = useRef(new Animated.Value(0)).current;
    const sendBackdropAnim = useRef(new Animated.Value(0)).current;

    const openSendModal = () => {
        setSendOpen(true);
        Animated.parallel([
            Animated.timing(sendBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(sendAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
        ]).start();
    };
    const closeSendModal = () => {
        Animated.parallel([
            Animated.timing(sendBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(sendAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setSendOpen(false));
    };

    // Recipients modal animation
    const [recipientsOpen, setRecipientsOpen] = useState(false);
    const recipientsAnim = useRef(new Animated.Value(0)).current;
    const recipientsBackdropAnim = useRef(new Animated.Value(0)).current;

    const openRecipientsModal = () => {
        setRecipientsOpen(true);
        Animated.parallel([
            Animated.timing(recipientsBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(recipientsAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
        ]).start();
    };
    const closeRecipientsModal = () => {
        Animated.parallel([
            Animated.timing(recipientsBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(recipientsAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setRecipientsOpen(false));
    };

    // Add recipient modal animation
    const [addRecipientOpen, setAddRecipientOpen] = useState(false);
    const addRecipientAnim = useRef(new Animated.Value(0)).current;
    const addRecipientBackdropAnim = useRef(new Animated.Value(0)).current;

    const openAddRecipientModal = () => {
        setAddRecipientOpen(true);
        Animated.parallel([
            Animated.timing(addRecipientBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(addRecipientAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
        ]).start();
    };
    const closeAddRecipientModal = () => {
        Animated.parallel([
            Animated.timing(addRecipientBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(addRecipientAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setAddRecipientOpen(false));
    };

    // Bank modal
    const [bankModalOpen, setBankModalOpen] = useState(false);

    const openBankModal = () => setBankModalOpen(true);
    const closeBankModal = () => setBankModalOpen(false);

    const [sendAmount, setSendAmount] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    const [banks, setBanks] = useState<Bank[]>([]);
    const [recipients, setRecipients] = useState<SpendRecipient[]>([]);
    const [recipientsLoading, setRecipientsLoading] = useState(false);
    const [selectedRecipient, setSelectedRecipient] = useState<SpendRecipient | null>(null);

    const [newBank, setNewBank] = useState<Bank | null>(null);
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [newAccountName, setNewAccountName] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [savingRecipient, setSavingRecipient] = useState(false);

    const [bankSearch, setBankSearch] = useState('');

    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [linkedLoading, setLinkedLoading] = useState(false);

    const va = session?.user?.virtualAccount || null;
    const available = Number(session?.user?.balanceNGN || 0);

    const copy = async (label: string, value: string) => {
        await Clipboard.setStringAsync(value);
        setCopied(label);
        setTimeout(() => setCopied(null), 1600);
    };

    const openSend = () => {
        setSendAmount('');
        setSelectedRecipient(null);
        setSendError(null);
        openSendModal();
        if (session?.token) {
            if (banks.length === 0) {
                spendApi.banks(session.token)
                    .then(j => setBanks(j.banks || []))
                    .catch(() => setBanks([]));
            }
            setRecipientsLoading(true);
            spendApi.recipients(session.token)
                .then(j => setRecipients(j.recipients || []))
                .catch(() => setRecipients([]))
                .finally(() => setRecipientsLoading(false));
        }
    };

    useEffect(() => {
        if (route.params?.open === 'send') {
            const t = setTimeout(openSend, 150);
            return () => clearTimeout(t);
        }
    }, [route.params?.open]);

    // Keep the hub's linked-accounts list fresh (e.g. returning from the
    // link-account screen).
    useFocusEffect(
        useCallback(() => {
            if (!session?.token) return;
            setLinkedLoading(true);
            spendApi.recipients(session.token)
                .then(j => setRecipients(j.recipients || []))
                .catch(() => {})
                .finally(() => setLinkedLoading(false));
        }, [session?.token])
    );

    const pressKey = (k: string) => {
        setSendAmount(prev => {
            if (k === '⌫') return prev.slice(0, -1);
            if (k === '.') {
                if (prev.includes('.')) return prev;
                return prev === '' ? '0.' : prev + '.';
            }
            const dotIdx = prev.indexOf('.');
            if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
            if (prev.replace('.', '').length >= 10) return prev;
            if (prev === '0' && !prev.includes('.')) return k;
            return prev + k;
        });
    };

    const resolveNewAccount = useCallback(async () => {
        if (!session?.token || !newBank || newAccountNumber.length !== 10) {
            setNewAccountName(null);
            return;
        }
        setVerifying(true);
        setNewAccountName(null);
        try {
            const j = await spendApi.resolveAccount(session.token, newAccountNumber, newBank.code);
            setNewAccountName(j.accountName || null);
        } catch (e: any) {
            setNewAccountName(null);
        } finally {
            setVerifying(false);
        }
    }, [session?.token, newBank, newAccountNumber]);

    useEffect(() => {
        if (!addRecipientOpen) return;
        const t = setTimeout(resolveNewAccount, 400);
        return () => clearTimeout(t);
    }, [newAccountNumber, newBank, addRecipientOpen, resolveNewAccount]);

    const saveRecipient = async () => {
        if (!session?.token || !newBank || newAccountNumber.length !== 10 || !newAccountName || savingRecipient) return;
        setSavingRecipient(true);
        try {
            const j = await spendApi.addRecipient(session.token, {
                account_number: newAccountNumber,
                bank_code: newBank.code,
                bank_name: newBank.name,
            });
            const rec = j.recipient;
            setRecipients(prev => (prev.some(r => r.id === rec.id) ? prev : [rec, ...prev]));
            setSelectedRecipient(rec);
            setAddRecipientOpen(false);
            setNewBank(null);
            setNewAccountNumber('');
            setNewAccountName(null);
            setSendError(null);
        } catch (e: any) {
            Alert.alert('Could not add recipient', e.message || 'Please try again.');
        } finally {
            setSavingRecipient(false);
        }
    };

    const filteredBanks = banks.filter(b =>
        b.name.toLowerCase().includes(bankSearch.toLowerCase())
    );

    const amt = parseFloat(sendAmount);
    const canSend = !!amt && amt > 0 && amt <= available && !!selectedRecipient && !sending;

    const submitSend = async () => {
        if (!canSend || !session?.token || !selectedRecipient) return;
        const twoFactorToken = await authorize(`Send ₦${amt.toLocaleString()} to ${selectedRecipient.name || selectedRecipient.bank_name}`);
        if (!twoFactorToken) return;
        setSending(true);
        setSendError(null);
        try {
            const j = await spendApi.sendTransfer(session.token, {
                amount: amt,
                account_number: selectedRecipient.account_number,
                bank_code: selectedRecipient.bank_code,
                narration: 'ZeroSpend withdrawal',
            }, twoFactorToken);
            try {
                const me = await spendApi.me(session.token);
                if (me.user) updateUser(me.user);
            } catch (e) { /* balance refreshes on next focus */ }
            setSendOpen(false);
            const failedStatus = /fail|cancelled|revers|refund|error/i.test(String(j.transfer?.status || ''));
            if (failedStatus) {
                Alert.alert(
                    'Transfer failed',
                    `₦${amt.toLocaleString()} could not be sent. Your balance was not charged.${j.transfer?.status ? `\n\nStatus: ${j.transfer.status}` : ''}`
                );
            } else {
                Alert.alert(
                    'Sent',
                    `₦${amt.toLocaleString()} to ${selectedRecipient.name || selectedRecipient.bank_name}.${j.simulated ? '\n\nSimulated — no real transfer was made.' : ''}`
                );
            }
        } catch (e: any) {
            setSendError(e.message || 'Transfer failed. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const actions = [
        {
            key: 'send',
            title: 'Send',
            subtitle: 'Transfer naira out',
            icon: 'send-outline' as const,
            onPress: openSend,
        },
        {
            key: 'deposit',
            title: 'Deposit',
            subtitle: 'Receive into your account',
            icon: 'bank-transfer-in' as const,
            onPress: () => {
                if (va) copy('va', va.account_number);
                else navigation.navigate('SpendLinkAccount');
            },
        },
        {
            key: 'buy',
            title: 'Buy USDC',
            subtitle: 'Convert naira to crypto',
            icon: 'cart-outline' as const,
            onPress: () => navigation.navigate('Onramp'),
        },
        {
            key: 'sell',
            title: 'Sell USDC',
            subtitle: 'Cash out to your bank',
            icon: 'bank-transfer-out' as const,
            onPress: () => navigation.navigate('Withdraw'),
        },
    ];

    const renderRecipientRow = (r: SpendRecipient, onPress: () => void) => (
        <TouchableOpacity key={`${r.id}-${r.account_number}`} style={styles.recipientItem} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.recipientAvatar, { backgroundColor: isDark ? 'rgba(95,150,156,0.25)' : 'rgba(31,95,92,0.12)' }]}>
                <Text style={[styles.recipientAvatarText, { color: isDark ? '#FFFFFF' : spendTheme.btnGreen }]}>{(r.name || r.bank_name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.recipientName, { color: isDark ? '#FFFFFF' : spendTheme.text }]} numberOfLines={1}>{r.name || r.bank_name}</Text>
                <Text style={[styles.recipientMeta, { color: isDark ? '#AAAAAA' : spendTheme.textMuted }]}>{r.bank_name} • {maskAccount(r.account_number)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={isDark ? '#AAAAAA' : spendTheme.textMuted} />
        </TouchableOpacity>
    );

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
                <View style={styles.headerWrap}>
                    <SpendHeader title="Actions" onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} />
                </View>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight }]}>WHAT DO YOU WANT TO DO?</Text>
                    <View style={[styles.tile, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                        {actions.map((a, i) => (
                            <TouchableOpacity key={a.key} style={styles.row} onPress={a.onPress} activeOpacity={0.7}>
                                <View style={[styles.rowIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                                    <MaterialCommunityIcons name={a.icon} size={26} color={currentTheme.text} />
                                </View>
                                <View style={styles.rowInfo}>
                                    <Text style={[styles.rowTitle, { color: currentTheme.text }]}>{a.title}</Text>
                                    <Text style={[styles.rowSubtitle, { color: currentTheme.textLight }]}>{a.subtitle}</Text>
                                </View>
                                {a.key === 'deposit' && copied === 'va' ? (
                                    <MaterialCommunityIcons name="check" size={20} color="#22C55E" />
                                ) : (
                                    <MaterialCommunityIcons name="chevron-right" size={22} color={currentTheme.textLight} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {va && (
                        <TouchableOpacity style={[styles.vaCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]} onPress={() => copy('va', va.account_number)} activeOpacity={0.85}>
                            <View style={styles.vaRow}>
                                <View>
                                    <Text style={[styles.vaLabel, { color: currentTheme.textLight }]}>YOUR VIRTUAL ACCOUNT</Text>
                                    <Text style={[styles.vaNumber, { color: currentTheme.text }]}>{va.account_number}</Text>
                                    <Text style={[styles.vaBank, { color: currentTheme.textLight }]}>{va.bank_name}</Text>
                                </View>
                                <MaterialCommunityIcons
                                    name={copied === 'va' ? 'check' : 'content-copy'}
                                    size={22}
                                    color={currentTheme.text}
                                />
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Linked bank accounts — visible entry point to link more */}
                    <Text style={[styles.eyebrow, { color: currentTheme.textLight, marginTop: 28 }]}>LINKED ACCOUNTS</Text>
                    <View style={[styles.linkedCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)' }]}>
                        {linkedLoading ? (
                            <ActivityIndicator color={spendTheme.btnGreen} style={{ marginVertical: 18 }} />
                        ) : recipients.length === 0 ? (
                            <Text style={[styles.linkedEmpty, { color: currentTheme.textLight }]}>
                                No bank account linked yet. Link one to receive payouts and send faster.
                            </Text>
                        ) : (
                            recipients.map(r => (
                                <View key={`${r.id}-${r.account_number}`} style={styles.linkedRow}>
                                    <View style={[styles.recipientAvatar, { backgroundColor: isDark ? 'rgba(95,150,156,0.25)' : 'rgba(31,95,92,0.12)' }]}>
                                        <Text style={[styles.recipientAvatarText, { color: isDark ? '#FFFFFF' : spendTheme.btnGreen }]}>{(r.name || r.bank_name || '?').charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.recipientName, { color: isDark ? '#FFFFFF' : spendTheme.text }]} numberOfLines={1}>
                                            {r.name || r.bank_name}
                                        </Text>
                                        <Text style={[styles.recipientMeta, { color: isDark ? '#AAAAAA' : spendTheme.textMuted }]}>
                                            {r.bank_name} • {maskAccount(r.account_number)}{r.currency && r.currency !== 'NGN' ? ` • ${r.currency}` : ''}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                        <TouchableOpacity
                            style={[styles.linkAccountBtn, { borderColor: spendTheme.btnGreen }]}
                            onPress={() => navigation.navigate('SpendLinkAccount')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={18} color={spendTheme.btnGreen} />
                            <Text style={[styles.linkAccountText, { color: spendTheme.btnGreen }]}>Link bank account</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Send sheet */}
            <Modal visible={sendOpen} transparent animationType="none" onRequestClose={closeSendModal}>
                <View style={styles.sheetOverlay}>
                    <Animated.View
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: sendBackdropAnim }]}
                    >
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSendModal} />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.sheet,
                            { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' },
                            {
                                transform: [{
                                    translateY: sendAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [Dimensions.get('window').height, 0],
                                    }),
                                }],
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isDark ? 0.3 : 0.15,
                                shadowRadius: 8,
                                elevation: isDark ? 4 : 2,
                            },
                        ]}
                    >
                        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB' }]} />
                        <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>Send naira</Text>
                        <Text style={[styles.sheetSubtitle, { color: isDark ? '#AAAAAA' : spendTheme.textMuted }]}>Available balance: ₦{available.toLocaleString()}</Text>

                        <TouchableOpacity
                            style={[styles.recipientPicker, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                            onPress={openRecipientsModal}
                            activeOpacity={0.7}
                        >
                            {selectedRecipient ? (
                                <>
                                    <View style={styles.recipientAvatar}>
                                        <Text style={styles.recipientAvatarText}>
                                            {(selectedRecipient.name || selectedRecipient.bank_name || '?').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.recipientName, { color: isDark ? '#FFFFFF' : spendTheme.text }]} numberOfLines={1}>
                                            {selectedRecipient.name || selectedRecipient.bank_name}
                                        </Text>
                                        <Text style={[styles.recipientMeta, { color: spendTheme.textMuted }]}>
                                            {selectedRecipient.bank_name} • {maskAccount(selectedRecipient.account_number)}
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={[styles.recipientAvatar, styles.recipientAvatarAdd]}>
                                        <Ionicons name="add" size={24} color={spendTheme.btnGreen} />
                                    </View>
                                    <Text style={[styles.recipientName, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>Add recipient</Text>
                                </>
                            )}
                            <MaterialCommunityIcons name="chevron-down" size={22} color={spendTheme.textMuted} />
                        </TouchableOpacity>

                        <View style={styles.amountDisplay}>
                            <Text style={[styles.amountSymbol, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>₦</Text>
                            <Text style={[styles.amountText, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>{sendAmount === '' ? '0' : sendAmount}</Text>
                        </View>

                        <View style={styles.keypad}>
                            {KEYPAD_ROWS.map((row, ri) => (
                                <View key={ri} style={styles.keypadRow}>
                                    {row.map(k => (
                                        <TouchableOpacity
                                            key={k}
                                            style={[
                                                styles.key,
                                                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' },
                                                k === '⌫' && { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB' },
                                            ]}
                                            onPress={() => pressKey(k)}
                                            activeOpacity={0.6}
                                        >
                                            {k === '⌫' ? (
                                                <Ionicons name="backspace-outline" size={24} color={isDark ? '#FFFFFF' : spendTheme.text} />
                                            ) : (
                                                <Text style={[styles.keyText, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>{k}</Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </View>

                        {sendError && <Text style={styles.sendError}>{sendError}</Text>}

                        <LinearGradient
                            colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <TouchableOpacity style={styles.sendBtnInner} onPress={submitSend} disabled={!canSend}>
                                {sending ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.sendBtnText}>{amt > 0 ? `Send ₦${amt.toLocaleString()}` : 'Send'}</Text>
                                )}
                            </TouchableOpacity>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>

            {/* Recipients sheet */}
            <Modal visible={recipientsOpen} transparent animationType="none" onRequestClose={closeRecipientsModal}>
                <View style={styles.sheetOverlay}>
                    <Animated.View
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: recipientsBackdropAnim }]}
                    >
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeRecipientsModal} />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.sheet,
                            styles.recipientsSheet,
                            { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' },
                            {
                                transform: [{
                                    translateY: recipientsAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [Dimensions.get('window').height, 0],
                                    }),
                                }],
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isDark ? 0.3 : 0.15,
                                shadowRadius: 8,
                                elevation: isDark ? 4 : 2,
                            },
                        ]}
                    >
                        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB' }]} />
                        <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>Send to</Text>
                        {recipientsLoading ? (
                            <ActivityIndicator color={spendTheme.btnGreen} style={{ marginTop: 30 }} />
                        ) : recipients.length === 0 ? (
                            <Text style={[styles.emptyText, { color: spendTheme.textMuted }]}>No recipients yet. Add one to get started.</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                                {recipients.map(r => renderRecipientRow(r, () => {
                                    setSelectedRecipient(r);
                                    closeRecipientsModal();
                                    setSendError(null);
                                }))}
                            </ScrollView>
                        )}

                        <LinearGradient
                            colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                            style={styles.addRecipientBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <TouchableOpacity
                                style={styles.sendBtnInner}
                                activeOpacity={0.85}
                                onPress={() => {
                                    closeRecipientsModal();
                                    setTimeout(() => openAddRecipientModal(), 200);
                                }}
                            >
                                <Ionicons name="add" size={20} color="#FFFFFF" />
                                <Text style={styles.addRecipientText}>Add recipient</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>

            {/* Add recipient sheet */}
            <Modal visible={addRecipientOpen} transparent animationType="none" onRequestClose={closeAddRecipientModal}>
                <View style={styles.sheetOverlay}>
                    <Animated.View
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: addRecipientBackdropAnim }]}
                    >
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAddRecipientModal} />
                    </Animated.View>
                    <Animated.View
                        style={[
                            styles.sheet,
                            { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' },
                            {
                                transform: [{
                                    translateY: addRecipientAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [Dimensions.get('window').height, 0],
                                    }),
                                }],
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isDark ? 0.3 : 0.15,
                                shadowRadius: 8,
                                elevation: isDark ? 4 : 2,
                            },
                        ]}
                    >
                        <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.3)' : '#D1D5DB' }]} />
                        <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>Add recipient</Text>
                        <Text style={[styles.sheetSubtitle, { color: spendTheme.btnGreen }]}>Send to any Nigerian bank account</Text>

                        <TouchableOpacity
                            style={[styles.field, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                            onPress={openBankModal}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.fieldValue, !newBank && styles.fieldPlaceholder, { color: newBank ? (isDark ? '#FFFFFF' : spendTheme.text) : spendTheme.textMuted }]}>
                                {newBank ? newBank.name : 'Select bank'}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={spendTheme.textMuted} />
                        </TouchableOpacity>

                        <View style={[styles.field, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
                            <TextInput
                                style={[styles.accountInput, { color: isDark ? '#FFFFFF' : spendTheme.text }]}
                                placeholder="Account number"
                                placeholderTextColor={spendTheme.textMuted}
                                keyboardType="number-pad"
                                maxLength={10}
                                value={newAccountNumber}
                                onChangeText={t => setNewAccountNumber(t.replace(/[^0-9]/g, ''))}
                            />
                            {verifying && (
                                <View style={styles.verifyRow}>
                                    <ActivityIndicator size="small" color={spendTheme.btnGreen} />
                                    <Text style={[styles.verifyText, { color: spendTheme.textMuted }]}>Verifying...</Text>
                                </View>
                            )}
                            {!verifying && newAccountName && (
                                <View style={styles.verifyRow}>
                                    <MaterialCommunityIcons name="check-decagram" size={16} color="#22C55E" />
                                    <Text style={[styles.verifiedName, { color: isDark ? '#FFFFFF' : spendTheme.text }]} numberOfLines={1}>{newAccountName}</Text>
                                </View>
                            )}
                        </View>

                        <LinearGradient
                            colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                            style={[styles.sendBtn, (!newBank || newAccountNumber.length !== 10 || !newAccountName || savingRecipient) && styles.sendBtnDisabled]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <TouchableOpacity style={styles.sendBtnInner} onPress={saveRecipient} disabled={!newBank || newAccountNumber.length !== 10 || !newAccountName || savingRecipient}>
                                {savingRecipient ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.sendBtnText}>Save recipient</Text>
                                )}
                            </TouchableOpacity>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>

            {/* Bank modal */}
            <Modal visible={bankModalOpen} animationType="fade" transparent onRequestClose={closeBankModal}>
                <View style={[styles.bankModal, { backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF' }]}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={styles.bankModalHeader}>
                            <Text style={[styles.bankModalTitle, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>Select bank</Text>
                            <TouchableOpacity onPress={closeBankModal} style={styles.bankModalClose} activeOpacity={1}>
                                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : spendTheme.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.searchBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
                            <Ionicons name="search" size={20} color={isDark ? '#AAAAAA' : spendTheme.textLight} />
                            <TextInput
                                style={[styles.searchInput, { color: isDark ? '#FFFFFF' : spendTheme.text }]}
                                placeholder="Search banks..."
                                placeholderTextColor={isDark ? '#AAAAAA' : spendTheme.textLight}
                                value={bankSearch}
                                onChangeText={setBankSearch}
                            />
                        </View>
                        <ScrollView contentContainerStyle={styles.bankList} keyboardShouldPersistTaps="handled">
                            {filteredBanks.length === 0 ? (
                                <Text style={styles.bankEmpty}>No banks found</Text>
                            ) : (
                                filteredBanks.map((b, idx) => (
                                    <TouchableOpacity
                                        key={`${b.code}-${idx}`}
                                        style={[styles.bankItem, { borderBottomColor: isDark ? '#2A2A2A' : '#EEF0F2' }]}
                                        onPress={() => {
                                            setNewBank(b);
                                            closeBankModal();
                                            setBankSearch('');
                                            setNewAccountName(null);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.bankDot, { backgroundColor: isDark ? 'rgba(95,150,156,0.25)' : 'rgba(95,150,156,0.15)' }]}>
                                            <Text style={[styles.bankDotText, { color: isDark ? '#FFFFFF' : spendTheme.btnGreen }]}>{b.name.charAt(0)}</Text>
                                        </View>
                                        <Text style={[styles.bankName, { color: isDark ? '#FFFFFF' : spendTheme.text }]}>{b.name}</Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
    safe: { flex: 1 },
    headerWrap: { paddingHorizontal: 24 },
    content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
    eyebrow: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.6,
        marginBottom: 16,
    },
    tile: {
        borderRadius: 24,
        paddingHorizontal: 18,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
    rowSep: { borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.15)' },
    rowIcon: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowInfo: { flex: 1, marginLeft: 14 },
    rowTitle: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', color: spendTheme.text },
    rowSubtitle: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textLight, marginTop: 2 },
    vaCard: {
        marginTop: 20,
        borderRadius: 22,
        padding: 20,
    },
    vaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    vaLabel: { fontFamily: spendTheme.font, fontSize: 11, letterSpacing: 1.4 },
    vaNumber: { fontFamily: spendTheme.fontLight, fontSize: 26, marginTop: 6, letterSpacing: 0.5 },
    vaBank: { fontFamily: spendTheme.font, fontSize: 13, marginTop: 4 },

    linkedCard: {
        borderRadius: 22,
        padding: 18,
    },
    linkedEmpty: { fontFamily: spendTheme.font, fontSize: 13, lineHeight: 19, marginBottom: 14 },
    linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    linkAccountBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        paddingVertical: 13,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    linkAccountText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700' },

    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 28,
    },
    handle: {
        alignSelf: 'center',
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#D1D5DB',
        marginBottom: 16,
    },
    sheetTitle: { fontFamily: spendTheme.font, fontSize: 19, fontWeight: '700', color: spendTheme.text },
    sheetSubtitle: { fontFamily: spendTheme.font, fontSize: 13, fontWeight: '600', marginTop: 4 },

    recipientPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 18,
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    recipientAvatar: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipientAvatarAdd: { backgroundColor: 'rgba(31,95,92,0.12)' },
    recipientAvatarText: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700' },
    recipientName: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600', color: spendTheme.text },
    recipientMeta: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textMuted, marginTop: 2 },

    amountDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 4,
    },
    amountSymbol: { fontFamily: spendTheme.font, fontSize: 30, fontWeight: '700', color: spendTheme.text },
    amountText: { fontFamily: spendTheme.fontLight, fontSize: 42, color: spendTheme.text, marginLeft: 4 },

    keypad: { marginTop: 8 },
    keypadRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    key: {
        width: 88,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyDelete: { backgroundColor: '#E5E7EB' },
    keyText: { fontFamily: spendTheme.fontLight, fontSize: 24, color: spendTheme.text },

    sendError: { fontFamily: spendTheme.font, fontSize: 13, color: '#EF4444', marginTop: 10 },
    sendBtn: {
        marginTop: 16,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnInner: {
        flex: 1,
        alignSelf: 'stretch',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

    recipientsSheet: { maxHeight: '82%' },
    emptyText: { fontFamily: spendTheme.font, fontSize: 14, color: spendTheme.textMuted, textAlign: 'center', marginVertical: 32 },
    recipientItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    addRecipientBtn: {
        marginTop: 16,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addRecipientText: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

    field: {
        marginTop: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    fieldValue: { flex: 1, fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600', color: spendTheme.text },
    fieldPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
    accountInput: {
        flex: 1,
        fontFamily: spendTheme.font,
        fontSize: 15,
        color: spendTheme.text,
        paddingVertical: 0,
    },
    verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12 },
    verifyText: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textLight },
    verifiedName: { fontFamily: spendTheme.font, fontSize: 12, fontWeight: '600', color: '#16A34A', flexShrink: 1 },

    bankModal: { flex: 1 },
    bankModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 8,
    },
    bankModalTitle: { fontFamily: spendTheme.font, fontSize: 18, fontWeight: '700', color: spendTheme.text },
    bankModalClose: { padding: 6 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 24,
        marginVertical: 10,
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    searchInput: { flex: 1, fontFamily: spendTheme.font, fontSize: 15, paddingVertical: 11, marginLeft: 6 },
    bankList: { paddingHorizontal: 24, paddingBottom: 40 },
    bankEmpty: { fontFamily: spendTheme.font, fontSize: 14, color: spendTheme.textLight, textAlign: 'center', marginTop: 30 },
    bankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        gap: 12,
    },
    bankDot: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bankDotText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700' },
    bankName: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600', flex: 1 },
});

export default SpendActionsScreen;