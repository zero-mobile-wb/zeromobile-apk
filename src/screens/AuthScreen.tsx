import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { ZeroAlphaService } from '../services/zeroAlphaService';
import EqualizerLoader from '../components/EqualizerLoader';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

interface AuthScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
}

const countries = [
    "Nigeria", "Ghana", "Kenya", "South Africa", "United States", "United Kingdom", "Canada", "Other"
];

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
    const { currentTheme } = useTheme();
    const { wallet } = useWallet();
    const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [country, setCountry] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const otpRefs = useRef<Array<TextInput | null>>([]);
    const t = currentTheme;

    const handleBack = () => {
        if (step === 'otp' || step === 'profile') setStep('email');
        else navigation.goBack();
    };

    const handleSendOtp = async () => {
        if (!email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email');
            return;
        }
        setIsLoading(true);
        const result = await ZeroAlphaService.sendOtp(email);
        setIsLoading(false);
        if (result.success) setStep('otp');
        else Alert.alert('Error', result.error || 'Failed to send code');
    };

    const handleOtpChange = (text: string, index: number) => {
        const newOtp = otp.split('');
        newOtp[index] = text;
        setOtp(newOtp.join(''));
        if (text && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) {
            Alert.alert('Error', 'Please enter the 6-digit code');
            return;
        }
        setIsLoading(true);
        try {
            const walletAddress = wallet?.publicKey.toBase58() || '';
            const user = await ZeroAlphaService.getUserStats(email);

            if (user && user.name && user.country) {
                const result = await ZeroAlphaService.verifyOtp(email, otp, walletAddress);
                setIsLoading(false);
                if (result.success) navigation.navigate('Wallet');
                else Alert.alert('Error', result.error || 'Invalid code');
            } else {
                setIsLoading(false);
                setStep('profile');
            }
        } catch (error) {
            setIsLoading(false);
            Alert.alert('Error', 'Verification failed');
        }
    };

    const handleCompleteProfile = async () => {
        if (!name || !country) {
            Alert.alert('Error', 'Name and Country are required');
            return;
        }
        setIsLoading(true);
        try {
            const walletAddress = wallet?.publicKey.toBase58() || '';
            const result = await ZeroAlphaService.verifyOtp(email, otp, walletAddress, name, country);
            setIsLoading(false);
            if (result.success) navigation.navigate('Wallet');
            else Alert.alert('Error', result.error || 'Failed to complete profile');
        } catch (error) {
            setIsLoading(false);
            Alert.alert('Error', 'Failed to save profile');
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'email':
                return (
                    <View style={styles.stepContainer}>
                        <Text style={[styles.stepTitle, { color: t.text }]}>Enter your email</Text>
                        <Text style={[styles.stepSubtitle, { color: t.textLight }]}>We'll send you a verification code</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: t.card, color: t.text, borderColor: t.border }]}
                            placeholder="Email Address"
                            placeholderTextColor={t.textLight}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                            autoFocus
                        />
                        <View style={{ flex: 1 }} />
                        <LinearGradient colors={[t.gradientStart, t.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                            <TouchableOpacity onPress={handleSendOtp} disabled={isLoading} style={styles.gradientBtnInner}>
                                {isLoading ? <ActivityIndicator color={t.btnText} /> : <Text style={[styles.buttonText, { color: t.btnText }]}>Continue</Text>}
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                );
            case 'otp':
                return (
                    <View style={styles.stepContainer}>
                        <Text style={[styles.stepTitle, { color: t.text }]}>Verify your email</Text>
                        <Text style={[styles.stepSubtitle, { color: t.textLight }]}>Enter the 6-digit code sent to {email}</Text>
                        <View style={styles.otpContainer}>
                            {Array(6).fill(0).map((_, i) => (
                                <TextInput
                                    key={i}
                                    ref={(ref) => { otpRefs.current[i] = ref; }}
                                    style={[
                                        styles.otpInput,
                                        { backgroundColor: t.card, color: t.text, borderColor: t.border },
                                        otp[i] ? { borderColor: t.secondary, backgroundColor: t.background } : null,
                                    ]}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    value={otp[i] || ''}
                                    onChangeText={(text) => handleOtpChange(text, i)}
                                    onKeyPress={({ nativeEvent }) => {
                                        if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                                    }}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </View>
                        <View style={{ flex: 1 }} />
                        <LinearGradient colors={[t.gradientStart, t.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                            <TouchableOpacity onPress={handleVerifyOtp} disabled={isLoading} style={styles.gradientBtnInner}>
                                {isLoading ? <ActivityIndicator color={t.btnText} /> : <Text style={[styles.buttonText, { color: t.btnText }]}>Verify</Text>}
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                );
            case 'profile':
                return (
                    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.stepTitle, { color: t.text }]}>Complete your profile</Text>
                        <Text style={[styles.stepSubtitle, { color: t.textLight }]}>Tell us a bit about yourself</Text>
                        <Text style={[styles.label, { color: t.text }]}>Full Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: t.card, color: t.text, borderColor: t.border }]}
                            placeholder="John Doe"
                            placeholderTextColor={t.textLight}
                            value={name}
                            onChangeText={setName}
                        />
                        <Text style={[styles.label, { color: t.text }]}>Country</Text>
                        <View style={styles.countryList}>
                            {countries.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[
                                        styles.countryItem,
                                        { backgroundColor: t.card, borderColor: t.border },
                                        country === c && { backgroundColor: t.secondary, borderColor: t.secondary },
                                    ]}
                                    onPress={() => setCountry(c)}
                                >
                                    <Text
                                        style={[
                                            styles.countryText,
                                            { color: t.text },
                                            country === c && { color: t.btnText, fontWeight: 'bold' },
                                        ]}
                                    >
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flex: 1, minHeight: 40 }} />
                        <LinearGradient colors={[t.gradientStart, t.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
                            <TouchableOpacity onPress={handleCompleteProfile} disabled={isLoading} style={styles.gradientBtnInner}>
                                {isLoading ? <ActivityIndicator color={t.btnText} /> : <Text style={[styles.buttonText, { color: t.btnText }]}>Complete Setup</Text>}
                            </TouchableOpacity>
                        </LinearGradient>
                    </ScrollView>
                );
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoid}>
                <View style={[styles.header, { borderBottomColor: t.border }]}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={t.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: t.text }]}>Account Setup</Text>
                    <View style={{ width: 24 }} />
                </View>
                <EqualizerLoader visible={isLoading} />
                <View style={styles.content}>{renderContent()}</View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardAvoid: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backButton: { padding: 4 },
    content: { flex: 1, padding: 24 },
    stepContainer: { width: '100%', flex: 1 },
    stepTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    stepSubtitle: { fontSize: 16, marginBottom: 24 },
    input: { borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20, borderWidth: 1 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 8 },
    primaryButton: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 10 },
    gradientBtnInner: { width: '100%', alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: 'bold' },
    otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
    otpInput: { borderRadius: 12, padding: 12, fontSize: 24, fontWeight: 'bold', borderWidth: 1, textAlign: 'center', flex: 1, minHeight: 60 },
    countryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
    countryItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    countryText: { fontSize: 14 },
});

export default AuthScreen;
