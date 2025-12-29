import api from '../api/client';

export const authService = {
  // Register new user
  register: async (name, email, password, nik = '', phone = '') => {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      nik,
      phone,
    });
    // Backend returns: { status: "success", message: "...", data: { token, name, role } }
    return response.data.data;
  },
  
  // Login user
  login: async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    // Backend returns: { status: "success", message: "...", data: { token, name, role } }
    return response.data.data;
  },
  
  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/auth/me');
    // Backend returns: { status: "success", message: "...", data: user }
    return response.data.data;
  },
};
