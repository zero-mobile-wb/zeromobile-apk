/* eslint-disable react-hooks/refs */
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import LiquidGlassButton from './LiquidGlassButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.85;

const EMOJIS = ['🦊', '🐸', '🌸', '🔥', '💎', '🌊', '🍀', '⚡', '🎯', '🦋', '🌙', '🍊', '🐼', '🦁', '🦖', '🦄', '🐝', '🐙', '👾', '🤖', '🚀', '🌟', '🥑', '🎨'];
const CIRCLE_COLORS = ['#334155', '#475569', '#374151', '#4B5563', '#27272A', '#3F3F46', '#52525B', '#1E293B'];

function getStableRandom(address: string) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = ((hash << 5) - hash) + address.charCodeAt(i);
  return Math.abs(hash);
}

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showAddress?: boolean;
  onTokensPress?: () => void;
  showBrowser?: boolean;
  onBrowserPress?: () => void;
  onCreateInvoice?: () => void;
  showViewToggle?: boolean;
  activeView?: 'wallet' | 'points';
  onViewToggle?: (view: 'wallet' | 'points') => void;
  showTokenToggle?: boolean;
  activeTokenView?: 'tokens' | 'prestocks';
  onTokenToggle?: (view: 'tokens' | 'prestocks') => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBackPress,
  showAddress = false,
  onTokensPress,
  showBrowser = false,
  onBrowserPress,
  onCreateInvoice,
  showViewToggle = false,
  activeView = 'wallet',
  onViewToggle,
  showTokenToggle = false,
  activeTokenView = 'tokens',
  onTokenToggle,
}) => {
  const { currentTheme } = useTheme();
  const { wallet } = useWallet();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
   };

  const walletAddr = wallet?.publicKey.toBase58() || '';
  const stableIdx = getStableRandom(walletAddr);
  const walletEmoji = EMOJIS[stableIdx % EMOJIS.length];
  const walletColor = CIRCLE_COLORS[stableIdx % CIRCLE_COLORS.length];

  return (
    <>
      {/* StatusBar for top system bar */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor={currentTheme.primary}
        translucent={true}
      />

      {/* Safe-area padding comes from insets only — no manual status-bar
          padding, otherwise Android gets a double top margin. */}
      <View style={{ backgroundColor: 'transparent', paddingTop: insets.top }}>
        {/* Green gradient blur behind header */}
        <LinearGradient
          colors={[currentTheme.gradientStart || currentTheme.accent, 'transparent']}
          style={styles.headerGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={[styles.header, {
          backgroundColor: 'transparent',
        }]}>
          <View style={[styles.headerLeft, showViewToggle && { flex: 3 }]}>
              {showBack ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
                  </TouchableOpacity>
                  {showTokenToggle && (
                    <View style={styles.tokenToggleContainer}>
                      <TouchableOpacity
                        onPress={() => onTokenToggle?.('tokens')}
                        style={[
                          styles.tokenToggleButton,
                          activeTokenView === 'tokens' && { backgroundColor: currentTheme.gradientStart },
                        ]}
                      >
                         <Text style={[styles.tokenToggleText, { color: activeTokenView === 'tokens' ? currentTheme.btnText : currentTheme.text }]}>Tokens</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onTokenToggle?.('prestocks')}
                        style={[
                          styles.tokenToggleButton,
                          activeTokenView === 'prestocks' && { backgroundColor: currentTheme.gradientStart },
                        ]}
                      >
                        <Text style={[styles.tokenToggleText, { color: activeTokenView === 'prestocks' ? currentTheme.btnText : currentTheme.text }]}>PreStocks</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {showAddress && (
                    <LiquidGlassButton
                      size={44}
                      onPress={onTokensPress}
                      style={{ marginLeft: 8 }}
                    >
                      <Text style={[styles.emojiText, { fontSize: 22 }]}>{walletEmoji}</Text>
                    </LiquidGlassButton>
                  )}
                  {showViewToggle && (
                  <View style={[styles.toggleContainer, { backgroundColor: currentTheme.border }]}>
                    <TouchableOpacity
                      style={[styles.toggleButton, activeView === 'wallet' && { backgroundColor: currentTheme.gradientStart }]}
                      onPress={() => onViewToggle?.('wallet')}
                    >
                      <Ionicons name="wallet" size={20} color={activeView === 'wallet' ? currentTheme.text : currentTheme.textLight} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleButton, activeView === 'points' && { backgroundColor: currentTheme.gradientStart }]}
                      onPress={() => onViewToggle?.('points')}
                    >
                      <Ionicons name="planet-outline" size={20} color={activeView === 'points' ? currentTheme.text : currentTheme.textLight} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={[styles.headerCenter, showViewToggle && { flex: 0 }]}>
            {title && !showViewToggle ? (
              <Text style={[styles.title, { color: currentTheme.text }]}>{title}</Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            <View style={styles.iconsRow}>
              {showBrowser && (
                <LiquidGlassButton size={44} onPress={onBrowserPress}>
                  <Ionicons name="compass-outline" size={24} color={currentTheme.text} />
                </LiquidGlassButton>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Sidebar */}
      {sidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}>
            <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={closeSidebar} />
          </Animated.View>
          <Animated.View style={[styles.sidebar, { backgroundColor: currentTheme.card }, { transform: [{ translateX: slideAnim }] }]}>
            <SafeAreaView style={styles.sidebarSafe}>
              <View style={styles.sidebarContent}>
                {/* Wallet Address + Switch */}
                <View style={styles.sidebarWalletRow}>
                  <View style={[styles.sidebarEmojiCircle, { backgroundColor: walletColor }]}>
                    <Text style={styles.emojiText}>{walletEmoji}</Text>
                  </View>
                  <Text style={[styles.sidebarAddress, { color: currentTheme.text }]} numberOfLines={1}>
                    {wallet ? `${wallet.publicKey.toBase58().slice(0, 6)}...${wallet.publicKey.toBase58().slice(-4)}` : ''}
                  </Text>
                  <TouchableOpacity style={[styles.switchBtn, { backgroundColor: currentTheme.border }]}>
                    <Text style={[styles.switchBtnText, { color: currentTheme.textLight }]}>Switch</Text>
                  </TouchableOpacity>
                </View>

                {/* Business Section */}
                <Text style={[styles.sidebarSection, { color: currentTheme.textLight }]}>Business</Text>
                <TouchableOpacity style={styles.sidebarItem} onPress={() => { closeSidebar(); onCreateInvoice?.(); }}>
                  <Ionicons name="briefcase-outline" size={24} color={currentTheme.text} />
                  <Text style={[styles.sidebarItemText, { color: currentTheme.text }]}>Invoicing</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
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
    paddingVertical: 6,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.35,
    zIndex: 0,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  tokenToggleContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginLeft: 8,
  },
  tokenToggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tokenToggleText: {
    fontSize: 15,
    fontWeight: '600',
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
    fontFamily: 'sans-serif',
    fontWeight: '500',
  },
  browserButton: {
    padding: 4,
  },
  emojiText: {
    fontSize: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E5E5',
    borderRadius: 20,
    padding: 4,
    alignItems: 'center',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },

  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, height: Dimensions.get('window').height },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'black' },
  backdropTouch: { flex: 1 },
  sidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  sidebarSafe: { flex: 1 },
  sidebarContent: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },
  sidebarWalletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 10 },
  sidebarEmojiCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  sidebarAddress: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.black, fontFamily: 'monospace' },
  switchBtn: { padding: 8, borderRadius: 20 },
  switchBtnText: { fontSize: 13, fontWeight: '600', color: colors.gray },
  sidebarSection: { fontSize: 12, fontWeight: '700', color: colors.gray, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 },
  sidebarItemText: { fontSize: 17, fontWeight: '500', color: colors.black },
});

export default Header;