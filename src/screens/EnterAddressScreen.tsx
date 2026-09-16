import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { isValidSolanaAddress } from '../services/transactionService';
import { getSavedAddresses, SavedAddress, saveAddress } from '../services/addressBookService';
import { useWallet } from '../context/WalletContext';

interface EnterAddressScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EnterAddress'>;
  route: {
    params: {
      amount: string;
      amountInSOL: string;
      tokenMint: string;
      tokenSymbol: string;
      tokenDecimals: number;
      transferType?: 'Public' | 'Private';
    };
  };
}

const EnterAddressScreen: React.FC<EnterAddressScreenProps> = ({ navigation, route }) => {
  const [address, setAddress] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const { currentTheme: t, themeId } = useTheme();
  const { wallet } = useWallet();
  const { amount, amountInSOL, tokenMint, tokenSymbol, tokenDecimals, transferType } = route.params;

  // Camera State
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleScanPress = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    // Solana URIs can be solana:<address>
    const scannedAddress = data.replace('solana:', '').split('?')[0];
    setAddress(scannedAddress);
    setIsScanning(false);
  };

  // Load saved addresses on mount
  useEffect(() => {
    loadSavedAddresses();
  }, []);

  // Validate address in real-time
  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed) {
      setIsValid(isValidSolanaAddress(trimmed));
    } else {
      setIsValid(false);
    }
  }, [address]);

  const loadSavedAddresses = async () => {
    const addresses = await getSavedAddresses();
    setSavedAddresses(addresses);
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleSelectAddress = (addr: string) => {
    setAddress(addr);
  };

  const handleNext = async () => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress || !isValid) {
      return;
    }

    // Save address to history
    await saveAddress(trimmedAddress);

    navigation.navigate('SendDetails', {
      amount,
      amountInSOL,
      address: trimmedAddress,
      tokenMint,
      tokenSymbol,
      tokenDecimals,
      transferType
    });
  };

  // Combine wallet addresses and saved addresses
  const allAddresses = [
    ...(wallet ? [{
      address: wallet.publicKey.toBase58(),
      label: 'Zero Wallet',
      isWallet: true,
    }] : []),
    ...savedAddresses.map(a => ({
      address: a.address,
      label: a.label,
      isWallet: false,
    })),
  ];

  // Remove duplicates
  const uniqueAddresses = allAddresses.filter(
    (addr, index, self) => index === self.findIndex(a => a.address === addr.address)
  );

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
      <Header
        title="Enter Address"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: t.text }]}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.border, paddingRight: 80 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter Solana wallet address"
              placeholderTextColor={t.textLight}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
            {address.trim() && (
              <View style={styles.validationIcon}>
                {isValid ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                ) : (
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.scanIconContainer}
              onPress={handleScanPress}
            >
              <Ionicons name="qr-code-outline" size={24} color={t.text} />
            </TouchableOpacity>
          </View>
          {address.trim() && !isValid && (
            <Text style={styles.errorText}>Invalid Solana address</Text>
          )}
        </View>

        {/* Saved Addresses */}
        {uniqueAddresses.length > 0 && (
          <View style={styles.savedAddressesSection}>
            <Text style={[styles.sectionTitle, { color: t.textLight }]}>RECENT & WALLET ADDRESSES</Text>
            <View style={styles.addressList}>
              {uniqueAddresses.map((item, index) => (
                <TouchableOpacity
                  key={`${item.address}-${index}`}
                  style={[
                    styles.addressCard,
                    { backgroundColor: t.card, borderColor: t.border },
                    address === item.address && { borderColor: t.text, backgroundColor: t.border },
                  ]}
                  onPress={() => handleSelectAddress(item.address)}
                >
                  <View style={styles.addressCardLeft}>
                    <Ionicons
                      name={item.isWallet ? 'wallet' : 'time-outline'}
                      size={20}
                      color={address === item.address ? t.text : t.textLight}
                    />
                    <View style={styles.addressCardInfo}>
                      {item.label && (
                        <Text style={[styles.addressLabel, { color: t.text }]}>{item.label}</Text>
                      )}
                      <Text style={[styles.addressText, { color: t.textLight }]}>
                        {truncateAddress(item.address)}
                      </Text>
                    </View>
                  </View>
                  {address === item.address && (
                    <Ionicons name="checkmark-circle" size={20} color={t.text} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {themeId === 'white' ? (
          <TouchableOpacity
            style={[
              styles.nextButton,
              styles.nextButtonInner,
              { backgroundColor: t.text },
              (!address.trim() || !isValid) && { opacity: 0.4 }
            ]}
            onPress={handleNext}
            disabled={!address.trim() || !isValid}
          >
            <Text style={[styles.nextButtonText, { color: t.background }]}>Next</Text>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={[t.gradientStart, t.gradientEnd]}
            style={[
              styles.nextButton,
              (!address.trim() || !isValid) && { opacity: 0.4 }
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity
              style={styles.nextButtonInner}
              onPress={handleNext}
              disabled={!address.trim() || !isValid}
            >
              <Text style={[styles.nextButtonText, { color: t.btnText }]}>Next</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>

      {/* QR Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" transparent={false}>
        <View style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setIsScanning(false)} style={styles.cameraCloseButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.overlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scanText}>Scan Solana QR Code</Text>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 10,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 18,
    paddingRight: 50,
    fontSize: 17,
    height: 60,
    backgroundColor: colors.white,
  },
  validationIcon: {
    position: 'absolute',
    right: 54,
    top: 18,
  },
  scanIconContainer: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#F44336',
    marginTop: 8,
    marginLeft: 4,
  },
  savedAddressesSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.black,
    marginBottom: 12,
    marginLeft: 4,
  },
  addressList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  addressCardSelected: {
    borderColor: '#D1D5DB',
    backgroundColor: colors.lightGray,
  },
  addressCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: colors.gray,
    fontFamily: 'sans-serif',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 43,
  },
  nextButton: {
    borderRadius: 16,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  nextButtonInner: {
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  cameraCloseButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  closeButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  scanTarget: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginBottom: 20,
  },
  scanText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

export default EnterAddressScreen;
