import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const id = Date.now();
    const newNotification = { id, ...notification, timestamp: new Date() };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));
    
    // Auto-remove after 5 seconds
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
}));
