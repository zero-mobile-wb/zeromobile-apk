import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacityProps,
} from 'react-native';
import { spendTheme } from '../constants/spendTheme';

interface SpendButtonProps extends TouchableOpacityProps {
    title: string;
    loading?: boolean;
    variant?: 'primary' | 'ghost';
}

const SpendButton: React.FC<SpendButtonProps> = ({ title, loading, variant = 'primary', disabled, style, ...rest }) => {
    const isGhost = variant === 'ghost';
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            disabled={disabled || loading}
            style={[
                styles.button,
                isGhost ? styles.ghost : styles.primary,
                (disabled || loading) && styles.disabled,
                style,
            ]}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator color={isGhost ? spendTheme.text : '#FFFFFF'} />
            ) : (
                <Text style={[styles.title, { color: isGhost ? spendTheme.text : '#FFFFFF' }]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    primary: {
        backgroundColor: 'rgba(31,41,55,0.92)',
    },
    ghost: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
    },
    disabled: { opacity: 0.6 },
    title: {
        fontFamily: spendTheme.font,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SpendButton;