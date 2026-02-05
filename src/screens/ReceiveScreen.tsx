import React, { useState } from 'react';
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
import QRCode from 'react-native-qrcode-svg';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { useWallet } from '../context/WalletContext';
import * as Clipboard from 'expo-clipboard';

interface ReceiveScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Receive'>;
}

const ReceiveScreen: React.FC<ReceiveScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet } = useWallet();
  const walletAddress = wallet ? wallet.publicKey.toBase58() : 'Wallet Not Connected';
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

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
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(walletAddress);
    showToastNotification('Address copied!');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My Solana Wallet Address: ${walletAddress}`,
      });
    } catch (error: any) {
      showToastNotification('Share failed');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Receive"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* QR Code Section - Pushed up */}
        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            {/* QR Card */}
            <View style={styles.qrCard}>
              {/* QR Code at top */}
              <View style={styles.qrCodeWrapper}>
                {wallet && <QRCode value={walletAddress} size={180} color={colors.black} />}
              </View>

              {/* Address and Logo below QR code */}
              <View style={styles.cardFooter}>
                {/* Address on the left */}
                <View style={styles.cardAddressContainer}>
                  <Text style={styles.cardAddressText}>{truncateAddress(walletAddress)}</Text>
                </View>

                {/* Logo on the right */}
                <View style={styles.cardLogoContainer}>
                  <Image
                    source={require('../../assets/images/logo.png')}
                    style={styles.cardLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
            <Text style={styles.qrLabel}>SCAN QR CODE TO RECEIVE</Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Toast Notification */}
          {showToast && (
            <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          )}

          {/* Bottom Buttons Section */}
          <View style={styles.bottomButtonsContainer}>
            <TouchableOpacity
              style={[styles.bottomButton, styles.copyButton]}
              onPress={handleCopyAddress}
            >
              <Ionicons name="copy-outline" size={20} color={colors.black} />
              <Text style={[styles.bottomButtonText, styles.copyButtonText]}>COPY</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomButton, styles.shareButton]}
              onPress={handleShare}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.white} />
              <Text style={[styles.bottomButtonText, styles.shareButtonText]}>SHARE</Text>
            </TouchableOpacity>
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
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
    marginBottom: 12,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  cardAddressContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardAddressText: {
    fontSize: 11,
    color: colors.black,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  cardLogoContainer: {
    width: 40,
    height: 40,
  },
  cardLogo: {
    width: '100%',
    height: '100%',
  },
  qrLabel: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
  },
  bottomSection: {
    alignItems: 'center',
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: colors.black,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 63,
  },
  toastText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  addressInfoContainer: {
    alignItems: 'center',
    width: '100%',
  },
  addressInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  addressInfoDescription: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  addressContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.black,
    width: '100%',
  },
  addressText: {
    fontSize: 14,
    color: colors.black,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'monospace',
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
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  copyButton: {
    backgroundColor: colors.transparent,
    borderColor: colors.black,
  },
  shareButton: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  bottomButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  copyButtonText: {
    color: colors.black,
  },
  shareButtonText: {
    color: colors.white,
  },
});

export default ReceiveScreen;