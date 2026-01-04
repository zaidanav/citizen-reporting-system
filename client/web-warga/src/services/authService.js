import api from '../api/client';

export const authService = {
  register: async (name, email, password, nik = '', phone = '') => {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      nik,
      phone,
    });
    return response.data.data;
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    return response.data.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data.data;
  },
};
