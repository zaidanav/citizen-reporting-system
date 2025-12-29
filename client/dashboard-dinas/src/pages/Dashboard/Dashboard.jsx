import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { getDepartmentFromStorage } from '../../utils/jwtHelper';
import './Dashboard.css';

const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [department, setDepartment] = useState('general');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const userDept = getDepartmentFromStorage();
    setDepartment(userDept);
    console.log('[Dashboard] User department:', userDept);
  }, []);

  useEffect(() => {
    loadReports();
    
    // Poll for new reports every 10 seconds for real-time updates
    const interval = setInterval(loadReports, 10000);
    return () => clearInterval(interval);
  }, [filter, department]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const filters = {
        status: filter !== 'all' ? filter : undefined,
        timeRange: '30d', // Default to 30 days
      };
      
      const reportsData = await reportService.getAllReports(filters);
      console.log('[Dashboard] Reports loaded:', reportsData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId, newStatus) => {
    if (updatingId) return;
    
    setUpdatingId(reportId);
    
    try {
      await reportService.updateReportStatus(reportId, newStatus, '');
      
      // Update local state
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, status: newStatus }
            : report
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Gagal memperbarui status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusCounts = () => {
    return {
      all: reports.length,
      pending: reports.filter((r) => r.status === 'pending').length,
      'in-progress': reports.filter((r) => r.status === 'in-progress').length,
      completed: reports.filter((r) => r.status === 'completed').length,
    };
  };

  const counts = getStatusCounts();

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard Operasional</h1>
        <p className="dashboard-subtitle">Kelola laporan warga secara real-time</p>
      </div>
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatsCard
          title="Total Laporan"
          value={counts.all}
          icon="list"
          color="#2196F3"
        />
        <StatsCard
          title="Menunggu"
          value={counts.pending}
          icon="clock"
          color="#FFC107"
        />
        <StatsCard
          title="Diproses"
          value={counts['in-progress']}
          icon="settings"
          color="#2196F3"
        />
        <StatsCard
          title="Selesai"
          value={counts.completed}
          icon="✓"
          color="#4CAF50"
        />
      </div>
      
      {/* Filter Tabs */}
      <div className="dashboard-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Semua ({counts.all})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Menunggu ({counts.pending})
        </button>
        <button
          className={`filter-btn ${filter === 'in-progress' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('in-progress')}
        >
          Diproses ({counts['in-progress']})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Selesai ({counts.completed})
        </button>
      </div>
      
      {/* Reports Table */}
      <div className="reports-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Memuat laporan...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <h3>Tidak Ada Laporan</h3>
            <p>Tidak ada laporan yang sesuai dengan filter</p>
          </div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Lokasi</th>
                <th>Pelapor</th>
                <th>Status</th>
                <th>Dukungan</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onStatusUpdate={handleStatusUpdate}
                  isUpdating={updatingId === report.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, icon, color }) => (
  <div className="stats-card" style={{ borderLeftColor: color }}>
    <div className="stats-card__icon" style={{ color }}>{icon}</div>
    <div className="stats-card__content">
      <div className="stats-card__value">{value}</div>
      <div className="stats-card__title">{title}</div>
    </div>
  </div>
);

const ReportRow = ({ report, onStatusUpdate, isUpdating }) => {
  const {
    id,
    title,
    category,
    location,
    authorName,
    isAnonymous,
    status,
    upvotes,
    createdAt,
  } = report;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'status-badge--pending',
      'in-progress': 'status-badge--in-progress',
      completed: 'status-badge--completed',
      rejected: 'status-badge--rejected',
    };
    return classes[status] || '';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Menunggu',
      'in-progress': 'Diproses',
      completed: 'Selesai',
      rejected: 'Ditolak',
    };
    return labels[status] || status;
  };

  return (
    <tr className="report-row">
      <td className="report-row__id">#{id.slice(0, 8)}</td>
      <td className="report-row__title">{title}</td>
      <td className="report-row__category">{category}</td>
      <td className="report-row__location">{location}</td>
      <td className="report-row__author">
        {isAnonymous ? 'Anonim' : authorName}
      </td>
      <td>
        <span className={`status-badge ${getStatusBadgeClass(status)}`}>
          {getStatusLabel(status)}
        </span>
      </td>
      <td className="report-row__upvotes">{upvotes} Dukungan</td>
      <td className="report-row__date">{formatDate(createdAt)}</td>
      <td className="report-row__actions">
        {status === 'pending' && (
          <button
            className="action-btn action-btn--process"
            onClick={() => onStatusUpdate(id, 'in-progress')}
            disabled={isUpdating}
          >
            Proses
          </button>
        )}
        {status === 'in-progress' && (
          <button
            className="action-btn action-btn--complete"
            onClick={() => onStatusUpdate(id, 'completed')}
            disabled={isUpdating}
          >
            Selesai
          </button>
        )}
        {status === 'completed' && (
          <span className="action-btn action-btn--disabled">✓ Selesai</span>
        )}
      </td>
    </tr>
  );
};

export default Dashboard;
