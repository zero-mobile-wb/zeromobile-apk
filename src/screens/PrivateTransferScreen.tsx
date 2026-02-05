import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import {
  checkShadowIDRegistration,
  registerShadowID,
  getPoolBalance,
  createPoolDeposit,
  submitPoolDeposit,
  createPrivatePayment,
  estimatePrivateTransferFee,
  getPrivacyLevel,
  PoolBalance,
} from '../services/shadowPayServices';
import { isValidSolanaAddress } from '../services/transactionService';

interface PrivateTransferScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Send'>;
}

const PrivateTransferScreen: React.FC<PrivateTransferScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();

  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [poolBalance, setPoolBalance] = useState<PoolBalance | null>(null);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Status Notification State (from ReceiveScreen)
  const [showStatus, setShowStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const showStatusNotification = (message: string) => {
    setStatusMessage(message);
    setShowStatus(true);
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
    ]).start(() => setShowStatus(false));
  };

  useEffect(() => {
    checkRegistrationStatus();
    loadPoolBalance();
  }, [wallet]);

  const checkRegistrationStatus = async () => {
    if (!wallet) return;

    setCheckingRegistration(true);
    try {
      // Check local storage first
      const storedRegistration = await AsyncStorage.getItem(`shadowid_registered_${wallet.publicKey.toBase58()}`);
      if (storedRegistration === 'true') {
        setIsRegistered(true);
        setCheckingRegistration(false);
        return;
      }

      // Verify with backend if not found locally
      const registered = await checkShadowIDRegistration(wallet.publicKey.toBase58());
      if (registered) {
        setIsRegistered(true);
        await AsyncStorage.setItem(`shadowid_registered_${wallet.publicKey.toBase58()}`, 'true');
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    } finally {
      setCheckingRegistration(false);
    }
  };

  const loadPoolBalance = async () => {
    if (!wallet) return;

    const balance = await getPoolBalance(wallet.publicKey.toBase58());
    setPoolBalance(balance);
  };

  const handleRegisterShadowID = async () => {
    if (!wallet) return;

    // Direct registration start
    console.log('[UI] Registration button pressed');
    setIsRegistering(true);
    try {
      console.log('[UI] Calling registerShadowID...');
      const result = await registerShadowID(wallet, wallet.publicKey.toBase58());
      console.log('[UI] Registration result:', result);

      if (result.registered) {
        setIsRegistered(true);
        await AsyncStorage.setItem(`shadowid_registered_${wallet.publicKey.toBase58()}`, 'true');
        showStatusNotification('Successfully registered with ShadowID!');
      } else {
        showStatusNotification(result.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('[UI] Registration error:', error);
      showStatusNotification(error.message || 'Registration failed');
    } finally {
      console.log('[UI] Resetting registering state');
      setIsRegistering(false);
    }
  };

  const handleDeposit = async () => {
    if (!wallet) return;

    const depositAmountNum = parseFloat(depositAmount);
    if (isNaN(depositAmountNum) || depositAmountNum < 0.01) {
      showStatusNotification('Minimum deposit is 0.01 SOL');
      return;
    }

    setLoading(true);
    try {
      // Create deposit transaction
      const depositTx = await createPoolDeposit(wallet.publicKey.toBase58(), depositAmountNum);

      if (!depositTx.success || !depositTx.unsigned_tx_base64) {
        throw new Error(depositTx.error || 'Failed to create deposit');
      }

      // Submit the transaction
      const result = await submitPoolDeposit(connection, wallet, depositTx.unsigned_tx_base64);

      if (result.success) {
        showStatusNotification(`Deposited ${depositAmountNum} SOL to privacy pool!`);
        setShowDepositModal(false);
        setDepositAmount('');
        // Reload balance
        await loadPoolBalance();
      } else {
        throw new Error(result.error || 'Deposit failed');
      }
    } catch (error: any) {
      let errorMessage = error.message || 'An error occurred';

      // Parse common Solana errors
      if (errorMessage.includes('insufficient lamports')) {
        errorMessage = 'Insufficient funds in your wallet to cover the deposit + fees.';
      } else if (errorMessage.includes('Blockhash not found')) {
        errorMessage = 'Transaction timed out. Please try again.';
      }

      showStatusNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!wallet) {
      showStatusNotification('Wallet not connected');
      return;
    }

    if (!isRegistered) {
      showStatusNotification('Please register with ShadowID first');
      return;
    }

    if (!recipientAddress.trim() || !isValidSolanaAddress(recipientAddress)) {
      showStatusNotification('Invalid recipient address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showStatusNotification('Invalid amount');
      return;
    }

    // Check pool balance
    if (!poolBalance || poolBalance.available / 1e9 < amountNum) {
      showStatusNotification(`Insufficient pool balance. Need ${amountNum} SOL.`);
      return;
    }

    // Show confirmation
    Alert.alert(
      'Confirm Private Payment',
      `Amount: ${amountNum} SOL\nTo: ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-8)}\n\nPrivacy: ${getPrivacyLevel()}\nEstimated Fee: ~${estimatePrivateTransferFee().toFixed(6)} SOL\n\nThis payment will be settled using ZK proofs with sender anonymity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setLoading(true);

            try {
              const result = await createPrivatePayment(connection, wallet, {
                recipientAddress,
                amount: amountNum,
              });

              if (result.success) {
                showStatusNotification(`Successfully sent ${amountNum} SOL privately!`);
                navigation.navigate('Wallet');
                loadPoolBalance(); // Refresh balance
              } else {
                throw new Error(result.error || 'Payment failed');
              }
            } catch (error: any) {
              showStatusNotification(error.message || 'Payment failed');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (checkingRegistration) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
        <Header title="Private Transfer" showBack={true} onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.black} />
          <Text style={styles.loadingText}>Checking ShadowID registration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Private Transfer"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ShadowID Registration Status */}
        {!isRegistered && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#FF9800" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>ShadowID Registration Required</Text>
              <Text style={styles.warningText}>
                You must register with ShadowID before making private payments.
              </Text>
              <TouchableOpacity
                style={[styles.registerButton, isRegistering && styles.registerButtonDisabled]}
                onPress={handleRegisterShadowID}
                disabled={isRegistering}
              >
                {isRegistering ? (
                  <>
                    <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.registerButtonText}>Registering...</Text>
                  </>
                ) : (
                  <Text style={styles.registerButtonText}>Register Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pool Balance */}
        {isRegistered && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceTitle}>Privacy Pool Balance</Text>
              <TouchableOpacity onPress={loadPoolBalance}>
                <Ionicons name="refresh" size={20} color={colors.black} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              {poolBalance ? (poolBalance.available / 1e9).toFixed(6) : '0.000000'} SOL
            </Text>
            <TouchableOpacity
              style={styles.depositButton}
              onPress={() => setShowDepositModal(!showDepositModal)}
            >
              <Ionicons name="add-circle" size={18} color={colors.black} />
              <Text style={styles.depositButtonText}>Deposit to Pool</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Deposit Modal */}
        {showDepositModal && (
          <View style={styles.depositModal}>
            <Text style={styles.depositModalTitle}>Deposit to Privacy Pool</Text>
            <Text style={styles.depositModalDescription}>
              Minimum deposit: 0.01 SOL
            </Text>
            <TextInput
              style={styles.input}
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder="Amount (SOL)"
              placeholderTextColor={colors.gray}
              keyboardType="decimal-pad"
            />
            <View style={styles.depositModalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowDepositModal(false);
                  setDepositAmount('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleDeposit}
                disabled={loading}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  {loading ? 'Processing...' : 'Deposit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recipient Address */}
        {isRegistered && (
          <View style={styles.formContainer}>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Recipient Address</Text>
              <TextInput
                style={styles.input}
                value={recipientAddress}
                onChangeText={setRecipientAddress}
                placeholder="Enter Solana address"
                placeholderTextColor={colors.gray}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Amount */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Amount (SOL)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.gray}
                keyboardType="decimal-pad"
              />
            </View>

            {amount && !isNaN(parseFloat(amount)) && (
              <Text style={styles.feeEstimate}>
                Estimated fee: ~{estimatePrivateTransferFee().toFixed(6)} SOL
              </Text>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (loading || !recipientAddress || !amount) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={loading || !recipientAddress || !amount}
            >
              {loading ? (
                <View style={styles.sendButtonLoading}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.sendButtonLoadingText}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.sendButtonText}>Send Privately</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Status Notification */}
      {showStatus && (
        <Animated.View style={[styles.statusToast, { opacity: fadeAnim }]}>
          <Text style={styles.statusToastText}>{statusMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 20,
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  balanceCard: {
    backgroundColor: colors.white,
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.black,
    marginBottom: 24,
    letterSpacing: -1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  depositButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
    paddingVertical: 14,
    borderRadius: 16,
  },
  depositButtonText: {
    color: colors.black,
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },
  depositModal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  depositModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 8,
  },
  depositModalDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  depositModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F5F5F7',
  },
  modalButtonConfirm: {
    backgroundColor: colors.black,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.black,
  },
  formContainer: {
    gap: 24,
  },
  inputSection: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    padding: 18,
    fontSize: 17,
    color: colors.black,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  feeEstimate: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginLeft: 4,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.black,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  sendButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sendButtonLoadingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statusToast: {
    position: 'absolute',
    bottom: 50,
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
    zIndex: 1000,
  },
  statusToastText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PrivateTransferScreen;