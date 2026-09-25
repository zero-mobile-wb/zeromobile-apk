import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { RootStackParamList } from '../types/navigation';
import WavyDotsLoader from '../components/WavyDotsLoader';
import AnimatedCheckmark from '../components/AnimatedCheckmark';
import { sendSOL, sendSPLToken, sendSPLTokenViaKora, hasEnoughSolForGas } from '../services/transactionService';
import { CLOAK_PROGRAM_ID, NATIVE_SOL_MINT, createUtxo, createZeroUtxo, fullWithdraw, generateUtxoKeypair, getNkFromUtxoPrivateKey, transact } from '@cloak.dev/sdk';
import { Keypair, PublicKey } from '@solana/web3.js';
import { usePrivy, useEmbeddedSolanaWallet, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { sendEvmToken, getEvmGasBalance } from '../services/evmTransferService';
import { CHAINS, deriveEvmPrivateKey, type ChainId } from '../services/chainService';

// Backend URL — read from app.config.js extra (same as rest of the app)
const BACKEND_URL = ((Constants.expoConfig?.extra?.backendUrl as string) || 'https://zeroserver.pxxl.click').replace(/\/$/, '');

function truncateError(msg: string): string {
  if (!msg) return 'Something went wrong.';
  if (msg.includes('insufficient funds')) return 'Insufficient funds for this transaction';
  if (msg.includes('user rejected')) return 'Transaction rejected by user';
  if (msg.includes('network')) return 'Network error. Please try again.';
  if (msg.includes('nonce')) return 'Nonce error. Please try again.';
  const clean = msg.split('\n')[0].replace(/^Error:\s*/, '').replace(/\s*\{.*$/, '').trim();
  return clean.length > 80 ? clean.slice(0, 77) + '...' : clean;
}

interface TransactionScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Transaction'>;
  route: {
    params: {
      amount: string;
      amountInSOL: string;
      address: string;
      tokenMint: string;
      tokenSymbol: string;
      tokenDecimals: number;
      status: 'submitting' | 'success' | 'error';
      transferType?: 'Public' | 'Private';
      chain?: string;
    };
  };
}

const TransactionScreen: React.FC<TransactionScreenProps> = ({ navigation, route }) => {
  const { currentTheme: t, themeId } = useTheme();
  const { wallet, connection, evmWallets, exportEvmPrivateKey } = useWallet();
  const { network } = useNetwork();
  const rpcUrl = network === 'devnet'
    ? 'https://api.devnet.solana.com'
    : (connection.rpcEndpoint || 'https://api.mainnet-beta.solana.com');
  const { amount, amountInSOL, address, tokenMint, tokenSymbol, tokenDecimals, status: initialStatus, transferType, chain } = route.params;
  const isEvm = chain && chain !== 'solana';
  const [status, setStatus] = useState<'submitting' | 'success' | 'error'>(initialStatus);
  const [signature, setSignature] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { user } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;
  const isPrivyUser = !!user && !!privySolanaAddress;


  useEffect(() => {
    // Send the actual transaction
    const executeTransaction = async () => {
      if (status === 'submitting') {
        try {
          let result: any;
          const isSOL = tokenMint === 'So11111111111111111111111111111111111111112';

          let sender: any;
          if (isPrivyUser && privySolanaWallet && privySolanaWallet.getProvider) {
            const provider = await privySolanaWallet.getProvider();
            sender = { type: 'privy', publicKey: new PublicKey(privySolanaAddress), provider };
          } else if (wallet) {
            sender = { type: 'keypair', keypair: wallet };
          } else {
            throw new Error("No wallet connected.");
          }

          // EVM Transfer
          if (isEvm) {
            const chainConfig = CHAINS[chain as keyof typeof CHAINS];
            if (!chainConfig) throw new Error(`Unknown chain: ${chain}`);

            const evmWallet = evmWallets.find(w => w.chainId === chain);
            const evmAddress = evmWallet?.address || (isPrivyUser && privyEvmAddress ? privyEvmAddress as `0x${string}` : undefined);
            if (!evmAddress) throw new Error(`No ${chain} wallet found. Please add it in Settings.`);

            const isNative = tokenMint === chain;
            const decimals = isNative ? chainConfig.decimals : tokenDecimals;
            const amountNum = parseFloat(amountInSOL);

            let privateKey: `0x${string}` | undefined;
            try {
              const pk = await exportEvmPrivateKey(chain as ChainId);
              if (pk) privateKey = pk as `0x${string}`;
            } catch {}

            const evmChainIdMap: Record<string, number> = { ethereum: 1, base: 8453, polygon: 137, arbitrum: 42161, monad: 143, arc: 5042 };
            const evmChainId = evmChainIdMap[chain] || 0;

            if (isNative) {
              // Native ETH/MON/POL/USDC transfer via viem
              const { createWalletClient, parseUnits, parseEther } = await import('viem');
              const { privateKeyToAccount } = await import('viem/accounts');
              const valueHex = chainConfig.decimals === 18
                ? `0x${parseEther(String(amountNum)).toString(16)}`
                : `0x${parseUnits(String(amountNum), chainConfig.decimals).toString(16)}`;
              if (privateKey) {
                const account = privateKeyToAccount(privateKey);
                for (const url of chainConfig.rpcUrls) {
                  try {
                    const walletClient = createWalletClient({ account, transport: (await import('viem')).http(url, { timeout: 15000 }) });
                    const hash = await walletClient.sendTransaction({ to: address as `0x${string}`, value: BigInt(valueHex), chain: null });
                    setSignature(hash);
                    setStatus('success');
                    return;
                  } catch {}
                }
                throw new Error('Native EVM transfer failed on all RPCs');
              } else if (isPrivyUser && privyEthWallet?.wallets?.[0]) {
                const ethProvider = await privyEthWallet.wallets[0].getProvider();
                // Switch chain before sending
                const chainIdHex = `0x${evmChainId.toString(16)}`;
                try {
                  await ethProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
                } catch {}
                const tx = { from: evmAddress, to: address, value: valueHex };
                const hash = await ethProvider.request({ method: 'eth_sendTransaction', params: [tx] });
                setSignature(typeof hash === 'string' ? hash : hash?.hash);
                setStatus('success');
                return;
              }
              throw new Error('No private key available for native EVM transfer');
            }

            // ERC-20 transfer
            let evmSender: any;
            if (privateKey) {
              evmSender = { type: 'keypair', privateKey };
            } else if (isPrivyUser && privyEthWallet?.wallets?.[0]) {
              const ethProvider = await privyEthWallet.wallets[0].getProvider();
              const chainIdHex = `0x${evmChainId.toString(16)}`;
              try {
                await ethProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
              } catch {}
              evmSender = { type: 'privy', provider: ethProvider, address: evmAddress };
            } else {
              throw new Error('No EVM wallet provider available');
            }
            const transferResult = await sendEvmToken({
              rpcUrls: chainConfig.rpcUrls,
              evmChainId,
              token: tokenMint as `0x${string}`,
              decimals,
              amount: amountNum,
              to: address as `0x${string}`,
              sender: evmSender,
            });
            if (!transferResult.success) throw new Error(transferResult.error);
            setSignature(transferResult.signature || '');
            setStatus('success');
            return;
          }

          if (transferType === 'Private') {
            if (sender.type === 'privy') {
              throw new Error('Private transfers are not currently supported with Privy embedded wallets. Please use a local wallet.');
            }
            const rawAmount = BigInt(Math.floor(parseFloat(amountInSOL) * Math.pow(10, tokenDecimals)));

            if (!wallet?.secretKey) {
              throw new Error('Wallet secret key not available for private transfer');
            }

            if (network === 'devnet') {
              throw new Error('Private transfers are only available on Mainnet. Switch to Mainnet in Settings to use this feature.');
            }

            const senderKeypair = Keypair.fromSecretKey(wallet.secretKey);
            const SOL_MINT = 'So11111111111111111111111111111111111111112';
            const mintPubkey = tokenMint === SOL_MINT ? NATIVE_SOL_MINT : new PublicKey(tokenMint);
            const recipientWallet = new PublicKey(address);

            // Execute local Cloak UTXO pool entry
            const scanKeypair = await generateUtxoKeypair();
            const viewingKeyNk = getNkFromUtxoPrivateKey(scanKeypair.privateKey);
            const baseOptions = { connection, programId: CLOAK_PROGRAM_ID, walletPublicKey: senderKeypair.publicKey, depositorKeypair: senderKeypair, chainNoteViewingKeyNk: viewingKeyNk };

            const owner = await generateUtxoKeypair();
            const output = await createUtxo(rawAmount, owner, mintPubkey);

            const deposited = await transact({ inputUtxos: [await createZeroUtxo(mintPubkey)], outputUtxos: [output], externalAmount: rawAmount, depositor: senderKeypair.publicKey }, baseOptions);
            const txSignature: any = await fullWithdraw(deposited.outputUtxos, recipientWallet, { ...baseOptions, cachedMerkleTree: deposited.merkleTree });

            result = { success: true, signature: txSignature?.signature || txSignature || 'ok' };

          } else {
            if (isSOL) {
              // Send SOL
              result = await sendSOL(
                connection,
                sender,
                address,
                parseFloat(amountInSOL)
              );
            } else {
              // Send SPL Token — try normal flow, fallback to Kora if no SOL for gas
              const senderPubkey = sender.type === 'keypair' ? sender.keypair.publicKey : sender.publicKey;
              const hasSol = await hasEnoughSolForGas(connection, senderPubkey.toBase58());
              if (hasSol) {
                result = await sendSPLToken(
                  connection,
                  sender,
                  address,
                  tokenMint,
                  parseFloat(amountInSOL),
                  tokenDecimals
                );
              } else {
                console.log('[Transaction] No SOL for gas, using Kora gasless relay');
                result = await sendSPLTokenViaKora(
                  connection,
                  sender,
                  address,
                  tokenMint,
                  parseFloat(amountInSOL),
                  tokenDecimals
                );
              }
            }
          }

          if (result.success && result.signature) {
            setSignature(result.signature);
            setStatus('success');
          } else {
            const error = result.error || 'Transaction failed';
            setErrorMessage(truncateError(error));
            setStatus('error');
          }
        } catch (error: any) {
          console.error('Transaction error:', error);
          setErrorMessage(truncateError(error.message || 'Transaction failed'));
          setStatus('error');
        }
      }
    };

    executeTransaction();
  }, [status, wallet, connection, amountInSOL, address, tokenMint, tokenDecimals]);

  const handleDone = () => {
    // Navigate back to wallet screen
    navigation.navigate('Wallet');
  };

  const handleRetry = () => {
    setStatus('submitting');
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: t.primary }]}>
      <View style={styles.topGradient} pointerEvents="none">
        <LinearGradient
          colors={[t.gradientStart, 'transparent']}
          style={{ flex: 1 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
      {/* Green gradient overlay for success state */}
      {status === 'success' && (
        <LinearGradient
          colors={['rgba(76, 175, 80, 0.35)', 'rgba(76, 175, 80, 0.15)', 'transparent']}
          locations={[0, 0.5, 0.8]}
          style={styles.gradientOverlay}
        />
      )}
      <View style={styles.content}>
        {/* Status Icon */}
        <View style={styles.iconContainer}>
          {status === 'submitting' && (
            <WavyDotsLoader size={20} color={t.text} />
          )}
          {status === 'success' && (
            <AnimatedCheckmark size={100} />
          )}
          {status === 'error' && (
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>✕</Text>
            </View>
          )}
        </View>

        {/* Status Message */}
        <View style={styles.messageContainer}>
          {status === 'submitting' && (
            <>
              <Text style={[styles.statusTitle, { color: t.text }]}>Submitting Transaction</Text>
              <Text style={[styles.statusSubtitle, { color: t.textLight }]}>Please wait...</Text>
            </>
          )}
          {status === 'success' && (
            <>
              <Text style={[styles.statusTitle, { color: t.text }]}>Transaction Submitted!</Text>
              <Text style={[styles.statusSubtitle, { color: t.textLight }]}>
                Your transaction has been successfully sent
              </Text>
              {/* Transaction Amount - Bold and Centered */}
              <View style={styles.amountDisplayContainer}>
                <Text style={[styles.amountDisplayValue, { color: t.text }]}>
                  ${amount}
                </Text>
              </View>
              {signature && (
                <Text style={[styles.signatureText, { color: t.textLight }]}>
                  {truncateAddress(signature)}
                </Text>
              )}
            </>
          )}
          {status === 'error' && (
            <>
              <Text style={[styles.statusTitle, { color: t.text }]}>Transaction Failed</Text>
              <Text
                style={[styles.statusSubtitle, { color: t.textLight }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {errorMessage || 'Something went wrong.'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      {status === 'success' && (
        <View style={styles.footer}>
          {themeId === 'white' ? (
            <TouchableOpacity style={[styles.doneButton, styles.doneButtonInner, { backgroundColor: t.text }]} onPress={handleDone}>
              <Text style={[styles.doneButtonText, { color: t.background }]}>Done</Text>
            </TouchableOpacity>
          ) : (
            <LinearGradient
              colors={[t.gradientStart, t.gradientEnd]}
              style={styles.doneButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <TouchableOpacity style={styles.doneButtonInner} onPress={handleDone}>
                <Text style={[styles.doneButtonText, { color: t.btnText }]}>Done</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>
      )}

      {status === 'error' && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: t.text }]} onPress={handleRetry}>
            <Text style={[styles.retryButtonText, { color: t.background }]}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: t.card, borderColor: t.border }]} onPress={handleDone}>
            <Text style={[styles.cancelButtonText, { color: t.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.25,
    zIndex: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconText: {
    fontSize: 60,
    color: colors.white,
    fontWeight: 'bold',
    lineHeight: 80,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#F44336',
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconText: {
    fontSize: 50,
    color: colors.white,
    fontWeight: 'bold',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 16,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  amountDisplayContainer: {
    marginTop: 40,
    marginBottom: 32,
    alignItems: 'center',
  },
  amountDisplayValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.black,
  },
  signatureText: {
    fontSize: 12,
    color: colors.gray,
    fontFamily: 'sans-serif',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 43,
    gap: 12,
  },
  doneButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  doneButtonInner: {
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: colors.black,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: colors.white,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: colors.black,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TransactionScreen;
