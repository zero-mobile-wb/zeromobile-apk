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
    SafeAreaView,
    StatusBar,
    Modal,
    Image,
    Pressable,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SpendHeader from '../components/SpendHeader';
import { useTheme } from '../../context/ThemeContext';
import { spendTheme } from '../constants/spendTheme';
import { useWallet } from '../../context/WalletContext';
import { RootStackParamList } from '../../types/navigation';
import Constants from 'expo-constants';
import { getWalletBalance, TokenBalance } from '../../services/balanceService';
import { sendSPLToken } from '../../services/transactionService';
import { getErc20Balance, getEvmGasBalance, sendEvmToken, isValidEvmAddress } from '../../services/evmTransferService';
import { usePrivy, useEmbeddedSolanaWallet, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useSpendAuth } from '../context/SpendAuthContext';
import { useTwoFactor } from '../context/TwoFactorContext';
import { spendApi } from '../services/api';
import { calcTradeFee, OFFRAMP_RATE } from '../utils/fees';
import {
    SELL_CHAINS,
    SELL_CURRENCIES,
    DEFAULT_SELL_CHAIN,
    DEFAULT_SELL_CURRENCY,
    SellChain,
    SellCurrency,
    SellToken,
} from '../constants/chains';

interface WithdrawScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Withdraw'>;
}

const MIN_TOKEN = 1;

const WithdrawScreen: React.FC<WithdrawScreenProps> = ({ navigation }) => {
    const { currentTheme } = useTheme();
    const { wallet, connection, exportEvmPrivateKey, getEvmAddress } = useWallet();
    const zerospendUrl = ((Constants.expoConfig?.extra?.zerospendUrl as string) || '').replace(/\/$/, '');
    const { session } = useSpendAuth();
    const { authorize } = useTwoFactor();
    const authToken = session?.token;
    const userEmail = session?.user?.email;

    // ZeroSpend virtual account — NGN-only default payout option
    const va = (session?.user?.virtualAccount as any) || null;
    const virtualBank = va
        ? {
              code: '090567', // Flutterwave Microfinance Bank on Flipeet
              name: 'ZeroSpend Virtual Account',
              account_number: va.account_number,
              bank_name: va.bank_name,
              virtual: true,
          }
        : null;

    const { user } = usePrivy();
    const privySolanaWallet = useEmbeddedSolanaWallet();
    const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
    const privyEthWallet = useEmbeddedEthereumWallet();
    const privyEvmAddress = ((privyEthWallet as any).wallets?.[0] as any)?.address ?? null;
    const isPrivyUser = !!user && (!!privySolanaAddress || !!privyEvmAddress);
    const localEvmAddress = (getEvmAddress as any)?.('ethereum') as string | undefined;
    const activeEvmAddress = privyEvmAddress || localEvmAddress || null;

    const [step, setStep] = useState<'INPUT' | 'BANK_DETAILS' | 'DEPOSIT'>('INPUT');

    // Step 1: currency / asset / network / amount
    const [sellCurrency, setSellCurrency] = useState<SellCurrency>(DEFAULT_SELL_CURRENCY);
    const [sellChain, setSellChain] = useState<SellChain>(DEFAULT_SELL_CHAIN);
    const [sellToken, setSellToken] = useState<SellToken>(DEFAULT_SELL_CHAIN.tokens[0]);
    const [amountToken, setAmountToken] = useState('');
    const [rate, setRate] = useState<number | null>(null);
    const [loadingRate, setLoadingRate] = useState(false);

    // Token balance on the selected chain
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);

    // Step 2: Bank details
    const [accountNumber, setAccountNumber] = useState('');
    const [selectedBank, setSelectedBank] = useState<any>(null);
    const [accountName, setAccountName] = useState('');
    const [resolvingName, setResolvingName] = useState(false);

    // Picker sheet
    const [pickerOpen, setPickerOpen] = useState<null | 'currency' | 'asset' | 'network'>(null);
    const [tempChain, setTempChain] = useState<SellChain>(sellChain);
    const [tempToken, setTempToken] = useState<SellToken>(sellToken);
    const [banks, setBanks] = useState<any[]>([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showBankModal, setShowBankModal] = useState(false);

    // Saved (linked) payout accounts for the chosen currency
    const [savedRecipients, setSavedRecipients] = useState<any[]>([]);

    // Step 3: Deposit / Send
    const [depositData, setDepositData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingToken, setIsSendingToken] = useState(false);

    const isSolana = sellChain.id === 'solana';
    const parsedAmount = parseFloat(amountToken) || 0;
    const grossFiat = rate ? parsedAmount * rate : null;
    const sellFee = grossFiat ? calcTradeFee(grossFiat, OFFRAMP_RATE) : 0;
    const netFiat = grossFiat !== null ? Math.max(0, grossFiat - sellFee) : null;
    const isValidAmount = parsedAmount >= MIN_TOKEN && grossFiat !== null && grossFiat >= sellCurrency.minAmount;

    const pickChain = (c: SellChain) => {
        setSellChain(c);
        // Keep the token if the new chain supports it, else fall back.
        // USDT is not offered on Base (Flipeet rejects base:usdt).
        setSellToken(prev => c.tokens.find(t => t.symbol === prev.symbol) || c.tokens[0]);
        setTokenBalance(null);
    };

    const pickCurrency = (c: SellCurrency) => {
        setSellCurrency(c);
        setRate(null);
        // Reset payout selection; NGN keeps the virtual-account default.
        if (c.code === 'NG' && virtualBank) {
            setSelectedBank(virtualBank);
            setAccountNumber(virtualBank.account_number);
        } else {
            const first = savedRecipients.find((r: any) => (r.currency || 'NGN') === c.currency);
            if (first) {
                setSelectedBank({ code: first.bank_code, name: first.bank_name });
                setAccountNumber(first.account_number || '');
                if (first.name) setAccountName(first.name);
            } else {
                setSelectedBank(null);
                setAccountNumber('');
                setAccountName('');
            }
        }
    };

    // Fetch institutions + saved recipients when currency changes / on mount
    useEffect(() => {
        const load = async () => {
            setBanksLoading(true);
            try {
                const json = await spendApi.getInstitutions(sellCurrency.currency, sellCurrency.code);
                setBanks(Array.isArray(json.banks) ? json.banks : []);
            } catch (e) {
                console.error('Failed to load institutions', e);
                setBanks([]);
            } finally {
                setBanksLoading(false);
            }
            if (authToken) {
                try {
                    const j = await spendApi.recipients(authToken);
                    setSavedRecipients(j.recipients || []);
                } catch {
                    setSavedRecipients([]);
                }
            }
        };
        load();
    }, [sellCurrency.code, sellCurrency.currency]);

    // Token balance for the selected chain + token
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setTokenBalance(null);
            try {
                if (isSolana) {
                    const pubkey = isPrivyUser && privySolanaAddress ? new PublicKey(privySolanaAddress) : wallet?.publicKey;
                    if (!pubkey) return;
                    const bal = await getWalletBalance(pubkey, connection);
                    const tok = bal.tokens.find((t: TokenBalance) => t.mint === sellToken.mint || t.symbol === sellToken.symbol);
                    if (!cancelled) setTokenBalance(tok ? tok.uiAmount : 0);
                } else if (activeEvmAddress && isValidEvmAddress(activeEvmAddress)) {
                    const bal = await getErc20Balance(
                        sellChain.rpcUrls,
                        sellToken.mint as `0x${string}`,
                        activeEvmAddress as `0x${string}`,
                        sellToken.decimals
                    );
                    if (!cancelled) setTokenBalance(bal);
                }
            } catch (e) {
                console.error('Failed to load token balance', e);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [sellChain.id, sellToken.symbol, wallet, connection, privySolanaAddress, activeEvmAddress]);

    // Live rate fetch for the chosen asset / network / currency
    useEffect(() => {
        if (!(parsedAmount >= MIN_TOKEN)) { setRate(null); return; }
        setLoadingRate(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${zerospendUrl}/api/flipeet/offramp/rate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        asset: sellToken.symbol.toLowerCase(),
                        network: sellChain.flipeetNetwork,
                        currency: sellCurrency.currency,
                        country: sellCurrency.code,
                    }),
                });
                const json = await res.json();
                const r = json?.data?.data?.rate || json?.data?.rate;
                if (r) setRate(r);
            } catch (e) { /* silent */ } finally { setLoadingRate(false); }
        }, 600);
        return () => clearTimeout(t);
    }, [amountToken, sellToken.symbol, sellChain.id, sellCurrency.code]);

    // Auto-resolve account name via Flipeet
    useEffect(() => {
        const minLen = sellCurrency.code === 'NG' ? 10 : 3;
        if (!selectedBank || accountNumber.trim().length < minLen) {
            setAccountName('');
            return;
        }
        if (sellCurrency.code === 'NG' && accountNumber.trim().length !== 10) {
            setAccountName('');
            return;
        }
        setResolvingName(true);
        setAccountName('');
        const t = setTimeout(async () => {
            try {
                const data = await spendApi.resolveInstitution(accountNumber.trim(), selectedBank.code, sellCurrency.code);
                setAccountName(data.accountName || '');
            } catch (e: any) {
                Alert.alert('Verification Failed', e.message || 'Invalid account details');
            } finally {
                setResolvingName(false);
            }
        }, 500);
        return () => clearTimeout(t);
    }, [accountNumber, selectedBank, sellCurrency.code]);

    // Initialize the offramp order
    const handleInitialize = async () => {
        if (!accountNumber || !selectedBank || !accountName) {
            Alert.alert('Error', 'Please enter your account and verify the name.');
            return;
        }
        const twoFactorToken = await authorize(`Sell ${parsedAmount} ${sellToken.symbol} to your ${sellCurrency.code} account`);
        if (!twoFactorToken) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${zerospendUrl}/api/flipeet/offramp/initialize`, {
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
                    currency: sellCurrency.currency,
                    country: sellCurrency.code,
                    email: userEmail,
                    beneficiary: {
                        holder_type: 'INDIVIDUAL',
                        holder_name: accountName,
                        account_number: accountNumber.trim(),
                        bank_code: selectedBank.code,
                    },
                    channel: sellCurrency.offrampChannel,
                    reason: 'OTHER',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || json?.details?.message || 'Could not initialize order');
            setDepositData(json?.data?.data);
            setStep('DEPOSIT');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendSolana = async (depositTo: string, targetAmount: number) => {
        const senderPubkey = isPrivyUser && privySolanaAddress ? new PublicKey(privySolanaAddress) : wallet?.publicKey;
        if (!senderPubkey) {
            Alert.alert('Error', 'No wallet connected.');
            return;
        }
        try {
            const solBalance = await connection.getBalance(senderPubkey);
            const toATA = await getAssociatedTokenAddress(new PublicKey(sellToken.mint), new PublicKey(depositTo));
            const toInfo = await connection.getAccountInfo(toATA);
            const rentForATA = toInfo ? 0 : 0.00203928;
            const needed = rentForATA + 0.00001 + 0.00089088;
            if (solBalance / LAMPORTS_PER_SOL < needed) {
                Alert.alert(
                    'Not enough SOL',
                    `Your wallet has ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL but this transfer needs about ${needed.toFixed(4)} SOL (recipient token-account rent + fee). Add a little SOL and try again.`
                );
                return;
            }
        } catch (e) {
            // if the balance check itself fails, let the send attempt surface the error
        }

        let sender: any;
        if (isPrivyUser && privySolanaWallet && (privySolanaWallet as any).getProvider) {
            const provider = await (privySolanaWallet as any).getProvider();
            sender = { type: 'privy', publicKey: new PublicKey(privySolanaAddress), provider };
        } else if (wallet) {
            sender = { type: 'keypair', keypair: wallet };
        } else {
            Alert.alert('Error', 'No wallet connected.');
            return;
        }

        setIsSendingToken(true);
        try {
            const result = await sendSPLToken(connection, sender, depositTo, sellToken.mint, targetAmount, sellToken.decimals);
            if (result.success && result.signature) {
                Alert.alert(
                    'Success!',
                    `${sellToken.symbol} sent successfully. Your ${sellCurrency.currency} will arrive in ~5-10 minutes.`,
                    [{ text: 'Great', onPress: () => navigation.navigate('Wallet') }]
                );
            } else {
                Alert.alert('Transfer Failed', result.error || 'Unknown error occurred');
            }
        } catch (e: any) {
            Alert.alert('Transfer Error', e.message);
        } finally {
            setIsSendingToken(false);
        }
    };

    const handleSendEvm = async (depositTo: string, targetAmount: number) => {
        if (!isValidEvmAddress(depositTo)) {
            Alert.alert('Error', 'Flipeet returned an invalid deposit address. Please start a new order.');
            return;
        }
        if (!activeEvmAddress || !isValidEvmAddress(activeEvmAddress)) {
            Alert.alert('Error', 'No EVM wallet connected.');
            return;
        }
        setIsSendingToken(true);
        try {
            const gas = await getEvmGasBalance(sellChain.rpcUrls, activeEvmAddress as `0x${string}`);
            if (gas !== null && gas <= 0) {
                Alert.alert(
                    'Not enough gas',
                    `Your ${sellChain.name} wallet holds no ${sellChain.nativeSymbol} for network fees. Add a little ${sellChain.nativeSymbol} and try again.`
                );
                return;
            }
            let sender: any;
            if (privyEvmAddress && (privyEthWallet as any).getProvider) {
                const provider = await (privyEthWallet as any).getProvider();
                sender = { type: 'privy', provider, address: privyEvmAddress };
            } else {
                const pk = await exportEvmPrivateKey('ethereum' as any);
                if (!pk) {
                    Alert.alert('Error', 'Unlock your wallet to send, then try again.');
                    return;
                }
                sender = { type: 'keypair', privateKey: pk.startsWith('0x') ? pk : `0x${pk}` };
            }
            const result = await sendEvmToken({
                rpcUrls: sellChain.rpcUrls,
                evmChainId: sellChain.evmChainId!,
                token: sellToken.mint as `0x${string}`,
                decimals: sellToken.decimals,
                amount: targetAmount,
                to: depositTo as `0x${string}`,
                sender,
            });
            if (result.success && result.signature) {
                Alert.alert(
                    'Success!',
                    `${sellToken.symbol} sent successfully. Your ${sellCurrency.currency} will arrive in ~5-10 minutes.`,
                    [{ text: 'Great', onPress: () => navigation.navigate('Wallet') }]
                );
            } else {
                Alert.alert('Transfer Failed', result.error || 'Unknown error occurred');
            }
        } catch (e: any) {
            Alert.alert('Transfer Error', e.message);
        } finally {
            setIsSendingToken(false);
        }
    };

    const handleSendToken = async () => {
        const depositTo = depositData?.deposit?.address;
        const targetAmount = depositData?.deposit?.amount || parsedAmount;
        if (!depositTo) return;
        if (isSolana) await handleSendSolana(depositTo, targetAmount);
        else await handleSendEvm(depositTo, targetAmount);
    };

    const filteredBanks = banks.filter(b => (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    const currencyRecipients = savedRecipients.filter((r: any) => (r.currency || 'NGN') === sellCurrency.currency);

    const formatAdrs = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

    // ─── STEP 1: AMOUNT ────────────────────────────────────────────────────────
    const renderInput = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.inputContainer} keyboardShouldPersistTaps="handled">
                {/* Currency picker — opens modal */}
                <TouchableOpacity style={styles.fieldRow} onPress={() => setPickerOpen('currency')}>
                    <View style={styles.fieldLeft}>
                        <Text style={styles.fieldFlag}>{sellCurrency.flag}</Text>
                        <View>
                            <Text style={[styles.fieldValue, { color: currentTheme.text }]}>{sellCurrency.currency}</Text>
                            <Text style={[styles.fieldSub, { color: currentTheme.textLight }]}>
                                {sellCurrency.code === 'NG' ? 'Naira' : sellCurrency.code === 'KE' ? 'Shilling' : sellCurrency.code === 'GH' ? 'Cedi' : sellCurrency.code === 'ZA' ? 'Rand' : sellCurrency.code === 'TZ' ? 'Shilling' : 'Dirham'}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                </TouchableOpacity>

                <View style={[styles.fieldDivider, { backgroundColor: currentTheme.border }]} />

                {/* Asset + Network row — opens modal */}
                <TouchableOpacity style={styles.fieldRow} onPress={() => {
                    setTempChain(sellChain);
                    setTempToken(sellToken);
                    setPickerOpen('asset');
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

                <View style={styles.amountBlock}>
                    <TextInput
                        style={[styles.amountInput, { color: currentTheme.text }]}
                        placeholder="0"
                        placeholderTextColor={currentTheme.textLight}
                        keyboardType="numeric"
                        value={amountToken}
                        onChangeText={setAmountToken}
                        autoFocus
                    />
                    <Text style={[styles.amountSuffix, { color: currentTheme.textLight }]}>{sellToken.symbol}</Text>
                </View>

                <View style={styles.estimateRow}>
                    {loadingRate ? (
                        <ActivityIndicator size="small" color={currentTheme.textLight} />
                    ) : netFiat !== null ? (
                        <Text style={[styles.estimateText, { color: currentTheme.textLight }]}>
                            ≈ {sellCurrency.symbol}{Math.round(netFiat).toLocaleString()} {sellCurrency.currency}
                            {tokenBalance !== null ? `  ·  Balance: ${tokenBalance.toFixed(2)}` : ''}
                        </Text>
                    ) : (
                        <Text style={[styles.estimatePlaceholder, { color: currentTheme.textLight }]}>
                            Min {MIN_TOKEN} {sellToken.symbol}{sellCurrency.code === 'NG' ? ` · Min ${sellCurrency.symbol}${sellCurrency.minAmount.toLocaleString()}` : ''}
                        </Text>
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
                            <Text style={[styles.infoItemSub, { color: currentTheme.textLight }]}>{sellCurrency.currency} sent to your account after confirmation</Text>
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
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <LinearGradient
                    colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                    style={[styles.cta, !isValidAmount && styles.ctaDisabled]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.ctaInner}
                        onPress={() => {
                            if (sellCurrency.code === 'NG' && virtualBank && !selectedBank) {
                                setSelectedBank(virtualBank);
                                setAccountNumber(virtualBank.account_number);
                            }
                            setStep('BANK_DETAILS');
                        }}
                        disabled={!isValidAmount}
                    >
                        <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Continue</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </KeyboardAvoidingView>
    );

    // ─── STEP 2: PAYOUT DESTINATION ────────────────────────────────────────────
    const renderBankDetails = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.inputContainer} keyboardShouldPersistTaps="handled">
                <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Where should {sellCurrency.symbol}{netFiat ? Math.round(netFiat).toLocaleString() : ''} go?</Text>
                <Text style={[styles.sectionSub, { color: currentTheme.textLight }]}>
                    {sellCurrency.currency} will be sent here after your {sellToken.symbol} transfer is confirmed.
                </Text>

                {/* Saved / linked accounts first */}
                {currencyRecipients.length > 0 && (
                    <>
                        <Text style={[styles.groupLabel, { color: currentTheme.textLight }]}>SAVED ACCOUNTS</Text>
                        {currencyRecipients.map((r: any) => {
                            const active = selectedBank && !selectedBank.virtual && selectedBank.code === r.bank_code && accountNumber === r.account_number;
                            return (
                                <TouchableOpacity
                                    key={r.id}
                                    style={[styles.savedCard, active && styles.savedCardActive]}
                                    onPress={() => {
                                        setSelectedBank({ code: r.bank_code, name: r.bank_name });
                                        setAccountNumber(r.account_number || '');
                                        if (r.name) setAccountName(r.name);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.savedAvatar}>
                                        <Text style={styles.savedAvatarText}>{(r.name || r.bank_name || '?').charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.savedName, { color: currentTheme.text }]} numberOfLines={1}>{r.name || r.bank_name}</Text>
                                        <Text style={[styles.savedMeta, { color: currentTheme.textLight }]}>{r.bank_name} · {r.account_number}</Text>
                                    </View>
                                    {active
                                        ? <Ionicons name="checkmark-circle" size={22} color={currentTheme.textLight} />
                                        : <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                <Text style={[styles.groupLabel, { color: currentTheme.textLight }]}>OR USE ANOTHER ACCOUNT</Text>
                <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: currentTheme.textLight }]}>Select Bank</Text>
                    <TouchableOpacity style={[styles.bankSelector, { borderBottomColor: currentTheme.border }]} onPress={() => setShowBankModal(true)}>
                        {selectedBank?.virtual ? (
                            <View style={styles.vaSelectorIcon}>
                                <Ionicons name="wallet" size={16} color="#FFFFFF" />
                            </View>
                        ) : selectedBank?.logo ? (
                            <Image source={{ uri: selectedBank.logo }} style={styles.bankSelectorLogo} />
                        ) : (
                            <View style={[styles.bankSelectorLogo, { backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                                    {(selectedBank?.name || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.bankSelectorTextWrap}>
                            <Text style={[styles.bankSelectorText, { color: selectedBank ? currentTheme.text : currentTheme.textLight }]}>
                                {selectedBank ? selectedBank.name : 'Select your bank'}
                            </Text>
                            {selectedBank?.virtual && (
                                <Text style={[styles.bankSelectorSub, { color: currentTheme.textLight }]}>
                                    {selectedBank.bank_name} · {selectedBank.account_number}
                                </Text>
                            )}
                        </View>
                        <Ionicons name="chevron-down" size={18} color={currentTheme.textLight} />
                    </TouchableOpacity>
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: currentTheme.textLight }]}>Account Number</Text>
                    <TextInput
                        style={[styles.fieldInput, { borderBottomColor: currentTheme.border, color: currentTheme.text }]}
                        placeholder={sellCurrency.code === 'NG' ? '0123456789' : 'Account / mobile-money number'}
                        placeholderTextColor={currentTheme.textLight}
                        keyboardType={sellCurrency.code === 'NG' || sellCurrency.code === 'GB' ? 'numeric' : 'default'}
                        autoCapitalize="none"
                        maxLength={sellCurrency.code === 'NG' ? 10 : 34}
                        value={accountNumber}
                        onChangeText={t => setAccountNumber(sellCurrency.code === 'NG' ? t.replace(/[^0-9]/g, '') : t)}
                    />
                </View>

                {/* Account Name resolution indicator */}
                {selectedBank && accountNumber.trim().length >= (sellCurrency.code === 'NG' ? 10 : 3) && (
                    <View style={[styles.resolutionBox, { backgroundColor: currentTheme.card }]}>
                        {resolvingName ? (
                            <View style={styles.resolvingRow}>
                                <ActivityIndicator size="small" color={currentTheme.secondary} />
                                <Text style={[styles.resolvingText, { color: currentTheme.textLight }]}>Verifying account...</Text>
                            </View>
                        ) : accountName ? (
                            <View style={styles.resolvedRow}>
                                <Ionicons name="checkmark-circle" size={18} color={currentTheme.textLight} />
                                <Text style={[styles.resolvedName, { color: currentTheme.text }]}>{accountName}</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Summary */}
                <View style={[styles.summaryBox, { borderTopColor: currentTheme.border }]}>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: currentTheme.textLight }]}>You send</Text>
                        <Text style={[styles.summaryValue, { color: currentTheme.text }]}>{parsedAmount} {sellToken.symbol} · {sellChain.name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: currentTheme.textLight }]}>Fee (1%)</Text>
                        <Text style={[styles.summaryValue, { color: currentTheme.text }]}>− {sellCurrency.symbol}{sellFee ? Math.round(sellFee).toLocaleString() : '—'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: currentTheme.textLight }]}>You receive</Text>
                        <Text style={[styles.summaryValue, { color: currentTheme.text }]}>≈ {sellCurrency.symbol}{netFiat !== null ? Math.round(netFiat).toLocaleString() : '—'}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <LinearGradient
                    colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                    style={[styles.cta, (!accountNumber || !selectedBank || !accountName || isLoading) && styles.ctaDisabled]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <TouchableOpacity
                        style={styles.ctaInner}
                        onPress={handleInitialize}
                        disabled={!accountNumber || !selectedBank || !accountName || isLoading}
                    >
                        {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Confirm Details</Text>}
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </KeyboardAvoidingView>
    );

    // ─── STEP 3: DEPOSIT / SEND SCREEN ────────────────────────────────────────
    const renderDeposit = () => {
        const deposit = depositData?.deposit;
        const targetAmount = deposit?.amount || parsedAmount;
        const depositTo = deposit?.address;
        const fromLabel = isSolana
            ? (isPrivyUser && privySolanaAddress ? formatAdrs(privySolanaAddress) : (wallet?.publicKey ? formatAdrs(wallet.publicKey.toBase58()) : '...'))
            : (activeEvmAddress ? formatAdrs(activeEvmAddress) : '...');

        return (
            <View style={styles.depositScreen}>
                <ScrollView contentContainerStyle={styles.depositContent}>
                    {/* Header */}
                    <View style={styles.depositHeader}>
                        <Text style={[styles.depositTitle, { color: currentTheme.text }]}>Confirm Transfer</Text>
                        <Text style={[styles.depositAmount, { color: currentTheme.text }]}>{targetAmount} {sellToken.symbol}</Text>
                    </View>

                    {/* Flow card: From → To */}
                    <View style={[styles.flowCard, { backgroundColor: currentTheme.card }]}>
                        <View style={styles.flowRow}>
                            <View style={[styles.flowIcon, { backgroundColor: currentTheme.border }]}>
                                <Ionicons name="wallet" size={18} color={currentTheme.text} />
                            </View>
                            <View style={styles.flowInfo}>
                                <Text style={[styles.flowLabel, { color: currentTheme.textLight }]}>From</Text>
                                <Text style={[styles.flowValue, { color: currentTheme.text }]}>{fromLabel}</Text>
                            </View>
                            <Text style={[styles.flowBalance, { color: currentTheme.textLight }]}>
                                {tokenBalance !== null ? `${tokenBalance.toFixed(2)} ${sellToken.symbol}` : ''}
                            </Text>
                        </View>
                        <View style={[styles.flowLine, { backgroundColor: currentTheme.border }]} />
                        <View style={styles.flowRow}>
                            <View style={[styles.flowIcon, { backgroundColor: currentTheme.border }]}>
                                <Ionicons name="business" size={18} color={currentTheme.textLight} />
                            </View>
                            <View style={styles.flowInfo}>
                                <Text style={[styles.flowLabel, { color: currentTheme.textLight }]}>To</Text>
                                <Text style={[styles.flowValue, { color: currentTheme.text }]}>{formatAdrs(depositTo)}</Text>
                            </View>
                            <View style={[styles.flowBadge, { backgroundColor: currentTheme.primary }]}>
                                <Text style={[styles.flowBadgeText, { color: currentTheme.textLight }]}>Flipeet</Text>
                            </View>
                        </View>
                    </View>

                    {/* Detail card: Amount, Network, Fee */}
                    <View style={[styles.detailCard, { backgroundColor: currentTheme.card }]}>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: currentTheme.textLight }]}>Amount</Text>
                            <Text style={[styles.detailAmount, { color: currentTheme.text }]}>{targetAmount} {sellToken.symbol}</Text>
                        </View>
                        <View style={[styles.detailSep, { backgroundColor: currentTheme.border }]} />
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: currentTheme.textLight }]}>Network</Text>
                            <Text style={[styles.detailValue, { color: currentTheme.text }]}>{sellChain.name}</Text>
                        </View>
                        <View style={[styles.detailSep, { backgroundColor: currentTheme.border }]} />
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: currentTheme.textLight }]}>Fee</Text>
                            <Text style={[styles.detailValue, { color: currentTheme.text }]}>
                                {isSolana ? '≈ 0.000005 SOL' : `gas in ${sellChain.nativeSymbol}`}
                            </Text>
                        </View>
                    </View>

                    {/* Payout note */}
                    <View style={[styles.payoutCard, { backgroundColor: currentTheme.card }]}>
                        <Ionicons name="arrow-down" size={14} color={currentTheme.textLight} style={{ marginRight: 10 }} />
                        <Text style={[styles.payoutText, { color: currentTheme.textLight }]}>
                            <Text style={{ fontWeight: '600', color: currentTheme.text }}>{sellCurrency.symbol}{(targetAmount * (rate || 0)).toLocaleString()}</Text> deposited to <Text style={{ fontWeight: '600', color: currentTheme.text }}>{accountName}</Text>
                        </Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <LinearGradient
                        colors={[spendTheme.btnGreen, spendTheme.btnGreenDark]}
                        style={[styles.ctaSend, isSendingToken && styles.ctaDisabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <TouchableOpacity
                            style={styles.ctaSendInner}
                            onPress={handleSendToken}
                            disabled={isSendingToken}
                        >
                            {isSendingToken ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={[styles.ctaText, { color: '#FFFFFF' }]}>Send {targetAmount} {sellToken.symbol}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </View>
        );
    };

    const titles = { INPUT: 'Sell', BANK_DETAILS: 'Payout details', DEPOSIT: 'Send' };
    const onBack = () => {
        if (step === 'INPUT') navigation.goBack();
        else if (step === 'BANK_DETAILS') setStep('INPUT');
        else setStep('BANK_DETAILS');
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
                {step === 'INPUT' && renderInput()}
                {step === 'BANK_DETAILS' && renderBankDetails()}
                {step === 'DEPOSIT' && renderDeposit()}
            </SafeAreaView>

            {/* Bank bottom sheet */}
            <Modal
                visible={showBankModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowBankModal(false)}
            >
                <Pressable style={styles.sheetOverlay} onPress={() => setShowBankModal(false)}>
                    <Pressable
                        style={[styles.sheetContent, { backgroundColor: currentTheme.card }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.sheetHandle, { backgroundColor: currentTheme.border }]} />
                        <View style={[styles.sheetHeader, { borderBottomColor: currentTheme.border }]}>
                            <Text style={[styles.sheetHeaderTitle, { color: currentTheme.text }]}>
                                {sellCurrency.flag} {sellCurrency.code} Banks
                            </Text>
                            <TouchableOpacity onPress={() => setShowBankModal(false)} style={styles.sheetClose}>
                                <Text style={[styles.sheetCloseText, { color: currentTheme.textLight }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.searchBox, { backgroundColor: currentTheme.border }]}>
                            <Ionicons name="search" size={18} color={currentTheme.textLight} />
                            <TextInput
                                style={[styles.searchInput, { color: currentTheme.text }]}
                                placeholder="Search banks..."
                                placeholderTextColor={currentTheme.textLight}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                        </View>

                        {banksLoading ? (
                            <View style={styles.sheetCenter}>
                                <ActivityIndicator size="large" color={currentTheme.textLight} />
                                <Text style={[styles.sheetSub, { color: currentTheme.textLight, marginTop: 12 }]}>Loading {sellCurrency.code} banks…</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
                                {virtualBank && sellCurrency.code === 'NG' && (
                                    <>
                                        <Text style={[styles.sheetSectionLabel, { color: currentTheme.textLight }]}>YOUR ZEROSPEND ACCOUNT</Text>
                                        <TouchableOpacity
                                            style={[styles.sheetItem, selectedBank?.virtual && { backgroundColor: currentTheme.border }]}
                                            onPress={() => {
                                                setSelectedBank(virtualBank);
                                                setAccountNumber(virtualBank.account_number);
                                                setShowBankModal(false);
                                                setSearchQuery('');
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[styles.sheetItemLogo, { backgroundColor: currentTheme.accent, alignItems: 'center', justifyContent: 'center' }]}>
                                                <Ionicons name="wallet" size={16} color="#FFFFFF" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.sheetItemName, { color: currentTheme.text }]}>ZeroSpend Virtual Account</Text>
                                                <Text style={[styles.sheetItemSub, { color: currentTheme.textLight }]}>
                                                    {virtualBank.bank_name} · {virtualBank.account_number}
                                                </Text>
                                            </View>
                                            <View style={[styles.vaDefaultPill, { backgroundColor: currentTheme.border }]}>
                                                <Text style={[styles.vaDefaultPillText, { color: currentTheme.textLight }]}>Default</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <Text style={[styles.sheetSectionLabel, { color: currentTheme.textLight, marginTop: 8 }]}>ALL BANKS</Text>
                                    </>
                                )}
                                {filteredBanks.map((b) => {
                                    const active = selectedBank?.code === b.code && !selectedBank?.virtual;
                                    return (
                                        <TouchableOpacity
                                            key={`${b.code}-${b.name}`}
                                            style={[styles.sheetItem, active && { backgroundColor: currentTheme.border }]}
                                            onPress={() => {
                                                setSelectedBank(b);
                                                setShowBankModal(false);
                                                setSearchQuery('');
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            {b.logo ? (
                                                <Image source={{ uri: b.logo }} style={styles.sheetItemLogo} />
                                            ) : (
                                                <View style={[styles.sheetItemLogo, { backgroundColor: currentTheme.border, alignItems: 'center', justifyContent: 'center' }]}>
                                                    <Text style={[styles.sheetBankFallbackText, { color: currentTheme.textLight }]}>{b.name.charAt(0).toUpperCase()}</Text>
                                                </View>
                                            )}
                                            <Text style={[styles.sheetItemName, { color: currentTheme.text }]}>{b.name}</Text>
                                            {active
                                                ? <Ionicons name="checkmark-circle" size={22} color={currentTheme.accent} />
                                                : <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />}
                                        </TouchableOpacity>
                                    );
                                })}
                                {filteredBanks.length === 0 && !(virtualBank && sellCurrency.code === 'NG') && (
                                    <Text style={[styles.sheetItemSub, { color: currentTheme.textLight, textAlign: 'center', marginTop: 24 }]}>
                                        No banks found{banks.length === 0 ? ` for ${sellCurrency.code} yet` : ''}.
                                    </Text>
                                )}
                            </ScrollView>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Asset / Network picker bottom sheet */}
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
                                {pickerOpen === 'currency' ? 'Receive Currency' : pickerOpen === 'network' ? 'Network' : 'Sell Asset'}
                            </Text>
                            <TouchableOpacity onPress={() => setPickerOpen(null)} style={styles.sheetClose}>
                                <Text style={[styles.sheetCloseText, { color: currentTheme.textLight }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.sheetList} keyboardShouldPersistTaps="handled">
                            {/* Currency picker */}
                            {pickerOpen === 'currency' && (
                                <>
                                    {SELL_CURRENCIES.map((cur) => {
                                        const active = sellCurrency.code === cur.code;
                                        return (
                                            <TouchableOpacity
                                                key={cur.code}
                                                style={[styles.sheetItem, active && { backgroundColor: currentTheme.border }]}
                                                onPress={() => {
                                                    pickCurrency(cur);
                                                    setPickerOpen(null);
                                                }}
                                            >
                                                <Text style={styles.sheetItemFlag}>{cur.flag}</Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.sheetItemName, { color: currentTheme.text }]}>{cur.currency}</Text>
                                                    <Text style={[styles.sheetItemSub, { color: currentTheme.textLight }]}>
                                                        Min {cur.symbol}{cur.minAmount.toLocaleString()}
                                                    </Text>
                                                </View>
                                                {active && <Ionicons name="checkmark-circle" size={22} color={currentTheme.textLight} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}

                            {/* Network picker */}
                            {(pickerOpen === 'asset' || pickerOpen === 'network') && (
                                <>
                                    <Text style={[styles.sheetSectionLabel, { color: currentTheme.textLight }]}>NETWORK</Text>
                                    {SELL_CHAINS.map((chain) => {
                                        const active = tempChain.id === chain.id;
                                        return (
                                            <TouchableOpacity
                                                key={chain.id}
                                                style={[styles.sheetItem, active && { backgroundColor: currentTheme.border }]}
                                                onPress={() => {
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
                                                        {chain.id === 'solana' ? 'Fast · low fees' : `Gas: ${chain.nativeSymbol}`}
                                                    </Text>
                                                </View>
                                                {active && <Ionicons name="checkmark-circle" size={22} color={currentTheme.textLight} />}
                                            </TouchableOpacity>
                                        );
                                    })}

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
                                </>
                            )}
                        </ScrollView>

                        {/* Confirm for asset/network picker */}
                        {(pickerOpen === 'asset' || pickerOpen === 'network') && (
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
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
    inputContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

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
    fieldFlag: { fontSize: 28 },
    fieldLogo: { width: 32, height: 32, borderRadius: 16 },
    fieldValue: { fontSize: 16, fontWeight: '600' },
    fieldSub: { fontSize: 12, marginTop: 1 },
    fieldDivider: { height: 1, marginVertical: 4, opacity: 0.3 },
    radio: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.4)',
        alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: 'rgba(128,128,128,0.7)' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(128,128,128,0.6)' },

    // Amount step
    amountBlock: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, marginTop: 18 },
    amountInput: { fontSize: 64, fontWeight: '200', flex: 1 },
    amountSuffix: { fontSize: 22, fontWeight: '600', marginBottom: 10, marginLeft: 8 },
    estimateRow: { minHeight: 28, justifyContent: 'center', marginBottom: 28 },
    estimateText: { fontSize: 15, fontWeight: '500' },
    estimatePlaceholder: { fontSize: 14 },
    infoList: { marginBottom: 20 },
    infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14 },
    infoIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    infoItemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    infoItemSub: { fontSize: 12 },

    // Payout destination
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    sectionSub: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
    groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
    savedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(128,128,128,0.2)',
        backgroundColor: 'rgba(128,128,128,0.07)',
    },
    savedCardActive: { borderColor: 'rgba(128,128,128,0.5)', backgroundColor: 'rgba(128,128,128,0.1)' },
    savedAvatar: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: 'rgba(128,128,128,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    savedAvatarText: { fontSize: 16, fontWeight: '700', color: '#6C757D' },
    savedName: { fontSize: 15, fontWeight: '600' },
    savedMeta: { fontSize: 12, marginTop: 2 },
    fieldGroup: { marginBottom: 16, marginTop: 6 },
    fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    fieldInput: {
        borderBottomWidth: 1,
        fontSize: 16,
        paddingVertical: 10,
    },
    bankSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingVertical: 10,
    },
    bankSelectorLogo: { width: 24, height: 24, borderRadius: 12, marginRight: 10 },
    bankSelectorText: { flex: 1, fontSize: 16 },
    bankSelectorTextWrap: { flex: 1, marginRight: 8 },
    bankSelectorSub: { fontSize: 12, marginTop: 1 },
    vaSelectorIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(128,128,128,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },

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
    sheetItemFlag: { fontSize: 24, marginRight: 12 },
    sheetItemLogo: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
    sheetItemName: { fontSize: 15, fontWeight: '600' },
    sheetItemSub: { fontSize: 12, marginTop: 1 },
    sheetFooter: { paddingHorizontal: 20, paddingTop: 8 },
    sheetConfirmBtn: { height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    sheetConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    // Resolution logic
    resolutionBox: {
        marginTop: -4,
        marginBottom: 20,
        borderRadius: 8,
        padding: 12,
    },
    resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resolvingText: { fontSize: 13 },
    resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resolvedName: { fontSize: 14, fontWeight: '600' },

    summaryBox: {
        marginTop: 8,
        paddingTop: 20,
        borderTopWidth: 1,
        gap: 10,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 13 },
    summaryValue: { fontSize: 14, fontWeight: '600' },

    // DEPOSIT SCREEN
    depositScreen: { flex: 1 },
    depositContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
    depositHeader: { marginBottom: 28 },
    depositTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
    depositAmount: { fontSize: 36, fontWeight: '700', letterSpacing: -0.5 },

    flowCard: { borderRadius: 16, padding: 20, marginBottom: 14 },
    flowRow: { flexDirection: 'row', alignItems: 'center' },
    flowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    flowInfo: { flex: 1 },
    flowLabel: { fontSize: 12, marginBottom: 2 },
    flowValue: { fontSize: 14, fontWeight: '600' },
    flowBalance: { fontSize: 12, fontWeight: '500' },
    flowLine: { height: 1, marginVertical: 14, marginLeft: 6 },
    flowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    flowBadgeText: { fontSize: 11, fontWeight: '600' },

    detailCard: { borderRadius: 16, padding: 20, marginBottom: 14 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    detailLabel: { fontSize: 14 },
    detailAmount: { fontSize: 20, fontWeight: '700' },
    detailValue: { fontSize: 14, fontWeight: '600' },
    detailSep: { height: 1, marginVertical: 6 },

    payoutCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 14 },
    payoutText: { flex: 1, fontSize: 13, lineHeight: 18 },

    // Bank bottom sheet
    sheetContainer: { flex: 1, paddingTop: 8 },
    sheetTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    sheetSub: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 6 },
    sheetSection: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 14, marginBottom: 4 },
    searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginVertical: 10, paddingHorizontal: 14, borderRadius: 14, height: 48, gap: 8 },
    searchInput: { flex: 1, fontSize: 15 },
    sheetCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    sheetList: { paddingHorizontal: 20, paddingBottom: 40 },
    vaDefaultPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    vaDefaultPillText: { fontSize: 10, fontWeight: '700' },
    sheetBankFallbackText: { fontSize: 16, fontWeight: '700' },

    // Shared
    footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 16 : 24, backgroundColor: 'transparent' },
    cta: { height: 58, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    ctaInner: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' },
    ctaSend: { height: 58, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    ctaSendInner: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    ctaDisabled: { opacity: 0.3 },
    ctaText: { fontSize: 17, fontWeight: '700' },
});

export default WithdrawScreen;
