import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getAccessRoleFromStorage } from '../../utils/jwtHelper';
import './Layout.css';

const Layout = ({ setAuth }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const accessRole = getAccessRoleFromStorage();
  const isStrategic = accessRole === 'strategic';

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAuth(false);
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      <nav className="admin-navbar">
        <div className="admin-navbar-container">
          <div className="admin-navbar-brand">
            <span className="admin-navbar-logo">🏛️</span>
            <span className="admin-navbar-title">Dashboard Dinas</span>
            {isStrategic && (
              <span className="admin-navbar-badge">Strategis</span>
            )}
          </div>
          
          <div className="admin-navbar-menu">
            <NavLink to="/dashboard" className={({ isActive }) => 
              `admin-navbar-link ${isActive ? 'admin-navbar-link--active' : ''}`
            }>
              📊 Dashboard
            </NavLink>
            <NavLink to="/escalation" className={({ isActive }) => 
              `admin-navbar-link ${isActive ? 'admin-navbar-link--active' : ''}`
            }>
              ⚠️ Eskalasi
            </NavLink>
            {isStrategic && (
              <NavLink to="/analytics" className={({ isActive }) => 
                `admin-navbar-link ${isActive ? 'admin-navbar-link--active' : ''}`
              }>
                📈 Analitik
              </NavLink>
            )}
          </div>
          
          <div className="admin-navbar-user">
            <span className="admin-navbar-username">👤 {user?.name || 'Admin'}</span>
            <button onClick={handleLogout} className="admin-navbar-logout">
              Keluar
            </button>
          </div>
        </div>
      </nav>
      
      <main className="admin-main-content">
        <Outlet />
      </main>
      
      <footer className="admin-footer">
        <p className="admin-footer-text">
          © 2025 Dashboard Dinas - Sistem Pelaporan Warga Kota
        </p>
      </footer>
    </div>
  );
};

export default Layout;
