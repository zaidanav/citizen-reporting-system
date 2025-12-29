import axios from 'axios';

// Generate unique trace ID for observability
const generateTraceId = () => {
  return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// API instance with interceptors for authentication and tracing
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track retry attempts per request
const retryAttempts = new Map();

// Request interceptor - Add auth token and trace ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add trace ID for observability
    config.headers['X-Trace-Id'] = generateTraceId();
    config.headers['X-Client-Type'] = 'web-citizen';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Utility function to convert snake_case to camelCase
const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

// Utility function to recursively convert object keys from snake_case to camelCase
const convertKeysToCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelCaseKey = toCamelCase(key);
      result[camelCaseKey] = convertKeysToCamelCase(obj[key]);
      return result;
    }, {});
  }
  return obj;
};

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

// Response interceptor - Handle errors, retry, and convert snake_case to camelCase
api.interceptors.response.use(
  (response) => {
    // Transform report data from snake_case to camelCase
    if (response.data && response.data.data) {
      console.log('[API] Raw response before transformation:', response.data.data);
      if (Array.isArray(response.data.data)) {
        response.data.data = response.data.data.map(item => {
          const converted = convertKeysToCamelCase(item);
          console.log('🔄 Single item converted:', { original: item, converted });
          return converted;
        });
      } else if (typeof response.data.data === 'object') {
        response.data.data = convertKeysToCamelCase(response.data.data);
      }
      console.log('[API] Response after transformation:', response.data.data);
    }
    
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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

export default api;
