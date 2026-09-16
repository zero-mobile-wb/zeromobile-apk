import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      transferType?: 'Public' | 'Private';
    };
  };
}

const SendDetailsScreen: React.FC<SendDetailsScreenProps> = ({ navigation, route }) => {
  const { currentTheme: t, themeId } = useTheme();
  const { connection } = useWallet();
  const { amount, amountInSOL, address, tokenMint, tokenSymbol, tokenDecimals, transferType } = route.params;
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
      transferType
    });
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
      <Header
        title="Confirm Send"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.amountSection}>
          <Text style={[styles.amountLabel, { color: t.textLight }]}>You're sending</Text>
          <Text style={[styles.amountValue, { color: t.text }]}>${amount}</Text>
          <Text style={[styles.currencyLabel, { color: t.textLight }]}>≈ {parseFloat(amountInSOL).toFixed(4)} {tokenSymbol}</Text>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>Transfer Type</Text>
            <Text style={[styles.detailValue, { color: t.text }]}>{transferType || 'Public'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>To Address</Text>
            <View style={styles.addressContainer}>
              <Text style={[styles.addressFull, { color: t.text }]} numberOfLines={2} ellipsizeMode="middle">
                {address}
              </Text>
              <Text style={[styles.addressShort, { color: t.textLight }]}>{truncateAddress(address)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>Network Fee</Text>
            <Text style={[styles.detailValue, { color: t.text }]}>≈ {estimatedFee.toFixed(6)} SOL</Text>
          </View>

          <View style={[styles.totalBox, { backgroundColor: t.border }]}>
            <Text style={[styles.totalLabel, { color: t.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: t.text }]}>
              {tokenSymbol === 'SOL'
                ? `≈ ${(parseFloat(amountInSOL) + estimatedFee).toFixed(6)} SOL`
                : `≈ ${parseFloat(amountInSOL).toFixed(6)} ${tokenSymbol} + ${estimatedFee.toFixed(6)} SOL`
              }
            </Text>
          </View>
        </View>

        <View style={[styles.warningBox, themeId !== 'white' && { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
          <Text style={[styles.warningText, themeId !== 'white' && { color: '#FFC107' }]}>
            Double-check the recipient address. Transactions cannot be reversed.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {themeId === 'white' ? (
          <TouchableOpacity style={[styles.sendButton, styles.sendButtonInner, { backgroundColor: t.text }]} onPress={handleSend}>
            <Text style={[styles.sendButtonText, { color: t.background }]}>Send</Text>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={[t.gradientStart, t.gradientEnd]}
            style={styles.sendButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity style={styles.sendButtonInner} onPress={handleSend}>
              <Text style={[styles.sendButtonText, { color: t.btnText }]}>Send</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    marginBottom: 20,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailRow: {
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    fontFamily: 'sans-serif',
  },
  addressShort: {
    fontSize: 12,
    color: colors.gray,
    fontFamily: 'sans-serif',
  },
  totalBox: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.black,
    marginBottom: 6,
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
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sendButtonInner: {
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SendDetailsScreen;
