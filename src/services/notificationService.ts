import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
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

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
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
        title: '💰 Incoming Transaction',
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
    const emoji = type === 'sent' ? '📤' : '📥';
    const action = type === 'sent' ? 'sent' : 'received';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} Transaction Confirmed`,
        body: `Successfully ${action} ${amount.toFixed(4)} ${token}`,
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❌ Transaction Failed',
        body: `Failed to send ${amount.toFixed(4)} ${token}`,
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
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}
