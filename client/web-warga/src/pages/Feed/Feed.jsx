import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/reportService';
import { useNotificationStore } from '../../store/notificationStore';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import './Feed.css';

const Feed = () => {
  const navigate = useNavigate();
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [upvotingIds, setUpvotingIds] = useState(new Set());

  useEffect(() => {
    loadReports();
  }, [page]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reportsData = await reportService.getPublicReports(page, 20);
      
      console.log('[Feed] Reports loaded:', reportsData);
      const reports = Array.isArray(reportsData) ? reportsData : [];
      
      if (page === 1) {
        setReports(reports);
      } else {
        setReports((prev) => [...prev, ...reports]);
      }
      
      // For pagination: assume has more if we got full page
      setHasMore(reports.length === 20);
    } catch (error) {
      console.error('Error loading reports:', error);
      addNotification({
        type: 'error',
        title: 'Gagal Memuat Laporan',
        message: 'Terjadi kesalahan saat memuat feed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (reportId, hasUpvoted) => {
    // Prevent multiple simultaneous upvotes
    if (upvotingIds.has(reportId)) return;
    
    setUpvotingIds((prev) => new Set([...prev, reportId]));
    
    try {
      // Optimistic UI update
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? {
                ...report,
                hasUpvoted: !hasUpvoted,
                upvotes: hasUpvoted ? report.upvotes - 1 : report.upvotes + 1,
              }
            : report
        )
      );
      
      // Call backend API
      if (hasUpvoted) {
        await reportService.removeUpvote(reportId);
      } else {
        await reportService.upvoteReport(reportId);
      }
      
      addNotification({
        type: 'success',
        title: hasUpvoted ? 'Dukungan Dibatalkan' : 'Laporan Didukung',
        message: hasUpvoted ? 'Dukungan Anda telah dibatalkan' : 'Terima kasih atas dukungan Anda!',
      });
    } catch (error) {
      console.error('Error upvoting report:', error);
      
      // Revert optimistic update on error
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? {
                ...report,
                hasUpvoted: hasUpvoted,
                upvotes: hasUpvoted ? report.upvotes + 1 : report.upvotes - 1,
              }
            : report
        )
      );
      
      addNotification({
        type: 'error',
        title: 'Gagal Memberikan Dukungan',
        message: error.response?.data?.message || 'Terjadi kesalahan saat memberikan dukungan',
      });
    } finally {
      setUpvotingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleCreateReport = () => {
    navigate('/create');
  };

  return (
    <div className="feed-page">
      <div className="feed-header">
        <div className="container">
          <h1 className="feed-title">Feed Laporan Publik</h1>
          <p className="feed-subtitle">Lihat dan dukung laporan warga lainnya</p>
        </div>
      </div>
      
      <div className="container">
        <div className="feed-actions">
          <Button variant="primary" onClick={handleCreateReport}>
            Buat Laporan Baru
          </Button>
        </div>
        
        {loading && page === 1 ? (
          <div className="feed-loading">
            <div className="spinner"></div>
            <p>Memuat laporan...</p>
          </div>
        ) : reports.length === 0 ? (
          <Card className="feed-empty">
            <h3>Belum Ada Laporan</h3>
            <p>Jadilah yang pertama membuat laporan!</p>
            <Button variant="primary" onClick={handleCreateReport}>
              Buat Laporan Pertama
            </Button>
          </Card>
        ) : (
          <div className="feed-list">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onUpvote={handleUpvote}
                isUpvoting={upvotingIds.has(report.id)}
              />
            ))}
            
            {hasMore && (
              <div className="feed-load-more">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  loading={loading}
                  disabled={loading}
                >
                  Muat Lebih Banyak
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ReportCard = ({ report, onUpvote, isUpvoting }) => {
  const {
    id,
    title,
    description,
    category,
    location,
    imageUrl,
    status,
    upvotes = 0,
    hasUpvoted = false,
    authorName,
    reporterName,
    isAnonymous,
    createdAt,
  } = report;
  
  const displayAuthorName = authorName || reporterName || 'Pengguna';

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} menit yang lalu`;
    } else if (diffHours < 24) {
      return `${diffHours} jam yang lalu`;
    } else if (diffDays < 7) {
      return `${diffDays} hari yang lalu`;
    } else {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  };

  return (
    <Card className="report-card" hover>
      <div className="report-card__header">
        <div className="report-card__meta">
          <span className="report-card__author">
            {isAnonymous ? 'Pelapor Anonim' : `${reporterName || authorName || 'Warga'}`}
          </span>
          <span className="report-card__dot">•</span>
          <span className="report-card__date">{formatDate(createdAt)}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      
      <div className="report-card__body">
        <h3 className="report-card__title">{title}</h3>
        
        <div className="report-card__info">
          <span className="report-card__category">Kategori: {category}</span>
          <span className="report-card__location">Lokasi: {location}</span>
        </div>
        
        <p className="report-card__description">{description}</p>
        
        {imageUrl && (
          <div className="report-card__image">
            <img src={imageUrl} alt={title} />
          </div>
        )}
      </div>
      
      <div className="report-card__footer">
        <button
          className={`upvote-btn ${hasUpvoted ? 'upvote-btn--active' : ''} ${isUpvoting ? 'upvote-btn--loading' : ''}`}
          onClick={() => onUpvote(id, hasUpvoted)}
          disabled={isUpvoting}
        >
          {isUpvoting ? (
            <span className="upvote-btn__text">
              <div className="spinner-small"></div>
              Memproses...
            </span>
          ) : (
            <span className="upvote-btn__text">
              {hasUpvoted ? '✓ Didukung' : '↑ Dukung'} ({upvotes})
            </span>
          )}
        </button>
      </div>
    </Card>
  );
};

export default Feed;
