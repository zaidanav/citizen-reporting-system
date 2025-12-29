import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: {
      label: 'Menunggu',
      className: 'status-badge--pending'
    },
    'in-progress': {
      label: 'Diproses',
      className: 'status-badge--in-progress'
    },
    completed: {
      label: 'Selesai',
      className: 'status-badge--completed'
    },
    rejected: {
      label: 'Ditolak',
      className: 'status-badge--rejected'
    }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
