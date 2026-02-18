import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, LineChart } from './Chart'

interface UsageData {
  date: string
  upload: number
  download: number
  total: number
}

const UsageDetails: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  const usageData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
    const data: UsageData[] = []

    for (let i = 0; i < days; i++) {
      const download = Math.floor(Math.random() * 8 + 2)
      const upload = Math.floor(Math.random() * 2 + 0.5)

      data.push({
        date: dayNames[i % 7],
        download,
        upload,
        total: download + upload
      })
    }

    return data
  }, [timeRange])

  const totalUsage = usageData.reduce((sum, row) => sum + row.total, 0)
  const avgDaily = (totalUsage / usageData.length).toFixed(2)
  const downloadTotal = usageData.reduce((sum, row) => sum + row.download, 0)
  const uploadTotal = usageData.reduce((sum, row) => sum + row.upload, 0)

  const chartData = usageData.slice(-7).map((row) => ({
    label: row.date,
    value: row.total
  }))

  const downloadData = usageData.slice(-4).map((_, i) => ({
    label: `Sem ${i + 1}`,
    value: usageData.slice(i * 7, (i + 1) * 7).reduce((sum, row) => sum + row.download, 0) / 7
  }))

  const usageStats = [
    { label: 'Uso Total', value: `${totalUsage.toFixed(1)} GB`, color: 'blue' },
    { label: 'Promedio Diario', value: `${avgDaily} GB`, color: 'green' },
    { label: 'Descarga Total', value: `${downloadTotal.toFixed(1)} GB`, color: 'purple' },
    { label: 'Carga Total', value: `${uploadTotal.toFixed(1)} GB`, color: 'orange' }
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {usageStats.map((stat, i) => {
          const getColorClasses = (color: string) => {
            switch (color) {
              case 'green':
                return { bg: 'bg-green-50', text: 'text-green-700', dark: 'text-green-900', border: 'border-green-600' }
              case 'purple':
                return { bg: 'bg-purple-50', text: 'text-purple-700', dark: 'text-purple-900', border: 'border-purple-600' }
              case 'orange':
                return { bg: 'bg-orange-50', text: 'text-orange-700', dark: 'text-orange-900', border: 'border-orange-600' }
              default:
                return { bg: 'bg-blue-50', text: 'text-blue-700', dark: 'text-blue-900', border: 'border-blue-600' }
            }
          }

          const colors = getColorClasses(stat.color)

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`${colors.bg} rounded-lg border-l-4 p-4 shadow-sm ${colors.border}`}
            >
              <p className={`text-sm font-medium ${colors.text}`}>{stat.label}</p>
              <p className={`mt-2 text-2xl font-bold ${colors.dark}`}>{stat.value}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {range === '7d' ? 'Ultimos 7 dias' : range === '30d' ? '30 dias' : '90 dias'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineChart data={chartData} title="Consumo Diario (Ultimos 7 dias)" height={250} />
        <BarChart data={downloadData} title="Promedio de Descarga por Semana" showValues />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Desglose de Uso Diario</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fecha</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Descarga</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Carga</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">% del Limite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usageData
                .slice(-10)
                .reverse()
                .map((row, i) => {
                  const percentageOfLimit = (row.total / 15) * 100
                  const limitColor =
                    percentageOfLimit > 80 ? 'text-red-600' : percentageOfLimit > 50 ? 'text-yellow-600' : 'text-green-600'

                  return (
                    <motion.tr
                      key={`${row.date}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.download.toFixed(2)} GB</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.upload.toFixed(2)} GB</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.total.toFixed(2)} GB</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-gray-200">
                            <motion.div
                              className={`h-2 rounded-full ${
                                percentageOfLimit > 80 ? 'bg-red-600' : percentageOfLimit > 50 ? 'bg-yellow-600' : 'bg-green-600'
                              }`}
                              animate={{ width: `${Math.min(percentageOfLimit, 100)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <span className={limitColor}>{percentageOfLimit.toFixed(0)}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Limite de datos:</span> 15 GB mensuales. Utilizaste{' '}
          {((totalUsage / 15) * 100).toFixed(0)}% de tu limite en este periodo.
        </p>
      </div>
    </motion.div>
  )
}

export default UsageDetails
