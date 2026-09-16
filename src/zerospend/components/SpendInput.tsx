import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spendTheme } from '../constants/spendTheme';
import { useTheme } from '../../context/ThemeContext';

interface SpendInputProps extends TextInputProps {
    label?: string;
    error?: string | null;
}

const SpendInput: React.FC<SpendInputProps> = ({ label, error, style, secureTextEntry, ...rest }) => {
    const [visible, setVisible] = useState(false);
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';

    return (
        <View style={styles.wrap}>
            {label ? <Text style={[styles.label, { color: currentTheme.text }]}>{label}</Text> : null}
            <View style={styles.inputRow}>
                <TextInput
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={secureTextEntry && !visible}
                    style={[
                        styles.input,
                        {
                            backgroundColor: isDark ? '#1E1E1E' : 'rgba(255,255,255,0.92)',
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)',
                            color: currentTheme.text,
                        },
                        secureTextEntry && styles.inputWithIcon,
                        style,
                    ]}
                    {...rest}
                />
                {secureTextEntry && (
                    <TouchableOpacity
                        style={styles.eye}
                        onPress={() => setVisible(v => !v)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={visible ? 'eye-off-outline' : 'eye-outline'}
                            size={22}
                            color="#6B7280"
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: {
        fontFamily: spendTheme.font,
        fontSize: 13,
        color: 'rgba(31,41,55,0.75)',
        marginBottom: 6,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 15,
        fontSize: 16,
        color: spendTheme.text,
        fontFamily: spendTheme.font,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    inputWithIcon: { paddingRight: 48 },
    eye: {
        position: 'absolute',
        right: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    error: {
        fontFamily: spendTheme.font,
        fontSize: 12,
        color: spendTheme.danger,
        marginTop: 6,
    },
});

export default SpendInput;