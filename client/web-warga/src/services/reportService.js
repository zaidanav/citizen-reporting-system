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
  createReport: async (reportData) => {
    console.log('[Service] Creating report with data:', reportData);
    const response = await api.post('/reports', reportData);
    console.log('[Service] Report created, backend response:', response.data);
    return response.data.data;
  },

  getPublicReports: async (page = 1, limit = 20) => {
    const response = await api.get('/reports', {
      params: { page, limit },
    });
    console.log('[Service] Public reports backend response:', response.data);
    const reports = response.data.data;
    return Array.isArray(reports) ? reports.map(normalizeReport) : [];
  },

  getMyReports: async (page = 1, limit = 20, status = '') => {
    const params = { page, limit };
    if (status) params.status = status;
    const response = await api.get('/reports/mine', { params });
    console.log('[Service] My reports backend response:', response.data);
    const reports = response.data.data;
    return Array.isArray(reports) ? reports.map(normalizeReport) : [];
  },

  getReportById: async (id) => {
    const response = await api.get(`/reports/${id}`);
    return response.data.data;
  },

  upvoteReport: async (reportId) => {
    const response = await api.post(`/reports/${reportId}/upvote`);
    return response.data.data;
  },

  removeUpvote: async (reportId) => {
    const response = await api.delete(`/reports/${reportId}/upvote`);
    return response.data.data;
  },

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
