import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { notificationService } from '../../components/Toast';
import './Escalation.css';

const Escalation = () => {
  const [escalatedReports, setEscalatedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadEscalatedReports();

    const interval = setInterval(loadEscalatedReports, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadEscalatedReports = async () => {
    try {
      setLoading(true);
      const data = await reportService.getEscalatedReports('all');
      const normalized = Array.isArray(data)
        ? data.map((r) => ({
            ...r,
            status: (r.status || '').toUpperCase(),
          }))
        : [];
      setEscalatedReports(normalized);
    } catch (error) {
      console.error('Error loading escalated reports:', error);
      notificationService.addNotification({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: 'Terjadi kesalahan saat memuat laporan eskalasi',
      });
      setEscalatedReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (reportId) => {
    try {
      await reportService.escalateReport(reportId);

      notificationService.addNotification({
        type: 'success',
        title: 'Laporan Dieskalasi',
        message: 'Laporan berhasil dieskalasi ke tingkat lebih tinggi',
      });

      loadEscalatedReports();
    } catch (error) {
      console.error('Error escalating report:', error);
      notificationService.addNotification({
        type: 'error',
        title: 'Gagal Eskalasi',
        message: error.response?.data?.message || 'Terjadi kesalahan saat eskalasi laporan',
      });
    }
  };

  const getSLAStatus = (report) => {
    if (!report.sla_deadline) return { status: 'no-sla', label: 'Tidak Ada SLA' };

    const now = new Date();
    const deadline = new Date(report.sla_deadline);
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

    if (report.is_escalated) {
      return { status: 'escalated', label: 'Sudah Dieskalasi' };
    }

    if (hoursRemaining < 0) {
      return { status: 'breached', label: `Terlambat ${Math.abs(Math.round(hoursRemaining))} jam` };
    }

    if (hoursRemaining < 24) {
      return { status: 'warning', label: `Sisa ${Math.round(hoursRemaining)} jam` };
    }

    return { status: 'ok', label: `Sisa ${Math.round(hoursRemaining / 24)} hari` };
  };

  const getFilteredReports = () => {
    if (filter === 'all') return escalatedReports;
    if (filter === 'sla-breached') {
      return escalatedReports.filter(r => {
        const sla = getSLAStatus(r);
        return sla.status === 'breached';
      });
    }
    if (filter === 'escalated') {
      return escalatedReports.filter(r => r.is_escalated);
    }
    return escalatedReports;
  };

  const filteredReports = getFilteredReports();
  const breachedCount = escalatedReports.filter(r => getSLAStatus(r).status === 'breached').length;
  const escalatedCount = escalatedReports.filter(r => r.is_escalated).length;

  return (
    <div className="escalation-page">
      <div className="escalation-header">
        <div>
          <h1 className="escalation-title">Manajemen Eskalasi</h1>
          <p className="escalation-subtitle">Monitor dan kelola laporan yang memerlukan eskalasi</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="escalation-stats">
        <div className="stat-card stat-card--warning">
          <div className="stat-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{breachedCount}</div>
            <div className="stat-card__label">Melewati SLA</div>
          </div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{escalatedCount}</div>
            <div className="stat-card__label">Sudah Dieskalasi</div>
          </div>
        </div>
        <div className="stat-card stat-card--primary">
          <div className="stat-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </div>
          <div className="stat-card__content">
            <div className="stat-card__value">{escalatedReports.length}</div>
            <div className="stat-card__label">Total Monitoring</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="escalation-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Semua ({escalatedReports.length})
        </button>
        <button
          className={`filter-btn ${filter === 'sla-breached' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('sla-breached')}
        >
          Melewati SLA ({breachedCount})
        </button>
        <button
          className={`filter-btn ${filter === 'escalated' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('escalated')}
        >
          Sudah Dieskalasi ({escalatedCount})
        </button>
      </div>

      {/* Reports Table */}
      <div className="escalation-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Memuat data eskalasi...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state">
            <h3>Tidak Ada Laporan</h3>
            <p>Tidak ada laporan yang memerlukan eskalasi</p>
          </div>
        ) : (
          <table className="escalation-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Status</th>
                <th>SLA Status</th>
                <th>Deadline</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => {
                const sla = getSLAStatus(report);
                const reportId = report._id || report.id;
                return (
                  <tr key={reportId} className="escalation-row">
                    <td className="escalation-row__id">#{reportId.slice(0, 8)}</td>
                    <td className="escalation-row__title">{report.title}</td>
                    <td className="escalation-row__category">{report.category}</td>
                    <td>
                      <span className={`status-badge status-badge--${report.status.toLowerCase()}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>
                      <span className={`sla-badge sla-badge--${sla.status}`}>
                        {sla.label}
                      </span>
                    </td>
                    <td className="escalation-row__deadline">
                      {report.sla_deadline ? new Date(report.sla_deadline).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="escalation-row__actions">
                      {!report.is_escalated && sla.status === 'breached' && (
                        <button
                          className="action-btn action-btn--escalate"
                          onClick={() => handleEscalate(reportId)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="19" x2="12" y2="5"/>
                            <polyline points="5 12 12 5 19 12"/>
                          </svg>
                          Eskalasi
                        </button>
                      )}
                      {report.is_escalated && (
                        <span className="action-btn action-btn--disabled">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Dieskalasi
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Escalation;
