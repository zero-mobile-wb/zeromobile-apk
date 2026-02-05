import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ZeroAlphaService, ZeroUser } from '../services/zeroAlphaService';

const ZeroAlphaScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [user, setUser] = useState<ZeroUser | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);

    const [timeUntilCheckIn, setTimeUntilCheckIn] = useState('');

    // Fairscale State
    const [modalVisible, setModalVisible] = useState(false);
    const [fairData, setFairData] = useState<{ score: number; tier: string; multiplier: number } | null>(null);
    const [loadingFair, setLoadingFair] = useState(false);

    const loadData = async () => {
        const storedUser = await ZeroAlphaService.getStoredUser();
        if (storedUser) {
            const updatedUser = await ZeroAlphaService.getUserStats(storedUser.email);
            if (updatedUser) {
                setUser(updatedUser);
            } else {
                setUser(storedUser);
            }
        } else {
            navigation.replace('ZeroAlphaLogin');
        }
    };

    useEffect(() => {
        loadData();

        const interval = setInterval(() => {
            updateCountdowns();
        }, 1000);

        return () => clearInterval(interval);
    }, []); // Only run once on mount

    const updateCountdowns = () => {
        const now = new Date();
        const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

        // Next check-in (next UTC day)
        const tomorrow = new Date(utcNow);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        const checkInDiff = tomorrow.getTime() - utcNow.getTime();
        const checkInHours = Math.floor(checkInDiff / (1000 * 60 * 60));
        const checkInMinutes = Math.floor((checkInDiff % (1000 * 60 * 60)) / (1000 * 60));
        const checkInSeconds = Math.floor((checkInDiff % (1000 * 60)) / 1000);
        setTimeUntilCheckIn(`${checkInHours}h ${checkInMinutes}m ${checkInSeconds}s`);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleCheckIn = async () => {
        if (!user) return;
        setCheckingIn(true);
        const result = await ZeroAlphaService.checkIn(user.email);
        setCheckingIn(false);

        if (result.success) {
            Alert.alert('Success', result.message || 'Points awarded!');
            loadData(); // Refresh points
        } else {
            if (result.error === 'User not found' || (typeof result.error === 'string' && result.error.includes('User not found'))) {
                Alert.alert(
                    'Account Error',
                    'Your account was not found. Please log in again.',
                    [
                        {
                            text: 'OK',
                            onPress: async () => {
                                await ZeroAlphaService.logout();
                                navigation.replace('ZeroAlphaLogin');
                            }
                        }
                    ]
                );
                return;
            }
            Alert.alert('Check-in Failed', result.error || 'Please try again');
        }
    };

    const handleCheckFairScore = async () => {
        if (!user) return;
        setLoadingFair(true);
        const result = await ZeroAlphaService.getFairScorePreview(user.walletAddress);
        setLoadingFair(false);

        if (result.success) {
            setFairData(result);
            setModalVisible(true);
        } else {
            Alert.alert('Error', result.error || 'Failed to fetch FairScore');
        }
    };

    const handleClaimWithMultiplier = async () => {
        setModalVisible(false);
        if (user) {
            // Sync first to ensure profile is updated even if check-in fails
            await ZeroAlphaService.syncFairData(user.email);
            // Refresh local user data to show new stats immediately
            loadData();
        }
        handleCheckIn();
    };

    if (!user) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.black} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Zero Alpha</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ZeroAlphaProfile')} style={styles.profileButton}>
                    <Ionicons name="person-circle-outline" size={32} color={colors.black} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />
                }
            >
                {/* Hero / Greeting (Optional, but looks nice to have something) */}
                <View style={styles.greetingSection}>
                    <Text style={styles.greetingText}>Welcome back,</Text>
                    <Text style={styles.emailText}>{user.email.split('@')[0]}</Text>
                </View>

                {/* Check-in Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="calendar-check" size={24} color={colors.black} />
                        <Text style={styles.cardTitle}>Daily Check-in</Text>
                    </View>
                    <Text style={styles.cardDesc}>Earn +5 points every day by checking in.</Text>
                    <Text style={styles.countdownText}>Next check-in: {timeUntilCheckIn}</Text>
                    <TouchableOpacity
                        style={[styles.checkInButton, checkingIn && { opacity: 0.7 }]}
                        onPress={handleCheckIn}
                        disabled={checkingIn}
                    >
                        {checkingIn ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.checkInButtonText}>Claim Points</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Fairscale Reputation Card */}
                <View style={styles.slimCard}>
                    <View style={styles.cardHeaderRow}>
                        <View style={styles.cardIconContainer}>
                            <MaterialCommunityIcons name="shield-star-outline" size={24} color={colors.black} />
                            <Text style={styles.slimCardTitle}>Fairscale Reputation</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.checkButton}
                            onPress={handleCheckFairScore}
                            disabled={loadingFair}
                        >
                            {loadingFair ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.checkButtonText}>Check</Text>}
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.slimCardDesc}>Check your FairScore to boost your daily rewards.</Text>
                </View>

            </ScrollView>

            {/* Fairscale Result Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Reputation Score</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.gray} />
                            </TouchableOpacity>
                        </View>

                        {fairData && (
                            <View style={styles.scoreContainer}>
                                <View style={styles.scoreCircle}>
                                    <Text style={styles.scoreValue}>{fairData.score}</Text>
                                    <Text style={styles.scoreTotal}>/1000</Text>
                                </View>

                                <View style={styles.tierBadge}>
                                    <Text style={styles.tierText}>{fairData.tier}</Text>
                                </View>

                                <Text style={styles.multiplierText}>
                                    {fairData.multiplier}x Point Multiplier Active!
                                </Text>

                                <TouchableOpacity
                                    style={styles.claimButton}
                                    onPress={handleClaimWithMultiplier}
                                >
                                    <Text style={styles.claimButtonText}>Claim Daily Rewards</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>


        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    profileButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.black,
    },
    scrollContent: {
        padding: 20,
    },
    greetingSection: {
        marginBottom: 24,
    },
    greetingText: {
        fontSize: 16,
        color: '#666',
    },
    emailText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.black,
    },
    card: {
        backgroundColor: '#F8F9FA',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.black,
    },
    cardDesc: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        lineHeight: 20,
    },
    checkInButton: {
        backgroundColor: colors.black,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    checkInButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    countdownText: {
        fontSize: 13,
        color: '#888',
        marginBottom: 12,
        fontWeight: '600',
    },
    slimCard: {
        backgroundColor: '#F8F9FA',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    slimCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
    },
    slimCardDesc: {
        fontSize: 13,
        color: '#666',
        maxWidth: '80%',
    },
    checkButton: {
        backgroundColor: colors.black,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    checkButtonText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 12,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.black,
    },
    scoreContainer: {
        alignItems: 'center',
    },
    scoreCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 8,
        borderColor: colors.black,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.black,
    },
    scoreTotal: {
        fontSize: 16,
        color: '#666',
    },
    tierBadge: {
        backgroundColor: '#F0F0F0',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    tierText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
    },
    multiplierText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4CAF50',
        marginBottom: 32,
    },
    claimButton: {
        backgroundColor: colors.black,
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    claimButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default ZeroAlphaScreen;
