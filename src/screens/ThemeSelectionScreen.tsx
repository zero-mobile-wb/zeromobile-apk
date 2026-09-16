import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
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
    setTimeout(() => { navigation.goBack(); }, 300);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <StatusBar barStyle={themeId === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={currentTheme.gradientStart} />
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
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Choose Your Theme</Text>
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
                  { backgroundColor: theme.card || '#FFFFFF', borderColor: currentTheme.border },
                  isSelected && { borderWidth: 2, borderColor: currentTheme.gradientStart },
                ]}
                onPress={() => handleThemeSelect(id)}
                activeOpacity={0.7}
              >
                <View style={styles.colorPreview}>
                  <View style={[styles.colorBlock, styles.colorBlockLarge, { backgroundColor: theme.primary }]} />
                  <View style={styles.colorRow}>
                    <View style={[styles.colorBlock, styles.colorBlockSmall, { backgroundColor: theme.gradientStart }]} />
                    <View style={[styles.colorBlock, styles.colorBlockSmall, { backgroundColor: theme.gradientEnd }]} />
                  </View>
                </View>

                <View style={styles.themeInfo}>
                  <Text style={[styles.themeName, { color: currentTheme.text }]}>{theme.name}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={currentTheme.gradientStart} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  sectionSubtitle: { fontSize: 16, marginBottom: 24 },
  themesGrid: { gap: 16 },
  themeCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  colorPreview: { marginBottom: 12, gap: 8 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorBlock: { borderRadius: 8 },
  colorBlockLarge: { height: 80, width: '100%' },
  colorBlockSmall: { height: 40, flex: 1 },
  themeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeName: { fontSize: 18, fontWeight: '600' },
});

export default ThemeSelectionScreen;


