import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { themes, ThemeId } from '../constants/colors';
import { RootStackParamList } from '../types/navigation';

interface ThemeSelectionScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ThemeSelection'>;
}

const ThemeSelectionScreen: React.FC<ThemeSelectionScreenProps> = ({ navigation }) => {
  const { themeId, setTheme, currentTheme } = useTheme();

  const handleThemeSelect = (selectedThemeId: ThemeId) => {
    setTheme(selectedThemeId);
    // Navigate back after a short delay to show the selection
    setTimeout(() => {
      navigation.goBack();
    }, 300);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="THEME"
        showBack={true}
        onBackPress={() => navigation.goBack()}
        showAddress={false}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: currentTheme.secondary }]}>
          Choose Your Theme
        </Text>
        <Text style={[styles.sectionSubtitle, { color: currentTheme.textLight }]}>
          Select a color scheme that matches your style
        </Text>

        <View style={styles.themesGrid}>
          {(Object.keys(themes) as ThemeId[]).map((id) => {
            const theme = themes[id];
            const isSelected = id === themeId;

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.themeCard,
                  { borderColor: currentTheme.secondary },
                  isSelected && { 
                    borderWidth: 3, 
                    borderColor: currentTheme.accent,
                  },
                ]}
                onPress={() => handleThemeSelect(id)}
                activeOpacity={0.7}
              >
                {/* Color Preview */}
                <View style={styles.colorPreview}>
                  <View
                    style={[
                      styles.colorBlock,
                      styles.colorBlockLarge,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                  <View style={styles.colorRow}>
                    <View
                      style={[
                        styles.colorBlock,
                        styles.colorBlockSmall,
                        { backgroundColor: theme.secondary },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorBlock,
                        styles.colorBlockSmall,
                        { backgroundColor: theme.accent },
                      ]}
                    />
                  </View>
                </View>

                {/* Theme Name */}
                <View style={styles.themeInfo}>
                  <Text style={[styles.themeName, { color: currentTheme.secondary }]}>
                    {theme.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={currentTheme.accent} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={currentTheme.secondary} />
          <Text style={[styles.infoText, { color: currentTheme.textLight }]}>
            You can add more themes by editing the colors.ts file
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  themesGrid: {
    gap: 16,
  },
  themeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  colorPreview: {
    marginBottom: 12,
    gap: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorBlock: {
    borderRadius: 8,
  },
  colorBlockLarge: {
    height: 80,
    width: '100%',
  },
  colorBlockSmall: {
    height: 40,
    flex: 1,
  },
  themeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeName: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ThemeSelectionScreen;
