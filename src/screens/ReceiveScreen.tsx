import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Share,
  Image,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { useWallet } from '../context/WalletContext';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { useEmbeddedSolanaWallet, useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';

const BACKEND_URL = (Constants.expoConfig?.extra?.backendUrl as string || '').replace(/\/$/, '');

interface ReceiveScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Receive'>;
}

const ReceiveScreen: React.FC<ReceiveScreenProps> = ({ navigation }) => {
  const { currentTheme, themeId } = useTheme();
  const isDark = themeId === 'dark';
  const { wallet, evmWallets } = useWallet();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const { user } = usePrivy();

  const localSolana = wallet ? wallet.publicKey.toBase58() : null;
  const localMonad = evmWallets.find(w => w.chainId === 'monad')?.address;

  const privySolana = (privySolanaWallet.wallets?.[0] as any)?.address;
  const privyEvm = (privyEthWallet.wallets?.[0] as any)?.address;

  const solanaAddress = user ? privySolana : (localSolana || privySolana);
  const evmAddress = user ? privyEvm : (localMonad || privyEvm);

  const [selectedChain, setSelectedChain] = useState<string>('solana');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isCreatingEvm, setIsCreatingEvm] = useState(false);

  const displayAddress = selectedChain === 'solana'
    ? solanaAddress || 'Wallet Not Connected'
    : evmAddress || '';

  const chainOptions: { id: string; label: string }[] = [
    { id: 'solana', label: 'Solana' },
    ...((evmAddress || user) ? [{ id: 'evm', label: 'EVM' }] : []),
  ];

  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowToast(false));
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleCreateEvmWallet = async () => {
    setIsCreatingEvm(true);
    try {
      await privyEthWallet.create();
      showToastNotification('EVM Wallet Created!');
    } catch (error) {
      console.error('Failed to create EVM wallet:', error);
      showToastNotification('Failed to create EVM wallet');
    } finally {
      setIsCreatingEvm(false);
    }
  };

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(displayAddress);
    showToastNotification('Address copied!');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My ${selectedChain === 'solana' ? 'Solana' : 'EVM'} Wallet Address: ${displayAddress}`,
      });
    } catch (error: any) {
      showToastNotification('Share failed');
    }
  };

  // Logo for QR center
  const logoUri = Constants.expoConfig?.extra?.logoUrl || require('../../assets/images/zero-logo.png');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Receive"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Chain Selector - themed */}
        <View style={styles.chainRow}>
          {chainOptions.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.chainPill,
                isDark
                  ? {
                      backgroundColor: selectedChain === opt.id ? '#000000' : 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: selectedChain === opt.id ? '#000000' : 'rgba(255, 255, 255, 0.1)',
                    }
                  : {
                      backgroundColor: selectedChain === opt.id ? '#000000' : 'rgba(0, 0, 0, 0.05)',
                      borderWidth: 1,
                      borderColor: selectedChain === opt.id ? '#000000' : 'rgba(0, 0, 0, 0.1)',
                    },
              ]}
              onPress={() => setSelectedChain(opt.id)}
            >
              <Text style={[
                styles.chainPillText,
                { color: selectedChain === opt.id
                  ? '#fff'
                  : (isDark ? 'rgba(255, 255, 255, 0.6)' : currentTheme.textLight)
                },
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            {/* Liquid Glass QR Card */}
            <BlurView
              intensity={isDark ? 20 : 60}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.qrCard,
                isDark
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    }
                  : {
                      backgroundColor: 'rgba(255, 255, 255, 0.4)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.6)',
                    },
              ]}
            >
              {/* QR Code with logo in center */}
              <View style={styles.qrCodeWrapper}>
                {displayAddress ? (
                  <View style={styles.qrWithLogo}>
                    <QRCode
                      value={displayAddress}
                      size={180}
                      color={currentTheme.text}
                      backgroundColor="transparent"
                    />
                    {/* Logo overlay in center */}
                    <View style={styles.qrLogoContainer}>
                      <Image
                        source={logoUri}
                        style={styles.qrLogo}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.createEvmContainer, { width: 180, height: 180 }]}>
                    <TouchableOpacity
                      style={[
                        styles.createEvmButton,
                        { backgroundColor: currentTheme.gradientStart }
                      ]}
                      onPress={handleCreateEvmWallet}
                      disabled={isCreatingEvm}
                    >
                      <Text style={styles.createEvmButtonText}>
                        {isCreatingEvm ? 'Creating...' : 'Create EVM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Address and Logo below QR code */}
              {displayAddress ? (
                <View style={[
                  styles.cardFooter,
                  { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
                ]}>
                  {/* Address centered */}
                  <View style={styles.cardAddressContainer}>
                    <Text style={[styles.cardAddressText, { color: currentTheme.text }]}>
                      {truncateAddress(displayAddress)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </BlurView>
            <Text style={[styles.qrLabel, { color: currentTheme.textLight }]}>
              SCAN QR CODE TO RECEIVE
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Toast Notification */}
          {showToast && (
            <Animated.View style={[
              styles.toast,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : currentTheme.card,
                shadowColor: '#000',
                opacity: fadeAnim
              }
            ]}>
              <Text style={[styles.toastText, { color: currentTheme.text }]}>
                {toastMessage}
              </Text>
            </Animated.View>
          )}

          {/* Bottom Buttons Section */}
          <View style={styles.bottomButtonsContainer}>
            {isDark ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.bottomButton,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    },
                    !displayAddress && { opacity: 0.5 }
                  ]}
                  onPress={handleCopyAddress}
                  disabled={!displayAddress}
                >
                  <Ionicons name="copy-outline" size={20} color={currentTheme.text} />
                  <Text style={[styles.bottomButtonText, { color: currentTheme.text }]}>COPY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bottomButton,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                    },
                    !displayAddress && { opacity: 0.5 }
                  ]}
                  onPress={handleShare}
                  disabled={!displayAddress}
                >
                  <Ionicons name="share-social-outline" size={20} color={currentTheme.text} />
                  <Text style={[styles.bottomButtonText, { color: currentTheme.text }]}>SHARE</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.bottomButton,
                    { backgroundColor: 'transparent', borderColor: '#000', borderWidth: 2 },
                    !displayAddress && { opacity: 0.5 }
                  ]}
                  onPress={handleCopyAddress}
                  disabled={!displayAddress}
                >
                  <Ionicons name="copy-outline" size={20} color="#000" />
                  <Text style={[styles.bottomButtonText, { color: '#000' }]}>COPY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bottomButton,
                    { backgroundColor: '#000', borderColor: '#000', borderWidth: 2 },
                    !displayAddress && { opacity: 0.5 }
                  ]}
                  onPress={handleShare}
                  disabled={!displayAddress}
                >
                  <Ionicons name="share-social-outline" size={20} color="#fff" />
                  <Text style={[styles.bottomButtonText, { color: '#fff' }]}>SHARE</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
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
    justifyContent: 'space-between',
  },
  qrSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrCard: {
    width: 240,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  qrWithLogo: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLogoContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  qrLogo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cardAddressContainer: {
  },
  cardAddressText: {
    fontSize: 11,
    fontFamily: 'sans-serif',
    fontWeight: '600',
  },
  cardLogoContainer: {
    width: 40,
    height: 40,
    overflow: 'hidden',
  },
  cardLogo: {
    width: '100%',
    height: '100%',
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSection: {
    alignItems: 'center',
  },
  toast: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 63,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 39,
    gap: 16,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 14,
    gap: 8,
  },
  bottomButtonSolid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    gap: 8,
  },
  bottomButtonGradient: {
    flex: 1,
    borderRadius: 12,
  },
  bottomButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  bottomButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Chain Selector
  chainRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8, justifyContent: 'center' },
  chainPill: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  chainPillText: { fontSize: 14, fontWeight: '600' },
  createEvmContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  createEvmButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createEvmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReceiveScreen;
