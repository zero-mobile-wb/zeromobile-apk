import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWallet } from '../context/WalletContext';
import { useCurrency } from '../context/CurrencyContext';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import SkeletonLoader from '../components/SkeletonLoader';
import CustomRefreshLoader from '../components/CustomRefreshLoader';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance, WalletBalance } from '../services/balanceService';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ZeroAlphaService, ZeroUser } from '../services/zeroAlphaService';

interface WalletScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Wallet'>;
}

const WalletScreen: React.FC<WalletScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();
  const { formatAmount } = useCurrency();
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [zeroUser, setZeroUser] = useState<ZeroUser | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const loadZeroUser = async () => {
        const user = await ZeroAlphaService.getStoredUser();
        if (user) {
          // Refresh stats from backend
          // If backend returns null (e.g. 404 deleted), we should clear local state
          const updatedUser = await ZeroAlphaService.getUserStats(user.email);
          setZeroUser(updatedUser);
        } else {
          setZeroUser(null);
        }
      };
      loadZeroUser();
    }, [])
  );

  const fetchBalance = async (forceRefresh: boolean = false) => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    try {
      const balance = await getWalletBalance(wallet.publicKey, connection, forceRefresh);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalance(true); // Force refresh, bypass cache
  };

  useEffect(() => {
    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);

    return () => clearInterval(interval);
  }, [wallet, connection]);

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      {/* Header handles its own SafeArea */}
      <Header
        showAddress={true}
        onTokensPress={() => navigation.navigate('Tokens')}
      />

      {/* Main content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['transparent']}
            style={{ opacity: 0 }}
            progressBackgroundColor="transparent"
          />
        }
      >
        {refreshing && (
          <View style={styles.customRefreshLoader}>
            <CustomRefreshLoader size={40} />
          </View>
        )}
        <View style={styles.balanceContainer}>
          <View style={styles.balanceLabelContainer}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PrivateTransfer')}
              style={styles.ghostButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="ghost" size={28} color={colors.gray} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.skeletonContainer}>
              <SkeletonLoader width={280} height={100} borderRadius={12} />
              <View style={{ height: 12 }} />
              <SkeletonLoader width={180} height={24} borderRadius={8} />
            </View>
          ) : (
            <>
              <Text style={styles.balanceAmount}>
                {walletBalance ? formatAmount(walletBalance.totalUSD) : formatAmount(0)}
              </Text>
              {walletBalance && (
                <Text style={styles.solBalanceText}>
                  {walletBalance.solBalance.toFixed(4)} SOL
                </Text>
              )}
            </>
          )}
        </View>

        {/* Zero Alpha Entry Button */}
        <TouchableOpacity
          style={styles.zeroAlphaButton}
          onPress={() => navigation.navigate(zeroUser ? 'ZeroAlphaScreen' : 'ZeroAlphaLogin')}
        >
          <View style={styles.zeroAlphaButtonContent}>
            <MaterialCommunityIcons name="star-four-points" size={20} color={colors.white} />
            <Text style={styles.zeroAlphaButtonText}>
              {zeroUser ? `Zero Alpha • ${zeroUser.points}` : 'Join Zero Alpha'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView >

      {/* Action Buttons */}
      < View style={styles.actionButtonsContainer} >
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.sendButton]}
            onPress={() => navigation.navigate('Send')}
          >
            <Text style={styles.sendButtonText}>SEND</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.receiveButton]}
            onPress={() => navigation.navigate('Receive')}
          >
            <Text style={styles.receiveButtonText}>RECEIVE</Text>
          </TouchableOpacity>
        </View>
      </View >

      {/* Navigation handles its own SafeArea */}
      < Navigation
        activeTab="wallet"
        onTabPress={(tab) => {
          if (tab === 'wallet') {
            navigation.navigate('Wallet');
          } else if (tab === 'activity') {
            navigation.navigate('Activity');
          } else if (tab === 'settings') {
            navigation.navigate('Settings');
          }
        }}
      />
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  balanceContainer: {
    marginTop: 20,
    width: '100%',
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  balanceLabel: {
    fontSize: 18,
    color: colors.black,
    fontWeight: '500',
  },
  ghostButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
  },
  balanceAmount: {
    fontSize: 100,
    fontWeight: 'bold',
    color: colors.black,
    lineHeight: 110,
    letterSpacing: -2,
  },
  solBalanceText: {
    fontSize: 20,
    color: colors.gray,
    marginTop: 8,
    fontWeight: '500',
  },
  skeletonContainer: {
    marginTop: 8,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  customRefreshLoader: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    zIndex: 1000,
  },
  userInfoSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  userInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userInfoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  walletAddressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 4,
    marginBottom: 12,
  },
  logoutButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 32,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    minHeight: 75,
  },
  sendButton: {
    backgroundColor: colors.black,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  receiveButton: {
    backgroundColor: colors.transparent,
    borderWidth: 2,
    borderColor: colors.black,
    elevation: 0,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  receiveButtonText: {
    color: colors.black,
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  privateTransferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    paddingVertical: 16,
    borderRadius: 25,
    marginHorizontal: 8,
    marginTop: 8,
    gap: 8,
  },
  privateTransferText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  zeroAlphaButton: {
    marginVertical: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zeroAlphaButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  zeroAlphaButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WalletScreen;