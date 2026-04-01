import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CustomerFormPage from './pages/CustomerFormPage';
import EstimatesPage from './pages/EstimatesPage';
import EstimateDetailPage from './pages/EstimateDetailPage';
import EstimateFormPage from './pages/EstimateFormPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import JobFormPage from './pages/JobFormPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import SalesOrderDetailPage from './pages/SalesOrderDetailPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/estimates/new" element={<EstimateFormPage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="/estimates/:id/edit" element={<EstimateFormPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<JobFormPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage />} />
          <Route path="/sales-orders" element={<SalesOrdersPage />} />
          <Route path="/sales-orders/:id" element={<SalesOrderDetailPage />} />
          {/* Enhanced features coming next */}
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
