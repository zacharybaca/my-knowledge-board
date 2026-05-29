import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

const AdminRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="spinner"></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Type Coercion: Handle both legacy string caches and new array formats
  const userRoles = Array.isArray(user.role) ? user.role : [user.role];

  // Evaluate authorization
  if (userRoles.includes('Manager') || userRoles.includes('Admin')) {
    return <Outlet />;
  }

  return <Navigate to="/employee-dashboard" replace />;
};

export default AdminRoute;
