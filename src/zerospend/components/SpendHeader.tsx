import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';

interface SpendHeaderProps {
    title?: string;
    subtitle?: string;
    onBack?: () => void;
    onWallet?: () => void;
    titleFont?: string;
    titleSize?: number;
    style?: StyleProp<ViewStyle>;
}

const SpendHeader: React.FC<SpendHeaderProps> = ({ title, subtitle, onBack, onWallet, titleFont, titleSize, style }) => {
    const { currentTheme } = useTheme();

    return (
        <View style={[styles.wrap, style]}>
            {onBack && (
                <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color={currentTheme.text} />
                </TouchableOpacity>
            )}
            <View>
                {title ? <Text style={[styles.title, { fontFamily: titleFont || spendTheme.font, fontSize: titleSize || 30, color: currentTheme.text }]}>{title}</Text> : null}
                {subtitle ? <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>{subtitle}</Text> : null}
            </View>
            {onWallet && (
                <TouchableOpacity style={styles.wallet} onPress={onWallet} activeOpacity={0.7}>
                    <Ionicons name="wallet-outline" size={20} color={currentTheme.text} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 32, marginTop: 36 },
    back: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wallet: {
        marginLeft: 'auto',
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { fontFamily: spendTheme.font, fontSize: 30 },
    subtitle: { fontFamily: spendTheme.font, fontSize: 13, marginTop: 2 },
});

export default SpendHeader;