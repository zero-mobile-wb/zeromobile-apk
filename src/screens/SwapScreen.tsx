import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    TextInput,
    Image,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { VersionedTransaction } from '@solana/web3.js';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import TokenSelectorModal, { SelectableToken } from '../components/TokenSelectorModal';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance } from '../services/balanceService';
import { fetchPreStockBalances, PreStockBalance } from '../services/prestockService';
import * as deloraService from '../services/deloraService';
import type { DeloraChain } from '../services/deloraService';
import { useEmbeddedSolanaWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';

const POPULAR_TOKENS = [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
    { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
    { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6, logoURI: 'https://static.jup.ag/jup/icon.png' },
    { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5, logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
    { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', decimals: 6, logoURI: 'https://bafkreibky2fsxyhowtusccukvscylb5h2m3u2j76z3f5emscdtsahxukhm.ipfs.nftstorage.link/' }
];

const CHAIN_PNG_LOGOS: Record<number, string> = {
    1000000001: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
    1: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    8453: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    137: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    42161: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    10: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    56: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    43114: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
    42220: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png',
    5000: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/mantle/info/logo.png',
    25: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cronos/info/logo.png',
    100: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png',
    1088: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/metis/info/logo.png',
    143: 'https://static.debank.com/image/monad_token/logo_url/monad/9df1611d238781f78045fba9101359a3.png',
    146: 'https://static.debank.com/image/sonic_token/logo_url/0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38/b4cc70d040518a88adac18d906fcbfff.png',
    999: 'https://static.debank.com/image/hyper_token/logo_url/hyper/0b3e288cfe418e9ce69eef4c96374583.png',
    9745: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png',
    80094: 'https://s2.coinmarketcap.com/static/img/coins/64x64/30179.png',
};

const FALLBACK_CHAINS: DeloraChain[] = [
    { key: 'sol', name: 'Solana', chainType: 'SVM', id: 1000000001, logoURI: CHAIN_PNG_LOGOS[1000000001], nativeToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', decimals: 9, name: 'Solana' } },
];

const getChainLogo = (chain: DeloraChain): string | undefined => {
    const url = CHAIN_PNG_LOGOS[chain.id] || chain.nativeToken?.logoURI || chain.logoURI;
    if (url) console.log(`getChainLogo(${chain.name}): ${url.substring(0, 80)}`);
    return url;
};

interface SwapScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Swap'>;
    route: RouteProp<RootStackParamList, 'Swap'>;
}

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation, route }) => {
    const { currentTheme, themeId } = useTheme();
    const { wallet, connection, evmWallets, activeSolanaAddress, isPrivyUser } = useWallet();
    const privySolanaWallet = useEmbeddedSolanaWallet();
    const routeParams = route.params;

    const [fromAmount, setFromAmount] = useState<string>('');
    const [toAmountConfig, setToAmountConfig] = useState<string>('');

    const [fromToken, setFromToken] = useState<SelectableToken | null>(null);
    const [toToken, setToToken] = useState<SelectableToken | null>(null);

    // Real on-chain balances keyed by mint, merged into Delora token metadata
    const [balancesMap, setBalancesMap] = useState<Record<string, { balance: number; priceUSD: number }>>({});
    const [balancesLoading, setBalancesLoading] = useState(false);

    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
    const [selectingSide, setSelectingSide] = useState<'from' | 'to'>('from');

    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);

    // Delora-specific
    const [deloraQuote, setDeloraQuote] = useState<any>(null);
    const [deloraChains, setDeloraChains] = useState<DeloraChain[]>(FALLBACK_CHAINS);
    const [originChain, setOriginChain] = useState<DeloraChain>(FALLBACK_CHAINS[0]);
    const [destChain, setDestChain] = useState<DeloraChain>(FALLBACK_CHAINS[0]);
    const [showChainPicker, setShowChainPicker] = useState<'origin' | 'dest' | null>(null);
    const [deloraTokens, setDeloraTokens] = useState<SelectableToken[]>([]);
    const [preStockTokens, setPreStockTokens] = useState<PreStockBalance[]>([]);

    // Init tokens on mount
    useEffect(() => {
        let cancelled = false;
        const initTokens = async () => {
            if (!activeSolanaAddress) return;
            setBalancesLoading(true);
            try {
                const pubkey = new PublicKey(activeSolanaAddress);
                const balance = await Promise.race([
                    getWalletBalance(pubkey, connection),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
                ]);
                if (cancelled) return;

                // Build real-balance map keyed by mint so Delora tokens show actual balances
                const map: Record<string, { balance: number; priceUSD: number }> = {};
                map['So11111111111111111111111111111111111111112'] = {
                    balance: balance.solBalance,
                    priceUSD: balance.solBalance > 0 ? balance.solValueUSD / balance.solBalance : 0,
                };
                map['11111111111111111111111111111111'] = {
                    balance: balance.solBalance,
                    priceUSD: balance.solBalance > 0 ? balance.solValueUSD / balance.solBalance : 0,
                };
                for (const t of balance.tokens) {
                    map[t.mint] = { balance: t.uiAmount, priceUSD: t.priceUSD };
                }
                setBalancesMap(map);

                const userTokens: SelectableToken[] = [
                    {
                        mint: 'So11111111111111111111111111111111111111112',
                        name: 'Solana',
                        symbol: 'SOL',
                        balance: balance.solBalance,
                        priceUSD: balance.solBalance > 0 ? balance.solValueUSD / balance.solBalance : 0,
                        valueUSD: balance.solValueUSD,
                        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                    },
                    ...balance.tokens.map(t => ({
                        mint: t.mint, name: t.name, symbol: t.symbol,
                        balance: t.uiAmount, priceUSD: t.priceUSD, valueUSD: t.valueUSD, logoURI: t.logoURI,
                    }))
                ];

                const combined = [...userTokens];
                for (const pop of POPULAR_TOKENS) {
                    if (!combined.find(t => t.mint === pop.mint)) {
                        combined.push({
                            mint: pop.mint, name: pop.name, symbol: pop.symbol,
                            balance: 0, priceUSD: 0, valueUSD: 0, logoURI: pop.logoURI
                        });
                    }
                }

                // Fetch pre-stock balances and add to combined
                let preStockBalances: PreStockBalance[] = [];
                try {
                    preStockBalances = await fetchPreStockBalances(connection, activeSolanaAddress);
                    if (!cancelled) setPreStockTokens(preStockBalances);
                } catch (e) {
                    console.error('PreStock fetch in initTokens error:', e);
                }

                for (const ps of preStockBalances) {
                    if (!combined.find(t => t.mint === ps.contract_address)) {
                        combined.push({
                            mint: ps.contract_address,
                            name: ps.name,
                            symbol: ps.symbol,
                            balance: ps.balance,
                            priceUSD: ps.priceUSD,
                            valueUSD: ps.usdValue,
                            logoURI: ps.image,
                        });
                    }
                }

                if (!cancelled) {
                    // If route params are provided, use them to set initial tokens
                    if (routeParams?.inputToken || routeParams?.outputToken) {
                        if (routeParams.inputToken) {
                            const inputTok = combined.find(t => 
                                t.mint === routeParams.inputToken || t.symbol === routeParams.inputSymbol
                            );
                            if (inputTok) setFromToken(inputTok);
                        }
                        if (routeParams.outputToken) {
                            const outputTok = combined.find(t => 
                                t.mint === routeParams.outputToken || t.symbol === routeParams.outputSymbol
                            );
                            if (outputTok) setToToken(outputTok);
                        }
                    } else {
                        // Default: SOL from, USDC to
                        if (!fromToken) setFromToken(combined[0] || null);
                        if (!toToken) setToToken(combined.find(c => c.symbol === 'USDC') || combined[1] || null);
                    }
                }
            } catch (error) {
                console.error("Init tokens error:", error);
                if (!cancelled) {
                    if (routeParams?.inputToken || routeParams?.outputToken) {
                        // Try to set from route params even on error
                        if (routeParams.inputToken) {
                            const inputTok = POPULAR_TOKENS.find(t => 
                                t.mint === routeParams.inputToken || t.symbol === routeParams.inputSymbol
                            );
                            if (inputTok) setFromToken({
                                mint: inputTok.mint, name: inputTok.name, symbol: inputTok.symbol,
                                balance: 0, priceUSD: 0, valueUSD: 0, logoURI: inputTok.logoURI
                            });
                        }
                        if (routeParams.outputToken) {
                            const outputTok = POPULAR_TOKENS.find(t => 
                                t.mint === routeParams.outputToken || t.symbol === routeParams.outputSymbol
                            );
                            if (outputTok) setToToken({
                                mint: outputTok.mint, name: outputTok.name, symbol: outputTok.symbol,
                                balance: 0, priceUSD: 0, valueUSD: 0, logoURI: outputTok.logoURI
                            });
                        }
                    } else {
                        if (!fromToken) setFromToken(POPULAR_TOKENS[0] ? {
                            mint: POPULAR_TOKENS[0].mint, name: POPULAR_TOKENS[0].name, symbol: POPULAR_TOKENS[0].symbol,
                            balance: 0, priceUSD: 0, valueUSD: 0, logoURI: POPULAR_TOKENS[0].logoURI
                        } : null);
                        if (!toToken) setToToken(POPULAR_TOKENS[1] ? {
                            mint: POPULAR_TOKENS[1].mint, name: POPULAR_TOKENS[1].name, symbol: POPULAR_TOKENS[1].symbol,
                            balance: 0, priceUSD: 0, valueUSD: 0, logoURI: POPULAR_TOKENS[1].logoURI
                        } : null);
                    }
                }
            } finally {
                if (!cancelled) setBalancesLoading(false);
            }
        };
        initTokens();
        return () => { cancelled = true; };
    }, [activeSolanaAddress, connection]);

    // Merge pre-stock tokens into deloraTokens so they appear in the token selector
    useEffect(() => {
        if (preStockTokens.length === 0) return;
        const preStockMapped = preStockTokens.map(ps => ({
            mint: ps.contract_address,
            name: ps.name,
            symbol: ps.symbol,
            balance: ps.balance,
            priceUSD: ps.priceUSD,
            valueUSD: ps.usdValue,
            logoURI: ps.image,
            chainId: originChain.id,
        }));
        setDeloraTokens(prev => {
            const existingMints = new Set(prev.map(t => t.mint));
            const newTokens = preStockMapped.filter(t => !existingMints.has(t.mint));
            return newTokens.length > 0 ? [...prev, ...newTokens] : prev;
        });
    }, [preStockTokens, originChain.id]);

    // Fetch available chains from Delora API
    useEffect(() => {
        let cancelled = false;
        const fetchChains = async () => {
            try {
                const [evmChains, svmChains] = await Promise.all([
                    deloraService.getChains('evm'),
                    deloraService.getChains('svm'),
                ]);
                if (!cancelled) {
                    const all = [...svmChains, ...evmChains];
                    setDeloraChains(all.length > 0 ? all : FALLBACK_CHAINS);
                    setOriginChain(all.find(c => c.chainType === 'SVM') || FALLBACK_CHAINS[0]);
                    setDestChain(all.find(c => c.chainType === 'SVM') || all[0] || FALLBACK_CHAINS[0]);
                }
            } catch (err) {
                console.error("Failed to fetch Delora chains:", err);
            }
        };
        fetchChains();
        return () => { cancelled = true; };
    }, []);

    // Fetch Delora tokens when chain selection changes
    useEffect(() => {
        let cancelled = false;
        const fetchDeloraTokens = async () => {
            try {
                const result = await deloraService.getTokens([originChain.id, destChain.id]);
                if (cancelled) return;

                const mapped: SelectableToken[] = [];
                const seen = new Set<string>();
                for (const chainIdStr in result) {
                    const chainId = parseInt(chainIdStr);
                    const chainTokens = result[chainIdStr];
                    for (const t of chainTokens) {
                        const key = `${t.address}:${chainId}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            const bal = balancesMap[t.address];
                            mapped.push({
                                mint: t.address,
                                name: t.name,
                                symbol: t.symbol,
                                decimals: t.decimals,
                                balance: bal?.balance ?? 0,
                                priceUSD: bal?.priceUSD ?? parseFloat(t.priceUSD || '0'),
                                valueUSD: 0,
                                logoURI: t.logoURI,
                                chainId,
                            });
                        }
                    }
                }

                if (!cancelled) {
                    const preStockMapped = preStockTokens.map(ps => ({
                        mint: ps.contract_address,
                        name: ps.name,
                        symbol: ps.symbol,
                        balance: ps.balance,
                        priceUSD: ps.priceUSD,
                        valueUSD: ps.usdValue,
                        logoURI: ps.image,
                        chainId: originChain.id,
                    }));
                    const combinedMapped = [...mapped];
                    for (const ps of preStockMapped) {
                        if (!combinedMapped.find(t => t.mint === ps.mint)) {
                            combinedMapped.push(ps);
                        }
                    }
                    setDeloraTokens(combinedMapped);
                }
            } catch (err) {
                console.error("Failed to fetch Delora tokens:", err);
            }
        };

        fetchDeloraTokens();
        return () => { cancelled = true; };
    }, [originChain.id, destChain.id, balancesMap]);

    // Auto-reset tokens when chains change, and sync real balances into selected tokens
    useEffect(() => {
        if (deloraTokens.length === 0) return;
        const originTokens = deloraTokens.filter(t => t.chainId === originChain.id);
        const destTokens = deloraTokens.filter(t => t.chainId === destChain.id);
        const sameChain = originChain.id === destChain.id;
        if (originTokens.length > 0 && (!fromToken || fromToken.chainId !== originChain.id)) {
            setFromToken(originTokens[0]);
        }
        if (destTokens.length > 0) {
            // For same-chain swaps, pick a different token as the destination
            const destToken = sameChain
                ? destTokens.find(t => t.mint !== fromToken?.mint) || destTokens[1] || destTokens[0]
                : destTokens[0];
            if (!toToken || toToken.chainId !== destChain.id || (sameChain && toToken.mint === fromToken?.mint)) {
                setToToken(destToken);
            }
        }
        // Refresh balances on the already-selected tokens (deloraTokens carry fresh balance data)
        setFromToken(prev => {
            if (!prev) return prev;
            const freshest = originTokens.find(t => t.mint === prev.mint);
            return freshest ? { ...prev, balance: freshest.balance, priceUSD: freshest.priceUSD } : prev;
        });
        setToToken(prev => {
            if (!prev) return prev;
            const freshest = destTokens.find(t => t.mint === prev.mint);
            return freshest ? { ...prev, balance: freshest.balance, priceUSD: freshest.priceUSD } : prev;
        });
    }, [originChain.id, destChain.id, deloraTokens]);

    // Delora quote via Delora API
    useEffect(() => {
        const hasWallet = isPrivyUser ? !!activeSolanaAddress : !!wallet;
        if (!fromAmount || parseFloat(fromAmount) <= 0 || !fromToken || !toToken || !hasWallet) {
            setDeloraQuote(null);
            setToAmountConfig('');
            setIsLoadingQuote(false);
            return;
        }

        if ((fromToken.chainId && fromToken.chainId !== originChain.id) ||
            (toToken.chainId && toToken.chainId !== destChain.id)) {
            setDeloraQuote(null);
            setToAmountConfig('');
            setIsLoadingQuote(false);
            return;
        }

        const sender = getAddressForChain(originChain);
        const receiver = getAddressForChain(destChain);
        if (!sender || !receiver) {
            setDeloraQuote(null);
            setToAmountConfig('');
            setIsLoadingQuote(false);
            return;
        }

        // Show loading state immediately; the timeout only delays the network call
        setIsLoadingQuote(true);

        const fetchDeloraQuote = async () => {
            try {
                const fromDecimals = fromToken.decimals || (fromToken.mint === originChain.nativeToken.address ? originChain.nativeToken.decimals : 6);
                const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromDecimals)).toString();

                const sameType = originChain.chainType === destChain.chainType;
                const swapValueUSD = parseFloat(fromAmount) * (fromToken.priceUSD || 0);
                const targetFeeUSD = sameType ? 0.50 : 1.00;
                const fee = swapValueUSD > 0 ? Math.min(targetFeeUSD / swapValueUSD, 0.05) : (sameType ? 0.005 : 0.01);

                const quote = await deloraService.getQuote({
                    originChainId: originChain.id,
                    destinationChainId: destChain.id,
                    amount,
                    originCurrency: fromToken.mint,
                    destinationCurrency: toToken.mint,
                    senderAddress: sender,
                    receiverAddress: receiver,
                    slippage: 0.005,
                    fee,
                    integrator: 'zeromobile',
                });

                setDeloraQuote(quote);
                const toDecimals = toToken.decimals || (toToken.mint === destChain.nativeToken.address ? destChain.nativeToken.decimals : 6);
                const outAmount = parseInt(quote.outputAmount) / Math.pow(10, toDecimals);
                setToAmountConfig(outAmount.toFixed(6));
            } catch (err: any) {
                console.error("Delora Quote Error:", err.message);
                setDeloraQuote(null);
                setToAmountConfig('');
            } finally {
                setIsLoadingQuote(false);
            }
        };

        const timeoutId = setTimeout(fetchDeloraQuote, 250);
        return () => clearTimeout(timeoutId);
    }, [fromAmount, fromToken, toToken, originChain, destChain, wallet, evmWallets, isPrivyUser, activeSolanaAddress]);

    const handleSwap = async () => {
        await handleDeloraSwap();
    };

    // Poll the actual on-chain status until confirmed/finalized or timeout.
    // Returns 'confirmed' | 'failed' | 'pending' so we never claim success prematurely.
    const confirmSwapSignature = async (signature: string, timeoutMs = 40000): Promise<'confirmed' | 'failed' | 'pending'> => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
                const value = status?.value;
                if (value && value.err) {
                    return 'failed';
                }
                if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
                    return 'confirmed';
                }
            } catch (e: any) {
                // transient RPC error — keep polling
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        return 'pending';
    };

    const handleDeloraSwap = async () => {
        const hasWallet = isPrivyUser ? !!activeSolanaAddress : !!wallet;
        if (!deloraQuote || !hasWallet) return;

        const amount = parseFloat(fromAmount);
        if (isNaN(amount) || amount <= 0) return;

        if (amount > (fromToken?.balance || 0)) {
            Alert.alert('Insufficient Balance', `You only have ${fromToken?.balance?.toFixed(4)} ${fromToken?.symbol}`);
            return;
        }

        // Native SOL swaps must leave room for token-account rent + fees (~0.005 SOL)
        const isNativeSol = fromToken?.mint === 'So11111111111111111111111111111111111111112'
            || fromToken?.mint === '11111111111111111111111111111111';
        const SOL_RESERVE = 0.005;
        if (isNativeSol && (fromToken?.balance || 0) < SOL_RESERVE) {
            Alert.alert(
                'Insufficient SOL',
                'Your wallet needs a small SOL balance to cover network fees and token account creation. Please add at least ~0.005 SOL and try again.'
            );
            return;
        }
        if (isNativeSol && amount > ((fromToken?.balance || 0) - SOL_RESERVE)) {
            Alert.alert(
                'Keep Some SOL',
                `Swapping all your SOL won't cover the network fees. Leave at least ${SOL_RESERVE} SOL for fees and rent.`
            );
            return;
        }

        if (!deloraQuote.calldata?.data) {
            Alert.alert('Error', 'No transaction data in quote response');
            return;
        }

        setIsSwapping(true);
        let signature: string | null = null;
        try {
            const transactionBuffer = Uint8Array.from(atob(deloraQuote.calldata.data), c => c.charCodeAt(0));
            const transaction = VersionedTransaction.deserialize(transactionBuffer);

            if (isPrivyUser) {
                const provider = await privySolanaWallet.getProvider?.();
                if (!provider) throw new Error('Privy provider unavailable');

                const { signAndSendWithPrivy } = await import('../services/transactionService');
                signature = await signAndSendWithPrivy(connection, transaction as any, provider);
            } else {
                if (!wallet) throw new Error('No wallet');
                transaction.sign([wallet]);
                const rawTransaction = transaction.serialize();
                signature = await connection.sendRawTransaction(rawTransaction, {
                    skipPreflight: false,
                    maxRetries: 3,
                });
            }

            console.log("Delora swap TX sent:", signature);

            const result = await confirmSwapSignature(signature);
            if (result === 'failed') {
                throw new Error('Transaction failed on-chain. Your swap did not complete.');
            }

            const originName = originChain.name;
            const destName = destChain.name;
            const crossChain = originChain.id !== destChain.id;

            if (result === 'confirmed') {
                Alert.alert('Swap Successful', crossChain
                    ? `Cross-chain swap completed!\n${originName} → ${destName}`
                    : `Swap completed on ${originName}!`);
            } else {
                Alert.alert(
                    'Transaction Submitted',
                    `Your swap was submitted but we couldn't confirm it yet.\nTX: ${signature?.substring(0, 12)}…\nCheck Activity shortly.`
                );
            }

            setFromAmount('');
            setDeloraQuote(null);
            setToAmountConfig('');
        } catch (error: any) {
            console.error("Delora Swap Error:", error);
            const msg = error?.message || 'Unknown error occurred';
            if (msg.includes('insufficient lamports')) {
                Alert.alert(
                    'Not Enough SOL for Fees',
                    'Your wallet has too little SOL to cover the swap plus network fees and the cost of creating a token account. Add at least ~0.005 SOL to your wallet and try again.'
                );
            } else {
                Alert.alert('Swap Failed', msg);
            }
        } finally {
            setIsSwapping(false);
        }
    };

    const openTokenSelector = (side: 'from' | 'to') => {
        setSelectingSide(side);
        setIsTokenSelectorOpen(true);
    };

    const onTokenSelect = (token: SelectableToken) => {
        if (selectingSide === 'from') {
            if (token.mint === toToken?.mint) setToToken(fromToken);
            setFromToken(token);
        } else {
            if (token.mint === fromToken?.mint) setFromToken(toToken);
            setToToken(token);
        }
        setIsTokenSelectorOpen(false);
    };

    const switchTokens = () => {
        setFromToken(toToken);
        setToToken(fromToken);
        setFromAmount(toAmountConfig);
    };

    const getAddressForChain = (chain: DeloraChain): string | undefined => {
        if (chain.chainType === 'SVM') return activeSolanaAddress ?? undefined;
        if (chain.id === 1) return evmWallets.find(w => w.chainId === 'ethereum')?.address;
        return evmWallets[0]?.address;
    };

    const renderQuoteInfo = () => {
        if (isLoadingQuote) {
            return (
                <View style={styles.quoteInfo}>
                    <Text style={[styles.quoteText, { color: currentTheme.textLight, opacity: 0.7 }]}>
                        Calculating the best route…
                    </Text>
                </View>
            );
        }
        if (deloraQuote) {
            const sameType = originChain.chainType === destChain.chainType;
            const feePct = sameType ? '0.5%' : '1%';
            return (
                <View style={styles.quoteInfo}>
                    <Text style={[styles.quoteText, { color: currentTheme.textLight }]}>
                        Route: {deloraQuote.adapter} | Fee: ${deloraQuote.fees?.totalUsd || '0.00'} ({feePct})
                    </Text>
                </View>
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header title="Swap" showViewToggle={false} />

            <View style={styles.content}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Route Card - same-chain by default, cross-chain when dest chain changes */}
                    <View style={[styles.routeCard, { backgroundColor: currentTheme.card }]}>
                        <TouchableOpacity style={styles.routeSide} onPress={() => setShowChainPicker('origin')}>
                            <View style={[styles.routeBadge, { backgroundColor: currentTheme.border }]}>
                                <Text style={[styles.routeBadgeText, { color: currentTheme.text }]}>{originChain.name[0]}</Text>
                                {getChainLogo(originChain) && (
                                    <Image source={{ uri: getChainLogo(originChain)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                )}
                            </View>
                            <View style={styles.routeSideInfo}>
                                <Text style={[styles.routeSideLabel, { color: currentTheme.textLight }]}>from</Text>
                                <Text style={[styles.routeSideValue, { color: currentTheme.text }]} numberOfLines={1}>{originChain.name}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={14} color={currentTheme.textLight} />
                        </TouchableOpacity>
                        <View style={[styles.routeDivider, { backgroundColor: currentTheme.border }]} />
                        <TouchableOpacity style={styles.routeSide} onPress={() => setShowChainPicker('dest')}>
                            <View style={[styles.routeBadge, { backgroundColor: currentTheme.border }]}>
                                <Text style={[styles.routeBadgeText, { color: currentTheme.text }]}>{destChain.name[0]}</Text>
                                {getChainLogo(destChain) && (
                                    <Image source={{ uri: getChainLogo(destChain)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                )}
                            </View>
                            <View style={styles.routeSideInfo}>
                                <Text style={[styles.routeSideLabel, { color: currentTheme.textLight }]}>to</Text>
                                <Text style={[styles.routeSideValue, { color: currentTheme.text }]} numberOfLines={1}>{destChain.name}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={14} color={currentTheme.textLight} />
                        </TouchableOpacity>
                    </View>

                    {/* FROM SECTION */}
                    <View style={styles.inputBox}>
                        <View style={styles.inputHeader}>
                            <Text style={[styles.label, { color: currentTheme.textLight }]}>You Pay</Text>
                            <View style={styles.inputHeaderRight}>
                                {balancesLoading ? (
                                    <ActivityIndicator size="small" color={currentTheme.textLight} />
                                ) : (
                                    <Text style={[styles.balanceText, { color: currentTheme.textLight }]}>
                                        Balance: {fromToken?.balance ? fromToken.balance.toFixed(Math.min(6, (fromToken.decimals ?? 6))) : '0.00'} {fromToken?.symbol || ''}
                                    </Text>
                                )}
                                {fromToken && fromToken.balance > 0 && (
                                    <TouchableOpacity onPress={() => setFromAmount(fromToken.balance.toFixed(fromToken.symbol === 'SOL' ? 9 : 6).replace(/\.?0+$/, ''))}>
                                        <Text style={[styles.maxButton, { color: currentTheme.secondary }]}>MAX</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={[styles.inputField, { color: currentTheme.text }]}
                                placeholder="0.00"
                                placeholderTextColor={currentTheme.textLight}
                                keyboardType="numeric"
                                value={fromAmount}
                                onChangeText={setFromAmount}
                            />
                            <TouchableOpacity style={[styles.tokenButton, { backgroundColor: currentTheme.border, borderColor: currentTheme.border }]} onPress={() => openTokenSelector('from')}>
                                {fromToken?.logoURI && <Image source={{ uri: fromToken.logoURI }} style={styles.tokenIcon} />}
                                <Text style={[styles.tokenSymbol, { color: currentTheme.text }]}>{fromToken ? fromToken.symbol : 'Select'}</Text>
                                <Ionicons name="chevron-down" size={18} color={currentTheme.textLight} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SWAP ICON CENTER */}
                    <View style={styles.iconCenterWrap}>
                        <TouchableOpacity style={[styles.switchButton, { backgroundColor: currentTheme.border }]} onPress={switchTokens}>
                            <Ionicons name="arrow-down" size={20} color={currentTheme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* TO SECTION */}
                    <View style={styles.inputBox}>
                        <View style={styles.inputHeader}>
                            <Text style={[styles.label, { color: currentTheme.textLight }]}>You Receive</Text>
                            <View style={styles.inputHeaderRight}>
                                {balancesLoading ? (
                                    <ActivityIndicator size="small" color={currentTheme.textLight} />
                                ) : (
                                    <Text style={[styles.balanceText, { color: currentTheme.textLight }]}>
                                        Balance: {toToken?.balance ? toToken.balance.toFixed(Math.min(6, (toToken.decimals ?? 6))) : '0.00'} {toToken?.symbol || ''}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.inputRow}>
                            {isLoadingQuote && !toAmountConfig ? (
                                <View style={styles.inputLoadingRow}>
                                    <ActivityIndicator size="small" color={currentTheme.textLight} />
                                    <Text style={[styles.label, { color: currentTheme.textLight, marginLeft: 8 }]}>Fetching quote…</Text>
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.inputField, { color: currentTheme.text }]}
                                    placeholder="0.00"
                                    placeholderTextColor={currentTheme.textLight}
                                    editable={false}
                                    value={toAmountConfig}
                                />
                            )}
                            <TouchableOpacity style={[styles.tokenButton, { backgroundColor: currentTheme.border, borderColor: currentTheme.border }]} onPress={() => openTokenSelector('to')}>
                                {toToken?.logoURI && <Image source={{ uri: toToken.logoURI }} style={styles.tokenIcon} />}
                                <Text style={[styles.tokenSymbol, { color: currentTheme.text }]}>{toToken ? toToken.symbol : 'Select'}</Text>
                                <Ionicons name="chevron-down" size={18} color={currentTheme.textLight} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderQuoteInfo()}
                </ScrollView>

                {/* SWAP BUTTON */}
                {(() => {
                    const canSwap = !!deloraQuote && !isLoadingQuote && parseFloat(fromAmount) > 0 && !isSwapping;
                    const buttonOpacity = canSwap ? 1 : 0.8;
                    const buttonLabel = isSwapping ? 'Swapping…' : (isLoadingQuote ? 'Fetching quote…' : 'Swap');
                    const buttonEl = (bg: any, textColor: string) => (
                        <TouchableOpacity
                            style={[styles.swapButton, { backgroundColor: bg, alignItems: 'center' }, { opacity: buttonOpacity }]}
                            disabled={!canSwap}
                            onPress={handleSwap}
                        >
                            {isSwapping
                                ? <ActivityIndicator color={textColor} />
                                : <Text style={[styles.swapButtonText, { color: textColor }]}>{buttonLabel}</Text>}
                        </TouchableOpacity>
                    );
                    return themeId === 'white'
                        ? buttonEl('#000', '#fff')
                        : (
                            <LinearGradient
                                colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                                style={[styles.swapButton, { opacity: buttonOpacity }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <TouchableOpacity
                                    style={styles.swapButtonInner}
                                    disabled={!canSwap}
                                    onPress={handleSwap}
                                >
                                    {isSwapping
                                        ? <ActivityIndicator color={currentTheme.btnText} />
                                        : <Text style={[styles.swapButtonText, { color: currentTheme.btnText }]}>{buttonLabel}</Text>}
                                </TouchableOpacity>
                            </LinearGradient>
                        );
                })()}
            </View>

            <Navigation
                activeTab="swap"
                onTabPress={(tab) => {
                    if (tab === 'wallet') navigation.navigate('Wallet');
                    else if (tab === 'activity') navigation.navigate('Activity');
                    else if (tab === 'settings') navigation.navigate('Settings');
                    else if (tab === 'swap') navigation.navigate('Swap');
                    else if (tab === 'bank') navigation.navigate('SpendEmail');
                }}
            />

            {isTokenSelectorOpen && (
                <TokenSelectorModal
                    visible={isTokenSelectorOpen}
                    tokens={deloraTokens.filter(t => t.chainId === (selectingSide === 'from' ? originChain.id : destChain.id))}
                    selectedToken={selectingSide === 'from' ? (fromToken as SelectableToken) : (toToken as SelectableToken)}
                    onSelect={onTokenSelect}
                    onClose={() => setIsTokenSelectorOpen(false)}
                />
            )}

            {showChainPicker !== null && (
                <View style={styles.chainPickerOverlay}>
                    <View style={[styles.chainPickerSheet, { backgroundColor: currentTheme.card }]}>
                        <View style={[styles.chainPickerHandle, { backgroundColor: currentTheme.border }]} />
                        <Text style={[styles.chainPickerTitle, { color: currentTheme.text }]}>Select {showChainPicker === 'origin' ? 'Source' : 'Destination'} Chain</Text>
                        <ScrollView style={styles.chainPickerList} showsVerticalScrollIndicator={false}>
                            {deloraChains.map(chain => (
                                <TouchableOpacity
                                    key={chain.id}
                                    style={[styles.chainPickerOption, { backgroundColor: currentTheme.card }, (showChainPicker === 'origin' ? originChain.id : destChain.id) === chain.id && { backgroundColor: currentTheme.border }]}
                                    onPress={() => {
                                        if (showChainPicker === 'origin') {
                                            if (chain.id !== originChain.id) {
                                                setOriginChain(chain);
                                                setFromAmount('');
                                                setToAmountConfig('');
                                                setDeloraQuote(null);
                                            }
                                        } else {
                                            if (chain.id !== destChain.id) {
                                                setDestChain(chain);
                                                setToAmountConfig('');
                                                setDeloraQuote(null);
                                            }
                                        }
                                        setShowChainPicker(null);
                                    }}
                                >
                                    <View style={[styles.chainPickerIcon, { backgroundColor: currentTheme.border }]}>
                                        <Text style={[styles.chainPickerInitial, { color: currentTheme.text }]}>{chain.name[0]}</Text>
                                        {getChainLogo(chain) && (
                                            <Image source={{ uri: getChainLogo(chain)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.chainPickerName, { color: currentTheme.text }]}>{chain.name}</Text>
                                        <Text style={[styles.chainPickerType, { color: currentTheme.textLight }]}>{chain.chainType}</Text>
                                    </View>
                                    {(showChainPicker === 'origin' ? originChain.id : destChain.id) === chain.id && (
                                        <Ionicons name="checkmark" size={20} color={currentTheme.secondary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.chainPickerClose} onPress={() => setShowChainPicker(null)}>
                            <Text style={[styles.chainPickerCloseText, { color: currentTheme.textLight }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 20,
    },
    routeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginBottom: 16,
    },
    routeSide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    routeBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    routeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    routeSideInfo: {
        flex: 1,
    },
    routeSideLabel: {
        fontSize: 9,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 1,
    },
    routeSideValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    routeDivider: {
        width: 1,
        height: 28,
        marginHorizontal: 2,
    },
    quoteInfo: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    quoteText: {
        fontSize: 12,
    },
    inputBox: {
        paddingVertical: 12,
    },
    inputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    maxButton: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    label: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputField: {
        fontSize: 36,
        fontWeight: '400',
        flex: 1,
    },
    inputLoadingRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    tokenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    tokenIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 6,
    },
    tokenSymbol: {
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 4,
    },
    balanceText: {
        fontSize: 12,
    },
    iconCenterWrap: {
        alignItems: 'center',
        marginVertical: 4,
    },
    switchButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapButton: {
        paddingVertical: 18,
        borderRadius: 16,
        marginBottom: 10,
    },
    swapButtonInner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Chain Picker Modal
    chainPickerOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    chainPickerSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    chainPickerHandle: {
        width: 40, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 16,
    },
    chainPickerTitle: {
        fontSize: 18, fontWeight: '700', marginBottom: 16,
    },
    chainPickerList: {
        maxHeight: 400,
    },
    chainPickerOption: {
        flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 4,
    },
    chainPickerIcon: {
        width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden', position: 'relative',
    },
    chainPickerInitial: {
        fontSize: 16, fontWeight: '700',
    },
    chainPickerName: {
        fontSize: 15, fontWeight: '600',
    },
    chainPickerType: {
        fontSize: 12, marginTop: 1,
    },
    chainPickerClose: {
        alignItems: 'center', paddingVertical: 14, marginTop: 8,
    },
    chainPickerCloseText: {
        fontSize: 15, fontWeight: '500',
    },
});

export default SwapScreen;
