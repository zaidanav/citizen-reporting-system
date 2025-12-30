import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook untuk subscribe ke real-time notifications dari server (Dashboard)
 * Menggunakan Server-Sent Events (SSE)
 */
export const useNotificationSubscriptionDashboard = (onNotification) => {
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const connect = useCallback(() => {
    const NOTIFICATION_SERVICE_URL = import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:8084';
    const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
    const userID = adminUser.id;
    const department = adminUser.department || 'general';

    if (!userID) {
      console.log('[DashboardNotification] No user, skipping subscription');
      return;
    }

    console.log('[DashboardNotification] Connecting to:', `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${userID}&access_role=admin&department=${encodeURIComponent(department)}`);

    const eventSource = new EventSource(
      `${NOTIFICATION_SERVICE_URL}/notifications/subscribe?user_id=${userID}&access_role=admin&department=${encodeURIComponent(department)}`
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

        if (onNotificationRef.current) {
          onNotificationRef.current(data);
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
  }, []);

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
