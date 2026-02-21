import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { safeStorage } from '../lib/storage'
import { apiClient } from '../lib/apiClient'
import { config } from '../lib/config'

declare global {
  interface Window {
    google?: any
  }
}

const LoginHeader: React.FC = () => (
  <div className="text-center mb-10">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-4">
      <span className="text-white text-2xl font-bold">IM</span>
    </div>
    <h1 className="text-3xl font-bold text-gray-900 mb-2">ISPMAX</h1>
    <p className="text-gray-600">Panel de Control para Clientes y Administradores</p>
  </div>
)

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState(safeStorage.getItem('rememberedEmail') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(!!safeStorage.getItem('rememberedEmail'))
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const { login } = useAuthStore()

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked)
    if (!e.target.checked) {
      safeStorage.removeItem('rememberedEmail')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Por favor ingresa email y contraseña')
      return
    }
    setIsLoading(true)
    try {
      if (rememberMe) {
        safeStorage.setItem('rememberedEmail', email)
      } else {
        safeStorage.removeItem('rememberedEmail')
      }
      await login(email, password)
      toast.success('¡Inicio de sesión exitoso!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Credenciales incorrectas o error en el servidor.'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const decodeJwtPayload = (jwt: string) => {
    try {
      const payload = jwt.split('.')[1]
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const json = atob(normalized)
      return JSON.parse(json)
    } catch (err) {
      console.error('[Google] Error decoding token', err)
      return null
    }
  }

  const handleGoogleCredential = async (credential: string) => {
    const data = decodeJwtPayload(credential)
    if (!data?.email) {
      toast.error('No se pudo obtener el correo de Google.')
      return
    }
    try {
      const resp = await apiClient.post('/auth/google', {
        email: data.email,
        name: data.name || data.given_name || data.email.split('@')[0],
      })
      useAuthStore.setState({ user: resp.user, token: resp.token, isAuthenticated: true })
      toast.success('Inicio de sesión con Google exitoso')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error iniciando con Google.'
      toast.error(msg)
    }
  }

  useEffect(() => {
    if (!config.GOOGLE_CLIENT_ID) return
    const initGoogle = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: config.GOOGLE_CLIENT_ID,
        callback: (response: any) => handleGoogleCredential(response.credential),
      })
      setIsGoogleReady(true)
    }
    if (window.google?.accounts?.id) {
      initGoogle()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogle
    script.onerror = () => console.warn('[Google] No se pudo cargar el script de Google Identity')
    document.body.appendChild(script)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><EnvelopeIcon className="h-5 w-5 text-gray-400" /></div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="usuario@ejemplo.com" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockClosedIcon className="h-5 w-5 text-gray-400" /></div>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPassword ? <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={handleRememberMeChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">Recordarme</label>
        </div>
        <button type="button" onClick={() => toast('La funcionalidad de recuperación de contraseña está en desarrollo.')} className="text-sm font-medium text-blue-600 hover:text-blue-500">¿Olvidaste tu contraseña?</button>
      </div>
      <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
        {isLoading ? (
          <div className="flex items-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>Iniciando sesión...</div>
        ) : (
          'Iniciar Sesión'
        )}
      </button>

      {config.GOOGLE_CLIENT_ID && (
        <button
          type="button"
          onClick={() => window.google?.accounts?.id?.prompt()}
          disabled={!isGoogleReady}
          className="w-full mt-4 flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
          {isGoogleReady ? 'Continuar con Google' : 'Cargando Google...'}
        </button>
      )}
    </form>
  )
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <LoginHeader />

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Iniciar Sesión</h2>
          <LoginForm />

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              ¿No tienes una cuenta?{' '}
              <button
                type="button"
                onClick={() => toast.success('Por favor, contacta a soporte para crear una cuenta.')}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Contacta a tu proveedor
              </button>
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl mb-2">⚡</div>
            <p className="text-xs font-medium text-gray-700">Prueba de Velocidad 4K</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl mb-2">💳</div>
            <p className="text-xs font-medium text-gray-700">Pagos en 1-Clic</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl mb-2">🤖</div>
            <p className="text-xs font-medium text-gray-700">Soporte IA 24/7</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl mb-2">📱</div>
            <p className="text-xs font-medium text-gray-700">App Móvil</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ISPMAX. Todos los derechos reservados.</p>
          <p className="mt-1">
            <a href="#" className="hover:text-gray-700">Términos</a> • 
            <a href="#" className="hover:text-gray-700 mx-2">Privacidad</a> • 
            <a href="#" className="hover:text-gray-700">Soporte</a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
