import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
    };
  };
}

const EnterAddressScreen: React.FC<EnterAddressScreenProps> = ({ navigation, route }) => {
  const [address, setAddress] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const { currentTheme } = useTheme();
  const { wallets } = useWallet();
  const { amount, amountInSOL, tokenMint, tokenSymbol, tokenDecimals } = route.params;

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
      tokenDecimals
    });
  };

  // Combine wallet addresses and saved addresses
  const allAddresses = [
    ...wallets.map(w => ({
      address: w.publicKey,
      label: w.name,
      isWallet: true,
    })),
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
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Enter Address"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: currentTheme.text }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter Solana wallet address"
              placeholderTextColor={colors.gray}
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
          </View>
          {address.trim() && !isValid && (
            <Text style={styles.errorText}>Invalid Solana address</Text>
          )}
        </View>

        {/* Saved Addresses */}
        {uniqueAddresses.length > 0 && (
          <View style={styles.savedAddressesSection}>
            <Text style={styles.sectionTitle}>Recent & Wallet Addresses</Text>
            <View style={styles.addressList}>
              {uniqueAddresses.map((item, index) => (
                <TouchableOpacity
                  key={`${item.address}-${index}`}
                  style={[
                    styles.addressCard,
                    address === item.address && styles.addressCardSelected,
                  ]}
                  onPress={() => handleSelectAddress(item.address)}
                >
                  <View style={styles.addressCardLeft}>
                    <Ionicons
                      name={item.isWallet ? 'wallet' : 'time-outline'}
                      size={20}
                      color={address === item.address ? colors.black : colors.gray}
                    />
                    <View style={styles.addressCardInfo}>
                      {item.label && (
                        <Text style={styles.addressLabel}>{item.label}</Text>
                      )}
                      <Text style={styles.addressText}>
                        {truncateAddress(item.address)}
                      </Text>
                    </View>
                  </View>
                  {address === item.address && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.black} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!address.trim() || !isValid) && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
          disabled={!address.trim() || !isValid}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingTop: 32,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    height: 56,
    backgroundColor: colors.white,
  },
  validationIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 12,
    marginLeft: 4,
  },
  addressList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  addressCardSelected: {
    borderColor: colors.black,
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
    fontFamily: 'monospace',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 43,
  },
  nextButton: {
    backgroundColor: colors.black,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
});

export default EnterAddressScreen;
