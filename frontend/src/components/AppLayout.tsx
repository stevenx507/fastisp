import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog, Menu, Transition } from '@headlessui/react'
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  ClockIcon,
  GlobeAltIcon,
  HandThumbUpIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PlusCircleIcon,
  PresentationChartLineIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  HomeIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
  SquaresPlusIcon,
  UsersIcon,
  WrenchScrewdriverIcon as InstallIcon,
  WrenchScrewdriverIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'
import { safeStorage } from '../lib/storage'

type DashboardView =
  | 'dashboard'
  | 'clients'
  | 'finance'
  | 'licensing'
  | 'system'
  | 'hotspot'
  | 'warehouse'
  | 'staff'
  | 'settings'
  | 'company'
  | 'affiliate'
  | 'manual'
  | 'resources'
type ClientsTab =
  | 'list'
  | 'search'
  | 'installations'
  | 'announcements'
  | 'traffic'
  | 'map'
  | 'stats'
  | 'push'
  | 'services'
  | 'tickets-new'
  | 'tickets-progress'
  | 'tickets-closed'
  | 'tickets-search'
  | 'stats-tickets-month'
  | 'stats-tickets-closure'
  | 'stats-staff-departments'
type FinanceTab =
  | 'dashboard'
  | 'pending-payments'
  | 'invoices'
  | 'payment-report'
  | 'search-invoices'
  | 'payment-promises'
  | 'other-income'
  | 'expenses'
  | 'statistics'
  | 'collection-cards'
  | 'accounting'
  | 'payment-methods'
  | 'payments-list'
  | 'gateway-subscriptions'
  | 'electronic-invoices'
  | 'excel-payments'
  | 'client-reconciliation'
type SystemTab =
  | 'router'
  | 'internet-plan'
  | 'phone-tv-plan'
  | 'zones'
  | 'sector-node-nap'
  | 'periodic-tasks'
  | 'templates'
  | 'vpn-access'
  | 'admin-olt'
  | 'subdomains'
  | 'directory-isp'
type HotspotTab = 'routers' | 'plans-prefixes' | 'create-vouchers' | 'pos' | 'cash-close' | 'templates'
type WarehouseTab = 'dashboard' | 'network-stock' | 'network-list' | 'other-articles' | 'other-services' | 'suppliers' | 'branches' | 'assign-staff' | 'log'
type SettingsTab =
  | 'mail-server'
  | 'billing'
  | 'billing-electronic'
  | 'payment-gateways'
  | 'whatsapp-sms'
  | 'google-maps'
  | 'clients-excel'
  | 'visible-columns'
  | 'client-portal'
  | 'mobile-app'
  | 'bulk-actions'
  | 'maintenance'
  | 'ai'

type AppLayoutProps = {
  children?: React.ReactNode
}

type ExpandedMenus = {
  clients: boolean
  finance: boolean
  system: boolean
  hotspot: boolean
  warehouse: boolean
  settings: boolean
}

type UiTheme = 'azure' | 'emerald' | 'platinum'

const DEFAULT_EXPANDED_MENUS: ExpandedMenus = {
  clients: true,
  finance: true,
  system: true,
  hotspot: true,
  warehouse: true,
  settings: true
}

const sidebarItems: Array<{ id: DashboardView; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'clients', label: 'Clientes', icon: UsersIcon },
  { id: 'finance', label: 'Finanzas', icon: CurrencyDollarIcon },
  { id: 'licensing', label: 'Licencias ISP', icon: CurrencyDollarIcon },
  { id: 'system', label: 'Sistema', icon: WrenchScrewdriverIcon },
  { id: 'hotspot', label: 'Fichas HotSpot', icon: PresentationChartLineIcon },
  { id: 'warehouse', label: 'Almacen', icon: BuildingOffice2Icon },
  { id: 'staff', label: 'Staff', icon: UsersIcon },
  { id: 'settings', label: 'Ajustes', icon: Cog6ToothIcon },
  { id: 'company', label: 'Mi empresa', icon: BuildingOffice2Icon },
  { id: 'affiliate', label: 'Afiliado', icon: HandThumbUpIcon },
  { id: 'manual', label: 'Manual', icon: BookOpenIcon },
  { id: 'resources', label: 'Recursos Adicionales', icon: SquaresPlusIcon }
]

const viewIds = new Set(sidebarItems.map((item) => item.id))
const clientTabIds = new Set<ClientsTab>([
  'list',
  'search',
  'installations',
  'announcements',
  'traffic',
  'map',
  'stats',
  'push',
  'services',
  'tickets-new',
  'tickets-progress',
  'tickets-closed',
  'tickets-search',
  'stats-tickets-month',
  'stats-tickets-closure',
  'stats-staff-departments'
])
const financeTabIds = new Set<FinanceTab>([
  'dashboard',
  'pending-payments',
  'invoices',
  'payment-report',
  'search-invoices',
  'payment-promises',
  'other-income',
  'expenses',
  'statistics',
  'collection-cards',
  'accounting',
  'payment-methods',
  'payments-list',
  'gateway-subscriptions',
  'electronic-invoices',
  'excel-payments',
  'client-reconciliation'
])
const systemTabIds = new Set<SystemTab>([
  'router',
  'internet-plan',
  'phone-tv-plan',
  'zones',
  'sector-node-nap',
  'periodic-tasks',
  'templates',
  'vpn-access',
  'admin-olt',
  'subdomains',
  'directory-isp'
])
const hotspotTabIds = new Set<HotspotTab>(['routers', 'plans-prefixes', 'create-vouchers', 'pos', 'cash-close', 'templates'])
const warehouseTabIds = new Set<WarehouseTab>(['dashboard', 'network-stock', 'network-list', 'other-articles', 'other-services', 'suppliers', 'branches', 'assign-staff', 'log'])
const settingsTabIds = new Set<SettingsTab>([
  'mail-server',
  'billing',
  'billing-electronic',
  'payment-gateways',
  'whatsapp-sms',
  'google-maps',
  'clients-excel',
  'visible-columns',
  'client-portal',
  'mobile-app',
  'bulk-actions',
  'maintenance',
  'ai'
])

const clientSubItems: Array<{ id: ClientsTab; label: string; icon: React.ElementType }> = [
  { id: 'list', label: 'Lista Clientes', icon: ListBulletIcon },
  { id: 'search', label: 'Buscar Clientes', icon: MagnifyingGlassIcon },
  { id: 'installations', label: 'Instalaciones', icon: InstallIcon },
  { id: 'tickets-new', label: 'Tickets Nuevos', icon: PlusCircleIcon },
  { id: 'tickets-progress', label: 'En Progreso', icon: ClockIcon },
  { id: 'tickets-closed', label: 'Cerrados y Resueltos', icon: CheckCircleIcon },
  { id: 'tickets-search', label: 'Buscar Tickets', icon: MagnifyingGlassIcon },
  { id: 'announcements', label: 'Avisos en Pantalla', icon: MegaphoneIcon },
  { id: 'traffic', label: 'Trafico', icon: PresentationChartLineIcon },
  { id: 'map', label: 'Mapa de Clientes', icon: MapPinIcon },
  { id: 'stats', label: 'Estadisticas', icon: ChartBarSquareIcon },
  { id: 'stats-tickets-month', label: 'Tickets Por Mes', icon: CalendarDaysIcon },
  { id: 'stats-tickets-closure', label: 'Tickets Nuevos y Cerrados', icon: GlobeAltIcon },
  { id: 'stats-staff-departments', label: 'Staff y Departamentos', icon: UsersIcon },
  { id: 'push', label: 'Notificaciones Push', icon: PaperAirplaneIcon },
  { id: 'services', label: 'Servicios Adicionales', icon: CalendarDaysIcon }
]

const financeSubItems: Array<{ id: FinanceTab; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'pending-payments', label: 'Pagos pendientes', icon: CurrencyDollarIcon },
  { id: 'invoices', label: 'Facturas', icon: ListBulletIcon },
  { id: 'payment-report', label: 'Reporte de Pagos', icon: ChartBarSquareIcon },
  { id: 'search-invoices', label: 'Buscar Facturas', icon: MagnifyingGlassIcon },
  { id: 'payment-promises', label: 'Promesas de Pago', icon: CalendarDaysIcon },
  { id: 'other-income', label: 'Otros Ingresos', icon: CurrencyDollarIcon },
  { id: 'expenses', label: 'Gastos', icon: PresentationChartLineIcon },
  { id: 'statistics', label: 'Estadisticas', icon: ChartBarSquareIcon },
  { id: 'collection-cards', label: 'Tarjetas Cobranza', icon: CalendarDaysIcon },
  { id: 'accounting', label: 'Contabilidad', icon: Cog6ToothIcon },
  { id: 'payment-methods', label: 'Formas de Pagos', icon: ListBulletIcon },
  { id: 'payments-list', label: 'Lista Pagos', icon: ListBulletIcon },
  { id: 'gateway-subscriptions', label: 'Suscripciones Pasarelas', icon: PaperAirplaneIcon },
  { id: 'electronic-invoices', label: 'Facturas Electronicas', icon: BookOpenIcon },
  { id: 'excel-payments', label: 'Registrar Pagos desde Excel', icon: WrenchScrewdriverIcon },
  { id: 'client-reconciliation', label: 'Conciliacion clientes', icon: QuestionMarkCircleIcon }
]

const systemSubItems: Array<{ id: SystemTab; label: string; icon: React.ElementType }> = [
  { id: 'router', label: 'Router', icon: WrenchScrewdriverIcon },
  { id: 'internet-plan', label: 'Plan de Internet', icon: PresentationChartLineIcon },
  { id: 'phone-tv-plan', label: 'Plan de Telefonia y Television', icon: MegaphoneIcon },
  { id: 'zones', label: 'Zonas', icon: MapPinIcon },
  { id: 'sector-node-nap', label: 'Sectorial/Nodo/NAP', icon: ChartBarSquareIcon },
  { id: 'periodic-tasks', label: 'Tareas Periodicas', icon: CalendarDaysIcon },
  { id: 'templates', label: 'Plantillas', icon: BookOpenIcon },
  { id: 'vpn-access', label: 'Acceso remoto VPN', icon: ArrowLeftOnRectangleIcon },
  { id: 'admin-olt', label: 'AdminOLT', icon: Cog6ToothIcon },
  { id: 'subdomains', label: 'Subdominios', icon: GlobeAltIcon },
  { id: 'directory-isp', label: 'DirectorioISP', icon: BuildingOffice2Icon }
]

const hotspotSubItems: Array<{ id: HotspotTab; label: string; icon: React.ElementType }> = [
  { id: 'routers', label: 'Routers', icon: WrenchScrewdriverIcon },
  { id: 'plans-prefixes', label: 'Lista Planes/Prefijos', icon: ListBulletIcon },
  { id: 'create-vouchers', label: 'Crear Fichas', icon: PlusCircleIcon },
  { id: 'pos', label: 'Puntos de Venta', icon: BuildingOffice2Icon },
  { id: 'cash-close', label: 'Corte de Caja General', icon: CurrencyDollarIcon },
  { id: 'templates', label: 'Plantillas', icon: BookOpenIcon }
]

const warehouseSubItems: Array<{ id: WarehouseTab; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
  { id: 'network-stock', label: 'Stock Dispositivos de Red', icon: CurrencyDollarIcon },
  { id: 'network-list', label: 'Lista Dispositivos de Red', icon: ListBulletIcon },
  { id: 'other-articles', label: 'Otros Articulos', icon: PlusCircleIcon },
  { id: 'other-services', label: 'Otros Servicios', icon: WrenchScrewdriverIcon },
  { id: 'suppliers', label: 'Proveedores', icon: BuildingOffice2Icon },
  { id: 'branches', label: 'Sucursales', icon: MapPinIcon },
  { id: 'assign-staff', label: 'Asignar Articulos Staff', icon: UsersIcon },
  { id: 'log', label: 'Log', icon: BookOpenIcon }
]

const settingsSubItems: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: 'mail-server', label: 'Servidor Correo', icon: PaperAirplaneIcon },
  { id: 'billing', label: 'Facturacion', icon: CurrencyDollarIcon },
  { id: 'billing-electronic', label: 'Facturacion Electronica', icon: BookOpenIcon },
  { id: 'payment-gateways', label: 'Pasarelas de Pago', icon: CurrencyDollarIcon },
  { id: 'whatsapp-sms', label: 'WhatsApp/SMS', icon: MegaphoneIcon },
  { id: 'google-maps', label: 'Google Maps', icon: MapPinIcon },
  { id: 'clients-excel', label: 'Clientes desde Excel', icon: ListBulletIcon },
  { id: 'visible-columns', label: 'Columnas Visibles', icon: ChartBarSquareIcon },
  { id: 'client-portal', label: 'Portal del Cliente', icon: HomeIcon },
  { id: 'mobile-app', label: 'Aplicacion Movil', icon: QuestionMarkCircleIcon },
  { id: 'bulk-actions', label: 'Acciones Masivas', icon: PlusCircleIcon },
  { id: 'maintenance', label: 'Mantenimiento', icon: WrenchScrewdriverIcon },
  { id: 'ai', label: 'IA', icon: Cog6ToothIcon }
]

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
  const [sidebarQuery, setSidebarQuery] = useState('')
  const [expandedMenus, setExpandedMenus] = useState<ExpandedMenus>(DEFAULT_EXPANDED_MENUS)
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'Se registro un nuevo pago.', time: 'Hace 3 min', read: false },
    { id: 2, message: 'Ticket #982 actualizado.', time: 'Hace 25 min', read: false },
    { id: 3, message: 'Backup diario completado.', time: 'Hace 1 h', read: true }
  ])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null)
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const storedTheme = safeStorage.getItem('ispfast.ui.theme')
    if (storedTheme === 'azure' || storedTheme === 'emerald' || storedTheme === 'platinum') {
      return storedTheme
    }
    return 'azure'
  })

  const { user, logout } = useAuthStore()
  const userName = user?.name || 'Usuario'
  const userEmail = user?.email || 'admin@ispmax.local'
  const unreadCount = notifications.filter((item) => !item.read).length

  const allowedViews = useMemo(
    () => sidebarItems.filter((item) => (item.id === 'licensing' ? user?.role === 'admin' : true)).map((item) => item.id),
    [user]
  )

  const activeView: DashboardView = useMemo(() => {
    const raw = searchParams.get('view')
    const candidate = raw && viewIds.has(raw as DashboardView) ? (raw as DashboardView) : 'dashboard'
    if (candidate === 'licensing' && user?.role !== 'admin') return 'dashboard'
    return allowedViews.includes(candidate) ? candidate : 'dashboard'
  }, [allowedViews, searchParams, user])

  const activeClientsTab: ClientsTab = useMemo(() => {
    const raw = searchParams.get('clientsTab')
    return raw && clientTabIds.has(raw as ClientsTab) ? (raw as ClientsTab) : 'list'
  }, [searchParams])

  const activeFinanceTab: FinanceTab = useMemo(() => {
    const raw = searchParams.get('financeTab')
    return raw && financeTabIds.has(raw as FinanceTab) ? (raw as FinanceTab) : 'dashboard'
  }, [searchParams])

  const activeSystemTab: SystemTab = useMemo(() => {
    const raw = searchParams.get('systemTab')
    return raw && systemTabIds.has(raw as SystemTab) ? (raw as SystemTab) : 'router'
  }, [searchParams])

  const activeHotspotTab: HotspotTab = useMemo(() => {
    const raw = searchParams.get('hotspotTab')
    return raw && hotspotTabIds.has(raw as HotspotTab) ? (raw as HotspotTab) : 'routers'
  }, [searchParams])

  const activeWarehouseTab: WarehouseTab = useMemo(() => {
    const raw = searchParams.get('warehouseTab')
    return raw && warehouseTabIds.has(raw as WarehouseTab) ? (raw as WarehouseTab) : 'dashboard'
  }, [searchParams])

  const activeSettingsTab: SettingsTab = useMemo(() => {
    const raw = searchParams.get('settingsTab')
    return raw && settingsTabIds.has(raw as SettingsTab) ? (raw as SettingsTab) : 'mail-server'
  }, [searchParams])

  const activeLabel = useMemo(() => {
    if (activeView === 'clients') {
      return clientSubItems.find((item) => item.id === activeClientsTab)?.label || 'Clientes'
    }
    if (activeView === 'finance') {
      return financeSubItems.find((item) => item.id === activeFinanceTab)?.label || 'Finanzas'
    }
    if (activeView === 'system') {
      return systemSubItems.find((item) => item.id === activeSystemTab)?.label || 'Sistema'
    }
    if (activeView === 'hotspot') {
      return hotspotSubItems.find((item) => item.id === activeHotspotTab)?.label || 'Fichas HotSpot'
    }
    if (activeView === 'warehouse') {
      return warehouseSubItems.find((item) => item.id === activeWarehouseTab)?.label || 'Almacen'
    }
    if (activeView === 'settings') {
      return settingsSubItems.find((item) => item.id === activeSettingsTab)?.label || 'Ajustes'
    }
    return sidebarItems.find((item) => item.id === activeView)?.label || 'Dashboard'
  }, [activeClientsTab, activeFinanceTab, activeHotspotTab, activeSettingsTab, activeSystemTab, activeView, activeWarehouseTab])

  const sidebarQueryNormalized = sidebarQuery.trim().toLowerCase()
  const sidebarHasMatches = useMemo(() => {
    if (!sidebarQueryNormalized) return true
    const matchesRoot = sidebarItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized))
    const matchesSubmenu =
      clientSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized)) ||
      financeSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized)) ||
      systemSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized)) ||
      hotspotSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized)) ||
      warehouseSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized)) ||
      settingsSubItems.some((item) => item.label.toLowerCase().includes(sidebarQueryNormalized))
    return matchesRoot || matchesSubmenu
  }, [sidebarQueryNormalized])

  const currentTimeLabel = useMemo(
    () =>
      currentTime.toLocaleString('es-PE', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
    [currentTime]
  )

  useEffect(() => {
    try {
      const collapsedRaw = safeStorage.getItem('ispfast.sidebar.collapsed')
      if (collapsedRaw !== null) {
        setDesktopSidebarCollapsed(collapsedRaw === '1')
      }
      const expandedRaw = safeStorage.getItem('ispfast.sidebar.expanded')
      if (expandedRaw) {
        const parsed = JSON.parse(expandedRaw) as Partial<ExpandedMenus>
        setExpandedMenus((prev) => ({ ...prev, ...parsed }))
      }
    } catch {
      // keep defaults when local storage is unavailable or malformed
    }
  }, [])

  useEffect(() => {
    safeStorage.setItem('ispfast.sidebar.collapsed', desktopSidebarCollapsed ? '1' : '0')
  }, [desktopSidebarCollapsed])

  useEffect(() => {
    safeStorage.setItem('ispfast.sidebar.expanded', JSON.stringify(expandedMenus))
  }, [expandedMenus])

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme)
    safeStorage.setItem('ispfast.ui.theme', uiTheme)
  }, [uiTheme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!sidebarOpen && window.innerWidth < 1024) {
          setSidebarOpen(true)
        }
        if (desktopSidebarCollapsed) {
          setDesktopSidebarCollapsed(false)
        }
        window.setTimeout(() => sidebarSearchRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [desktopSidebarCollapsed, sidebarOpen])

  const selectView = (view: DashboardView) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', view)
    if (view !== 'clients') params.delete('clientsTab')
    if (view !== 'finance') params.delete('financeTab')
    if (view !== 'system') params.delete('systemTab')
    if (view !== 'hotspot') params.delete('hotspotTab')
    if (view !== 'warehouse') params.delete('warehouseTab')
    if (view !== 'settings') params.delete('settingsTab')
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectClientsTab = (tab: ClientsTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'clients')
    params.set('clientsTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectFinanceTab = (tab: FinanceTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'finance')
    params.set('financeTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectSystemTab = (tab: SystemTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'system')
    params.set('systemTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectHotspotTab = (tab: HotspotTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'hotspot')
    params.set('hotspotTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectWarehouseTab = (tab: WarehouseTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'warehouse')
    params.set('warehouseTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const selectSettingsTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', 'settings')
    params.set('settingsTab', tab)
    setSearchParams(params, { replace: true })
    setSidebarOpen(false)
  }

  const markAsRead = (id: number) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = ({ mobile = false, collapsed = false }: { mobile?: boolean; collapsed?: boolean }) => (
    <div className="enterprise-sidebar flex h-full flex-col text-gray-200">
      <div className={`border-b border-white/10 px-4 py-4 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-[#1f6f9a] shadow ${collapsed ? 'mb-2' : ''}`}>SS</div>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-500 font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-gray-300">Administrador</p>
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <div className="border-b border-white/10 px-3 py-3">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70" />
            <input
              ref={sidebarSearchRef}
              value={sidebarQuery}
              onChange={(event) => setSidebarQuery(event.target.value)}
              placeholder="Buscar modulo o funcion (Ctrl+K)"
              className="w-full rounded-lg border border-white/15 bg-[#0f182b] py-2 pl-9 pr-8 text-xs text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
            />
            {sidebarQuery ? (
              <button
                onClick={() => setSidebarQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Limpiar busqueda"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="enterprise-sidebar-nav flex-1 overflow-y-auto py-1">
        {sidebarItems
          .filter((item) => (item.id === 'licensing' ? user?.role === 'admin' : true))
          .map((item) => {
          const isActive = activeView === item.id
          const isClients = item.id === 'clients'
          const isFinance = item.id === 'finance'
          const isSystem = item.id === 'system'
          const isHotspot = item.id === 'hotspot'
          const isWarehouse = item.id === 'warehouse'
          const isSettings = item.id === 'settings'

          const visibleClientSubItems = sidebarQueryNormalized ? clientSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : clientSubItems
          const visibleFinanceSubItems = sidebarQueryNormalized ? financeSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : financeSubItems
          const visibleSystemSubItems = sidebarQueryNormalized ? systemSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : systemSubItems
          const visibleHotspotSubItems = sidebarQueryNormalized ? hotspotSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : hotspotSubItems
          const visibleWarehouseSubItems = sidebarQueryNormalized ? warehouseSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : warehouseSubItems
          const visibleSettingsSubItems = sidebarQueryNormalized ? settingsSubItems.filter((subItem) => subItem.label.toLowerCase().includes(sidebarQueryNormalized)) : settingsSubItems

          const matchesParent = sidebarQueryNormalized ? item.label.toLowerCase().includes(sidebarQueryNormalized) : true
          const hasMatchInSubmenu =
            (isClients && visibleClientSubItems.length > 0) ||
            (isFinance && visibleFinanceSubItems.length > 0) ||
            (isSystem && visibleSystemSubItems.length > 0) ||
            (isHotspot && visibleHotspotSubItems.length > 0) ||
            (isWarehouse && visibleWarehouseSubItems.length > 0) ||
            (isSettings && visibleSettingsSubItems.length > 0)

          if (sidebarQueryNormalized && !matchesParent && !hasMatchInSubmenu) {
            return null
          }

          const clientsExpanded = (expandedMenus.clients || !!sidebarQueryNormalized) && !collapsed
          const financeExpanded = (expandedMenus.finance || !!sidebarQueryNormalized) && !collapsed
          const systemExpanded = (expandedMenus.system || !!sidebarQueryNormalized) && !collapsed
          const hotspotExpanded = (expandedMenus.hotspot || !!sidebarQueryNormalized) && !collapsed
          const warehouseExpanded = (expandedMenus.warehouse || !!sidebarQueryNormalized) && !collapsed
          const settingsExpanded = (expandedMenus.settings || !!sidebarQueryNormalized) && !collapsed

          return (
            <div key={item.id} className="border-b border-white/5">
              <button
                onClick={() => {
                  if (isClients) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, clients: !prev.clients }))
                    if (activeView !== 'clients') selectClientsTab('list')
                    return
                  }
                  if (isFinance) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, finance: !prev.finance }))
                    if (activeView !== 'finance') selectFinanceTab('dashboard')
                    return
                  }
                  if (isSystem) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, system: !prev.system }))
                    if (activeView !== 'system') selectSystemTab('router')
                    return
                  }
                  if (isHotspot) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, hotspot: !prev.hotspot }))
                    if (activeView !== 'hotspot') selectHotspotTab('routers')
                    return
                  }
                  if (isWarehouse) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, warehouse: !prev.warehouse }))
                    if (activeView !== 'warehouse') selectWarehouseTab('dashboard')
                    return
                  }
                  if (isSettings) {
                    if (collapsed && !mobile) {
                      setDesktopSidebarCollapsed(false)
                    }
                    setExpandedMenus((prev) => ({ ...prev, settings: !prev.settings }))
                    if (activeView !== 'settings') selectSettingsTab('mail-server')
                    return
                  }
                  selectView(item.id)
                }}
                className={`flex w-full items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 text-left text-sm transition ${
                  isActive ? 'bg-[#2a3e62] text-white shadow-inner shadow-cyan-900/40' : 'text-slate-200 hover:bg-[#1f304e]'
                }`}
              >
                <item.icon className="h-5 w-5 text-cyan-100/80" />
                {!collapsed ? <span className="flex-1">{item.label}</span> : null}
                {(isClients || isFinance || isSystem || isHotspot || isWarehouse || isSettings) && !collapsed ? (
                  <ChevronDownIcon
                    className={`h-4 w-4 transition ${
                      isClients
                        ? (clientsExpanded ? 'rotate-180' : '')
                        : isFinance
                          ? (financeExpanded ? 'rotate-180' : '')
                          : isSystem
                            ? (systemExpanded ? 'rotate-180' : '')
                            : isHotspot
                              ? (hotspotExpanded ? 'rotate-180' : '')
                              : isWarehouse
                                ? (warehouseExpanded ? 'rotate-180' : '')
                                : settingsExpanded
                                  ? 'rotate-180'
                                  : ''
                    }`}
                  />
                ) : null}
              </button>

              {isClients && clientsExpanded && visibleClientSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleClientSubItems.map((subItem) => {
                    const subActive = activeView === 'clients' && activeClientsTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectClientsTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isFinance && financeExpanded && visibleFinanceSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleFinanceSubItems.map((subItem) => {
                    const subActive = activeView === 'finance' && activeFinanceTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectFinanceTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isSystem && systemExpanded && visibleSystemSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleSystemSubItems.map((subItem) => {
                    const subActive = activeView === 'system' && activeSystemTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectSystemTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isHotspot && hotspotExpanded && visibleHotspotSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleHotspotSubItems.map((subItem) => {
                    const subActive = activeView === 'hotspot' && activeHotspotTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectHotspotTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isWarehouse && warehouseExpanded && visibleWarehouseSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleWarehouseSubItems.map((subItem) => {
                    const subActive = activeView === 'warehouse' && activeWarehouseTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectWarehouseTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {isSettings && settingsExpanded && visibleSettingsSubItems.length > 0 ? (
                <div className="bg-[#131d30] py-1">
                  {visibleSettingsSubItems.map((subItem) => {
                    const subActive = activeView === 'settings' && activeSettingsTab === subItem.id
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => selectSettingsTab(subItem.id)}
                        className={`flex w-full items-center gap-2 px-8 py-2 text-left text-xs transition ${
                          subActive ? 'text-cyan-100' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
        {sidebarQueryNormalized && !sidebarHasMatches ? (
          <p className="px-4 py-3 text-xs text-slate-300">Sin coincidencias para "{sidebarQuery}".</p>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-gray-200 transition hover:bg-[#2b3443] ${collapsed ? 'justify-center' : 'gap-3'}`}
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5" />
          {!collapsed ? 'Cerrar sesion' : null}
        </button>
      </div>
    </div>
  )

  return (
    <div className="enterprise-shell min-h-screen text-[#dce7ff]">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-linear duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-linear duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>
          <div className="fixed inset-0 z-40 flex">
            <Transition.Child
              as={Fragment}
              enter="ease-in-out duration-200"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="ease-in-out duration-200"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative w-full max-w-xs">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="absolute right-3 top-3 z-10 rounded bg-black/35 p-1 text-white"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <SidebarContent mobile />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <aside className={`fixed inset-y-0 left-0 z-30 hidden transition-all duration-200 lg:block ${desktopSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <SidebarContent collapsed={desktopSidebarCollapsed} />
      </aside>

      <div className={`transition-all duration-200 ${desktopSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="enterprise-header sticky top-0 z-20 border-b border-cyan-200/10 text-white">
          <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setSidebarOpen(true)} className="rounded bg-white/15 p-1.5 text-white lg:hidden">
                <Bars3Icon className="h-5 w-5" />
              </button>
              <button className="hidden rounded bg-white/15 p-1.5 text-white lg:block" onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}>
                <Bars3Icon className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold">{activeLabel}</span>
              <span className="hidden rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 sm:inline">
                En vivo: {currentTimeLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="hidden items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 sm:flex">
                <button
                  onClick={() => setUiTheme('azure')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    uiTheme === 'azure' ? 'bg-sky-500 text-white' : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  Azul
                </button>
                <button
                  onClick={() => setUiTheme('emerald')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    uiTheme === 'emerald' ? 'bg-emerald-500 text-white' : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  Esmeralda
                </button>
                <button
                  onClick={() => setUiTheme('platinum')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    uiTheme === 'platinum' ? 'bg-slate-400 text-slate-900' : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  Platinum
                </button>
              </div>
              <button
                onClick={() =>
                  setUiTheme((prev) => (prev === 'azure' ? 'emerald' : prev === 'emerald' ? 'platinum' : 'azure'))
                }
                className="rounded border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-50 sm:hidden"
              >
                {uiTheme === 'azure' ? 'Azul' : uiTheme === 'emerald' ? 'Esmeralda' : 'Platinum'}
              </button>
              <button onClick={() => selectView('manual')} className="flex items-center gap-1 font-semibold text-cyan-50/95 hover:text-white">
                <QuestionMarkCircleIcon className="h-4 w-4" />
                Ayuda
              </button>

              <Menu as="div" className="relative">
                <Menu.Button className="relative text-cyan-50/95 hover:text-white">
                  <BellIcon className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition duration-100"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="transition duration-75"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-72 rounded border border-cyan-100/15 bg-[#0f1828] p-1 text-sm text-slate-100 shadow-lg">
                    <div className="mb-1 flex items-center justify-between border-b border-cyan-100/10 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-100">Notificaciones</span>
                      <div className="flex gap-2">
                        <button onClick={markAllAsRead} className="text-cyan-200 hover:underline">
                          Marcar todas
                        </button>
                        <button onClick={clearNotifications} className="text-slate-300 hover:underline">
                          Limpiar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-slate-400">Sin notificaciones</p>
                      ) : (
                        notifications.map((item) => (
                          <Menu.Item key={item.id}>
                            {({ active }) => (
                              <button
                                onClick={() => markAsRead(item.id)}
                                className={`w-full rounded px-3 py-2 text-left ${active ? 'bg-cyan-400/10' : ''}`}
                              >
                                <p className={`text-sm ${item.read ? 'text-slate-300' : 'font-semibold text-slate-100'}`}>{item.message}</p>
                                <p className="text-xs text-slate-400">{item.time}</p>
                              </button>
                            )}
                          </Menu.Item>
                        ))
                      )}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center gap-2">
                  <span className="rounded bg-white/15 px-2 py-0.5 text-xs">{userEmail}</span>
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition duration-100"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="transition duration-75"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 mt-2 w-44 rounded border border-cyan-100/15 bg-[#0f1828] p-1 text-sm text-slate-100 shadow-lg">
                    <Menu.Item>
                      {({ active }) => (
                        <button onClick={handleLogout} className={`w-full rounded px-3 py-2 text-left ${active ? 'bg-cyan-400/10' : ''}`}>
                          Cerrar sesion
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </header>

        <main className="enterprise-main p-3 sm:p-4">
          {bannerVisible ? (
            <div className="enterprise-banner mb-4 flex items-center justify-between rounded border px-4 py-3 text-sm">
              <span>Ha iniciado sesion exitosamente como {userEmail}.</span>
              <button onClick={() => setBannerVisible(false)} className="text-emerald-200/90 hover:text-emerald-100">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
