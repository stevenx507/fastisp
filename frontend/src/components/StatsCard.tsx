import React from 'react'
import { motion } from 'framer-motion'

interface StatsCardProps {
  title: string
  value: string | number
  trend?: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'emerald' | 'cyan'
  subtitle?: string
}

const colorVariants = {
  blue: { ring: 'ring-blue-300/35', text: 'text-blue-200', value: 'text-blue-100' },
  green: { ring: 'ring-emerald-300/35', text: 'text-emerald-200', value: 'text-emerald-100' },
  purple: { ring: 'ring-purple-300/35', text: 'text-purple-200', value: 'text-purple-100' },
  orange: { ring: 'ring-orange-300/35', text: 'text-orange-200', value: 'text-orange-100' },
  red: { ring: 'ring-rose-300/35', text: 'text-rose-200', value: 'text-rose-100' },
  emerald: { ring: 'ring-emerald-300/35', text: 'text-emerald-200', value: 'text-emerald-100' },
  cyan: { ring: 'ring-cyan-300/35', text: 'text-cyan-200', value: 'text-cyan-100' }
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, icon, color, subtitle }) => {
  const colors = colorVariants[color]

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-xl ring-1 backdrop-blur-xl ${colors.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium ${colors.text}`}>{title}</p>
          <p className={`mt-1 text-3xl font-bold ${colors.value}`}>{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-300">{subtitle}</p> : null}
          {trend !== undefined ? (
            <p className={`mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mes anterior
            </p>
          ) : null}
        </div>
        <div className="rounded-xl bg-white/10 p-2 text-white">
          {React.isValidElement(icon) ? React.cloneElement(icon, { className: 'h-6 w-6' }) : icon}
        </div>
      </div>
    </motion.div>
  )
}

export default StatsCard
