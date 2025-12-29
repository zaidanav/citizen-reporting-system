import { io } from 'socket.io-client';
import { useNotificationStore } from '../store/notificationStore';

let socket = null;

export const notificationService = {
  // Initialize WebSocket connection
  connect: (token) => {
    // Disable WebSocket sementara karena notification service belum berjalan
    console.log('WebSocket disabled - notification service not running');
    return null;
    
    /* Uncomment when notification service ready
    if (socket?.connected) {
      return socket;
    }
    
    socket = io('http://localhost:8080', {
      auth: {
        token: token,
      },
      transports: ['websocket'],
      reconnection: false, // Disable reconnection
    });
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    */
    
    // Listen for report status updates
    socket.on('report:status-update', (data) => {
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Status Laporan Diperbarui',
        message: `Laporan "${data.reportTitle}" telah ${data.status}`,
      });
    });
    
    // Listen for new comments
    socket.on('report:new-comment', (data) => {
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Komentar Baru',
        message: `Ada komentar baru pada laporan Anda`,
      });
    });
    
    // Listen for upvote milestones
    socket.on('report:upvote-milestone', (data) => {
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Dukungan Meningkat!',
        message: `Laporan Anda telah mendapat ${data.upvotes} dukungan`,
      });
    });
    
    return socket;
  },
  
  // Disconnect WebSocket
  disconnect: () => {
    if (socket?.connected) {
      socket.disconnect();
      socket = null;
    }
  },
  
  // Get socket instance
  getSocket: () => socket,
};
