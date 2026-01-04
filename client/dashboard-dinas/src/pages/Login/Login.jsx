import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ setAuth }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [department, setDepartment] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const departmentOptions = [
    'General',
    'Kebersihan',
    'Pekerjaan Umum',
    'Penerangan Jalan',
    'Lingkungan Hidup',
    'Perhubungan',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('Email dan password wajib diisi');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login gagal');
      }

      const data = await response.json();
      const { token, id, name, role, department: apiDepartment, access_role } = data.data;

      const user = {
        id: id,
        email: formData.email,
        name: name,
        role: role,
        department: apiDepartment || department,
        access_role: access_role || 'operational',
      };

      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));

      setAuth(true);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Login gagal. Periksa email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h1 className="admin-login-logo">Dashboard Dinas</h1>
          <p className="admin-login-tagline">Sistem Pelaporan Warga Kota</p>
        </div>

        <div className="admin-login-card">
          <h2 className="admin-login-title">Login Administrator</h2>

          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-login-form">
            <div className="admin-form-group">
              <label htmlFor="email" className="admin-form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@dinas.go.id"
                className="admin-form-input"
                required
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="password" className="admin-form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="admin-form-input"
                required
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="department" className="admin-form-label">
                Departemen
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="admin-form-input"
              >
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
