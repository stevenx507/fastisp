import React, { useCallback, useEffect, useState } from 'react'
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
  <div className="flex flex-col gap-3 text-left">
    <div className="inline-flex items-center gap-3 rounded-2xl px-4 py-2 bg-white/10 ring-1 ring-white/20 backdrop-blur">
      <span className="text-white/80 text-xs font-semibold uppercase tracking-[0.2em]">FastISP Cloud</span>
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
    </div>
    <h1 className="text-4xl font-black text-white leading-tight">
      Conecta, gestiona <br /> y escala tu red ISP
    </h1>
    <p className="text-lg text-white/80 max-w-xl">
      Portal unificado para operaciones, soporte y clientes finales. Control total de facturación, monitoreo y aprovisionamiento sin fricción.
    </p>
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

  const handleGoogleCredential = useCallback(async (credential: string) => {
    if (!credential) {
      toast.error('No se recibio token de Google.')
      return
    }
    try {
      const resp = await apiClient.post('/auth/google', {
        credential,
      })
      useAuthStore.setState({ user: resp.user, token: resp.token, isAuthenticated: true })
      toast.success('Inicio de sesion con Google exitoso')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error iniciando con Google.'
      toast.error(msg)
    }
  }, [])


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
  }, [handleGoogleCredential])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">Correo electrónico</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><EnvelopeIcon className="h-5 w-5 text-gray-500" /></div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder:text-white/50 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
            placeholder="usuario@ejemplo.com"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-2">Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockClosedIcon className="h-5 w-5 text-gray-500" /></div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-10 pr-12 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder:text-white/50 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-colors"
            placeholder="••••••••"
            required
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {showPassword ? <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-white" /> : <EyeIcon className="h-5 w-5 text-gray-400 hover:text-white" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={handleRememberMeChange}
            className="h-4 w-4 text-emerald-400 focus:ring-emerald-400 border-white/20 bg-white/10 rounded"
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-white">Recordarme</label>
        </div>
        <button
          type="button"
          onClick={() => toast('La funcionalidad de recuperación de contraseña está en desarrollo.')}
          className="text-sm font-medium text-emerald-300 hover:text-white"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-300 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Iniciando sesión...
          </div>
        ) : (
          'Iniciar sesión'
        )}
      </button>

      {config.GOOGLE_CLIENT_ID && (
        <button
          type="button"
          onClick={() => window.google?.accounts?.id?.prompt()}
          disabled={!isGoogleReady}
          className="w-full mt-4 flex justify-center items-center gap-2 py-3 px-4 border border-white/20 rounded-xl shadow-md text-sm font-medium text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-300 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white">
      <div className="absolute inset-0 opacity-60 blur-3xl" aria-hidden>
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/30" />
        <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-blue-600/20" />
        <div className="absolute left-20 bottom-0 h-64 w-64 rounded-full bg-teal-400/20" />
      </div>

      <div className="relative grid lg:grid-cols-5 min-h-screen">
        <div className="lg:col-span-3 flex items-center px-8 lg:px-16 py-12">
          <LoginHeader />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2 flex items-center justify-center px-6 lg:px-10 py-12"
        >
          <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-white/60">Acceso seguro</p>
                <h2 className="text-2xl font-bold">Iniciar sesión</h2>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold">ISP</div>
            </div>
            <LoginForm />
            <div className="mt-8 text-center text-sm text-white/70">
              ¿No tienes una cuenta?
              <button
                type="button"
                onClick={() => toast.success('Por favor, contacta a soporte para crear una cuenta.')}
                className="ml-1 font-semibold text-emerald-300 hover:text-white"
              >
                Contacta a tu proveedor
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 px-6 lg:px-12">
        <div className="flex flex-wrap gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">• Monitoreo NOC en vivo</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">• Scripts rápidos Mikrotik/OLT</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">• Pagos y facturación integrados</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">• App móvil tech</span>
        </div>
      </div>
    </div>
  )
}

export default Login
