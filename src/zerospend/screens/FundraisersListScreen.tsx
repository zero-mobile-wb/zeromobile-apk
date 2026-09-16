import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import SpendScreen from '../components/SpendScreen';
import SpendHeader from '../components/SpendHeader';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';
import { spendApi } from '../services/api';
import { SpendEvent } from '../types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Props {
    navigation: NativeStackNavigationProp<RootStackParamList, 'SpendFundraisers'>;
    route: RouteProp<RootStackParamList, 'SpendFundraisers'>;
}

const FundraisersListScreen: React.FC<Props> = ({ navigation, route }) => {
    const { themeId } = useTheme();
    const isDark = themeId === 'dark';
    const kind = route.params?.kind;
    const [items, setItems] = useState<SpendEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const headerTitle = kind === 'regular' ? 'Events' : kind === 'fundraiser' ? 'Fundraisers' : 'Events';

    const ink = isDark ? '#FFFFFF' : spendTheme.text;
    const sub = isDark ? 'rgba(255,255,255,0.65)' : spendTheme.textLight;
    const cardBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';

    const load = useCallback(async () => {
        try {
            const res = await spendApi.listEvents(kind);
            setItems(res.events || []);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Could not load events');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [kind]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            load();
        }, [load])
    );

    return (
        <SpendScreen scroll={false}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={spendTheme.accent} />
                </View>
            ) : error ? (
                <>
                    <View style={styles.headerWrap}>
                        <SpendHeader title={headerTitle} onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} style={styles.header} />
                    </View>
                    <View style={styles.center}>
                        <Text style={[styles.errorText, { color: sub }]}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={spendTheme.accent} />}
                    showsVerticalScrollIndicator={false}
                >
                    <SpendHeader title={headerTitle} onBack={() => navigation.goBack()} titleFont={spendTheme.font} titleSize={20} style={styles.header} />
                    {items.length === 0 ? (
                        <View style={styles.emptyWrap}>
                            <MaterialCommunityIcons name="hand-heart-outline" size={40} color={sub} />
                            <Text style={[styles.emptyTitle, { color: ink }]}>No active events</Text>
                            <Text style={[styles.emptySub, { color: sub }]}>Check back soon or ask the organizer for a link.</Text>
                        </View>
                    ) : (
                        items.map(f => {
                            const pct = f.goalNGN > 0 ? Math.min(100, (f.raisedNGN / f.goalNGN) * 100) : 0;
                            const open = () => f.kind === 'fundraiser'
                                ? navigation.navigate('SpendFundraiser', { slug: f.slug })
                                : navigation.navigate('Browser', { initialUrl: f.link });
                            return (
                                <TouchableOpacity
                                    key={f.slug}
                                    style={[styles.card, { backgroundColor: cardBg }]}
                                    onPress={open}
                                    activeOpacity={0.85}
                                >
                                    {!!f.imageUrl && (
                                        <Image source={{ uri: f.imageUrl }} style={styles.thumb} resizeMode="cover" />
                                    )}
                                    <View style={styles.titleRow}>
                                        <Text style={[styles.title, { color: ink }]} numberOfLines={2}>{f.title}</Text>
                                        <View style={[styles.kindPill, { backgroundColor: f.kind === 'fundraiser' ? 'rgba(245,158,11,0.14)' : 'rgba(95,150,156,0.14)' }]}>
                                            <Text style={[styles.kindText, { color: f.kind === 'fundraiser' ? '#F59E0B' : spendTheme.accent }]}>
                                                {f.kind === 'fundraiser' ? 'Fundraiser' : 'Event'}
                                            </Text>
                                        </View>
                                    </View>
                                    {f.kind === 'fundraiser' ? (
                                        <>
                                            <View style={styles.progressTrack}>
                                                <View style={[styles.progressFill, { width: `${pct}%` }]} />
                                            </View>
                                            <Text style={[styles.progressText, { color: ink }]}>
                                                ₦{Number(f.raisedNGN).toLocaleString()} of ₦{Number(f.goalNGN).toLocaleString()}
                                            </Text>
                                            <Text style={[styles.meta, { color: sub }]}>{f.donorCount} donor{f.donorCount === 1 ? '' : 's'}</Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.meta, { color: sub }]} numberOfLines={2}>{f.description || 'Tap to open'}</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            )}
        </SpendScreen>
    );
};

const styles = StyleSheet.create({
    headerWrap: { paddingHorizontal: 24 },
    header: { marginTop: 8, marginBottom: 20 },
    content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    errorText: { fontFamily: spendTheme.font, fontSize: 14, textAlign: 'center' },
    retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
    retryText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontFamily: spendTheme.font, fontSize: 16, fontWeight: '700', marginTop: 14 },
    emptySub: { fontFamily: spendTheme.font, fontSize: 13, marginTop: 6, textAlign: 'center' },
    card: { borderRadius: 22, padding: 20, marginBottom: 12 },
    thumb: { height: 140, borderRadius: 14, marginBottom: 12, backgroundColor: 'rgba(128,128,128,0.2)' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    title: { fontFamily: spendTheme.font, fontSize: 17, fontWeight: '700', flex: 1 },
    kindPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    kindText: { fontFamily: spendTheme.font, fontSize: 11, fontWeight: '700' },
    progressTrack: { height: 10, borderRadius: 6, backgroundColor: 'rgba(128,128,128,0.25)', marginTop: 14, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#22C55E' },
    progressText: { fontFamily: spendTheme.font, fontSize: 14, fontWeight: '700', marginTop: 8 },
    meta: { fontFamily: spendTheme.font, fontSize: 12, marginTop: 2 },
});

export default FundraisersListScreen;
