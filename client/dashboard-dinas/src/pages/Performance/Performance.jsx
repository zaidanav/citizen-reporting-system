import React, { useEffect, useMemo, useState } from 'react';
import { reportService } from '../../services/reportService';
import { getRoleFromStorage } from '../../utils/jwtHelper';
import './Performance.css';

const getDepartmentLabel = (dept) => {
  const labels = {
    'pekerjaan-umum': 'Pekerjaan Umum',
    kebersihan: 'Kebersihan',
    penerangan: 'Penerangan Jalan',
    'lingkungan-hidup': 'Lingkungan Hidup',
    perhubungan: 'Perhubungan',
    general: 'Umum',
  };
  return labels[dept] || dept;
};

const Performance = () => {
  const role = getRoleFromStorage();
  const isSuperAdmin = role === 'super-admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [data, setData] = useState(null);

  const departmentOptions = useMemo(() => ([
    { value: 'all', label: 'Semua Dinas' },
    { value: 'kebersihan', label: 'Kebersihan' },
    { value: 'pekerjaan-umum', label: 'Pekerjaan Umum' },
    { value: 'penerangan', label: 'Penerangan Jalan' },
    { value: 'lingkungan-hidup', label: 'Lingkungan Hidup' },
    { value: 'perhubungan', label: 'Perhubungan' },
  ]), []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const dept = isSuperAdmin ? selectedDepartment : 'all';
        const response = await reportService.getPerformance(timeRange, dept);
        setData(response.data || response);
      } catch (e) {
        setError('Terjadi kesalahan saat memuat data performa');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [timeRange, selectedDepartment, isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="performance-page">
        <div className="empty-state">
          <h3>Akses Terbatas</h3>
          <p>Halaman ini hanya tersedia untuk Super Admin.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="performance-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Memuat data performa...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="performance-page">
        <div className="empty-state">
          <h3>Data Tidak Tersedia</h3>
          <p>{error || 'Tidak ada data performa yang bisa ditampilkan.'}</p>
        </div>
      </div>
    );
  }

  const departments = Array.isArray(data.departments) ? data.departments : [];

  const totals = departments.reduce(
    (acc, d) => {
      acc.total += Number(d.total || 0);
      acc.pending += Number(d.pending || 0);
      acc.inProgress += Number(d.inProgress || 0);
      acc.completed += Number(d.completed || 0);
      acc.totalUpvotes += Number(d.totalUpvotes || 0);
      return acc;
    },
    { total: 0, pending: 0, inProgress: 0, completed: 0, totalUpvotes: 0 }
  );

  const completionRate = totals.total > 0 ? (totals.completed / totals.total) * 100 : 0;

  return (
    <div className="performance-page">
      <div className="performance-header">
        <div>
          <h1 className="performance-title">Monitoring Performa Dinas</h1>
          <p className="performance-subtitle">Ringkasan kinerja lintas dinas berdasarkan laporan masuk</p>
        </div>

        <div className="performance-controls">
          <select
            className="performance-dept-select"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            aria-label="Pilih dinas"
          >
            {departmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="performance-time-range">
            <button
              className={`performance-time-btn ${timeRange === '7d' ? 'performance-time-btn--active' : ''}`}
              onClick={() => setTimeRange('7d')}
              type="button"
            >
              7 Hari
            </button>
            <button
              className={`performance-time-btn ${timeRange === '30d' ? 'performance-time-btn--active' : ''}`}
              onClick={() => setTimeRange('30d')}
              type="button"
            >
              30 Hari
            </button>
            <button
              className={`performance-time-btn ${timeRange === '90d' ? 'performance-time-btn--active' : ''}`}
              onClick={() => setTimeRange('90d')}
              type="button"
            >
              90 Hari
            </button>
          </div>
        </div>
      </div>

      <div className="performance-kpi-grid">
        <div className="performance-kpi-card">
          <div>
            <div className="performance-kpi-card__value">{totals.total}</div>
            <div className="performance-kpi-card__title">Total Laporan</div>
          </div>
        </div>
        <div className="performance-kpi-card">
          <div>
            <div className="performance-kpi-card__value">{totals.pending}</div>
            <div className="performance-kpi-card__title">Menunggu</div>
          </div>
        </div>
        <div className="performance-kpi-card">
          <div>
            <div className="performance-kpi-card__value">{totals.inProgress}</div>
            <div className="performance-kpi-card__title">Diproses</div>
          </div>
        </div>
        <div className="performance-kpi-card">
          <div>
            <div className="performance-kpi-card__value">{Math.round(completionRate)}%</div>
            <div className="performance-kpi-card__title">Tingkat Penyelesaian</div>
          </div>
        </div>
      </div>

      <div className="dept-grid">
        {departments.length === 0 ? (
          <div className="empty-state">
            <h3>Tidak Ada Data</h3>
            <p>Tidak ada laporan pada periode ini.</p>
          </div>
        ) : (
          departments.map((d) => (
            <div key={String(d.department)} className="dept-card">
              <div className="dept-card__title">{getDepartmentLabel(String(d.department))}</div>

              <div className="dept-card__stats">
                <div className="dept-stat">
                  <div className="dept-stat__label">Total</div>
                  <div className="dept-stat__value">{Number(d.total || 0)}</div>
                </div>
                <div className="dept-stat">
                  <div className="dept-stat__label">Menunggu</div>
                  <div className="dept-stat__value">{Number(d.pending || 0)}</div>
                </div>
                <div className="dept-stat">
                  <div className="dept-stat__label">Diproses</div>
                  <div className="dept-stat__value">{Number(d.inProgress || 0)}</div>
                </div>
                <div className="dept-stat">
                  <div className="dept-stat__label">Selesai</div>
                  <div className="dept-stat__value">{Number(d.completed || 0)}</div>
                </div>
                <div className="dept-stat">
                  <div className="dept-stat__label">Completion Rate</div>
                  <div className="dept-stat__value">{Math.round(Number(d.completionRate || 0))}%</div>
                </div>
                <div className="dept-stat">
                  <div className="dept-stat__label">Dukungan (Upvotes)</div>
                  <div className="dept-stat__value">{Number(d.totalUpvotes || 0)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Performance;
