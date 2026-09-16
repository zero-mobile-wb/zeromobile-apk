import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import BiometricService from '../../services/biometricService';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../../components/Header';
import colors from '../../constants/colors';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SecurityWarning'>;
    route: RouteProp<RootStackParamList, 'SecurityWarning'>;
};

const SecurityWarningScreen: React.FC<Props> = ({ navigation, route }) => {
    const { currentTheme } = useTheme();
    const { type } = route.params;

    const secretTitle = type === 'privateKey' ? 'Private Key' : 'Recovery Phrase';

    const handleProceed = async () => {
        const isBiometricAvailable = await BiometricService.isBiometricAvailable();

        if (isBiometricAvailable) {
            const success = await BiometricService.authenticate(`Authenticate to view ${secretTitle}`);
            if (success) {
                // Navigate forward on success, replace so they can't swipe back to warning easily without intent
                navigation.replace('ShowSecret', { type });
            }
        } else {
            // Fallback warning if no biometrics are enrolled/available
            Alert.alert(
                'Security Warning',
                'No biometrics set up on this device. Anyone with access to your device can view this secret. Proceed?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Show Anyway',
                        style: 'destructive',
                        onPress: () => navigation.replace('ShowSecret', { type })
                    }
                ]
            );
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header
                title={`Export ${secretTitle}`}
                showBack={true}
                onBackPress={() => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        navigation.navigate('Settings' as any);
                    }
                }}
                showAddress={false}
            />

            <View style={styles.content}>
                <View style={styles.warningContainer}>
                    <Ionicons name="warning" size={64} color="#FF3B30" style={styles.warningIcon} />
                    <Text style={styles.warningTitle}>Warning!</Text>

                    <Text style={[styles.warningText, { color: currentTheme.textLight }]}>
                        <Text style={[styles.boldText, { color: currentTheme.text }]}>Never</Text> share your {secretTitle} with anyone.
                    </Text>

                    <View style={[styles.pointsContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                        <View style={styles.pointRow}>
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                            <Text style={[styles.pointText, { color: currentTheme.text }]}>Zero Wallet support will <Text style={styles.boldText}>never</Text> ask for this.</Text>
                        </View>
                        <View style={styles.pointRow}>
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                            <Text style={[styles.pointText, { color: currentTheme.text }]}>Anyone with your {secretTitle} has full control of your funds.</Text>
                        </View>
                        <View style={styles.pointRow}>
                            <Ionicons name="close-circle" size={20} color="#FF3B30" />
                            <Text style={[styles.pointText, { color: currentTheme.text }]}>Do not enter this on unknown websites or forms.</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    {currentTheme.id === 'white' ? (
                        <TouchableOpacity style={[styles.proceedBtn, { backgroundColor: currentTheme.text }]} onPress={handleProceed}>
                            <Ionicons name="finger-print" size={20} color={currentTheme.primary} style={styles.fingerprintIcon} />
                            <Text style={[styles.proceedText, { color: currentTheme.primary }]}>Proceed with Biometrics</Text>
                        </TouchableOpacity>
                    ) : (
                        <LinearGradient
                            colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={[styles.proceedBtn, { paddingVertical: 0, overflow: 'hidden' }]}
                        >
                            <TouchableOpacity style={{ width: '100%', paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={handleProceed}>
                                <Ionicons name="finger-print" size={20} color={currentTheme.primary} style={styles.fingerprintIcon} />
                                <Text style={[styles.proceedText, { color: currentTheme.primary }]}>Proceed with Biometrics</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 40,
        justifyContent: 'space-between',
    },
    warningContainer: {
        alignItems: 'center',
    },
    warningIcon: {
        marginBottom: 16,
    },
    warningTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF3B30',
        marginBottom: 16,
    },
    warningText: {
        fontSize: 16,
        color: colors.black,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    boldText: {
        fontWeight: 'bold',
    },
    pointsContainer: {
        width: '100%',
        backgroundColor: '#FFF5F5',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFEBEB',
    },
    pointRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    pointText: {
        flex: 1,
        fontSize: 14,
        color: colors.black,
        lineHeight: 20,
        marginLeft: 12,
    },
    footer: {
        width: '100%',
    },
    proceedBtn: {
        flexDirection: 'row',
        backgroundColor: colors.black,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    fingerprintIcon: {
        marginRight: 10,
    },
    proceedText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default SecurityWarningScreen;
