import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { RouteProp } from '@react-navigation/native';

interface BrowserScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Browser'>;
  route: RouteProp<RootStackParamList, 'Browser'>;
}

type Tab = {
  id: string;
  url: string;
};

const BrowserScreen: React.FC<BrowserScreenProps> = ({ navigation, route }) => {
  const { currentTheme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const initialUrl = route.params?.initialUrl || 'https://precontinental-uninfected-monty.ngrok-free.dev/';

  const [tabs, setTabs] = useState<Tab[]>([{ id: Date.now().toString(), url: initialUrl }]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const [inputUrl, setInputUrl] = useState(activeTab.url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync inputUrl when changing tabs
  useEffect(() => {
    setInputUrl(activeTab.url);
  }, [activeTabId]);

  const injectCallback = (newUrl: string) => {
    if (newUrl.includes('status=') && webViewRef.current) {
      console.log('Injecting callback payload into WebView natively (CustomEvent):', newUrl);
      const injectedJS = `
        (function() {
          try {
            var rawUrl = ${JSON.stringify(newUrl)};
            var queryString = rawUrl.split('?')[1] || '';
            var usp = new URLSearchParams(queryString);
            var detail = {};
            usp.forEach(function(value, key) { detail[key] = value; });
            window.dispatchEvent(new CustomEvent('zerowallet_callback', { detail: detail }));
          } catch (e) {
            console.error('Failed to inject zerowallet_callback', e);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(injectedJS);
    }
  };

  useEffect(() => {
    // Listen for events from Modals, avoiding navigation route param re-renders
    const sub = DeviceEventEmitter.addListener('zeroWalletCallback', (url: string) => {
      injectCallback(url);
    });

    // Check initial route params just in case (cold start deep link)
    if (route.params?.initialUrl) {
      injectCallback(route.params.initialUrl);
    }

    return () => sub.remove();
  }, []);

  const handleNavigationStateChange = (navState: any) => {
    if (!navState.url.includes('zerowallet://')) {
      setInputUrl(navState.url);
      setTabs(currentTabs =>
        currentTabs.map(tab => (tab.id === activeTabId ? { ...tab, url: navState.url } : tab))
      );
    }
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setLoading(navState.loading);
  };

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) webViewRef.current.goBack();
  };

  const handleGoForward = () => {
    if (canGoForward && webViewRef.current) webViewRef.current.goForward();
  };

  const handleRefresh = () => {
    if (webViewRef.current) webViewRef.current.reload();
  };

  const handleSubmitUrl = () => {
    let url = inputUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setTabs(currentTabs =>
      currentTabs.map(tab => (tab.id === activeTabId ? { ...tab, url } : tab))
    );
  };

  const createNewTab = () => {
    const newTab = { id: Date.now().toString(), url: 'https://google.com' };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (idToClose: string) => {
    if (tabs.length === 1) return; // Prevent closing last tab
    const newTabs = tabs.filter(t => t.id !== idToClose);
    setTabs(newTabs);
    if (activeTabId === idToClose) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary, paddingTop: insets.top }]}>
      {/* Top Address Bar */}
      <View style={[styles.header, { backgroundColor: currentTheme.card }]}>
        <View style={[styles.urlInputContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          {inputUrl.length === 0 && (
            <Ionicons name="search-outline" size={16} color={currentTheme.textLight} style={styles.searchIcon} />
          )}
          <TextInput
            style={[styles.urlInput, { color: currentTheme.secondary }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleSubmitUrl}
            placeholder="Search or enter website"
            placeholderTextColor={currentTheme.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
          />
          {inputUrl.length > 0 && !loading && (
            <TouchableOpacity onPress={() => {
              setInputUrl('');
              setTabs(currentTabs => currentTabs.map(tab => (tab.id === activeTabId ? { ...tab, url: '' } : tab)));
            }}>
              <Ionicons name="home-outline" size={18} color={currentTheme.secondary} style={styles.homeIconRight} />
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator size="small" color={currentTheme.secondary} style={styles.loaderSpacing} />}
        </View>
        <TouchableOpacity style={styles.closeBrowserBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close-outline" size={28} color={currentTheme.secondary} />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {activeTab.url === '' ? (
        <View style={[styles.quickAccessContainer, { backgroundColor: currentTheme.primary }]}>
          <View style={styles.quickAccessTopLeft}>
            <TouchableOpacity
              style={styles.portfolioButton}
              onPress={() => {
                const targetUrl = 'https://precontinental-uninfected-monty.ngrok-free.dev';
                setInputUrl(targetUrl);
                setTabs(currentTabs =>
                  currentTabs.map(tab => (tab.id === activeTabId ? { ...tab, url: targetUrl } : tab))
                );
              }}
            >
              <View style={[styles.portfolioIconWrapper, { backgroundColor: currentTheme.id === 'dark' ? '#333' : 'rgba(128, 128, 128, 0.15)' }]}>
                <Ionicons name="wallet" size={32} color={currentTheme.text} />
              </View>
              <Text style={[styles.portfolioText, { color: currentTheme.text }]}>Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: activeTab.url }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
              <ActivityIndicator size="large" color={currentTheme.secondary} />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsBackForwardNavigationGestures={true}
          originWhitelist={['*']}
          onMessage={(event) => {
            try {
              console.log('WebView onMessage raw:', event.nativeEvent.data);
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'deeplink' && data.url && data.url.startsWith('zerowallet://')) {
                const pathAndQuery = data.url.replace('zerowallet://', '');
                const [path, queryStr] = pathAndQuery.split('?');

                const params: any = {};
                if (queryStr) {
                  queryStr.split('&').forEach((pair: string) => {
                    const [key, value] = pair.split('=');
                    if (key) params[key] = decodeURIComponent(value || '');
                  });
                }

                console.log('Parsed deep link postMessage params:', path, params);

                if (path === 'connect') {
                  navigation.navigate('AdapterConnect', { ...params, isInternal: true });
                } else if (path === 'sign') {
                  navigation.navigate('AdapterSign', { ...params, isInternal: true });
                } else if (path === 'signAll') {
                  navigation.navigate('AdapterSignAll' as any, { ...params, isInternal: true });
                } else if (path === 'signMessage') {
                  navigation.navigate('AdapterSignMessage' as any, { ...params, isInternal: true });
                }
              }
            } catch (e) {
              console.warn('WebView onMessage error:', e);
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            // Android WebView fallback for zerowallet schemes
            if (request.url.startsWith('zerowallet://')) {
              try {
                const pathAndQuery = request.url.replace('zerowallet://', '');
                const [path, queryStr] = pathAndQuery.split('?');

                const params: any = {};
                if (queryStr) {
                  queryStr.split('&').forEach(pair => {
                    const [key, value] = pair.split('=');
                    if (key) params[key] = decodeURIComponent(value || '');
                  });
                }

                if (path === 'connect') {
                  navigation.navigate('AdapterConnect', { ...params, isInternal: true });
                } else if (path === 'sign') {
                  navigation.navigate('AdapterSign', { ...params, isInternal: true });
                } else if (path === 'signAll') {
                  navigation.navigate('AdapterSignAll' as any, { ...params, isInternal: true });
                } else if (path === 'signMessage') {
                  navigation.navigate('AdapterSignMessage' as any, { ...params, isInternal: true });
                }
              } catch (e) {
                console.warn('Error parsing:', e);
              }
              return false;
            }

            if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
              Linking.openURL(request.url).catch(() => { });
              return false;
            }
            return true;
          }}
        />
      )}


      {/* Bottom Control Bar */}
      <View style={[styles.bottomBar, { backgroundColor: currentTheme.card, borderTopColor: currentTheme.border, paddingBottom: insets.bottom || 12 }]}>
        <TouchableOpacity style={styles.bottomNavBtn} onPress={handleGoBack} disabled={!canGoBack}>
          <Ionicons name="chevron-back" size={26} color={canGoBack ? currentTheme.secondary : currentTheme.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavBtn} onPress={handleGoForward} disabled={!canGoForward}>
          <Ionicons name="chevron-forward" size={26} color={canGoForward ? currentTheme.secondary : currentTheme.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavBtn} onPress={createNewTab}>
          <Ionicons name="add" size={30} color={currentTheme.secondary} />
        </TouchableOpacity>
        <View style={styles.tabCountWrapper}>
          <TouchableOpacity style={[styles.tabCountBtn, { borderColor: currentTheme.secondary }]}>
            <Text style={[styles.tabCountText, { color: currentTheme.secondary }]}>{tabs.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  urlInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 16, // Space between search bar and close button
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  homeIconRight: {
    marginLeft: 8,
  },
  urlInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  loaderSpacing: {
    marginLeft: 8,
  },
  closeBrowserBtn: {
    padding: 4,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomNavBtn: {
    padding: 8,
  },
  tabCountWrapper: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountBtn: {
    borderWidth: 2,
    borderRadius: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickAccessContainer: {
    flex: 1,
    padding: 24,
  },
  quickAccessTopLeft: {
    alignItems: 'flex-start',
    marginTop: 10,
  },
  portfolioButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12, // Square with slight border radius
    backgroundColor: 'rgba(128, 128, 128, 0.15)', // Semi-transparent grey
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  portfolioText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BrowserScreen;
