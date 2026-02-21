import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  UserGroupIcon, 
  CurrencyDollarIcon, 
  ServerIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import StatsCard from './StatsCard'
import { LineChart, BarChart } from './Chart'

const ProfessionalDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeClients: 1234,
    monthlyRevenue: 45678,
    activeRouters: 12,
    uptime: 99.8,
    avgBandwidth: 456,
    totalTraffic: 12543
  })

  const chartData = [
    { label: 'Lun', value: 45 },
    { label: 'Mar', value: 52 },
    { label: 'Mié', value: 48 },
    { label: 'Jue', value: 61 },
    { label: 'Vie', value: 55 },
    { label: 'Sáb', value: 67 },
    { label: 'Dom', value: 70 }
  ]

  const utilizationData = [
    { label: 'Router A', value: 65, color: 'bg-blue-600' },
    { label: 'Router B', value: 45, color: 'bg-green-600' },
    { label: 'Router C', value: 78, color: 'bg-orange-600' },
    { label: 'Router D', value: 52, color: 'bg-purple-600' }
  ]

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Clientes Activos"
          value={stats.activeClients.toLocaleString()}
          trend={12}
          color="blue"
          icon={<UserGroupIcon />}
          subtitle="+145 este mes"
        />
        <StatsCard
          title="Ingresos Mensuales"
          value={`$${stats.monthlyRevenue.toLocaleString()}`}
          trend={23}
          color="green"
          icon={<CurrencyDollarIcon />}
          subtitle="+23% vs mes anterior"
        />
        <StatsCard
          title="Routers Activos"
          value={stats.activeRouters}
          trend={0}
          color="purple"
          icon={<ServerIcon />}
          subtitle="100% operativo"
        />
        <StatsCard
          title="Uptime"
          value={`${stats.uptime}%`}
          color="emerald"
          icon={<SparklesIcon />}
          subtitle="Ultimos 30 días"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart
          data={chartData}
          title="Conexiones Activas (Últimos 7 días)"
          height={250}
        />
        <BarChart
          data={utilizationData}
          title="Utilización de Routers"
          showValues={true}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-200">
          <p className="text-sm text-cyan-700 font-medium">Ancho de Banda Promedio</p>
          <p className="text-2xl font-bold text-cyan-900 mt-2">{stats.avgBandwidth} Mbps</p>
          <p className="text-xs text-cyan-600 mt-1">↑ 15% vs última semana</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-700 font-medium">Tráfico Total</p>
          <p className="text-2xl font-bold text-orange-900 mt-2">{stats.totalTraffic} GB</p>
          <p className="text-xs text-orange-600 mt-1">En el mes actual</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-700 font-medium">Clientes Satisfechos</p>
          <p className="text-2xl font-bold text-green-900 mt-2">98.5%</p>
          <p className="text-xs text-green-600 mt-1">Calificación promedio</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actividad Reciente</h3>
        <div className="space-y-3">
          {[
            { time: 'Hace 2 minutos', action: 'Nuevo cliente registrado', status: 'success' },
            { time: 'Hace 15 minutos', action: 'Backup de Router A completado', status: 'success' },
            { time: 'Hace 1 hora', action: 'Actualización de firmware en Router C', status: 'info' },
            { time: 'Hace 2 horas', action: 'Alerta: CPU alta en Router B (resuelta)', status: 'warning' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.action}</p>
                <p className="text-xs text-gray-500">{item.time}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                item.status === 'success' ? 'bg-green-100 text-green-800' :
                item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {item.status === 'success' ? '✓' : item.status === 'warning' ? '⚠' : 'ℹ'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default ProfessionalDashboard
