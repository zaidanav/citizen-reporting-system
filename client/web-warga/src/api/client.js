import axios from 'axios';

// Generate unique trace ID for observability
const generateTraceId = () => {
  return `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// API instance with interceptors for authentication and tracing
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor - Handle errors and convert snake_case to camelCase
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
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
