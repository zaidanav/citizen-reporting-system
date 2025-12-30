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
      // Handle both response.data and response formats
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

  // Prepare data for charts
  const allStatusData = [
    { name: 'Selesai', value: analyticsData.completed || 0, color: '#4CAF50' },
    { name: 'Diproses', value: analyticsData.inProgress || 0, color: '#2196F3' },
    { name: 'Menunggu', value: analyticsData.pending || 0, color: '#FFC107' },
  ];
  
  // Filter out status dengan value 0
  const statusData = allStatusData.filter(s => s.value > 0);

  // Use real category data from API
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
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} />
              <Tooltip formatter={(value) => [`${value} laporan`, 'Jumlah']} labelFormatter={(value) => ''} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '20px', padding: '0 20px', fontSize: '14px', color: '#B0B0B0' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong style={{ color: '#FFC107' }}>Menunggu:</strong> {analyticsData.pending || 0} laporan
            </div>
            {analyticsData.inProgress > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <strong style={{ color: '#2196F3' }}>Diproses:</strong> {analyticsData.inProgress || 0} laporan
              </div>
            )}
            {analyticsData.completed > 0 && (
              <div>
                <strong style={{ color: '#4CAF50' }}>Selesai:</strong> {analyticsData.completed || 0} laporan
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                <XAxis dataKey="name" stroke="#B0B0B0" />
                <YAxis stroke="#B0B0B0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#2A2A2A',
                    border: '1px solid #3A3A3A',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="total" fill="#2196F3" name="Total Laporan" />
                <Bar dataKey="selesai" fill="#4CAF50" name="Selesai" />
              </BarChart>
            </ResponsiveContainer>
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
  const getIconLabel = (iconName) => {
    const icons = {
      'list': '≡',
      'check': '✓',
      'clock': '⧐',
      'support': '+'
    };
    return icons[iconName] || iconName;
  };

  return (
    <div className="kpi-card">
      <div className="kpi-card__icon">{getIconLabel(icon)}</div>
      <div className="kpi-card__content">
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__title">{title}</div>
        <div className={`kpi-card__trend ${trendUp ? 'kpi-card__trend--up' : 'kpi-card__trend--down'}`}>
          {trendUp ? '↗' : '↘'} {trend}
        </div>
      </div>
    </div>
  );
};

const InsightCard = ({ icon, title, description }) => {
  const getIconLabel = (iconName) => {
    const icons = {
      'target': '◎',
      'alert': '!',
      'chart': '∿',
      'people': '👥'
    };
    return icons[iconName] || iconName;
  };

  return (
    <div className="insight-card">
      <div className="insight-card__icon">{getIconLabel(icon)}</div>
      <div className="insight-card__content">
        <h4 className="insight-card__title">{title}</h4>
        <p className="insight-card__description">{description}</p>
      </div>
    </div>
  );
};

export default Analytics;
