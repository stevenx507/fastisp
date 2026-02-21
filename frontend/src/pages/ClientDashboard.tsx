import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import AppLayout from '../components/AppLayout'
import UsageDetails from '../components/UsageDetails'
import SpeedTestWidget from '../components/SpeedTestWidget'
import { WifiIcon, SignalIcon, MapIcon, BoltIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import StatsCard from '../components/StatsCard'
import { useNavigate } from 'react-router-dom'
import PushOptInCard from '../components/PushOptInCard'

const ClientDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [connectionStats] = useState({
    ispeed: '156 Mbps',
    upspeed: '42 Mbps',
    ping: '12 ms',
    uptime: '99.8%',
    dataUsed: '4.2 GB / 15 GB',
    signalStrength: 'Optimo'
  })

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Hola, {user?.name || 'Cliente'}
          </h1>
          <p className="mt-2 text-gray-600">Panel de control de tu conexion a Internet</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Velocidad de Descarga"
            value={connectionStats.ispeed}
            color="blue"
            icon={<WifiIcon />}
            subtitle="Velocidad actual"
          />
          <StatsCard
            title="Velocidad de Carga"
            value={connectionStats.upspeed}
            color="green"
            icon={<BoltIcon />}
            subtitle="Velocidad actual"
          />
          <StatsCard
            title="Ping"
            value={connectionStats.ping}
            color="purple"
            icon={<MapIcon />}
            subtitle="Latencia de red"
          />
          <StatsCard
            title="Disponibilidad"
            value={connectionStats.uptime}
            color="emerald"
            icon={<SignalIcon />}
            subtitle="Ultimos 30 dias"
          />
        </div>

        {/* Speed Test and Service Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SpeedTestWidget />
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Estado del Servicio</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div>
                    <p className="font-medium text-green-900">Internet</p>
                    <p className="text-sm text-green-700">Servicio activo y operativo</p>
                  </div>
                  <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">OK</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div>
                    <p className="font-medium text-green-900">WiFi Router</p>
                    <p className="text-sm text-green-700">Router conectado y funcionando</p>
                  </div>
                  <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">OK</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-blue-900">Datos Moviles</p>
                    <p className="text-sm text-blue-700">Plan en vigor hasta 28/02/2025</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">Activo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Details */}
        <div>
          <UsageDetails />
        </div>

        {/* Support and Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-bold text-blue-900 mb-3">¿Necesitas Ayuda?</h3>
            <p className="text-sm text-blue-800 mb-4">Soporte 24/7 si tienes problemas con tu conexion.</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              Contactar Soporte
            </button>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <h3 className="text-lg font-bold text-purple-900 mb-3">Actualizar Plan</h3>
            <p className="text-sm text-purple-800 mb-4">Considera subir de plan para mayor velocidad.</p>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">
              Ver Planes
            </button>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-6 border border-emerald-200">
            <h3 className="text-lg font-bold text-emerald-900 mb-3">Pagos y Facturas</h3>
            <p className="text-sm text-emerald-800 mb-4">Consulta tus facturas y realiza pagos en linea.</p>
            <button
              onClick={() => navigate('/dashboard/billing')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              Abrir Facturacion
            </button>
          </div>
          <PushOptInCard className="md:col-span-2" />
        </div>
      </motion.div>
    </AppLayout>
  )
}

export default ClientDashboard
