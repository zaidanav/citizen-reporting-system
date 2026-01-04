import React, { useEffect } from 'react';
import './Toast.css';

let notificationStore = {
  notifications: [],
  listeners: [],
};

const addNotification = (notification) => {
  const id = Date.now() + Math.random();
  const newNotification = { id, ...notification };
  notificationStore.notifications = [...notificationStore.notifications, newNotification];
  notificationStore.listeners.forEach((listener) => listener(notificationStore.notifications));
  return id;
};

const removeNotification = (id) => {
  notificationStore.notifications = notificationStore.notifications.filter((n) => n.id !== id);
  notificationStore.listeners.forEach((listener) => listener(notificationStore.notifications));
};

const subscribe = (listener) => {
  notificationStore.listeners.push(listener);
  return () => {
    notificationStore.listeners = notificationStore.listeners.filter((l) => l !== listener);
  };
};

export const notificationService = {
  addNotification,
  removeNotification,
};

const Toast = () => {
  const [notifications, setNotifications] = React.useState([]);

  useEffect(() => {
    const unsubscribe = subscribe(setNotifications);
    return unsubscribe;
  }, []);

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
