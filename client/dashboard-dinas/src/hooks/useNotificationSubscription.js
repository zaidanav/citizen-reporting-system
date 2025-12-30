import { useEffect, useCallback } from 'react';

/**
 * Hook untuk subscribe ke real-time notifications dari server (Dashboard)
 * Menggunakan Server-Sent Events (SSE)
 */
export const useNotificationSubscriptionDashboard = (onNotification) => {
  const connect = useCallback(() => {
    const NOTIFICATION_SERVICE_URL = import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:8084';
    const userID = 'admin'; // Admin user ID, bisa disesuaikan

    console.log('[DashboardNotification] Connecting to:', `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${userID}`);

    const eventSource = new EventSource(
      `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${userID}`
    );

    eventSource.onopen = () => {
      console.log('[DashboardNotification] SSE Connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip connection confirmation message
        if (data.type === 'connected') {
          console.log('[DashboardNotification] Connected to server');
          return;
        }

        console.log('[DashboardNotification] Received event:', data);

        if (onNotification) {
          onNotification(data);
        }
      } catch (error) {
        console.error('[DashboardNotification] Failed to parse event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[DashboardNotification] SSE Error:', error);
      eventSource.close();

      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('[DashboardNotification] Attempting to reconnect...');
        connect();
      }, 5000);
    };

    return eventSource;
  }, [onNotification]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      if (eventSource) {
        eventSource.close();
        console.log('[DashboardNotification] Disconnected');
      }
    };
  }, [connect]);
};

export default useNotificationSubscriptionDashboard;
