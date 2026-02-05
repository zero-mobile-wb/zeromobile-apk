import React from 'react';
import { 
  View, 
  TouchableOpacity, 
  Text, 
  StyleSheet,
  SafeAreaView,
  Platform,
  Dimensions 
} from 'react-native';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

interface NavigationProps {
  activeTab: string;
  onTabPress: (tabId: string) => void;
}

// Get screen height to calculate bottom insets
const { height } = Dimensions.get('window');

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabPress }) => {
  const { currentTheme } = useTheme();
  
  const tabs = [
    { id: 'wallet', label: 'WALLET' },
    { id: 'activity', label: 'ACTIVITY' },
    { id: 'settings', label: 'SETTINGS' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.navContainer, { 
        backgroundColor: currentTheme.primary,
        borderTopColor: currentTheme.accent,
      }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.navItem}
            onPress={() => onTabPress(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.navText,
                activeTab === tab.id && { 
                  color: currentTheme.secondary,
                  fontWeight: 'bold',
                },
              ]}
            >
              {tab.label}
            </Text>
            {activeTab === tab.id && <View style={[styles.activeIndicator, { backgroundColor: currentTheme.secondary }]} />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  navContainer: {
    flexDirection: 'row',
    // backgroundColor and borderTopColor applied dynamically
    borderTopWidth: 1,
    paddingBottom: Platform.select({
      ios: 20, 
      android: 30, 
    }),
 
    elevation: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingTop: 12,
  },
  navText: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.gray,
    marginBottom: 6,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // backgroundColor applied dynamically
  },
});

export default Navigation;