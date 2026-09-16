import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';

interface SpendScreenProps {
    children: React.ReactNode;
    scroll?: boolean;
}

const SpendScreen: React.FC<SpendScreenProps> = ({ children, scroll = true }) => {
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';

    const content = (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <SafeAreaView style={styles.flex}>
                <StatusBar style={isDark ? "light" : "dark"} />
                {scroll ? (
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                ) : (
                    <View style={styles.flex}>{children}</View>
                )}
            </SafeAreaView>
        </KeyboardAvoidingView>
    );

    return (
        <View style={[styles.flex, { backgroundColor: currentTheme.primary }]}>
            <View style={styles.topGradient} pointerEvents="none">
                <LinearGradient
                    colors={[currentTheme.gradientStart, 'transparent']}
                    style={{ flex: 1 }}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>
            {content}
        </View>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
});

export default SpendScreen;