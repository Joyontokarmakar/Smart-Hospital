import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Tests from './pages/Tests';
import Logs from './pages/Logs';
import Patients from './pages/Patients';
import Billing from './pages/Billing';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import { PrivateRoute } from './components/PrivateRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route 
              path="users" 
              element={
                <PrivateRoute allowedRoles={['super_admin', 'diag_manager']}>
                  <Users />
                </PrivateRoute>
              } 
            />
            <Route 
              path="tests" 
              element={
                <PrivateRoute allowedRoles={['super_admin', 'diag_manager']}>
                  <Tests />
                </PrivateRoute>
              } 
            />
            <Route 
              path="logs" 
              element={
                <PrivateRoute allowedRoles={['super_admin', 'diag_manager']}>
                  <Logs />
                </PrivateRoute>
              } 
            />
            <Route 
              path="patients" 
              element={
                <PrivateRoute allowedRoles={['receptionist', 'doctor']}>
                  <Patients />
                </PrivateRoute>
              } 
            />
            <Route 
              path="billing/*" 
              element={
                <PrivateRoute allowedRoles={['receptionist', 'super_admin']}>
                  <Billing />
                </PrivateRoute>
              } 
            />
            <Route 
              path="appointments/*" 
              element={
                <PrivateRoute allowedRoles={['receptionist', 'doctor']}>
                  <Appointments />
                </PrivateRoute>
              } 
            />
            <Route 
              path="reports" 
              element={
                <PrivateRoute allowedRoles={['super_admin', 'diag_manager', 'account_manager']}>
                  <Reports />
                </PrivateRoute>
              } 
            />
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
