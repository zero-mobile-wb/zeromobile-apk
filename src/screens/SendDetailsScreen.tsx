import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { getEstimatedFee, hasEnoughSolForGas } from '../services/transactionService';
import { useWallet } from '../context/WalletContext';
import { CHAINS } from '../services/chainService';
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
      chain?: string;
    };
  };
}

const SendDetailsScreen: React.FC<SendDetailsScreenProps> = ({ navigation, route }) => {
  const { currentTheme: t, themeId } = useTheme();
  const { connection, activeSolanaAddress } = useWallet();
  const { amount, amountInSOL, address, tokenMint, tokenSymbol, tokenDecimals, transferType, chain } = route.params;
  const [estimatedFee, setEstimatedFee] = useState<number>(0.000005);
  const [useKora, setUseKora] = useState(false);
  const isEvm = chain && chain !== 'solana';
  const chainConfig = chain ? CHAINS[chain as keyof typeof CHAINS] : null;
  const evmGasSymbol = chainConfig?.nativeCurrency?.symbol || 'ETH';

  useEffect(() => {
    if (isEvm) {
      setEstimatedFee(0.0001);
      setUseKora(false);
      return;
    }
    const fetchFee = async () => {
      const fee = await getEstimatedFee(connection);
      setEstimatedFee(fee);

      if (activeSolanaAddress) {
        const hasSol = await hasEnoughSolForGas(connection, activeSolanaAddress);
        setUseKora(!hasSol);
      }
    };
    fetchFee();
  }, [connection, activeSolanaAddress]);

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
      transferType,
      chain,
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
          <Text style={[styles.currencyLabel, { color: t.textLight }]}>≈ {parseFloat(amountInSOL).toString()} {tokenSymbol}</Text>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: t.card, borderColor: t.border }]}>
          {/* Transfer Type */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>Transfer Type</Text>
            <Text style={[styles.detailValue, { color: t.text }]}>{transferType || 'Public'}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: t.border }]} />

          {/* To Address */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>To Address</Text>
            <View style={styles.addressContainer}>
              <Text style={[styles.addressFull, { color: t.text }]} numberOfLines={1} ellipsizeMode="middle">
                {truncateAddress(address)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: t.border }]} />

          {/* Network Fee */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: t.textLight }]}>Network Fee</Text>
            {isEvm ? (
              <Text style={[styles.detailValue, { color: t.text }]}>≈ {estimatedFee.toFixed(4)} {evmGasSymbol}</Text>
            ) : useKora ? (
              <View style={styles.koraFeeRow}>
                <Image source={require('../../assets/images/kora-logo.png')} style={styles.koraLogo} />
                <Text style={[styles.koraFeeText, { color: t.text }]}>{estimatedFee.toFixed(6)} SOL</Text>
              </View>
            ) : (
              <Text style={[styles.detailValue, { color: t.text }]}>≈ {estimatedFee.toFixed(6)} SOL</Text>
            )}
          </View>

          <View style={[styles.totalBox, { backgroundColor: t.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: t.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: t.text }]}>
                {isEvm
                  ? `≈ ${parseFloat(amountInSOL).toFixed(6)} ${tokenSymbol}`
                  : tokenSymbol === 'SOL'
                    ? `≈ ${(parseFloat(amountInSOL) + estimatedFee).toFixed(6)} SOL`
                    : useKora
                      ? `≈ ${parseFloat(amountInSOL).toFixed(6)} ${tokenSymbol}`
                      : `≈ ${parseFloat(amountInSOL).toFixed(6)} ${tokenSymbol} + ${estimatedFee.toFixed(6)} SOL`
                }
              </Text>
            </View>
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
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: t.text }]} onPress={handleSend}>
            <Ionicons name="arrow-up" size={20} color={t.background} />
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
              <Ionicons name="arrow-up" size={20} color={t.btnText} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
  },
  addressContainer: {
    alignItems: 'flex-end',
  },
  addressFull: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    fontFamily: 'sans-serif',
  },
  koraFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  koraLogo: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  koraFeeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalBox: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.black,
  },
  totalValue: {
    fontSize: 18,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonInner: {
    paddingVertical: 18,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SendDetailsScreen;
