import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  useLoginWithEmail,
  useEmbeddedSolanaWallet,
  useEmbeddedEthereumWallet,
  usePrivy,
} from '@privy-io/expo';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Step = 'choose' | 'email' | 'otp' | 'creating';
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreateWithKeys: () => void;
}

// ─── 6-Digit OTP Grid ──────────────────────────────────────────────────────────
const OTPInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange,
}) => {
  const { currentTheme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(6, ' ').split('');

  // Focus only after the sheet has settled — focusing mid-animation is what
  // makes the sheet shake on slower phones.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
      {digits.map((d, i) => (
        <View
          key={i}
          style={[
            styles.otpBox,
            { backgroundColor: currentTheme.card, borderColor: currentTheme.border },
            value.length === i && { borderColor: currentTheme.text, borderWidth: 2 },
            value.length > i && { borderColor: currentTheme.textLight },
          ]}
        >
          <Text style={[styles.otpDigit, { color: currentTheme.text }]}>{d.trim()}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.otpHiddenInput}
      />
    </TouchableOpacity>
  );
};

// ─── Inner modal content ───────────────────────────────────────────────────────
interface ModalContentProps extends Props {
  step: Step;
  setStep: (step: Step) => void;
}

const ModalContent: React.FC<ModalContentProps> = ({ onClose, onCreateWithKeys, step, setStep }) => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<Nav>();
  const { logout } = usePrivy();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [creatingMsg, setCreatingMsg] = useState('Verifying…');
  const emailRef = useRef<TextInput>(null);

  // Same anti-shake rule as OTP: only focus once the step has settled.
  useEffect(() => {
    if (step !== 'email') return;
    const t = setTimeout(() => emailRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [step]);

  const solana = useEmbeddedSolanaWallet();
  const ethereum = useEmbeddedEthereumWallet();

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onSendCodeSuccess: () => setStep('otp'),
    onLoginSuccess: async () => {
      setStep('creating');
      await createWallets();
    },
    onError: (err) => {
      Alert.alert('Error', err.message);
      setEmailLoading(false);
    },
  });

  const createWallets = async () => {
    try {
      setCreatingMsg('Creating Solana wallet…');
      if (solana?.create) await solana.create({ recoveryMethod: 'privy' } as any);

      setCreatingMsg('Creating EVM wallet…');
      if (ethereum?.create) await ethereum.create({ recoveryMethod: 'privy' } as any);

      setCreatingMsg('All done!');
      await new Promise((r) => setTimeout(r, 600));
      onClose();
      navigation.navigate('Wallet');
    } catch (e: any) {
      onClose();
      navigation.navigate('Wallet');
    }
  };

  const handleSendCode = async () => {
    if (!email.trim()) return Alert.alert('Enter your email first');
    try {
      setEmailLoading(true);
      try {
        await logout(); // Clear any existing/stale session before starting new login flow
      } catch (e) {
        // Ignore logout errors if not logged in
      }
      await sendCode({ email: email.trim() });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send code');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) return;
    try {
      setEmailLoading(true);
      await loginWithCode({ code, email: email.trim() });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to verify code');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <View>
      <View style={[styles.handle, { backgroundColor: currentTheme.border }]} />

      {step === 'choose' && (
        <>
          <Text style={[styles.title, styles.centered, { color: currentTheme.text }]}>Get started with Zeroo</Text>
          <Text style={[styles.subtitle, styles.centered, { color: currentTheme.textLight }]}>Choose how you'd like to set up your wallet</Text>

          {/* Social option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
            onPress={() => setStep('email')}
            activeOpacity={0.75}
          >
            <View style={styles.optionRow}>
              <LinearGradient
                colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.optionIconGrad}
              >
                <Ionicons name="mail" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.optionText}>
                <View style={styles.optionTitleRow}>
                  <Text style={[styles.optionTitle, { color: currentTheme.text }]}>Social Login</Text>
                  <View style={[styles.recommendedBadge, { backgroundColor: currentTheme.text }]}>
                    <Text style={[styles.recommendedText, { color: currentTheme.primary }]}>RECOMMENDED</Text>
                  </View>
                </View>
                <Text style={[styles.optionDesc, { color: currentTheme.textLight }]} numberOfLines={2}>Sign in with email to auto-create wallets</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={currentTheme.textLight} />
            </View>
          </TouchableOpacity>

          {/* Keys option */}
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
            activeOpacity={0.75}
            onPress={() => {
              onClose();
              onCreateWithKeys();
            }}
          >
            <View style={styles.optionRow}>
              <View style={[styles.optionIcon, { backgroundColor: currentTheme.border }]}>
                <Ionicons name="key" size={20} color={currentTheme.text} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: currentTheme.text }]}>Create Wallet Keys</Text>
                <Text style={[styles.optionDesc, { color: currentTheme.textLight }]} numberOfLines={2}>Generate and manage your own private keys</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={currentTheme.textLight} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: currentTheme.textLight }]}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'email' && (
        <View>
          <TouchableOpacity onPress={() => setStep('choose')} style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={currentTheme.text} />
            <Text style={[styles.backText, { color: currentTheme.text }]}>Back</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: currentTheme.text }]}>Enter your email</Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>We'll send a 6-digit code to verify it's you</Text>

          <Text style={[styles.inputLabel, { color: currentTheme.textLight }]}>EMAIL ADDRESS</Text>
          <TextInput
            ref={emailRef}
            style={[styles.input, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, color: currentTheme.text }]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={currentTheme.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnShadow, { backgroundColor: currentTheme.text }, (!email.trim() || emailLoading) && styles.primaryBtnDim]}
            onPress={handleSendCode}
            disabled={!email.trim() || emailLoading}
            activeOpacity={0.85}
          >
            {emailLoading ? (
              <ActivityIndicator color={currentTheme.primary} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: currentTheme.primary }]}>Send Code</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.privacyNote, { color: currentTheme.textLight }]}>
            Secured by Privy · Your keys never leave your device
          </Text>
        </View>
      )}

      {step === 'otp' && (
        <View>
          <TouchableOpacity onPress={() => { setStep('email'); setCode(''); }} style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={currentTheme.text} />
            <Text style={[styles.backText, { color: currentTheme.text }]}>Back</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: currentTheme.text }]}>Check your inbox</Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>
            Code sent to <Text style={{ color: currentTheme.text, fontWeight: 'bold' }}>{email}</Text>
          </Text>

          <OTPInput value={code} onChange={setCode} />

          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnShadow, { backgroundColor: currentTheme.text }, (code.length < 6 || emailLoading) && styles.primaryBtnDim]}
            onPress={handleVerify}
            disabled={code.length < 6 || emailLoading}
            activeOpacity={0.85}
          >
            {emailLoading ? (
              <ActivityIndicator color={currentTheme.primary} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: currentTheme.primary }]}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={handleSendCode} disabled={emailLoading}>
            <Text style={[styles.resendText, { color: currentTheme.textLight }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'creating' && (
        <View style={styles.creatingSheet}>
          <View style={styles.creatingBadge}>
            <ActivityIndicator size="large" color={currentTheme.text} />
          </View>
          <Text style={[styles.title, { color: currentTheme.text }]}>Setting up your wallets</Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>{creatingMsg}</Text>

          <View style={styles.walletRow}>
            <View style={[styles.walletChip, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <Text style={[styles.walletChipText, { color: currentTheme.text }]}>◎ Solana</Text>
            </View>
            <View style={[styles.walletChip, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <Text style={[styles.walletChipText, { color: currentTheme.text }]}>⟠ EVM</Text>
            </View>
          </View>

          <Text style={[styles.privacyNote, { color: currentTheme.textLight }]}>
            Your wallets are encrypted and stored locally. Privy never holds your keys.
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Exported Modal Wrapper ────────────────────────────────────────────────────
const PrivyOnboardingModal: React.FC<Props> = (props) => {
  const { currentTheme, themeId } = useTheme();
  const isDark = themeId === 'dark';
  const { height: screenH } = useWindowDimensions();
  const [show, setShow] = useState(props.visible);
  const [step, setStep] = useState<Step>('choose');
  const slideAnim = useRef(new Animated.Value(screenH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.visible) {
      setShow(true);
      setStep('choose'); // reset step on open
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenH, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setShow(false);
      });
    }
  }, [props.visible, screenH, slideAnim, backdropAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: screenH, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      props.onClose();
    });
  };

  return (
    <Modal
      visible={show}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.outerContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }) }]}>
            <TouchableOpacity
              style={styles.flex1}
              activeOpacity={1}
              onPress={step === 'choose' ? handleClose : undefined}
            />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], maxHeight: '92%' }}>
          <ScrollView
            style={[
              styles.sheet,
              {
                backgroundColor: currentTheme.primary,
                borderTopColor: currentTheme.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: isDark ? 0.4 : 0.12,
                shadowRadius: 16,
                elevation: 20,
              },
            ]}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <ModalContent {...props} onClose={handleClose} step={step} setStep={setStep} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default PrivyOnboardingModal;

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'black' },
  flex1: { flex: 1 },
  
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    paddingTop: 12,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 24,
  },
  // Titles
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  centered: { textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    marginBottom: 28,
    lineHeight: 22,
  },

  // Back
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 16, fontWeight: '500' },

  // Option cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  optionRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconGrad: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 5, paddingRight: 4 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle: { fontSize: 16, fontWeight: 'bold' },
  optionDesc: { fontSize: 13, lineHeight: 18 },

  recommendedBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  recommendedText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },

  cancelBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: '500' },

  // Input
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    fontSize: 17,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 22,
  },

  // Primary button
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDim: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: 'bold' },

  // OTP
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
    marginTop: 8,
    position: 'relative',
  },
  otpBox: {
    width: 46,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: { fontSize: 26, fontWeight: 'bold' },
  otpHiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 14, fontWeight: '500' },

  privacyNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },

  // Creating
  creatingSheet: { alignItems: 'center', paddingTop: 16 },
  creatingBadge: { marginBottom: 24 },
  walletRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  walletChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  walletChipText: { fontSize: 14, fontWeight: '600' },
});
