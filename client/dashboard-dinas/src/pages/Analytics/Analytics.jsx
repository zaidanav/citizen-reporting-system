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

  // Prepare data for charts (mock data for demonstration)
  const statusData = [
    { name: 'Selesai', value: analyticsData.completed || 45, color: '#4CAF50' },
    { name: 'Diproses', value: analyticsData.inProgress || 30, color: '#2196F3' },
    { name: 'Menunggu', value: analyticsData.pending || 25, color: '#FFC107' },
  ];

  const categoryData = [
    { name: 'Jalan Rusak', total: 45, selesai: 30 },
    { name: 'Sampah', total: 38, selesai: 28 },
    { name: 'Penerangan', total: 32, selesai: 25 },
    { name: 'Drainase', total: 28, selesai: 20 },
    { name: 'Fasilitas Umum', total: 22, selesai: 18 },
  ];

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
          value={analyticsData.total || 100}
          icon="list"
          trend="+12%"
          trendUp={true}
        />
        <KPICard
          title="Tingkat Penyelesaian"
          value={`${analyticsData.completionRate || 75}%`}
          icon="check"
          trend="+5%"
          trendUp={true}
        />
        <KPICard
          title="Rata-rata Waktu Proses"
          value={`${analyticsData.avgProcessTime || 3.5} hari`}
          icon="clock"
          trend="-8%"
          trendUp={true}
        />
        <KPICard
          title="Dukungan Warga"
          value={analyticsData.totalUpvotes || 450}
          icon="support"
          trend="+18%"
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
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Category Performance - Bar Chart */}
        <div className="chart-card chart-card--wide">
          <h3 className="chart-title">Kinerja per Kategori</h3>
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
        </div>
      </div>
      
      {/* Insights */}
      <div className="insights-section">
        <h2 className="insights-title">Insight Kunci</h2>
        <div className="insights-grid">
          <InsightCard
            icon="target"
            title="Performa Terbaik"
            description="Kategori 'Penerangan' memiliki tingkat penyelesaian tertinggi (78%)"
          />
          <InsightCard
            icon="alert"
            title="Perlu Perhatian"
            description="Kategori 'Jalan Rusak' memiliki waktu proses rata-rata terlama (5.2 hari)"
          />
          <InsightCard
            icon="chart"
            title="Tren Positif"
            description="Tingkat penyelesaian meningkat 15% dibanding bulan lalu"
          />
          <InsightCard
            icon="people"
            title="Partisipasi Warga"
            description="Jumlah laporan baru meningkat 12% minggu ini"
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
