import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import EnhancedDashboard from '../components/EnhancedDashboard'
import EnhancedSpeedTest from '../components/EnhancedSpeedTest'
import BillingWidget from '../components/BillingWidget'
import ClientSimpleDashboard from '../components/ClientSimpleDashboard'
import { useAuth } from '../contexts/AuthContext'

const ClientDashboard: React.FC = () => {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple')
  
  if (!user) {
    return <div>Loading...</div>
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">IM</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">ISPMAX</h1>
                <p className="text-sm text-slate-600">Panel del Cliente</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-slate-700">
                  Conectado
                </span>
              </div>
              
              <button
                onClick={() => setViewMode(viewMode === 'simple' ? 'advanced' : 'simple')}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
              >
                {viewMode === 'simple' ? 'Ver Avanzado' : 'Ver Simple'}
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-slate-900">{user.username}</p>
                  <p className="text-xs text-slate-600">Cliente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'simple' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ClientSimpleDashboard />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <EnhancedDashboard />
          </motion.div>
        )}
        
        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Prueba de Velocidad</h3>
            <EnhancedSpeedTest />
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Facturación</h3>
            <BillingWidget />
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Soporte Rápido</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100">
                🤖 Chat con Soporte IA
              </button>
              <button className="w-full text-left p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100">
                📞 Llamar a Soporte
              </button>
              <button className="w-full text-left p-3 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100">
                🎥 Video Tutoriales
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ClientDashboard
