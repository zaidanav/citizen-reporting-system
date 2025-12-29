import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useNotificationSubscription from './hooks/useNotificationSubscription';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Layout from './components/Layout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return !!localStorage.getItem('admin_token');
  });

  // Subscribe to real-time notifications
  useNotificationSubscription();

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login setAuth={setIsAuthenticated} />
        } />
        
        <Route path="/" element={
          isAuthenticated ? <Layout setAuth={setIsAuthenticated} /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
