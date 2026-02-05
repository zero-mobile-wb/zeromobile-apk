import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showAddress?: boolean;
  onTokensPress?: () => void;
  showBrowser?: boolean;
  onBrowserPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBackPress,
  showAddress = false,
  onTokensPress,
  showBrowser = false,
  onBrowserPress,
}) => {
  const { currentTheme } = useTheme();
  const { wallet } = useWallet();
  
  const getTruncatedAddress = () => {
    if (wallet) {
      const address = wallet.publicKey.toBase58();
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return '';
  };

  return (
    <>
      {/* StatusBar for top system bar */}
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={currentTheme.primary} 
        translucent={true}
      />
      
      {/* SafeAreaView pushes content below notch/status bar */}
      <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.primary }]}>
        <View style={[styles.header, { 
          backgroundColor: currentTheme.primary,
          borderBottomColor: currentTheme.accent,
        }]}>
          <View style={styles.headerLeft}>
            {showBack ? (
              <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.black} />
              </TouchableOpacity>
            ) : (
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.headerCenter}>
            {title && <Text style={[styles.title, { color: colors.black }]}>{title.toUpperCase()}</Text>}
          </View>
          
          <View style={styles.headerRight}>
            <View style={styles.iconsRow}>
              {showAddress && wallet && (
                <TouchableOpacity style={styles.addressContainer} onPress={onTokensPress}>
                  <Ionicons name="cash-outline" size={28} color={colors.black} />
                </TouchableOpacity>
              )}
              {showBrowser && (
                <TouchableOpacity style={styles.browserButton} onPress={onBrowserPress}>
                  <Ionicons name="globe-outline" size={24} color={colors.black} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    // backgroundColor applied dynamically
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // backgroundColor and borderBottomColor applied dynamically
    borderBottomWidth: 1,
    // Add padding for Android status bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    // color applied dynamically
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  address: {
    fontSize: 12,
    // color applied dynamically
    marginRight: 8,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  browserButton: {
    padding: 4,
  },
});

export default Header;