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
  const setLastReportStatusUpdate = useNotificationStore((state) => state.setLastReportStatusUpdate);

  const normalizeStatus = (status) => {
    if (!status) return 'PENDING';
    const normalized = String(status).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (['IN_PROGRESS', 'INPROGRESS', 'PROCESSING', 'PROCESSED', 'DIPROSES'].includes(normalized)) return 'IN_PROGRESS';
    if (['RESOLVED', 'COMPLETED', 'SELESAI'].includes(normalized)) return 'RESOLVED';
    if (['REJECTED', 'DITOLAK'].includes(normalized)) return 'REJECTED';
    return 'PENDING';
  };

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!user || !user.id || !token) {
      console.log('[Notification] No user or token, skipping subscription');
      return;
    }

    const params = new URLSearchParams({
      user_id: user.id,
      access_role: 'citizen',
      token: token
    });

    const url = `/api/notifications/subscribe?${params.toString()}`;

    console.log('[Notification] Connecting to SSE:', url);

    let eventSource = null;
    let retryTimeout = null;

    const connect = () => {
      if (eventSource) eventSource.close();

      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('[Notification] SSE Connection established ✅');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') return;

          console.log('[Notification] Received event:', data);

          if (data.type === 'status_update') {
            const reportId = data.report_id || data.reportId || data.id;
            const status = normalizeStatus(data.status);
            if (reportId && status) {
              setLastReportStatusUpdate({ reportId, status });
            }
          }

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
        console.error('[Notification] SSE Error ❌', error);
        eventSource.close();
        retryTimeout = setTimeout(() => connect(), 5000);
      };
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [user, addNotification, setLastReportStatusUpdate]);
};

export default useNotificationSubscription;
