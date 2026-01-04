import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  lastReportStatusUpdate: null,

  addNotification: (notification) => {
    const id = Date.now();
    const newNotification = { id, ...notification, timestamp: new Date() };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    setTimeout(() => {
      get().removeNotification(id);
    }, 5000);

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  setLastReportStatusUpdate: (update) => {
    if (!update || !update.reportId || !update.status) return;
    set({
      lastReportStatusUpdate: {
        reportId: String(update.reportId),
        status: String(update.status),
        receivedAt: Date.now(),
      },
    });
  },
}));
