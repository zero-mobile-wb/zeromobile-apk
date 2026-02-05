import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ZeroAlphaService, ZeroUser } from '../services/zeroAlphaService';
import { useWallet } from '../context/WalletContext';

const ZeroAlphaProfileScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { wallet } = useWallet();
    const [user, setUser] = useState<ZeroUser | null>(null);
    const [leaderboard, setLeaderboard] = useState<ZeroUser[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        const storedUser = await ZeroAlphaService.getStoredUser();
        if (storedUser) {
            const updatedUser = await ZeroAlphaService.getUserStats(storedUser.email);
            if (updatedUser) {
                setUser(updatedUser);
                const tierInfo = getVolumeTierForUser(updatedUser.tradingVolume);
                const lb = await ZeroAlphaService.getLeaderboard(tierInfo.tier.toLowerCase());
                setLeaderboard(lb);
            } else {
                setUser(storedUser);
            }
        }
    };

    const getVolumeTierForUser = (volume: number) => {
        if (volume < 100000) return { tier: 'Bronze', range: '$0 - $100k', dailyPoints: 5 };
        if (volume < 500000) return { tier: 'Silver', range: '$100k - $500k', dailyPoints: 10 };
        return { tier: 'Gold', range: '$500k+', dailyPoints: 20 };
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const getVolumeTier = () => {
        if (!user) return { tier: 'N/A', range: '$0', dailyPoints: 0 };
        const vol = user.tradingVolume;
        if (vol < 100000) return { tier: 'Bronze', range: '$0 - $100k', dailyPoints: 5 };
        if (vol < 500000) return { tier: 'Silver', range: '$100k - $500k', dailyPoints: 10 };
        return { tier: 'Gold', range: '$500k+', dailyPoints: 20 };
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.black} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />
                }
            >
                {/* Hero Stats */}
                <View style={styles.heroSection}>
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{getVolumeTier().tier.toUpperCase()} TIER</Text>
                    </View>
                    <Text style={styles.pointsValue}>{user.points}</Text>
                    <Text style={styles.pointsLabel}>Total Points</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Trading Volume</Text>
                        <Text style={styles.statValue}>${user.tradingVolume.toLocaleString()}</Text>
                        <Text style={styles.tierRange}>{getVolumeTier().range}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Linked Wallet</Text>
                        <Text style={styles.statValue} numberOfLines={1} ellipsizeMode="middle">
                            {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
                        </Text>
                    </View>
                </View>

                {/* Fairscale Perks Card */}
                <View style={styles.perksCard}>
                    <View style={styles.perksHeader}>
                        <View style={styles.perksIconTitle}>
                            <MaterialCommunityIcons name="shield-star" size={24} color={colors.white} />
                            <Text style={styles.perksTitle}>Active Perks</Text>
                        </View>
                        <View style={styles.perksBadge}>
                            <Text style={styles.perksBadgeText}>{user.reputationTier || 'RP1'}</Text>
                        </View>
                    </View>

                    <View style={styles.perksContent}>
                        <View style={styles.perkItem}>
                            <Text style={styles.perkLabel}>FairScore</Text>
                            <Text style={styles.perkValue}>{user.fairScore || 0}/1000</Text>
                        </View>
                        <View style={styles.perkDivider} />
                        <View style={styles.perkItem}>
                            <Text style={styles.perkLabel}>Daily Multiplier</Text>
                            <Text style={styles.perkValue}>{user.multiplier || 1}x</Text>
                        </View>
                    </View>
                </View>

                {/* Leaderboard */}
                <View style={[styles.card, { marginTop: 16 }]}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
                        <Text style={styles.cardTitle}>{getVolumeTier().tier} Leaderboard</Text>
                    </View>
                    <Text style={styles.cardDesc}>Top traders in your tier.</Text>
                    {leaderboard.length > 0 ? (
                        <View style={styles.leaderboardList}>
                            {leaderboard.slice(0, 10).map((player) => (
                                <View key={player._id} style={styles.leaderboardItem}>
                                    <View style={styles.leaderboardRank}>
                                        <Text style={styles.rankNumber}>#{player.rank}</Text>
                                    </View>
                                    <View style={styles.leaderboardInfo}>
                                        <Text style={styles.leaderboardEmail} numberOfLines={1}>
                                            {player.email.split('@')[0]}
                                        </Text>
                                        <Text style={styles.leaderboardVolume}>
                                            ${player.tradingVolume.toLocaleString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.leaderboardPoints}>{player.points} pts</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No traders in this tier yet</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
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
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.black,
    },
    scrollContent: {
        padding: 20,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    rankBadge: {
        backgroundColor: '#F0F0F0',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 12,
    },
    rankText: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    pointsValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 4,
    },
    pointsLabel: {
        fontSize: 16,
        color: '#888',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.black,
    },
    tierRange: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
    },
    perksCard: {
        backgroundColor: colors.black,
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
    },
    perksHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    perksIconTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    perksTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.white,
    },
    perksBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    perksBadgeText: {
        color: colors.white,
        fontWeight: 'bold',
        fontSize: 12,
    },
    perksContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    perkItem: {
        flex: 1,
        alignItems: 'center',
    },
    perkLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginBottom: 4,
    },
    perkValue: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    perkDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 16,
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
    leaderboardList: {
        gap: 8,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: 12,
        gap: 12,
    },
    leaderboardRank: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.black,
    },
    leaderboardInfo: {
        flex: 1,
    },
    leaderboardEmail: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 2,
    },
    leaderboardVolume: {
        fontSize: 12,
        color: '#888',
    },
    leaderboardPoints: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.black,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyStateText: {
        color: '#888',
    },
});

export default ZeroAlphaProfileScreen;
