import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { spendApi } from '../zerospend/services/api';

// Remote (and expo-notifications-backed) functionality is only available in a
// built app (dev client / EAS / store build). Since SDK 53, merely IMPORTING
// expo-notifications inside Expo Go triggers a runtime warning, because the
// library runs a module-level auto-registration side effect
// (DevicePushTokenAutoRegistration.fx -> addPushTokenListener).
// So the library is lazy-loaded here and never touched in Expo Go — every
// exported helper below is a silent no-op there.

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null = null;
let handlerConfigured = false;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Constants.appOwnership === 'expo') return null;
  try {
    if (!cachedModule) {
      cachedModule = await import('expo-notifications');
    }
    if (!handlerConfigured && cachedModule) {
      handlerConfigured = true;
      cachedModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
    return cachedModule;
  } catch (error) {
    console.log('Notifications unavailable:', error);
    return null;
  }
}

/**
 * Request notification permissions (built app only — no-op in Expo Go)
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Configure notification channels for Android (wallet + ZeroSpend)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Wallet',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D5C54',
      });
      await Notifications.setNotificationChannelAsync('zerospend', {
        name: 'ZeroSpend',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1F5F5C',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Show local notification for incoming transaction
 */
export async function notifyIncomingTransaction(
  amount: number,
  token: string,
  signature: string,
  usdValue?: number,
  fromAddress?: string
): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    // Build notification body with more details
    let body = `You received ${amount.toFixed(4)} ${token}`;

    if (usdValue && usdValue > 0) {
      body += ` ($${usdValue.toFixed(2)})`;
    }

    if (fromAddress) {
      const shortAddress = `${fromAddress.slice(0, 4)}...${fromAddress.slice(-4)}`;
      body += `\nFrom: ${shortAddress}`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Money received',
        body,
        data: {
          signature,
          type: 'incoming',
          amount,
          token,
          fromAddress,
          usdValue
        },
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error showing incoming transaction notification:', error);
  }
}

/**
 * Show local notification for transaction confirmation
 */
export async function notifyTransactionConfirmed(
  amount: number,
  token: string,
  type: 'sent' | 'received'
): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    const action = type === 'sent' ? 'Sent' : 'Received';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Transfer confirmed',
        body: `${action} ${amount.toFixed(4)} ${token}`,
        data: { type },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing transaction confirmation notification:', error);
  }
}

/**
 * Show notification for transaction failure
 */
export async function notifyTransactionFailed(
  amount: number,
  token: string,
  error: string
): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Transfer failed',
        body: `Could not send ${amount.toFixed(4)} ${token}. Tap to review.`,
        data: { error, type: 'failed' },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing transaction failure notification:', error);
  }
}

/**
 * Show general wallet notification
 */
export async function showNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Get this device's Expo push token.
 * Null in Expo Go (Expo Go cannot receive remote push tokens since SDK 53),
 * on simulators, or without an EAS projectId. Only resolves in a built app.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (Constants.appOwnership === 'expo') {
      console.log('Push: Expo Go does not support remote push, skipping token');
      return null;
    }
    const Notifications = await loadNotifications();
    if (!Notifications) return null;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    if (!projectId) {
      console.log('Push: no EAS projectId configured, skipping token');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch (error) {
    console.log('Push: Expo token unavailable (simulator or offline)');
    return null;
  }
}

/**
 * Register this device for ZeroSpend server push (fire-and-forget safe)
 */
export async function registerPushToken(spendToken: string): Promise<void> {
  try {
    const pushToken = await getExpoPushToken();
    if (!pushToken) return;
    await spendApi.registerPushToken(spendToken, pushToken);
  } catch (error) {
    console.log('Push: registration skipped');
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}
