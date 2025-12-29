import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { notificationService } from '../../services/notificationService';
import { useNotificationStore } from '../../store/notificationStore';
import './Layout.css';

const Layout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const handleLogout = () => {
    notificationService.disconnect();
    logout();
    addNotification({
      type: 'info',
      title: 'Logout Berhasil',
      message: 'Sampai jumpa lagi!',
    });
    navigate('/login');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="container navbar-container">
          <div className="navbar-brand">
            <span className="navbar-title">Lapor Warga</span>
          </div>
          
          <div className="navbar-menu">
            <NavLink to="/feed" className={({ isActive }) => 
              `navbar-link ${isActive ? 'navbar-link--active' : ''}`
            }>
              Feed
            </NavLink>
            <NavLink to="/my-reports" className={({ isActive }) => 
              `navbar-link ${isActive ? 'navbar-link--active' : ''}`
            }>
              Laporan Saya
            </NavLink>
            <NavLink to="/create" className={({ isActive }) => 
              `navbar-link ${isActive ? 'navbar-link--active' : ''}`
            }>
              Buat Laporan
            </NavLink>
          </div>
          
          <div className="navbar-user">
            <span className="navbar-username">{user?.username || 'User'}</span>
            <button onClick={handleLogout} className="navbar-logout">
              Keluar
            </button>
          </div>
        </div>
      </nav>
      
      <main className="main-content">
        <Outlet />
      </main>
      
      <footer className="footer">
        <div className="container">
          <p className="footer-text">
            © 2025 Sistem Pelaporan Warga Kota - Microservices Architecture
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
