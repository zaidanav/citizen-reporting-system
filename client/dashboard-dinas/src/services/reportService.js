import api from '../api/client';

export const reportService = {
  // Get all reports with filtering
  getAllReports: async (filters = {}) => {
    const response = await api.get('/admin/reports', {
      params: filters,
    });
    return response.data;
  },
  
  // Get reports by department
  getReportsByDepartment: async (department, status) => {
    const response = await api.get('/admin/reports/department', {
      params: { department, status },
    });
    return response.data;
  },
  
  // Update report status
  updateReportStatus: async (reportId, status, notes) => {
    const response = await api.put(`/admin/reports/${reportId}/status`, {
      status,
      notes,
    });
    return response.data;
  },
  
  // Get analytics data
  getAnalytics: async (timeRange = '30d') => {
    const response = await api.get('/admin/analytics', {
      params: { timeRange },
    });
    return response.data;
  },
  
  // Get report details
  getReportById: async (reportId) => {
    const response = await api.get(`/admin/reports/${reportId}`);
    return response.data;
  },
};
