import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Hook untuk subscribe ke real-time notifications dari server
 * Menggunakan Server-Sent Events (SSE)
 */
export const useNotificationSubscription = () => {
  const user = useAuthStore((state) => state.user);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const connect = useCallback(() => {
    if (!user || !user.id) {
      console.log('[Notification] No user, skipping subscription');
      return;
    }

    const NOTIFICATION_SERVICE_URL = import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:8084';

    console.log('[Notification] Connecting to:', `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${user.id}`);

    const eventSource = new EventSource(
      `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${user.id}`
    );

    eventSource.onopen = () => {
      console.log('[Notification] SSE Connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip connection confirmation message
        if (data.type === 'connected') {
          console.log('[Notification] Connected to server');
          return;
        }

        console.log('[Notification] Received event:', data);

        // Map notification type to toast type
        const toastType = data.type === 'status_update' ? 'info' : 'success';

        addNotification({
          type: toastType,
          title: data.title || 'Update Laporan',
          message: data.message || `Status berubah menjadi: ${data.status}`,
        });
      } catch (error) {
        console.error('[Notification] Failed to parse event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[Notification] SSE Error:', error);
      eventSource.close();

      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('[Notification] Attempting to reconnect...');
        connect();
      }, 5000);
    };

    return eventSource;
  }, [user, addNotification]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      if (eventSource) {
        eventSource.close();
        console.log('[Notification] Disconnected');
      }
    };
  }, [connect]);
};

export default useNotificationSubscription;
