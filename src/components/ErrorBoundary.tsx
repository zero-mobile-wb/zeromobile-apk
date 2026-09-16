import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error boundary that catches React errors (including the dreaded
 * "Cannot read property useContext of null" from incompatible third-party hooks)
 * and renders a friendly fallback instead of crashing the entire app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Strip noisy stack traces for known third-party compat issues
    const message = error?.message || '';
    const isContextError =
      message.includes('useContext') ||
      message.includes('Cannot read property') ||
      message.includes('null');

    console.error('[ErrorBoundary]', {
      isContextError,
      message,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      componentStack: errorInfo?.componentStack?.split('\n').slice(0, 5).join('\n'),
    });

    this.setState({ errorInfo: errorInfo?.componentStack || null });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const message = this.state.error.message || 'Unknown error';
      const isContextError =
        message.includes('useContext') ||
        message.includes('Cannot read property') ||
        message.includes('null');

      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              {isContextError
                ? 'A component failed to initialize (likely a third-party library compatibility issue).'
                : 'The app encountered an unexpected error.'}
            </Text>
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>Error</Text>
              <Text style={styles.errorText} numberOfLines={6}>
                {message}
              </Text>
            </View>
            {this.state.errorInfo ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>Component</Text>
                <Text style={styles.errorText} numberOfLines={6}>
                  {this.state.errorInfo}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, alignItems: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  errorBox: {
    backgroundColor: '#171717',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  errorLabel: { color: '#f87171', fontSize: 11, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  errorText: { color: '#d4d4d4', fontSize: 12, fontFamily: 'Courier' },
  button: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ErrorBoundary;
