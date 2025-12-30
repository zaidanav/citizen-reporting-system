import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { getDepartmentFromStorage } from '../../utils/jwtHelper';
import { useNotificationSubscriptionDashboard } from '../../hooks/useNotificationSubscription';
import { notificationService } from '../../components/Toast';
import './Dashboard.css';

// Helper functions
const getStatusLabel = (status) => {
  const labels = {
    'PENDING': 'Menunggu',
    'IN_PROGRESS': 'Diproses',
    'RESOLVED': 'Selesai',
    'REJECTED': 'Ditolak',
  };
  return labels[status] || status;
};

const Dashboard = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [department, setDepartment] = useState('general');
  const [updatingId, setUpdatingId] = useState(null);
  const [forwardModal, setForwardModal] = useState({ show: false, reportId: null, forwardTo: '', notes: '' });

  useEffect(() => {
    const userDept = getDepartmentFromStorage();
    setDepartment(userDept);
    console.log('[Dashboard] User department:', userDept);
  }, []);

  useEffect(() => {
    loadReports();
  }, [filter, department]);

  useNotificationSubscriptionDashboard((event) => {
    if (!event || !event.type) return;

    if (event.type === 'new_report') {
      loadReports();
      notificationService.addNotification({
        type: 'info',
        title: event.title || 'Laporan Baru',
        message: event.message || 'Ada laporan baru masuk',
      });
    }
  });

  // Department category mapping for access control
  const getCategoryFilterForDepartment = (dept) => {
    const departmentCategories = {
      'Kebersihan': ['Sampah'],
      'Pekerjaan Umum': ['Jalan Rusak', 'Drainase', 'Fasilitas Umum'],
      'Penerangan Jalan': ['Lampu Jalan'],
      'Lingkungan Hidup': ['Polusi'],
      'Perhubungan': ['Traffic & Transport'],
      'General': null, // Admin umum bisa melihat semua
      'general': null,
    };
    return departmentCategories[dept] || null;
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Convert filter status to uppercase format expected by backend
      let statusFilter = undefined;
      if (filter !== 'all') {
        const statusMap = {
          'pending': 'PENDING',
          'in-progress': 'IN_PROGRESS',
          'completed': 'RESOLVED',
        };
        statusFilter = statusMap[filter] || filter;
      }
      
      const filters = {
        status: statusFilter,
        timeRange: '30d', // Default to 30 days
      };
      
      // Add category filter based on department
      const allowedCategories = getCategoryFilterForDepartment(department);
      if (allowedCategories) {
        filters.categories = allowedCategories.join(',');
      }
      
      const reportsData = await reportService.getAllReports(filters);
      console.log('[Dashboard] Reports loaded:', reportsData);
      
      // Client-side filter as additional layer (defense in depth)
      let filteredReports = Array.isArray(reportsData) ? reportsData : [];

      // Normalize status to uppercase so badges/actions work even if backend data is lowercase
      filteredReports = filteredReports.map((r) => ({
        ...r,
        status: (r.status || '').toUpperCase(),
      }));
      if (allowedCategories) {
        filteredReports = filteredReports.filter(report => 
          allowedCategories.includes(report.category)
        );
      }
      
      setReports(filteredReports);
    } catch (error) {
      console.error('Error loading reports:', error);
      notificationService.addNotification({
        type: 'error',
        title: 'Gagal Memuat Laporan',
        message: 'Terjadi kesalahan saat memuat data laporan',
      });
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
      
      // Update local state - convert the newStatus to uppercase format stored in DB
      const statusMap = {
        'pending': 'PENDING',
        'in-progress': 'IN_PROGRESS',
        'completed': 'RESOLVED',
        'rejected': 'REJECTED',
      };
      const dbStatus = statusMap[newStatus] || newStatus.toUpperCase();
      
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, status: dbStatus }
            : report
        )
      );
      
      notificationService.addNotification({
        type: 'success',
        title: 'Status Diperbarui',
        message: `Status laporan berhasil diubah menjadi ${getStatusLabel(dbStatus)}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      notificationService.addNotification({
        type: 'error',
        title: 'Gagal Memperbarui Status',
        message: error.response?.data?.message || 'Terjadi kesalahan saat memperbarui status',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleForward = async () => {
    if (!forwardModal.forwardTo) {
      notificationService.addNotification({
        type: 'error',
        title: 'Tujuan Tidak Lengkap',
        message: 'Silakan masukkan tujuan forwarding',
      });
      return;
    }

    try {
      await reportService.forwardReport(forwardModal.reportId, forwardModal.forwardTo, forwardModal.notes);
      
      notificationService.addNotification({
        type: 'success',
        title: 'Laporan Diteruskan',
        message: `Laporan berhasil diteruskan ke ${forwardModal.forwardTo}`,
      });

      setForwardModal({ show: false, reportId: null, forwardTo: '', notes: '' });
      loadReports();
    } catch (error) {
      console.error('Error forwarding report:', error);
      notificationService.addNotification({
        type: 'error',
        title: 'Gagal Meneruskan Laporan',
        message: error.response?.data?.message || 'Terjadi kesalahan saat meneruskan laporan',
      });
    }
  };

  const getStatusCounts = () => {
    return {
      all: reports.length,
      pending: reports.filter((r) => r.status === 'PENDING').length,
      'in-progress': reports.filter((r) => r.status === 'IN_PROGRESS').length,
      completed: reports.filter((r) => r.status === 'RESOLVED').length,
    };
  };

  const counts = getStatusCounts();

  const openForwardModal = (reportId) => {
    setForwardModal({ show: true, reportId, forwardTo: '', notes: '' });
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard Operasional</h1>
          <p className="dashboard-subtitle">Kelola laporan warga secara real-time</p>
          {department !== 'general' && (
            <div className="dashboard-department-badge">
              Dinas: {getDepartmentLabel(department)}
            </div>
          )}
        </div>
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
                  onForward={openForwardModal}
                  isUpdating={updatingId === report.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Forward Modal */}
      {forwardModal.show && (
        <div className="modal-overlay" onClick={() => setForwardModal({ show: false, reportId: null, forwardTo: '', notes: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Teruskan Laporan ke Sistem Eksternal</h3>
              <button 
                className="modal-close" 
                onClick={() => setForwardModal({ show: false, reportId: null, forwardTo: '', notes: '' })}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Sistem Tujuan *</label>
                <select 
                  className="form-input"
                  value={forwardModal.forwardTo}
                  onChange={(e) => setForwardModal(prev => ({ ...prev, forwardTo: e.target.value }))}
                >
                  <option value="">Pilih sistem tujuan...</option>
                  <option value="SIM-RS">SIM-RS (Sistem Informasi Rumah Sakit)</option>
                  <option value="E-Kelurahan">E-Kelurahan</option>
                  <option value="SIPD">SIPD (Sistem Informasi Pemerintah Daerah)</option>
                  <option value="BPBD">BPBD (Badan Penanggulangan Bencana Daerah)</option>
                  <option value="Satpol-PP">Satpol PP</option>
                  <option value="External-API">API Eksternal Lainnya</option>
                </select>
              </div>
              <div className="form-group">
                <label>Catatan</label>
                <textarea 
                  className="form-textarea"
                  placeholder="Tambahkan catatan untuk sistem tujuan..."
                  value={forwardModal.notes}
                  onChange={(e) => setForwardModal(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setForwardModal({ show: false, reportId: null, forwardTo: '', notes: '' })}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleForward}
                disabled={!forwardModal.forwardTo}
              >
                Teruskan Laporan
              </button>
            </div>
          </div>
        </div>
      )}
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

const ReportRow = ({ report, onStatusUpdate, isUpdating, onForward }) => {
  const {
    id,
    title,
    category,
    location,
    reporter_name,
    is_anonymous,
    status,
    upvotes,
    created_at,
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
      'PENDING': 'status-badge--pending',
      'IN_PROGRESS': 'status-badge--in-progress',
      'RESOLVED': 'status-badge--completed',
      'REJECTED': 'status-badge--rejected',
    };
    return classes[status] || '';
  };

  return (
    <tr className="report-row">
      <td className="report-row__id">#{id.slice(0, 8)}</td>
      <td className="report-row__title">{title}</td>
      <td className="report-row__category">{category}</td>
      <td className="report-row__location">{location}</td>
      <td className="report-row__author">
        {is_anonymous ? 'Anonim' : reporter_name}
      </td>
      <td>
        <span className={`status-badge ${getStatusBadgeClass(status)}`}>
          {getStatusLabel(status)}
        </span>
      </td>
      <td className="report-row__upvotes">{upvotes} Dukungan</td>
      <td className="report-row__date">{formatDate(created_at)}</td>
      <td className="report-row__actions">
        {status === 'PENDING' && (
          <button
            className="action-btn action-btn--process"
            onClick={() => onStatusUpdate(id, 'in-progress')}
            disabled={isUpdating}
          >
            Proses
          </button>
        )}
        {status === 'IN_PROGRESS' && (
          <button
            className="action-btn action-btn--complete"
            onClick={() => onStatusUpdate(id, 'completed')}
            disabled={isUpdating}
          >
            Selesai
          </button>
        )}
        {status === 'RESOLVED' && (
          <span className="action-btn action-btn--disabled">✓ Selesai</span>
        )}
        <button
          className="action-btn action-btn--forward"
          onClick={() => onForward(id)}
          title="Teruskan laporan ke sistem eksternal"
        >
          ↗ Teruskan
        </button>
      </td>
    </tr>
  );
};

const getFilterLabel = (filter) => {
  const labels = {
    pending: 'Menunggu',
    'in-progress': 'Diproses',
    completed: 'Selesai',
  };
  return labels[filter] || filter;
};

const getDepartmentLabel = (dept) => {
  const labels = {
    'pekerjaan-umum': 'Pekerjaan Umum',
    'kebersihan': 'Kebersihan',
    'penerangan': 'Penerangan Jalan',
    'lingkungan-hidup': 'Lingkungan Hidup',
    'perhubungan': 'Perhubungan',
    'general': 'Umum',
  };
  return labels[dept] || dept;
};

export default Dashboard;
