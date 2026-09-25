import { PAYOUT_COUNTRIES } from './countries';

// Sell/from chains — live-tested against Flipeet off-ramp (rate endpoint).
// Shared by the Sell screen now and the Wallet screen later: single source of
// truth for chain ids, Flipeet network slugs, RPCs, explorers and stables.
export type SellChainId = 'solana' | 'base' | 'bsc' | 'arbitrum' | 'arc';
export type SellTokenSymbol = 'USDC' | 'USDT';

export interface SellToken {
    symbol: SellTokenSymbol;
    /** Mint (Solana) or contract address (EVM). */
    mint: string;
    decimals: number;
    logo: string;
}

export interface SellChain {
    id: SellChainId;
    name: string;
    shortName: string;
    logo: string;
    /** Slug Flipeet expects in asset/network payloads (lowercase). */
    flipeetNetwork: string;
    /** EVM chain id (undefined for Solana). */
    evmChainId?: number;
    rpcUrls: string[];
    explorerTx: (hash: string) => string;
    nativeSymbol: string;
    tokens: SellToken[];
    /**
     * Set to true when the chain's primary stablecoin is the native gas token
     * (e.g. Arc, where USDC is native and has no ERC-20 contract address).
     * Transfers must use a native value send instead of contract.transfer().
     */
    nativeUSDC?: boolean;
    /**
     * Set to true when the payment processor (Flipeet) hasn't added this
     * network yet. The chain will appear in the picker but be disabled.
     */
    comingSoon?: boolean;
}

const USDC_LOGO =
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';
const USDT_LOGO = 'https://assets.coingecko.com/coins/images/325/small/Tether.png';

export const SELL_CHAINS: SellChain[] = [
    {
        id: 'solana',
        name: 'Solana',
        shortName: 'SOL',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        flipeetNetwork: 'solana',
        rpcUrls: [],
        explorerTx: hash => `https://solscan.io/tx/${hash}`,
        nativeSymbol: 'SOL',
        tokens: [
            { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logo: USDC_LOGO },
            { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, logo: USDT_LOGO },
        ],
    },
    {
        id: 'base',
        name: 'Base',
        shortName: 'BASE',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
        flipeetNetwork: 'base',
        evmChainId: 8453,
        rpcUrls: ['https://mainnet.base.org', 'https://base.publicnode.com', 'https://base.llamarpc.com'],
        explorerTx: hash => `https://basescan.org/tx/${hash}`,
        nativeSymbol: 'ETH',
        // NOTE: no USDT on Base — Flipeet rejects base:usdt for off-ramp.
        tokens: [
            { symbol: 'USDC', mint: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: USDC_LOGO },
        ],
    },
    {
        id: 'bsc',
        name: 'BNB Chain',
        shortName: 'BSC',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        flipeetNetwork: 'bsc',
        evmChainId: 56,
        rpcUrls: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com'],
        explorerTx: hash => `https://bscscan.com/tx/${hash}`,
        nativeSymbol: 'BNB',
        tokens: [
            { symbol: 'USDC', mint: '0x8AC76a08595D2C9e6eF7Bb52FdA756eC9c6c771', decimals: 18, logo: USDC_LOGO },
            { symbol: 'USDT', mint: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, logo: USDT_LOGO },
        ],
    },
    {
        id: 'arbitrum',
        name: 'Arbitrum',
        shortName: 'ARB',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
        flipeetNetwork: 'arbitrum',
        evmChainId: 42161,
        rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.publicnode.com', 'https://arbitrum.llamarpc.com'],
        explorerTx: hash => `https://arbiscan.io/tx/${hash}`,
        nativeSymbol: 'ETH',
        tokens: [
            { symbol: 'USDC', mint: '0xaf88d065E77c8cC2239327C5EDb3A432268e5831', decimals: 6, logo: USDC_LOGO },
            { symbol: 'USDT', mint: '0xFd086bC7D6060cB9a4Eb1A1C1BEbc0BF5AA3142', decimals: 6, logo: USDT_LOGO },
        ],
    },
    {
        id: 'arc',
        name: 'Arc',
        shortName: 'ARC',
        logo: USDC_LOGO,
        flipeetNetwork: 'arc',
        evmChainId: 5042,
        rpcUrls: ['https://rpc.mainnet.arc.io'],
        explorerTx: hash => `https://explorer.arc.io/tx/${hash}`,
        // USDC is the native gas token on Arc — no separate ERC-20 contract.
        nativeSymbol: 'USDC',
        nativeUSDC: true,
        comingSoon: true,  // Flipeet Arc support pending — remove once live
        tokens: [
            // mint = 'native' signals that USDC is the native asset on Arc.
            { symbol: 'USDC', mint: 'native', decimals: 6, logo: USDC_LOGO },
        ],
    },
];

export const DEFAULT_SELL_CHAIN: SellChain = SELL_CHAINS[0];

export function findSellChain(id?: string | null): SellChain | null {
    if (!id) return null;
    return SELL_CHAINS.find(c => c.id === id) || null;
}

export function tokensForChain(chainId: SellChainId): SellToken[] {
    return findSellChain(chainId)?.tokens || [];
}

// Sell-side fiat currencies. Off-ramp-verified live except AED (opened on
// request — Flipeet's payout leg returned "not supported" in tests, so the
// backend error surfaces if a payout fails there).
export interface SellCurrency {
    code: string;
    currency: string;
    symbol: string;
    flag: string;
    minAmount: number;
    /** Channel Flipeet expects for off-ramp payouts on this corridor. */
    offrampChannel: 'BANK' | 'MOBILEMONEY';
}

export const SELL_CURRENCIES: SellCurrency[] = PAYOUT_COUNTRIES.map(p => ({
    code: p.code,
    currency: p.currency,
    symbol: p.symbol,
    flag: p.flag,
    minAmount: p.code === 'NG' ? 1500 : 1,
    // Mobile-money corridors settle via MOBILEMONEY; banked corridors via BANK.
    offrampChannel: ['KES', 'GHS', 'TZS', 'UGX'].includes(p.currency) ? 'MOBILEMONEY' : 'BANK',
}));

export const DEFAULT_SELL_CURRENCY: SellCurrency = SELL_CURRENCIES[0];

export function findSellCurrency(code?: string | null): SellCurrency | null {
    if (!code) return null;
    const c = code.trim().toUpperCase();
    return SELL_CURRENCIES.find(s => s.code === c) || null;
}
