import axios from 'axios';

const generateTraceId = () => {
  return `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Create separate instances for different services
const authApi = axios.create({
  baseURL: 'http://localhost:8081',
  headers: {
    'Content-Type': 'application/json',
  },
});

const reportApi = axios.create({
  baseURL: 'http://localhost:8082',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Default export for backwards compatibility - uses report API for admin endpoints
const api = reportApi;

// Track retry attempts per request
const retryAttempts = new Map();

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add department header from localStorage
    const adminUser = localStorage.getItem('admin_user');
    if (adminUser) {
      try {
        const user = JSON.parse(adminUser);
        if (user.department) {
          config.headers['X-Department'] = user.department;
        }
      } catch (e) {
        console.warn('Failed to parse admin_user from localStorage');
      }
    }
    
    config.headers['X-Trace-Id'] = generateTraceId();
    config.headers['X-Client-Type'] = 'web-admin';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Exponential backoff delay calculation
const getRetryDelay = (retryCount) => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
    RETRY_CONFIG.maxDelay
  );
  // Add jitter: ±10%
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
};

api.interceptors.response.use(
  (response) => {
    // Clear retry attempts on success
    const requestKey = `${response.config.method}-${response.config.url}`;
    retryAttempts.delete(requestKey);
    return response;
  },
  async (error) => {
    const config = error.config;
    const requestKey = `${config.method}-${config.url}`;
    const attempt = (retryAttempts.get(requestKey) || 0) + 1;

    // Handle 401 - auth error, no retry
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Check if request is retryable
    const isRetryable = 
      RETRY_CONFIG.retryableStatuses.includes(error.response?.status) ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT';

    // Retry logic
    if (isRetryable && attempt <= RETRY_CONFIG.maxRetries) {
      retryAttempts.set(requestKey, attempt);
      const delay = getRetryDelay(attempt - 1);
      
      console.warn(`[API] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} for ${config.method} ${config.url} after ${delay.toFixed(0)}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return api.request(config);
    }

    // Clear retry attempts on final failure
    retryAttempts.delete(requestKey);

    // Log final error
    console.error('[API] Request failed after retries:', {
      status: error.response?.status,
      url: config.url,
      attempts: attempt,
    });

    return Promise.reject(error);
  }
);

export { authApi, reportApi };
export default api;
