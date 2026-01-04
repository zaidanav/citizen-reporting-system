import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { notificationService } from './services/notificationService';
import useNotificationSubscription from './hooks/useNotificationSubscription';
import Toast from './components/Toast';
import Login from './pages/Login';
import Feed from './pages/Feed';
import MyReports from './pages/MyReports';
import CreateReport from './components/CreateReport';
import Layout from './components/Layout';

function App() {
  const { isAuthenticated, token } = useAuthStore();

  useNotificationSubscription();

  useEffect(() => {
    if (isAuthenticated && token) {
      notificationService.connect(token);
    }

    return () => {
      notificationService.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/feed" replace /> : <Login />
        } />

        {/* All app routes use Layout */}
        <Route element={<Layout />}>
          {/* Public route - Feed */}
          <Route path="/feed" element={<Feed />} />

          {/* Protected routes */}
          <Route path="/my-reports" element={
            isAuthenticated ? <MyReports /> : <Navigate to="/login" replace />
          } />
          <Route path="/create" element={
            isAuthenticated ? <CreateReportPage /> : <Navigate to="/login" replace />
          } />
        </Route>

        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const CreateReportPage = () => {
  return (
    <div style={{ padding: '24px 0' }}>
      <div className="container">
        <CreateReport />
      </div>
    </div>
  );
};

export default App;
