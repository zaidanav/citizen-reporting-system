import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { reportService } from '../../services/reportService';
import { getDepartmentFromStorage } from '../../utils/jwtHelper';
import './Analytics.css';

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await reportService.getAnalytics(timeRange);
      console.log('[Analytics] Analytics response:', response);
      const analyticsData = response.data || response;
      setAnalyticsData(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Memuat data analitik...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="analytics-page">
        <div className="empty-state">
          <h3>Data Tidak Tersedia</h3>
          <p>Terjadi kesalahan saat memuat data analitik</p>
        </div>
      </div>
    );
  }

  const allStatusData = [
    { name: 'Selesai', value: analyticsData.completed || 0, color: '#5A7A96' },
    { name: 'Diproses', value: analyticsData.inProgress || 0, color: '#456882' },
    { name: 'Menunggu', value: analyticsData.pending || 0, color: '#234C6A' },
  ];

  const statusData = allStatusData.filter(s => s.value > 0);

  const categoryData = (analyticsData.categories || []).map(cat => ({
    name: cat.name,
    total: cat.total,
    selesai: cat.selesai || 0,
  }));

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Dashboard Analitik</h1>
          <p className="analytics-subtitle">Visualisasi data kinerja sistem pelaporan</p>
        </div>

        <div className="time-range-selector">
          <button
            className={`time-btn ${timeRange === '7d' ? 'time-btn--active' : ''}`}
            onClick={() => setTimeRange('7d')}
          >
            7 Hari
          </button>
          <button
            className={`time-btn ${timeRange === '30d' ? 'time-btn--active' : ''}`}
            onClick={() => setTimeRange('30d')}
          >
            30 Hari
          </button>
          <button
            className={`time-btn ${timeRange === '90d' ? 'time-btn--active' : ''}`}
            onClick={() => setTimeRange('90d')}
          >
            90 Hari
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="Total Laporan"
          value={analyticsData.total || 0}
          icon="list"
          trend={`${analyticsData.total > 0 ? '+' : ''}${analyticsData.total}`}
          trendUp={true}
        />
        <KPICard
          title="Tingkat Penyelesaian"
          value={`${Math.round(analyticsData.completionRate || 0)}%`}
          icon="check"
          trend={`${analyticsData.completed || 0} dari ${analyticsData.total || 0}`}
          trendUp={true}
        />
        <KPICard
          title="Rata-rata Waktu Proses"
          value={`${(analyticsData.avgProcessTime || 0).toFixed(1)} hari`}
          icon="clock"
          trend={analyticsData.avgProcessTime > 0 ? 'Waktu aktual' : 'Belum ada data'}
          trendUp={true}
        />
        <KPICard
          title="Dukungan Warga"
          value={analyticsData.totalUpvotes || 0}
          icon="support"
          trend={`${analyticsData.totalUpvotes || 0} upvotes`}
          trendUp={true}
        />
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Status Distribution - Pie Chart */}
        <div className="chart-card">
          <h3 className="chart-title">Distribusi Status Laporan</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#456882"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value) => <span style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '14px' }}>{value}</span>}
              />
              <Tooltip formatter={(value) => [`${value} laporan`, 'Jumlah']} labelFormatter={(value) => ''} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '20px', padding: '0 20px', fontSize: '15px', color: '#FFFFFF' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong style={{ color: '#B8C9D9', fontWeight: '700' }}>Menunggu:</strong> <span style={{ color: '#FFFFFF', fontWeight: '600' }}>{analyticsData.pending || 0} laporan</span>
            </div>
            {analyticsData.inProgress > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: '#B8C9D9', fontWeight: '700' }}>Diproses:</strong> <span style={{ color: '#FFFFFF', fontWeight: '600' }}>{analyticsData.inProgress || 0} laporan</span>
              </div>
            )}
            {analyticsData.completed > 0 && (
              <div>
                <strong style={{ color: '#B8C9D9', fontWeight: '700' }}>Selesai:</strong> <span style={{ color: '#FFFFFF', fontWeight: '600' }}>{analyticsData.completed || 0} laporan</span>
              </div>
            )}
          </div>
        </div>

        {/* Category Performance - Bar Chart */}
        <div className="chart-card chart-card--wide">
          <h3 className="chart-title">Kinerja per Kategori</h3>
          {categoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <p>Tidak ada data kategori untuk periode ini</p>
            </div>
          ) : (
            <div className="chart-body chart-body--center">
              <div style={{ width: '100%', maxWidth: '1100px' }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#234C6A" />
                  <XAxis dataKey="name" stroke="#FFFFFF" />
                  <YAxis stroke="#FFFFFF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1B3C53',
                    border: '1px solid #456882',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  iconType="circle"
                  formatter={(value) => <span style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '14px' }}>{value}</span>}
                />
                <Bar dataKey="total" fill="#234C6A" name="Total Laporan" />
                <Bar dataKey="selesai" fill="#456882" name="Selesai" />
              </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="insights-section">
        <h2 className="insights-title">Insight Kunci</h2>
        <div className="insights-grid">
          {categoryData.length > 0 && (
            <>
              {(() => {
                const bestCategory = categoryData.reduce((prev, current) =>
                  current.selesai > (prev.selesai || 0) ? current : prev
                );
                const bestRate = bestCategory.total ? ((bestCategory.selesai / bestCategory.total) * 100).toFixed(0) : 0;
                return (
                  <InsightCard
                    icon="target"
                    title="Performa Terbaik"
                    description={`Kategori '${bestCategory.name}' memiliki tingkat penyelesaian tertinggi (${bestRate}%)`}
                  />
                );
              })()}
              {(() => {
                const worstCategory = categoryData.reduce((prev, current) =>
                  (current.total - current.selesai) > (prev.total - prev.selesai) ? current : prev
                );
                return (
                  <InsightCard
                    icon="alert"
                    title="Perlu Perhatian"
                    description={`Kategori '${worstCategory.name}' memiliki ${(worstCategory.total - worstCategory.selesai)} laporan pending`}
                  />
                );
              })()}
            </>
          )}
          <InsightCard
            icon="chart"
            title="Tingkat Penyelesaian"
            description={`${analyticsData.completionRate ? analyticsData.completionRate.toFixed(0) : 0}% dari ${analyticsData.total || 0} laporan telah selesai`}
          />
          <InsightCard
            icon="people"
            title="Dukungan Warga"
            description={`Total ${analyticsData.totalUpvotes || 0} dukungan dari warga`}
          />
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ title, value, icon, trend, trendUp }) => {
  const getTrendIcon = (isUp) => {
    if (isUp) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      );
    }

    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 7l10 10" />
        <path d="M17 7v10H7" />
      </svg>
    );
  };

  const getIcon = (iconName) => {
    switch(iconName) {
      case 'list':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        );
      case 'check':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        );
      case 'clock':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        );
      case 'support':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        );
      default:
        return iconName;
    }
  };

  return (
    <div className="kpi-card">
      <div className="kpi-card__icon">{getIcon(icon)}</div>
      <div className="kpi-card__content">
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__title">{title}</div>
        <div className={`kpi-card__trend ${trendUp ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}`}>
          {getTrendIcon(trendUp)} {trend}
        </div>
      </div>
    </div>
  );
};

const InsightCard = ({ icon, title, description }) => {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'target':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
          </svg>
        );
      case 'alert':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12" y2="17" />
          </svg>
        );
      case 'chart':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="20" x2="20" y2="20" />
            <line x1="6" y1="20" x2="6" y2="12" />
            <line x1="12" y1="20" x2="12" y2="8" />
            <line x1="18" y1="20" x2="18" y2="4" />
          </svg>
        );
      case 'people':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="insight-card">
      <div className="insight-card__icon">{getIcon(icon)}</div>
      <div className="insight-card__content">
        <h4 className="insight-card__title">{title}</h4>
        <p className="insight-card__description">{description}</p>
      </div>
    </div>
  );
};

export default Analytics;
