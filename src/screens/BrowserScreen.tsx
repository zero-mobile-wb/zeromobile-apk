import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';

interface BrowserScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Browser'>;
}

const BrowserScreen: React.FC<BrowserScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const [currentUrl, setCurrentUrl] = useState('https://www.google.com/');
  const [inputUrl, setInputUrl] = useState('https://www.google.com/');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setInputUrl(navState.url);
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setLoading(navState.loading);
  };

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (canGoForward && webViewRef.current) {
      webViewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleSubmitUrl = () => {
    let url = inputUrl.trim();

    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setCurrentUrl(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Browser"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Address Bar */}
      <View style={styles.addressBar}>
        <View style={styles.urlInputContainer}>
          <Ionicons name="lock-closed" size={16} color={colors.success} style={styles.lockIcon} />
          <TextInput
            style={styles.urlInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleSubmitUrl}
            placeholder="Enter URL..."
            placeholderTextColor={colors.gray}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
          />
          {loading && (
            <ActivityIndicator size="small" color={colors.black} style={styles.loadingIcon} />
          )}
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.black} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsBackForwardNavigationGestures={true}
      />

      {/* Navigation Controls */}
      <View style={styles.navControls}>
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={handleGoBack}
          disabled={!canGoBack}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={canGoBack ? colors.black : colors.gray}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={handleGoForward}
          disabled={!canGoForward}
        >
          <Ionicons
            name="arrow-forward"
            size={24}
            color={canGoForward ? colors.black : colors.gray}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={handleRefresh}>
          <Ionicons name="reload" size={24} color={colors.black} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {
            setCurrentUrl('https://www.google.com/');
            setInputUrl('https://www.google.com/');
          }}
        >
          <Ionicons name="home" size={24} color={colors.black} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addressBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockIcon: {
    marginRight: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 14,
    color: colors.black,
    fontFamily: 'monospace',
  },
  loadingIcon: {
    marginLeft: 8,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.gray,
  },
  navControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  navButton: {
    padding: 12,
    borderRadius: 8,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
});

export default BrowserScreen;
