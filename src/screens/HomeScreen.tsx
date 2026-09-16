import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { useWallet } from '../context/WalletContext';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import PrivyOnboardingModal from '../components/PrivyOnboardingModal';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
}

const WORDS = ["USDC", "On and Off Ramping", "Selfcustody", "Privacy", "Earning", "Savings"];

const VerticalCyclingText = () => {
  const { currentTheme } = useTheme();
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Step 1: Slide DOWN and fade OUT the current word
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 2: Swap the word and prepare it UP (-20)
        setIndex((prev) => (prev + 1) % WORDS.length);
        slideAnim.setValue(-20);

        // Step 3: Slide DOWN to center (0) and fade IN
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.cyclingContainer}>
      <Text style={[styles.preText, { color: currentTheme.text }]}>Experience </Text>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text
          style={[styles.boldText, { color: currentTheme.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {WORDS[index]}
        </Text>
      </Animated.View>
    </View>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, wallets, walletsLoaded, signedOut, isWalletConfirmed, createWallet, hasStoredKeys } = useWallet();
  const [lockTimedOut, setLockTimedOut] = useState(false);
  // Once the user opens onboarding this session, Home must never route to
  // Lock itself — the onboarding flow navigates to Wallet on completion.
  const onboardedRef = useRef(false);
  const openOnboarding = () => {
    onboardedRef.current = true;
    setShowOnboarding(true);
  };

  useEffect(() => {
    const t = setTimeout(() => setLockTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, []);
  const [isCreating, setIsCreating] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { user, isReady } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address;

  useEffect(() => {
    // Session already unlocked in-memory (fresh create/import) → straight in
    if (wallet && isWalletConfirmed) {
      navigation.navigate('Wallet');
      return;
    }
    if (onboardedRef.current || signedOut) return;
    if (!walletsLoaded && !isReady && !lockTimedOut) return;
    // Privy session → lock screen.
    if (isReady && user && privySolanaAddress) {
      navigation.navigate('Lock');
      return;
    }
    // Local wallet index → lock ONLY if the keys are actually on this
    // device. A stale index (restored backup, wiped keychain) can never
    // unlock, so it correctly stays on Home instead of a dead-end Lock.
    if (wallets.length > 0) {
      let alive = true;
      hasStoredKeys().then(ok => {
        if (alive && ok) navigation.navigate('Lock');
      });
      return () => { alive = false; };
    }
  }, [wallet, wallets, walletsLoaded, lockTimedOut, signedOut, isWalletConfirmed, isReady, user, privySolanaAddress, navigation, hasStoredKeys]);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      await createWallet();
      navigation.navigate('Wallet');
    } catch (error) {
      Alert.alert('Error', 'Failed to create wallet');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <View style={[styles.mainContent, { backgroundColor: currentTheme.primary }]}>
        {/* Design Image Section with Border Radius — wallet-style top fade */}
        <View style={[styles.imageContainer, { backgroundColor: currentTheme.primary }]}>
          <View style={styles.imageBlur} pointerEvents="none">
            <LinearGradient
              colors={[currentTheme.gradientStart, 'transparent']}
              style={{ flex: 1 }}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
          <Image
            source={require('../../assets/home.png')}
            style={styles.homeImage}
            resizeMode="contain"
          />
        </View>

        {/* Thought Bubble Blobs */}
        <View style={[styles.blob, styles.blob1, { backgroundColor: '#c7bab2' }]} />
        <View style={[styles.blob, styles.blob2, { backgroundColor: '#c7bab2' }]} />
        <View style={[styles.blob, styles.blob3, { backgroundColor: '#c7bab2' }]} />

        <View style={[styles.bottomSection, { backgroundColor: currentTheme.primary }]}>
          <View style={styles.textContainer}>
            <VerticalCyclingText />
            <Text style={[styles.mainTitleSmall, { color: currentTheme.textLight }]}>
              The easiest way to buy and trade{"\n"}your favorite tokens
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            {currentTheme.id === 'white' ? (
              <TouchableOpacity
                style={[styles.button, styles.createButton, { backgroundColor: currentTheme.text }]}
                onPress={openOnboarding}
                disabled={isCreating}
              >
                <Text style={[styles.buttonText, { color: currentTheme.primary }]}>Get Started</Text>
              </TouchableOpacity>
            ) : (
              <LinearGradient
                colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.button, { paddingVertical: 0, overflow: 'hidden' }]}
              >
                <TouchableOpacity
                  style={{ width: '100%', paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}
                  onPress={openOnboarding}
                  disabled={isCreating}
                >
                  <Text style={[styles.buttonText, { color: currentTheme.primary }]}>Get Started</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            <View style={styles.secondaryActions}>
              <TouchableOpacity onPress={() => navigation.navigate('ImportWallet' as any)} style={styles.secondaryLink}>
                <Text style={[styles.importLinkText, { color: currentTheme.textLight }]}>
                  <Text style={[styles.importLinkBold, { color: currentTheme.text }]}>Import existing wallet</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>


      {/* Full-screen loading overlay */}
      <Modal visible={isCreating} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.loadingText}>Creating your wallet...</Text>
        </View>
      </Modal>

      {/* Privy onboarding modal */}
      <PrivyOnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onCreateWithKeys={handleCreateWallet}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    backgroundColor: colors.white,
  },
  imageContainer: {
    height: '48%',
    width: '100%',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  imageBlur: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  homeImage: {
    width: '100%',
    height: '90%',
  },
  blob: {
    position: 'absolute',
    backgroundColor: colors.black,
  },
  blob1: {
    width: 32,
    height: 38,
    borderRadius: 16,
    top: '48%',
    right: '25%',
    marginTop: 5,
  },
  blob2: {
    width: 20,
    height: 24,
    borderRadius: 10,
    top: '52%',
    right: '18%',
    marginTop: 10,
  },
  blob3: {
    width: 12,
    height: 14,
    borderRadius: 6,
    top: '55%',
    right: '15%',
    marginTop: 5,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'flex-start',
  },
  mainTitleSmall: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.gray,
    lineHeight: 32,
    textAlign: 'left',
    fontFamily: 'sans-serif',
    marginTop: 12,
  },
  cyclingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  preText: {
    fontSize: 28,
    fontWeight: '400',
    fontFamily: 'sans-serif',
  },
  boldText: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'sans-serif',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    width: '100%',
  },
  createButton: {
    backgroundColor: '#1A1C1E',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'sans-serif',
  },
  importLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  importLinkText: {
    fontSize: 14,
    fontFamily: 'sans-serif',
  },
  importLinkBold: {
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  secondaryLink: {
    paddingHorizontal: 16,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: '#E5E5E5',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loadingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'sans-serif',
  },
});

export default HomeScreen;