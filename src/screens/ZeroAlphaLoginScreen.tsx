import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import { ZeroAlphaService } from '../services/zeroAlphaService';
import { useWallet } from '../context/WalletContext';
import { Ionicons } from '@expo/vector-icons';

const ZeroAlphaLoginScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { wallet } = useWallet();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [loading, setLoading] = useState(false);
    const otpRefs = useRef<Array<TextInput | null>>([]);

    const handleOtpChange = (text: string, index: number) => {
        const newOtp = otp.split('');
        newOtp[index] = text;
        const finalOtp = newOtp.join('');
        setOtp(finalOtp);

        if (text && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleSendOtp = async () => {
        if (!email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email');
            return;
        }
        setLoading(true);
        const result = await ZeroAlphaService.sendOtp(email);
        setLoading(false);

        if (result.success) {
            setStep('otp');
            Alert.alert('Success', 'Access code sent to your email');
        } else {
            Alert.alert('Error', result.error || 'Failed to send code');
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) {
            Alert.alert('Error', 'Please enter the 6-digit code');
            return;
        }
        if (!wallet) {
            Alert.alert('Error', 'Wallet not connected');
            return;
        }

        setLoading(true);
        const result = await ZeroAlphaService.verifyOtp(email, otp, wallet.publicKey.toBase58());
        setLoading(false);

        if (result.success) {
            Alert.alert('Welcome', 'You are now connected to Zero Alpha');
            navigation.goBack();
        } else {
            Alert.alert('Error', result.error || 'Invalid code');
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.black} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Zero Alpha Access</Text>
                </View>

                <View style={styles.content}>
                    <Text style={styles.funText}>Zero Alpha Points</Text>
                    <Text style={styles.subtitle}>
                        {step === 'email'
                            ? "Enter your email to access exclusive Zero Alpha features and points."
                            : `Enter the code sent to ${email}`}
                    </Text>

                    {step === 'email' ? (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={colors.gray}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleSendOtp}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Send Code</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={styles.otpContainer}>
                                {Array(6).fill(0).map((_, i) => (
                                    <TextInput
                                        key={i}
                                        ref={(ref: TextInput | null) => { otpRefs.current[i] = ref; }}
                                        style={[styles.otpInput, otp[i] ? styles.otpInputFilled : null]}
                                        placeholder=""
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        value={otp[i] || ''}
                                        onChangeText={(text) => handleOtpChange(text, i)}
                                        onKeyPress={({ nativeEvent }) => {
                                            if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) {
                                                otpRefs.current[i - 1]?.focus();
                                            }
                                        }}
                                    />
                                ))}
                            </View>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleVerifyOtp}
                                disabled={loading}
                            >
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Verify Access</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStep('email')} style={styles.linkButton}>
                                <Text style={styles.linkText}>Change Email</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.black,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
        justifyContent: 'flex-end',
    },
    funText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: 16,
        color: colors.gray,
        marginBottom: 32,
        lineHeight: 24,
    },
    input: {
        backgroundColor: colors.lightGray,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.black,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    button: {
        backgroundColor: colors.black,
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buttonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        color: colors.black,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 8,
    },
    otpInput: {
        backgroundColor: colors.lightGray,
        borderRadius: 12,
        padding: 12,
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.black,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        textAlign: 'center',
        flex: 1,
        minHeight: 60,
    },
    otpInputFilled: {
        borderColor: colors.black,
        backgroundColor: colors.white,
    },
});

export default ZeroAlphaLoginScreen;
