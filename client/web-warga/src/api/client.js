import axios from 'axios';

const generateTraceId = () => {
  return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const retryAttempts = new Map();

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Trace-Id'] = generateTraceId();
    config.headers['X-Client-Type'] = 'web-citizen';

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

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

    const requestKey = `${response.config.method}-${response.config.url}`;
    retryAttempts.delete(requestKey);

    return response;
  },
  async (error) => {
    const config = error.config;
    const requestKey = `${config.method}-${config.url}`;
    const attempt = (retryAttempts.get(requestKey) || 0) + 1;

    if (error.response?.status === 401) {
      console.error("[API] 401 Unauthorized detected");
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

export default api;
