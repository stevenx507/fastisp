import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, BarChart } from './Chart'

type RangeKey = '7d' | '30d' | '90d'

interface UsagePoint {
  label: string
  upload: number
  download: number
  total: number
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const generateUsage = (days: number): UsagePoint[] =>
  Array.from({ length: days }, (_, i) => {
    const download = Math.random() * 8 + 2 // 2-10 GB
    const upload = Math.random() * 2 + 0.5 // 0.5-2.5 GB
    return {
      label: dayNames[i % 7],
      upload: Number(upload.toFixed(2)),
      download: Number(download.toFixed(2)),
      total: Number((upload + download).toFixed(2)),
    }
  })

const UsageDetails: React.FC = () => {
  const [timeRange, setTimeRange] = useState<RangeKey>('30d')

  const usageData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    return generateUsage(days)
  }, [timeRange])

  const total = usageData.reduce((acc, p) => acc + p.total, 0)
  const avg = usageData.length ? total / usageData.length : 0
  const projected = avg * 30

  const linePoints = usageData.map((p, idx) => ({
    label: `${p.label} ${idx + 1}`,
    value: p.total,
  }))

  const barPoints = usageData.map((p) => ({
    label: p.label,
    value: p.total,
    color: 'bg-indigo-400',
  }))

  const summary = [
    { label: `Consumo (${timeRange})`, value: `${total.toFixed(2)} GB` },
    { label: 'Promedio Diario', value: `${avg.toFixed(2)} GB` },
    { label: 'Proyección 30d', value: `${projected.toFixed(2)} GB` },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Uso Detallado de Datos</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow border border-gray-200">
            <p className="text-sm text-gray-600">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as RangeKey[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '7d' ? 'Últimos 7 días' : range === '30d' ? '30 días' : '90 días'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart data={linePoints} title="Consumo Diario" height={260} />
        <BarChart data={barPoints} title="Uso Total" showValues />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Desglose de Uso Diario</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fecha</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Descarga</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Carga</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">% del Límite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usageData.slice(-10).reverse().map((row, i) => {
                const pct = (row.total / 15) * 100
                const limitColor = pct > 80 ? 'text-red-600' : pct > 50 ? 'text-yellow-600' : 'text-green-600'
                return (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.label}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.download.toFixed(2)} GB</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.upload.toFixed(2)} GB</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.total.toFixed(2)} GB</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <motion.div
                            className={`h-2 rounded-full ${pct > 80 ? 'bg-red-600' : pct > 50 ? 'bg-yellow-600' : 'bg-green-600'}`}
                            animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <span className={limitColor}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Límite de datos:</span> 15 GB mensuales. Usaste {((total / 15) * 100).toFixed(0)}% en este período.
        </p>
      </div>
    </motion.div>
  )
}

export default UsageDetails
