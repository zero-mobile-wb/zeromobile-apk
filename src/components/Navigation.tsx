import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import LiquidGlassButton from './LiquidGlassButton';

interface NavigationProps {
  activeTab: string;
  onTabPress: (tabId: string) => void;
}

const LiquidNavItem: React.FC<{
  isActive: boolean;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ isActive, onPress, children }) => {
  return (
    <TouchableOpacity
      style={[styles.navItem, isActive && styles.navItemActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
};

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabPress }) => {
  const { currentTheme, themeId } = useTheme();
  const isLightTheme = themeId === 'white';
  const isDark = themeId === 'dark';
  const activeColor = isLightTheme ? currentTheme.text : currentTheme.gradientStart;
  const inactiveColor = isLightTheme ? currentTheme.textLight : currentTheme.text;

  const tabs = [
    { id: 'wallet', label: 'Wallet', icon: 'wallet', library: 'Ionicons' },
    { id: 'swap', label: 'Swap', imageSource: require('../../assets/up-down.png') },
    { id: 'activity', label: 'Activity', icon: 'history', library: 'MaterialCommunityIcons' },
    { id: 'settings', label: 'Settings', icon: 'cog', library: 'MaterialCommunityIcons' },
    { id: 'bank', label: 'Bank', icon: 'bank', library: 'MaterialCommunityIcons' },
  ];

  const mainTabs = tabs.slice(0, 4);
  const bankTab = tabs[4];

  const navShadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 6,
    },
    android: { elevation: 4 },
  });

  return (
    <View style={styles.safeArea}>
      <View style={styles.row}>
        {/* Liquid Glass Nav Container */}
        <View style={[styles.navContainer, navShadow]}>
          {/* Outer puffy border */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 28,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.55)',
              },
              isDark
                ? {
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                  }
                : {
                    borderTopWidth: 1,
                    borderLeftWidth: 1,
                    borderTopColor: 'rgba(255, 255, 255, 0.9)',
                    borderLeftColor: 'rgba(255, 255, 255, 0.7)',
                    borderBottomWidth: 1,
                    borderRightWidth: 1,
                    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
                    borderRightColor: 'rgba(0, 0, 0, 0.1)',
                  },
            ]}
          />

          {/* Inner depth layer */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 28,
                margin: 2,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.25)',
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderTopColor: isDark
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(255, 255, 255, 0.5)',
                borderLeftColor: isDark
                  ? 'rgba(255, 255, 255, 0.15)'
                  : 'rgba(255, 255, 255, 0.4)',
              },
            ]}
          />

          {/* Top highlight */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: '8%',
              right: '8%',
              height: '38%',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(255, 255, 255, 0.35)',
            }}
          />

          {/* Tab items row */}
          <View style={styles.tabsRow}>
            {mainTabs.map((tab) => (
              <LiquidNavItem
                key={tab.id}
                isActive={activeTab === tab.id}
                onPress={() => onTabPress(tab.id)}
              >
                {tab.imageSource ? (
                  <Image
                    source={tab.imageSource}
                    style={[
                      styles.navIconImage,
                      { tintColor: activeTab === tab.id ? activeColor : inactiveColor }
                    ]}
                  />
                ) : tab.library === 'Ionicons' ? (
                  <Ionicons
                    name={tab.icon as any}
                    size={24}
                    color={activeTab === tab.id ? activeColor : inactiveColor}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={tab.icon as any}
                    size={24}
                    color={activeTab === tab.id ? activeColor : inactiveColor}
                  />
                )}
              </LiquidNavItem>
            ))}
          </View>
        </View>

        {/* Liquid Glass Bank Button - same as Send/Receive */}
        <LiquidGlassButton
          size={48}
          isCircle={true}
          onPress={() => onTabPress(bankTab.id)}
        >
          <MaterialCommunityIcons
            name={bankTab.icon as any}
            size={24}
            color={activeTab === bankTab.id ? activeColor : inactiveColor}
          />
        </LiquidGlassButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: 16,
    paddingBottom: Platform.select({
      ios: 28,
      android: 20,
    }),
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navContainer: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingBottom: Platform.select({ ios: 4, android: 5 }),
    paddingTop: Platform.select({ ios: 4, android: 5 }),
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    justifyContent: 'center',
  },
  navItemActive: {},
  navIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
});

export default Navigation;
