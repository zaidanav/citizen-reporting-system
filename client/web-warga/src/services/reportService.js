import api from '../api/client';

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

  // Fallback to backend value if it already matches expected enum
  if (normalized === 'PENDING' || normalized === 'IN_PROGRESS' || normalized === 'RESOLVED' || normalized === 'REJECTED') {
    return normalized;
  }

  return 'PENDING';
};

const normalizeReport = (report) => {
  if (!report || typeof report !== 'object') return report;
  return {
    ...report,
    status: normalizeStatus(report.status),
  };
};

export const reportService = {
  // Create new report
  createReport: async (reportData) => {
    console.log('[Service] Creating report with data:', reportData);
    const response = await api.post('/reports', reportData);
    console.log('[Service] Report created, backend response:', response.data);
    // Backend returns: { status: "success", message: "...", data: report }
    return response.data.data;
  },
  
  // Get public reports feed
  getPublicReports: async (page = 1, limit = 20) => {
    const response = await api.get('/reports', {
      params: { page, limit },
    });
    console.log('[Service] Public reports backend response:', response.data);
    // Backend returns: { status: "success", message: "...", data: [reports] }
    const reports = response.data.data;
    return Array.isArray(reports) ? reports.map(normalizeReport) : [];
  },
  
  // Get user's own reports
  getMyReports: async (page = 1, limit = 20, status = '') => {
    const params = { page, limit };
    if (status) params.status = status;
    const response = await api.get('/reports/mine', { params });
    console.log('[Service] My reports backend response:', response.data);
    // Backend returns: { status: "success", message: "...", data: [reports] }
    const reports = response.data.data;
    return Array.isArray(reports) ? reports.map(normalizeReport) : [];
  },
  
  // Get report by ID
  getReportById: async (id) => {
    const response = await api.get(`/reports/${id}`);
    // Backend returns: { status: "success", message: "...", data: report }
    return response.data.data;
  },
  
  // Upvote a report
  upvoteReport: async (reportId) => {
    const response = await api.post(`/reports/${reportId}/upvote`);
    // Backend returns: { status: "success", message: "...", data: ... }
    return response.data.data;
  },
  
  // Remove upvote
  removeUpvote: async (reportId) => {
    const response = await api.delete(`/reports/${reportId}/upvote`);
    // Backend returns: { status: "success", message: "...", data: ... }
    return response.data.data;
  },
  
  // Upload image
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await api.post('/reports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
