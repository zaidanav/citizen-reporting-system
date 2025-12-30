import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    PENDING: {
      label: 'Menunggu',
      className: 'status-badge--pending'
    },
    IN_PROGRESS: {
      label: 'Diproses',
      className: 'status-badge--in-progress'
    },
    RESOLVED: {
      label: 'Selesai',
      className: 'status-badge--completed'
    },
    REJECTED: {
      label: 'Ditolak',
      className: 'status-badge--rejected'
    }
  };

  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
