import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import WavyDotsLoader from '../components/WavyDotsLoader';
import AnimatedCheckmark from '../components/AnimatedCheckmark';
import { sendSOL, sendSPLToken } from '../services/transactionService';

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
    };
  };
}

const TransactionScreen: React.FC<TransactionScreenProps> = ({ navigation, route }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();
  const { amount, amountInSOL, address, tokenMint, tokenSymbol, tokenDecimals, status: initialStatus } = route.params;
  const [status, setStatus] = useState<'submitting' | 'success' | 'error'>(initialStatus);
  const [signature, setSignature] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');


  useEffect(() => {
    // Send the actual transaction
    const executeTransaction = async () => {
      if (status === 'submitting' && wallet) {
        try {
          let result: any;
          
          // Check if it's SOL or SPL token
          const isSOL = tokenMint === 'So11111111111111111111111111111111111111112';
          
          if (isSOL) {
            // Send SOL
            result = await sendSOL(
              connection,
              wallet,
              address,
              parseFloat(amountInSOL)
            );
          } else {
            // Send SPL Token
            result = await sendSPLToken(
              connection,
              wallet,
              address,
              tokenMint,
              parseFloat(amountInSOL),
              tokenDecimals
            );
          }

          if (result.success && result.signature) {
            setSignature(result.signature);
            setStatus('success');
          } else {
            const error = result.error || 'Transaction failed';
            setErrorMessage(error);
            setStatus('error');
          }
        } catch (error: any) {
          console.error('Transaction error:', error);
          setErrorMessage(error.message || 'Transaction failed');
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
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
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
            <WavyDotsLoader size={20} color={colors.black} />
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
              <Text style={styles.statusTitle}>Submitting Transaction</Text>
              <Text style={styles.statusSubtitle}>Please wait...</Text>
            </>
          )}
          {status === 'success' && (
            <>
              <Text style={styles.statusTitle}>Transaction Submitted!</Text>
              <Text style={styles.statusSubtitle}>
                Your transaction has been successfully sent
              </Text>
              {/* Transaction Amount - Bold and Centered */}
              <View style={styles.amountDisplayContainer}>
                <Text style={styles.amountDisplayValue}>
                  ${amount}
                </Text>
              </View>
              {signature && (
                <Text style={styles.signatureText}>
                  {truncateAddress(signature)}
                </Text>
              )}
            </>
          )}
          {status === 'error' && (
            <>
              <Text style={styles.statusTitle}>Transaction Failed</Text>
              <Text style={styles.statusSubtitle}>
                {errorMessage || 'Something went wrong. Please try again.'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      {status === 'success' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
    fontFamily: 'monospace',
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
    borderColor: colors.black,
  },
  cancelButtonText: {
    color: colors.black,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TransactionScreen;
