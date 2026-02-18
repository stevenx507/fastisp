import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  BellIcon
} from '@heroicons/react/24/outline'

interface Alert {
  id: number
  title: string
  message: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  timestamp: string
  router?: string
  dismissed: boolean
}

const AlertsView: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: 1,
      title: 'Router Principal - CPU Alta',
      message: 'CPU al 92%, hace 5 minutos. Se recomienda revisar procesos activos.',
      severity: 'critical',
      timestamp: 'Hace 2 minutos',
      router: 'Router A',
      dismissed: false
    },
    {
      id: 2,
      title: 'Almacenamiento en 85%',
      message: 'Se recomienda liberar espacio en el router de backup.',
      severity: 'warning',
      timestamp: 'Hace 15 minutos',
      router: 'Router D',
      dismissed: false
    },
    {
      id: 3,
      title: 'Backup Completado',
      message: 'Backup diario finalizado exitosamente. 2.4 GB respaldados.',
      severity: 'success',
      timestamp: 'Hace 1 hora',
      router: 'Sistema',
      dismissed: false
    },
    {
      id: 4,
      title: 'Programa de Mantenimiento Programado',
      message: 'Mantenimiento preventivo programado para hoy a las 2:00 AM.',
      severity: 'info',
      timestamp: 'Hace 3 horas',
      router: 'Sistema',
      dismissed: false
    },
    {
      id: 5,
      title: 'Nuevo Cliente Activado',
      message: 'Cliente "Empresa XYZ" ha sido activado con plan 100 Mbps.',
      severity: 'success',
      timestamp: 'Hace 2 horas',
      router: 'Sistema',
      dismissed: false
    }
  ])

  const dismissAlert = (id: number) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, dismissed: true } : alert
    ))
  }

  const dismissAllAlerts = () => {
    setAlerts(alerts.map(alert => ({ ...alert, dismissed: true })))
  }

  const activealerts = alerts.filter(a => !a.dismissed)
  const severityConfig = {
    critical: {
      icon: ExclamationTriangleIcon,
      bg: 'bg-red-50',
      border: 'border-red-200',
      title: 'text-red-900',
      text: 'text-red-700',
      leftBorder: 'border-l-4 border-l-red-600'
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      title: 'text-yellow-900',
      text: 'text-yellow-700',
      leftBorder: 'border-l-4 border-l-yellow-600'
    },
    info: {
      icon: InformationCircleIcon,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      title: 'text-blue-900',
      text: 'text-blue-700',
      leftBorder: 'border-l-4 border-l-blue-600'
    },
    success: {
      icon: CheckCircleIcon,
      bg: 'bg-green-50',
      border: 'border-green-200',
      title: 'text-green-900',
      text: 'text-green-700',
      leftBorder: 'border-l-4 border-l-green-600'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellIcon className="w-6 h-6 text-gray-700" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Alertas del Sistema</h2>
            <p className="text-sm text-gray-600">{activealerts.length} alertas activas</p>
          </div>
        </div>
        {activealerts.length > 0 && (
          <button
            onClick={dismissAllAlerts}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Descartar todas
          </button>
        )}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {activealerts.length > 0 ? (
          <div className="space-y-3">
            {activealerts.map((alert, i) => {
              const config = severityConfig[alert.severity]
              const IconComponent = config.icon

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.05 }}
                  className={`${config.bg} ${config.border} border rounded-lg p-4 ${config.leftBorder} flex items-start gap-3`}
                >
                  <IconComponent className={`w-6 h-6 ${config.text} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <h3 className={`${config.title} font-semibold`}>{alert.title}</h3>
                    <p className={`${config.text} text-sm mt-1`}>{alert.message}</p>
                    <p className={`${config.text} text-xs mt-2 opacity-75`}>
                      {alert.router} • {alert.timestamp}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className={`flex-shrink-0 p-1 hover:bg-white rounded transition`}
                  >
                    <XMarkIcon className={`w-5 h-5 ${config.text}`} />
                  </button>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-gray-500"
          >
            <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">¡Sistema en buen estado!</p>
            <p className="text-sm">No hay alertas activas en este momento</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert History */}
      {alerts.filter(a => a.dismissed).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Historial de Alertas</h3>
          <div className="space-y-2 text-sm">
            {alerts.filter(a => a.dismissed).slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center justify-between text-gray-600 py-2 border-b last:border-b-0">
                <span>{alert.title}</span>
                <span className="text-xs text-gray-500">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default AlertsView
