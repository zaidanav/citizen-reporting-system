import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { notificationService } from './services/notificationService';
import Toast from './components/Toast';
import Login from './pages/Login';
import Feed from './pages/Feed';
import MyReports from './pages/MyReports';
import CreateReport from './components/CreateReport';
import Layout from './components/Layout';

function App() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    // Connect WebSocket on app load if authenticated
    if (isAuthenticated && token) {
      notificationService.connect(token);
    }

    // Cleanup on unmount
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
        
        <Route path="/" element={
          isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/feed" replace />} />
          <Route path="feed" element={<Feed />} />
          <Route path="my-reports" element={<MyReports />} />
          <Route path="create" element={<CreateReportPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
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
