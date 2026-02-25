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

interface RouterBackToHomeBootstrapData {
  user_name?: string
  allow_lan?: boolean
  user_visible_after_run?: boolean
  missing?: string[]
  next_steps?: string[]
}

interface RouterBackToHomeBootstrapResponse {
  success?: boolean
  error?: string
  bootstrap?: RouterBackToHomeBootstrapData
}

interface EnterpriseProfileOption {
  id: string
  label: string
  description?: string
}

interface EnterpriseProfilesPayload {
  router_profiles?: EnterpriseProfileOption[]
  site_profiles?: EnterpriseProfileOption[]
}

interface EnterpriseProfilesResponse {
  success?: boolean
  profiles?: EnterpriseProfilesPayload
  error?: string
}

interface EnterpriseHardeningResponse {
  success?: boolean
  dry_run?: boolean
  profile?: string
  site_profile?: string
  change_id?: string
  message?: string
  error?: string
  commands?: string[]
  rollback_commands?: string[]
  result?: string
  rollback_result?: Record<string, unknown> | null
}

interface EnterpriseFailoverTarget {
  target: string
  total_probes: number
  success_probes: number
  packet_loss: number
  avg_latency_ms: number | null
  status: 'ok' | 'warning' | 'critical'
  error?: string
}

interface EnterpriseFailoverReport {
  generated_at?: string
  overall_status?: 'ok' | 'warning' | 'critical'
  targets?: EnterpriseFailoverTarget[]
}

interface EnterpriseFailoverResponse {
  success?: boolean
  report?: EnterpriseFailoverReport
  error?: string
}

interface EnterpriseChangeLogEntry {
  change_id: string
  status: string
  category?: string
  actor?: string
  profile?: string
  site_profile?: string
  created_at?: string
  rolled_back_at?: string
}

interface EnterpriseChangeLogResponse {
  success?: boolean
  changes?: EnterpriseChangeLogEntry[]
  error?: string
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
  const [bthActionLoading, setBthActionLoading] = useState(false)

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const confirmActionRef = useRef<(() => void) | null>(null)
  const [sidePanel, setSidePanel] = useState<'none' | 'logs' | 'dhcp' | 'wifi'>('none')
  const [quickConnect, setQuickConnect] = useState<RouterQuickConnectResponse | null>(null)
  const [bootstrapResult, setBootstrapResult] = useState<RouterBackToHomeBootstrapData | null>(null)
  const [bthUserName, setBthUserName] = useState('noc-vps')
  const [bthPrivateKey, setBthPrivateKey] = useState('')
  const [bthAllowLan, setBthAllowLan] = useState(true)
  const [changeTicket, setChangeTicket] = useState('')
  const [routerForm, setRouterForm] = useState<RouterFormState>({
    name: '',
    ip_address: '',
    username: 'admin',
    password: '',
    api_port: '8728',
  })
  const [securityBusy, setSecurityBusy] = useState(false)
  const [enterpriseProfiles, setEnterpriseProfiles] = useState<EnterpriseProfilesPayload | null>(null)
  const [hardeningProfile, setHardeningProfile] = useState('baseline')
  const [hardeningSiteProfile, setHardeningSiteProfile] = useState('access')
  const [hardeningDryRun, setHardeningDryRun] = useState(true)
  const [hardeningAutoRollback, setHardeningAutoRollback] = useState(true)
  const [hardeningResult, setHardeningResult] = useState<EnterpriseHardeningResponse | null>(null)
  const [failoverTargets, setFailoverTargets] = useState('1.1.1.1,8.8.8.8,9.9.9.9')
  const [failoverCount, setFailoverCount] = useState('4')
  const [failoverResult, setFailoverResult] = useState<EnterpriseFailoverReport | null>(null)
  const [enterpriseChangeLog, setEnterpriseChangeLog] = useState<EnterpriseChangeLogEntry[]>([])

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

  const withChangeTicket = useCallback(
    (payload: Record<string, unknown> = {}) => {
      const ticket = changeTicket.trim()
      return ticket ? { ...payload, change_ticket: ticket } : payload
    },
    [changeTicket]
  )

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

  const loadEnterpriseProfiles = useCallback(
    async (routerId: string) => {
      try {
        const response = await apiFetch(`/api/mikrotik/routers/${routerId}/enterprise/hardening/profiles`)
        const payload = (await safeJson(response)) as EnterpriseProfilesResponse | null
        if (response.ok && payload?.success && payload.profiles) {
          const profiles = payload.profiles
          setEnterpriseProfiles(profiles)
          const defaultRouterProfile = profiles.router_profiles?.[0]?.id
          const defaultSiteProfile = profiles.site_profiles?.[0]?.id
          if (defaultRouterProfile) setHardeningProfile((prev) => prev || defaultRouterProfile)
          if (defaultSiteProfile) setHardeningSiteProfile((prev) => prev || defaultSiteProfile)
          return
        }
        setEnterpriseProfiles(null)
      } catch (error) {
        console.error('Error loading enterprise hardening profiles:', error)
        setEnterpriseProfiles(null)
      }
    },
    [apiFetch, safeJson]
  )

  const loadEnterpriseChangeLog = useCallback(
    async (routerId: string) => {
      try {
        const response = await apiFetch(`/api/mikrotik/routers/${routerId}/enterprise/change-log?limit=30`)
        const payload = (await safeJson(response)) as EnterpriseChangeLogResponse | null
        if (response.ok && payload?.success && Array.isArray(payload.changes)) {
          setEnterpriseChangeLog(payload.changes)
          return
        }
        setEnterpriseChangeLog([])
      } catch (error) {
        console.error('Error loading enterprise change-log:', error)
        setEnterpriseChangeLog([])
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
    loadEnterpriseProfiles(selectedRouter.id)
    loadEnterpriseChangeLog(selectedRouter.id)
    setAiAnalysis(null)
    setAiError(null)
    setBootstrapResult(null)
    setHardeningResult(null)
    setFailoverResult(null)
  }, [loadEnterpriseChangeLog, loadEnterpriseProfiles, loadQuickConnect, loadRouterStats, selectedRouter])

  const applyEnterpriseHardening = async () => {
    if (!selectedRouter) return
    setSecurityBusy(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/enterprise/hardening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withChangeTicket({
            dry_run: hardeningDryRun,
            profile: hardeningProfile,
            site_profile: hardeningSiteProfile,
            auto_rollback: hardeningAutoRollback,
          })
        ),
      })
      const payload = (await safeJson(response)) as EnterpriseHardeningResponse | null
      if (!response.ok || !payload) {
        addToast('error', payload?.error || 'No se pudo ejecutar hardening')
        return
      }
      setHardeningResult(payload)
      if (payload.success) {
        addToast('success', payload.message || 'Hardening ejecutado')
        if (!payload.dry_run) await loadEnterpriseChangeLog(selectedRouter.id)
      } else {
        addToast('error', payload.error || payload.message || 'No se pudo aplicar hardening')
      }
    } catch (error) {
      console.error('Error applying enterprise hardening:', error)
      addToast('error', 'Error de red ejecutando hardening')
    } finally {
      setSecurityBusy(false)
    }
  }

  const runEnterpriseFailoverTest = async () => {
    if (!selectedRouter) return
    const targets = failoverTargets
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
    if (!targets.length) {
      addToast('error', 'Ingresa al menos un target para failover test')
      return
    }

    const parsedCount = Number(failoverCount)
    const count = Number.isFinite(parsedCount) ? Math.max(1, Math.min(20, Math.floor(parsedCount))) : 4

    setSecurityBusy(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/enterprise/failover-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withChangeTicket({
            targets,
            count,
          })
        ),
      })
      const payload = (await safeJson(response)) as EnterpriseFailoverResponse | null
      if (!response.ok || !payload?.success || !payload.report) {
        addToast('error', payload?.error || 'No se pudo ejecutar failover test')
        return
      }
      setFailoverResult(payload.report)
      addToast('success', 'Failover test completado')
    } catch (error) {
      console.error('Error running enterprise failover test:', error)
      addToast('error', 'Error de red en failover test')
    } finally {
      setSecurityBusy(false)
    }
  }

  const rollbackEnterpriseChange = async (changeId: string) => {
    if (!selectedRouter || !changeId) return
    setSecurityBusy(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/enterprise/rollback/${changeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withChangeTicket({})),
      })
      const payload = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && payload?.success) {
        addToast('success', `Rollback ${changeId} ejecutado`)
        await loadEnterpriseChangeLog(selectedRouter.id)
      } else {
        addToast('error', payload?.error || 'No se pudo ejecutar rollback')
      }
    } catch (error) {
      console.error('Error rolling back enterprise change:', error)
      addToast('error', 'Error de red ejecutando rollback')
    } finally {
      setSecurityBusy(false)
    }
  }

  const rebootRouter = async () => {
    if (!selectedRouter) return
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/reboot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withChangeTicket({})),
      })
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
        body: JSON.stringify(withChangeTicket({ name: `backup_${new Date().toISOString()}` })),
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

  const enableBackToHome = async () => {
    if (!selectedRouter) return
    setBthActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/back-to-home/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withChangeTicket({ confirm: true })),
      })
      const payload = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && payload?.success) {
        addToast('success', 'Back To Home habilitado en router')
      } else {
        addToast('error', payload?.error || 'No se pudo habilitar Back To Home')
      }
      await loadQuickConnect(selectedRouter.id)
    } catch (error) {
      console.error('Error enabling Back To Home:', error)
      addToast('error', 'Error de red habilitando Back To Home')
    } finally {
      setBthActionLoading(false)
    }
  }

  const createBackToHomeUser = async () => {
    if (!selectedRouter) return
    const userName = bthUserName.trim()
    const privateKey = bthPrivateKey.trim()
    if (!userName) {
      addToast('error', 'Ingresa un nombre de usuario BTH')
      return
    }
    if (!privateKey) {
      addToast('error', 'Ingresa la private key WireGuard del VPS')
      return
    }
    setBthActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/back-to-home/users/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withChangeTicket({
            confirm: true,
            user_name: userName,
            private_key: privateKey,
            allow_lan: bthAllowLan,
            comment: 'FastISP VPS',
          })
        ),
      })
      const payload = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && payload?.success) {
        addToast('success', `Usuario BTH ${userName} creado`)
      } else {
        addToast('error', payload?.error || 'No se pudo crear usuario BTH')
      }
      await loadQuickConnect(selectedRouter.id)
    } catch (error) {
      console.error('Error creating Back To Home user:', error)
      addToast('error', 'Error de red creando usuario BTH')
    } finally {
      setBthActionLoading(false)
    }
  }

  const removeBackToHomeUser = async (userName: string) => {
    if (!selectedRouter || !userName.trim()) return
    setBthActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/back-to-home/users/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withChangeTicket({
            confirm: true,
            user_name: userName.trim(),
          })
        ),
      })
      const payload = (await safeJson(response)) as { success?: boolean; error?: string } | null
      if (response.ok && payload?.success) {
        addToast('success', `Usuario BTH ${userName} eliminado`)
      } else {
        addToast('error', payload?.error || 'No se pudo eliminar usuario BTH')
      }
      await loadQuickConnect(selectedRouter.id)
    } catch (error) {
      console.error('Error removing Back To Home user:', error)
      addToast('error', 'Error de red eliminando usuario BTH')
    } finally {
      setBthActionLoading(false)
    }
  }

  const bootstrapBackToHome = async () => {
    if (!selectedRouter) return
    const userName = bthUserName.trim()
    const privateKey = bthPrivateKey.trim()
    if (!userName) {
      addToast('error', 'Ingresa un nombre de usuario BTH')
      return
    }
    if (!privateKey) {
      addToast('error', 'Ingresa la private key WireGuard del VPS')
      return
    }

    setBthActionLoading(true)
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/back-to-home/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          withChangeTicket({
            confirm: true,
            user_name: userName,
            private_key: privateKey,
            allow_lan: bthAllowLan,
            replace_existing_user: true,
            comment: 'FastISP VPS',
          })
        ),
      })
      const payload = (await safeJson(response)) as RouterBackToHomeBootstrapResponse | null
      if (response.ok && payload?.success) {
        setBootstrapResult(payload.bootstrap || null)
        const pendingCount = Array.isArray(payload.bootstrap?.missing) ? payload.bootstrap?.missing.length : 0
        addToast('success', pendingCount > 0 ? `Bootstrap aplicado con ${pendingCount} pendiente(s)` : 'Bootstrap BTH aplicado correctamente')
      } else {
        addToast('error', payload?.error || 'No se pudo ejecutar bootstrap Back To Home')
      }
      await loadQuickConnect(selectedRouter.id)
    } catch (error) {
      console.error('Error bootstrapping Back To Home:', error)
      addToast('error', 'Error de red ejecutando bootstrap BTH')
    } finally {
      setBthActionLoading(false)
    }
  }

  const confirmEnableBackToHome = () => {
    if (!selectedRouter) return
    openConfirm(`Habilitar Back To Home en ${selectedRouter.name}?`, () => {
      void enableBackToHome()
    })
  }

  const confirmCreateBackToHomeUser = () => {
    if (!selectedRouter) return
    const userName = bthUserName.trim()
    const privateKey = bthPrivateKey.trim()
    if (!userName) {
      addToast('error', 'Ingresa un nombre de usuario BTH')
      return
    }
    if (!privateKey) {
      addToast('error', 'Ingresa la private key WireGuard del VPS')
      return
    }
    openConfirm(`Crear usuario Back To Home ${userName} en ${selectedRouter.name}?`, () => {
      void createBackToHomeUser()
    })
  }

  const confirmBootstrapBackToHome = () => {
    if (!selectedRouter) return
    const userName = bthUserName.trim()
    const privateKey = bthPrivateKey.trim()
    if (!userName) {
      addToast('error', 'Ingresa un nombre de usuario BTH')
      return
    }
    if (!privateKey) {
      addToast('error', 'Ingresa la private key WireGuard del VPS')
      return
    }
    openConfirm(`Aplicar bootstrap BTH 1 clic en ${selectedRouter.name} para usuario ${userName}?`, () => {
      void bootstrapBackToHome()
    })
  }

  const confirmRemoveBackToHomeUser = (userName: string) => {
    if (!selectedRouter) return
    openConfirm(`Eliminar usuario Back To Home ${userName} de ${selectedRouter.name}?`, () => {
      void removeBackToHomeUser(userName)
    })
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Control de cambios</p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={changeTicket}
            onChange={(e) => setChangeTicket(e.target.value)}
            placeholder="Ticket de cambio (ej: CHG-2026-0001)"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 md:max-w-md"
          />
          <p className="text-xs text-amber-800">
            Se usa para acciones live (reinicio, scripts y operacion Back To Home).
          </p>
        </div>
      </div>

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

                            <div className="rounded border border-gray-300 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase text-gray-600">Acciones operativas BTH</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={confirmBootstrapBackToHome}
                                    disabled={bthActionLoading || !quickConnect.back_to_home.reachable}
                                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {bthActionLoading ? 'Procesando...' : 'Bootstrap 1 clic'}
                                  </button>
                                  <button
                                    onClick={confirmEnableBackToHome}
                                    disabled={bthActionLoading || !quickConnect.back_to_home.reachable}
                                    className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                  >
                                    {bthActionLoading ? 'Procesando...' : 'Solo habilitar BTH'}
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-600">
                                Bootstrap 1 clic aplica DDNS + BTH + usuario VPS. "Solo habilitar" mantiene el flujo manual.
                              </p>

                              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                <input
                                  value={bthUserName}
                                  onChange={(e) => setBthUserName(e.target.value)}
                                  placeholder="Usuario BTH (ej: noc-vps)"
                                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                                />
                                <input
                                  type="password"
                                  value={bthPrivateKey}
                                  onChange={(e) => setBthPrivateKey(e.target.value)}
                                  placeholder="Private key WireGuard del VPS"
                                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                                />
                              </div>

                              <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={bthAllowLan}
                                  onChange={(e) => setBthAllowLan(e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                Permitir acceso LAN desde este usuario BTH
                              </label>

                              <div className="mt-3">
                                <button
                                  onClick={confirmCreateBackToHomeUser}
                                  disabled={bthActionLoading || quickConnect.back_to_home.bth_users_supported === false}
                                  className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {bthActionLoading ? 'Procesando...' : 'Crear usuario BTH para VPS'}
                                </button>
                                {quickConnect.back_to_home.bth_users_supported === false && (
                                  <p className="mt-2 text-xs text-amber-700">
                                    Este router no expone API de usuarios BTH. Requiere RouterOS 7.14+.
                                  </p>
                                )}
                              </div>

                              {bootstrapResult && (
                                <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2">
                                  <p className="text-xs font-semibold uppercase text-slate-700">Resultado bootstrap</p>
                                  <p className="mt-1 text-xs text-slate-700">
                                    Usuario visible despues de ejecutar: <strong>{String(bootstrapResult.user_visible_after_run ?? false)}</strong>
                                  </p>
                                  {Array.isArray(bootstrapResult.missing) && bootstrapResult.missing.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-xs text-amber-700">
                                      {bootstrapResult.missing.map((item, idx) => (
                                        <li key={`${item}-${idx}`}>- {item}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {Array.isArray(bootstrapResult.next_steps) && bootstrapResult.next_steps.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                      {bootstrapResult.next_steps.map((item, idx) => (
                                        <li key={`${item}-${idx}`}>- {item}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>

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
                                <ul className="mt-2 space-y-2 text-xs text-gray-700">
                                  {quickConnect.back_to_home.users.map((user, idx) => (
                                    <li key={`${user.name}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 px-2 py-1">
                                      <span>
                                        {user.name} | allow-lan: {String(user.allow_lan)} | disabled: {String(user.disabled)} | expires: {user.expires || '-'}
                                      </span>
                                      <button
                                        onClick={() => confirmRemoveBackToHomeUser(user.name)}
                                        disabled={bthActionLoading || !user.name}
                                        className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                      >
                                        Eliminar
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(quickConnect.back_to_home.limitations) && quickConnect.back_to_home.limitations.length > 0 && (
                              <div className="rounded border border-gray-300 bg-white p-2">
                                <p className="text-xs font-semibold uppercase text-gray-600">Limitaciones BTH</p>
                                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                                  {quickConnect.back_to_home.limitations.map((item, idx) => (
                                    <li key={idx}>- {item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {quickConnect.back_to_home.users_error && (
                              <p className="text-xs text-amber-700">No fue posible leer usuarios BTH: {quickConnect.back_to_home.users_error}</p>
                            )}
                            {quickConnect.back_to_home.error && (
                              <p className="text-xs text-rose-700">Error BTH: {quickConnect.back_to_home.error}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {activeTab === 'security' && (
                  <div className="space-y-4 text-sm text-gray-700">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <h4 className="text-lg font-semibold text-gray-900">Operacion enterprise y seguridad</h4>
                      <p className="mt-1 text-xs text-gray-600">
                        Acciones live requieren ticket de cambio cuando la politica `change_control_required_for_live` esta activa.
                      </p>
                      {(quickConnect?.guidance?.notes || []).map((note, idx) => (
                        <p key={idx} className="mt-2 text-xs text-gray-700">
                          - {note}
                        </p>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">Hardening runbook</p>
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${hardeningDryRun ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {hardeningDryRun ? 'dry-run' : 'live'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <label className="text-xs text-gray-700">
                            Perfil router
                            <select
                              value={hardeningProfile}
                              onChange={(e) => setHardeningProfile(e.target.value)}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                            >
                              {(enterpriseProfiles?.router_profiles || [{ id: 'baseline', label: 'Baseline' }]).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs text-gray-700">
                            Perfil sitio
                            <select
                              value={hardeningSiteProfile}
                              onChange={(e) => setHardeningSiteProfile(e.target.value)}
                              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                            >
                              {(enterpriseProfiles?.site_profiles || [{ id: 'access', label: 'Access' }]).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={hardeningDryRun}
                              onChange={(e) => setHardeningDryRun(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            Ejecutar dry-run
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={hardeningAutoRollback}
                              onChange={(e) => setHardeningAutoRollback(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            Auto rollback si falla live
                          </label>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={applyEnterpriseHardening}
                            disabled={securityBusy}
                            className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {securityBusy ? 'Procesando...' : hardeningDryRun ? 'Ejecutar hardening dry-run' : 'Aplicar hardening live'}
                          </button>
                          <button
                            onClick={() => selectedRouter && loadEnterpriseProfiles(selectedRouter.id)}
                            disabled={securityBusy}
                            className="rounded bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-60"
                          >
                            Refrescar perfiles
                          </button>
                        </div>

                        {hardeningResult && (
                          <div className="mt-3 rounded border border-gray-300 bg-gray-50 p-2">
                            <p className="text-xs font-semibold uppercase text-gray-700">Resultado hardening</p>
                            <p className="mt-1 text-xs text-gray-700">
                              change_id: <strong>{hardeningResult.change_id || '-'}</strong> | modo:{' '}
                              <strong>{hardeningResult.dry_run ? 'dry-run' : 'live'}</strong>
                            </p>
                            {hardeningResult.message && <p className="mt-1 text-xs text-gray-700">{hardeningResult.message}</p>}
                            {hardeningResult.error && <p className="mt-1 text-xs text-rose-700">{hardeningResult.error}</p>}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <p className="text-sm font-semibold text-gray-900">Failover test</p>
                        <p className="mt-1 text-xs text-gray-600">
                          Ejecuta probes desde el router para validar perdida de paquetes y latencia.
                        </p>
                        <textarea
                          value={failoverTargets}
                          onChange={(e) => setFailoverTargets(e.target.value)}
                          rows={3}
                          placeholder="1.1.1.1,8.8.8.8,9.9.9.9"
                          className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={failoverCount}
                            onChange={(e) => setFailoverCount(e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                          />
                          <button
                            onClick={runEnterpriseFailoverTest}
                            disabled={securityBusy}
                            className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {securityBusy ? 'Procesando...' : 'Ejecutar failover test'}
                          </button>
                        </div>

                        {failoverResult && (
                          <div className="mt-3 rounded border border-gray-300 bg-gray-50 p-2">
                            <p className="text-xs font-semibold uppercase text-gray-700">
                              Estado general: <span className="font-bold">{failoverResult.overall_status || 'unknown'}</span>
                            </p>
                            <div className="mt-2 max-h-44 overflow-auto">
                              {(failoverResult.targets || []).map((item, idx) => (
                                <p key={`${item.target}-${idx}`} className="text-xs text-gray-700">
                                  {item.target} | loss {item.packet_loss}% | avg {item.avg_latency_ms ?? '-'} ms | {item.status}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">Change log y rollback</p>
                        <button
                          onClick={() => selectedRouter && loadEnterpriseChangeLog(selectedRouter.id)}
                          disabled={securityBusy}
                          className="rounded bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-300 disabled:opacity-60"
                        >
                          Refrescar log
                        </button>
                      </div>
                      {!enterpriseChangeLog.length && <p className="mt-2 text-xs text-gray-500">No hay cambios registrados.</p>}
                      <div className="mt-2 space-y-2">
                        {enterpriseChangeLog.map((entry) => (
                          <div key={entry.change_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 px-2 py-2">
                            <div className="text-xs text-gray-700">
                              <p>
                                <strong>{entry.change_id}</strong> | {entry.category || '-'} | {entry.status}
                              </p>
                              <p>
                                actor: {entry.actor || '-'} | profile: {entry.profile || '-'} | site: {entry.site_profile || '-'}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                openConfirm(`Ejecutar rollback del cambio ${entry.change_id}?`, () => {
                                  void rollbackEnterpriseChange(entry.change_id)
                                })
                              }
                              disabled={securityBusy || entry.status !== 'applied'}
                              className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              Rollback
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
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
