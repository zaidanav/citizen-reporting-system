import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { useNotificationStore } from '../../store/notificationStore';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Card from '../../components/Card';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email tidak valid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password wajib diisi';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password minimal 6 karakter';
    }
    
    if (isRegister) {
      if (!formData.name.trim()) {
        newErrors.name = 'Nama wajib diisi';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Password tidak cocok';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (isRegister) {
        // Register
        const response = await authService.register(
          formData.name,
          formData.email,
          formData.password
        );
        
        // Backend returns: { status: "success", message: "...", data: { token, name, role } }
        // Login after register
        const loginResponse = await authService.login(
          formData.email,
          formData.password
        );
        
        const userData = {
          id: loginResponse.id,
          name: loginResponse.name,
          role: loginResponse.role,
        };
        
        login(userData, loginResponse.token);
        
        addNotification({
          type: 'success',
          title: 'Registrasi Berhasil',
          message: 'Selamat datang di Lapor Warga!',
        });
      } else {
        // Login
        const response = await authService.login(
          formData.email,
          formData.password
        );
        
        const userData = {
          id: response.id,
          name: response.name,
          role: response.role,
        };
        
        login(userData, response.token);
        
        addNotification({
          type: 'success',
          title: 'Login Berhasil',
          message: `Selamat datang kembali, ${response.name}!`,
        });
      }
      
      navigate('/feed');
    } catch (error) {
      console.error('Auth error:', error);
      addNotification({
        type: 'error',
        title: isRegister ? 'Registrasi Gagal' : 'Login Gagal',
        message: error.response?.data?.message || 'Terjadi kesalahan, silakan coba lagi',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-logo">🏛️ Lapor Warga</h1>
          <p className="login-tagline">Sistem Pelaporan Warga Kota</p>
        </div>
        
        <Card className="login-card">
          <h2 className="login-title">
            {isRegister ? 'Daftar Akun Baru' : 'Masuk ke Akun Anda'}
          </h2>
          
          <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
              <Input
                label="Nama Lengkap"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Masukkan nama lengkap Anda"
                error={errors.name}
                required
              />
            )}
            
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contoh@email.com"
              error={errors.email}
              required
            />
            
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimal 6 karakter"
              error={errors.password}
              required
            />
            
            {isRegister && (
              <Input
                label="Konfirmasi Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Ulangi password Anda"
                error={errors.confirmPassword}
                required
              />
            )}
            
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              {isRegister ? 'Daftar' : 'Masuk'}
            </Button>
          </form>
          
          <div className="login-footer">
            <p className="login-switch">
              {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
              {' '}
              <button
                type="button"
                className="login-switch-btn"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErrors({});
                }}
              >
                {isRegister ? 'Masuk di sini' : 'Daftar di sini'}
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
