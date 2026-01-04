import axios from 'axios';

const generateTraceId = () => {
  return `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const authApi = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json',
  },
});

const reportApi = axios.create({
  baseURL: '/api/reports',
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = reportApi;

const retryAttempts = new Map();

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Trace-Id'] = generateTraceId();
    config.headers['X-Client-Type'] = 'web-admin';

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const getRetryDelay = (retryCount) => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
    RETRY_CONFIG.maxDelay
  );
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
};

api.interceptors.response.use(
  (response) => {
    const requestKey = `${response.config.method}-${response.config.url}`;
    retryAttempts.delete(requestKey);
    return response;
  },
  async (error) => {
    const config = error.config;
    const requestKey = `${config.method}-${config.url}`;
    const attempt = (retryAttempts.get(requestKey) || 0) + 1;

    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const isRetryable =
      RETRY_CONFIG.retryableStatuses.includes(error.response?.status) ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT';

    if (isRetryable && attempt <= RETRY_CONFIG.maxRetries) {
      retryAttempts.set(requestKey, attempt);
      const delay = getRetryDelay(attempt - 1);

      console.warn(`[API] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries} for ${config.method} ${config.url} after ${delay.toFixed(0)}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return api.request(config);
    }

    retryAttempts.delete(requestKey);

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
