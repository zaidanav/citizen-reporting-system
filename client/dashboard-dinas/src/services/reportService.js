import api from '../api/client';
import { getDepartmentFromStorage } from '../utils/jwtHelper';

export const reportService = {
  // Get all reports with filtering
  getAllReports: async (filters = {}) => {
    try {
      const department = getDepartmentFromStorage();
      const response = await api.get('/admin/reports', {
        params: filters,
        headers: {
          'X-Department': department,
        },
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
      // Status is already in uppercase format (PENDING, IN_PROGRESS, RESOLVED)
      const response = await api.put(`/admin/reports/${reportId}`, {
        status: status,
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
      const department = getDepartmentFromStorage();
      const response = await api.get('/admin/analytics', {
        params: { timeRange },
        headers: {
          'X-Department': department,
        },
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

  // Forward report to external system
  forwardReport: async (reportId, forwardTo, notes = '') => {
    try {
      const response = await api.post(`/admin/reports/forward/${reportId}`, {
        forwardTo,
        notes,
      });
      console.log('[Service] Forward report response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Service] Failed to forward report:', error);
      throw error;
    }
  },

  // Get escalated reports (reports needing attention)
  getEscalatedReports: async (filter = 'all') => {
    try {
      const department = getDepartmentFromStorage();
      const response = await api.get('/admin/reports/escalation', {
        params: { filter },
        headers: {
          'X-Department': department,
        },
      });
      console.log('[Service] Escalated reports response:', response.data);
      return response.data.data || [];
    } catch (error) {
      console.error('[Service] Failed to fetch escalated reports:', error);
      throw error;
    }
  },

  // Escalate report to higher authority
  escalateReport: async (reportId) => {
    try {
      const response = await api.post(`/admin/reports/escalate/${reportId}`);
      console.log('[Service] Escalate report response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[Service] Failed to escalate report:', error);
      throw error;
    }
  },
};
