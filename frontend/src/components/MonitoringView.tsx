import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart } from './Chart'
import { apiClient } from '../lib/apiClient'
import toast from 'react-hot-toast'

type RouterUsage = {
  router_id: string
  rx_mbps: number
  tx_mbps: number
  cpu?: number
  mem?: number
}

const MonitoringView: React.FC = () => {
  const [routers, setRouters] = useState<RouterUsage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await apiClient.get('/admin/routers/usage')
        setRouters(resp.items || [])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar métricas'
        setError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const avgCpu = useMemo(() => {
    const values = routers.map((r) => r.cpu).filter((v) => v != null) as number[]
    if (!values.length) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }, [routers])

  const avgMem = useMemo(() => {
    const values = routers.map((r) => r.mem).filter((v) => v != null) as number[]
    if (!values.length) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }, [routers])

  const totalRx = useMemo(() => routers.reduce((s, r) => s + r.rx_mbps, 0), [routers])
  const totalTx = useMemo(() => routers.reduce((s, r) => s + r.tx_mbps, 0), [routers])

  const cpuData = routers.map((r) => ({ label: r.router_id, value: r.cpu || 0, color: 'bg-cyan-500' }))
  const bwData = routers.map((r) => ({ label: r.router_id, value: r.rx_mbps + r.tx_mbps, color: 'bg-emerald-500' }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'CPU Promedio', value: avgCpu, unit: '%', threshold: 70 },
          { label: 'Memoria Prom.', value: avgMem, unit: '%', threshold: 80 },
          { label: 'Throughput RX', value: totalRx, unit: 'Mbps', threshold: 800 },
          { label: 'Throughput TX', value: totalTx, unit: 'Mbps', threshold: 800 },
          { label: 'Routers', value: routers.length, unit: '', threshold: 9999 },
          { label: 'Refresco', value: 15, unit: 's', threshold: 9999 },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-900/70 border border-white/10 rounded-xl p-4 shadow"
          >
            <p className="text-xs text-slate-300 font-medium mb-2">{metric.label}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold text-white">{metric.value.toFixed(1)}</p>
              <p className="text-xs text-slate-400">{metric.unit}</p>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
              <motion.div
                className="h-1.5 rounded-full bg-cyan-500"
                animate={{ width: `${Math.min(metric.threshold ? (metric.value / metric.threshold) * 100 : 50, 100)}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {loading && <p className="text-slate-300 text-sm">Cargando métricas...</p>}
      {error && <p className="text-amber-300 text-sm">{error}</p>}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart data={cpuData} title="CPU por router" showValues={true} />
        <BarChart data={bwData} title="Throughput (rx+tx) por router" showValues={true} />
      </div>

      {/* Alert Summary placeholder */}
      <div className="bg-slate-900/70 rounded-xl shadow border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Alertas</h3>
        <p className="text-sm text-slate-300">Integra PagerDuty/Telegram para alertas en tiempo real.</p>
      </div>
    </motion.div>
  )
}

export default MonitoringView
