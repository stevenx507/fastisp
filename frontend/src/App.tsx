import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './contexts/ThemeContext'
import Login from './pages/Login'
import ClientDashboard from './pages/ClientDashboard'
import BillingPortal from './pages/BillingPortal'
import AdminPanel from './pages/AdminPanel'
import TechApp from './pages/TechApp'
import ClientUsage from './pages/ClientUsage'
import ClientSupport from './pages/ClientSupport'
import ClientProfile from './pages/ClientProfile'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/ProtectedRoute'


function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <ThemeProvider>
        <div className="app-shell min-h-screen">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute><BillingPortal /></ProtectedRoute>} />
            <Route path="/dashboard/usage" element={<ProtectedRoute><ClientUsage /></ProtectedRoute>} />
            <Route path="/dashboard/support" element={<ProtectedRoute><ClientSupport /></ProtectedRoute>} />
            <Route path="/dashboard/profile" element={<ProtectedRoute><ClientProfile /></ProtectedRoute>} />
            <Route path="/tech" element={<ProtectedRoute><TechApp /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          </Routes>
        </div>
    </ThemeProvider>
  )
}

export default App
