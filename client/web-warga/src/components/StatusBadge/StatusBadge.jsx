import React from 'react';
import './StatusBadge.css';

const normalizeStatus = (status) => {
  if (!status) return 'PENDING';

  const normalized = String(status)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

  if (normalized === 'IN_PROGRESS' || normalized === 'INPROGRESS' || normalized === 'PROCESSING' || normalized === 'PROCESSED' || normalized === 'DIPROSES') {
    return 'IN_PROGRESS';
  }
  if (normalized === 'RESOLVED' || normalized === 'COMPLETED' || normalized === 'SELESAI') {
    return 'RESOLVED';
  }
  if (normalized === 'REJECTED' || normalized === 'DITOLAK') {
    return 'REJECTED';
  }
  if (normalized === 'PENDING' || normalized === 'MENUNGGU') {
    return 'PENDING';
  }

  return 'PENDING';
};

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

  const config = statusConfig[normalizeStatus(status)] || statusConfig.PENDING;

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
