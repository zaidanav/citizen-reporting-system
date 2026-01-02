import { useEffect, useRef } from 'react';

/**
 * Hook untuk subscribe ke real-time notifications dari server (Dashboard)
 * Menggunakan Server-Sent Events (SSE)
 */
export const useNotificationSubscriptionDashboard = (onNotification) => {
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
    const token = localStorage.getItem('admin_token');

    if (!adminUser.id || !token) {
      console.log('[DashboardNotification] Missing user ID or token, skipping subscription');
      return;
    }

    const params = new URLSearchParams({
      user_id: adminUser.id,
      access_role: 'admin',
      department: adminUser.department || 'general',
      token: token
    });

    const url = `/api/notifications/subscribe?${params.toString()}`;

    console.log('[DashboardNotification] Connecting to SSE:', url);

    let eventSource = null;
    let retryTimeout = null;

    const connect = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('[DashboardNotification] SSE Connection established ✅');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            console.log('[DashboardNotification] Server confirmed connection 📡');
            return;
          }

          console.log('[DashboardNotification] New Event:', data);

          if (onNotificationRef.current) {
            onNotificationRef.current(data);
          }
        } catch (error) {
          console.error('[DashboardNotification] Failed to parse event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[DashboardNotification] SSE Error ❌', error);
        eventSource.close();

        retryTimeout = setTimeout(() => {
          console.log('[DashboardNotification] Attempting to reconnect...');
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      console.log('[DashboardNotification] Cleaning up subscription...');
      if (eventSource) {
        eventSource.close();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []);
};

export default useNotificationSubscriptionDashboard;