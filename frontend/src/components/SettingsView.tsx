import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import {
  BellIcon,
  LockClosedIcon,
  UserIcon,
  CogIcon,
  ArrowLeftOnRectangleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const SettingsView: React.FC = () => {
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'preferences' | 'security' | 'account'>('preferences')
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsAlerts: false,
    weeklyReport: true,
    maintenanceAlerts: true,
    autoBackup: true
  })

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Simular guardado
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Configuración guardada correctamente')
    } catch (error) {
      toast.error('Error al guardar configuración')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    
    setIsSaving(true)
    try {
      // Simular cambio de contraseña
      await new Promise(resolve => setTimeout(resolve, 1000))
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Contraseña actualizada correctamente')
    } catch (error) {
      toast.error('Error al cambiar contraseña')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const tabs = [
    { id: 'preferences', name: 'Preferencias', icon: BellIcon },
    { id: 'security', name: 'Seguridad', icon: LockClosedIcon },
    { id: 'account', name: 'Cuenta', icon: UserIcon }
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id as any
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition border-b-2 ${
                isActive
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.name}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow p-6"
      >
        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notificaciones</h3>
              <div className="space-y-4">
                {[
                  { key: 'emailNotifications', label: 'Notificaciones por Email', description: 'Recibe actualizaciones importantes por correo' },
                  { key: 'smsAlerts', label: 'Alertas por SMS', description: 'Recibe alertas críticas por mensaje de texto' },
                  { key: 'weeklyReport', label: 'Reporte Semanal', description: 'Resume semanal de actividad y estadísticas' },
                  { key: 'maintenanceAlerts', label: 'Alertas de Mantenimiento', description: 'Notificaciones sobre mantenimiento programado' },
                  { key: 'autoBackup', label: 'Backup Automático', description: 'Realiza backups automáticos diarios' }
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof typeof settings]}
                      onChange={(e) => setSettings({
                        ...settings,
                        [item.key]: e.target.checked
                      })}
                      className="mt-1 rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {isSaving ? 'Guardando...' : 'Guardar Preferencias'}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cambiar Contraseña</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-600 hover:text-gray-900"
                    >
                      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isSaving ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">Sesiones Activas</h4>
              <p className="text-sm text-gray-600 mb-3">Actualmente conectado desde:</p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                Chrome en Windows • Última activo: Ahora
              </div>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de Cuenta</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nombre Completo</label>
                  <p className="text-lg font-medium text-gray-900">{user?.name || 'Nombre no disponible'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <p className="text-lg font-medium text-gray-900">{user?.email || 'Email no disponible'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Rol</label>
                  <p className="text-lg font-medium text-gray-900">{user?.role === 'admin' ? 'Administrador' : 'Cliente'}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-4">Zona de Peligro</h4>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default SettingsView
