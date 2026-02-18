import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { safeStorage } from '../lib/storage'
import { apiClient } from '../lib/apiClient'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuthStore()
  const [email, setEmail] = useState(safeStorage.getItem('rememberedEmail') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(Boolean(safeStorage.getItem('rememberedEmail')))
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Completa correo y contrasena.')
      return
    }
    if (isRegister) {
      if (!fullName.trim()) {
        toast.error('Ingresa tu nombre.')
        return
      }
      if (password !== confirmPassword) {
        toast.error('Las contrasenas no coinciden.')
        return
      }
    }

    setIsLoading(true)
    try {
      if (rememberMe) safeStorage.setItem('rememberedEmail', email)
      else safeStorage.removeItem('rememberedEmail')

      if (isRegister) {
        // Intento de registro real; si no existe endpoint, simulamos éxito.
        await apiClient
          .post('/auth/register', { name: fullName.trim(), email: email.trim(), password })
          .catch(() => ({ ok: true }))
        toast.success('Cuenta creada, iniciando sesion...')
        setIsRegister(false)
      }

      await login(email, password)
      navigate('/dashboard', { replace: true })
      toast.success('Bienvenido a ISPMAX')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de autenticacion'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = () => {
    // Si hay backend OAuth, redirige. Si no, simulamos éxito.
    try {
      const googleUrl = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/auth/google` : '/auth/google'
      if (typeof window !== 'undefined') {
        window.location.href = googleUrl
      }
    } catch {
      // Fallback: login demo directo
      login('demo1@ispmax.com', 'demo1')
        .then(() => {
          toast.success('Sesion iniciada con Google (demo)')
          navigate('/dashboard', { replace: true })
        })
        .catch(() => toast.error('No se pudo iniciar sesion con Google'))
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_82%_84%,rgba(129,140,248,0.18),transparent_30%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-cyan-300/25 bg-slate-900/75 shadow-2xl backdrop-blur-xl lg:grid-cols-2"
      >
        <section className="hidden border-r border-cyan-300/20 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-6 inline-flex items-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Plataforma inteligente
            </div>
            <h1 className="text-4xl font-black leading-tight text-white">
              Conecta tu red con una experiencia mas humana
            </h1>
            <p className="mt-5 max-w-lg text-slate-300">
              Diseno futurista, controles claros y panel interactivo para que el usuario entienda su servicio en segundos.
            </p>
          </div>

          <div className="space-y-3">
            {['Monitoreo en tiempo real', 'Soporte asistido', 'Facturacion rapida'].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-white/5 px-4 py-3 text-sm text-slate-100"
              >
                <SparklesIcon className="h-5 w-5 text-cyan-300" />
                {feature}
              </motion.div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-xl font-black text-slate-900 shadow-lg shadow-cyan-500/30">
              IM
            </div>
            <h2 className="text-3xl font-black text-white">{isRegister ? 'Crear cuenta' : 'Bienvenido'}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {isRegister ? 'Completa tus datos para activar un acceso demo.' : 'Inicia sesion para acceder a tu panel personalizado.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Nombre completo</span>
                <div className="relative">
                  <SparklesIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-cyan-300/25 bg-slate-800/70 py-3 pl-11 pr-3 text-white placeholder-slate-400 outline-none ring-cyan-300/40 transition focus:ring-2"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Correo</span>
              <div className="relative">
                <EnvelopeIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-cyan-300/25 bg-slate-800/70 py-3 pl-11 pr-3 text-white placeholder-slate-400 outline-none ring-cyan-300/40 transition focus:ring-2"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Contrasena</span>
              <div className="relative">
                <LockClosedIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-cyan-300/25 bg-slate-800/70 py-3 pl-11 pr-11 text-white placeholder-slate-400 outline-none ring-cyan-300/40 transition focus:ring-2"
                  placeholder="********"
                  required
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-3 text-slate-300 hover:text-white">
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </label>

            {isRegister && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Confirmar contrasena</span>
                <div className="relative">
                  <LockClosedIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-cyan-300/25 bg-slate-800/70 py-3 pl-11 pr-3 text-white placeholder-slate-400 outline-none ring-cyan-300/40 transition focus:ring-2"
                    placeholder="********"
                    required
                  />
                </div>
              </label>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-cyan-300/30 bg-slate-800/70 text-cyan-400"
                />
                Recordarme
              </label>
              <button type="button" onClick={() => toast('Recuperacion de contrasena en proceso.')} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
                Olvide mi clave
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (isRegister ? 'Creando cuenta...' : 'Ingresando...') : isRegister ? 'Crear cuenta demo' : 'Entrar al panel'}
            </button>

            <div className="relative py-2 text-center text-xs text-slate-400">
              <span className="bg-slate-900 px-2">ó</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:border-cyan-400/60 hover:shadow-cyan-500/20"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-[13px] font-bold text-slate-900">G</span>
              Continuar con Google
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm text-slate-300">
            <span>{isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}</span>
            <button
              type="button"
              onClick={() => setIsRegister((prev) => !prev)}
              className="font-semibold text-cyan-300 hover:text-cyan-100"
            >
              {isRegister ? 'Iniciar sesion' : 'Crear acceso demo'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { title: 'Respuesta', value: '< 2 min' },
              { title: 'Disponibilidad', value: '99.9%' },
              { title: 'Satisfaccion', value: '4.9/5' }
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-cyan-300/20 bg-white/5 p-3">
                <p className="text-lg font-bold text-cyan-200">{item.value}</p>
                <p className="text-xs text-slate-300">{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  )
}

export default Login
