import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { getEstimatedFee } from '../services/transactionService';
import { useWallet } from '../context/WalletContext';
import BiometricService from '../services/biometricService';
import { Alert } from 'react-native';

interface SendDetailsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SendDetails'>;
  route: {
    params: {
      amount: string;
      amountInSOL: string;
      address: string;
      tokenMint: string;
      tokenSymbol: string;
      tokenDecimals: number;
    };
  };
}

const SendDetailsScreen: React.FC<SendDetailsScreenProps> = ({ navigation, route }) => {
  const { currentTheme } = useTheme();
  const { connection } = useWallet();
  const { amount, amountInSOL, address, tokenMint, tokenSymbol, tokenDecimals } = route.params;
  const [estimatedFee, setEstimatedFee] = useState<number>(0.000005);

  useEffect(() => {
    const fetchFee = async () => {
      const fee = await getEstimatedFee(connection);
      setEstimatedFee(fee);
    };
    fetchFee();
  }, [connection]);

  const handleSend = async () => {
    const isBiometricEnabled = await BiometricService.isEnabled();

    if (isBiometricEnabled) {
      const authenticated = await BiometricService.authenticate('Confirm transaction with biometrics');
      if (!authenticated) {
        Alert.alert('Authentication Failed', 'You must authenticate to send funds.');
        return;
      }
    }

    navigation.navigate('Transaction', {
      amount,
      amountInSOL,
      address,
      tokenMint,
      tokenSymbol,
      tokenDecimals,
      status: 'submitting',
    });
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Confirm Send"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>You're sending</Text>
          <Text style={styles.amountValue}>${amount}</Text>
          <Text style={styles.currencyLabel}>≈ {parseFloat(amountInSOL).toFixed(4)} {tokenSymbol}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>To Address</Text>
            <View style={styles.addressContainer}>
              <Text style={styles.addressFull} numberOfLines={2} ellipsizeMode="middle">
                {address}
              </Text>
              <Text style={styles.addressShort}>{truncateAddress(address)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Network Fee</Text>
            <Text style={styles.detailValue}>≈ {estimatedFee.toFixed(6)} SOL</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, styles.totalLabel]}>Total</Text>
            <Text style={[styles.detailValue, styles.totalValue]}>
              {tokenSymbol === 'SOL'
                ? `≈ ${(parseFloat(amountInSOL) + estimatedFee).toFixed(6)} SOL`
                : `≈ ${parseFloat(amountInSOL).toFixed(6)} ${tokenSymbol} + ${estimatedFee.toFixed(6)} SOL`
              }
            </Text>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Double-check the recipient address. Transactions cannot be reversed.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
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
    paddingTop: 20,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 12,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.black,
  },
  currencyLabel: {
    fontSize: 18,
    color: colors.gray,
    marginTop: 4,
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailRow: {
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
  },
  addressContainer: {
    gap: 4,
  },
  addressFull: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    fontFamily: 'monospace',
  },
  addressShort: {
    fontSize: 12,
    color: colors.gray,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 43,
  },
  sendButton: {
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
  sendButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SendDetailsScreen;
