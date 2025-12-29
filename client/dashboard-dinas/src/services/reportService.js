import api from '../api/client';

export const reportService = {
  // Get all reports with filtering
  getAllReports: async (filters = {}) => {
    try {
      const response = await api.get('/admin/reports', {
        params: filters,
      });
      console.log('[Service] Admin reports response:', response.data);
      // Return the data from response structure
      return response.data.data || [];
    } catch (error) {
      console.error('[Service] Failed to fetch admin reports:', error);
      throw error;
    }
  },
  
  // Update report status
  updateReportStatus: async (reportId, status, notes = '') => {
    try {
      const response = await api.put(`/api/reports/${reportId}`, {
        status,
        notes,
      });
      console.log('[Service] Update status response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Service] Failed to update status:', error);
      throw error;
    }
  },
  
  // Get analytics data
  getAnalytics: async (timeRange = '30d') => {
    try {
      const response = await api.get('/admin/analytics', {
        params: { timeRange },
      });
      console.log('[Service] Analytics response:', response.data);
      // Backend returns: { status: "success", message: "...", data: analyticsData }
      return response.data;
    } catch (error) {
      console.error('[Service] Failed to fetch analytics:', error);
      // Return mock data for demo
      return {
        status: 'success',
        data: {
          total: 100,
          pending: 25,
          inProgress: 30,
          completed: 45,
          completionRate: 75,
          totalUpvotes: 450,
          avgProcessTime: 3.5,
        }
      };
    }
  },
};
