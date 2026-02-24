import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChartBarIcon,
  CogIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import AIDiagnosis from './AIDiagnosis'
import ActionsHeader from './ActionsHeader'
import ConnectionsTab from './ConnectionsTab'
import OverviewTab from './OverviewTab'
import QueuesTab from './QueuesTab'
import SidePanels from './SidePanels'
import { safeStorage } from '../lib/storage'
import { RouterItem, RouterStats, Toast } from './types'

interface RouterListResponse {
  success: boolean
  routers: unknown[]
}

interface RouterCreateResponse {
  success: boolean
  router?: unknown
  reachable?: boolean | null
  error?: string
}

interface RouterQuickScripts {
  direct_api_script: string
  wireguard_site_to_vps_script: string
  windows_login: string
  linux_login: string
}

interface RouterQuickGuidance {
  back_to_home: string[]
  notes: string[]
}

interface RouterBackToHomeUser {
  name: string
  allow_lan: boolean
  disabled: boolean
  expires: string
}

interface RouterBackToHomeScripts {
  enable_script: string
  add_vps_user_script: string
  generate_private_key_hint: string
}

interface RouterBackToHomeStatus {
  reachable?: boolean
  routeros_version?: string | null
  supported?: boolean | null
  bth_users_supported?: boolean | null
  ddns_enabled?: boolean | null
  back_to_home_vpn?: string | null
  vpn_status?: string | null
  vpn_dns_name?: string | null
  vpn_interface?: string | null
  vpn_port?: string | null
  users?: RouterBackToHomeUser[]
  users_error?: string
  scripts?: RouterBackToHomeScripts
  limitations?: string[]
  error?: string
}

interface RouterQuickConnectResponse {
  success: boolean
  scripts?: RouterQuickScripts
  guidance?: RouterQuickGuidance
  back_to_home?: RouterBackToHomeStatus
}

interface RouterFormState {
  name: string
  ip_address: string
  username: string
  password: string
  api_port: string
}

const normalizeRouterItem = (input: unknown): RouterItem => {
  const item = (input || {}) as Record<string, unknown>
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? 'Router'),
    ip_address: String(item.ip_address ?? ''),
    model: item.model ? String(item.model) : undefined,
    status: item.status ? String(item.status) : undefined,
  }
}

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  }
}

const MikroTikManagement: React.FC = () => {
  const [routers, setRouters] = useState<RouterItem[]>([])
  const [selectedRouter, setSelectedRouter] = useState<RouterItem | null>(null)
  const [routerStats, setRouterStats] = useState<RouterStats | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'queues' | 'connections' | 'config' | 'security'>('overview')

  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [creatingRouter, setCreatingRouter] = useState(false)
  const [quickLoading, setQuickLoading] = useState(false)

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const confirmActionRef = useRef<(() => void) | null>(null)
  const [sidePanel, setSidePanel] = useState<'none' | 'logs' | 'dhcp' | 'wifi'>('none')
  const [quickConnect, setQuickConnect] = useState<RouterQuickConnectResponse | null>(null)
  const [routerForm, setRouterForm] = useState<RouterFormState>({
    name: '',
    ip_address: '',
    username: 'admin',
    password: '',
    api_port: '8728',
  })

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const openConfirm = (message: string, onConfirm: () => void) => {
    setConfirmMessage(message)
    confirmActionRef.current = onConfirm
    setConfirmOpen(true)
  }

  const authHeaders = useCallback(() => {
    const token = safeStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const API_BASE = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || ''

  const safeJson = useCallback(async (res: Response): Promise<unknown> => {
    try {
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const apiFetch = useCallback(
    (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(authHeaders() as Record<string, string>),
        ...((options.headers as Record<string, string>) || {}),
      }
      const url = path.startsWith('http') ? path : `${API_BASE}${path}`
      return fetch(url, { ...options, headers }).then(async (res) => {
        if (res.status === 401) {
          safeStorage.removeItem('token')
          window.location.href = '/login'
          throw new Error('Unauthorized')
        }
        return res
      })
    },
    [API_BASE, authHeaders]
  )

  const loadRouters = useCallback(async () => {
    try {
      const response = await apiFetch('/api/mikrotik/routers')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = (await safeJson(response)) as RouterListResponse | null
      const source = payload?.success && Array.isArray(payload.routers) ? payload.routers : []
      const nextRouters = source.map(normalizeRouterItem).filter((item) => item.id && item.ip_address)
      setRouters(nextRouters)
      setSelectedRouter((prev) => {
        if (!nextRouters.length) return null
        if (!prev) return nextRouters[0]
        return nextRouters.find((item) => item.id === prev.id) || nextRouters[0]
      })
    } catch (error) {
      console.error('Error loading routers:', error)
      addToast('error', 'No se pudieron cargar los routers')
    }
  }, [addToast, apiFetch, safeJson])

  const loadRouterStats = useCallback(
    async (routerId: string) => {
      setIsLoading(true)
      try {
        const [healthRes, queuesRes, connectionsRes] = await Promise.all([
          apiFetch(`/api/mikrotik/routers/${routerId}/health`),
          apiFetch(`/api/mikrotik/routers/${routerId}/queues`),
          apiFetch(`/api/mikrotik/routers/${routerId}/connections`),
        ])

        const healthData = healthRes.ok ? ((await safeJson(healthRes)) as Record<string, unknown>) : { success: false }
        const queuesData = queuesRes.ok ? ((await safeJson(queuesRes)) as Record<string, unknown>) : { success: false }
        const connectionsData = connectionsRes.ok ? ((await safeJson(connectionsRes)) as Record<string, unknown>) : { success: false }

        const nextStats: RouterStats = {
          health: healthData.success === true ? (healthData.health as RouterStats['health']) : null,
          queues: queuesData.success === true && Array.isArray(queuesData.queues) ? (queuesData.queues as RouterStats['queues']) : [],
          connections:
            connectionsData.success === true && Array.isArray(connectionsData.connections)
              ? (connectionsData.connections as RouterStats['connections'])
              : [],
        }
        setRouterStats(nextStats)
      } catch (error) {
        console.error('Error loading router stats:', error)
        setRouterStats({ health: null, queues: [], connections: [] })
        addToast('error', 'Error de red al cargar estadisticas del router')
      } finally {
        setIsLoading(false)
      }
    },
    [addToast, apiFetch, safeJson]
  )

  const loadQuickConnect = useCallback(
    async (routerId: string) => {
      setQuickLoading(true)
      try {
        const response = await apiFetch(`/api/mikrotik/routers/${routerId}/quick-connect`)
        const payload = (await safeJson(response)) as RouterQuickConnectResponse | null
        if (response.ok && payload?.success) {
          setQuickConnect(payload)
        } else {
          setQuickConnect(null)
        }
      } catch (error) {
        console.error('Error loading quick connect:', error)
        setQuickConnect(null)
      } finally {
        setQuickLoading(false)
      }
    },
    [apiFetch, safeJson]
  )

  useEffect(() => {
    loadRouters()
  }, [loadRouters])

  useEffect(() => {
    if (!selectedRouter) return
    loadRouterStats(selectedRouter.id)
    loadQuickConnect(selectedRouter.id)
    setAiAnalysis(null)
    setAiError(null)
  }, [loadQuickConnect, loadRouterStats, selectedRouter])

  const rebootRouter = async () => {
    if (!selectedRouter) return
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/reboot`, { method: 'POST' })
      const data = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && data?.success) addToast('success', 'Reinicio solicitado correctamente')
      else addToast('error', data?.error || 'Error reiniciando router')
    } catch {
      addToast('error', 'Error de red reiniciando router')
    } finally {
      setActionLoading(false)
    }
  }

  const backupRouter = async () => {
    if (!selectedRouter) return
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `backup_${new Date().toISOString()}` }),
      })
      const data = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && data?.success) addToast('success', 'Backup creado exitosamente')
      else addToast('error', data?.error || 'Error creando backup')
    } catch {
      addToast('error', 'Error de red creando backup')
    } finally {
      setActionLoading(false)
    }
  }

  const testConnection = async () => {
    if (!selectedRouter) return
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/test-connection`)
      const data = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && data?.success) addToast('success', 'Conexion al router exitosa')
      else addToast('error', data?.error || 'No se pudo conectar al router')
    } catch {
      addToast('error', 'Error de red al probar conexion')
    } finally {
      setActionLoading(false)
    }
  }

  const runAiDiagnosis = async () => {
    if (!selectedRouter) return
    setIsAiLoading(true)
    setAiAnalysis(null)
    setAiError(null)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/ai-diagnose`)
      const data = (await safeJson(response)) as { success?: boolean; diagnosis?: { analysis?: string }; error?: string } | null
      if (response.ok && data?.success) setAiAnalysis(data.diagnosis?.analysis || '')
      else throw new Error(data?.error || 'Failed to get AI analysis')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setAiError(message)
    } finally {
      setIsAiLoading(false)
    }
  }

  const createRouter = async () => {
    if (!routerForm.name.trim() || !routerForm.ip_address.trim() || !routerForm.username.trim() || !routerForm.password.trim()) {
      addToast('error', 'Completa nombre, IP, usuario y password')
      return
    }
    setCreatingRouter(true)
    try {
      const response = await apiFetch('/api/mikrotik/routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: routerForm.name.trim(),
          ip_address: routerForm.ip_address.trim(),
          username: routerForm.username.trim(),
          password: routerForm.password,
          api_port: Number(routerForm.api_port || '8728'),
          is_active: true,
          test_connection: true,
        }),
      })
      const payload = (await safeJson(response)) as RouterCreateResponse | null
      if (!response.ok || !payload?.success || !payload.router) {
        addToast('error', payload?.error || `Error ${response.status} al agregar router`)
        return
      }

      const createdRouter = normalizeRouterItem(payload.router)
      addToast('success', payload.reachable === false ? 'Router agregado, pero no responde aun' : 'Router agregado correctamente')
      setRouterForm((prev) => ({ ...prev, name: '', ip_address: '', password: '' }))
      await loadRouters()
      setSelectedRouter(createdRouter)
      setActiveTab('config')
    } catch (error) {
      console.error('Error creating router:', error)
      addToast('error', 'No se pudo agregar el router')
    } finally {
      setCreatingRouter(false)
    }
  }

  const copyScript = async (label: string, value: string) => {
    const ok = await copyToClipboard(value)
    addToast(ok ? 'success' : 'error', ok ? `${label} copiado` : `No se pudo copiar ${label}`)
  }

  return (
    <div className="space-y-6">
      <ActionsHeader
        actionLoading={actionLoading}
        isAiLoading={isAiLoading}
        isLoading={isLoading}
        selectedRouter={selectedRouter}
        onTestConnection={testConnection}
        onBackupRouter={backupRouter}
        onRebootClick={() => openConfirm(`Reiniciar el router ${selectedRouter?.name}?`, rebootRouter)}
        onRunAiDiagnosis={runAiDiagnosis}
        onRefreshStats={() => selectedRouter && loadRouterStats(selectedRouter.id)}
        onShowLogs={() => setSidePanel('logs')}
        onShowDhcpLeases={() => setSidePanel('dhcp')}
        onShowWifiClients={() => setSidePanel('wifi')}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Alta rapida de MikroTik</h3>
        <p className="mb-3 text-sm text-gray-600">
          Agrega routers nuevos con sus credenciales de API. Luego usa la pestana Configuracion para scripts de conexion remota.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            value={routerForm.name}
            onChange={(e) => setRouterForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            value={routerForm.ip_address}
            onChange={(e) => setRouterForm((prev) => ({ ...prev, ip_address: e.target.value }))}
            placeholder="IP o DNS"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            value={routerForm.username}
            onChange={(e) => setRouterForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="Usuario API"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            type="password"
            value={routerForm.password}
            onChange={(e) => setRouterForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Password API"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <div className="flex items-center gap-2">
            <input
              value={routerForm.api_port}
              onChange={(e) => setRouterForm((prev) => ({ ...prev, api_port: e.target.value }))}
              placeholder="Puerto API"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <button
              onClick={createRouter}
              disabled={creatingRouter}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {creatingRouter ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Seleccionar Router</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {routers.map((router) => (
            <button
              key={router.id}
              onClick={() => setSelectedRouter(router)}
              className={`rounded-lg border p-4 text-left transition-all ${
                selectedRouter?.id === router.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ServerIcon className="h-6 w-6 text-green-500" />
                <div>
                  <div className="font-medium text-gray-900">{router.name}</div>
                  <div className="text-sm text-gray-600">{router.ip_address}</div>
                  <div className="text-xs text-gray-500">{router.model || '-'}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {!routers.length && <p className="mt-3 text-sm text-gray-500">No hay routers registrados todavia.</p>}
      </div>

      {selectedRouter && (
        <>
          <div className="my-4">
            <AIDiagnosis isLoading={isAiLoading} analysis={aiAnalysis} error={aiError} />
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Resumen', icon: ChartBarIcon },
                { id: 'queues', name: 'Colas', icon: UserGroupIcon },
                { id: 'connections', name: 'Conexiones', icon: WifiIcon },
                { id: 'config', name: 'Configuracion', icon: CogIcon },
                { id: 'security', name: 'Seguridad', icon: ShieldCheckIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'overview' | 'queues' | 'connections' | 'config' | 'security')}
                  className={`flex items-center space-x-2 border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow">
            {isLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Cargando informacion del router...</p>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewTab routerStats={routerStats} />}
                {activeTab === 'queues' && (
                  <QueuesTab
                    routerStats={routerStats}
                    setRouterStats={setRouterStats}
                    selectedRouter={selectedRouter}
                    apiFetch={apiFetch}
                    addToast={addToast}
                    openConfirm={openConfirm}
                  />
                )}
                {activeTab === 'connections' && (
                  <ConnectionsTab
                    routerStats={routerStats}
                    setRouterStats={setRouterStats}
                    selectedRouter={selectedRouter}
                    apiFetch={apiFetch}
                    addToast={addToast}
                    openConfirm={openConfirm}
                  />
                )}
                {activeTab === 'config' && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900">Conexion remota rapida</h4>
                    {quickLoading && <p className="text-sm text-gray-500">Cargando scripts...</p>}
                    {!quickLoading && !quickConnect?.scripts && (
                      <p className="text-sm text-rose-600">No se pudieron cargar scripts para este router.</p>
                    )}
                    {quickConnect?.scripts && (
                      <>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800">Script acceso directo API/SSH</p>
                            <button
                              onClick={() => copyScript('script API', quickConnect.scripts?.direct_api_script || '')}
                              className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-700"
                            >
                              Copiar
                            </button>
                          </div>
                          <pre className="max-h-52 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                            {quickConnect.scripts.direct_api_script}
                          </pre>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800">Script WireGuard sitio a VPS</p>
                            <button
                              onClick={() => copyScript('script WireGuard', quickConnect.scripts?.wireguard_site_to_vps_script || '')}
                              className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-700"
                            >
                              Copiar
                            </button>
                          </div>
                          <pre className="max-h-52 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                            {quickConnect.scripts.wireguard_site_to_vps_script}
                          </pre>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-xs font-semibold uppercase text-gray-500">Login Windows/Linux</p>
                            <p className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs text-slate-100">{quickConnect.scripts.windows_login}</p>
                            <p className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs text-slate-100">{quickConnect.scripts.linux_login}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-xs font-semibold uppercase text-gray-500">Back To Home</p>
                            <ul className="mt-2 space-y-1 text-xs text-gray-700">
                              {(quickConnect.guidance?.back_to_home || []).map((step, idx) => (
                                <li key={idx}>- {step}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {quickConnect.back_to_home && (
                          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${quickConnect.back_to_home.reachable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {quickConnect.back_to_home.reachable ? 'router reachable' : 'router unreachable'}
                              </span>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${quickConnect.back_to_home.supported ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {quickConnect.back_to_home.supported ? 'BTH soportado' : 'BTH no confirmado'}
                              </span>
                              {quickConnect.back_to_home.routeros_version && (
                                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                                  RouterOS {quickConnect.back_to_home.routeros_version}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700">
                              DDNS: <strong>{String(quickConnect.back_to_home.ddns_enabled ?? 'unknown')}</strong> | BTH VPN: <strong>{quickConnect.back_to_home.back_to_home_vpn || '-'}</strong> | Estado: <strong>{quickConnect.back_to_home.vpn_status || '-'}</strong>
                            </p>
                            <p className="text-xs text-gray-700">
                              DNS: <strong>{quickConnect.back_to_home.vpn_dns_name || '-'}</strong> | Interfaz: <strong>{quickConnect.back_to_home.vpn_interface || '-'}</strong> | Puerto: <strong>{quickConnect.back_to_home.vpn_port || '-'}</strong>
                            </p>

                            {quickConnect.back_to_home.scripts?.enable_script && (
                              <div className="rounded border border-gray-300 bg-white p-2">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs font-semibold uppercase text-gray-600">Script habilitar Back To Home</p>
                                  <button
                                    onClick={() => copyScript('script BTH enable', quickConnect.back_to_home?.scripts?.enable_script || '')}
                                    className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-700"
                                  >
                                    Copiar
                                  </button>
                                </div>
                                <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-100">
                                  {quickConnect.back_to_home.scripts.enable_script}
                                </pre>
                              </div>
                            )}

                            {quickConnect.back_to_home.scripts?.add_vps_user_script && (
                              <div className="rounded border border-gray-300 bg-white p-2">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs font-semibold uppercase text-gray-600">Script usuario BTH para VPS</p>
                                  <button
                                    onClick={() => copyScript('script BTH VPS', quickConnect.back_to_home?.scripts?.add_vps_user_script || '')}
                                    className="rounded bg-gray-800 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-700"
                                  >
                                    Copiar
                                  </button>
                                </div>
                                <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-100">
                                  {quickConnect.back_to_home.scripts.add_vps_user_script}
                                </pre>
                                <p className="mt-2 text-xs text-gray-600">
                                  Generar private key WireGuard en VPS: <code>{quickConnect.back_to_home.scripts.generate_private_key_hint}</code>
                                </p>
                              </div>
                            )}

                            {Array.isArray(quickConnect.back_to_home.users) && quickConnect.back_to_home.users.length > 0 && (
                              <div className="rounded border border-gray-300 bg-white p-2">
                                <p className="text-xs font-semibold uppercase text-gray-600">Usuarios BTH actuales</p>
                                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                                  {quickConnect.back_to_home.users.map((user, idx) => (
                                    <li key={`${user.name}-${idx}`}>
                                      - {user.name} | allow-lan: {String(user.allow_lan)} | disabled: {String(user.disabled)} | expires: {user.expires || '-'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {quickConnect.back_to_home.users_error && (
                              <p className="text-xs text-amber-700">No fue posible leer usuarios BTH: {quickConnect.back_to_home.users_error}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {activeTab === 'security' && (
                  <div className="space-y-2 text-sm text-gray-700">
                    <h4 className="text-lg font-semibold text-gray-900">Buenas practicas de seguridad remota</h4>
                    {(quickConnect?.guidance?.notes || []).map((note, idx) => (
                      <p key={idx}>- {note}</p>
                    ))}
                    {!quickConnect?.guidance?.notes?.length && <p>No hay recomendaciones disponibles para este router.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <SidePanels
        sidePanel={sidePanel}
        onClose={() => setSidePanel('none')}
        selectedRouterId={selectedRouter?.id || null}
        apiFetch={apiFetch}
        addToast={addToast}
      />

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded px-4 py-2 text-white shadow ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-700'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)}></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h4 className="mb-2 text-lg font-semibold text-gray-900">Confirmar accion</h4>
              <p className="mb-4 text-gray-700">{confirmMessage}</p>
              <div className="flex justify-end gap-2">
                <button className="rounded bg-slate-200 px-4 py-2 hover:bg-slate-300" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </button>
                <button
                  className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  onClick={() => {
                    setConfirmOpen(false)
                    if (confirmActionRef.current) confirmActionRef.current()
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MikroTikManagement
