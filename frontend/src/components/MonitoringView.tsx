import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart } from './Chart'

interface MetricData {
  label: string
  value: number
  color: string
  threshold?: number
}

const MonitoringView: React.FC = () => {
  const [metrics, setMetrics] = useState({
    cpu: 35,
    memory: 62,
    bandwidth: 78,
    connections: 245,
    uptime: 99.8,
    latency: 12
  })

  const cpuData = [
    { label: 'Router A', value: 35, color: 'bg-blue-600' },
    { label: 'Router B', value: 48, color: 'bg-green-600' },
    { label: 'Router C', value: 22, color: 'bg-purple-600' },
    { label: 'Router D', value: 61, color: 'bg-orange-600' }
  ]

  const memoryData = [
    { label: 'Router A', value: 62, color: 'bg-cyan-600' },
    { label: 'Router B', value: 45, color: 'bg-blue-600' },
    { label: 'Router C', value: 78, color: 'bg-orange-600' },
    { label: 'Router D', value: 38, color: 'bg-green-600' }
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(20, Math.min(80, prev.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(30, Math.min(90, prev.memory + (Math.random() - 0.5) * 8)),
        bandwidth: Math.max(40, Math.min(95, prev.bandwidth + (Math.random() - 0.5) * 12)),
        connections: Math.max(200, Math.min(500, prev.connections + Math.floor((Math.random() - 0.5) * 20))),
        uptime: Math.min(99.99, prev.uptime + (Math.random() * 0.01)),
        latency: Math.max(5, Math.min(50, prev.latency + (Math.random() - 0.5) * 5))
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const getMetricColor = (value: number, threshold: number) => {
    if (value > threshold) return 'text-red-600'
    if (value > threshold * 0.75) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'CPU Promedio', value: metrics.cpu, unit: '%', threshold: 70, key: 'cpu' },
          { label: 'Memoria', value: metrics.memory, unit: '%', threshold: 80, key: 'memory' },
          { label: 'Ancho de Banda', value: metrics.bandwidth, unit: '%', threshold: 85, key: 'bandwidth' },
          { label: 'Conexiones', value: metrics.connections, unit: '', threshold: 400, key: 'connections' },
          { label: 'Uptime', value: metrics.uptime, unit: '%', threshold: 99, key: 'uptime' },
          { label: 'Latencia', value: Math.round(metrics.latency), unit: 'ms', threshold: 30, key: 'latency' }
        ].map((metric, i) => (
          <motion.div
            key={metric.key}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
          >
            <p className="text-xs text-gray-600 font-medium mb-2">{metric.label}</p>
            <div className="flex items-baseline gap-1">
              <p className={`text-2xl font-bold ${getMetricColor(metric.value, metric.threshold)}`}>
                {metric.value.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">{metric.unit}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <motion.div
                className={`h-1.5 rounded-full transition-all ${
                  metric.value > metric.threshold * 0.75 
                    ? 'bg-orange-500' 
                    : 'bg-green-500'
                }`}
                animate={{ width: `${(metric.value / 100) * 100}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart data={cpuData} title="Utilización de CPU por Router" showValues={true} />
        <BarChart data={memoryData} title="Uso de Memoria por Router" showValues={true} />
      </div>

      {/* Alert Summary */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas Activas</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 pb-3 border-b">
            <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">CPU Alta en Router C</p>
              <p className="text-sm text-gray-600">Utilización al 78%, revisar procesos activos</p>
              <p className="text-xs text-gray-500 mt-1">Hace 5 minutos</p>
            </div>
          </div>
          <div className="flex items-start gap-3 pb-3 border-b">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Memoria en Límite - Router D</p>
              <p className="text-sm text-gray-600">Memoria disponible en 12%, considere reinicio</p>
              <p className="text-xs text-gray-500 mt-1">Hace 12 minutos</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Sistema Normalizado</p>
              <p className="text-sm text-gray-600">Router A volvió a parámetros normales</p>
              <p className="text-xs text-gray-500 mt-1">Hace 18 minutos</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MonitoringView
