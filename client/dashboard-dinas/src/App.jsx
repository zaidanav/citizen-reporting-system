import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useNotificationSubscription from './hooks/useNotificationSubscription';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Escalation from './pages/Escalation';
import Performance from './pages/Performance';
import Login from './pages/Login';
import Layout from './components/Layout';
import { getAccessRoleFromStorage, getRoleFromStorage } from './utils/jwtHelper';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return !!localStorage.getItem('admin_token');
  });

  useNotificationSubscription();

  const accessRole = getAccessRoleFromStorage();
  const isStrategic = accessRole === 'strategic';

  const role = getRoleFromStorage();
  const isSuperAdmin = role === 'super-admin';

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
          <Route path="escalation" element={<Escalation />} />
          {/* Analytics only for strategic role */}
          <Route path="analytics" element={
            isStrategic ? <Analytics /> : <Navigate to="/dashboard" replace />
          } />

          {/* Cross-department performance only for super-admin */}
          <Route path="performance" element={
            isSuperAdmin ? <Performance /> : <Navigate to="/dashboard" replace />
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
