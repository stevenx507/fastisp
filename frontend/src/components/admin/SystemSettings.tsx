import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { apiClient } from '../../lib/apiClient'

interface SystemSettingsPayload {
  portal_maintenance_mode: boolean
  auto_suspend_overdue: boolean
  notifications_push_enabled: boolean
  notifications_email_enabled: boolean
  allow_demo_login: boolean
  allow_self_signup: boolean
  allow_payment_demo: boolean
  default_ticket_priority: string
  backup_retention_days: number
  metrics_poll_interval_sec: number
}

interface SystemHealth {
  routers_up: number
  routers_down: number
  tickets_open: number
  timestamp: string
}

interface JobEntry {
  id: string
  job: string
  status: string
  requested_by?: number | null
  started_at: string
}

const jobs = ['backup', 'cleanup_leases', 'rotate_passwords', 'recalc_balances'] as const

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettingsPayload | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [jobHistory, setJobHistory] = useState<JobEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runningJob, setRunningJob] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/admin/system/settings')
      setSettings((response.settings || null) as SystemSettingsPayload | null)
      setHealth((response.health || null) as SystemHealth | null)
      setJobHistory((response.jobs || []) as JobEntry[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar ajustes del sistema'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const response = await apiClient.post('/admin/system/settings', { settings })
      setSettings((response.settings || settings) as SystemSettingsPayload)
      toast.success('Ajustes guardados')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron guardar ajustes'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const runJob = async (job: (typeof jobs)[number]) => {
    setRunningJob(job)
    try {
      const response = await apiClient.post('/admin/system/jobs/run', { job })
      const started = response.job as JobEntry
      setJobHistory((prev) => [started, ...prev])
      toast.success(`Job ${job} iniciado`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `No se pudo ejecutar ${job}`
      toast.error(msg)
    } finally {
      setRunningJob(null)
    }
  }

  const dangerLevel = useMemo(() => {
    if (!health) return 'ok'
    if (health.routers_down >= 3 || health.tickets_open >= 20) return 'critical'
    if (health.routers_down > 0 || health.tickets_open >= 8) return 'warning'
    return 'ok'
  }, [health])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sistema</h2>
          <p className="text-sm text-gray-600">Parametros operativos, jobs administrativos y salud general.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={!settings || saving}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Routers UP</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{health?.routers_up ?? 0}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase text-red-700">Routers DOWN</p>
          <p className="mt-2 text-2xl font-bold text-red-900">{health?.routers_down ?? 0}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase text-amber-700">Tickets Open</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{health?.tickets_open ?? 0}</p>
        </div>
        <div
          className={`rounded-xl p-4 ${
            dangerLevel === 'critical'
              ? 'border border-red-200 bg-red-50'
              : dangerLevel === 'warning'
                ? 'border border-amber-200 bg-amber-50'
                : 'border border-emerald-200 bg-emerald-50'
          }`}
        >
          <p className="text-xs font-semibold uppercase text-gray-700">Estado</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{dangerLevel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-2">
          <h3 className="mb-3 font-semibold text-gray-900">Configuracion operativa</h3>
          {settings ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ['portal_maintenance_mode', 'Portal en mantenimiento'],
                  ['auto_suspend_overdue', 'Suspension automatica por mora'],
                  ['notifications_push_enabled', 'Notificaciones push'],
                  ['notifications_email_enabled', 'Notificaciones email'],
                  ['allow_demo_login', 'Permitir login demo'],
                  ['allow_self_signup', 'Permitir autorregistro'],
                  ['allow_payment_demo', 'Permitir pagos demo'],
                ].map(([keyName, label]) => (
                  <label key={keyName} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(settings[keyName as keyof SystemSettingsPayload])}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, [keyName]: e.target.checked } as SystemSettingsPayload : prev
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm text-gray-700">
                  Prioridad ticket default
                  <select
                    value={settings.default_ticket_priority}
                    onChange={(e) => setSettings((prev) => (prev ? { ...prev, default_ticket_priority: e.target.value } : prev))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </label>
                <label className="text-sm text-gray-700">
                  Retencion backup (dias)
                  <input
                    type="number"
                    value={settings.backup_retention_days}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev ? { ...prev, backup_retention_days: Number(e.target.value) } : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Polling metricas (seg)
                  <input
                    type="number"
                    value={settings.metrics_poll_interval_sec}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev ? { ...prev, metrics_poll_interval_sec: Number(e.target.value) } : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Cargando configuracion...</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Jobs</h3>
          <div className="space-y-2">
            {jobs.map((job) => (
              <button
                key={job}
                onClick={() => runJob(job)}
                disabled={runningJob === job}
                className="w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
              >
                {runningJob === job ? `Ejecutando ${job}...` : job}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Historial reciente</h4>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {jobHistory.map((job) => (
                <div key={job.id} className="rounded-md border border-gray-200 px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-800">{job.job}</p>
                  <p className="text-gray-500">
                    {job.status} - {job.started_at?.replace('T', ' ').slice(0, 16)}
                  </p>
                </div>
              ))}
              {!jobHistory.length && <p className="text-xs text-gray-500">Sin jobs recientes.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemSettings
