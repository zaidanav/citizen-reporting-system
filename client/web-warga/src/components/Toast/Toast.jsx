import React, { useEffect } from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import './Toast.css';

const Toast = () => {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="toast-container">
      {notifications.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

const ToastItem = ({ notification, onClose }) => {
  const { type = 'info', title, message } = notification;

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast--${type}`}>
      <div className="toast__icon">{icons[type]}</div>
      <div className="toast__content">
        {title && <div className="toast__title">{title}</div>}
        {message && <div className="toast__message">{message}</div>}
      </div>
      <button className="toast__close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
};

export default Toast;
