import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type ProtectedRouteProps = {
  children: React.ReactElement
  adminOnly?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
}) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !['admin', 'platform_admin'].includes(user?.role || '')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
