import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ServerIcon,
  WifiIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline'

const MikroTikManagement: React.FC = () => {
  const [routers, setRouters] = useState<any[]>([])
  const [selectedRouter, setSelectedRouter] = useState<any>(null)
  const [routerStats, setRouterStats] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadRouters()
  }, [])

  useEffect(() => {
    if (selectedRouter) {
      loadRouterStats(selectedRouter.id)
    }
  }, [selectedRouter])

  const loadRouters = async () => {
    try {
      const response = await fetch('/api/mikrotik/routers')
      const data = await response.json()
      if (data.success) {
        setRouters(data.routers)
        if (data.routers.length > 0 && !selectedRouter) {
          setSelectedRouter(data.routers[0])
        }
      }
    } catch (error) {
      console.error('Error loading routers:', error)
    }
  }

  const loadRouterStats = async (routerId: string) => {
    setIsLoading(true)
    try {
      const [healthRes, queuesRes, connectionsRes] = await Promise.all([
        fetch(`/api/mikrotik/routers/${routerId}/health`),
        fetch(`/api/mikrotik/routers/${routerId}/queues`),
        fetch(`/api/mikrotik/routers/${routerId}/connections`)
      ])

      const healthData = await healthRes.json()
      const queuesData = await queuesRes.json()
      const connectionsData = await connectionsRes.json()

      setRouterStats({
        health: healthData.success ? healthData.health : null,
        queues: queuesData.success ? queuesData.queues : [],
        connections: connectionsData.success ? connectionsData.connections : []
      })
    } catch (error) {
      console.error('Error loading router stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const rebootRouter = async () => {
    if (!selectedRouter || !confirm('¿Estás seguro de reiniciar este router?')) return

    try {
      const response = await fetch(`/api/mikrotik/routers/${selectedRouter.id}/reboot`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        alert('Router reiniciado exitosamente')
      } else {
        alert('Error reiniciando router: ' + data.error)
      }
    } catch (error) {
      console.error('Error rebooting router:', error)
    }
  }

  const backupRouter = async () => {
    if (!selectedRouter) return

    try {
      const response = await fetch(`/api/mikrotik/routers/${selectedRouter.id}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `backup_${new Date().toISOString()}` })
      })
      const data = await response.json()
      if (data.success) {
        alert('Backup creado exitosamente')
      } else {
        alert('Error creando backup: ' + data.error)
      }
    } catch (error) {
      console.error('Error backing up router:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión MikroTik</h2>
          <p className="text-gray-600">Administra y monitorea tus routers MikroTik</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={backupRouter}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <CloudArrowDownIcon className="w-5 h-5" />
            <span>Backup</span>
          </button>
          <button
            onClick={rebootRouter}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowPathIcon className="w-5 h-5" />
            <span>Reiniciar</span>
          </button>
        </div>
      </div>

      {/* Router Selection */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Seleccionar Router</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {routers.map((router) => (
            <button
              key={router.id}
              onClick={() => setSelectedRouter(router)}
              className={`p-4 rounded-lg border transition-all ${
                selectedRouter?.id === router.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ServerIcon className={`w-6 h-6 ${
                  router.status === 'online' ? 'text-green-500' : 'text-red-500'
                }`} />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{router.name}</div>
                  <div className="text-sm text-gray-600">{router.ip_address}</div>
                  <div className="text-xs text-gray-500">{router.model}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedRouter && (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Resumen', icon: ChartBarIcon },
                { id: 'queues', name: 'Colas', icon: UserGroupIcon },
                { id: 'connections', name: 'Conexiones', icon: WifiIcon },
                { id: 'config', name: 'Configuración', icon: CogIcon },
                { id: 'security', name: 'Seguridad', icon: ShieldCheckIcon }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando información del router...</p>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && routerStats?.health && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm text-blue-700">CPU</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {routerStats.health.router?.cpu_load || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-sm text-green-700">Memoria Libre</div>
                        <div className="text-2xl font-bold text-green-900">
                          {routerStats.health.router?.memory_usage 
                            ? `${Math.round(parseInt(routerStats.health.router.memory_usage) / 1024 / 1024)} MB`
                            : 'N/A'
                          }
                        </div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-sm text-purple-700">Uptime</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {routerStats.health.router?.uptime?.split(' ')[0] || 'N/A'}
                        </div>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <div className="text-sm text-amber-700">Salud</div>
                        <div className="text-2xl font-bold text-amber-900">
                          {routerStats.health.health_score || 0}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Información del Router</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Modelo:</span>
                            <span className="font-medium">{routerStats.health.router?.model}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Firmware:</span>
                            <span className="font-medium">{routerStats.health.router?.firmware}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Serial:</span>
                            <span className="font-medium">{routerStats.health.router?.serial_number}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nombre:</span>
                            <span className="font-medium">{routerStats.health.router?.identity}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Métricas</h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Colas Activas</span>
                              <span>{routerStats.health.queues}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(routerStats.health.queues * 2, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Conexiones Activas</span>
                              <span>{routerStats.health.connections}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${Math.min(routerStats.health.connections * 5, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Queues Tab */}
                {activeTab === 'queues' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Colas de Clientes</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nombre
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Target
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Límite
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Uso Actual
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Estado
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {routerStats?.queues.slice(0, 20).map((queue: any) => (
                            <tr key={queue.name}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {queue.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {queue.target}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {queue.max_limit || 'Sin límite'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {queue.rate || '0/0'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  queue.disabled
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {queue.disabled ? 'Desactivada' : 'Activa'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Connections Tab */}
                {activeTab === 'connections' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">Conexiones Activas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {routerStats?.connections.map((conn: any, index: number) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${
                                conn.type === 'dhcp' ? 'bg-green-500' : 'bg-blue-500'
                              }`}></div>
                              <span className="font-medium text-gray-900">
                                {conn.type.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">{conn.status || 'Active'}</span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div>IP: {conn.address}</div>
                            {conn.mac_address && <div>MAC: {conn.mac_address}</div>}
                            {conn.host_name && <div>Host: {conn.host_name}</div>}
                            {conn.uptime && <div>Uptime: {conn.uptime}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MikroTikManagement
