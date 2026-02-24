import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type ProtectedRouteProps = {
  children: React.ReactElement
  adminOnly?: boolean
  allowedRoles?: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
  allowedRoles,
}) => {
  const { isAuthenticated, user } = useAuthStore()
  const roleHome = user?.role === 'platform_admin' ? '/platform' : user?.role === 'admin' ? '/admin' : '/dashboard'

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role))) {
    return <Navigate to={roleHome} replace />
  }

  if (adminOnly && !['admin', 'platform_admin'].includes(user?.role || '')) {
    return <Navigate to={roleHome} replace />
  }

  return children
}

export default ProtectedRoute
