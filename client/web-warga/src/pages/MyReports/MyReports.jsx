import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/reportService';
import { useNotificationStore } from '../../store/notificationStore';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import './MyReports.css';

const MyReports = () => {
  const navigate = useNavigate();
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, in-progress, completed

  useEffect(() => {
    loadMyReports();
  }, []);

  const loadMyReports = async () => {
    try {
      setLoading(true);
      const reportsData = await reportService.getMyReports();
      console.log('[MyReports] MyReports loaded:', reportsData);
      const reports = Array.isArray(reportsData) ? reportsData : [];
      setReports(reports);
    } catch (error) {
      console.error('Error loading my reports:', error);
      addNotification({
        type: 'error',
        title: 'Gagal Memuat Laporan',
        message: 'Terjadi kesalahan saat memuat laporan Anda',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (filter === 'all') return true;
    return report.status === filter;
  });

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
    <div className="my-reports-page">
      <div className="my-reports-header">
        <div className="container">
          <h1 className="my-reports-title">Laporan Saya</h1>
          <p className="my-reports-subtitle">Pantau status laporan yang Anda buat</p>
        </div>
      </div>
      
      <div className="container">
        <div className="my-reports-actions">
          <Button variant="primary" onClick={() => navigate('/create')}>
            Buat Laporan Baru
          </Button>
        </div>
        
        {/* Filter Tabs */}
        <div className="my-reports-filters">
          <button
            className={`filter-tab ${filter === 'all' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Semua
            <span className="filter-tab__count">{counts.all}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'pending' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Menunggu
            <span className="filter-tab__count filter-tab__count--pending">{counts.pending}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'in-progress' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('in-progress')}
          >
            Diproses
            <span className="filter-tab__count filter-tab__count--in-progress">{counts['in-progress']}</span>
          </button>
          <button
            className={`filter-tab ${filter === 'completed' ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Selesai
            <span className="filter-tab__count filter-tab__count--completed">{counts.completed}</span>
          </button>
        </div>
        
        {loading ? (
          <div className="my-reports-loading">
            <div className="spinner"></div>
            <p>Memuat laporan...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <Card className="my-reports-empty">
            <h3>
              {filter === 'all' ? 'Belum Ada Laporan' : 'Tidak Ada Laporan'}
            </h3>
            <p>
              {filter === 'all'
                ? 'Anda belum membuat laporan apapun'
                : `Tidak ada laporan dengan status "${getFilterLabel(filter)}"`}
            </p>
            {filter === 'all' && (
              <Button variant="primary" onClick={() => navigate('/create')}>
                Buat Laporan Pertama
              </Button>
            )}
          </Card>
        ) : (
          <div className="my-reports-list">
            {filteredReports.map((report) => (
              <MyReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MyReportCard = ({ report }) => {
  const {
    id,
    title,
    description,
    category,
    location,
    imageUrl,
    status,
    upvotes = 0,
    isAnonymous,
    isPublic,
    createdAt,
    updatedAt,
  } = report;

  // Debug log
  console.log('[MyReportCard] Data:', {
    title,
    isPublic,
    isAnonymous,
    status,
    rawReport: report,
  });

  // Reconstruct privacy from isPublic and isAnonymous flags
  const getPrivacyType = () => {
    const type = !isPublic ? 'private' : isAnonymous ? 'anonymous' : 'public';
    console.log('[Privacy] Type calculation:', { isPublic, isAnonymous, resultType: type });
    return type;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPrivacyIcon = () => {
    const privacy = getPrivacyType();
    switch (privacy) {
      case 'public':
        return 'Public';
      case 'private':
        return 'Private';
      case 'anonymous':
        return 'Anonymous';
      default:
        return 'Public';
    }
  };

  const getPrivacyLabel = () => {
    const privacy = getPrivacyType();
    switch (privacy) {
      case 'public':
        return 'Publik';
      case 'private':
        return 'Privat';
      case 'anonymous':
        return 'Anonim';
      default:
        return 'Publik';
    }
  };

  return (
    <Card className="my-report-card" hover>
      <div className="my-report-card__header">
        <StatusBadge status={status} />
        <span className="my-report-card__privacy">
          {getPrivacyIcon()} {getPrivacyLabel()}
        </span>
      </div>
      
      <div className="my-report-card__body">
        <h3 className="my-report-card__title">{title}</h3>
        
        <div className="my-report-card__info">
          <span className="my-report-card__category">Kategori: {category}</span>
          <span className="my-report-card__location">Lokasi: {location}</span>
        </div>
        
        <p className="my-report-card__description">{description}</p>
        
        {imageUrl && (
          <div className="my-report-card__image">
            <img src={imageUrl} alt={title} />
          </div>
        )}
      </div>
      
      <div className="my-report-card__footer">
        <div className="my-report-card__stats">
          <span className="my-report-card__stat">
            {upvotes} Dukungan
          </span>
        </div>
        <div className="my-report-card__dates">
          <span className="my-report-card__date">
            Dibuat: {formatDate(createdAt)}
          </span>
          {updatedAt !== createdAt && (
            <span className="my-report-card__date">
              Diperbarui: {formatDate(updatedAt)}
            </span>
          )}
        </div>
      </div>
    </Card>
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

export default MyReports;
