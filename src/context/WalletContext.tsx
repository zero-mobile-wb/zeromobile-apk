
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import * as bip39 from 'bip39';
import { Keypair, Connection } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { derivePath } from 'ed25519-hd-key';
import { startTransactionMonitoring, stopTransactionMonitoring } from '../services/transactionMonitor';
import { requestNotificationPermissions } from '../services/notificationService';

// Mainnet RPC URL
export const RPC_URL = 'https://eu.fluxrpc.com?key=368bb201-fbd6-474e-ac3e-296f6711a094';
// Suppress WebSocket errors in React Native
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString?.() || '';
  if (message.includes('ws error') || message.includes('WebSocket')) {
    return; // Ignore WebSocket errors
  }
  originalConsoleError(...args);
};

export const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  disableRetryOnRateLimit: true,
  wsEndpoint: undefined, // Disable WebSocket
});

// Solana derivation path (BIP44)
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

/**
 * Derive Solana keypair from mnemonic using proper BIP44 derivation path
 */
async function getKeypairFromMnemonic(mnemonic: string): Promise<Keypair> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const derivedSeed = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

interface StoredWallet {
  mnemonic: string;
  name: string;
  publicKey: string;
}

interface WalletContextType {
  wallet: Keypair | null;
  mnemonic: string | null;
  createWallet: () => void;
  importWallet: (mnemonic: string) => void;
  confirmWalletSaved: () => Promise<void>;
  signOut: () => void;
  isWalletConfirmed: boolean;
  wallets: StoredWallet[];
  switchWallet: (index: number) => Promise<void>;
  currentWalletIndex: number;
  connection: Connection;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<Keypair | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [isWalletConfirmed, setIsWalletConfirmed] = useState<boolean>(false);
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [currentWalletIndex, setCurrentWalletIndex] = useState<number>(0);

  useEffect(() => {
    const loadWallet = async () => {
      const storedWallets = await AsyncStorage.getItem('wallets');
      const currentIndex = await AsyncStorage.getItem('currentWalletIndex');

      if (storedWallets) {
        const parsedWallets: StoredWallet[] = JSON.parse(storedWallets);
        setWallets(parsedWallets);

        const index = currentIndex ? parseInt(currentIndex) : 0;
        setCurrentWalletIndex(index);

        if (parsedWallets[index]) {
          const keypair = await getKeypairFromMnemonic(parsedWallets[index].mnemonic);
          setMnemonic(parsedWallets[index].mnemonic);
          setWallet(keypair);
          setIsWalletConfirmed(true);
        }
      }
    };
    loadWallet();
  }, []);

  // Start monitoring when wallet is loaded
  useEffect(() => {
    if (wallet && isWalletConfirmed) {
      // Request notification permissions and start monitoring
      requestNotificationPermissions().then((granted) => {
        if (granted) {
          const walletAddress = wallet.publicKey.toBase58();
          console.log('Starting transaction monitoring for:', walletAddress);
          startTransactionMonitoring(walletAddress, 30000); // Check every 30 seconds
        } else {
          console.log('Notification permissions not granted');
        }
      });

      // Cleanup on unmount or wallet change
      return () => {
        console.log('Stopping transaction monitoring');
        stopTransactionMonitoring();
      };
    }
  }, [wallet, isWalletConfirmed]);

  const createWallet = async () => {
    const newMnemonic = bip39.generateMnemonic();
    const keypair = await getKeypairFromMnemonic(newMnemonic);
    setMnemonic(newMnemonic);
    setWallet(keypair);
    setIsWalletConfirmed(false);
    // Don't save to AsyncStorage yet - wait for user to confirm they've saved the seed phrase
  };

  const confirmWalletSaved = async () => {
    if (mnemonic && wallet) {
      const newWallet: StoredWallet = {
        mnemonic,
        name: `Wallet ${wallets.length + 1}`,
        publicKey: wallet.publicKey.toBase58(),
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      setCurrentWalletIndex(updatedWallets.length - 1);

      await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));
      await AsyncStorage.setItem('currentWalletIndex', String(updatedWallets.length - 1));
      setIsWalletConfirmed(true);
    }
  };

  const importWallet = async (mnemonic: string) => {
    const keypair = await getKeypairFromMnemonic(mnemonic);
    setMnemonic(mnemonic);
    setWallet(keypair);

    const newWallet: StoredWallet = {
      mnemonic,
      name: `Wallet ${wallets.length + 1}`,
      publicKey: keypair.publicKey.toBase58(),
    };

    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setCurrentWalletIndex(updatedWallets.length - 1);

    await AsyncStorage.setItem('wallets', JSON.stringify(updatedWallets));
    await AsyncStorage.setItem('currentWalletIndex', String(updatedWallets.length - 1));
    setIsWalletConfirmed(true);
  };

  const switchWallet = async (index: number) => {
    if (wallets[index]) {
      const keypair = await getKeypairFromMnemonic(wallets[index].mnemonic);
      setMnemonic(wallets[index].mnemonic);
      setWallet(keypair);
      setCurrentWalletIndex(index);
      await AsyncStorage.setItem('currentWalletIndex', String(index));
    }
  };

  const signOut = async () => {
    setWallet(null);
    setMnemonic(null);
    setIsWalletConfirmed(false);
    await AsyncStorage.removeItem('wallets');
    await AsyncStorage.removeItem('currentWalletIndex');
    setWallets([]);
    setCurrentWalletIndex(0);
  };

  return (
    <WalletContext.Provider value={{
      wallet,
      mnemonic,
      createWallet,
      importWallet,
      confirmWalletSaved,
      signOut,
      isWalletConfirmed,
      wallets,
      switchWallet,
      currentWalletIndex,
      connection
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
