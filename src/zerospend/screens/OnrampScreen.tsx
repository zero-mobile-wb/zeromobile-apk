import React, { useState, useEffect } from 'react';
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
    Image,
    SafeAreaView,
    StatusBar,
    Modal,
    Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SpendHeader from '../components/SpendHeader';
import { useTheme } from '../../context/ThemeContext';
import { spendTheme } from '../constants/spendTheme';
import { useWallet } from '../../context/WalletContext';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { RootStackParamList } from '../../types/navigation';
import Constants from 'expo-constants';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTwoFactor } from '../context/TwoFactorContext';
import { spendApi } from '../services/api';
import { calcTradeFee, ONRAMP_RATE } from '../utils/fees';
import {
    SELL_CHAINS,
    DEFAULT_SELL_CHAIN,
    SellChain,
    SellToken,
} from '../constants/chains';

interface OnrampScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Onramp'>;
}

const MIN_AMOUNT = 1500;

const OnrampScreen: React.FC<OnrampScreenProps> = ({ navigation }) => {
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const cardBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
    const { wallet, activeSolanaAddress, evmWallets } = useWallet();
    const privyEthWallet = useEmbeddedEthereumWallet();
    const privyEvmAddress = ((privyEthWallet as any).wallets?.[0] as any)?.address ?? null;
    const localEvmAddress = evmWallets.length > 0 ? evmWallets[0].address : null;
    const { session, updateUser } = useSpendAuth();
    const { authorize } = useTwoFactor();
    const authToken = session?.token;
    const userEmail = session?.user?.email;
    const [amountNGN, setAmountNGN] = useState('');
    const [rate, setRate] = useState<number | null>(null);
    const [loadingRate, setLoadingRate] = useState(false);
    const [currentStep, setCurrentStep] = useState<'INPUT' | 'PAYMENT'>('INPUT');
    const [bankDetails, setBankDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    // Token & chain selection
    const [sellChain, setSellChain] = useState<SellChain>(DEFAULT_SELL_CHAIN);
    const [sellToken, setSellToken] = useState<SellToken>(DEFAULT_SELL_CHAIN.tokens[0]);
    const [pickerOpen, setPickerOpen] = useState<null | 'token' | 'chain'>(null);
    const [tempChain, setTempChain] = useState<SellChain>(sellChain);
    const [tempToken, setTempToken] = useState<SellToken>(sellToken);

    useEffect(() => {
        if (currentStep !== 'PAYMENT' || paid) return;
        const t = setInterval(() => setTick(x => x + 1), 1000);
        return () => clearInterval(t);
    }, [currentStep, paid]);

    const zerospendUrl = ((Constants.expoConfig?.extra?.zerospendUrl as string) || '').replace(/\/$/, '');
    const parsedAmount = parseFloat(amountNGN) || 0;
    const isValidAmount = parsedAmount >= MIN_AMOUNT;



    useEffect(() => {
        if (!amountNGN || !isValidAmount) { setRate(null); return; }
        setLoadingRate(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${zerospendUrl}/api/flipeet/rate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        asset: sellToken.symbol.toLowerCase(),
                        network: sellChain.flipeetNetwork,
                        currency: 'NGN',
                        country: 'NG',
                    }),
                });
                const json = await res.json();
                const r = json?.data?.data?.rate || json?.data?.rate;
                if (r) setRate(r);
            } catch (e) { /* silent */ } finally { setLoadingRate(false); }
        }, 600);
        return () => clearTimeout(t);
    }, [amountNGN, sellToken.symbol, sellChain.id]);

    const tokenEstimate = rate && isValidAmount ? (parsedAmount / rate).toFixed(2) : null;
    const buyFee = isValidAmount ? calcTradeFee(parsedAmount, ONRAMP_RATE) : 0;
    const receivingWallet = sellChain.id === 'solana'
        ? (activeSolanaAddress || wallet?.publicKey.toBase58() || '')
        : (privyEvmAddress || localEvmAddress || '');

    const handleContinue = async () => {
        if (!receivingWallet || !isValidAmount) return;
        const twoFactorToken = await authorize(`Buy ${tokenEstimate || ''} ${sellToken.symbol} with ₦${parsedAmount.toLocaleString()}`);
        if (!twoFactorToken) return;
        setIsLoading(true);
        try {
            console.log('[Onramp] chain:', sellChain.id, 'network:', sellChain.flipeetNetwork, 'wallet:', receivingWallet);
            const res = await fetch(`${zerospendUrl}/api/flipeet/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    'x-2fa-token': twoFactorToken,
                },
                body: JSON.stringify({
                    amount: parsedAmount,
                    asset: sellToken.symbol.toLowerCase(),
                    network: sellChain.flipeetNetwork,
                    currency: 'NGN',
                    country: 'NG',
                    email: userEmail,
                    beneficiary: {
                        holder_type: 'INDIVIDUAL',
                        holder_name: 'ZerooUser',
                        wallet_address: receivingWallet,
                    },
                    channel: 'BANK',
                    reason: 'OTHER',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || json?.details?.message || 'Could not create order');
            // Order placed successfully – show payment details immediately
            setBankDetails(json?.data?.data);
            setCurrentStep('PAYMENT');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (value: string, field: string) => {
        await Clipboard.setStringAsync(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handlePayFromBalance = async () => {
        const dep = bankDetails?.deposit;
        if (!authToken || !dep?.bank_code || paying) return;
        const twoFactorToken = await authorize(`Pay ₦${parsedAmount.toLocaleString()} from your ZeroSpend balance`);
        if (!twoFactorToken) return;
        setPaying(true);
        setPayError(null);
        try {
            await spendApi.sendTransfer(authToken, {
                amount: parsedAmount,
                account_number: dep.account_number,
                bank_code: dep.bank_code,
                narration: bankDetails?.reference || 'ZeroSpend onramp',
            }, twoFactorToken);
            try {
                const me = await spendApi.me(authToken);
                if (me.user) updateUser(me.user);
            } catch { /* refresh is best-effort */ }
            setPaid(true);
        } catch (e: any) {
            setPayError(e?.message || 'Payment failed. Please try again.');
        } finally {
            setPaying(false);
        }
    };

    // ─── INPUT STEP ────────────────────────────────────────────────────────────
    const renderInput = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.inputContainer} keyboardShouldPersistTaps="handled">
                {/* Token picker row */}
                <TouchableOpacity style={styles.fieldRow} onPress={() => {
                    setTempChain(sellChain);
                    setTempToken(sellToken);
                    setPickerOpen('token');
                }}>
                    <View style={styles.fieldLeft}>
                        <Image source={{ uri: sellToken.logo }} style={styles.fieldLogo} />
                        <View>
                            <Text style={[styles.fieldValue, { color: currentTheme.text }]}>{sellToken.symbol}</Text>
                            <Text style={[styles.fieldSub, { color: currentTheme.textLight }]}>{sellChain.name}</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                </TouchableOpacity>

                {/* Amount */}
                <View style={styles.amountBlock}>
                    <Text style={[styles.nairaSign, { color: currentTheme.text }]}>₦</Text>
                    <TextInput
                        style={[styles.amountInput, { color: currentTheme.text }]}
                        placeholder="0"
                        placeholderTextColor={currentTheme.textLight}
                        keyboardType="numeric"
                        value={amountNGN}
                        onChangeText={setAmountNGN}
                        autoFocus
                    />
                </View>

                {/* Estimate */}
                <View style={styles.estimateRow}>
                    {loadingRate ? (
                        <ActivityIndicator size="small" color={currentTheme.textLight} />
                    ) : tokenEstimate ? (
                        <Text style={[styles.estimateText, { color: currentTheme.textLight }]}>≈ {tokenEstimate} {sellToken.symbol}</Text>
                    ) : (
                        <Text style={[styles.estimatePlaceholder, { color: currentTheme.textLight }]}>Min ₦{MIN_AMOUNT.toLocaleString()}</Text>
                    )}
                </View>

                {/* Info list */}
                <View style={styles.infoList}>
                    <View style={styles.infoItem}>
                        <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.secondary}15` }]}>
                            <Ionicons name="time-outline" size={16} color={currentTheme.secondary} />
                        </View>
                        <View>
                            <Text style={[styles.infoItemTitle, { color: currentTheme.text }]}>5–10 min settlement</Text>
                            <Text style={[styles.infoItemSub, { color: currentTheme.textLight }]}>{sellToken.symbol} arrives in your wallet</Text>
                        </View>
                    </View>
                    <View style={styles.infoItem}>
                        <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.secondary}15` }]}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={currentTheme.secondary} />
                        </View>
                        <View>
                            <Text style={[styles.infoItemTitle, { color: currentTheme.text }]}>Secured by Flipeet</Text>
                            <Text style={[styles.infoItemSub, { color: currentTheme.textLight }]}>Licensed payment infrastructure</Text>
                        </View>
                    </View>
                    <View style={styles.infoItem}>
                        <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.secondary}15` }]}>
                            <Ionicons name="card-outline" size={16} color={currentTheme.secondary} />
                        </View>
                        <View>
                            <Text style={[styles.infoItemTitle, { color: currentTheme.text }]}>Bank transfer</Text>
                            <Text style={[styles.infoItemSub, { color: currentTheme.textLight }]}>Pay from any Nigerian bank</Text>
                        </View>
                    </View>
                </View>

                {rate && (
                    <Text style={[styles.rateHint, { color: currentTheme.textLight }]}>Rate: 1 USDC = ₦{rate.toLocaleString()}</Text>
                )}
            </ScrollView>

            <View style={styles.footer}>
                {sellChain.id !== 'solana' && !receivingWallet && (
                    <Text style={{ color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
                        No EVM wallet found. Set up a {sellChain.name} wallet first.
                    </Text>
                )}
                <LinearGradient
                    colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                    style={[styles.cta, (!isValidAmount || !receivingWallet) && styles.ctaDisabled]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.ctaInner}
                        onPress={handleContinue}
                        disabled={isLoading || !isValidAmount || !receivingWallet}
                    >
                        {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Continue</Text>}
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </KeyboardAvoidingView>
    );

    // ─── PAYMENT STEP ──────────────────────────────────────────────────────────
    const renderPayment = () => {
        const dep = bankDetails?.deposit;
        const ref = bankDetails?.reference;
        const dest = bankDetails?.destination;
        const balance = Number(session?.user?.balanceNGN || 0);
        const canPayFromBalance = !!(authToken && dep?.bank_code) && !paying && !paid;
        const insufficient = parsedAmount > balance;

        const expiresAt = dep?.expires_at ? new Date(dep.expires_at).getTime() : null;
        const msLeft = expiresAt ? Math.max(0, expiresAt - Date.now()) : null;
        const mins = msLeft !== null ? Math.floor(msLeft / 60000) : null;
        const secs = msLeft !== null ? Math.floor((msLeft % 60000) / 1000) : null;
        const statusExpired = msLeft === 0;
        const delivery = receivingWallet;

        if (paid) {
            return (
                <View style={styles.paidWrap}>
                    <View style={styles.paidIcon}>
                        <Ionicons name="checkmark" size={34} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.paidTitle, { color: currentTheme.text }]}>Payment sent</Text>
                    <Text style={[styles.paidSub, { color: currentTheme.textLight }]}>
                        ₦{parsedAmount.toLocaleString()} was transferred to the onramp account. USDC is on its way to your wallet — usually within 5–10 minutes.
                    </Text>
                    <Text style={[styles.paidRef, { color: currentTheme.textLight }]}>Order {ref?.slice(0, 8)}…</Text>
                    <View style={styles.footer}>
                        <LinearGradient
                            colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                            style={styles.cta}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <TouchableOpacity style={styles.ctaInner} onPress={() => navigation.navigate('Wallet')}>
                                <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Done</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                </View>
            );
        }

        const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
            <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: currentTheme.textLight }]}>{label}</Text>
                <View style={styles.detailValueRow}>
                    <Text style={[styles.detailValue, { color: currentTheme.text }, mono && styles.monoValue]} numberOfLines={1}>
                        {value}
                    </Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(value, label)}>
                        <Ionicons
                            name={copiedField === label ? 'checkmark-circle' : 'copy-outline'}
                            size={16}
                            color={copiedField === label ? '#22C55E' : currentTheme.textLight}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );

        const RowStacked = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
            <View style={styles.detailRowStacked}>
                <Text style={[styles.detailLabel, { color: currentTheme.textLight }]}>{label}</Text>
                <View style={styles.detailValueRowStacked}>
                    <Text style={[styles.detailValue, { color: currentTheme.text }, mono && styles.monoValue]} numberOfLines={2}>
                        {value}
                    </Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(value, label)}>
                        <Ionicons
                            name={copiedField === label ? 'checkmark-circle' : 'copy-outline'}
                            size={16}
                            color={copiedField === label ? '#22C55E' : currentTheme.textLight}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );

        return (
            <>
                <ScrollView contentContainerStyle={styles.paymentContainer}>
                    {/* Status banner */}
                    <View style={[styles.statusBanner, { backgroundColor: cardBg }, statusExpired && styles.statusBannerExpired]}>
                        <View style={[styles.statusBannerIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(31,95,92,0.12)' }, statusExpired && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                            <Ionicons
                                name={statusExpired ? 'alert-circle-outline' : 'time-outline'}
                                size={18}
                                color={statusExpired ? '#EF4444' : currentTheme.text}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusBannerTitle, { color: currentTheme.text }, statusExpired && { color: '#EF4444' }]}>
                                {statusExpired ? 'Transfer window closed' : 'Awaiting transfer'}
                            </Text>
                            <Text style={[styles.statusBannerSub, { color: currentTheme.textLight }]}>
                                {statusExpired
                                    ? 'This order expired. Go back and start a new one.'
                                    : mins !== null
                                        ? `Order expires in ${mins}:${String(secs).padStart(2, '0')}`
                                        : 'Complete the transfer to receive your USDC.'}
                            </Text>
                        </View>
                    </View>

                    {/* Summary */}
                    <View style={styles.summaryHeader}>
                        <Text style={[styles.summaryLabel, { color: currentTheme.textLight }]}>You're sending</Text>
                        <Text style={[styles.summaryAmount, { color: currentTheme.text }]}>₦{parsedAmount.toLocaleString()}</Text>
                        <Text style={[styles.summaryFee, { color: currentTheme.textLight }]}>Fee (0.5%): ₦{buyFee.toLocaleString()}{buyFee > 0 ? ' — deducted from your balance when the buy completes' : ''}</Text>
                        {dest?.amount && (
                            <Text style={[styles.summaryReceive, { color: currentTheme.textLight }]}>
                                ≈ {dest.amount.toFixed(2)} {sellToken.symbol}
                                {rate ? ` · ₦${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}/${sellToken.symbol}` : ''}
                            </Text>
                        )}
                    </View>

                    {/* Pay from ZeroSpend balance */}
                    <View style={[styles.payCard, { backgroundColor: cardBg }]}>
                        <View style={styles.payCardHeader}>
                            <View style={[styles.payCardIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(31,95,92,0.12)' }]}>
                                <Ionicons name="flash" size={18} color={currentTheme.text} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.payCardTitle, { color: currentTheme.text }]}>Instant pay from balance</Text>
                                <Text style={[styles.payCardSub, { color: currentTheme.textLight }]}>Available: ₦{balance.toLocaleString()}</Text>
                            </View>
                        </View>
                        <LinearGradient
                            colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                            style={[styles.payBtn, (!canPayFromBalance || insufficient) && styles.payBtnDisabled]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <TouchableOpacity
                                style={styles.payBtnInner}
                                onPress={handlePayFromBalance}
                                disabled={!canPayFromBalance || insufficient}
                                activeOpacity={0.85}
                            >
                                {paying ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="bank-transfer" size={18} color="#FFFFFF" />
                                        <Text style={styles.payBtnText}>Pay ₦{parsedAmount.toLocaleString()} from balance</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </LinearGradient>
                        {insufficient && !paying && (
                            <Text style={styles.payWarn}>Balance too low — top up via your virtual account first.</Text>
                        )}
                        {payError && <Text style={styles.payError}>{payError}</Text>}
                        <View style={styles.payDivider}>
                            <View style={styles.payDividerLine} />
                            <Text style={styles.payDividerText}>or transfer externally</Text>
                            <View style={styles.payDividerLine} />
                        </View>
                    </View>

                    {/* Bank transfer details */}
                    <View style={[styles.bankCard, { backgroundColor: cardBg }]}>
                        <Text style={[styles.bankCardTitle, { color: currentTheme.text }]}>Bank transfer details</Text>
                        <Row label="Bank" value={dep?.bank_name || '—'} />
                        <Row label="Account" value={dep?.account_number || '—'} mono />
                        <Row label="Name" value={dep?.account_name || '—'} />
                        <Row label="Amount" value={`₦${parsedAmount.toLocaleString()}`} />
                        <RowStacked label="Reference" value={ref || '—'} mono />
                        {dep?.expires_at && (
                            <Row label="Expires" value={new Date(dep.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                        )}

                        <View style={styles.noteRow}>
                            <Ionicons name="information-circle-outline" size={14} color={currentTheme.textLight} style={{ marginRight: 6, marginTop: 1 }} />
                            <Text style={[styles.noteText, { color: currentTheme.textLight }]}>
                                {dep?.note?.[0] || 'Use the exact reference to ensure your order is matched.'}
                            </Text>
                        </View>

                        <View style={styles.deliveryRow}>
                            <Ionicons name="wallet-outline" size={13} color={currentTheme.textLight} style={{ marginRight: 6 }} />
                            <Text style={[styles.deliveryText, { color: currentTheme.textLight }]}>
                                Delivering to {delivery.slice(0, 6)}...{delivery.slice(-6)}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={[styles.leaveBtn, { backgroundColor: cardBg }]} onPress={() => setCurrentStep('INPUT')} activeOpacity={0.7}>
                        <Text style={[styles.leaveText, { color: currentTheme.text }]}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </>
        );
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
                <SpendHeader
                    title="Buy"
                    onBack={() => currentStep === 'INPUT' ? navigation.goBack() : setCurrentStep('INPUT')}
                    titleFont={spendTheme.font}
                    titleSize={20}
                />

                {currentStep === 'INPUT' ? renderInput() : renderPayment()}
            </SafeAreaView>

            {/* Token / Chain picker half-sheet */}
            <Modal
                visible={pickerOpen !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerOpen(null)}
            >
                <Pressable style={styles.sheetOverlay} onPress={() => setPickerOpen(null)}>
                    <Pressable
                        style={[styles.sheetContent, { backgroundColor: currentTheme.card }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.sheetHandle, { backgroundColor: currentTheme.border }]} />
                        <View style={[styles.sheetHeader, { borderBottomColor: currentTheme.border }]}>
                            <Text style={[styles.sheetHeaderTitle, { color: currentTheme.text }]}>
                                {pickerOpen === 'chain' ? 'Network' : 'Buy Asset'}
                            </Text>
                            <TouchableOpacity onPress={() => setPickerOpen(null)} style={styles.sheetClose}>
                                <Text style={[styles.sheetCloseText, { color: currentTheme.textLight }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
                            {/* Network section */}
                            <Text style={[styles.sheetSectionLabel, { color: currentTheme.textLight }]}>NETWORK</Text>
                            {SELL_CHAINS.filter(c => c.id !== 'bsc').map((chain) => {
                        const active = tempChain.id === chain.id;
                                return (
                                    <TouchableOpacity
                                        key={chain.id}
                                        style={[
                                            styles.sheetItem,
                                            active && { backgroundColor: currentTheme.border },
                                            chain.comingSoon && { opacity: 0.5 },
                                        ]}
                                        onPress={() => {
                                            if (chain.comingSoon) return;
                                            setTempChain(chain);
                                            if (!chain.tokens.find(t => t.symbol === tempToken.symbol)) {
                                                setTempToken(chain.tokens[0]);
                                            }
                                        }}
                                    >
                                        <Image source={{ uri: chain.logo }} style={styles.sheetItemLogo} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.sheetItemName, { color: currentTheme.text }]}>{chain.name}</Text>
                                            <Text style={[styles.sheetItemSub, { color: currentTheme.textLight }]}>
                                                {chain.comingSoon ? 'Coming soon' : chain.id === 'solana' ? 'Fast · low fees' : chain.nativeUSDC ? 'Native USDC' : `Gas: ${chain.nativeSymbol}`}
                                            </Text>
                                        </View>
                                        {chain.comingSoon
                                            ? <View style={{ backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Soon</Text>
                                              </View>
                                            : active && <Ionicons name="checkmark-circle" size={22} color={currentTheme.textLight} />
                                        }
                                    </TouchableOpacity>
                                );
                            })}

                            {/* Token section */}
                            <Text style={[styles.sheetSectionLabel, { color: currentTheme.textLight, marginTop: 16 }]}>TOKEN</Text>
                            {tempChain.tokens.map((token) => {
                                const active = tempToken.symbol === token.symbol;
                                return (
                                    <TouchableOpacity
                                        key={`${tempChain.id}-${token.symbol}`}
                                        style={[styles.sheetItem, active && { backgroundColor: currentTheme.border }]}
                                        onPress={() => setTempToken(token)}
                                    >
                                        <Image source={{ uri: token.logo }} style={styles.sheetItemLogo} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.sheetItemName, { color: currentTheme.text }]}>{token.symbol}</Text>
                                            <Text style={[styles.sheetItemSub, { color: currentTheme.textLight }]}>Stablecoin</Text>
                                        </View>
                                        {active && <Ionicons name="checkmark-circle" size={22} color={currentTheme.textLight} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.sheetFooter}>
                            <TouchableOpacity
                                style={[styles.sheetConfirmBtn, { backgroundColor: spendTheme.btnGreen }]}
                                onPress={() => {
                                    setSellChain(tempChain);
                                    setSellToken(tempToken);
                                    setPickerOpen(null);
                                }}
                            >
                                <Text style={styles.sheetConfirmText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },

    // ── Input ──
    inputContainer: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

    // Field rows
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: 'rgba(128,128,128,0.08)',
        marginBottom: 2,
    },
    fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    fieldLogo: { width: 32, height: 32, borderRadius: 16 },
    fieldValue: { fontSize: 16, fontWeight: '600' },
    fieldSub: { fontSize: 12, marginTop: 1 },

    amountBlock: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, marginTop: 18 },
    nairaSign: { fontSize: 40, fontWeight: '300', marginBottom: 6, marginRight: 4 },
    amountInput: { fontSize: 64, fontWeight: '200', flex: 1 },
    estimateRow: { height: 28, justifyContent: 'center', marginBottom: 36 },
    estimateText: { fontSize: 16, fontWeight: '500' },
    estimatePlaceholder: { fontSize: 14 },

    // Info list
    infoList: {
        borderRadius: 18,
        paddingHorizontal: 0,
        marginBottom: 20,
    },
    infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
    infoIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    infoItemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    infoItemSub: { fontSize: 12 },
    infoSep: { height: 1, marginLeft: 48 },
    rateHint: { textAlign: 'center', fontSize: 12 },

    // ── Payment ──
    paymentContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
    summaryHeader: { marginBottom: 32 },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        padding: 14,
        marginBottom: 24,
    },
    statusBannerExpired: { backgroundColor: '#FEF2F2' },
    statusBannerIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(31,95,92,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBannerTitle: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', color: spendTheme.btnGreen },
    statusBannerSub: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textLight, marginTop: 2 },

    summaryLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
    summaryAmount: { fontSize: 42, fontWeight: '700', marginBottom: 2 },
    summaryReceive: { fontSize: 14 },
    summaryFee: { fontSize: 12, marginBottom: 4 },

    payCard: {
        borderRadius: 18,
        padding: 16,
        marginBottom: 24,
    },
    payCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    payCardIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: spendTheme.btnGreen,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payCardTitle: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', color: spendTheme.text },
    payCardSub: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.btnGreen, fontWeight: '600', marginTop: 2 },
    payBtn: { height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
    payBtnDisabled: { opacity: 0.35 },
    payBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    payBtnText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    payWarn: { color: '#EF4444', fontSize: 12, marginTop: 10 },
    payError: { color: '#EF4444', fontSize: 12, marginTop: 10, textAlign: 'center' },
    payDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    payDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
    payDividerText: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, color: spendTheme.textMuted },

    bankCard: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    bankCardTitle: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: spendTheme.text,
        paddingTop: 10,
        paddingBottom: 4,
    },

    paidWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    paidIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    paidTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    paidSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 10 },
    paidRef: { fontFamily: spendTheme.font, fontSize: 12, color: spendTheme.textMuted, marginBottom: 24 },

    leaveBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    leaveText: { fontFamily: spendTheme.font, fontSize: 15, fontWeight: '600' },

    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    detailRowStacked: { paddingVertical: 10 },
    detailLabel: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },
    detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '60%' },
    detailValueRowStacked: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    detailValue: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
    monoValue: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 },
    copyBtn: { padding: 4 },

    noteRow: { flexDirection: 'row', marginTop: 16, marginBottom: 10 },
    noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
    deliveryRow: { flexDirection: 'row', alignItems: 'center' },
    deliveryText: { fontSize: 12 },

    // ── Shared ──
    footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 16 : 24 },
    cta: { height: 58, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    ctaInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    ctaDisabled: { opacity: 0.3 },
    ctaText: { fontSize: 17, fontWeight: '700' },

    // ── Success ──
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    successSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center' },
    handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 28 },

    // Half-sheet modal
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'flex-end',
    },
    sheetContent: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '70%',
        paddingBottom: 20,
    },
    sheetHandle: {
        width: 44,
        height: 5,
        borderRadius: 99,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    sheetHeaderTitle: { fontSize: 18, fontWeight: '700' },
    sheetClose: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    sheetCloseText: { fontSize: 22 },
    sheetSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 12, marginBottom: 6, paddingHorizontal: 4 },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginVertical: 2,
    },
    sheetItemLogo: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
    sheetItemName: { fontSize: 15, fontWeight: '600' },
    sheetItemSub: { fontSize: 12, marginTop: 1 },
    sheetList: { paddingHorizontal: 20, paddingBottom: 20 },
    sheetFooter: { paddingHorizontal: 20, paddingTop: 8 },
    sheetConfirmBtn: { height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    sheetConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default OnrampScreen;
