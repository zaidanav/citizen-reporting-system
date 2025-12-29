import api from '../api/client';

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
    return response.data.data;
  },
  
  // Get user's own reports
  getMyReports: async (page = 1, limit = 20, status = '') => {
    const params = { page, limit };
    if (status) params.status = status;
    const response = await api.get('/reports/mine', { params });
    console.log('[Service] My reports backend response:', response.data);
    // Backend returns: { status: "success", message: "...", data: [reports] }
    return response.data.data;
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
