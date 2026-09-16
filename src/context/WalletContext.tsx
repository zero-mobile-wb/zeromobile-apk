import 'react-native-get-random-values';
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import * as bip39 from 'bip39';
import { Keypair, Connection } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { derivePath } from 'ed25519-hd-key';
import { startTransactionMonitoring, stopTransactionMonitoring } from '../services/transactionMonitor';
import { requestNotificationPermissions } from '../services/notificationService';
import { useNetwork } from './NetworkContext';
import Constants from 'expo-constants';
import { ChainId, EvmWallet, EVM_CHAINS, deriveEvmAccount, deriveEvmPrivateKey } from '../services/chainService';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';

const HELIUS_KEY = Constants.expoConfig?.extra?.heliusApiKey || '3200c64d-9d5b-4975-9c12-d1ac26112a7b';
export const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const RPC_FALLBACK_URL = Constants.expoConfig?.extra?.rpcFallbackUrl || 'https://api.mainnet-beta.solana.com';

const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString?.() || '';
  if (message.includes('ws error') || message.includes('WebSocket')) return;
  originalConsoleError(...args);
};

async function rpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = (await Promise.race([
      fetch(input, init),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 10000))
    ])) as Response;

    // If the request fails at the HTTP level (403, 429, 500, etc), throw an error to trigger the catch block fallback
    if (!res.ok) {
      throw new Error(`RPC HTTP error: ${res.status}`);
    }

    // Sometimes Helius returns a 200 with an internal RPC JSON-RPC error.
    // However, fetch() resolves and the Solana web3.js handles it.
    // For 429s, Helius sets the HTTP status code, so the check above is sufficient.
    return res;
  } catch (error) {
    if (RPC_FALLBACK_URL) {
      console.log('RPC primary failed or rate-limited, falling back to RPCFast');
      try {
        return (await Promise.race([
          fetch(RPC_FALLBACK_URL, init),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Fallback timeout')), 10000))
        ])) as Response;
      } catch {
        throw new Error('RPC primary and fallback both failed');
      }
    }
    throw new Error('RPC primary failed, no fallback configured');
  }
}

export const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  disableRetryOnRateLimit: true,
  wsEndpoint: undefined,
  fetch: rpcFetch,
});

const BACKEND_URL = ((Constants.expoConfig?.extra?.backendUrl as string) || '').replace(/\/$/, '');
const API_URL = `${BACKEND_URL}/api/zero`;

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const WALLETS_INDEX_KEY = 'zero_wallets_index';
const ACTIVE_WALLET_KEY = 'zero_active_wallet';
const EVM_ADDRESSES_KEY = 'zero_evm_addresses';

function mnemonicStoreKey(id: string) {
  return `zero_mnemonic_${id}`;
}

async function getKeypairFromMnemonic(mnemonic: string): Promise<Keypair> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derivedSeed = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

export interface WalletEntry {
  id: string;
  name: string;
  address: string;
}

interface WalletContextType {
  wallet: Keypair | null;
  wallets: WalletEntry[];
  walletsLoaded: boolean;
  signedOut: boolean;
  activeWalletId: string | null;
  activeSolanaAddress: string | undefined;
  isPrivyUser: boolean;
  createWallet: (name?: string) => Promise<Keypair>;
  loadWallet: () => Promise<boolean>;
  unlockWallet: () => Promise<boolean>;
  hasStoredKeys: () => Promise<boolean>;
  lockWallet: () => void;
  switchWallet: (id: string) => Promise<void>;
  importWallet: (mnemonic: string, name?: string) => Promise<Keypair>;
  exportMnemonic: () => Promise<string | null>;
  exportPrivateKey: () => string | null;
  exportEvmPrivateKey: (chainId: ChainId) => Promise<string | null>;
  removeWallet: (id: string) => Promise<void>;
  signOut: () => void;
  wipeAllData: () => Promise<void>;
  isWalletConfirmed: boolean;
  connection: Connection;
  evmWallets: EvmWallet[];
  setupEvmChain: (chainId: ChainId) => Promise<EvmWallet>;
  getEvmAddress: (chainId: ChainId) => string | undefined;
  unsupportedChains: ChainId[];
  dismissNewChains: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { network } = useNetwork();
  const { user } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const [wallet, setWallet] = useState<Keypair | null>(null);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [isWalletConfirmed, setIsWalletConfirmed] = useState<boolean>(false);
  const [activeConnection, setActiveConnection] = useState<Connection>(connection);
  const [evmWallets, setEvmWallets] = useState<EvmWallet[]>([]);
  const [unsupportedChains, setUnsupportedChains] = useState<ChainId[]>([]);
  // wallets[] only exists when status === 'connected'; fall back to linked_accounts for the address
  const privySolanaAddress =
    (privySolanaWallet as any).wallets?.[0]?.address ??
    (privySolanaWallet as any).publicKey ??
    (user?.linked_accounts?.find((a: any) => a.type === 'wallet' && a.chain_type === 'solana') as any)?.public_key ??
    (user?.linked_accounts?.find((a: any) => a.type === 'wallet' && a.chain_type === 'solana') as any)?.address ??
    undefined;
  const isPrivyUser = !!user && !!privySolanaAddress;
  const activeSolanaAddress = isPrivyUser ? privySolanaAddress : wallet?.publicKey.toBase58();

  useEffect(() => {
    const rpcUrl = network === 'devnet' ? 'https://api.devnet.solana.com' : RPC_URL;
    const fetchFn = network === 'devnet' ? undefined : rpcFetch;
    setActiveConnection(new Connection(rpcUrl, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
      wsEndpoint: undefined,
      fetch: fetchFn,
    }));
  }, [network]);

  // On launch we only load the wallet INDEX (addresses) — private keys stay
  // in SecureStore until an explicit unlock (LockScreen biometric gate).
  useEffect(() => { loadWalletIndex(); }, []);

  useEffect(() => {
    const nowTime = Date.now();
    if (activeSolanaAddress && (isPrivyUser || isWalletConfirmed)) {
      requestNotificationPermissions().then((granted) => {
        if (granted) {
          startTransactionMonitoring(activeSolanaAddress, 30000);
        }
      });
      return () => {
        console.log('[txn monitor] stopping (ran at', new Date(nowTime).toISOString(), ')');
        stopTransactionMonitoring();
      };
    }
  }, [activeSolanaAddress, isPrivyUser, isWalletConfirmed]);

  const getWalletsIndex = async (): Promise<WalletEntry[]> => {
    const raw = await AsyncStorage.getItem(WALLETS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  };

  const saveWalletsIndex = async (entries: WalletEntry[]) => {
    await AsyncStorage.setItem(WALLETS_INDEX_KEY, JSON.stringify(entries));
    setWallets(entries);
  };

  const createWallet = async (name?: string): Promise<Keypair> => {
    const mnemonic = bip39.generateMnemonic();
    const keypair = await getKeypairFromMnemonic(mnemonic);
    const id = keypair.publicKey.toBase58().slice(0, 8);
    const walletName = name || `Wallet ${(await getWalletsIndex()).length + 1}`;

    await SecureStore.setItemAsync(mnemonicStoreKey(id), mnemonic);

    const entries = await getWalletsIndex();
    entries.push({ id, name: walletName, address: keypair.publicKey.toBase58() });
    await saveWalletsIndex(entries);
    await AsyncStorage.setItem(ACTIVE_WALLET_KEY, id);

    const evmAddresses: EvmWallet[] = EVM_CHAINS.map(c => ({
      address: deriveEvmAccount(mnemonic, c.derivationIndex),
      chainId: c.id,
    }));
    await AsyncStorage.setItem(`${EVM_ADDRESSES_KEY}_${id}`, JSON.stringify(evmAddresses));
    setEvmWallets(evmAddresses);

    setWallet(keypair);
    setActiveWalletId(id);
    setIsWalletConfirmed(true);
    setSignedOut(false);
    return keypair;
  };

  const loadWalletIndex = async (): Promise<boolean> => {
    try {
      const entries = await getWalletsIndex();
      setWallets(entries);
      if (entries.length === 0) return false;

      const activeId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      const targetId = activeId && entries.find(e => e.id === activeId) ? activeId : entries[0].id;
      setActiveWalletId(targetId);

      const evmRaw = await AsyncStorage.getItem(`${EVM_ADDRESSES_KEY}_${targetId}`);
      if (evmRaw) {
        setEvmWallets(JSON.parse(evmRaw));
      }

      const missing = EVM_CHAINS.filter(c => {
        if (!evmRaw) return true;
        const existing: EvmWallet[] = JSON.parse(evmRaw);
        return !existing.find(e => e.chainId === c.id);
      });
      setUnsupportedChains(missing.map(c => c.id));

      return true;
    } catch (error) {
      console.error('[Wallet] Index load error:', error);
      return false;
    } finally {
      setWalletsLoaded(true);
    }
  };

  // Explicit unlock: derive the in-memory keypair from SecureStore.
  // Call only after the user passes the LockScreen gate.
  const unlockWallet = async (): Promise<boolean> => {
    try {
      const entries = await getWalletsIndex();
      if (entries.length === 0) return false;

      const activeId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      const targetId = activeId && entries.find(e => e.id === activeId) ? activeId : entries[0].id;

      const mnemonic = await SecureStore.getItemAsync(mnemonicStoreKey(targetId));
      if (!mnemonic) return false;

      const keypair = await getKeypairFromMnemonic(mnemonic);
      setWallet(keypair);
      setActiveWalletId(targetId);
      setIsWalletConfirmed(true);
      return true;
    } catch (error) {
      console.error('[Wallet] Unlock error:', error);
      return false;
    }
  };

  // True only if the active wallet's mnemonic is actually present in
  // SecureStore. Guards against stale indexes (restored backups, wiped
  // keychains) that would otherwise route to a dead-end Lock screen.
  const hasStoredKeys = async (): Promise<boolean> => {
    try {
      const entries = await getWalletsIndex();
      if (entries.length === 0) return false;
      const activeId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      const targetId = activeId && entries.find(e => e.id === activeId) ? activeId : entries[0].id;
      const mnemonic = await SecureStore.getItemAsync(mnemonicStoreKey(targetId));
      return !!mnemonic;
    } catch {
      return false;
    }
  };

  // Drop the in-memory keypair (keys stay in SecureStore for the next unlock).
  const lockWallet = () => {
    setWallet(null);
    setIsWalletConfirmed(false);
  };

  const loadWallet = async (): Promise<boolean> => {
    const indexed = await loadWalletIndex();
    if (!indexed) return false;
    return unlockWallet();
  };

  const switchWallet = async (id: string) => {
    const mnemonic = await SecureStore.getItemAsync(mnemonicStoreKey(id));
    if (!mnemonic) throw new Error('Wallet not found');

    const keypair = await getKeypairFromMnemonic(mnemonic);
    await AsyncStorage.setItem(ACTIVE_WALLET_KEY, id);
    setWallet(keypair);
    setActiveWalletId(id);
    setIsWalletConfirmed(true);
    setSignedOut(false);

    const evmRaw = await AsyncStorage.getItem(`${EVM_ADDRESSES_KEY}_${id}`);
    if (evmRaw) {
      setEvmWallets(JSON.parse(evmRaw));
    } else {
      const evmAddresses: EvmWallet[] = EVM_CHAINS.map(c => ({
        address: deriveEvmAccount(mnemonic, c.derivationIndex),
        chainId: c.id,
      }));
      await AsyncStorage.setItem(`${EVM_ADDRESSES_KEY}_${id}`, JSON.stringify(evmAddresses));
      setEvmWallets(evmAddresses);
    }
  };

  const importWallet = async (mnemonic: string, name?: string): Promise<Keypair> => {
    const trimmed = mnemonic.trim();
    if (!bip39.validateMnemonic(trimmed)) {
      throw new Error('Invalid recovery phrase');
    }

    const keypair = await getKeypairFromMnemonic(trimmed);
    const id = keypair.publicKey.toBase58().slice(0, 8);

    const entries = await getWalletsIndex();
    if (entries.find(e => e.id === id)) {
      // Already exists, just switch to it
      await switchWallet(id);
      return keypair;
    }

    const walletName = name || `Imported ${entries.length + 1}`;
    await SecureStore.setItemAsync(mnemonicStoreKey(id), trimmed);
    entries.push({ id, name: walletName, address: keypair.publicKey.toBase58() });
    await saveWalletsIndex(entries);
    await AsyncStorage.setItem(ACTIVE_WALLET_KEY, id);

    const evmAddresses: EvmWallet[] = EVM_CHAINS.map(c => ({
      address: deriveEvmAccount(trimmed, c.derivationIndex),
      chainId: c.id,
    }));
    await AsyncStorage.setItem(`${EVM_ADDRESSES_KEY}_${id}`, JSON.stringify(evmAddresses));
    setEvmWallets(evmAddresses);

    setWallet(keypair);
    setActiveWalletId(id);
    setIsWalletConfirmed(true);
    setSignedOut(false);
    return keypair;
  };

  const exportMnemonic = async (): Promise<string | null> => {
    if (!activeWalletId) return null;
    return await SecureStore.getItemAsync(mnemonicStoreKey(activeWalletId));
  };

  const exportPrivateKey = (): string | null => {
    if (!wallet) return null;
    const bs58 = require('bs58');
    return bs58.default ? bs58.default.encode(wallet.secretKey) : bs58.encode(wallet.secretKey);
  };

  const exportEvmPrivateKey = async (chainId: ChainId): Promise<string | null> => {
    if (!activeWalletId) return null;
    const mnemonic = await SecureStore.getItemAsync(mnemonicStoreKey(activeWalletId));
    if (!mnemonic) return null;
    const chain = EVM_CHAINS.find(c => c.id === chainId);
    if (!chain) return null;
    return deriveEvmPrivateKey(mnemonic, chain.derivationIndex);
  };

  const setupEvmChain = async (chainId: ChainId): Promise<EvmWallet> => {
    if (!activeWalletId) throw new Error('No active wallet');
    const mnemonic = await SecureStore.getItemAsync(mnemonicStoreKey(activeWalletId));
    if (!mnemonic) throw new Error('Mnemonic not found');

    const chain = EVM_CHAINS.find(c => c.id === chainId);
    if (!chain) throw new Error(`Unknown chain: ${chainId}`);

    const address = deriveEvmAccount(mnemonic, chain.derivationIndex);
    const newWallet: EvmWallet = { address, chainId };

    const evmRaw = await AsyncStorage.getItem(`${EVM_ADDRESSES_KEY}_${activeWalletId}`);
    const existing: EvmWallet[] = evmRaw ? JSON.parse(evmRaw) : [];
    existing.push(newWallet);
    await AsyncStorage.setItem(`${EVM_ADDRESSES_KEY}_${activeWalletId}`, JSON.stringify(existing));

    setEvmWallets(existing);
    setUnsupportedChains(prev => prev.filter(c => c !== chainId));
    return newWallet;
  };

  const getEvmAddress = (chainId: ChainId): string | undefined => {
    return evmWallets.find(e => e.chainId === chainId)?.address;
  };

  const dismissNewChains = async () => {
    setUnsupportedChains([]);
  };

  const removeWallet = async (id: string) => {
    await SecureStore.deleteItemAsync(mnemonicStoreKey(id));
    await AsyncStorage.removeItem(`${EVM_ADDRESSES_KEY}_${id}`);
    const entries = (await getWalletsIndex()).filter(e => e.id !== id);
    await saveWalletsIndex(entries);

    if (activeWalletId === id) {
      if (entries.length > 0) {
        await switchWallet(entries[0].id);
      } else {
        setWallet(null);
        setActiveWalletId(null);
        setIsWalletConfirmed(false);
        await AsyncStorage.removeItem(ACTIVE_WALLET_KEY);
      }
    }
  };

  const signOut = () => {
    setWallet(null);
    setIsWalletConfirmed(false);
  };

  const wipeAllData = async () => {
    const entries = await getWalletsIndex();
    for (const e of entries) {
      await SecureStore.deleteItemAsync(mnemonicStoreKey(e.id));
      await AsyncStorage.removeItem(`${EVM_ADDRESSES_KEY}_${e.id}`);
    }
    await AsyncStorage.removeItem(WALLETS_INDEX_KEY);
    await AsyncStorage.removeItem(ACTIVE_WALLET_KEY);
    await AsyncStorage.removeItem('zero_alpha_user');
    setWallet(null);
    setWallets([]);
    setActiveWalletId(null);
    setIsWalletConfirmed(false);
    setSignedOut(true);
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      wallets,
      walletsLoaded,
      signedOut,
      activeWalletId,
      activeSolanaAddress,
      isPrivyUser,
      createWallet,
      loadWallet,
      unlockWallet,
      hasStoredKeys,
      lockWallet,
      switchWallet,
      importWallet,
      exportMnemonic,
      exportPrivateKey,
      exportEvmPrivateKey,
      removeWallet,
      signOut,
      wipeAllData,
      isWalletConfirmed,
      connection: activeConnection,
      evmWallets,
      setupEvmChain,
      getEvmAddress,
      unsupportedChains,
      dismissNewChains,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
