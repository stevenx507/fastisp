import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './contexts/ThemeContext'
import Login from './pages/Login'
import ClientDashboard from './pages/ClientDashboard'
import AdminPanel from './pages/AdminPanel'
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
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
          </Routes>
        </div>
    </ThemeProvider>
  )
}

export default App
