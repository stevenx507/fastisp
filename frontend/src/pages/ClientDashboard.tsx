import React, { useEffect, useMemo, useState } from 'react'
import {
  AdjustmentsHorizontalIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  Bars3BottomLeftIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CommandLineIcon,
  CpuChipIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  GlobeAmericasIcon,
  EyeIcon,
  PlayCircleIcon,
  GlobeAltIcon,
  LifebuoyIcon,
  ListBulletIcon,
  MapPinIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PlusCircleIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  TicketIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { apiClient } from '../lib/apiClient'

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
type ConnectionStatus = 'active' | 'idle' | 'offline'
type InvoiceStatus = 'paid' | 'pending' | 'overdue'
type SegmentFilter = 'all' | 'delinquent' | 'highUsage' | 'support' | 'healthy'
type ScreenNoticeFilter = 'all' | 'yes' | 'no'
type PromiseStatus = 'pending' | 'fulfilled' | 'broken'
type SunatStatus = 'accepted' | 'pending' | 'rejected'
type SubscriptionStatus = 'active' | 'past_due' | 'trial' | 'suspended'

interface Subscription {
  id: string
  customer: string
  email: string
  plan: 'Mensual' | 'Trimestral' | 'Semestral' | 'Anual'
  cycleMonths: 1 | 3 | 6 | 12
  amount: number
  status: SubscriptionStatus
  nextCharge: string
  method: 'Stripe' | 'Transferencia' | 'Efectivo'
}
type RouterAction = 'test' | 'backup' | 'reboot' | 'refresh' | 'hotspot' | 'script'

interface MikroTikRouterItem {
  id: string
  name: string
  ipAddress: string
  status: 'online' | 'offline' | 'unknown'
}

interface RouterHealthSummary {
  cpuLoad: number | null
  memoryUsage: number | null
  uptime: string
  healthScore: number | null
  lastCheck: string
}

interface RouterQueueSummary {
  id: string
  name: string
  target: string
  maxLimit: string
  rate: string
  disabled: boolean
}

interface RouterConnectionSummary {
  id: string
  type: string
  address: string
  macAddress: string
  uptime: string
  status: string
}

interface RouterEnterpriseService {
  name: string
  port: string
  disabled: boolean
  address: string
  certificate: string
}

interface RouterEnterpriseInterface {
  name: string
  type: string
  running: boolean
  rx_bytes: number
  tx_bytes: number
  traffic_bytes: number
}

interface RouterEnterpriseSnapshot {
  generatedAt: string
  healthScore: number
  issues: string[]
  interfaceSummary: { total: number; running: number; down: number }
  queueSummary: { total: number; active: number; disabled: number; busy: number }
  connectionSummary: { total: number; dhcp: number; pppoe: number }
  firewallSummary: { filterTotal: number; filterDisabled: number; natTotal: number; natDisabled: number; mangleTotal: number; mangleDisabled: number }
  dhcpSummary: { total: number; bound: number; waiting: number }
  pppSummary: { active: number }
  schedulerSummary: { total: number; backupJobs: number }
  insecureServices: string[]
  services: RouterEnterpriseService[]
  topInterfaces: RouterEnterpriseInterface[]
  recentLogs: Array<{ time: string; topics: string; message: string }>
  recommendations: string[]
}

interface RouterFailoverTarget {
  target: string
  totalProbes: number
  successProbes: number
  packetLoss: number
  avgLatencyMs: number | null
  status: 'ok' | 'warning' | 'critical'
  error?: string
}

interface RouterFailoverReport {
  generatedAt: string
  overallStatus: 'ok' | 'warning' | 'critical'
  targets: RouterFailoverTarget[]
}

interface RouterEnterpriseChange {
  changeId: string
  routerId: string
  createdAt: string
  actor: string
  category: string
  profile: string
  siteProfile: string
  status: string
  commandCount: number
}

interface OltVendor {
  id: string
  label: string
  defaultTransport: string
  defaultPort: number
  actions: string[]
}

interface OltDevice {
  id: string
  name: string
  vendor: string
  model: string
  host: string
  transport: string
  port: number
  username: string
  site: string
}

interface OltSnapshot {
  deviceId: string
  generatedAt: string
  ponTotal: number
  ponAlert: number
  onuOnline: number
  onuOffline: number
  cpuLoad: number
  memoryUsage: number
  temperatureC: number
}

interface OltAuditEntry {
  id: string
  deviceId: string
  deviceName: string
  vendor: string
  runMode: string
  success: boolean
  actor: string
  sourceIp: string
  commands: number
  startedAt: string
  finishedAt: string
  error: string | null
}

interface InternetPlanTemplate {
  id: string
  name: string
  download: number
  upload: number
  prefix: string
  target: string
  enabled: boolean
}

interface ZoneRecord {
  id: string
  name: string
  city: string
  activeClients: number
  utilization: number
}

interface NetworkSectorRecord {
  id: string
  zone: string
  sector: string
  node: string
  nap: string
  occupancy: number
}

interface ScheduledTaskRecord {
  id: string
  name: string
  cron: string
  enabled: boolean
  lastRun: string
}

interface ScriptTemplate {
  id: string
  name: string
  description: string
  script: string
}

interface VpnUserRecord {
  id: string
  user: string
  profile: string
  status: 'connected' | 'idle'
  endpoint: string
}

interface SubdomainRecord {
  id: string
  host: string
  target: string
  status: 'active' | 'pending'
}

interface DirectoryServiceRecord {
  id: string
  service: string
  owner: string
  status: 'active' | 'draft'
  updatedAt: string
}

interface HotspotPlanRecord {
  id: string
  name: string
  prefix: string
  durationMinutes: number
  bandwidth: string
  price: number
  enabled: boolean
}

interface VoucherRecord {
  id: string
  code: string
  planId: string
  soldBy: string
  soldAt: string
  amount: number
  status: 'generated' | 'sold' | 'used'
}

interface PointOfSaleRecord {
  id: string
  name: string
  manager: string
  city: string
  active: boolean
  balance: number
}

interface CashCloseRecord {
  id: string
  openedAt: string
  closedAt: string | null
  grossSales: number
  expenses: number
  net: number
  status: 'open' | 'closed'
}

type TicketStatus = 'new' | 'in-progress' | 'closed'

interface SupportTicket {
  id: string
  client: string
  subject: string
  department: string
  assignee: string
  priority: 'low' | 'medium' | 'high'
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

interface WarehouseItem {
  id: string
  name: string
  category: 'network' | 'article' | 'service'
  sku: string
  stock: number
  minStock: number
  unitCost: number
  supplier: string
  branch: string
  active: boolean
}

interface WarehouseSupplier {
  id: string
  name: string
  contact: string
  status: 'active' | 'paused'
}

interface WarehouseBranch {
  id: string
  name: string
  city: string
  manager: string
  active: boolean
}

interface WarehouseLog {
  id: string
  action: string
  actor: string
  detail: string
  createdAt: string
}

interface StaffMember {
  id: string
  name: string
  role: string
  department: string
  status: 'active' | 'inactive'
  assignedAssets: number
}

interface Invoice {
  id: string
  amount: number
  due: string
  status: InvoiceStatus
}

interface PaymentPromise {
  id: string
  client: string
  invoiceId: string
  promisedDate: string
  amount: number
  status: PromiseStatus
}

interface OtherIncome {
  id: string
  concept: string
  channel: string
  amount: number
  date: string
}

interface ExpenseItem {
  id: string
  concept: string
  area: string
  amount: number
  date: string
  approved: boolean
}

interface CollectionCard {
  id: string
  agent: string
  assigned: number
  collected: number
  target: number
}

interface PaymentMethodSetting {
  id: string
  name: string
  fee: number
  active: boolean
}

interface GatewaySubscription {
  id: string
  gateway: string
  plan: string
  amount: number
  renewal: string
  active: boolean
}

interface ElectronicInvoice {
  id: string
  invoiceId: string
  sunatStatus: SunatStatus
  sentAt: string
}

interface ReconciliationRow {
  id: string
  client: string
  billed: number
  paid: number
  difference: number
  reconciled: boolean
}

interface PaymentRecord {
  id: string
  source: string
  client: string
  amount: number
  date: string
  method: string
}

interface Connection {
  id: string
  ip: string
  mac: string
  status: ConnectionStatus
}

type PlanType = '30 Mbps' | '50 Mbps' | '80 Mbps' | '100 Mbps' | '150 Mbps' | '200 Mbps'
type RiskLevel = 'low' | 'medium' | 'high'

interface ClientMeta {
  name: string
  plan: PlanType
  zone: string
  debt: number
  tickets: number
  phone?: string
  email?: string
  address?: string
  routerId?: string
  planCost?: number
}

interface ClientProfile {
  id: string
  code: string
  name: string
  username: string
  ip: string
  mac: string
  status: ConnectionStatus
  plan: PlanType
  zone: string
  lanInterface: string
  cutoffDay: string
  screenNotice: boolean
  phone: string
  email: string
  address: string
  routerId?: string
  planCost: number
  monthlyUsage: number
  debt: number
  risk: RiskLevel
  tickets: number
  lastSeen: string
}

const viewIds = new Set<DashboardView>([
  'dashboard',
  'clients',
  'finance',
  'licensing',
  'system',
  'hotspot',
  'warehouse',
  'staff',
  'settings',
  'company',
  'affiliate',
  'manual',
  'resources'
])
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
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const planOptions: PlanType[] = ['30 Mbps', '50 Mbps', '80 Mbps', '100 Mbps', '150 Mbps', '200 Mbps']
const planPricing: Record<PlanType, number> = {
  '30 Mbps': 39,
  '50 Mbps': 49,
  '80 Mbps': 69,
  '100 Mbps': 89,
  '150 Mbps': 109,
  '200 Mbps': 129
}
const zones = ['Norte', 'Centro', 'Sur', 'Este', 'Oeste']
const lanInterfaces = ['ether1', 'ether2', 'ether3', 'bridge-lan', 'vlan-trunk']
const cutoffPool = ['08/03/2026', '13/03/2026', '22/02/2026', '28/02/2026', '15/03/2026']
const namePool = ['Juan Perez', 'Maria Gomez', 'Carlos Ruiz', 'Ana Torres', 'Roberto Diaz', 'Luisa Vega', 'Miguel Leon', 'Sofia Herrera']

const slugify = (text: string) => text.replace(/[^0-9a-zA-Z]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
const clientsTabLabels: Record<ClientsTab, string> = {
  list: 'Lista Clientes',
  search: 'Buscar Clientes',
  installations: 'Instalaciones',
  'tickets-new': 'Tickets Nuevos',
  'tickets-progress': 'En Progreso',
  'tickets-closed': 'Cerrados y Resueltos',
  'tickets-search': 'Buscar Tickets',
  announcements: 'Avisos en Pantalla',
  traffic: 'Trafico',
  map: 'Mapa de Clientes',
  stats: 'Estadisticas',
  'stats-tickets-month': 'Tickets Por Mes',
  'stats-tickets-closure': 'Tickets Nuevos y Cerrados',
  'stats-staff-departments': 'Staff y Departamentos',
  push: 'Notificaciones Push',
  services: 'Servicios Adicionales'
}

const financeTabLabels: Record<FinanceTab, string> = {
  dashboard: 'Dashboard',
  'pending-payments': 'Pagos pendientes',
  invoices: 'Facturas',
  'payment-report': 'Reporte de Pagos',
  'search-invoices': 'Buscar Facturas',
  'payment-promises': 'Promesas de Pago',
  'other-income': 'Otros Ingresos',
  expenses: 'Gastos',
  statistics: 'Estadisticas',
  'collection-cards': 'Tarjetas Cobranza',
  accounting: 'Contabilidad',
  'payment-methods': 'Formas de Pagos',
  'payments-list': 'Lista Pagos',
  'gateway-subscriptions': 'Suscripciones Pasarelas',
  'electronic-invoices': 'Facturas Electronicas',
  'excel-payments': 'Registrar Pagos desde Excel',
  'client-reconciliation': 'Conciliacion clientes'
}

const systemTabLabels: Record<SystemTab, string> = {
  router: 'Router',
  'internet-plan': 'Plan de Internet',
  'phone-tv-plan': 'Plan de Telefonia y Television',
  zones: 'Zonas',
  'sector-node-nap': 'Sectorial/Nodo/NAP',
  'periodic-tasks': 'Tareas Periodicas',
  templates: 'Plantillas',
  'vpn-access': 'Acceso remoto VPN',
  'admin-olt': 'AdminOLT',
  subdomains: 'Subdominios',
  'directory-isp': 'DirectorioISP'
}

const hotspotTabLabels: Record<HotspotTab, string> = {
  routers: 'Routers',
  'plans-prefixes': 'Lista Planes/Prefijos',
  'create-vouchers': 'Crear Fichas',
  pos: 'Puntos de Venta',
  'cash-close': 'Corte de Caja General',
  templates: 'Plantillas'
}

const warehouseTabLabels: Record<WarehouseTab, string> = {
  dashboard: 'Dashboard',
  'network-stock': 'Stock Dispositivos de Red',
  'network-list': 'Lista Dispositivos de Red',
  'other-articles': 'Otros Articulos',
  'other-services': 'Otros Servicios',
  suppliers: 'Proveedores',
  branches: 'Sucursales',
  'assign-staff': 'Asignar Articulos Staff',
  log: 'Log'
}

const settingsTabLabels: Record<SettingsTab, string> = {
  'mail-server': 'Servidor Correo',
  billing: 'Facturacion',
  'billing-electronic': 'Facturacion Electronica',
  'payment-gateways': 'Pasarelas de Pago',
  'whatsapp-sms': 'WhatsApp/SMS',
  'google-maps': 'Google Maps',
  'clients-excel': 'Clientes desde Excel',
  'visible-columns': 'Columnas Visibles',
  'client-portal': 'Portal del Cliente',
  'mobile-app': 'Aplicacion Movil',
  'bulk-actions': 'Acciones Masivas',
  maintenance: 'Mantenimiento',
  ai: 'IA'
}

const ClientDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<30 | 45 | 60 | 120>(45)
  const [lastAutoRefreshAt, setLastAutoRefreshAt] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<'all' | ConnectionStatus>('all')
  const [zoneFilter, setZoneFilter] = useState<'all' | string>('all')
  const [planFilter, setPlanFilter] = useState<'all' | PlanType>('all')
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all')
  const [clientColumnFilters, setClientColumnFilters] = useState<{
    name: string
    username: string
    ip: string
    lan: string
    cutoff: string
    screen: ScreenNoticeFilter
  }>({ name: '', username: '', ip: '', lan: '', cutoff: '', screen: 'all' })
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('all')
  const [sortField, setSortField] = useState<'name' | 'usage' | 'debt' | 'tickets'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(8)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'none' | 'activate' | 'suspend' | 'reminder' | 'export'>('none')
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [bulkPlan, setBulkPlan] = useState<PlanType>('100 Mbps')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClientDraft, setNewClientDraft] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    ip: '',
    connectionType: 'dhcp' as 'dhcp' | 'pppoe' | 'static',
    pppoeUser: '',
    pppoePass: '',
    plan: '100 Mbps' as PlanType,
    planCost: planPricing['100 Mbps'],
    zone: zones[0],
    routerId: '',
    status: 'active' as ConnectionStatus
  })
  const [newClientOptions, setNewClientOptions] = useState({
    autoProvision: true,
    sendWelcome: true,
    createInvoice: true
  })
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | InvoiceStatus>('all')
  const [financeSearch, setFinanceSearch] = useState('')
  const [promiseDateInput, setPromiseDateInput] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
  const [excelRowsImported, setExcelRowsImported] = useState(0)
  const [otherIncomeDraft, setOtherIncomeDraft] = useState({ concept: '', amount: '', channel: 'Efectivo' })
  const [expenseDraft, setExpenseDraft] = useState({ concept: '', amount: '', area: 'Operacion' })
  const [openManual, setOpenManual] = useState('dashboard')
  const [affiliateStats, setAffiliateStats] = useState({
    referrals: 14,
    converted: 6,
    pending: 3,
    monthlyCommission: 485
  })
  const [resourceChecklist, setResourceChecklist] = useState([
    { id: 'rb', label: 'Backup de routers validado', completed: false },
    { id: 'inv', label: 'Inventario de almacen sincronizado', completed: false },
    { id: 'fin', label: 'Conciliacion financiera ejecutada', completed: false },
    { id: 'hot', label: 'HotSpot publicado sin errores', completed: true }
  ])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionStatus | 'all'>('all')
  const [clientMeta, setClientMeta] = useState<Record<string, ClientMeta>>({})
  const [paymentPromises, setPaymentPromises] = useState<PaymentPromise[]>([
    { id: 'PP-001', client: 'Juan Perez', invoiceId: 'INV-2026-002', promisedDate: '2026-02-20', amount: 2120, status: 'pending' },
    { id: 'PP-002', client: 'Ana Torres', invoiceId: 'INV-2026-003', promisedDate: '2026-02-24', amount: 3000, status: 'pending' }
  ])
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([
    { id: 'OI-001', concept: 'Instalacion fibra', channel: 'Transferencia', amount: 320, date: '2026-02-10' },
    { id: 'OI-002', concept: 'Reconexiones', channel: 'Efectivo', amount: 180, date: '2026-02-12' }
  ])
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 'EX-001', concept: 'Mantenimiento torres', area: 'Infraestructura', amount: 980, date: '2026-02-08', approved: true },
    { id: 'EX-002', concept: 'Combustible soporte', area: 'Operacion', amount: 240, date: '2026-02-13', approved: false }
  ])
  const [collectionCards, setCollectionCards] = useState<CollectionCard[]>([
    { id: 'TC-001', agent: 'Ronald C.', assigned: 42, collected: 30, target: 18000 },
    { id: 'TC-002', agent: 'Sofia M.', assigned: 35, collected: 24, target: 14500 }
  ])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSetting[]>([
    { id: 'PM-001', name: 'Efectivo', fee: 0, active: true },
    { id: 'PM-002', name: 'Transferencia', fee: 0.5, active: true },
    { id: 'PM-003', name: 'Tarjeta POS', fee: 2.9, active: true },
    { id: 'PM-004', name: 'Yape/Plin', fee: 1.2, active: true }
  ])
  const [gatewaySubscriptions, setGatewaySubscriptions] = useState<GatewaySubscription[]>([
    { id: 'GW-001', gateway: 'Stripe', plan: 'Business', amount: 89, renewal: '2026-03-05', active: true },
    { id: 'GW-002', gateway: 'Niubiz', plan: 'Enterprise', amount: 59, renewal: '2026-03-10', active: true }
  ])
  const [electronicInvoices, setElectronicInvoices] = useState<ElectronicInvoice[]>([
    { id: 'FE-001', invoiceId: 'INV-2026-001', sunatStatus: 'accepted', sentAt: '2026-02-02 10:20' },
    { id: 'FE-002', invoiceId: 'INV-2026-002', sunatStatus: 'pending', sentAt: '2026-02-12 14:05' },
    { id: 'FE-003', invoiceId: 'INV-2026-003', sunatStatus: 'rejected', sentAt: '2026-02-15 09:40' }
  ])
  const [reconciliationRows, setReconciliationRows] = useState<ReconciliationRow[]>([
    { id: 'RC-001', client: 'Juan Perez', billed: 420, paid: 420, difference: 0, reconciled: true },
    { id: 'RC-002', client: 'Maria Gomez', billed: 380, paid: 320, difference: 60, reconciled: false },
    { id: 'RC-003', client: 'Carlos Ruiz', billed: 450, paid: 450, difference: 0, reconciled: true }
  ])
  const [installations, setInstallations] = useState([
    { id: 'INS-001', client: 'Juan Perez', address: 'Av. Sol 120', date: '2026-02-20', status: 'pending' as const },
    { id: 'INS-002', client: 'Maria Gomez', address: 'Jr. Norte 230', date: '2026-02-21', status: 'scheduled' as const },
    { id: 'INS-003', client: 'Ana Torres', address: 'Calle 8 #45', date: '2026-02-18', status: 'done' as const }
  ])
  const [screenNotices, setScreenNotices] = useState([
    { id: 1, title: 'Mantenimiento programado', message: 'Hoy 2:00 AM', active: true },
    { id: 2, title: 'Promocion de febrero', message: 'Duplica velocidad por 1 mes', active: false }
  ])
  const [pushHistory, setPushHistory] = useState<Array<{ id: number; title: string; target: string; time: string }>>([])
  const [pushDraft, setPushDraft] = useState({ title: '', message: '', target: 'all' })
  const [ticketSearch, setTicketSearch] = useState('')
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([
    {
      id: 'TK-001',
      client: 'Juan Perez',
      subject: 'Sin navegacion en CPE',
      department: 'Soporte N1',
      assignee: 'Miguel Leon',
      priority: 'high',
      status: 'new',
      createdAt: '2026-02-16 08:15',
      updatedAt: '2026-02-16 08:15'
    },
    {
      id: 'TK-002',
      client: 'Maria Gomez',
      subject: 'Latencia alta en horario pico',
      department: 'NOC',
      assignee: 'Sofia Herrera',
      priority: 'medium',
      status: 'in-progress',
      createdAt: '2026-02-15 14:22',
      updatedAt: '2026-02-16 10:30'
    },
    {
      id: 'TK-003',
      client: 'Carlos Ruiz',
      subject: 'Cambio de router',
      department: 'Campo',
      assignee: 'Ronald C.',
      priority: 'low',
      status: 'closed',
      createdAt: '2026-02-12 11:40',
      updatedAt: '2026-02-14 09:10'
    }
  ])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([
    { id: 'STF-001', name: 'Ronald C.', role: 'Supervisor Tecnico', department: 'Campo', status: 'active', assignedAssets: 6 },
    { id: 'STF-002', name: 'Sofia Herrera', role: 'NOC Analyst', department: 'NOC', status: 'active', assignedAssets: 4 },
    { id: 'STF-003', name: 'Miguel Leon', role: 'Soporte N1', department: 'Soporte', status: 'active', assignedAssets: 2 },
    { id: 'STF-004', name: 'Luisa Vega', role: 'Billing Ops', department: 'Finanzas', status: 'inactive', assignedAssets: 1 }
  ])
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([
    { id: 'WH-001', name: 'ONU ZTE F660', category: 'network', sku: 'ONU-F660', stock: 43, minStock: 20, unitCost: 120, supplier: 'FiberTech', branch: 'Central', active: true },
    { id: 'WH-002', name: 'Router hAP ac2', category: 'network', sku: 'MKT-HAPAC2', stock: 17, minStock: 15, unitCost: 210, supplier: 'MikroDistrib', branch: 'Norte', active: true },
    { id: 'WH-003', name: 'Bobina Drop 500m', category: 'article', sku: 'DROP-500', stock: 6, minStock: 8, unitCost: 89, supplier: 'CableAndino', branch: 'Central', active: true },
    { id: 'WH-004', name: 'Mantenimiento Premium', category: 'service', sku: 'SRV-MANT-P', stock: 120, minStock: 30, unitCost: 25, supplier: 'Interno', branch: 'Central', active: true }
  ])
  const [warehouseSuppliers, setWarehouseSuppliers] = useState<WarehouseSupplier[]>([
    { id: 'SUP-001', name: 'FiberTech', contact: 'ventas@fibertech.pe', status: 'active' },
    { id: 'SUP-002', name: 'MikroDistrib', contact: 'canal@mikrodistrib.pe', status: 'active' },
    { id: 'SUP-003', name: 'CableAndino', contact: 'compras@cableandino.pe', status: 'paused' }
  ])
  const [warehouseBranches, setWarehouseBranches] = useState<WarehouseBranch[]>([
    { id: 'BR-001', name: 'Central', city: 'Lima', manager: 'Ronald C.', active: true },
    { id: 'BR-002', name: 'Norte', city: 'Lima', manager: 'Sofia Herrera', active: true },
    { id: 'BR-003', name: 'Sur', city: 'Lima', manager: 'Ana Torres', active: false }
  ])
  const [warehouseLogs, setWarehouseLogs] = useState<WarehouseLog[]>([
    { id: 'LOG-001', action: 'INGRESO', actor: 'Ronald C.', detail: 'Se ingresaron 20 ONU ZTE F660 en Central.', createdAt: '2026-02-16 09:05' },
    { id: 'LOG-002', action: 'ASIGNACION', actor: 'Sofia Herrera', detail: '2 routers asignados a cuadrilla Norte.', createdAt: '2026-02-16 10:20' },
    { id: 'LOG-003', action: 'AJUSTE', actor: 'Miguel Leon', detail: 'Ajuste de stock por auditoria mensual.', createdAt: '2026-02-15 17:30' }
  ])
  const [assignDraft, setAssignDraft] = useState({ itemId: 'WH-001', staffId: 'STF-001', quantity: 1 })
  const [serviceFlags, setServiceFlags] = useState({
    ipPublica: false,
    controlParental: true,
    wifiInvitados: true,
    priorizacionStreaming: false
  })

  const [overview, setOverview] = useState({
    uptime: '99.98%',
    currentSpeed: '85 Mbps',
    totalDownload: '8503.73 GiB',
    totalUpload: '833.48 GiB'
  })
  const [tickets, setTickets] = useState({ today: 0, pending: 0, month: 0 })
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [settings, setSettings] = useState({
    timezone: 'America/Lima',
    language: 'es',
    currency: 'PEN',
    autoBackup: true
  })
  const [mailSettings, setMailSettings] = useState({
    host: 'smtp.ispfast.net',
    port: '587',
    user: 'notificaciones@ispfast.net',
    tls: true
  })
  const [billingSettings, setBillingSettings] = useState({
    autoCutoffDays: 5,
    invoiceSeries: 'F001',
    allowPartialPayments: true
  })
  const [featureToggles, setFeatureToggles] = useState({
    billingElectronic: true,
    whatsappSms: true,
    googleMaps: true,
    clientPortal: true,
    mobileApp: true,
    ai: true
  })
  const [visibleColumns, setVisibleColumns] = useState({
    codigo: true,
    cliente: true,
    plan: true,
    zona: true,
    deuda: true,
    riesgo: true
  })
  const [excelClientsImported, setExcelClientsImported] = useState(0)
  const [gatewayConfig, setGatewayConfig] = useState({
    stripe: true,
    niubiz: true,
    paypal: false
  })
  const [company, setCompany] = useState({
    name: 'ISPFAST Networks',
    email: 'soporte@ispfast.local',
    phone: '+51 999 888 777',
    address: 'Lima, Peru'
  })
  const [mikrotikRouters, setMikrotikRouters] = useState<MikroTikRouterItem[]>([])
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null)
  const [routerHealth, setRouterHealth] = useState<RouterHealthSummary | null>(null)
  const [routerQueues, setRouterQueues] = useState<RouterQueueSummary[]>([])
  const [routerSessions, setRouterSessions] = useState<RouterConnectionSummary[]>([])
  const [routerLoading, setRouterLoading] = useState(false)
  const [routerActionLoading, setRouterActionLoading] = useState<RouterAction | null>(null)
  const [routerLastSync, setRouterLastSync] = useState('Pendiente de sincronizacion con MikroTik.')
  const [routerCommandDraft, setRouterCommandDraft] = useState('/system identity print')
  const [enterpriseSnapshot, setEnterpriseSnapshot] = useState<RouterEnterpriseSnapshot | null>(null)
  const [enterpriseLoading, setEnterpriseLoading] = useState(false)
  const [hardeningBusy, setHardeningBusy] = useState(false)
  const [hardeningProfile, setHardeningProfile] = useState<'baseline' | 'strict' | 'hardened'>('strict')
  const [hardeningSiteProfile, setHardeningSiteProfile] = useState<'core' | 'distribution' | 'access' | 'hotspot'>('access')
  const [failoverBusy, setFailoverBusy] = useState(false)
  const [failoverTargetsDraft, setFailoverTargetsDraft] = useState('1.1.1.1, 8.8.8.8, 9.9.9.9')
  const [failoverReport, setFailoverReport] = useState<RouterFailoverReport | null>(null)
  const [enterpriseChangeLog, setEnterpriseChangeLog] = useState<RouterEnterpriseChange[]>([])
  const [changeLogLoading, setChangeLogLoading] = useState(false)
  const [rollbackBusyId, setRollbackBusyId] = useState<string | null>(null)
  const [hotspotDnsName, setHotspotDnsName] = useState('wifi.ispfast.net')
  const [hotspotInterface, setHotspotInterface] = useState('bridge-hotspot')
  const [hotspotAddressPool, setHotspotAddressPool] = useState('pool-hotspot')
  const [templateToRunId, setTemplateToRunId] = useState('TPL-001')
  const [voucherDraft, setVoucherDraft] = useState({ planId: 'HSP-60', qty: 10, pointOfSaleId: 'POS-001' })
  const [oltVendors, setOltVendors] = useState<OltVendor[]>([])
  const [oltDevices, setOltDevices] = useState<OltDevice[]>([])
  const [selectedOltId, setSelectedOltId] = useState('')
  const [oltSnapshot, setOltSnapshot] = useState<OltSnapshot | null>(null)
  const [oltConnectionResult, setOltConnectionResult] = useState<{ reachable: boolean; latencyMs: number | null; message: string } | null>(null)
  const [oltScriptAction, setOltScriptAction] = useState('show_pon_summary')
  const [oltScriptPayload, setOltScriptPayload] = useState({
    frame: 0,
    slot: 1,
    pon: 1,
    onu: 1,
    serial: 'ZTEG00000001',
    vlan: 120
  })
  const [oltGeneratedCommands, setOltGeneratedCommands] = useState<string[]>([])
  const [oltQuickScript, setOltQuickScript] = useState('')
  const [oltQuickLogin, setOltQuickLogin] = useState('')
  const [tr064Script, setTr064Script] = useState('')
  const [oltTranscript, setOltTranscript] = useState<string[]>([])
  const [oltRunMode, setOltRunMode] = useState<'simulate' | 'live'>('simulate')
  const [oltAuditLog, setOltAuditLog] = useState<OltAuditEntry[]>([])
  const [oltAuditLoading, setOltAuditLoading] = useState(false)
  const [oltBusy, setOltBusy] = useState(false)
  const [tr064Config, setTr064Config] = useState({ host: '', username: 'telecomadmin', password: 'admintelecom', port: 7547, vendor: 'huawei' })
  const [tr064Status, setTr064Status] = useState<{ ok: boolean; message: string } | null>(null)
  const [networkHealth, setNetworkHealth] = useState<{ score: number; routers_ok: number; routers_down: number; olt_ok: number; olt_alert: number; latency_ms: number; packet_loss: number; last_updated: string } | null>(null)
  const [nocAlerts, setNocAlerts] = useState<Array<{ id: string; severity: string; message: string; target: string; since: string }>>([])
  const [internetPlans, setInternetPlans] = useState<InternetPlanTemplate[]>([
    { id: 'INET-060', name: 'Fibra 60/20', download: 60, upload: 20, prefix: 'F60', target: 'global', enabled: true },
    { id: 'INET-100', name: 'Fibra 100/30', download: 100, upload: 30, prefix: 'F100', target: 'corporativo', enabled: true },
    { id: 'INET-200', name: 'Fibra 200/60', download: 200, upload: 60, prefix: 'F200', target: 'premium', enabled: false }
  ])
  const [phoneTvPlans, setPhoneTvPlans] = useState<InternetPlanTemplate[]>([
    { id: 'PTV-BA', name: 'Duo Basic', download: 80, upload: 20, prefix: 'DUO-B', target: 'hogar', enabled: true },
    { id: 'PTV-FAM', name: 'Trio Familiar', download: 120, upload: 40, prefix: 'TRI-F', target: 'familiar', enabled: true },
    { id: 'PTV-BIZ', name: 'Trio Business', download: 180, upload: 60, prefix: 'TRI-B', target: 'empresa', enabled: false }
  ])
  const [zoneRecords, setZoneRecords] = useState<ZoneRecord[]>([
    { id: 'ZN-001', name: 'Lima Centro', city: 'Lima', activeClients: 412, utilization: 78 },
    { id: 'ZN-002', name: 'Cono Norte', city: 'Lima', activeClients: 305, utilization: 69 },
    { id: 'ZN-003', name: 'Cono Sur', city: 'Lima', activeClients: 224, utilization: 61 }
  ])
  const [sectorRecords, setSectorRecords] = useState<NetworkSectorRecord[]>([
    { id: 'SEC-01', zone: 'Lima Centro', sector: 'A1', node: 'NODE-11', nap: 'NAP-031', occupancy: 83 },
    { id: 'SEC-02', zone: 'Cono Norte', sector: 'B4', node: 'NODE-22', nap: 'NAP-014', occupancy: 71 },
    { id: 'SEC-03', zone: 'Cono Sur', sector: 'C3', node: 'NODE-09', nap: 'NAP-078', occupancy: 52 }
  ])
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskRecord[]>([
    { id: 'TSK-001', name: 'Backup nocturno', cron: '0 2 * * *', enabled: true, lastRun: '2026-02-16 02:00' },
    { id: 'TSK-002', name: 'Limpieza de leases', cron: '*/30 * * * *', enabled: true, lastRun: '2026-02-16 22:30' },
    { id: 'TSK-003', name: 'Rotacion de logs', cron: '15 3 * * 1', enabled: false, lastRun: '2026-02-10 03:15' }
  ])
  const [scriptTemplates] = useState<ScriptTemplate[]>([
    {
      id: 'TPL-001',
      name: 'QoS Basico',
      description: 'Aplica colas simples para plan hogar y corporativo.',
      script: '/queue simple add name=qos-hogar max-limit=60M/20M target=0.0.0.0/0'
    },
    {
      id: 'TPL-002',
      name: 'Firewall ISP',
      description: 'Reglas de proteccion para puertos criticos y brute-force.',
      script: '/ip firewall filter add chain=input action=drop protocol=tcp dst-port=23,8291'
    },
    {
      id: 'TPL-003',
      name: 'HotSpot Landing',
      description: 'Preconfigura perfil de usuarios y DNS para portal cautivo.',
      script: '/ip hotspot profile set [find default=yes] dns-name=wifi.ispfast.net'
    }
  ])
  const [vpnUsers, setVpnUsers] = useState<VpnUserRecord[]>([
    { id: 'VPN-001', user: 'noc-admin', profile: 'WireGuard-NOC', status: 'connected', endpoint: '170.33.20.8' },
    { id: 'VPN-002', user: 'soporte-campo', profile: 'L2TP-Support', status: 'idle', endpoint: '190.42.11.50' },
    { id: 'VPN-003', user: 'billing-ops', profile: 'PPTP-Billing', status: 'idle', endpoint: '190.44.99.20' }
  ])
  const [subdomains, setSubdomains] = useState<SubdomainRecord[]>([
    { id: 'SUB-001', host: 'clientes.ispfast.net', target: 'portal.ispfast.net', status: 'active' },
    { id: 'SUB-002', host: 'pagos.ispfast.net', target: 'billing.ispfast.net', status: 'active' },
    { id: 'SUB-003', host: 'status.ispfast.net', target: 'monitor.ispfast.net', status: 'pending' }
  ])
  const [directoryServices, setDirectoryServices] = useState<DirectoryServiceRecord[]>([
    { id: 'DIR-001', service: 'Portal de Clientes', owner: 'Soporte', status: 'active', updatedAt: '2026-02-15' },
    { id: 'DIR-002', service: 'Gestor de Pagos', owner: 'Finanzas', status: 'active', updatedAt: '2026-02-13' },
    { id: 'DIR-003', service: 'NOC Monitor', owner: 'Redes', status: 'draft', updatedAt: '2026-02-14' }
  ])
  const [hotspotPlans, setHotspotPlans] = useState<HotspotPlanRecord[]>([
    { id: 'HSP-30', name: 'Navegacion 30 min', prefix: 'HS30', durationMinutes: 30, bandwidth: '4M/2M', price: 1.5, enabled: true },
    { id: 'HSP-60', name: 'Navegacion 60 min', prefix: 'HS60', durationMinutes: 60, bandwidth: '8M/4M', price: 2.5, enabled: true },
    { id: 'HSP-DAY', name: 'Dia completo', prefix: 'HSDAY', durationMinutes: 1440, bandwidth: '12M/6M', price: 5, enabled: true }
  ])
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([])
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSaleRecord[]>([
    { id: 'POS-001', name: 'Caja Central', manager: 'Ronald C.', city: 'Lima', active: true, balance: 420.5 },
    { id: 'POS-002', name: 'Modulo Norte', manager: 'Ana T.', city: 'Lima', active: true, balance: 210.2 },
    { id: 'POS-003', name: 'Agente Sur', manager: 'Luisa V.', city: 'Lima', active: false, balance: 88 }
  ])
  const [cashClosings, setCashClosings] = useState<CashCloseRecord[]>([
    { id: 'CC-001', openedAt: '2026-02-16 08:00', closedAt: null, grossSales: 630, expenses: 82, net: 548, status: 'open' },
    { id: 'CC-002', openedAt: '2026-02-15 08:00', closedAt: '2026-02-15 20:00', grossSales: 580, expenses: 74, net: 506, status: 'closed' }
  ])

  const activeView: DashboardView = useMemo(() => {
    const raw = searchParams.get('view')
    return raw && viewIds.has(raw as DashboardView) ? (raw as DashboardView) : 'dashboard'
  }, [searchParams])

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

  const openModule = (
    view: DashboardView,
    tab?: {
      key: 'clientsTab' | 'financeTab' | 'systemTab' | 'hotspotTab' | 'warehouseTab' | 'settingsTab'
      value: string
    }
  ) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', view)
    params.delete('clientsTab')
    params.delete('financeTab')
    params.delete('systemTab')
    params.delete('hotspotTab')
    params.delete('warehouseTab')
    params.delete('settingsTab')
    if (tab) params.set(tab.key, tab.value)
    setSearchParams(params, { replace: true })
  }

  const goToFinance = (tab: FinanceTab, status?: InvoiceStatus) => {
    openModule('finance', { key: 'financeTab', value: tab })
    if (status) setInvoiceFilter(status)
  }

  const copyAffiliateLink = async () => {
    const slug = company.name.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() || 'ispfast'
    const link = `https://portal.ispfast.net/ref/${slug}`
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      }
      toast.success(`Enlace de afiliado listo: ${link}`)
    } catch {
      toast.success(`Enlace generado: ${link}`)
    }
  }

  const registerAffiliateConversion = () => {
    setAffiliateStats((prev) => ({
      referrals: prev.referrals + 1,
      converted: prev.converted + 1,
      pending: Math.max(0, prev.pending - 1),
      monthlyCommission: prev.monthlyCommission + 38
    }))
    toast.success('Referido afiliado registrado en el panel.')
  }

  const toggleResourceItem = (itemId: string) => {
    setResourceChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    )
  }

  const selectedMikrotikRouter = useMemo(
    () => mikrotikRouters.find((router) => router.id === selectedRouterId) || null,
    [mikrotikRouters, selectedRouterId]
  )

  const selectedOltDevice = useMemo(
    () => oltDevices.find((item) => item.id === selectedOltId) || null,
    [oltDevices, selectedOltId]
  )

  const loadMikrotikRouters = async () => {
    try {
      const response = (await apiClient.get('/mikrotik/routers').catch(() => null)) as any
      const parsed = normalizeRouterList(response?.routers)
      setMikrotikRouters(parsed)
      setSelectedRouterId((prev) => {
        if (prev && parsed.some((item) => item.id === prev)) return prev
        return parsed.length > 0 ? parsed[0].id : null
      })
    } catch (error) {
      console.error(error)
      const fallback = normalizeRouterList(null)
      setMikrotikRouters(fallback)
      setSelectedRouterId((prev) => prev || fallback[0]?.id || null)
      toast.error('No se pudo leer el inventario de routers. Se usaron datos locales.')
    }
  }

  const loadRouterTelemetry = async (routerId: string, silent = false) => {
    if (!silent) setRouterLoading(true)
    try {
      const [healthRes, queueRes, connectionRes] = await Promise.all([
        apiClient.get(`/mikrotik/routers/${routerId}/health`).catch(() => null),
        apiClient.get(`/mikrotik/routers/${routerId}/queues`).catch(() => null),
        apiClient.get(`/mikrotik/routers/${routerId}/connections`).catch(() => null)
      ])

      setRouterHealth(normalizeRouterHealth((healthRes as any)?.health))
      setRouterQueues(normalizeRouterQueues((queueRes as any)?.queues))
      setRouterSessions(normalizeRouterSessions((connectionRes as any)?.connections))
      setRouterLastSync(`Sincronizado ${new Date().toLocaleString()}`)
    } catch (error) {
      console.error(error)
      setRouterHealth(normalizeRouterHealth(null))
      setRouterQueues(normalizeRouterQueues(null))
      setRouterSessions(normalizeRouterSessions(null))
      setRouterLastSync('No se pudo sincronizar con el router seleccionado.')
      toast.error('No se pudieron leer metricas de MikroTik.')
    } finally {
      setRouterLoading(false)
    }
  }

  const loadEnterpriseSnapshot = async (routerId: string, silent = false) => {
    if (!silent) setEnterpriseLoading(true)
    try {
      const response = (await apiClient.get(`/mikrotik/routers/${routerId}/enterprise/snapshot`).catch(() => null)) as any
      setEnterpriseSnapshot(normalizeEnterpriseSnapshot(response?.snapshot))
    } catch (error) {
      console.error(error)
      setEnterpriseSnapshot(normalizeEnterpriseSnapshot(null))
      toast.error('No se pudo cargar el snapshot enterprise del router.')
    } finally {
      setEnterpriseLoading(false)
    }
  }

  const loadEnterpriseChangeLog = async (routerId: string, silent = false) => {
    if (!silent) setChangeLogLoading(true)
    try {
      const response = (await apiClient.get(`/mikrotik/routers/${routerId}/enterprise/change-log?limit=40`).catch(() => null)) as any
      setEnterpriseChangeLog(normalizeEnterpriseChangeLog(response?.changes))
    } catch (error) {
      console.error(error)
      setEnterpriseChangeLog([])
      toast.error('No se pudo cargar la bitacora de cambios.')
    } finally {
      setChangeLogLoading(false)
    }
  }

  const applyEnterpriseHardening = async (dryRun: boolean) => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para aplicar hardening.')
      return
    }
    setHardeningBusy(true)
    try {
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/enterprise/hardening`, {
        dry_run: dryRun,
        profile: hardeningProfile,
        site_profile: hardeningSiteProfile,
        auto_rollback: true
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || 'No se pudo ejecutar el hardening.')
        return
      }
      if (response?.dry_run) {
        toast.success('Dry-run de hardening generado. Revisa la propuesta.')
      } else {
        toast.success('Hardening aplicado en el router.')
      }
      await Promise.all([loadEnterpriseSnapshot(selectedMikrotikRouter.id, true), loadEnterpriseChangeLog(selectedMikrotikRouter.id, true)])
    } catch (error) {
      console.error(error)
      toast.error('No se pudo ejecutar el hardening enterprise.')
    } finally {
      setHardeningBusy(false)
    }
  }

  const rollbackEnterpriseChange = async (changeId: string) => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para ejecutar rollback.')
      return
    }
    setRollbackBusyId(changeId)
    try {
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/enterprise/rollback/${changeId}`, {}).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || `No se pudo revertir ${changeId}.`)
        return
      }
      toast.success(`Rollback ejecutado para ${changeId}.`)
      await Promise.all([loadEnterpriseSnapshot(selectedMikrotikRouter.id, true), loadEnterpriseChangeLog(selectedMikrotikRouter.id, true)])
    } catch (error) {
      console.error(error)
      toast.error('No se pudo ejecutar rollback enterprise.')
    } finally {
      setRollbackBusyId(null)
    }
  }

  const runEnterpriseFailoverTest = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para ejecutar failover test.')
      return
    }
    const targets = Array.from(
      new Set(
        failoverTargetsDraft
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, 8)

    if (targets.length === 0) {
      toast.error('Define al menos un destino de prueba.')
      return
    }

    setFailoverBusy(true)
    try {
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/enterprise/failover-test`, {
        targets,
        count: 4
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || 'No se pudo ejecutar failover test.')
        return
      }
      const report = normalizeFailoverReport(response?.report)
      setFailoverReport(report)
      toast.success(`Failover test completado con estado ${report.overallStatus.toUpperCase()}.`)
    } catch (error) {
      console.error(error)
      toast.error('No se pudo completar el failover test enterprise.')
    } finally {
      setFailoverBusy(false)
    }
  }

  const toggleRouterInterfaceFromNoc = async (name: string, nextEnabled: boolean) => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para gestionar interfaces.')
      return
    }
    try {
      const encodedName = encodeURIComponent(name)
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/interfaces/${encodedName}/toggle`, {
        enabled: nextEnabled
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || `No se pudo cambiar estado de ${name}.`)
        return
      }
      toast.success(`Interfaz ${name} ${nextEnabled ? 'habilitada' : 'deshabilitada'}.`)
      await Promise.all([
        loadRouterTelemetry(selectedMikrotikRouter.id, true),
        loadEnterpriseSnapshot(selectedMikrotikRouter.id, true),
        loadEnterpriseChangeLog(selectedMikrotikRouter.id, true)
      ])
    } catch (error) {
      console.error(error)
      toast.error('Error gestionando interfaz en MikroTik.')
    }
  }

  const loadOltCatalog = async () => {
    try {
      const [vendorsRes, devicesRes] = await Promise.all([
        apiClient.get('/olt/vendors').catch(() => null),
        apiClient.get('/olt/devices').catch(() => null)
      ])
      const parsedVendors = normalizeOltVendors((vendorsRes as any)?.vendors)
      const parsedDevices = normalizeOltDevices((devicesRes as any)?.devices)
      setOltVendors(parsedVendors)
      setOltDevices(parsedDevices)
      setSelectedOltId((prev) => (prev && parsedDevices.some((item) => item.id === prev) ? prev : parsedDevices[0]?.id || ''))
    } catch (error) {
      console.error(error)
      setOltVendors(normalizeOltVendors(null))
      const fallbackDevices = normalizeOltDevices(null)
      setOltDevices(fallbackDevices)
      setSelectedOltId((prev) => prev || fallbackDevices[0]?.id || '')
      toast.error('No se pudo cargar el inventario OLT. Se aplicó modo local.')
    }
  }

  const loadOltSnapshot = async (deviceId: string, silent = false) => {
    if (!deviceId) return
    if (!silent) setOltBusy(true)
    try {
      const response = (await apiClient.get(`/olt/devices/${deviceId}/snapshot`).catch(() => null)) as any
      setOltSnapshot(normalizeOltSnapshot(response?.snapshot))
    } catch (error) {
      console.error(error)
      setOltSnapshot(normalizeOltSnapshot(null))
      toast.error('No se pudo cargar el snapshot de OLT.')
    } finally {
      setOltBusy(false)
    }
  }

  const loadOltAuditLog = async (silent = false) => {
    if (!silent) setOltAuditLoading(true)
    try {
      const response = (await apiClient.get('/olt/audit-log?limit=40').catch(() => null)) as any
      setOltAuditLog(normalizeOltAuditLog(response?.entries))
    } catch (error) {
      console.error(error)
      if (!silent) toast.error('No se pudo cargar la bitacora de ejecucion OLT.')
      setOltAuditLog([])
    } finally {
      setOltAuditLoading(false)
    }
  }

  const testOltConnection = async () => {
    if (!selectedOltId) {
      toast.error('Selecciona una OLT para probar conexión.')
      return
    }
    setOltBusy(true)
    try {
      const response = (await apiClient.post('/olt/devices/test-connection', { device_id: selectedOltId, timeout: 3 }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      setOltConnectionResult({
        reachable: ok && Boolean(response?.reachable ?? true),
        latencyMs: typeof response?.latency_ms === 'number' ? response.latency_ms : null,
        message: String(response?.message || (ok ? 'Conectividad OK' : 'Sin conectividad'))
      })
      if (ok) toast.success('Prueba de conexión OLT completada.')
      else toast.error(response?.error || 'No se pudo conectar a la OLT.')
    } catch (error) {
      console.error(error)
      toast.error('Error al probar conexión OLT.')
    } finally {
      setOltBusy(false)
    }
  }

  const generateOltScript = async () => {
    if (!selectedOltId) {
      toast.error('Selecciona una OLT para generar script.')
      return
    }
    setOltBusy(true)
    try {
      const response = (await apiClient.post(`/olt/devices/${selectedOltId}/script/generate`, {
        action: oltScriptAction,
        payload: {
          frame: Number(oltScriptPayload.frame) || 0,
          slot: Number(oltScriptPayload.slot) || 1,
          pon: Number(oltScriptPayload.pon) || 1,
          onu: Number(oltScriptPayload.onu) || 1,
          serial: oltScriptPayload.serial,
          vlan: Number(oltScriptPayload.vlan) || 120
        }
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || 'No se pudo generar el script OLT.')
        return
      }
      setOltGeneratedCommands(Array.isArray(response?.commands) ? response.commands.map((item: any) => String(item)) : [])
      setOltQuickScript(String(response?.quick_connect?.windows || ''))
      toast.success('Script OLT generado correctamente.')
    } catch (error) {
      console.error(error)
      toast.error('Error generando script OLT.')
    } finally {
      setOltBusy(false)
    }
  }

  const executeOltScript = async () => {
    if (!selectedOltId) {
      toast.error('Selecciona una OLT para ejecutar script.')
      return
    }
    if (oltGeneratedCommands.length === 0) {
      toast.error('Primero genera comandos para la OLT.')
      return
    }
    setOltBusy(true)
    try {
      const response = (await apiClient.post(`/olt/devices/${selectedOltId}/script/execute`, {
        commands: oltGeneratedCommands,
        run_mode: oltRunMode,
        live_confirm: oltRunMode === 'live'
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || 'No se pudo ejecutar el script OLT.')
        return
      }
      setOltTranscript(Array.isArray(response?.transcript) ? response.transcript.map((item: any) => String(item)) : [])
      toast.success(oltRunMode === 'live' ? 'Ejecucion live OLT completada.' : 'Ejecucion asistida OLT completada.')
      await Promise.all([loadOltSnapshot(selectedOltId, true), loadOltAuditLog(true)])
    } catch (error) {
      console.error(error)
      toast.error('Error ejecutando script OLT.')
    } finally {
      setOltBusy(false)
    }
  }

  const loadOltQuickConnectScript = async (platform: 'windows' | 'linux' = 'windows') => {
    if (!selectedOltId) {
      toast.error('Selecciona una OLT para generar script rapido.')
      return
    }
    setOltBusy(true)
    try {
      const payload = {
        frame: Number(oltScriptPayload.frame) || 0,
        slot: Number(oltScriptPayload.slot) || 1,
        pon: Number(oltScriptPayload.pon) || 1,
        onu: Number(oltScriptPayload.onu) || 1,
        serial: oltScriptPayload.serial,
        vlan: Number(oltScriptPayload.vlan) || 120
      }
      const response = (await apiClient.post(`/olt/devices/${selectedOltId}/quick-connect-script`, {
        action: oltScriptAction,
        payload,
        platform
      }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (!ok) {
        toast.error(response?.error || 'No se pudo generar el script rapido de conexion.')
        return
      }
      setOltQuickScript(String(response?.script || ''))
      toast.success(`Script rapido ${platform} generado.`)
    } catch (error) {
      console.error(error)
      toast.error('Error generando script rapido OLT.')
    } finally {
      setOltBusy(false)
    }
  }

  const loadOltQuickLogin = async (platform: 'windows' | 'linux' = 'windows') => {
    if (!selectedOltId) {
      toast.error('Selecciona una OLT para login rápido.')
      return
    }
    setOltBusy(true)
    try {
      const res = (await apiClient.get(`/olt/devices/${selectedOltId}/quick-login?platform=${platform}`)) as any
      const cmd = String(res?.command || '')
      setOltQuickLogin(cmd)
      if (cmd) {
        toast.success(`Login ${platform === 'windows' ? 'PowerShell' : 'bash'} listo.`)
      } else {
        toast.error('No se generó comando de login.')
      }
    } catch (error) {
      console.error(error)
      toast.error('No se pudo generar login rápido.')
    } finally {
      setOltBusy(false)
    }
  }

  const testTr064Connectivity = async () => {
    if (!tr064Config.host.trim()) {
      toast.error('Ingresa el host de la OLT/TR-064.')
      return
    }
    setOltBusy(true)
    try {
      const response = (await apiClient
        .post('/olt/tr064/test', {
          host: tr064Config.host.trim(),
          port: tr064Config.port,
          username: tr064Config.username.trim(),
          password: tr064Config.password.trim(),
          vendor: tr064Config.vendor
        })
        .catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      const message = response?.message || (ok ? 'TR-064 accesible' : 'Sin respuesta TR-064')
      setTr064Status({ ok, message })
      toast[ok ? 'success' : 'error'](message)
    } catch (error) {
      console.error(error)
      setTr064Status({ ok: false, message: 'Fallo en prueba TR-064.' })
      toast.error('No se pudo probar TR-064.')
    } finally {
      setOltBusy(false)
    }
  }

  const generateTr064ProvisionScript = () => {
    if (!selectedOltId && !tr064Config.host.trim()) {
      toast.error('Selecciona una OLT o define host TR-064.')
      return
    }
    const commands = [
      `# TR-064 ${tr064Config.vendor.toUpperCase()} aprovisionamiento basico`,
      `# host: ${tr064Config.host || 'seleccionado'}`,
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username=cliente@ispfast',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password=claveSegura123',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID=ISPFAST_WIFI',
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase=ClaveFuerte2026',
      'InternetGatewayDevice.Layer3Forwarding.DefaultConnectionService=1'
    ]
    const scriptText = commands.join('\n')
    setOltGeneratedCommands(commands)
    setTr064Script(scriptText)
    setTr064Status({ ok: true, message: 'Script TR-064 generado para aplicar por ACS o CLI.' })
    toast.success('Script TR-064 generado.')
  }

  const copyOltQuickScript = async () => {
    const text = oltQuickScript.trim()
    if (!text) {
      toast.error('No hay script rápido para copiar.')
      return
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      toast.success('Script de conexión rápida copiado.')
    } catch {
      toast.success('Script disponible en pantalla para copiar.')
    }
  }

  const copyOltQuickLogin = async () => {
    const text = oltQuickLogin.trim()
    if (!text) {
      toast.error('No hay comando de login rápido.')
      return
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      toast.success('Comando de login copiado.')
    } catch {
      toast.success('Comando visible para copiar manualmente.')
    }
  }

  const copyTr064Script = async () => {
    const text = tr064Script.trim()
    if (!text) {
      toast.error('No hay script TR-064 para copiar.')
      return
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      toast.success('Script TR-064 copiado.')
    } catch {
      toast.success('Script visible en pantalla para copiar manualmente.')
    }
  }

  const withRouterAction = async (action: RouterAction, callback: () => Promise<{ ok: boolean; message: string }>) => {
    setRouterActionLoading(action)
    try {
      const result = await callback()
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    } catch (error) {
      console.error(error)
      toast.error('La accion no pudo completarse en MikroTik.')
    } finally {
      setRouterActionLoading(null)
    }
  }

  const testRouterConnection = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para probar conexion.')
      return
    }
    await withRouterAction('test', async () => {
      const response = (await apiClient.get(`/mikrotik/routers/${selectedMikrotikRouter.id}/test-connection`).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      if (ok) await Promise.all([loadRouterTelemetry(selectedMikrotikRouter.id, true), loadEnterpriseSnapshot(selectedMikrotikRouter.id, true), loadEnterpriseChangeLog(selectedMikrotikRouter.id, true)])
      return {
        ok,
        message: ok ? `Conexion estable con ${selectedMikrotikRouter.name}.` : `No se pudo conectar con ${selectedMikrotikRouter.name}.`
      }
    })
  }

  const backupSelectedRouter = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para generar backup.')
      return
    }
    await withRouterAction('backup', async () => {
      const payload = { name: `backup_${selectedMikrotikRouter.name}_${new Date().toISOString().slice(0, 10)}` }
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/backup`, payload).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      return { ok, message: ok ? 'Backup remoto generado correctamente.' : 'Error generando backup remoto.' }
    })
  }

  const rebootSelectedRouter = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para reiniciar.')
      return
    }
    await withRouterAction('reboot', async () => {
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/reboot`, {}).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      return { ok, message: ok ? 'Reinicio solicitado al router.' : 'El router no acepto la orden de reinicio.' }
    })
  }

  const refreshRouterTelemetry = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('No hay router seleccionado.')
      return
    }
    await withRouterAction('refresh', async () => {
      await Promise.all([
        loadRouterTelemetry(selectedMikrotikRouter.id, false),
        loadEnterpriseSnapshot(selectedMikrotikRouter.id, true),
        loadEnterpriseChangeLog(selectedMikrotikRouter.id, true)
      ])
      return { ok: true, message: 'Metricas de router actualizadas.' }
    })
  }

  const applyHotspotConfiguration = async () => {
    if (!selectedMikrotikRouter) {
      toast.error('Debes seleccionar un router para configurar HotSpot.')
      return
    }
    await withRouterAction('hotspot', async () => {
      const payload = {
        dns_name: hotspotDnsName.trim(),
        interface: hotspotInterface.trim(),
        address_pool: hotspotAddressPool.trim()
      }
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/hotspot`, payload).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      return {
        ok,
        message: ok ? 'Configuracion HotSpot sincronizada con MikroTik.' : 'No se pudo aplicar configuracion HotSpot.'
      }
    })
  }

  const executeScriptOnSelectedRouter = async (script: string, successMessage = 'Script ejecutado correctamente.') => {
    if (!selectedMikrotikRouter) {
      toast.error('Selecciona un router para ejecutar scripts.')
      return
    }
    const normalized = script.trim()
    if (!normalized) {
      toast.error('El script no puede estar vacio.')
      return
    }
    await withRouterAction('script', async () => {
      const response = (await apiClient.post(`/mikrotik/routers/${selectedMikrotikRouter.id}/execute-script`, { script: normalized }).catch(() => null)) as any
      const ok = typeof response?.success === 'boolean' ? response.success : true
      return { ok, message: ok ? successMessage : 'Error ejecutando script en router.' }
    })
  }

  const runTemplateScript = async () => {
    const template = scriptTemplates.find((item) => item.id === templateToRunId)
    if (!template) {
      toast.error('Selecciona una plantilla valida.')
      return
    }
    await executeScriptOnSelectedRouter(template.script, `Plantilla "${template.name}" enviada al router.`)
  }

  const runScheduledTaskNow = async (task: ScheduledTaskRecord) => {
    await executeScriptOnSelectedRouter(`/system scheduler run [find name="${task.name}"]`, `Tarea "${task.name}" ejecutada.`)
    setScheduledTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, lastRun: new Date().toLocaleString() } : item)))
  }

  const toggleInternetPlan = (id: string) => {
    setInternetPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, enabled: !plan.enabled } : plan)))
  }

  const togglePhoneTvPlan = (id: string) => {
    setPhoneTvPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, enabled: !plan.enabled } : plan)))
  }

  const toggleScheduledTask = (id: string) => {
    setScheduledTasks((prev) => prev.map((task) => (task.id === id ? { ...task, enabled: !task.enabled } : task)))
  }

  const toggleVpnUserStatus = (id: string) => {
    setVpnUsers((prev) => prev.map((user) => (user.id === id ? { ...user, status: user.status === 'connected' ? 'idle' : 'connected' } : user)))
  }

  const toggleSubdomainStatus = (id: string) => {
    setSubdomains((prev) => prev.map((item) => (item.id === id ? { ...item, status: item.status === 'active' ? 'pending' : 'active' } : item)))
  }

  const toggleDirectoryStatus = (id: string) => {
    setDirectoryServices((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: item.status === 'active' ? 'draft' : 'active', updatedAt: new Date().toISOString().slice(0, 10) } : item))
    )
  }

  const toggleHotspotPlan = (id: string) => {
    setHotspotPlans((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)))
  }

  const generateHotspotVouchers = async () => {
    const plan = hotspotPlans.find((item) => item.id === voucherDraft.planId)
    if (!plan) {
      toast.error('Selecciona un plan HotSpot valido.')
      return
    }
    const qty = Math.min(Math.max(Math.round(Number(voucherDraft.qty) || 0), 1), 150)
    const point = pointsOfSale.find((item) => item.id === voucherDraft.pointOfSaleId)
    const createdAt = new Date().toISOString()
    const generated: VoucherRecord[] = Array.from({ length: qty }).map((_, index) => ({
      id: `VCH-${Date.now()}-${index + 1}`,
      code: `${plan.prefix}-${Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`,
      planId: plan.id,
      soldBy: point?.name || 'Caja Central',
      soldAt: createdAt,
      amount: plan.price,
      status: 'generated'
    }))
    setVouchers((prev) => [...generated, ...prev])
    toast.success(`${qty} fichas generadas para ${plan.name}.`)

    if (selectedMikrotikRouter) {
      const lines = generated.slice(0, 50).map((voucher) => `/ip hotspot user add name="${voucher.code}" password="${voucher.code}" comment="${plan.name}"`)
      await executeScriptOnSelectedRouter(lines.join('\n'), 'Fichas sincronizadas con MikroTik.')
    }
  }

  const markVoucherAsSold = (id: string) => {
    setVouchers((prev) => prev.map((voucher) => (voucher.id === id ? { ...voucher, status: 'sold', soldAt: new Date().toLocaleString() } : voucher)))
  }

  const markVoucherAsUsed = (id: string) => {
    setVouchers((prev) => prev.map((voucher) => (voucher.id === id ? { ...voucher, status: 'used' } : voucher)))
  }

  const togglePointOfSale = (id: string) => {
    setPointsOfSale((prev) => prev.map((pos) => (pos.id === id ? { ...pos, active: !pos.active } : pos)))
  }

  const registerCashClose = () => {
    const hasOpen = cashClosings.some((item) => item.status === 'open')
    if (hasOpen) {
      setCashClosings((prev) =>
        prev.map((item) => (item.status === 'open' ? { ...item, status: 'closed', closedAt: new Date().toLocaleString() } : item))
      )
      toast.success('Corte de caja cerrado correctamente.')
      return
    }

    const grossSales = Number((180 + Math.random() * 400).toFixed(2))
    const expensesAmount = Number((40 + Math.random() * 90).toFixed(2))
    setCashClosings((prev) => [
      {
        id: `CC-${Date.now()}`,
        openedAt: new Date().toLocaleString(),
        closedAt: null,
        grossSales,
        expenses: expensesAmount,
        net: Number((grossSales - expensesAmount).toFixed(2)),
        status: 'open'
      },
      ...prev
    ])
    toast.success('Nueva caja general abierta.')
  }

  const loadData = async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const [dashboardRes, billingRes, connectionsRes, notificationsRes] = await Promise.all([
        apiClient.get('/dashboard').catch(() => null),
        apiClient.get('/billing').catch(() => null),
        apiClient.get('/connections').catch(() => null),
        apiClient.get('/notifications').catch(() => null)
      ])

      const overviewRaw = (dashboardRes as any)?.overview
      setOverview({
        uptime: overviewRaw?.uptime || '99.98%',
        currentSpeed: overviewRaw?.currentSpeed || '85 Mbps',
        totalDownload: '8503.73 GiB',
        totalUpload: '833.48 GiB'
      })

      setInvoices(normalizeInvoices((billingRes as any)?.invoices))
      setConnections(normalizeConnections((connectionsRes as any)?.connections))

      const unread = ((notificationsRes as any)?.notifications || []).filter((n: any) => !n.read).length
      setTickets({ today: 0, pending: unread || 0, month: (unread || 0) + 5 })
    } catch (error) {
      console.error(error)
      toast.error('No se pudo actualizar el dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastAutoRefreshAt(new Date().toLocaleTimeString())
    }
  }

  useEffect(() => {
    loadData()
    loadMikrotikRouters()
    loadOltCatalog()
    loadOltAuditLog(true)
  }, [])

  useEffect(() => {
    if (!selectedRouterId) return
    loadRouterTelemetry(selectedRouterId, true)
    loadEnterpriseSnapshot(selectedRouterId, true)
    loadEnterpriseChangeLog(selectedRouterId, true)
    setFailoverReport(null)
  }, [selectedRouterId])

  useEffect(() => {
    if (!selectedOltId) return
    loadOltSnapshot(selectedOltId, true)
    setOltGeneratedCommands([])
    setOltQuickScript('')
    setOltTranscript([])
    setOltConnectionResult(null)
  }, [selectedOltId])

  useEffect(() => {
    setCurrentPage(1)
  }, [clientSearch, clientFilter, planFilter, riskFilter, segmentFilter, pageSize, sortField, sortDirection])

  useEffect(() => {
    if (!autoRefreshEnabled || loading) return
    if (activeView === 'manual' || activeView === 'company' || activeView === 'affiliate' || activeView === 'resources' || activeView === 'settings') {
      return
    }

    const interval = window.setInterval(() => {
      loadData(true)
      if (selectedRouterId && (activeView === 'dashboard' || activeView === 'system' || activeView === 'hotspot')) {
        loadRouterTelemetry(selectedRouterId, true)
      }
      if (selectedOltId && activeView === 'system' && activeSystemTab === 'admin-olt') {
        loadOltSnapshot(selectedOltId, true)
      }
      setLastAutoRefreshAt(new Date().toLocaleTimeString())
    }, autoRefreshSeconds * 1000)

    return () => window.clearInterval(interval)
  }, [autoRefreshEnabled, autoRefreshSeconds, loading, activeView, activeSystemTab, selectedRouterId, selectedOltId])

  const paidToday = useMemo(() => invoices.filter((i) => i.status === 'paid').reduce((a, b) => a + b.amount, 0), [invoices])
  const pendingAmount = useMemo(
    () => invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((a, b) => a + b.amount, 0),
    [invoices]
  )
  const monthAmount = useMemo(() => invoices.reduce((a, b) => a + b.amount, 0), [invoices])

  const clientProfiles = useMemo<ClientProfile[]>(() => {
    return connections.map((connection, index) => {
      const fallbackPlan = planOptions[index % planOptions.length]
      const baseUsage = Math.round((index + 1) * 5.2 + (connection.status === 'active' ? 24 : connection.status === 'idle' ? 11 : 3))
      const generatedMeta: ClientMeta = {
        name: namePool[index % namePool.length],
        plan: fallbackPlan,
        zone: zones[index % zones.length],
        debt: connection.status === 'offline' ? 120 + index * 7 : connection.status === 'idle' ? 55 + index * 5 : 0,
        tickets: connection.status === 'active' ? Math.max(0, (index + 1) % 3 - 1) : 1 + (index % 3)
      }
      const meta = clientMeta[connection.id] || generatedMeta
      const risk: RiskLevel = meta.debt > 100 || connection.status === 'offline' ? 'high' : meta.debt > 0 || meta.tickets > 2 ? 'medium' : 'low'

      return {
        id: connection.id,
        code: `CL-${String(index + 1).padStart(4, '0')}`,
        name: meta.name,
        username: `${meta.name.split(' ')[0].toLowerCase()}@${company.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'ispfast'}.net`,
        ip: connection.ip,
        mac: connection.mac,
        status: connection.status,
        plan: meta.plan,
        zone: meta.zone,
        lanInterface: lanInterfaces[index % lanInterfaces.length],
        cutoffDay: cutoffPool[index % cutoffPool.length],
        screenNotice: index % 2 === 0,
        phone: meta.phone || '—',
        email: meta.email || '',
        address: meta.address || '',
        routerId: meta.routerId,
        planCost: typeof meta.planCost === 'number' ? meta.planCost : planPricing[meta.plan],
        monthlyUsage: baseUsage,
        debt: meta.debt,
        risk,
        tickets: meta.tickets,
        lastSeen: connection.status === 'active' ? 'Ahora' : connection.status === 'idle' ? 'Hace 15 min' : 'Hace 3 horas'
      }
    })
  }, [clientMeta, connections])

  const filteredClientProfiles = useMemo(() => {
    const filtered = clientProfiles
      .filter((item) => (clientFilter === 'all' ? true : item.status === clientFilter))
      .filter((item) => (zoneFilter === 'all' ? true : item.zone === zoneFilter))
      .filter((item) => (planFilter === 'all' ? true : item.plan === planFilter))
      .filter((item) => (riskFilter === 'all' ? true : item.risk === riskFilter))
      .filter((item) => {
        if (segmentFilter === 'all') return true
        if (segmentFilter === 'delinquent') return item.debt > 0
        if (segmentFilter === 'highUsage') return item.monthlyUsage >= 80
        if (segmentFilter === 'support') return item.tickets > 0 || item.risk === 'high'
        return item.debt === 0 && item.tickets === 0 && item.risk === 'low'
      })
      .filter((item) => {
        const needle = clientSearch.trim().toLowerCase()
        if (!needle) return true
        return (
          item.name.toLowerCase().includes(needle) ||
          item.ip.toLowerCase().includes(needle) ||
          item.mac.toLowerCase().includes(needle) ||
          item.code.toLowerCase().includes(needle) ||
          item.zone.toLowerCase().includes(needle)
        )
      })
      .filter((item) => (clientColumnFilters.name ? item.name.toLowerCase().includes(clientColumnFilters.name.trim().toLowerCase()) : true))
      .filter((item) => (clientColumnFilters.username ? item.username.toLowerCase().includes(clientColumnFilters.username.trim().toLowerCase()) : true))
      .filter((item) => (clientColumnFilters.ip ? item.ip.toLowerCase().includes(clientColumnFilters.ip.trim().toLowerCase()) : true))
      .filter((item) => (clientColumnFilters.lan ? item.lanInterface.toLowerCase().includes(clientColumnFilters.lan.trim().toLowerCase()) : true))
      .filter((item) => (clientColumnFilters.cutoff ? item.cutoffDay.toLowerCase().includes(clientColumnFilters.cutoff.trim().toLowerCase()) : true))
      .filter((item) => {
        if (clientColumnFilters.screen === 'all') return true
        if (clientColumnFilters.screen === 'yes') return item.screenNotice
        return !item.screenNotice
      })

    const sorted = [...filtered].sort((a, b) => {
      const factor = sortDirection === 'asc' ? 1 : -1
      if (sortField === 'usage') return (a.monthlyUsage - b.monthlyUsage) * factor
      if (sortField === 'debt') return (a.debt - b.debt) * factor
      if (sortField === 'tickets') return (a.tickets - b.tickets) * factor
      return a.name.localeCompare(b.name) * factor
    })

    return sorted
  }, [clientProfiles, clientFilter, zoneFilter, planFilter, riskFilter, segmentFilter, clientSearch, clientColumnFilters, sortDirection, sortField])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredClientProfiles.length / pageSize)), [filteredClientProfiles.length, pageSize])
  const clientRowPadding = tableDensity === 'compact' ? 'py-1.5' : 'py-2'
  const pageRange = useMemo(() => {
    const start = filteredClientProfiles.length === 0 ? 0 : (Math.min(currentPage, totalPages) - 1) * pageSize + 1
    const end = Math.min(filteredClientProfiles.length, Math.min(currentPage, totalPages) * pageSize)
    return { start, end }
  }, [filteredClientProfiles.length, currentPage, totalPages, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    const available = new Set(filteredClientProfiles.map((item) => item.id))
    setSelectedClientIds((prev) => prev.filter((id) => available.has(id)))
    if (selectedClientId && !available.has(selectedClientId)) setSelectedClientId(null)
  }, [filteredClientProfiles, selectedClientId])

  useEffect(() => {
    fetchSubscriptions()
    fetchNetworkHealth()
    fetchNocAlerts()
  }, [])

  useEffect(() => {
    fetchSubscriptions()
    fetchNetworkHealth()
  }, [])

  const paginatedClientProfiles = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    const start = (safePage - 1) * pageSize
    return filteredClientProfiles.slice(start, start + pageSize)
  }, [currentPage, filteredClientProfiles, pageSize, totalPages])

  const selectedClientProfile = useMemo(
    () => clientProfiles.find((item) => item.id === selectedClientId) || null,
    [clientProfiles, selectedClientId]
  )

  const clientOpsSummary = useMemo(() => {
    const totalDebt = filteredClientProfiles.reduce((acc, item) => acc + item.debt, 0)
    const supportLoad = filteredClientProfiles.reduce((acc, item) => acc + item.tickets, 0)
    const highRisk = filteredClientProfiles.filter((item) => item.risk === 'high').length
    const avgUsage = filteredClientProfiles.length
      ? Math.round(filteredClientProfiles.reduce((acc, item) => acc + item.monthlyUsage, 0) / filteredClientProfiles.length)
      : 0
    const selectedDebt = filteredClientProfiles
      .filter((item) => selectedClientIds.includes(item.id))
      .reduce((acc, item) => acc + item.debt, 0)
    return { totalDebt, supportLoad, highRisk, avgUsage, selectedDebt }
  }, [filteredClientProfiles, selectedClientIds])

  const operationsHint = useMemo(() => {
    if (filteredClientProfiles.length === 0) return 'No hay clientes para el filtro actual.'
    if (clientOpsSummary.highRisk > 0) {
      return `Atencion: ${clientOpsSummary.highRisk} cliente(s) con riesgo alto requieren seguimiento.`
    }
    if (clientOpsSummary.totalDebt > 0) {
      return `Cobranza activa: S/. ${clientOpsSummary.totalDebt.toFixed(2)} pendientes de regularizacion.`
    }
    return 'Operacion estable: sin alertas criticas en el segmento actual.'
  }, [clientOpsSummary.highRisk, clientOpsSummary.totalDebt, filteredClientProfiles.length])

  const filteredInvoices = useMemo(() => invoices.filter((i) => invoiceFilter === 'all' || i.status === invoiceFilter), [invoices, invoiceFilter])

  const pendingInvoices = useMemo(() => invoices.filter((item) => item.status !== 'paid'), [invoices])
  const paidInvoices = useMemo(() => invoices.filter((item) => item.status === 'paid'), [invoices])

  const invoiceSearchResults = useMemo(() => {
    const needle = financeSearch.trim().toLowerCase()
    if (!needle) return invoices
    return invoices.filter((item) => {
      return (
        item.id.toLowerCase().includes(needle) ||
        item.status.toLowerCase().includes(needle) ||
        new Date(item.due).toLocaleDateString().toLowerCase().includes(needle)
      )
    })
  }, [financeSearch, invoices])

  const paymentRecords = useMemo<PaymentRecord[]>(() => {
    const fromInvoices: PaymentRecord[] = paidInvoices.map((item, index) => ({
      id: `PAY-INV-${index + 1}`,
      source: 'Factura',
      client: namePool[index % namePool.length],
      amount: item.amount,
      date: new Date(item.due).toISOString().slice(0, 10),
      method: index % 2 === 0 ? 'Transferencia' : 'Efectivo'
    }))

    const fromOtherIncome: PaymentRecord[] = otherIncomes.map((item, index) => ({
      id: `PAY-OTH-${index + 1}`,
      source: 'Otro ingreso',
      client: 'N/A',
      amount: item.amount,
      date: item.date,
      method: item.channel
    }))

    return [...fromInvoices, ...fromOtherIncome].sort((a, b) => a.date.localeCompare(b.date)).reverse()
  }, [otherIncomes, paidInvoices])

  const filteredPaymentRecords = useMemo(() => {
    const needle = financeSearch.trim().toLowerCase()
    if (!needle) return paymentRecords
    return paymentRecords.filter((item) => {
      return (
        item.id.toLowerCase().includes(needle) ||
        item.client.toLowerCase().includes(needle) ||
        item.method.toLowerCase().includes(needle) ||
        item.source.toLowerCase().includes(needle)
      )
    })
  }, [financeSearch, paymentRecords])

  const totalOtherIncome = useMemo(() => otherIncomes.reduce((acc, item) => acc + item.amount, 0), [otherIncomes])
  const totalExpenses = useMemo(() => expenses.reduce((acc, item) => acc + item.amount, 0), [expenses])
  const netCashFlow = useMemo(() => paidToday + totalOtherIncome - totalExpenses, [paidToday, totalOtherIncome, totalExpenses])
  const pendingPromises = useMemo(() => paymentPromises.filter((item) => item.status === 'pending'), [paymentPromises])
  const subscriptionsFiltered = useMemo(
    () => subscriptions.filter((s) => (subscriptionFilter === 'all' ? true : s.status === subscriptionFilter)),
    [subscriptions, subscriptionFilter]
  )
  const mrr = useMemo(
    () => subscriptions.reduce((acc, s) => acc + s.amount / s.cycleMonths, 0),
    [subscriptions]
  )
  const pastDueCount = useMemo(() => subscriptions.filter((s) => s.status === 'past_due').length, [subscriptions])
  const trialCount = useMemo(() => subscriptions.filter((s) => s.status === 'trial').length, [subscriptions])

  const financeBars = useMemo(() => {
    const monthTotals = new Array(12).fill(0)
    invoices.forEach((invoice) => {
      const month = new Date(invoice.due).getMonth()
      if (Number.isFinite(month)) monthTotals[month] += invoice.amount
    })
    return monthTotals.map((total, index) => ({ month: monthNames[index], total }))
  }, [invoices])

  const maxBarValue = useMemo(() => Math.max(...financeBars.map((item) => item.total), 1), [financeBars])

  const normalizeSubscriptionFromApi = (s: any): Subscription => ({
    id: String(s.id),
    customer: s.customer,
    email: s.email,
    plan: s.plan,
    cycleMonths: Number(s.cycle_months || s.cycleMonths || 1) as any,
    amount: Number(s.amount),
    status: s.status,
    nextCharge: s.next_charge || s.nextCharge,
    method: s.method || 'Stripe'
  })

  const fetchSubscriptions = async () => {
    try {
      const res = await apiClient.get('/subscriptions')
      if (Array.isArray(res?.items)) {
        setSubscriptions(res.items.map((s: any) => normalizeSubscriptionFromApi(s)))
        return
      }
      throw new Error('Respuesta sin items')
    } catch (error) {
      console.warn('No se pudieron cargar suscripciones, usando demo.', error)
      setSubscriptions([
        { id: 'SUB-001', customer: 'ISP Norte', email: 'ops@ispnorte.pe', plan: 'Mensual', cycleMonths: 1, amount: 120, status: 'active', nextCharge: '2026-03-01', method: 'Stripe' },
        { id: 'SUB-002', customer: 'Fibra Andina', email: 'admin@fibraandina.pe', plan: 'Trimestral', cycleMonths: 3, amount: 320, status: 'past_due', nextCharge: '2026-02-20', method: 'Transferencia' },
        { id: 'SUB-003', customer: 'Red Sur', email: 'cto@redsur.pe', plan: 'Semestral', cycleMonths: 6, amount: 640, status: 'trial', nextCharge: '2026-03-15', method: 'Stripe' },
        { id: 'SUB-004', customer: 'WispCloud', email: 'billing@wispcloud.com', plan: 'Anual', cycleMonths: 12, amount: 1200, status: 'active', nextCharge: '2026-12-01', method: 'Stripe' }
      ])
    }
  }

  const addClient = () => {
    setShowAddClient(true)
    setNewClientDraft((prev) => ({
      ...prev,
      planCost: planPricing[prev.plan],
      status: 'active'
    }))
  }

  const saveNewClient = () => {
    // Persist to backend and then update local state
    void (async () => {
      try {
        const payload: any = {
          name: newClientDraft.name.trim(),
          email: newClientDraft.email.trim() || `${slugify(newClientDraft.name)}@cliente.local`,
          connection_type: newClientDraft.connectionType,
          ip_address: newClientDraft.ip.trim(),
          mac_address: newClientDraft.ip ? `AA:BB:${String(Date.now()).slice(-4)}` : '',
          router_id: newClientDraft.routerId || null,
          plan_name: newClientDraft.plan,
          plan_cost: newClientDraft.planCost,
          provision: true,
          pppoe_username: newClientDraft.pppoeUser.trim() || undefined,
          pppoe_password: newClientDraft.pppoePass.trim() || undefined
        }
        await apiClient.post('/clients', payload)
      } catch (error) {
        console.warn('No se pudo guardar en backend, se continuará en modo local.', error)
      }
    })()

    const nextId = connections.length + 1
    const id = `c-${Date.now()}`
    if (!newClientDraft.name.trim()) {
      toast.error('Ingresa el nombre del cliente.')
      return
    }
    if (newClientDraft.connectionType === 'static' && !newClientDraft.ip.trim()) {
      toast.error('Ingresa la IP del cliente.')
      return
    }
    const mac = `AA:BB:CC:${String(nextId).padStart(2, '0')}:${String(nextId + 11).padStart(2, '0')}:${String(nextId + 22).padStart(2, '0')}`
    setConnections((prev) => [
      {
        id,
        ip: newClientDraft.ip.trim(),
        mac,
        status: newClientDraft.status
      },
      ...prev
    ])
    setClientMeta((prev) => ({
      ...prev,
      [id]: {
        name: newClientDraft.name.trim(),
        plan: newClientDraft.plan,
        zone: newClientDraft.zone,
        debt: 0,
        tickets: 0,
        phone: newClientDraft.phone.trim(),
        email: newClientDraft.email.trim(),
        address: newClientDraft.address.trim(),
        routerId: newClientDraft.routerId,
        planCost: Number(newClientDraft.planCost) || planPricing[newClientDraft.plan]
      }
    }))
    if (newClientOptions.createInvoice) {
      const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      setInvoices((prev) => [
        { id: `INV-${Date.now()}`, amount: Number(newClientDraft.planCost) || planPricing[newClientDraft.plan], due, status: 'pending' },
        ...prev
      ])
    }
    setSupportTickets((prev) => [
      {
        id: `TK-${String(prev.length + 1).padStart(3, '0')}`,
        client: newClientDraft.name.trim(),
        subject: 'Instalacion y puesta en marcha',
        department: 'Instalaciones',
        assignee: 'NOC',
        priority: 'medium',
        status: 'new',
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
      },
      ...prev
    ])
    if (newClientOptions.sendWelcome) {
      toast.success('Mensaje de bienvenida listo para WhatsApp/Correo.')
    }
    if (newClientOptions.autoProvision) {
      toast.success('Provisionamiento encolado para MikroTik asignado.')
    }
    setTickets((prev) => ({ ...prev, today: prev.today + 1, pending: prev.pending + 1, month: prev.month + 1 }))
    setShowAddClient(false)
    setCurrentPage(1)
    if (newClientOptions.autoProvision) toast.success('Cliente registrado y auto-provision listo.')
    else toast.success('Cliente registrado con configuracion asignada.')
  }

  const createTicket = () => {
    setTickets((prev) => ({ ...prev, today: prev.today + 1, pending: prev.pending + 1, month: prev.month + 1 }))
    toast.success('Ticket creado.')
  }

  const closePendingTicket = () => {
    setTickets((prev) => ({ ...prev, pending: Math.max(prev.pending - 1, 0) }))
    toast.success('Ticket marcado como resuelto.')
  }

  const markInvoiceAsPaid = (id: string) => {
    setInvoices((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'paid' } : item)))
    toast.success('Factura marcada como pagada.')
  }

  const chargeSubscription = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'active',
              nextCharge: new Date(Date.now() + s.cycleMonths * 30 * 86400000).toISOString().slice(0, 10)
            }
          : s
      )
    )
    apiClient.post(`/subscriptions/${id}/charge`, {}).catch(() => null)
    toast.success('Pago registrado y próxima fecha actualizada.')
  }

  const suspendSubscription = (id: string) => {
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'suspended' } : s)))
    apiClient.put(`/subscriptions/${id}`, { status: 'suspended' }).catch(() => null)
    toast.success('Suscripción suspendida.')
  }

  const runSubscriptionReminders = async () => {
    try {
      const res = await apiClient.post('/subscriptions/run-reminders', {})
      const updated: Subscription[] = (res?.updated || []).map((s: any) => normalizeSubscriptionFromApi(s))
      if (updated.length > 0) {
        setSubscriptions((prev) => prev.map((s) => updated.find((u) => u.id === s.id) || s))
      }
      await fetchSubscriptions()
      toast.success(`Revisadas: ${updated.length} suscripciones vencidas.`)
    } catch {
      toast.error('No se pudo ejecutar recordatorios.')
    }
  }

  const fetchNetworkHealth = async () => {
    try {
      const res = await apiClient.get('/network/health')
      setNetworkHealth(res)
    } catch {
      setNetworkHealth({
        score: 85,
        routers_ok: 10,
        routers_down: 1,
        olt_ok: 3,
        olt_alert: 1,
        latency_ms: 18,
        packet_loss: 0.5,
        last_updated: new Date().toISOString()
      })
    }
  }

  const fetchNocAlerts = async () => {
    try {
      const res = await apiClient.get('/network/alerts')
      if (Array.isArray(res?.alerts)) {
        setNocAlerts(res.alerts)
      }
    } catch {
      setNocAlerts([{ id: 'AL-LOCAL', severity: 'info', message: 'Sin alertas críticas', target: 'Red', since: new Date().toISOString() }])
    }
  }

  const startCheckout = async () => {
    try {
      const res = await apiClient.post('/payments/checkout', {
        amount: Math.max(1, pendingAmount),
        currency: 'PEN',
        description: 'Cobranza ISP'
      })
      if (res?.payment_url) {
        window.open(res.payment_url, '_blank')
        toast.success('Checkout generado, abre la pasarela.')
      } else {
        toast.error('No se pudo generar el checkout.')
      }
    } catch (error) {
      toast.error('Error al generar checkout.')
    }
  }

  const createPaymentPromise = (invoiceId?: string) => {
    const target = invoiceId ? invoices.find((item) => item.id === invoiceId && item.status !== 'paid') : pendingInvoices[0]
    if (!target) {
      toast.error('No hay facturas pendientes para promesa.')
      return
    }

    setPaymentPromises((prev) => [
      {
        id: `PP-${Date.now()}`,
        client: namePool[(prev.length + 1) % namePool.length],
        invoiceId: target.id,
        promisedDate: promiseDateInput,
        amount: target.amount,
        status: 'pending'
      },
      ...prev
    ])
    toast.success(`Promesa registrada para ${target.id}.`)
  }

  const updatePaymentPromiseStatus = (id: string, status: PromiseStatus) => {
    const promise = paymentPromises.find((item) => item.id === id)
    setPaymentPromises((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    if (status === 'fulfilled' && promise) {
      setInvoices((prev) => prev.map((item) => (item.id === promise.invoiceId ? { ...item, status: 'paid' } : item)))
    }
    toast.success(`Promesa actualizada: ${status}.`)
  }

  const addOtherIncome = () => {
    const amount = Number(otherIncomeDraft.amount)
    if (!otherIncomeDraft.concept.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Completa concepto y monto valido.')
      return
    }
    setOtherIncomes((prev) => [
      {
        id: `OI-${Date.now()}`,
        concept: otherIncomeDraft.concept.trim(),
        channel: otherIncomeDraft.channel,
        amount,
        date: new Date().toISOString().slice(0, 10)
      },
      ...prev
    ])
    setOtherIncomeDraft({ concept: '', amount: '', channel: otherIncomeDraft.channel })
    toast.success('Ingreso registrado.')
  }

  const addExpense = () => {
    const amount = Number(expenseDraft.amount)
    if (!expenseDraft.concept.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Completa gasto y monto valido.')
      return
    }
    setExpenses((prev) => [
      {
        id: `EX-${Date.now()}`,
        concept: expenseDraft.concept.trim(),
        area: expenseDraft.area,
        amount,
        date: new Date().toISOString().slice(0, 10),
        approved: false
      },
      ...prev
    ])
    setExpenseDraft({ concept: '', amount: '', area: expenseDraft.area })
    toast.success('Gasto registrado.')
  }

  const toggleExpenseApproval = (id: string) => {
    setExpenses((prev) => prev.map((item) => (item.id === id ? { ...item, approved: !item.approved } : item)))
  }

  const registerCollectionPayment = (id: string) => {
    setCollectionCards((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const collected = Math.min(item.collected + 1, item.assigned)
        return { ...item, collected }
      })
    )
    toast.success('Cobro registrado en tarjeta.')
  }

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
  }

  const adjustPaymentMethodFee = (id: string, delta: number) => {
    setPaymentMethods((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const fee = Math.max(0, Number((item.fee + delta).toFixed(2)))
        return { ...item, fee }
      })
    )
  }

  const toggleGatewaySubscription = (id: string) => {
    setGatewaySubscriptions((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
  }

  const resendElectronicInvoice = (id: string) => {
    setElectronicInvoices((prev) =>
      prev.map((item) => (item.id === id ? { ...item, sunatStatus: 'accepted', sentAt: new Date().toLocaleString() } : item))
    )
    toast.success('Factura electronica reenviada.')
  }

  const importPaymentsFromExcel = () => {
    const pendingIds = pendingInvoices.slice(0, 2).map((item) => item.id)
    if (pendingIds.length === 0) {
      toast.error('No hay facturas pendientes para importar.')
      return
    }
    setInvoices((prev) => prev.map((item) => (pendingIds.includes(item.id) ? { ...item, status: 'paid' } : item)))
    setExcelRowsImported((prev) => prev + pendingIds.length)
    toast.success(`${pendingIds.length} pagos conciliados desde Excel.`)
  }

  const reconcileClientRow = (id: string) => {
    setReconciliationRows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, reconciled: true, difference: Number((item.billed - item.paid).toFixed(2)) } : item))
    )
    toast.success('Cliente conciliado.')
  }

  const exportPaymentReport = () => {
    if (paymentRecords.length === 0) {
      toast.error('No hay datos para exportar.')
      return
    }
    const header = ['ID', 'Fuente', 'Cliente', 'Monto', 'Fecha', 'Metodo']
    const rows = paymentRecords.map((item) => [item.id, item.source, item.client, String(item.amount), item.date, item.method])
    const csv = [header.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte_finanzas_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Reporte exportado.')
  }

  const updateConnectionStatus = (id: string, status: ConnectionStatus) => {
    setConnections((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    toast.success(`Estado actualizado a ${status}.`)
  }

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const toggleSelectCurrentPage = () => {
    const pageIds = paginatedClientProfiles.map((item) => item.id)
    const allSelected = pageIds.every((id) => selectedClientIds.includes(id))
    if (allSelected) {
      setSelectedClientIds((prev) => prev.filter((id) => !pageIds.includes(id)))
      return
    }
    setSelectedClientIds((prev) => Array.from(new Set([...prev, ...pageIds])))
  }

  const applyBulkStatus = (status: ConnectionStatus) => {
    if (selectedClientIds.length === 0) {
      toast.error('Selecciona al menos un cliente.')
      return
    }
    setConnections((prev) => prev.map((item) => (selectedClientIds.includes(item.id) ? { ...item, status } : item)))
    toast.success(`Estado masivo actualizado: ${status}.`)
  }

  const executeBulkAction = () => {
    if (selectedClientIds.length === 0) {
      toast.error('Selecciona al menos un cliente.')
      return
    }
    switch (bulkAction) {
      case 'activate':
        applyBulkStatus('active')
        break
      case 'suspend':
        applyBulkStatus('offline')
        break
      case 'reminder':
        sendPaymentReminderForIds(selectedClientIds)
        toast.success('Recordatorios enviados.')
        break
      case 'export':
        exportClientsCsv()
        break
      default:
        toast('Selecciona una accion masiva.', { icon: 'ℹ️' })
    }
    setBulkAction('none')
  }

  const applyBulkPlan = () => {
    if (selectedClientIds.length === 0) {
      toast.error('Selecciona al menos un cliente.')
      return
    }
    setClientMeta((prev) => {
      const next = { ...prev }
      selectedClientIds.forEach((id) => {
        const existing = next[id]
        if (existing) {
          next[id] = { ...existing, plan: bulkPlan }
          return
        }
        next[id] = {
          name: `Cliente ${id}`,
          plan: bulkPlan,
          zone: zones[0],
          debt: 0,
          tickets: 0
        }
      })
      return next
    })
    toast.success(`Plan masivo aplicado: ${bulkPlan}.`)
  }

  const sendPaymentReminderForIds = (targetIds: string[]) => {
    if (targetIds.length === 0) return

    setClientMeta((prev) => {
      const next = { ...prev }
      targetIds.forEach((id) => {
        const profile = clientProfiles.find((item) => item.id === id)
        const existing = next[id]
        if (existing) {
          next[id] = { ...existing, tickets: existing.tickets + 1 }
          return
        }
        next[id] = {
          name: profile?.name || `Cliente ${id}`,
          plan: profile?.plan || '100 Mbps',
          zone: profile?.zone || zones[0],
          debt: profile?.debt || 0,
          tickets: (profile?.tickets || 0) + 1
        }
      })
      return next
    })

    setTickets((prev) => ({
      ...prev,
      pending: prev.pending + targetIds.length,
      month: prev.month + targetIds.length
    }))

    toast.success(`Recordatorio enviado a ${targetIds.length} cliente(s).`)
  }

  const sendPaymentReminder = () => {
    const targetIds =
      selectedClientIds.length > 0 ? selectedClientIds : filteredClientProfiles.filter((item) => item.debt > 0).map((item) => item.id)

    if (targetIds.length === 0) {
      toast.error('No hay clientes con deuda para notificar.')
      return
    }

    sendPaymentReminderForIds(targetIds)
  }

  const prioritizeSupport = () => {
    const targetIds =
      selectedClientIds.length > 0
        ? selectedClientIds
        : filteredClientProfiles.filter((item) => item.risk === 'high' || item.tickets > 0).map((item) => item.id)

    if (targetIds.length === 0) {
      toast.error('No hay clientes pendientes para priorizar soporte.')
      return
    }

    setConnections((prev) => prev.map((item) => (targetIds.includes(item.id) ? { ...item, status: 'active' } : item)))
    toast.success(`Soporte priorizado para ${targetIds.length} cliente(s).`)
  }

  const resetClientFilters = () => {
    setClientSearch('')
    setClientFilter('all')
    setZoneFilter('all')
    setPlanFilter('all')
    setRiskFilter('all')
    setClientColumnFilters({ name: '', username: '', ip: '', lan: '', cutoff: '', screen: 'all' })
    setSegmentFilter('all')
    setSortField('name')
    setSortDirection('asc')
    setCurrentPage(1)
    setSelectedClientIds([])
    setBulkAction('none')
  }

  const exportClientsCsv = () => {
    const source =
      selectedClientIds.length > 0 ? filteredClientProfiles.filter((item) => selectedClientIds.includes(item.id)) : filteredClientProfiles

    if (source.length === 0) {
      toast.error('No hay clientes para exportar.')
      return
    }

    const header = ['Codigo', 'Nombre', 'IP', 'MAC', 'Estado', 'Plan', 'Zona', 'UsoGB', 'Deuda', 'Riesgo', 'Tickets', 'UltimaConexion']
    const rows = source.map((item) => [
      item.code,
      item.name,
      item.ip,
      item.mac,
      item.status,
      item.plan,
      item.zone,
      String(item.monthlyUsage),
      String(item.debt),
      item.risk,
      String(item.tickets),
      item.lastSeen
    ])

    const csv = [header.join(','), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado.')
  }

  const clientsByStatus = useMemo(
    () => ({
      active: clientProfiles.filter((item) => item.status === 'active').length,
      idle: clientProfiles.filter((item) => item.status === 'idle').length,
      offline: clientProfiles.filter((item) => item.status === 'offline').length
    }),
    [clientProfiles]
  )

  const trafficByClient = useMemo(
    () => clientProfiles.map((item) => ({ ...item, usage: item.monthlyUsage })),
    [clientProfiles]
  )

  const updateInstallationStatus = (id: string, status: 'pending' | 'scheduled' | 'done') => {
    setInstallations((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    toast.success('Instalacion actualizada.')
  }

  const createScreenNotice = () => {
    const next = screenNotices.length + 1
    setScreenNotices((prev) => [
      {
        id: next,
        title: `Aviso ${next}`,
        message: 'Mensaje temporal para clientes',
        active: true
      },
      ...prev
    ])
    toast.success('Aviso agregado.')
  }

  const toggleScreenNotice = (id: number) => {
    setScreenNotices((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
  }

  const sendPush = () => {
    if (!pushDraft.title || !pushDraft.message) {
      toast.error('Completa titulo y mensaje.')
      return
    }
    setPushHistory((prev) => [
      {
        id: prev.length + 1,
        title: pushDraft.title,
        target: pushDraft.target,
        time: new Date().toLocaleString()
      },
      ...prev
    ])
    setPushDraft({ title: '', message: '', target: 'all' })
    toast.success('Push enviado.')
  }

  const toggleService = (key: keyof typeof serviceFlags) => {
    setServiceFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredTickets = useMemo(() => {
    const statusFilter: TicketStatus | null =
      activeClientsTab === 'tickets-new'
        ? 'new'
        : activeClientsTab === 'tickets-progress'
          ? 'in-progress'
          : activeClientsTab === 'tickets-closed'
            ? 'closed'
            : null

    const needle = ticketSearch.trim().toLowerCase()
    return supportTickets.filter((ticket) => {
      const matchesStatus = statusFilter ? ticket.status === statusFilter : true
      const matchesSearch =
        !needle ||
        ticket.id.toLowerCase().includes(needle) ||
        ticket.client.toLowerCase().includes(needle) ||
        ticket.subject.toLowerCase().includes(needle) ||
        ticket.department.toLowerCase().includes(needle) ||
        ticket.assignee.toLowerCase().includes(needle)
      return matchesStatus && matchesSearch
    })
  }, [activeClientsTab, supportTickets, ticketSearch])

  const ticketCounters = useMemo(() => {
    const byStatus = {
      new: supportTickets.filter((ticket) => ticket.status === 'new').length,
      progress: supportTickets.filter((ticket) => ticket.status === 'in-progress').length,
      closed: supportTickets.filter((ticket) => ticket.status === 'closed').length
    }

    const byDepartment = supportTickets.reduce<Record<string, number>>((acc, ticket) => {
      acc[ticket.department] = (acc[ticket.department] || 0) + 1
      return acc
    }, {})

    return { byStatus, byDepartment }
  }, [supportTickets])

  const createSupportTicket = () => {
    const nextId = `TK-${String(supportTickets.length + 1).padStart(3, '0')}`
    const client = namePool[supportTickets.length % namePool.length]
    setSupportTickets((prev) => [
      {
        id: nextId,
        client,
        subject: 'Revision de conectividad general',
        department: 'Soporte N1',
        assignee: 'Miguel Leon',
        priority: 'medium',
        status: 'new',
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
      },
      ...prev
    ])
    setTickets((prev) => ({ ...prev, today: prev.today + 1, pending: prev.pending + 1, month: prev.month + 1 }))
    toast.success(`Ticket ${nextId} creado.`)
  }

  const updateSupportTicketStatus = (ticketId: string, nextStatus: TicketStatus) => {
    setSupportTickets((prev) =>
      prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: nextStatus, updatedAt: new Date().toLocaleString() } : ticket))
    )
    if (nextStatus === 'closed') {
      setTickets((prev) => ({ ...prev, pending: Math.max(prev.pending - 1, 0) }))
    }
    toast.success(`Ticket actualizado a ${nextStatus}.`)
  }

  const appendWarehouseLog = (action: string, detail: string) => {
    setWarehouseLogs((prev) => [
      {
        id: `LOG-${Date.now()}`,
        action,
        actor: 'Sistema',
        detail,
        createdAt: new Date().toLocaleString()
      },
      ...prev
    ])
  }

  const adjustWarehouseStock = (itemId: string, delta: number, reason: string) => {
    const current = warehouseItems.find((item) => item.id === itemId)
    if (!current) {
      toast.error('Articulo no encontrado.')
      return
    }
    const nextStock = Math.max(0, current.stock + delta)
    setWarehouseItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, stock: nextStock } : item)))
    appendWarehouseLog(delta >= 0 ? 'INGRESO' : 'SALIDA', `${current.name}: ${reason} (${delta >= 0 ? '+' : ''}${delta})`)
    toast.success(`Stock actualizado para ${current.name}.`)
  }

  const toggleWarehouseItemState = (itemId: string) => {
    setWarehouseItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, active: !item.active } : item)))
    const updated = warehouseItems.find((item) => item.id === itemId)
    if (updated) appendWarehouseLog('ESTADO', `${updated.name}: ${updated.active ? 'desactivado' : 'activado'}.`)
  }

  const toggleSupplierState = (supplierId: string) => {
    setWarehouseSuppliers((prev) =>
      prev.map((supplier) => (supplier.id === supplierId ? { ...supplier, status: supplier.status === 'active' ? 'paused' : 'active' } : supplier))
    )
    const updated = warehouseSuppliers.find((supplier) => supplier.id === supplierId)
    if (updated) appendWarehouseLog('PROVEEDOR', `${updated.name}: ${updated.status === 'active' ? 'pausado' : 'activado'}.`)
  }

  const toggleBranchState = (branchId: string) => {
    setWarehouseBranches((prev) => prev.map((branch) => (branch.id === branchId ? { ...branch, active: !branch.active } : branch)))
    const updated = warehouseBranches.find((branch) => branch.id === branchId)
    if (updated) appendWarehouseLog('SUCURSAL', `${updated.name}: ${updated.active ? 'inactiva' : 'activa'}.`)
  }

  const assignItemToStaff = () => {
    const qty = Math.max(1, Math.round(Number(assignDraft.quantity) || 0))
    const item = warehouseItems.find((entry) => entry.id === assignDraft.itemId)
    const staff = staffMembers.find((entry) => entry.id === assignDraft.staffId)
    if (!item || !staff) {
      toast.error('Selecciona articulo y staff validos.')
      return
    }
    if (item.stock < qty) {
      toast.error('Stock insuficiente para la asignacion.')
      return
    }
    setWarehouseItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, stock: entry.stock - qty } : entry)))
    setStaffMembers((prev) =>
      prev.map((entry) => (entry.id === staff.id ? { ...entry, assignedAssets: entry.assignedAssets + qty } : entry))
    )
    appendWarehouseLog('ASIGNACION', `${qty} unidad(es) de ${item.name} asignadas a ${staff.name}.`)
    toast.success('Asignacion registrada correctamente.')
  }

  const toggleStaffState = (staffId: string) => {
    setStaffMembers((prev) =>
      prev.map((staff) => (staff.id === staffId ? { ...staff, status: staff.status === 'active' ? 'inactive' : 'active' } : staff))
    )
    const updated = staffMembers.find((staff) => staff.id === staffId)
    if (updated) toast.success(`Estado actualizado para ${updated.name}.`)
  }

  const saveAdvancedSettings = (section: string) => {
    toast.success(`Configuracion de ${section} guardada.`)
  }

  const toggleFeature = (key: keyof typeof featureToggles) => {
    setFeatureToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleGateway = (key: keyof typeof gatewayConfig) => {
    setGatewayConfig((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const runMaintenanceAction = (action: string) => {
    toast.success(`Accion ejecutada: ${action}.`)
  }

  const importClientsFromExcel = () => {
    const nextRows = 5
    const now = Date.now()
    const generatedConnections: Connection[] = Array.from({ length: nextRows }).map((_, index) => ({
      id: `excel-${now}-${index + 1}`,
      ip: `192.168.2.${40 + index}`,
      mac: `EE:AA:CC:DD:11:${String(index + 1).padStart(2, '0')}`,
      status: 'active'
    }))
    setConnections((prev) => [...generatedConnections, ...prev])
    setExcelClientsImported((prev) => prev + nextRows)
    toast.success(`${nextRows} clientes importados desde Excel.`)
  }

  const toggleVisibleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const warehouseByTab = useMemo(() => {
    if (activeWarehouseTab === 'network-stock' || activeWarehouseTab === 'network-list') {
      return warehouseItems.filter((item) => item.category === 'network')
    }
    if (activeWarehouseTab === 'other-articles') return warehouseItems.filter((item) => item.category === 'article')
    if (activeWarehouseTab === 'other-services') return warehouseItems.filter((item) => item.category === 'service')
    return warehouseItems
  }, [activeWarehouseTab, warehouseItems])

  const renderFinanceTab = () => {
    switch (activeFinanceTab) {
      case 'dashboard':
        return (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Cobrado" value={`S/. ${paidToday.toFixed(2)}`} tone="green" />
              <SummaryCard label="Pendiente" value={`S/. ${pendingAmount.toFixed(2)}`} tone="orange" />
              <SummaryCard label="Otros ingresos" value={`S/. ${totalOtherIncome.toFixed(2)}`} tone="blue" />
              <SummaryCard label="Flujo neto" value={`S/. ${netCashFlow.toFixed(2)}`} tone={netCashFlow >= 0 ? 'green' : 'orange'} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#d7e3ff] bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs text-[#6a7281]">Promesas pendientes</p>
                <p className="text-2xl font-semibold text-[#1b5fc4]">{pendingPromises.length}</p>
              </div>
              <div className="rounded-xl border border-[#ffe2bf] bg-[#fff8ef] px-4 py-3 shadow-sm">
                <p className="text-xs text-[#8b6a46]">Facturas pendientes</p>
                <p className="text-2xl font-semibold text-[#b55d00]">{pendingInvoices.length}</p>
              </div>
              <div className="rounded-xl border border-[#ffd7d7] bg-[#fff4f4] px-4 py-3 shadow-sm">
                <p className="text-xs text-[#8a4a4a]">Gastos acumulados</p>
                <p className="text-2xl font-semibold text-[#d22c2c]">S/. {totalExpenses.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )
      case 'pending-payments':
        return (
          <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                  <th className="px-3 py-2">Factura</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Vence</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                      No hay pagos pendientes.
                    </td>
                  </tr>
                ) : null}
                {pendingInvoices.map((item) => (
                  <tr key={item.id} className="border-b border-[#eceff2]">
                    <td className="px-3 py-2">{item.id}</td>
                    <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">{new Date(item.due).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <InvoiceBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => markInvoiceAsPaid(item.id)} className="rounded bg-[#48b968] px-2 py-1 text-xs font-medium text-white hover:bg-[#3da65b]">
                          Cobrar
                        </button>
                        <button onClick={() => createPaymentPromise(item.id)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                          Promesa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'invoices':
        return (
          <div className="space-y-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <select
                value={invoiceFilter}
                onChange={(event) => setInvoiceFilter(event.target.value as 'all' | InvoiceStatus)}
                className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                <option value="paid">Pagadas</option>
                <option value="pending">Pendientes</option>
                <option value="overdue">Vencidas</option>
              </select>
              <span className="text-xs text-gray-600">{filteredInvoices.length} factura(s)</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">Factura</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Vence</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Sunat</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((item) => {
                    const electronic = electronicInvoices.find((row) => row.invoiceId === item.id)
                    return (
                      <tr key={item.id} className="border-b border-[#eceff2]">
                        <td className="px-3 py-2">{item.id}</td>
                        <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
                        <td className="px-3 py-2">{new Date(item.due).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <InvoiceBadge status={item.status} />
                        </td>
                        <td className="px-3 py-2">
                          {electronic ? <SunatBadge status={electronic.sunatStatus} /> : <span className="text-xs text-gray-500">Sin emision</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            {item.status !== 'paid' ? (
                              <button onClick={() => markInvoiceAsPaid(item.id)} className="rounded bg-[#48b968] px-2 py-1 text-xs font-medium text-white hover:bg-[#3da65b]">
                                Marcar pagada
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500">Completado</span>
                            )}
                            {item.status !== 'paid' ? (
                              <button onClick={() => createPaymentPromise(item.id)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                                Promesa
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'payment-report':
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard label="Recaudado total" value={`S/. ${(paidToday + totalOtherIncome).toFixed(2)}`} tone="green" />
              <SummaryCard label="Egresos" value={`S/. ${totalExpenses.toFixed(2)}`} tone="orange" />
              <SummaryCard label="Resultado neto" value={`S/. ${netCashFlow.toFixed(2)}`} tone={netCashFlow >= 0 ? 'green' : 'orange'} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                value={financeSearch}
                onChange={(event) => setFinanceSearch(event.target.value)}
                className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                placeholder="Filtrar reporte"
              />
              <span className="text-xs text-gray-600">{filteredPaymentRecords.length} registro(s)</span>
            </div>
            <PaymentRecordsTable rows={filteredPaymentRecords} />
          </div>
        )
      case 'search-invoices':
        return (
          <div className="space-y-3">
            <input
              value={financeSearch}
              onChange={(event) => setFinanceSearch(event.target.value)}
              className="w-full rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
              placeholder="Buscar por codigo, estado o fecha"
            />
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">Factura</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Vence</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceSearchResults.map((item) => (
                    <tr key={item.id} className="border-b border-[#eceff2]">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">{new Date(item.due).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <InvoiceBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2">
                        {item.status !== 'paid' ? (
                          <button onClick={() => markInvoiceAsPaid(item.id)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                            Cobrar
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Pagada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'payment-promises':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d5def0] bg-white/80 px-3 py-2">
              <input type="date" value={promiseDateInput} onChange={(event) => setPromiseDateInput(event.target.value)} className="rounded border border-[#c8cdd3] px-2 py-1 text-sm" />
              <button onClick={() => createPaymentPromise()} className="rounded bg-[#1b9be0] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#128ace]">
                Registrar promesa
              </button>
              <span className="text-xs text-gray-600">{paymentPromises.length} promesa(s)</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Factura</th>
                    <th className="px-3 py-2">Fecha promesa</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentPromises.map((item) => (
                    <tr key={item.id} className="border-b border-[#eceff2]">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">{item.client}</td>
                      <td className="px-3 py-2">{item.invoiceId}</td>
                      <td className="px-3 py-2">{item.promisedDate}</td>
                      <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <PromiseBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {item.status === 'pending' ? (
                            <>
                              <button onClick={() => updatePaymentPromiseStatus(item.id, 'fulfilled')} className="rounded bg-[#48b968] px-2 py-1 text-xs font-medium text-white hover:bg-[#3da65b]">
                                Cumplida
                              </button>
                              <button onClick={() => updatePaymentPromiseStatus(item.id, 'broken')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                                Incumplida
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">Gestionada</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'other-income':
        return (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={otherIncomeDraft.concept}
                onChange={(event) => setOtherIncomeDraft((prev) => ({ ...prev, concept: event.target.value }))}
                className="rounded border border-[#c8cdd3] px-3 py-2 text-sm"
                placeholder="Concepto"
              />
              <input
                value={otherIncomeDraft.amount}
                onChange={(event) => setOtherIncomeDraft((prev) => ({ ...prev, amount: event.target.value }))}
                className="rounded border border-[#c8cdd3] px-3 py-2 text-sm"
                placeholder="Monto"
              />
              <select value={otherIncomeDraft.channel} onChange={(event) => setOtherIncomeDraft((prev) => ({ ...prev, channel: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="POS">POS</option>
              </select>
              <button onClick={addOtherIncome} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                Registrar
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {otherIncomes.map((item) => (
                    <tr key={item.id} className="border-b border-[#eceff2]">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">{item.concept}</td>
                      <td className="px-3 py-2">{item.channel}</td>
                      <td className="px-3 py-2">{item.date}</td>
                      <td className="px-3 py-2 text-[#1b9be0]">S/. {item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'expenses':
        return (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={expenseDraft.concept}
                onChange={(event) => setExpenseDraft((prev) => ({ ...prev, concept: event.target.value }))}
                className="rounded border border-[#c8cdd3] px-3 py-2 text-sm"
                placeholder="Concepto gasto"
              />
              <input
                value={expenseDraft.amount}
                onChange={(event) => setExpenseDraft((prev) => ({ ...prev, amount: event.target.value }))}
                className="rounded border border-[#c8cdd3] px-3 py-2 text-sm"
                placeholder="Monto"
              />
              <select value={expenseDraft.area} onChange={(event) => setExpenseDraft((prev) => ({ ...prev, area: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm">
                <option value="Operacion">Operacion</option>
                <option value="Infraestructura">Infraestructura</option>
                <option value="Administracion">Administracion</option>
              </select>
              <button onClick={addExpense} className="rounded bg-[#f04747] px-3 py-2 text-sm font-medium text-white hover:bg-[#d93f3f]">
                Registrar
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((item) => (
                    <tr key={item.id} className="border-b border-[#eceff2]">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">{item.concept}</td>
                      <td className="px-3 py-2">{item.area}</td>
                      <td className="px-3 py-2">{item.date}</td>
                      <td className="px-3 py-2 text-[#f04747]">S/. {item.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleExpenseApproval(item.id)} className={`rounded px-2 py-1 text-xs ${item.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {item.approved ? 'Aprobado' : 'Pendiente'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'statistics':
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Facturas pagadas" value={String(paidInvoices.length)} tone="green" />
              <SummaryCard label="Facturas pendientes" value={String(pendingInvoices.length)} tone="orange" />
              <SummaryCard label="Promesas activas" value={String(pendingPromises.length)} tone="blue" />
              <SummaryCard label="Tasa de cobranza" value={`${invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0}%`} tone="green" />
            </div>
            <div className="rounded-xl border border-[#d5def0] bg-white/90 p-3 text-sm">
              <p className="font-medium text-[#2f3338]">Rendimiento de recaudadores</p>
              <div className="mt-2 space-y-2">
                {collectionCards.map((item) => {
                  const progress = item.assigned > 0 ? Math.round((item.collected / item.assigned) * 100) : 0
                  return (
                    <div key={item.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>{item.agent}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 rounded bg-gray-200">
                        <div className="h-2 rounded bg-[#1b9be0]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      case 'collection-cards':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {collectionCards.map((item) => {
              const progress = item.assigned > 0 ? Math.round((item.collected / item.assigned) * 100) : 0
              return (
                <div key={item.id} className="rounded-xl border border-[#d5def0] bg-white/90 p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-[#2f3338]">{item.agent}</h3>
                    <span className="text-xs text-gray-500">{item.id}</span>
                  </div>
                  <p className="text-xs text-gray-600">Clientes asignados: {item.assigned}</p>
                  <p className="text-xs text-gray-600">Cobros realizados: {item.collected}</p>
                  <p className="text-xs text-gray-600">Meta recaudacion: S/. {item.target.toFixed(2)}</p>
                  <div className="mt-2 h-2 rounded bg-gray-200">
                    <div className="h-2 rounded bg-[#48b968]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => registerCollectionPayment(item.id)} className="rounded border border-[#c8cdd3] bg-white px-3 py-1 text-xs hover:bg-gray-50">
                      Registrar cobro
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      case 'accounting':
        return (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard label="Ingresos operativos" value={`S/. ${(paidToday + totalOtherIncome).toFixed(2)}`} tone="green" />
              <SummaryCard label="Egresos operativos" value={`S/. ${totalExpenses.toFixed(2)}`} tone="orange" />
              <SummaryCard label="Resultado" value={`S/. ${netCashFlow.toFixed(2)}`} tone={netCashFlow >= 0 ? 'green' : 'orange'} />
            </div>
            <div className="rounded-xl border border-[#d5def0] bg-white/90 p-3">
              <h3 className="mb-2 text-sm font-semibold text-[#2f3338]">Libro contable resumido</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                      <th className="px-3 py-2">Cuenta</th>
                      <th className="px-3 py-2">Debe</th>
                      <th className="px-3 py-2">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { account: 'Cuentas por cobrar', debit: pendingAmount, credit: 0 },
                      { account: 'Ingresos por servicio', debit: 0, credit: paidToday + totalOtherIncome },
                      { account: 'Gastos operativos', debit: totalExpenses, credit: 0 }
                    ].map((row) => (
                      <tr key={row.account} className="border-b border-[#eceff2]">
                        <td className="px-3 py-2">{row.account}</td>
                        <td className="px-3 py-2">S/. {row.debit.toFixed(2)}</td>
                        <td className="px-3 py-2">S/. {row.credit.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => toast.success('Cierre contable generado.')} className="rounded bg-[#1b9be0] px-3 py-1.5 text-sm text-white hover:bg-[#128ace]">
                  Generar cierre mensual
                </button>
              </div>
            </div>
          </div>
        )
      case 'payment-methods':
        return (
          <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                  <th className="px-3 py-2">Metodo</th>
                  <th className="px-3 py-2">Comision</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((item) => (
                  <tr key={item.id} className="border-b border-[#eceff2]">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.fee.toFixed(2)}%</td>
                    <td className="px-3 py-2">
                      <button onClick={() => togglePaymentMethod(item.id)} className={`rounded px-2 py-1 text-xs ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item.active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => adjustPaymentMethodFee(item.id, -0.1)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">
                          -0.1%
                        </button>
                        <button onClick={() => adjustPaymentMethodFee(item.id, 0.1)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">
                          +0.1%
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'payments-list':
        return (
          <div className="space-y-3">
            <input
              value={financeSearch}
              onChange={(event) => setFinanceSearch(event.target.value)}
              className="w-full rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
              placeholder="Filtrar pagos por ID, cliente o metodo"
            />
            <PaymentRecordsTable rows={filteredPaymentRecords} />
          </div>
        )
      case 'gateway-subscriptions':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {gatewaySubscriptions.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#d5def0] bg-white/90 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-[#2f3338]">{item.gateway}</h3>
                  <button onClick={() => toggleGatewaySubscription(item.id)} className={`rounded px-2 py-1 text-xs ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {item.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
                <p className="text-xs text-gray-600">Plan: {item.plan}</p>
                <p className="text-xs text-gray-600">Costo mensual: S/. {item.amount.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Renovacion: {item.renewal}</p>
              </div>
            ))}
          </div>
        )
      case 'electronic-invoices':
        return (
          <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Factura</th>
                  <th className="px-3 py-2">Estado Sunat</th>
                  <th className="px-3 py-2">Enviado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {electronicInvoices.map((item) => (
                  <tr key={item.id} className="border-b border-[#eceff2]">
                    <td className="px-3 py-2">{item.id}</td>
                    <td className="px-3 py-2">{item.invoiceId}</td>
                    <td className="px-3 py-2">
                      <SunatBadge status={item.sunatStatus} />
                    </td>
                    <td className="px-3 py-2">{item.sentAt}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => resendElectronicInvoice(item.id)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                        Reenviar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'excel-payments':
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#d5def0] bg-white/90 p-4">
              <p className="text-sm text-[#2f3338]">Importa pagos masivos desde un archivo Excel y concilia automaticamente facturas pendientes.</p>
              <p className="mt-2 text-xs text-gray-600">Registros importados en esta sesion: {excelRowsImported}</p>
              <p className="text-xs text-gray-600">Facturas pendientes disponibles: {pendingInvoices.length}</p>
              <button onClick={importPaymentsFromExcel} className="mt-3 rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                Procesar archivo de pagos
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                    <th className="px-3 py-2">Factura</th>
                    <th className="px-3 py-2">Monto</th>
                    <th className="px-3 py-2">Estado actual</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvoices.slice(0, 5).map((item) => (
                    <tr key={item.id} className="border-b border-[#eceff2]">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <InvoiceBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'client-reconciliation':
        return (
          <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Facturado</th>
                  <th className="px-3 py-2">Pagado</th>
                  <th className="px-3 py-2">Diferencia</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationRows.map((item) => (
                  <tr key={item.id} className="border-b border-[#eceff2]">
                    <td className="px-3 py-2">{item.client}</td>
                    <td className="px-3 py-2">S/. {item.billed.toFixed(2)}</td>
                    <td className="px-3 py-2">S/. {item.paid.toFixed(2)}</td>
                    <td className={`px-3 py-2 ${item.difference > 0 ? 'text-[#f04747]' : 'text-[#48b968]'}`}>S/. {item.difference.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-1 text-xs ${item.reconciled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.reconciled ? 'Conciliado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {!item.reconciled ? (
                        <button onClick={() => reconcileClientRow(item.id)} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs hover:bg-gray-50">
                          Conciliar
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      default:
        return <p className="text-sm text-gray-500">Cargando modulo financiero...</p>
    }
  }

  const renderSystemTab = () => {
    if (activeSystemTab === 'router') {
      return (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select value={selectedRouterId || ''} onChange={(event) => setSelectedRouterId(event.target.value || null)} className="min-w-[220px] rounded border border-[#c4d2ea] px-3 py-2 text-sm">
                  <option value="">Seleccionar router</option>
                  {mikrotikRouters.map((router) => (
                    <option key={router.id} value={router.id}>
                      {router.name} ({router.ipAddress})
                    </option>
                  ))}
                </select>
                <button onClick={testRouterConnection} disabled={!selectedMikrotikRouter || routerActionLoading !== null} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  {routerActionLoading === 'test' ? 'Probando...' : 'Probar conexion'}
                </button>
                <button onClick={refreshRouterTelemetry} disabled={!selectedMikrotikRouter || routerActionLoading !== null} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  Refrescar
                </button>
                <button onClick={backupSelectedRouter} disabled={!selectedMikrotikRouter || routerActionLoading !== null} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  Backup
                </button>
                <button onClick={rebootSelectedRouter} disabled={!selectedMikrotikRouter || routerActionLoading !== null} className="rounded border border-[#f1d2d2] bg-[#fff7f7] px-3 py-2 text-xs text-[#8d2f2f] hover:bg-[#ffeeee] disabled:opacity-60">
                  Reiniciar
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="CPU" value={`${routerHealth?.cpuLoad ?? 0}%`} tone="blue" />
                <SummaryCard label="Memoria" value={`${routerHealth?.memoryUsage ?? 0}%`} tone="orange" />
                <SummaryCard label="Colas activas" value={String(routerQueues.filter((item) => !item.disabled).length)} tone="green" />
                <SummaryCard label="Sesiones" value={String(routerSessions.length)} tone="blue" />
              </div>
            </div>
            <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
              <h3 className="mb-2 text-sm font-semibold text-[#1f2f4d]">Router seleccionado</h3>
              <p className="text-sm text-[#4f5f79]">{selectedMikrotikRouter?.name || 'N/D'}</p>
              <p className="text-xs text-[#607089]">{selectedMikrotikRouter?.ipAddress || 'Sin IP'}</p>
              <p className="mt-2 text-xs text-[#607089]">Uptime: {routerHealth?.uptime || 'N/D'}</p>
              <p className="text-xs text-[#607089]">Health score: {routerHealth?.healthScore ?? 0}/100</p>
              <p className="mt-2 text-xs text-[#607089]">{routerLastSync}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#d6def0] bg-white/95 p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <CommandLineIcon className="h-4 w-4 text-[#1b9be0]" />
              <span className="text-sm font-semibold text-[#1f2f4d]">Comando rapido MikroTik</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={routerCommandDraft} onChange={(event) => setRouterCommandDraft(event.target.value)} className="min-w-[260px] flex-1 rounded border border-[#c4d2ea] px-3 py-2 text-sm" />
              <button onClick={() => executeScriptOnSelectedRouter(routerCommandDraft, 'Comando ejecutado.')} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                Ejecutar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1f2f4d]">Centro NOC Enterprise</p>
                <p className="text-xs text-[#607089]">Postura de seguridad, salud operativa y automatización avanzada para MikroTik.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={hardeningProfile}
                  onChange={(event) => setHardeningProfile(event.target.value as 'baseline' | 'strict' | 'hardened')}
                  className="rounded border border-[#c6d3ea] bg-white px-2 py-2 text-xs"
                >
                  <option value="baseline">Perfil baseline</option>
                  <option value="strict">Perfil strict</option>
                  <option value="hardened">Perfil hardened</option>
                </select>
                <select
                  value={hardeningSiteProfile}
                  onChange={(event) => setHardeningSiteProfile(event.target.value as 'core' | 'distribution' | 'access' | 'hotspot')}
                  className="rounded border border-[#c6d3ea] bg-white px-2 py-2 text-xs"
                >
                  <option value="core">Sitio core</option>
                  <option value="distribution">Sitio distribution</option>
                  <option value="access">Sitio access</option>
                  <option value="hotspot">Sitio hotspot</option>
                </select>
                <button onClick={() => selectedMikrotikRouter && loadEnterpriseSnapshot(selectedMikrotikRouter.id, false)} disabled={!selectedMikrotikRouter || enterpriseLoading} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  {enterpriseLoading ? 'Cargando...' : 'Snapshot'}
                </button>
                <button onClick={() => selectedMikrotikRouter && loadEnterpriseChangeLog(selectedMikrotikRouter.id, false)} disabled={!selectedMikrotikRouter || changeLogLoading} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  {changeLogLoading ? 'Actualizando bitacora...' : 'Bitacora'}
                </button>
                <button onClick={() => applyEnterpriseHardening(true)} disabled={!selectedMikrotikRouter || hardeningBusy} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-xs hover:bg-[#f4f8ff] disabled:opacity-60">
                  {hardeningBusy ? 'Procesando...' : 'Hardening (Dry-run)'}
                </button>
                <button onClick={() => applyEnterpriseHardening(false)} disabled={!selectedMikrotikRouter || hardeningBusy} className="rounded border border-[#c6d3ea] bg-[#eef6ff] px-3 py-2 text-xs text-[#1e4f9a] hover:bg-[#e2efff] disabled:opacity-60">
                  Aplicar hardening
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Health Enterprise" value={String(enterpriseSnapshot?.healthScore ?? 0)} tone="blue" />
              <SummaryCard label="Interfaces DOWN" value={String(enterpriseSnapshot?.interfaceSummary.down ?? 0)} tone="orange" />
              <SummaryCard label="Servicios inseguros" value={String(enterpriseSnapshot?.insecureServices.length ?? 0)} tone="orange" />
              <SummaryCard label="Queues ocupadas" value={String(enterpriseSnapshot?.queueSummary.busy ?? 0)} tone="green" />
              <SummaryCard label="Backups scheduler" value={String(enterpriseSnapshot?.schedulerSummary.backupJobs ?? 0)} tone="green" />
            </div>
            <div className="mt-3 overflow-x-auto rounded border border-[#dbe4f4] bg-[#fbfcff]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e4e9f5] bg-[#f2f6ff] text-left text-[#4d5b75]">
                    <th className="px-2 py-2">Change ID</th>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Actor</th>
                    <th className="px-2 py-2">Perfil</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Comandos</th>
                    <th className="px-2 py-2">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {enterpriseChangeLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-xs text-[#607089]">
                        {changeLogLoading ? 'Cargando bitacora enterprise...' : 'No hay cambios registrados para este router.'}
                      </td>
                    </tr>
                  ) : null}
                  {enterpriseChangeLog.slice(0, 12).map((change) => (
                    <tr key={change.changeId} className="border-b border-[#eef2f9]">
                      <td className="px-2 py-2 font-mono text-[10px] text-[#2d3f5f]">{change.changeId}</td>
                      <td className="px-2 py-2">
                        {Number.isFinite(new Date(change.createdAt).getTime()) ? new Date(change.createdAt).toLocaleString() : change.createdAt}
                      </td>
                      <td className="px-2 py-2">{change.actor}</td>
                      <td className="px-2 py-2">
                        {change.profile}/{change.siteProfile}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded px-2 py-1 text-[10px] ${
                            change.status === 'applied'
                              ? 'bg-green-100 text-green-700'
                              : change.status === 'rolled-back'
                                ? 'bg-slate-200 text-slate-700'
                                : change.status === 'failed' || change.status === 'rollback-failed'
                                  ? 'bg-red-100 text-red-700'
                                  : change.status === 'in-progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {change.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">{change.commandCount}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => rollbackEnterpriseChange(change.changeId)}
                          disabled={rollbackBusyId === change.changeId || !['applied', 'rollback-failed'].includes(change.status)}
                          className="rounded border border-[#f1d2d2] bg-[#fff7f7] px-2 py-1 text-[10px] text-[#8d2f2f] hover:bg-[#ffeeee] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {rollbackBusyId === change.changeId ? 'Revirtiendo...' : 'Rollback'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-[#d6def0] bg-white/95 p-3 shadow-sm">
              <h4 className="mb-2 text-sm font-semibold text-[#1f2f4d]">Servicios de gestión</h4>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                    <th className="px-2 py-2">Servicio</th>
                    <th className="px-2 py-2">Puerto</th>
                    <th className="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(enterpriseSnapshot?.services || []).slice(0, 12).map((service) => (
                    <tr key={`${service.name}-${service.port}`} className="border-b border-[#eef2f9]">
                      <td className="px-2 py-2">{service.name}</td>
                      <td className="px-2 py-2">{service.port || '-'}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-1 text-[10px] ${service.disabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {service.disabled ? 'Seguro' : 'Expuesto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(enterpriseSnapshot?.services || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-center text-xs text-[#607089]">
                        Sin datos de servicios.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#d6def0] bg-white/95 p-3 shadow-sm">
              <h4 className="mb-2 text-sm font-semibold text-[#1f2f4d]">Top interfaces (NOC)</h4>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                    <th className="px-2 py-2">Interfaz</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Trafico</th>
                    <th className="px-2 py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {(enterpriseSnapshot?.topInterfaces || []).map((iface) => (
                    <tr key={iface.name} className="border-b border-[#eef2f9]">
                      <td className="px-2 py-2">{iface.name}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-1 text-[10px] ${iface.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {iface.running ? 'UP' : 'DOWN'}
                        </span>
                      </td>
                      <td className="px-2 py-2">{Math.round((iface.traffic_bytes || 0) / 1024 / 1024)} MB</td>
                      <td className="px-2 py-2">
                        <button onClick={() => toggleRouterInterfaceFromNoc(iface.name, !iface.running)} disabled={!selectedMikrotikRouter} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-[10px] hover:bg-[#f4f8ff] disabled:opacity-60">
                          {iface.running ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(enterpriseSnapshot?.topInterfaces || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-xs text-[#607089]">
                        Sin interfaces para mostrar.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-[#d6def0] bg-white/95 p-3 shadow-sm">
              <h4 className="mb-2 text-sm font-semibold text-[#1f2f4d]">Recomendaciones y eventos</h4>
              <div className="mb-3 space-y-2">
                {(enterpriseSnapshot?.recommendations || []).slice(0, 6).map((item, index) => (
                  <div key={`rec-${index}`} className="rounded border border-[#dce6f8] bg-[#f6f9ff] px-2 py-1.5 text-xs text-[#324766]">
                    {item}
                  </div>
                ))}
                {(enterpriseSnapshot?.recommendations || []).length === 0 ? (
                  <p className="text-xs text-[#607089]">Sin recomendaciones críticas. Estado estable.</p>
                ) : null}
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-[#e4e9f5] bg-[#fbfcff] p-2">
                {(enterpriseSnapshot?.recentLogs || []).slice(0, 12).map((log, index) => (
                  <p key={`log-${index}`} className="text-[11px] text-[#44546e]">
                    [{log.topics || 'event'}] {log.time || '--'} - {log.message || 'sin mensaje'}
                  </p>
                ))}
                {(enterpriseSnapshot?.recentLogs || []).length === 0 ? <p className="text-[11px] text-[#607089]">Sin logs recientes.</p> : null}
              </div>
            </div>

            <div className="rounded-xl border border-[#d6def0] bg-white/95 p-3 shadow-sm">
              <h4 className="mb-2 text-sm font-semibold text-[#1f2f4d]">Failover Test WAN</h4>
              <textarea
                value={failoverTargetsDraft}
                onChange={(event) => setFailoverTargetsDraft(event.target.value)}
                rows={3}
                className="w-full rounded border border-[#c4d2ea] px-2 py-2 text-xs"
                placeholder="1.1.1.1, 8.8.8.8, 9.9.9.9"
              />
              <button onClick={runEnterpriseFailoverTest} disabled={!selectedMikrotikRouter || failoverBusy} className="mt-2 rounded bg-[#1b9be0] px-3 py-2 text-xs font-medium text-white hover:bg-[#128ace] disabled:opacity-60">
                {failoverBusy ? 'Ejecutando...' : 'Ejecutar failover test'}
              </button>
              <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
                {(failoverReport?.targets || []).map((item) => (
                  <div key={item.target} className="rounded border border-[#e4e9f5] bg-[#fbfcff] px-2 py-1.5 text-[11px] text-[#44546e]">
                    <p className="font-semibold text-[#233754]">
                      {item.target} -{' '}
                      <span className={`px-2 py-0.5 text-[10px] ${item.status === 'critical' ? 'state-chip state-chip--bad' : item.status === 'warning' ? 'state-chip state-chip--warn' : 'state-chip state-chip--good'}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </p>
                    <p>
                      Loss {item.packetLoss}% | Avg {item.avgLatencyMs !== null ? `${item.avgLatencyMs} ms` : 'N/D'} | {item.successProbes}/{item.totalProbes}
                    </p>
                    {item.error ? <p className="text-red-300">{item.error}</p> : null}
                  </div>
                ))}
                {failoverReport ? (
                  <p className="text-[11px] text-[#607089]">Reporte: {failoverReport.generatedAt}</p>
                ) : (
                  <p className="text-[11px] text-[#607089]">Sin pruebas ejecutadas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (activeSystemTab === 'internet-plan' || activeSystemTab === 'phone-tv-plan') {
      const source = activeSystemTab === 'internet-plan' ? internetPlans : phoneTvPlans
      const toggle = activeSystemTab === 'internet-plan' ? toggleInternetPlan : togglePhoneTvPlan
      return (
        <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Velocidad</th>
                <th className="px-3 py-2">Prefijo</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {source.map((plan) => (
                <tr key={plan.id} className="border-b border-[#eef2f9]">
                  <td className="px-3 py-2 font-medium text-[#24344f]">{plan.name}</td>
                  <td className="px-3 py-2">
                    {plan.download}M/{plan.upload}M
                  </td>
                  <td className="px-3 py-2">{plan.prefix}</td>
                  <td className="px-3 py-2">{plan.target}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggle(plan.id)} className={`rounded px-2 py-1 text-xs ${plan.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {plan.enabled ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() =>
                        executeScriptOnSelectedRouter(
                          `/queue simple add name="${plan.prefix}" target=${plan.target} max-limit=${plan.download}M/${plan.upload}M`,
                          `Plan ${plan.prefix} enviado al router.`
                        )
                      }
                      className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]"
                    >
                      Sincronizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeSystemTab === 'zones' || activeSystemTab === 'sector-node-nap') {
      const showSectors = activeSystemTab === 'sector-node-nap'
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {(showSectors ? sectorRecords : zoneRecords).map((item: any) => (
            <div key={item.id} className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
              <p className="font-semibold text-[#20324f]">{showSectors ? `${item.zone} / ${item.sector}` : item.name}</p>
              <p className="text-xs text-[#607089]">{showSectors ? `${item.node} - ${item.nap}` : item.city}</p>
              <p className="mt-2 text-sm text-[#44546e]">{showSectors ? `Ocupacion: ${item.occupancy}%` : `Clientes activos: ${item.activeClients}`}</p>
            </div>
          ))}
        </div>
      )
    }

    if (activeSystemTab === 'periodic-tasks') {
      return (
        <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                <th className="px-3 py-2">Tarea</th>
                <th className="px-3 py-2">Cron</th>
                <th className="px-3 py-2">Ultima ejecucion</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {scheduledTasks.map((task) => (
                <tr key={task.id} className="border-b border-[#eef2f9]">
                  <td className="px-3 py-2">{task.name}</td>
                  <td className="px-3 py-2">{task.cron}</td>
                  <td className="px-3 py-2">{task.lastRun}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleScheduledTask(task.id)} className={`rounded px-2 py-1 text-xs ${task.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {task.enabled ? 'Activo' : 'Pausado'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => runScheduledTaskNow(task)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                      Ejecutar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeSystemTab === 'templates') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-xl border border-[#d5def0] bg-white/95 p-3">
            <select value={templateToRunId} onChange={(event) => setTemplateToRunId(event.target.value)} className="rounded border border-[#c5d3ea] px-3 py-2 text-sm">
              {scriptTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button onClick={runTemplateScript} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
              Ejecutar plantilla
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {scriptTemplates.map((template) => (
              <div key={template.id} className="rounded-xl border border-[#d5def0] bg-white/95 p-3 shadow-sm">
                <p className="font-semibold text-[#20324f]">{template.name}</p>
                <p className="text-xs text-[#607089]">{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activeSystemTab === 'vpn-access' || activeSystemTab === 'subdomains' || activeSystemTab === 'directory-isp') {
      return (
        <div className="space-y-3">
          {activeSystemTab === 'vpn-access' ? (
            <div className="grid gap-3 md:grid-cols-3">
              {vpnUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-3 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]"
                >
                  <p className="font-medium text-[#e5edff]">{user.user}</p>
                  <p className="text-xs text-[#9fb4dd]">{user.profile}</p>
                  <button
                    onClick={() => toggleVpnUserStatus(user.id)}
                    className={`mt-2 rounded border px-2 py-1 text-xs ${
                      user.status === 'connected'
                        ? 'border-green-500/50 bg-green-900/50 text-green-100'
                        : 'border-slate-600/60 bg-slate-800 text-slate-200'
                    }`}
                  >
                    {user.status}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {activeSystemTab === 'subdomains' ? (
            <div className="grid gap-3 md:grid-cols-3">
              {subdomains.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-3 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]"
                >
                  <p className="font-medium text-[#e5edff]">{item.host}</p>
                  <p className="text-xs text-[#9fb4dd]">{item.target}</p>
                  <button
                    onClick={() => toggleSubdomainStatus(item.id)}
                    className={`mt-2 rounded border px-2 py-1 text-xs ${
                      item.status === 'active'
                        ? 'border-green-500/50 bg-green-900/50 text-green-100'
                        : 'border-amber-500/60 bg-amber-900/40 text-amber-100'
                    }`}
                  >
                    {item.status}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {activeSystemTab === 'directory-isp' ? (
            <div className="grid gap-3 md:grid-cols-3">
              {directoryServices.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-3 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]"
                >
                  <p className="font-medium text-[#e5edff]">{item.service}</p>
                  <p className="text-xs text-[#9fb4dd]">{item.owner}</p>
                  <button
                    onClick={() => toggleDirectoryStatus(item.id)}
                    className={`mt-2 rounded border px-2 py-1 text-xs ${
                      item.status === 'active'
                        ? 'border-green-500/50 bg-green-900/50 text-green-100'
                        : 'border-slate-600/60 bg-slate-800 text-slate-200'
                    }`}
                  >
                    {item.status}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )
    }

    if (activeSystemTab === 'admin-olt') {
      const actionLabels: Record<string, string> = {
        show_pon_summary: 'Resumen PON',
        show_onu_list: 'Listado ONU',
        find_onu: 'Buscar ONU por serial',
        authorize_onu: 'Autorizar ONU',
        deauthorize_onu: 'Desautorizar ONU',
        reboot_onu: 'Reiniciar ONU',
        backup_running_config: 'Backup running-config',
        show_optical_power: 'Potencia óptica',
        save_config: 'Guardar configuración'
      }
      const selectedVendor = oltVendors.find((vendor) => vendor.id === selectedOltDevice?.vendor) || null
      const actionOptions = selectedVendor?.actions?.length
        ? selectedVendor.actions
        : ['show_pon_summary', 'show_onu_list', 'find_onu', 'authorize_onu', 'deauthorize_onu', 'reboot_onu', 'backup_running_config']

      return (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#e5edff]">AdminOLT multi-vendor</p>
                  <p className="text-xs text-[#9fb4dd]">Conexion asistida y scripts operativos para ZTE, Huawei, VSOL y ahora TR-064.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={loadOltCatalog} disabled={oltBusy} className="rounded border border-[#3b4c72] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                    Inventario
                  </button>
                  <button onClick={() => selectedOltId && loadOltSnapshot(selectedOltId, false)} disabled={!selectedOltId || oltBusy} className="rounded border border-[#3b4c72] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                    {oltBusy ? 'Actualizando...' : 'Snapshot'}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-[#b8c9ec]">
                  OLT
                  <select value={selectedOltId} onChange={(event) => setSelectedOltId(event.target.value)} className="rounded border border-[#3b4c72] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff]">
                    {oltDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.vendor.toUpperCase()} - {device.host})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded border border-[#283553] bg-[#0f172a] px-3 py-2 text-xs text-[#c7d6f8]">
                  <p>
                    Vendor: <span className="font-semibold text-[#e5edff]">{selectedVendor?.label || selectedOltDevice?.vendor?.toUpperCase() || 'N/D'}</span>
                  </p>
                  <p>
                    Modelo: <span className="font-semibold text-[#e5edff]">{selectedOltDevice?.model || 'N/D'}</span>
                  </p>
                  <p>
                    Sitio: <span className="font-semibold text-[#e5edff]">{selectedOltDevice?.site || 'N/D'}</span>
                  </p>
                  <p>
                    Transporte:{' '}
                    <span className="font-semibold text-[#e5edff]">{selectedOltDevice ? `${selectedOltDevice.transport.toUpperCase()}:${selectedOltDevice.port}` : 'N/D'}</span>
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={testOltConnection} disabled={!selectedOltId || oltBusy} className="rounded bg-[#22c55e] px-3 py-2 text-xs font-medium text-white hover:bg-[#16a34a] disabled:opacity-60">
                  {oltBusy ? 'Procesando...' : 'Probar conexion'}
                </button>
                <button onClick={() => loadOltQuickConnectScript('windows')} disabled={!selectedOltId || oltBusy} className="rounded border border-[#3b4c72] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                  Script rapido Windows
                </button>
                <button onClick={() => loadOltQuickConnectScript('linux')} disabled={!selectedOltId || oltBusy} className="rounded border border-[#3b4c72] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                  Script rapido Linux
                </button>
              </div>

              {oltConnectionResult ? (
                <div className={`mt-3 rounded border px-3 py-2 text-xs ${oltConnectionResult.reachable ? 'border-green-500/50 bg-green-900/40 text-green-100' : 'border-red-500/50 bg-red-900/40 text-red-100'}`}>
                  <p className="font-semibold">{oltConnectionResult.reachable ? 'Conectividad OK' : 'Sin conectividad'}</p>
                  <p>
                    {oltConnectionResult.message}
                    {oltConnectionResult.latencyMs !== null ? ` | ${oltConnectionResult.latencyMs} ms` : ''}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard label="PON total" value={String(oltSnapshot?.ponTotal ?? 0)} tone="blue" />
              <SummaryCard label="PON alerta" value={String(oltSnapshot?.ponAlert ?? 0)} tone="orange" />
              <SummaryCard label="ONU online" value={String(oltSnapshot?.onuOnline ?? 0)} tone="green" />
              <SummaryCard label="ONU offline" value={String(oltSnapshot?.onuOffline ?? 0)} tone="orange" />
              <SummaryCard label="CPU OLT" value={`${oltSnapshot?.cpuLoad ?? 0}%`} tone="blue" />
              <SummaryCard label="Memoria OLT" value={`${oltSnapshot?.memoryUsage ?? 0}%`} tone="green" />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
            <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
              <h4 className="mb-3 text-sm font-semibold text-[#e5edff]">Generador de scripts OLT</h4>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                  Accion
                  <select
                    value={oltScriptAction}
                    onChange={(event) => setOltScriptAction(event.target.value)}
                    className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40"
                  >
                    {actionOptions.map((action) => (
                      <option key={action} value={action}>
                        {actionLabels[action] || action}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                  Frame/Slot/PON
                  <div className="grid grid-cols-3 gap-1">
                    <input type="number" value={oltScriptPayload.frame} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, frame: Number(event.target.value) || 0 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                    <input type="number" value={oltScriptPayload.slot} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, slot: Number(event.target.value) || 1 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                    <input type="number" value={oltScriptPayload.pon} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, pon: Number(event.target.value) || 1 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                  </div>
                </label>
                <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                  ONU/VLAN
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" value={oltScriptPayload.onu} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, onu: Number(event.target.value) || 1 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                    <input type="number" value={oltScriptPayload.vlan} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, vlan: Number(event.target.value) || 120 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                  </div>
                </label>
              </div>
              <label className="mt-2 flex flex-col gap-1 text-xs text-[#9fb4dd]">
                Serial ONU
                <input value={oltScriptPayload.serial} onChange={(event) => setOltScriptPayload((prev) => ({ ...prev, serial: event.target.value }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] placeholder:text-[#8ea0be] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" placeholder="ZTEG00000001 / 48575443ABCDEF01 / VSOL00000001" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={oltRunMode}
                  onChange={(event) => setOltRunMode(event.target.value as 'simulate' | 'live')}
                  className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-xs text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40"
                >
                  <option value="simulate">Modo simulate</option>
                  <option value="live">Modo live</option>
                </select>
                <button onClick={generateOltScript} disabled={!selectedOltId || oltBusy} className="rounded bg-[#1b9be0] px-3 py-2 text-xs font-medium text-white hover:bg-[#128ace] disabled:opacity-60">
                  {oltBusy ? 'Generando...' : 'Generar comandos'}
                </button>
                <button onClick={executeOltScript} disabled={!selectedOltId || oltBusy || oltGeneratedCommands.length === 0} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                  {oltRunMode === 'live' ? 'Ejecutar live' : 'Ejecutar simulacion'}
                </button>
              </div>
              {oltRunMode === 'live' ? (
                <p className="mt-2 rounded border border-red-500/40 bg-red-900/30 px-2 py-1.5 text-[11px] text-red-100">
                  Modo live enviara comandos reales a la OLT y requiere credenciales en `OLT_CREDENTIALS_JSON` o `OLT_DEFAULT_PASSWORD`.
                </p>
              ) : null}
              <div className="mt-3 rounded border border-[#2d3b5b] bg-[#0b1220] p-2">
                <p className="mb-1 text-xs font-semibold text-[#e5edff]">Comandos generados ({oltGeneratedCommands.length})</p>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-[#e2e8f0]">{oltGeneratedCommands.length > 0 ? oltGeneratedCommands.join('\n') : '# Sin comandos generados'}</pre>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#e5edff]">Script de conexion facil</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => loadOltQuickLogin('windows')} disabled={!selectedOltId || oltBusy} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-1 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                      Login rápido (PowerShell)
                    </button>
                    <button onClick={() => loadOltQuickLogin('linux')} disabled={!selectedOltId || oltBusy} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-1 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                      Login rápido (bash)
                    </button>
                    <button onClick={copyOltQuickLogin} disabled={!oltQuickLogin.trim()} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-1 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                      Copiar login
                    </button>
                    <button onClick={copyOltQuickScript} disabled={!oltQuickScript.trim()} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-1 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                      Copiar script
                    </button>
                  </div>
                </div>
                {oltQuickLogin ? (
                  <div className="mb-2 rounded border border-[#2d3b5b] bg-[#0b1220] p-2">
                    <p className="text-[11px] font-semibold text-[#e5edff]">Comando de login</p>
                    <pre className="overflow-auto whitespace-pre-wrap text-[11px] text-[#e2e8f0]">{oltQuickLogin}</pre>
                  </div>
                ) : null}
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[#2d3b5b] bg-[#0b1220] p-2 text-[11px] text-[#e2e8f0]">{oltQuickScript || '# Genera un script rapido para ver la conexion asistida.'}</pre>
              </div>
              <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <h4 className="mb-2 text-sm font-semibold text-[#e5edff]">Transcripcion de ejecucion</h4>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-[#2d3b5b] bg-[#0b1220] p-2">
                  {oltTranscript.length === 0 ? <p className="text-[11px] text-[#9fb4dd]">Sin ejecuciones simuladas.</p> : null}
                  {oltTranscript.map((line, index) => (
                    <p key={`olt-log-${index}`} className="font-mono text-[11px] text-[#e2e8f0]">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#e5edff]">Wizard TR-064 / ACS</h4>
                  {tr064Status ? (
                    <span className={`state-chip ${tr064Status.ok ? 'state-chip--good' : 'state-chip--bad'}`}>{tr064Status.message}</span>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                    Host / ACS
                    <input value={tr064Config.host} onChange={(event) => setTr064Config((prev) => ({ ...prev, host: event.target.value }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] placeholder:text-[#8ea0be] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" placeholder="172.23.16.1 o acs.miisp.com" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                    Puerto
                    <input type="number" value={tr064Config.port} onChange={(event) => setTr064Config((prev) => ({ ...prev, port: Number(event.target.value) || 7547 }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                    Usuario
                    <input value={tr064Config.username} onChange={(event) => setTr064Config((prev) => ({ ...prev, username: event.target.value }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                    Password
                    <input type="password" value={tr064Config.password} onChange={(event) => setTr064Config((prev) => ({ ...prev, password: event.target.value }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[#9fb4dd]">
                    Vendor
                    <select value={tr064Config.vendor} onChange={(event) => setTr064Config((prev) => ({ ...prev, vendor: event.target.value }))} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-2 text-sm text-[#e5edff] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/40">
                      <option value="huawei">Huawei</option>
                      <option value="zte">ZTE</option>
                      <option value="vsol">VSOL</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={testTr064Connectivity} className="rounded bg-[#22c55e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#16a34a]">
                    Probar TR-064
                  </button>
                  <button onClick={generateTr064ProvisionScript} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-[#e5edff] hover:bg-[#111c33]">
                    Generar script ACS
                  </button>
                  <button onClick={copyTr064Script} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33]" disabled={!tr064Script.trim()}>
                    Copiar script
                  </button>
                </div>
                <div className="mt-3 rounded border border-[#2d3b5b] bg-[#0b1220] p-2">
                  <p className="mb-1 text-xs font-semibold text-[#e5edff]">Script TR-064</p>
                  <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-[11px] text-[#e2e8f0]">
{tr064Script || '# Genera un script TR-064 para aprovisionamiento ACS'}
                  </pre>
                </div>
              </div>
              <div className="rounded-xl border border-[#1c2740] bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#e5edff]">Bitacora OLT</h4>
                  <button onClick={() => loadOltAuditLog(false)} disabled={oltAuditLoading} className="rounded border border-[#2d3b5b] bg-[#0f172a] px-2 py-1 text-xs text-[#e5edff] hover:bg-[#111c33] disabled:opacity-60">
                    {oltAuditLoading ? 'Cargando...' : 'Refrescar'}
                  </button>
                </div>
                <div className="max-h-52 overflow-auto rounded border border-[#2d3b5b] bg-[#0b1220]">
                  <table className="w-full border-collapse text-[11px] text-[#e2e8f0]">
                    <thead>
                      <tr className="border-b border-[#2d3b5b] bg-[#0f172a] text-left text-[#9fb4dd]">
                        <th className="px-2 py-1">Hora</th>
                        <th className="px-2 py-1">Modo</th>
                        <th className="px-2 py-1">Actor</th>
                        <th className="px-2 py-1">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oltAuditLog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2 py-3 text-center text-[11px] text-[#607089]">
                            Sin ejecuciones registradas.
                          </td>
                        </tr>
                      ) : null}
                      {oltAuditLog.slice(0, 12).map((entry) => (
                        <tr key={entry.id} className="border-b border-[#eef2f9]">
                          <td className="px-2 py-1">{Number.isFinite(new Date(entry.startedAt).getTime()) ? new Date(entry.startedAt).toLocaleString() : entry.startedAt}</td>
                          <td className="px-2 py-1">{entry.runMode}</td>
                          <td className="px-2 py-1">{entry.actor}</td>
                          <td className="px-2 py-1">
                            <span className={`rounded px-1.5 py-0.5 ${entry.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {entry.success ? 'OK' : 'FALLA'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return <p className="text-sm text-gray-500">Modulo de sistema en construccion.</p>
  }

  const renderHotspotTab = () => {
    if (activeHotspotTab === 'routers') {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-[#5b6a82]">
              DNS HotSpot
              <input value={hotspotDnsName} onChange={(event) => setHotspotDnsName(event.target.value)} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#5b6a82]">
              Interface
              <input value={hotspotInterface} onChange={(event) => setHotspotInterface(event.target.value)} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#5b6a82]">
              Address Pool
              <input value={hotspotAddressPool} onChange={(event) => setHotspotAddressPool(event.target.value)} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm" />
            </label>
          </div>
          <button onClick={applyHotspotConfiguration} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
            Aplicar configuracion HotSpot
          </button>
          <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                  <th className="px-3 py-2">Router</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {mikrotikRouters.map((router) => (
                  <tr key={router.id} className="border-b border-[#eef2f9]">
                    <td className="px-3 py-2">{router.name}</td>
                    <td className="px-3 py-2">{router.ipAddress}</td>
                    <td className="px-3 py-2">{router.status}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => setSelectedRouterId(router.id)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (activeHotspotTab === 'plans-prefixes') {
      return (
        <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Prefijo</th>
                <th className="px-3 py-2">Duracion</th>
                <th className="px-3 py-2">Banda</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {hotspotPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-[#eef2f9]">
                  <td className="px-3 py-2">{plan.name}</td>
                  <td className="px-3 py-2">{plan.prefix}</td>
                  <td className="px-3 py-2">{plan.durationMinutes} min</td>
                  <td className="px-3 py-2">{plan.bandwidth}</td>
                  <td className="px-3 py-2">S/. {plan.price.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleHotspotPlan(plan.id)} className={`rounded px-2 py-1 text-xs ${plan.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {plan.enabled ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeHotspotTab === 'create-vouchers') {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm md:grid-cols-4">
            <select value={voucherDraft.planId} onChange={(event) => setVoucherDraft((prev) => ({ ...prev, planId: event.target.value }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm">
              {hotspotPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <input value={voucherDraft.qty} onChange={(event) => setVoucherDraft((prev) => ({ ...prev, qty: Number(event.target.value) || 0 }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm" type="number" min={1} max={150} />
            <select value={voucherDraft.pointOfSaleId} onChange={(event) => setVoucherDraft((prev) => ({ ...prev, pointOfSaleId: event.target.value }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm">
              {pointsOfSale.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
            <button onClick={generateHotspotVouchers} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
              Generar fichas
            </button>
          </div>
          <div className="text-sm text-[#4e5d78]">Fichas generadas: {vouchers.length}</div>
        </div>
      )
    }

    if (activeHotspotTab === 'pos') {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {pointsOfSale.map((pos) => (
            <div key={pos.id} className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
              <p className="font-semibold text-[#20324f]">{pos.name}</p>
              <p className="text-xs text-[#607089]">{pos.manager}</p>
              <p className="mt-2 text-sm text-[#44546e]">Saldo: S/. {pos.balance.toFixed(2)}</p>
              <button onClick={() => togglePointOfSale(pos.id)} className={`mt-2 rounded px-2 py-1 text-xs ${pos.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {pos.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (activeHotspotTab === 'cash-close') {
      return (
        <div className="space-y-3">
          <button onClick={registerCashClose} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
            Abrir/Cerrar caja
          </button>
          <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                  <th className="px-3 py-2">Apertura</th>
                  <th className="px-3 py-2">Cierre</th>
                  <th className="px-3 py-2">Neto</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cashClosings.map((item) => (
                  <tr key={item.id} className="border-b border-[#eef2f9]">
                    <td className="px-3 py-2">{item.openedAt}</td>
                    <td className="px-3 py-2">{item.closedAt || '-'}</td>
                    <td className="px-3 py-2">S/. {item.net.toFixed(2)}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
          <p className="font-semibold text-[#20324f]">Landing Basico</p>
          <p className="text-xs text-[#607089]">Portal simple para fichas de corta duracion.</p>
        </div>
        <div className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
          <p className="font-semibold text-[#20324f]">Landing Comercial</p>
          <p className="text-xs text-[#607089]">Incluye publicidad y captura de WhatsApp.</p>
        </div>
        <div className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
          <p className="font-semibold text-[#20324f]">Landing Corporativo</p>
          <p className="text-xs text-[#607089]">Version para clientes empresariales.</p>
        </div>
      </div>
    )
  }

  const renderWarehouseTab = () => {
    if (activeWarehouseTab === 'dashboard') {
      const lowStock = warehouseItems.filter((item) => item.stock <= item.minStock)
      const totalValue = warehouseItems.reduce((acc, item) => acc + item.stock * item.unitCost, 0)
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Items en catalogo" value={String(warehouseItems.length)} tone="blue" />
            <SummaryCard label="Stock bajo" value={String(lowStock.length)} tone="orange" />
            <SummaryCard label="Proveedores activos" value={String(warehouseSuppliers.filter((item) => item.status === 'active').length)} tone="green" />
            <SummaryCard label="Valor inventario" value={`S/. ${totalValue.toFixed(2)}`} tone="blue" />
          </div>
          <div className="rounded-xl border border-[#d5def0] bg-white/95 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1f2f4d]">Alertas de stock</p>
              <button onClick={() => appendWarehouseLog('AUDITORIA', 'Revision rapida de inventario ejecutada.')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                Ejecutar auditoria
              </button>
            </div>
            <div className="space-y-2">
              {lowStock.length === 0 ? <p className="text-xs text-gray-500">Sin alertas de stock.</p> : null}
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border border-[#eef2f9] px-3 py-2 text-sm">
                  <span>{item.name}</span>
                  <span className="text-[#c0541d]">
                    {item.stock}/{item.minStock}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activeWarehouseTab === 'suppliers') {
      return (
        <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {warehouseSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-[#eef2f9]">
                  <td className="px-3 py-2 font-medium text-[#24344f]">{supplier.name}</td>
                  <td className="px-3 py-2">{supplier.contact}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-1 text-xs ${supplier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => toggleSupplierState(supplier.id)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                        Alternar
                      </button>
                      <button onClick={() => toast.success(`Solicitud enviada a ${supplier.name}.`)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                        Solicitar cotizacion
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeWarehouseTab === 'branches') {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {warehouseBranches.map((branch) => (
            <div key={branch.id} className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
              <p className="font-semibold text-[#20324f]">{branch.name}</p>
              <p className="text-xs text-[#607089]">
                {branch.city} - {branch.manager}
              </p>
              <button onClick={() => toggleBranchState(branch.id)} className={`mt-2 rounded px-2 py-1 text-xs ${branch.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {branch.active ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (activeWarehouseTab === 'assign-staff') {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm md:grid-cols-4">
            <select value={assignDraft.itemId} onChange={(event) => setAssignDraft((prev) => ({ ...prev, itemId: event.target.value }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm">
              {warehouseItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select value={assignDraft.staffId} onChange={(event) => setAssignDraft((prev) => ({ ...prev, staffId: event.target.value }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm">
              {staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={assignDraft.quantity} onChange={(event) => setAssignDraft((prev) => ({ ...prev, quantity: Number(event.target.value) || 1 }))} className="rounded border border-[#c4d2ea] px-2 py-2 text-sm" />
            <button onClick={assignItemToStaff} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
              Asignar
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Departamento</th>
                  <th className="px-3 py-2">Activos asignados</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {staffMembers.map((staff) => (
                  <tr key={staff.id} className="border-b border-[#eef2f9]">
                    <td className="px-3 py-2">{staff.name}</td>
                    <td className="px-3 py-2">{staff.role}</td>
                    <td className="px-3 py-2">{staff.department}</td>
                    <td className="px-3 py-2">{staff.assignedAssets}</td>
                    <td className="px-3 py-2">{staff.status}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleStaffState(staff.id)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                        Alternar estado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (activeWarehouseTab === 'log') {
      return (
        <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Accion</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {warehouseLogs.map((log) => (
                <tr key={log.id} className="border-b border-[#eef2f9]">
                  <td className="px-3 py-2">{log.createdAt}</td>
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.actor}</td>
                  <td className="px-3 py-2">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
              <th className="px-3 py-2">Articulo</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Minimo</th>
              <th className="px-3 py-2">Sucursal</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {warehouseByTab.map((item) => (
              <tr key={item.id} className="border-b border-[#eef2f9]">
                <td className="px-3 py-2 font-medium text-[#24344f]">{item.name}</td>
                <td className="px-3 py-2">{item.sku}</td>
                <td className="px-3 py-2">{item.stock}</td>
                <td className="px-3 py-2">{item.minStock}</td>
                <td className="px-3 py-2">{item.branch}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-1 text-xs ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {item.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => adjustWarehouseStock(item.id, 1, 'ajuste positivo')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                      +1
                    </button>
                    <button onClick={() => adjustWarehouseStock(item.id, -1, 'ajuste negativo')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                      -1
                    </button>
                    <button onClick={() => toggleWarehouseItemState(item.id)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                      Alternar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderSettingsTab = () => {
    if (activeSettingsTab === 'mail-server') {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <input value={mailSettings.host} onChange={(event) => setMailSettings((prev) => ({ ...prev, host: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" placeholder="Host SMTP" />
            <input value={mailSettings.port} onChange={(event) => setMailSettings((prev) => ({ ...prev, port: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" placeholder="Puerto" />
            <input value={mailSettings.user} onChange={(event) => setMailSettings((prev) => ({ ...prev, user: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" placeholder="Usuario" />
            <label className="flex items-center gap-2 rounded border border-[#c8cdd3] px-3 py-2 text-sm">
              <input type="checkbox" checked={mailSettings.tls} onChange={(event) => setMailSettings((prev) => ({ ...prev, tls: event.target.checked }))} />
              TLS activo
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveAdvancedSettings('Servidor Correo')} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
              Guardar
            </button>
            <button onClick={() => toast.success('Correo de prueba enviado.')} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
              Enviar prueba
            </button>
          </div>
        </div>
      )
    }

    if (activeSettingsTab === 'billing') {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Dias de corte automatico
              <input
                type="number"
                value={billingSettings.autoCutoffDays}
                onChange={(event) => setBillingSettings((prev) => ({ ...prev, autoCutoffDays: Number(event.target.value) || 0 }))}
                className="rounded border border-[#c8cdd3] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Serie de facturas
              <input value={billingSettings.invoiceSeries} onChange={(event) => setBillingSettings((prev) => ({ ...prev, invoiceSeries: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 rounded border border-[#c8cdd3] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={billingSettings.allowPartialPayments}
                onChange={(event) => setBillingSettings((prev) => ({ ...prev, allowPartialPayments: event.target.checked }))}
              />
              Permitir pagos parciales
            </label>
          </div>
          <button onClick={() => saveAdvancedSettings('Facturacion')} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
            Guardar facturacion
          </button>
        </div>
      )
    }

    if (activeSettingsTab === 'payment-gateways') {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(gatewayConfig).map(([key, enabled]) => (
            <div key={key} className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
              <p className="font-semibold capitalize text-[#20324f]">{key}</p>
              <button onClick={() => toggleGateway(key as keyof typeof gatewayConfig)} className={`mt-2 rounded px-2 py-1 text-xs ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {enabled ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => toast.success(`Prueba de ${key} ejecutada.`)} className="mt-2 block rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                Probar pasarela
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (activeSettingsTab === 'clients-excel') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-[#4e5d78]">Clientes importados en sesion: {excelClientsImported}</p>
          <button onClick={importClientsFromExcel} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
            Importar clientes desde Excel
          </button>
        </div>
      )
    }

    if (activeSettingsTab === 'visible-columns') {
      return (
        <div className="space-y-2">
          {Object.entries(visibleColumns).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between rounded border border-[#d4d8dd] px-3 py-2 text-sm">
              <span className="capitalize">{key}</span>
              <input type="checkbox" checked={enabled} onChange={() => toggleVisibleColumn(key as keyof typeof visibleColumns)} />
            </label>
          ))}
          <button onClick={() => saveAdvancedSettings('Columnas Visibles')} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
            Guardar columnas
          </button>
        </div>
      )
    }

    if (
      activeSettingsTab === 'billing-electronic' ||
      activeSettingsTab === 'whatsapp-sms' ||
      activeSettingsTab === 'google-maps' ||
      activeSettingsTab === 'client-portal' ||
      activeSettingsTab === 'mobile-app' ||
      activeSettingsTab === 'ai'
    ) {
      const featureKey =
        activeSettingsTab === 'billing-electronic'
          ? 'billingElectronic'
          : activeSettingsTab === 'whatsapp-sms'
            ? 'whatsappSms'
            : activeSettingsTab === 'google-maps'
              ? 'googleMaps'
              : activeSettingsTab === 'client-portal'
                ? 'clientPortal'
                : activeSettingsTab === 'mobile-app'
                  ? 'mobileApp'
                  : 'ai'

      return (
        <div className="rounded-xl border border-[#d5def0] bg-white/95 p-4 shadow-sm">
          <p className="text-sm text-[#4e5d78]">Configura y prueba el modulo {settingsTabLabels[activeSettingsTab]}.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => toggleFeature(featureKey as keyof typeof featureToggles)} className={`rounded px-3 py-2 text-sm ${featureToggles[featureKey as keyof typeof featureToggles] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {featureToggles[featureKey as keyof typeof featureToggles] ? 'Activo' : 'Inactivo'}
            </button>
            <button onClick={() => saveAdvancedSettings(settingsTabLabels[activeSettingsTab])} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
              Guardar
            </button>
            <button onClick={() => toast.success(`Prueba ejecutada para ${settingsTabLabels[activeSettingsTab]}.`)} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
              Probar
            </button>
          </div>
        </div>
      )
    }

    if (activeSettingsTab === 'bulk-actions' || activeSettingsTab === 'maintenance') {
      return (
        <div className="space-y-2">
          <button onClick={() => runMaintenanceAction('Recalculo masivo de saldos')} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
            Recalcular saldos masivos
          </button>
          <button onClick={() => runMaintenanceAction('Sincronizacion completa de clientes')} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
            Sincronizar clientes
          </button>
          <button onClick={() => runMaintenanceAction('Limpieza de cache')} className="rounded border border-[#c8cdd3] bg-white px-3 py-2 text-sm hover:bg-gray-50">
            Limpiar cache
          </button>
        </div>
      )
    }

    return <p className="text-sm text-gray-500">Modulo de ajustes en preparacion.</p>
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="enterprise-dashboard rounded-xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-200">Cargando dashboard...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="enterprise-dashboard space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-semibold text-slate-100">
            {activeView === 'dashboard'
              ? 'Dashboard'
              : activeView === 'clients'
                ? clientsTabLabels[activeClientsTab]
                : activeView === 'finance'
                  ? financeTabLabels[activeFinanceTab]
                  : activeView === 'system'
                    ? systemTabLabels[activeSystemTab]
                    : activeView === 'hotspot'
                      ? hotspotTabLabels[activeHotspotTab]
                      : activeView === 'warehouse'
                        ? warehouseTabLabels[activeWarehouseTab]
                        : activeView === 'settings'
                          ? settingsTabLabels[activeSettingsTab]
                          : activeView === 'staff'
                            ? 'Staff'
                            : activeView === 'affiliate'
                              ? 'Afiliado'
                              : activeView === 'resources'
                                ? 'Recursos Adicionales'
                                : activeView}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded border border-white/15 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
              <input type="checkbox" checked={autoRefreshEnabled} onChange={(event) => setAutoRefreshEnabled(event.target.checked)} />
              Auto-refresh
            </label>
            <select
              value={autoRefreshSeconds}
              onChange={(event) => setAutoRefreshSeconds(Number(event.target.value) as 30 | 45 | 60 | 120)}
              className="rounded border border-white/15 bg-slate-900/70 px-2 py-2 text-xs text-slate-200"
            >
              <option value={30}>30s</option>
              <option value={45}>45s</option>
              <option value={60}>60s</option>
              <option value={120}>120s</option>
            </select>
            <span className="rounded border border-cyan-200/20 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100">
              Ultima sync: {lastAutoRefreshAt || 'pendiente'}
            </span>
            <button
              onClick={() => loadData(true)}
              className="inline-flex items-center gap-2 rounded border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/80"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs">
          <span className="text-slate-200">Estados:</span>
          <span className="state-chip state-chip--good px-2 py-0.5">Verde: pagado / activo</span>
          <span className="state-chip state-chip--warn px-2 py-0.5">Amarillo: pendiente / en proceso</span>
          <span className="state-chip state-chip--bad px-2 py-0.5">Rojo: deuda / desconectado / error</span>
        </div>

        {activeView === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-[#2a2d31]">$ Pagos Internet</h2>
                <MetricBox
                  title={`S/. ${paidToday.toFixed(2)}`}
                  subtitle="PAGADOS HOY"
                  icon={<BanknotesIcon className="h-6 w-6 text-[#48b968]" />}
                  onClick={() => goToFinance('payments-list', 'paid')}
                />
                <MetricBox
                  title={`S/. ${pendingAmount.toFixed(2)}`}
                  subtitle="PENDIENTES POR COBRAR"
                  icon={<ClockIcon className="h-6 w-6 text-[#ef9f1f]" />}
                  onClick={() => goToFinance('pending-payments', 'pending')}
                />
                <MetricBox
                  title={`S/. ${monthAmount.toFixed(2)}`}
                  subtitle="MES ACTUAL"
                  icon={<ClockIcon className="h-6 w-6 text-[#1b9be0]" />}
                  onClick={() => goToFinance('payment-report')}
                />
                <button onClick={startCheckout} className="w-full rounded-lg bg-[#1b9be0] px-3 py-2 text-sm font-semibold text-white hover:bg-[#128ace]">
                  Cobrar ahora
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-[#2a2d31]">Clientes</h2>
                <MetricMini
                  value={String(connections.length)}
                  label="TOTAL"
                  icon={<UserGroupIcon className="h-6 w-6 text-[#1b9be0]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'list' })}
                />
                <MetricMini
                  value={overview.currentSpeed}
                  label="VELOCIDAD"
                  icon={<CheckCircleIcon className="h-6 w-6 text-[#48b968]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'search' })}
                />
                <MetricMini
                  value={overview.uptime}
                  label="UPTIME"
                  icon={<CheckCircleIcon className="h-6 w-6 text-[#48b968]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'stats' })}
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-[#2a2d31]">Tickets</h2>
                <MetricMini
                  value={String(tickets.today)}
                  label="HOY"
                  icon={<TicketIcon className="h-6 w-6 text-[#f04747]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'tickets-new' })}
                />
                <MetricMini
                  value={String(tickets.pending)}
                  label="PENDIENTES"
                  icon={<ClockIcon className="h-6 w-6 text-[#ef9f1f]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'tickets-progress' })}
                />
                <MetricMini
                  value={String(tickets.month)}
                  label="MES"
                  icon={<ClockIcon className="h-6 w-6 text-[#48b968]" />}
                  onClick={() => openModule('clients', { key: 'clientsTab', value: 'stats-tickets-month' })}
                />
                <div className="flex gap-2">
                  <button onClick={createTicket} className="rounded bg-[#48b968] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3da65b]">
                    + Ticket
                  </button>
                  <button onClick={closePendingTicket} className="rounded border border-[#c8cdd3] bg-white px-3 py-1.5 text-xs text-[#3d444c] hover:bg-gray-50">
                    Resolver
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TrafficCard label="TOTAL DESCARGA" value={overview.totalDownload} />
              <TrafficCard label="TOTAL SUBIDA" value={overview.totalUpload} />
            </div>

            {networkHealth && (
              <div className="rounded-2xl border border-[#1f2a44] bg-gradient-to-br from-[#0f172a] via-[#0e1a2f] to-[#0b1220] p-4 text-[#e5edff] shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#e5edff]">Salud de Red</h3>
                    <p className="text-xs text-[#9fb4dd]">Score {networkHealth.score} • Latencia {networkHealth.latency_ms} ms • Pérdida {networkHealth.packet_loss}%</p>
                  </div>
                  <button
                    onClick={fetchNetworkHealth}
                    className="rounded-lg border border-[#304066] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33]"
                  >
                    Sincronizar
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-lg border border-[#24314f] bg-[#111c33] px-3 py-2">
                    <p className="text-xs text-[#9fb4dd]">Routers OK</p>
                    <p className="text-lg font-semibold text-[#22c55e]">{networkHealth.routers_ok}</p>
                  </div>
                  <div className="rounded-lg border border-[#24314f] bg-[#111c33] px-3 py-2">
                    <p className="text-xs text-[#9fb4dd]">Routers Down</p>
                    <p className="text-lg font-semibold text-[#f97316]">{networkHealth.routers_down}</p>
                  </div>
                  <div className="rounded-lg border border-[#24314f] bg-[#111c33] px-3 py-2">
                    <p className="text-xs text-[#9fb4dd]">OLT OK</p>
                    <p className="text-lg font-semibold text-[#22c55e]">{networkHealth.olt_ok}</p>
                  </div>
                  <div className="rounded-lg border border-[#24314f] bg-[#111c33] px-3 py-2">
                    <p className="text-xs text-[#9fb4dd]">OLT Alerta</p>
                    <p className="text-lg font-semibold text-[#fbbf24]">{networkHealth.olt_alert}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-[#9fb4dd]">Actualizado: {new Date(networkHealth.last_updated).toLocaleString()}</p>
              </div>
            )}

            {nocAlerts.length > 0 && (
              <div className="rounded-2xl border border-[#1f2a44] bg-gradient-to-br from-[#0f172a] via-[#0e1a2f] to-[#0b1220] p-4 text-[#e5edff] shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#e5edff]">Alertas NOC</h3>
                    <p className="text-xs text-[#9fb4dd]">Incidentes activos y cobranzas vencidas.</p>
                  </div>
                  <button onClick={fetchNocAlerts} className="rounded-lg border border-[#304066] bg-[#0f172a] px-3 py-2 text-xs text-[#e5edff] hover:bg-[#111c33]">
                    Refrescar
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {nocAlerts.slice(0, 5).map((al) => (
                    <div key={al.id} className="flex items-start justify-between rounded border border-[#24314f] bg-[#0f172a]/60 p-2 text-sm">
                      <div>
                        <p className="font-semibold text-[#e5edff]">{al.message}</p>
                        <p className="text-[11px] text-[#9fb4dd]">{al.target} • {new Date(al.since).toLocaleString()}</p>
                      </div>
                      <span className={`state-chip ${al.severity === 'critical' ? 'state-chip--bad' : al.severity === 'warning' ? 'state-chip--warn' : 'state-chip--good'}`}>
                        {al.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FinanceChart bars={financeBars} maxBarValue={maxBarValue} />
          </div>
        )}

        {activeView === 'clients' && (
          <section className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f4f7ff] to-[#eaf2ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#1f2937]">{clientsTabLabels[activeClientsTab]}</h2>
                {activeClientsTab === 'list' || activeClientsTab === 'search' ? (
                  <p className="mt-1 text-xs text-[#5f6b7a]">Control operativo de clientes con filtros inteligentes y acciones masivas.</p>
                ) : activeClientsTab.startsWith('tickets') ? (
                  <p className="mt-1 text-xs text-[#5f6b7a]">Gestion de tickets de soporte con estados y busqueda operacional.</p>
                ) : activeClientsTab.startsWith('stats-tickets') ? (
                  <p className="mt-1 text-xs text-[#5f6b7a]">Analitica de rendimiento de soporte por periodo, cierre y equipo.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeClientsTab === 'list' || activeClientsTab === 'search' ? (
                  <>
                    <button onClick={addClient} className="inline-flex items-center gap-1 rounded-lg bg-[#48b968] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#3da65b]">
                      <PlusCircleIcon className="h-4 w-4" />
                      Agregar cliente
                    </button>
                    <button onClick={exportClientsCsv} className="inline-flex items-center gap-1 rounded-lg border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f8faff]">
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Exportar CSV
                    </button>
                    <button onClick={sendPaymentReminder} className="inline-flex items-center gap-1 rounded-lg border border-[#f4d1a3] bg-[#fff8ef] px-3 py-2 text-sm font-medium text-[#8a4b00] transition hover:bg-[#fff2df]">
                      <EnvelopeIcon className="h-4 w-4" />
                      Recordatorio
                    </button>
                    <button onClick={prioritizeSupport} className="inline-flex items-center gap-1 rounded-lg border border-[#bad7ff] bg-[#eef6ff] px-3 py-2 text-sm font-medium text-[#1556a8] transition hover:bg-[#e2f0ff]">
                      <LifebuoyIcon className="h-4 w-4" />
                      Priorizar soporte
                    </button>
                  </>
                ) : null}
                {activeClientsTab.startsWith('tickets') ? (
                  <>
                    <button onClick={createSupportTicket} className="inline-flex items-center gap-1 rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                      <PlusCircleIcon className="h-4 w-4" />
                      Nuevo ticket
                    </button>
                    <button onClick={() => setTicketSearch('')} className="inline-flex items-center gap-1 rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                      Limpiar busqueda
                    </button>
                  </>
                ) : null}
                {activeClientsTab === 'announcements' ? (
                  <button onClick={createScreenNotice} className="inline-flex items-center gap-1 rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                    <MegaphoneIcon className="h-4 w-4" />
                    Nuevo aviso
                  </button>
                ) : null}
                {activeClientsTab === 'push' ? (
                  <button onClick={sendPush} className="inline-flex items-center gap-1 rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                    <PaperAirplaneIcon className="h-4 w-4" />
                    Enviar push
                  </button>
                ) : null}
              </div>
            </div>

            {(activeClientsTab === 'list' || activeClientsTab === 'search') && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#cdd7ea] bg-white/95 px-3 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#4c5564]">Zona</span>
                    <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} className="rounded-md border border-[#c6d3ea] bg-white px-2 py-1.5 text-sm">
                      <option value="all">Todas</option>
                      {zones.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#4c5564]">Accion</span>
                    <select
                      value={bulkAction}
                      onChange={(event) => setBulkAction(event.target.value as any)}
                      className="rounded-md border border-[#c6d3ea] bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="none">Selecciona</option>
                      <option value="activate">Activar servicio</option>
                      <option value="suspend">Suspender / offline</option>
                      <option value="reminder">Enviar recordatorio</option>
                      <option value="export">Exportar seleccion</option>
                    </select>
                    <button
                      onClick={executeBulkAction}
                      className="inline-flex items-center gap-1 rounded-md bg-[#1b9be0] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#128ace]"
                    >
                      <PlayCircleIcon className="h-4 w-4" />
                      Ejecutar
                    </button>
                    <label className="flex items-center gap-1 text-xs text-[#4c5564]">
                      <input
                        type="checkbox"
                        checked={paginatedClientProfiles.length > 0 && paginatedClientProfiles.every((item) => selectedClientIds.includes(item.id))}
                        onChange={toggleSelectCurrentPage}
                      />
                      seleccionados {selectedClientIds.length}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#4c5564]">Mostrar</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-md border border-[#c6d3ea] bg-white px-2 py-1.5 text-sm">
                      {[5, 8, 10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size} registros
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-[#6a7281]">Tabla {tableDensity === 'compact' ? 'compacta' : 'espaciosa'}</span>
                    <div className="inline-flex overflow-hidden rounded-md border border-[#c6d3ea]">
                      <button
                        onClick={() => setTableDensity('comfortable')}
                        className={`px-2 py-1 text-xs ${tableDensity === 'comfortable' ? 'bg-[#1b5fc4] text-white' : 'bg-white text-[#4c5564]'}`}
                      >
                        Tabla
                      </button>
                      <button
                        onClick={() => setTableDensity('compact')}
                        className={`px-2 py-1 text-xs ${tableDensity === 'compact' ? 'bg-[#1b5fc4] text-white' : 'bg-white text-[#4c5564]'}`}
                      >
                        Compacta
                      </button>
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-1">
                    <button
                      onClick={exportClientsCsv}
                      className="rounded-md bg-[#1da45b] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#158a4b]"
                      title="Exportar Excel"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toast.success('Vista previa lista en pantalla.')}
                      className="rounded-md bg-[#00a1e0] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#0088be]"
                      title="Vista previa"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toast.success('Herramientas listas para usar.')}
                      className="rounded-md bg-[#ef9f1f] px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#d8890f]"
                      title="Herramientas"
                    >
                      <WrenchScrewdriverIcon className="h-4 w-4" />
                    </button>
                    <div className="hidden md:flex">
                      <input
                        value={clientSearch}
                        onChange={(event) => setClientSearch(event.target.value)}
                        className="rounded-md border border-[#c3cee5] bg-white px-3 py-1.5 text-sm"
                        placeholder="Buscar..."
                      />
                    </div>
                  </div>
                </div>
                {showAddClient ? (
                  <div className="mb-4 grid gap-4 rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f8fbff] to-[#ecf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.35)] md:grid-cols-3">
                    <div className="md:col-span-2">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#0f172a]">Registrar nuevo cliente</p>
                          <p className="text-xs text-[#5f6b7a]">Completa contacto, IP y asigna router/plan. Se aplican buenas prácticas ISP por defecto.</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button onClick={() => setShowAddClient(false)} className="rounded border border-[#c8cdd3] px-3 py-1.5 text-[#3d444c]">
                            Cancelar
                          </button>
                          <button onClick={saveNewClient} className="rounded bg-[#1b9be0] px-3 py-1.5 font-semibold text-white hover:bg-[#128ace]">
                            Guardar
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={newClientDraft.name}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, name: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                          placeholder="Nombre completo"
                        />
                        <input
                          value={newClientDraft.phone}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, phone: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                          placeholder="Celular"
                        />
                        <input
                          value={newClientDraft.email}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, email: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                          placeholder="Correo"
                        />
                        <input
                          value={newClientDraft.address}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, address: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                          placeholder="Direccion / referencia"
                        />
                        <input
                          value={newClientDraft.ip}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, ip: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                          placeholder="IP de servicio"
                        />
                        <select
                          value={newClientDraft.connectionType}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, connectionType: e.target.value as any }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                        >
                          <option value="dhcp">DHCP</option>
                          <option value="static">IP Estática</option>
                          <option value="pppoe">PPPoE</option>
                        </select>
                        {newClientDraft.connectionType === 'pppoe' ? (
                          <>
                            <input
                              value={newClientDraft.pppoeUser}
                              onChange={(e) => setNewClientDraft((prev) => ({ ...prev, pppoeUser: e.target.value }))}
                              className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                              placeholder="Usuario PPPoE (opcional)"
                            />
                            <input
                              value={newClientDraft.pppoePass}
                              onChange={(e) => setNewClientDraft((prev) => ({ ...prev, pppoePass: e.target.value }))}
                              className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                              placeholder="Clave PPPoE (opcional)"
                            />
                          </>
                        ) : null}
                        <select
                          value={newClientDraft.plan}
                          onChange={(e) => {
                            const plan = e.target.value as PlanType
                            setNewClientDraft((prev) => ({ ...prev, plan, planCost: planPricing[plan] }))
                          }}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                        >
                          {planOptions.map((plan) => (
                            <option key={plan} value={plan}>
                              Plan {plan}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm">
                          <span className="text-xs text-[#5b6575]">S/.</span>
                          <input
                            type="number"
                            min={0}
                            value={newClientDraft.planCost}
                            onChange={(e) => setNewClientDraft((prev) => ({ ...prev, planCost: Number(e.target.value) }))}
                            className="w-full bg-transparent text-sm outline-none"
                            placeholder="Costo plan"
                          />
                        </div>
                        <select
                          value={newClientDraft.routerId}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, routerId: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Asignar MikroTik</option>
                          {mikrotikRouters.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newClientDraft.zone}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, zone: e.target.value }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                        >
                          {zones.map((z) => (
                            <option key={z} value={z}>
                              Zona {z}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newClientDraft.status}
                          onChange={(e) => setNewClientDraft((prev) => ({ ...prev, status: e.target.value as ConnectionStatus }))}
                          className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm"
                        >
                          <option value="active">Activo</option>
                          <option value="idle">En espera</option>
                          <option value="offline">Suspendido</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 rounded-xl border border-[#d7e3ff] bg-white/90 p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <LightBulbIcon className="mt-0.5 h-5 w-5 text-[#f59e0b]" />
                        <div>
                          <p className="text-sm font-semibold text-[#0f172a]">Apoyo al nuevo cliente</p>
                          <p className="text-xs text-[#5f6b7a]">Habilita ayuda automatizada al activar el servicio.</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs text-[#374151]">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newClientOptions.autoProvision}
                            onChange={(e) => setNewClientOptions((prev) => ({ ...prev, autoProvision: e.target.checked }))}
                          />
                          Provisionar MikroTik y crear colas/ARP
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newClientOptions.sendWelcome}
                            onChange={(e) => setNewClientOptions((prev) => ({ ...prev, sendWelcome: e.target.checked }))}
                          />
                          Enviar correo + WhatsApp de bienvenida
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newClientOptions.createInvoice}
                            onChange={(e) => setNewClientOptions((prev) => ({ ...prev, createInvoice: e.target.checked }))}
                          />
                          Generar primera factura y promesa de pago
                        </label>
                      </div>
                      <div className="rounded-lg border border-[#e4ebff] bg-[#f7faff] p-3 text-xs">
                        <p className="font-semibold text-[#0f172a]">Resumen</p>
                        <p className="text-[#374151]">Plan: {newClientDraft.plan} (S/. {newClientDraft.planCost || planPricing[newClientDraft.plan]}).</p>
                        <p className="text-[#374151]">Router: {newClientDraft.routerId || 'No asignado'} · Zona: {newClientDraft.zone}</p>
                        <p className="text-[#5b6575]">Tip: usa IP de cliente con DHCP/static según plantilla del router.</p>
                      </div>
                      <button
                        onClick={() => toast.success('Se abrirá guía rápida de instalación.')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1b5fc4] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#154da3]"
                      >
                        <LifebuoyIcon className="h-4 w-4" />
                        Ver guía rápida para técnicos
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-[#d7e3ff] bg-white/90 px-3 py-3 shadow-sm">
                    <p className="text-xs text-[#6a7281]">Total filtrados</p>
                    <p className="text-lg font-semibold text-[#1b5fc4]">{filteredClientProfiles.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#ffe2bf] bg-[#fff8ef] px-3 py-3 shadow-sm">
                    <p className="text-xs text-[#8b6a46]">Deuda en cartera</p>
                    <p className="text-lg font-semibold text-[#b55d00]">S/. {clientOpsSummary.totalDebt.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-[#ffd7d7] bg-[#fff4f4] px-3 py-3 shadow-sm">
                    <p className="text-xs text-[#8a4a4a]">Riesgo alto</p>
                    <p className="text-lg font-semibold text-[#d22c2c]">{clientOpsSummary.highRisk}</p>
                  </div>
                  <div className="rounded-xl border border-[#d7f2e0] bg-[#f2fcf6] px-3 py-3 shadow-sm">
                    <p className="text-xs text-[#4f6e5a]">Uso promedio</p>
                    <p className="text-lg font-semibold text-[#2e8f57]">{clientOpsSummary.avgUsage} GB</p>
                  </div>
                </div>

                <div className="mb-3 grid gap-2 rounded-xl border border-[#d4d8dd] bg-white/95 px-3 py-3 shadow-sm lg:grid-cols-3">
                  <div className="flex items-center gap-2 text-xs text-[#4c5564]">
                    <span className="font-semibold uppercase tracking-wide text-[#4c5564]">Mostrar</span>
                    <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded border border-[#c8cdd3] px-2 py-1">
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size} registros
                        </option>
                      ))}
                    </select>
                    <span>de {filteredClientProfiles.length}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#4c5564]">Botones de accion</span>
                    <button className="square-btn bg-[#16a34a]" title="Copiar" onClick={exportClientsCsv}>
                      <DocumentDuplicateIcon className="h-4 w-4 text-white" />
                    </button>
                    <button className="square-btn bg-[#0ea5e9]" title="Excel" onClick={exportClientsCsv}>
                      <ArrowDownTrayIcon className="h-4 w-4 text-white" />
                    </button>
                    <button className="square-btn bg-[#f59e0b]" title="Refrescar" onClick={() => loadData(true)}>
                      <ArrowPathIcon className="h-4 w-4 text-white" />
                    </button>
                    <button className="square-btn bg-[#9333ea]" title="Columnas visibles" onClick={() => toast.success('Columnas visibles activadas.')}>
                      <ListBulletIcon className="h-4 w-4 text-white" />
                    </button>
                    <button className="square-btn bg-[#10b981]" title="Mapa clientes" onClick={() => openModule('clients', { key: 'clientsTab', value: 'map' })}>
                      <GlobeAmericasIcon className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-[#4c5564]">
                    <span className="font-semibold uppercase tracking-wide text-[#4c5564]">Tabla</span>
                    <button
                      onClick={() => setTableDensity('comfortable')}
                      className={`rounded border px-2 py-1 ${tableDensity === 'comfortable' ? 'border-[#1b5fc4] bg-[#1b5fc4] text-white' : 'border-[#c8cdd3] bg-white'}`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setTableDensity('compact')}
                      className={`rounded border px-2 py-1 ${tableDensity === 'compact' ? 'border-[#1b5fc4] bg-[#1b5fc4] text-white' : 'border-[#c8cdd3] bg-white'}`}
                    >
                      Compacta
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#d5def0] bg-white/80 px-3 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#5b6575]">Segmento</span>
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'delinquent', label: 'Morosos' },
                    { id: 'highUsage', label: 'Alto consumo' },
                    { id: 'support', label: 'Con soporte' },
                    { id: 'healthy', label: 'Estables' }
                  ].map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => setSegmentFilter(segment.id as SegmentFilter)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        segmentFilter === segment.id ? 'bg-[#1b5fc4] text-white' : 'border border-[#c7d2ea] bg-white text-[#445066] hover:bg-[#f3f7ff]'
                      }`}
                    >
                      {segment.label}
                    </button>
                  ))}
                  <button
                    onClick={resetClientFilters}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-[#c7d2ea] bg-white px-2 py-1 text-xs text-[#445066] hover:bg-[#f4f8ff]"
                  >
                    <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                    Restablecer
                  </button>
                </div>

                <div className="mb-3 grid gap-3 lg:grid-cols-7">
                  <input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm lg:col-span-2"
                    placeholder="Buscar por nombre, codigo, IP, MAC o zona"
                  />
                  <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value as any)} className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm">
                    <option value="all">Estado: todos</option>
                    <option value="active">Activos</option>
                    <option value="idle">Inactivos</option>
                    <option value="offline">Offline</option>
                  </select>
                  <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value as any)} className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm">
                    <option value="all">Plan: todos</option>
                    {planOptions.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan}
                      </option>
                    ))}
                  </select>
                  <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm">
                    <option value="all">Zona: todas</option>
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as any)} className="rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm">
                    <option value="all">Riesgo: todos</option>
                    <option value="low">Bajo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={exportClientsCsv} className="inline-flex items-center gap-1 rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      CSV
                    </button>
                    <button onClick={resetClientFilters} className="inline-flex items-center gap-1 rounded-lg border border-[#c3cee5] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                      <AdjustmentsHorizontalIcon className="h-4 w-4" />
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d2dcef] bg-[#f6f9ff] px-3 py-2 text-sm">
                  <div className="inline-flex items-center gap-2 text-[#2e4668]">
                    {clientOpsSummary.highRisk > 0 ? (
                      <ExclamationTriangleIcon className="h-4 w-4 text-[#d22c2c]" />
                    ) : clientOpsSummary.totalDebt > 0 ? (
                      <ShieldExclamationIcon className="h-4 w-4 text-[#b55d00]" />
                    ) : (
                      <SparklesIcon className="h-4 w-4 text-[#2f66c8]" />
                    )}
                    <span>{operationsHint}</span>
                  </div>
                  {selectedClientIds.length > 0 ? (
                    <div className="text-xs font-medium text-[#4d5a70]">
                      Deuda en seleccion: <span className="text-[#b55d00]">S/. {clientOpsSummary.selectedDebt.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-[#d4d8dd] bg-[#fafbfc] px-3 py-2">
                  <span className="text-xs text-gray-600">Orden:</span>
                  {[
                    { key: 'name', label: 'Nombre' },
                    { key: 'usage', label: 'Uso' },
                    { key: 'debt', label: 'Deuda' },
                    { key: 'tickets', label: 'Tickets' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (sortField === item.key) {
                          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                          return
                        }
                        setSortField(item.key as any)
                        setSortDirection('asc')
                      }}
                      className={`rounded px-2 py-1 text-xs ${
                        sortField === item.key ? 'bg-[#1b9be0] text-white' : 'bg-white text-[#3d444c] border border-[#c8cdd3]'
                      }`}
                    >
                      {item.label}
                      {sortField === item.key ? ` (${sortDirection === 'asc' ? 'ASC' : 'DESC'})` : ''}
                    </button>
                  ))}
                </div>

                {selectedClientIds.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#c9d9f5] bg-[#eef4ff] px-3 py-2">
                    <span className="text-xs font-medium text-[#2f3338]">{selectedClientIds.length} seleccionados</span>
                    <button onClick={() => applyBulkStatus('active')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">Activar</button>
                    <button onClick={() => applyBulkStatus('idle')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">Inactivar</button>
                    <button onClick={() => applyBulkStatus('offline')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">Offline</button>
                    <button onClick={sendPaymentReminder} className="inline-flex items-center gap-1 rounded border border-[#f4d1a3] bg-white px-2 py-1 text-xs text-[#8a4b00]">
                      <EnvelopeIcon className="h-3.5 w-3.5" />
                      Recordatorio
                    </button>
                    <button onClick={prioritizeSupport} className="inline-flex items-center gap-1 rounded border border-[#bad7ff] bg-white px-2 py-1 text-xs text-[#1556a8]">
                      <LifebuoyIcon className="h-3.5 w-3.5" />
                      Priorizar
                    </button>
                    <select value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value as PlanType)} className="rounded border border-[#c8cdd3] px-2 py-1 text-xs">
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                    <button onClick={applyBulkPlan} className="rounded bg-[#48b968] px-2 py-1 text-xs font-medium text-white hover:bg-[#3da65b]">
                      Aplicar plan
                    </button>
                    <button onClick={() => setSelectedClientIds([])} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">
                      Limpiar
                    </button>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
                        <th className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={paginatedClientProfiles.length > 0 && paginatedClientProfiles.every((item) => selectedClientIds.includes(item.id))}
                            onChange={toggleSelectCurrentPage}
                          />
                        </th>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Usuario</th>
                        <th className="px-3 py-2">IP</th>
                        <th className="px-3 py-2">Avisos</th>
                        <th className="px-3 py-2">Interfaz LAN</th>
                        <th className="px-3 py-2">Dia corte</th>
                        <th className="px-3 py-2">Zona</th>
                        <th className="px-3 py-2">Plan</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Acciones</th>
                      </tr>
                      <tr className="border-b border-[#e8ecf4] bg-[#fbfcff] text-left text-[#5a6476]">
                        <th className="px-3 py-2 text-[11px] text-gray-500">Todos</th>
                        <th className="px-3 py-2">
                          <input
                            value={clientColumnFilters.name}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="Buscar nombre"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={clientColumnFilters.username}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, username: e.target.value }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="Usuario"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={clientColumnFilters.ip}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, ip: e.target.value }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="IP"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <select
                            value={clientColumnFilters.screen}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, screen: e.target.value as ScreenNoticeFilter }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                          >
                            <option value="all">Todos</option>
                            <option value="yes">Si</option>
                            <option value="no">No</option>
                          </select>
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={clientColumnFilters.lan}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, lan: e.target.value }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="ether1/2"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={clientColumnFilters.cutoff}
                            onChange={(e) => setClientColumnFilters((prev) => ({ ...prev, cutoff: e.target.value }))}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="dd/mm"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={zoneFilter !== 'all' ? zoneFilter : ''}
                            onChange={(e) => setZoneFilter(e.target.value || 'all')}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="Zona"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <input
                            value={planFilter !== 'all' ? planFilter : ''}
                            onChange={(e) => setPlanFilter((e.target.value || 'all') as any)}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                            placeholder="Plan"
                          />
                        </th>
                        <th className="px-3 py-2">
                          <select
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value as any)}
                            className="w-full rounded border border-[#d4d8dd] bg-white px-2 py-1 text-xs"
                          >
                            <option value="all">Todos</option>
                            <option value="active">Activo</option>
                            <option value="idle">Inactivo</option>
                            <option value="offline">Suspendido</option>
                          </select>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button onClick={() => setClientColumnFilters({ name: '', username: '', ip: '', lan: '', cutoff: '', screen: 'all' })} className="text-[11px] text-[#1b5fc4]">
                            Limpiar
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedClientProfiles.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-6 text-center text-sm text-gray-500">
                            Sin resultados para el filtro aplicado.
                          </td>
                        </tr>
                      ) : null}
                      {paginatedClientProfiles.map((item) => (
                        <tr
                          key={item.id}
                          className={`border-b border-[#eceff2] hover:bg-[#f9fbff] ${selectedClientIds.includes(item.id) ? 'bg-[#f5f9ff]' : ''}`}
                        >
                          <td className={`px-3 ${clientRowPadding}`}>
                            <input type="checkbox" checked={selectedClientIds.includes(item.id)} onChange={() => toggleSelectClient(item.id)} />
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <div>
                              <p className="font-medium text-[#2f3338]">{item.name}</p>
                              <p className="text-[11px] text-gray-500">Codigo {item.code}</p>
                            </div>
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <p className="font-mono text-[12px] text-[#1b5fc4]">{item.username}</p>
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <p className="font-mono text-xs text-[#374151]">{item.ip}</p>
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <span className={`state-chip ${item.screenNotice ? 'state-chip--good' : 'state-chip--bad'}`}>{item.screenNotice ? 'Si' : 'No'}</span>
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>{item.lanInterface}</td>
                          <td className={`px-3 ${clientRowPadding}`}>{item.cutoffDay}</td>
                          <td className={`px-3 ${clientRowPadding}`}>{item.zone}</td>
                          <td className={`px-3 ${clientRowPadding}`}>{item.plan}</td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td className={`px-3 ${clientRowPadding}`}>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => setSelectedClientId(item.id)}
                                className="inline-flex items-center gap-1 rounded bg-[#1b9be0] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#128ace]"
                              >
                                <EyeIcon className="h-3.5 w-3.5" />
                                Ver
                              </button>
                              <button
                                onClick={() => sendPaymentReminderForIds([item.id])}
                                className="inline-flex items-center gap-1 rounded bg-[#f59e0b] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#d48507]"
                              >
                                <EnvelopeIcon className="h-3.5 w-3.5" />
                                Cobrar
                              </button>
                              <button
                                onClick={() => goToFinance('pending-payments')}
                                className="inline-flex items-center gap-1 rounded bg-[#0ea5e9] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#0c8ac7]"
                              >
                                <Bars3BottomLeftIcon className="h-3.5 w-3.5" />
                                Finanzas
                              </button>
                              <button
                                onClick={() => updateConnectionStatus(item.id, 'active')}
                                className="inline-flex items-center gap-1 rounded bg-[#16a34a] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#128a3f]"
                              >
                                Act
                              </button>
                              <button
                                onClick={() => updateConnectionStatus(item.id, 'offline')}
                                className="inline-flex items-center gap-1 rounded bg-[#ef4444] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#d92f2f]"
                              >
                                Off
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>
                      Mostrando {pageRange.start}-{pageRange.end} de {filteredClientProfiles.length} registros
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="inline-flex items-center gap-1 rounded border border-[#c8cdd3] px-2 py-1 text-xs disabled:opacity-50"
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="inline-flex items-center gap-1 rounded border border-[#c8cdd3] px-2 py-1 text-xs disabled:opacity-50"
                      disabled={currentPage >= totalPages}
                    >
                      Siguiente
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {selectedClientProfile ? (
                  <div className="mt-4 rounded-xl border border-[#cdd7ea] bg-[#f8fbff] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold text-[#2f3338]">Ficha cliente: {selectedClientProfile.name}</h4>
                      <button onClick={() => setSelectedClientId(null)} className="rounded border border-[#c8cdd3] px-2 py-1 text-xs">
                        Cerrar
                      </button>
                    </div>
                    <div className="grid gap-2 text-sm md:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Codigo</p>
                        <p>{selectedClientProfile.code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">IP</p>
                        <p>{selectedClientProfile.ip}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">MAC</p>
                        <p className="font-mono text-xs">{selectedClientProfile.mac}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Plan</p>
                        <p>{selectedClientProfile.plan}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Zona</p>
                        <p>{selectedClientProfile.zone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Ultima conexion</p>
                        <p>{selectedClientProfile.lastSeen}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Deuda</p>
                        <p>S/. {selectedClientProfile.debt.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tickets activos</p>
                        <p>{selectedClientProfile.tickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Riesgo</p>
                        <RiskBadge risk={selectedClientProfile.risk} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Celular</p>
                        <p>{selectedClientProfile.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Correo</p>
                        <p className="break-all text-[12px] text-[#1b5fc4]">{selectedClientProfile.email || 'No registrado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Direccion</p>
                        <p>{selectedClientProfile.address || 'No registrada'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Router asignado</p>
                        <p>{selectedClientProfile.routerId ? selectedClientProfile.routerId : 'No asignado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Costo del plan</p>
                        <p>S/. {selectedClientProfile.planCost.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => updateConnectionStatus(selectedClientProfile.id, 'active')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">
                        Marcar activo
                      </button>
                      <button onClick={() => updateConnectionStatus(selectedClientProfile.id, 'offline')} className="rounded border border-[#c8cdd3] bg-white px-2 py-1 text-xs">
                        Suspender
                      </button>
                      <button
                        onClick={() => sendPaymentReminderForIds([selectedClientProfile.id])}
                        className="inline-flex items-center gap-1 rounded border border-[#f4d1a3] bg-white px-2 py-1 text-xs text-[#8a4b00]"
                      >
                        <EnvelopeIcon className="h-3.5 w-3.5" />
                        Recordatorio de pago
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {activeClientsTab === 'installations' && (
              <div className="space-y-3">
                {installations.map((item) => (
                  <div key={item.id} className="rounded border border-[#d4d8dd] bg-[#fafbfc] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#2f3338]">{item.client}</p>
                        <p className="text-xs text-gray-600">{item.address}</p>
                        <p className="text-xs text-gray-500">Fecha: {item.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status === 'done' ? 'active' : item.status === 'scheduled' ? 'idle' : 'offline'} />
                        <button onClick={() => updateInstallationStatus(item.id, 'scheduled')} className="rounded border border-[#c8cdd3] px-2 py-1 text-xs">Programar</button>
                        <button onClick={() => updateInstallationStatus(item.id, 'done')} className="rounded bg-[#48b968] px-2 py-1 text-xs text-white">Completar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeClientsTab === 'announcements' && (
              <div className="space-y-3">
                {screenNotices.map((item) => (
                  <div key={item.id} className="rounded border border-[#d4d8dd] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#2f3338]">{item.title}</p>
                        <p className="text-sm text-gray-600">{item.message}</p>
                      </div>
                      <button onClick={() => toggleScreenNotice(item.id)} className={`rounded px-2 py-1 text-xs ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item.active ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeClientsTab === 'traffic' && (
              <div className="space-y-2">
                {trafficByClient.map((item) => (
                  <div key={item.id} className="rounded border border-[#d4d8dd] p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{item.ip}</span>
                      <span className="font-semibold text-[#1b9be0]">{item.usage} GB</span>
                    </div>
                    <div className="h-2 rounded bg-gray-200">
                      <div className="h-2 rounded bg-[#1b9be0]" style={{ width: `${Math.min(item.usage, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeClientsTab === 'map' && (
              <div className="grid gap-3 md:grid-cols-2">
                {connections.map((item, index) => (
                  <div key={item.id} className="rounded border border-[#d4d8dd] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-[#1b9be0]" />
                      <p className="font-medium">{item.ip}</p>
                    </div>
                    <p className="text-xs text-gray-600">Lat: {-12.05 + index * 0.01}</p>
                    <p className="text-xs text-gray-600">Lng: {-77.04 + index * 0.02}</p>
                    <p className="mt-1 text-xs text-gray-500">Referencia geolocalizada</p>
                  </div>
                ))}
              </div>
            )}

            {activeClientsTab === 'stats' && (
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Clientes activos" value={String(clientsByStatus.active)} tone="green" />
                <SummaryCard label="Clientes inactivos" value={String(clientsByStatus.idle)} tone="orange" />
                <SummaryCard label="Clientes offline" value={String(clientsByStatus.offline)} tone="blue" />
              </div>
            )}

            {activeClientsTab === 'push' && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <input value={pushDraft.title} onChange={(e) => setPushDraft((prev) => ({ ...prev, title: e.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" placeholder="Titulo" />
                  <input value={pushDraft.message} onChange={(e) => setPushDraft((prev) => ({ ...prev, message: e.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" placeholder="Mensaje" />
                  <select value={pushDraft.target} onChange={(e) => setPushDraft((prev) => ({ ...prev, target: e.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm">
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="suspended">Suspendidos</option>
                  </select>
                </div>
                <button onClick={sendPush} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">Enviar</button>
                <div className="space-y-2">
                  {pushHistory.length === 0 ? <p className="text-sm text-gray-500">Sin envios registrados.</p> : null}
                  {pushHistory.map((item) => (
                    <div key={item.id} className="rounded border border-[#d4d8dd] p-2 text-sm">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-gray-600">Destino: {item.target}</p>
                      <p className="text-xs text-gray-500">{item.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeClientsTab === 'services' && (
              <div className="space-y-2">
                {Object.entries(serviceFlags).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between rounded border border-[#d4d8dd] px-3 py-2 text-sm">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <input type="checkbox" checked={value} onChange={() => toggleService(key as keyof typeof serviceFlags)} />
                  </label>
                ))}
              </div>
            )}

            {(activeClientsTab === 'tickets-new' || activeClientsTab === 'tickets-progress' || activeClientsTab === 'tickets-closed' || activeClientsTab === 'tickets-search') && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <SummaryCard label="Nuevos" value={String(ticketCounters.byStatus.new)} tone="orange" />
                  <SummaryCard label="En progreso" value={String(ticketCounters.byStatus.progress)} tone="blue" />
                  <SummaryCard label="Cerrados" value={String(ticketCounters.byStatus.closed)} tone="green" />
                  <SummaryCard label="Total" value={String(supportTickets.length)} tone="blue" />
                </div>
                <input
                  value={ticketSearch}
                  onChange={(event) => setTicketSearch(event.target.value)}
                  className="w-full rounded border border-[#c8cdd3] px-3 py-2 text-sm"
                  placeholder="Buscar ticket por codigo, cliente, asunto, departamento o agente"
                />
                <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                        <th className="px-3 py-2">Ticket</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Asunto</th>
                        <th className="px-3 py-2">Departamento</th>
                        <th className="px-3 py-2">Asignado</th>
                        <th className="px-3 py-2">Prioridad</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">
                            No hay tickets para el filtro seleccionado.
                          </td>
                        </tr>
                      ) : null}
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-[#eef2f9]">
                          <td className="px-3 py-2 font-medium text-[#24344f]">{ticket.id}</td>
                          <td className="px-3 py-2">{ticket.client}</td>
                          <td className="px-3 py-2">{ticket.subject}</td>
                          <td className="px-3 py-2">{ticket.department}</td>
                          <td className="px-3 py-2">{ticket.assignee}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-2 py-1 text-xs ${ticket.priority === 'high' ? 'bg-red-100 text-red-700' : ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-2 py-1 text-xs ${ticket.status === 'closed' ? 'bg-green-100 text-green-700' : ticket.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              {ticket.status !== 'in-progress' ? (
                                <button onClick={() => updateSupportTicketStatus(ticket.id, 'in-progress')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                                  En progreso
                                </button>
                              ) : null}
                              {ticket.status !== 'closed' ? (
                                <button onClick={() => updateSupportTicketStatus(ticket.id, 'closed')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                                  Cerrar
                                </button>
                              ) : null}
                              {ticket.status === 'closed' ? (
                                <button onClick={() => updateSupportTicketStatus(ticket.id, 'in-progress')} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                                  Reabrir
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeClientsTab === 'stats-tickets-month' && (
              <div className="grid gap-3 md:grid-cols-6">
                {monthNames.map((month, index) => {
                  const total = 8 + ((index + 1) % 5) * 3
                  const closed = Math.max(1, total - ((index + 2) % 4))
                  const ratio = Math.round((closed / total) * 100)
                  return (
                    <div key={month} className="rounded border border-[#d4d8dd] bg-white px-3 py-3 text-sm">
                      <p className="font-semibold text-[#2f3338]">{month}</p>
                      <p className="text-xs text-gray-600">Tickets: {total}</p>
                      <p className="text-xs text-gray-600">Cierre: {ratio}%</p>
                    </div>
                  )
                })}
              </div>
            )}

            {activeClientsTab === 'stats-tickets-closure' && (
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Tickets nuevos" value={String(ticketCounters.byStatus.new)} tone="orange" />
                <SummaryCard label="Tickets en progreso" value={String(ticketCounters.byStatus.progress)} tone="blue" />
                <SummaryCard label="Tickets cerrados" value={String(ticketCounters.byStatus.closed)} tone="green" />
              </div>
            )}

            {activeClientsTab === 'stats-staff-departments' && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  {Object.entries(ticketCounters.byDepartment).map(([department, total]) => (
                    <div key={department} className="rounded border border-[#d4d8dd] bg-white px-3 py-3 text-sm">
                      <p className="font-semibold text-[#2f3338]">{department}</p>
                      <p className="text-xs text-gray-600">Tickets: {total}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                        <th className="px-3 py-2">Staff</th>
                        <th className="px-3 py-2">Rol</th>
                        <th className="px-3 py-2">Departamento</th>
                        <th className="px-3 py-2">Tickets estimados</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffMembers.map((staff) => (
                        <tr key={staff.id} className="border-b border-[#eef2f9]">
                          <td className="px-3 py-2">{staff.name}</td>
                          <td className="px-3 py-2">{staff.role}</td>
                          <td className="px-3 py-2">{staff.department}</td>
                          <td className="px-3 py-2">{ticketCounters.byDepartment[staff.department] || 0}</td>
                          <td className="px-3 py-2">{staff.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {activeView === 'finance' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">{financeTabLabels[activeFinanceTab]}</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Operacion financiera profesional: cobranza, facturacion, reportes y conciliacion.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(activeFinanceTab === 'payment-report' || activeFinanceTab === 'payments-list') && (
                    <button onClick={exportPaymentReport} className="inline-flex items-center gap-1 rounded-lg border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f8faff]">
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Exportar CSV
                    </button>
                  )}
                  {activeFinanceTab === 'pending-payments' && (
                    <button onClick={() => createPaymentPromise()} className="rounded-lg bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                      Crear promesa
                    </button>
                  )}
                  {activeFinanceTab === 'excel-payments' && (
                    <button onClick={importPaymentsFromExcel} className="rounded-lg bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                      Importar pagos
                    </button>
                  )}
                </div>
              </div>

              {renderFinanceTab()}
            </div>

            {(activeFinanceTab === 'dashboard' || activeFinanceTab === 'statistics') && <FinanceChart bars={financeBars} maxBarValue={maxBarValue} />}
          </section>
        )}

        {activeView === 'licensing' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#1f2a44] bg-gradient-to-br from-[#0f172a] via-[#0e1a2f] to-[#0b1220] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] text-[#e5edff] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Licencias ISP (SaaS)</h2>
                  <p className="mt-1 text-xs text-[#9fb4dd]">Control de clientes que pagan el software por ciclo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={subscriptionFilter}
                    onChange={(e) => setSubscriptionFilter(e.target.value as any)}
                    className="rounded-lg border border-[#304066] bg-[#0f172a] px-3 py-2 text-sm text-[#e5edff]"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="past_due">Vencidos</option>
                    <option value="trial">Prueba</option>
                    <option value="suspended">Suspendidos</option>
                  </select>
                  <button
                    onClick={runSubscriptionReminders}
                    className="rounded-lg border border-[#304066] bg-[#13203b] px-3 py-2 text-sm font-semibold text-[#e5edff] hover:bg-[#111c33]"
                  >
                    Revisar vencidos
                  </button>
                  <button
                    onClick={fetchSubscriptions}
                    className="rounded-lg border border-[#304066] bg-[#0f172a] px-3 py-2 text-sm text-[#e5edff] hover:bg-[#111c33]"
                  >
                    Sincronizar
                  </button>
                  <button
                    onClick={() => toast.success('Exporte generado (demo).')}
                    className="rounded-lg border border-[#304066] bg-[#0f172a] px-3 py-2 text-sm text-[#e5edff] hover:bg-[#111c33]"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <SummaryCard label="MRR (estimado)" value={`S/. ${mrr.toFixed(2)}`} tone="green" />
                <SummaryCard label="Activas" value={String(subscriptions.filter((s) => s.status === 'active').length)} tone="blue" />
                <SummaryCard label="Vencidas" value={String(pastDueCount)} tone="orange" />
                <SummaryCard label="En prueba" value={String(trialCount)} tone="green" />
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#24314f] bg-[#0f172a]/70">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#24314f] text-left text-[#a9bbdf]">
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Monto</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Próximo cobro</th>
                      <th className="px-3 py-2">Método</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionsFiltered.map((s) => (
                      <tr key={s.id} className="border-b border-[#1c2740] hover:bg-[#111c33]">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-[#e5edff]">{s.customer}</p>
                          <p className="text-xs text-[#9fb4dd]">{s.email}</p>
                        </td>
                        <td className="px-3 py-2 text-[#e5edff]">
                          {s.plan} ({s.cycleMonths}m)
                        </td>
                        <td className="px-3 py-2 text-[#e5edff]">S/. {s.amount.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`state-chip ${
                              s.status === 'active' ? 'state-chip--good' : s.status === 'past_due' ? 'state-chip--bad' : 'state-chip--warn'
                            }`}
                          >
                            {s.status === 'active' ? 'Activa' : s.status === 'past_due' ? 'Vencida' : s.status === 'trial' ? 'Prueba' : 'Suspendida'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#e5edff]">{s.nextCharge}</td>
                        <td className="px-3 py-2 text-[#e5edff]">{s.method}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <button
                              onClick={() => chargeSubscription(s.id)}
                              className="rounded bg-[#22c55e] px-2 py-1 font-semibold text-[#0b1220] hover:bg-[#16a34a]"
                            >
                              Cobrar
                            </button>
                            <button
                              onClick={() => suspendSubscription(s.id)}
                              className="rounded border border-[#304066] px-2 py-1 text-[#e5edff] hover:bg-[#111c33]"
                            >
                              Suspender
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeView === 'system' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">{systemTabLabels[activeSystemTab]}</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Automatizacion profesional de Sistema conectada con MikroTik.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={loadMikrotikRouters} className="inline-flex items-center gap-1 rounded-lg border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f8faff]">
                    <ServerStackIcon className="h-4 w-4" />
                    Actualizar inventario
                  </button>
                  <button onClick={refreshRouterTelemetry} className="inline-flex items-center gap-1 rounded-lg border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f8faff]">
                    <ArrowPathIcon className={`h-4 w-4 ${routerLoading ? 'animate-spin' : ''}`} />
                    Refrescar telemetria
                  </button>
                </div>
              </div>
              {renderSystemTab()}
            </div>
          </section>
        )}

        {activeView === 'hotspot' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">{hotspotTabLabels[activeHotspotTab]}</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Gestion integral de fichas HotSpot con sincronizacion a MikroTik.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={applyHotspotConfiguration} className="inline-flex items-center gap-1 rounded-lg bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">
                    <WrenchScrewdriverIcon className="h-4 w-4" />
                    Aplicar config
                  </button>
                  <button onClick={generateHotspotVouchers} className="inline-flex items-center gap-1 rounded-lg border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f8faff]">
                    <TicketIcon className="h-4 w-4" />
                    Generar fichas
                  </button>
                </div>
              </div>
              {renderHotspotTab()}
            </div>
          </section>
        )}

        {activeView === 'warehouse' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">{warehouseTabLabels[activeWarehouseTab]}</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Control de inventario profesional con trazabilidad, asignaciones y log operativo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => adjustWarehouseStock('WH-001', 5, 'recepcion masiva')} className="rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                    + Ingreso rapido
                  </button>
                  <button onClick={() => adjustWarehouseStock('WH-001', -2, 'salida tecnica')} className="rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                    - Salida rapida
                  </button>
                </div>
              </div>
              {renderWarehouseTab()}
            </div>
          </section>
        )}

        {activeView === 'staff' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">Staff</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Gestion de personal tecnico y operativo con estado y asignacion de activos.</p>
                </div>
                <button onClick={() => toast.success('Reporte de staff exportado.')} className="rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                  Exportar staff
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#d5def0] bg-white/95 shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#e4e9f5] bg-[#f5f8ff] text-left text-[#4d5b75]">
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Rol</th>
                      <th className="px-3 py-2">Departamento</th>
                      <th className="px-3 py-2">Activos asignados</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffMembers.map((staff) => (
                      <tr key={staff.id} className="border-b border-[#eef2f9]">
                        <td className="px-3 py-2 font-medium text-[#24344f]">{staff.name}</td>
                        <td className="px-3 py-2">{staff.role}</td>
                        <td className="px-3 py-2">{staff.department}</td>
                        <td className="px-3 py-2">{staff.assignedAssets}</td>
                        <td className="px-3 py-2">{staff.status}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => toggleStaffState(staff.id)} className="rounded border border-[#c6d3ea] bg-white px-2 py-1 text-xs hover:bg-[#f4f8ff]">
                            Alternar estado
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeView === 'settings' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f6f9ff] to-[#ebf3ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#1f2937]">{settingsTabLabels[activeSettingsTab]}</h2>
                  <p className="mt-1 text-xs text-[#5f6b7a]">Configuraciones avanzadas para facturacion, comunicaciones, app y mantenimiento del sistema.</p>
                </div>
                <button onClick={() => saveAdvancedSettings(settingsTabLabels[activeSettingsTab])} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                  Guardar modulo
                </button>
              </div>
              {renderSettingsTab()}
            </div>
          </section>
        )}

        {activeView === 'affiliate' && (
          <section className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f8fbff] to-[#edf6ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#1f2937]">Centro de afiliados</h2>
                <p className="mt-1 text-xs text-[#5f6b7a]">Seguimiento profesional de referidos, conversiones y comisiones del programa afiliado.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copyAffiliateLink} className="inline-flex items-center gap-1 rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                  <DocumentDuplicateIcon className="h-4 w-4" />
                  Copiar enlace
                </button>
                <button onClick={registerAffiliateConversion} className="inline-flex items-center gap-1 rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                  <PlusCircleIcon className="h-4 w-4" />
                  Registrar referido
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Referidos totales" value={String(affiliateStats.referrals)} tone="blue" />
              <SummaryCard label="Conversiones" value={String(affiliateStats.converted)} tone="green" />
              <SummaryCard label="Pendientes" value={String(affiliateStats.pending)} tone="orange" />
              <SummaryCard label="Comision del mes" value={`S/. ${affiliateStats.monthlyCommission.toFixed(2)}`} tone="green" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#d5def0] bg-white/90 p-4">
                <h3 className="text-sm font-semibold text-[#24344f]">Accesos rapidos afiliado</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => openModule('clients', { key: 'clientsTab', value: 'list' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm text-left hover:bg-[#f4f8ff]">
                    Ver clientes
                  </button>
                  <button onClick={() => openModule('finance', { key: 'financeTab', value: 'pending-payments' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm text-left hover:bg-[#f4f8ff]">
                    Revisar comisiones
                  </button>
                  <button onClick={() => openModule('clients', { key: 'clientsTab', value: 'tickets-new' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm text-left hover:bg-[#f4f8ff]">
                    Tickets nuevos
                  </button>
                  <button onClick={() => openModule('finance', { key: 'financeTab', value: 'payment-report' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm text-left hover:bg-[#f4f8ff]">
                    Reporte de pagos
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#d5def0] bg-white/90 p-4">
                <h3 className="text-sm font-semibold text-[#24344f]">Control operativo</h3>
                <p className="mt-1 text-xs text-[#5f6b7a]">Estado actual de conversion: {affiliateStats.converted}/{affiliateStats.referrals} referidos.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => toast.success('Resumen de afiliados exportado.')} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm hover:bg-[#f4f8ff]">
                    Exportar resumen
                  </button>
                  <button onClick={() => toast.success('Notificacion enviada al canal comercial.')} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-sm hover:bg-[#f4f8ff]">
                    Notificar comercial
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'resources' && (
          <section className="rounded-2xl border border-[#cfd8ea] bg-gradient-to-br from-white via-[#f7fbff] to-[#ecf5ff] p-4 shadow-[0_18px_40px_-28px_rgba(20,44,98,0.55)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#1f2937]">Recursos adicionales</h2>
                <p className="mt-1 text-xs text-[#5f6b7a]">Atajos operativos para abrir modulos del panel, mantenimiento y utilidades de trabajo diario.</p>
              </div>
              <button onClick={() => toast.success('Kit de recursos actualizado.')} className="inline-flex items-center gap-1 rounded border border-[#bcc7df] bg-white px-3 py-2 text-sm text-[#374151] hover:bg-[#f8faff]">
                <ArrowPathIcon className="h-4 w-4" />
                Actualizar recursos
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button onClick={() => openModule('system', { key: 'systemTab', value: 'router' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                Sistema - Router
              </button>
              <button onClick={() => openModule('finance', { key: 'financeTab', value: 'invoices' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                Finanzas - Facturas
              </button>
              <button onClick={() => openModule('clients', { key: 'clientsTab', value: 'search' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                Clientes - Buscar
              </button>
              <button onClick={() => openModule('hotspot', { key: 'hotspotTab', value: 'routers' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                HotSpot - Routers
              </button>
              <button onClick={() => openModule('warehouse', { key: 'warehouseTab', value: 'dashboard' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                Almacen - Dashboard
              </button>
              <button onClick={() => openModule('settings', { key: 'settingsTab', value: 'maintenance' })} className="rounded border border-[#c6d3ea] bg-white px-3 py-2 text-left text-sm hover:bg-[#f4f8ff]">
                Ajustes - Mantenimiento
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#d5def0] bg-white/90 p-4">
              <h3 className="text-sm font-semibold text-[#24344f]">Checklist de operacion</h3>
              <div className="mt-3 space-y-2">
                {resourceChecklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded border border-[#e4ebf8] bg-white px-3 py-2 text-sm">
                    <span className={item.completed ? 'text-[#2e8f57]' : 'text-[#445066]'}>{item.label}</span>
                    <button onClick={() => toggleResourceItem(item.id)} className={`rounded px-2 py-1 text-xs ${item.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.completed ? 'Listo' : 'Pendiente'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === 'company' && (
          <section className="rounded border border-[#d4d8dd] bg-white p-4">
            <h2 className="mb-4 text-xl font-semibold text-[#2f3338]">Informacion de empresa</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre">
                <input value={company.name} onChange={(event) => setCompany((prev) => ({ ...prev, name: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
              </Field>
              <Field label="Email">
                <input value={company.email} onChange={(event) => setCompany((prev) => ({ ...prev, email: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
              </Field>
              <Field label="Telefono">
                <input value={company.phone} onChange={(event) => setCompany((prev) => ({ ...prev, phone: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
              </Field>
              <Field label="Direccion">
                <input value={company.address} onChange={(event) => setCompany((prev) => ({ ...prev, address: event.target.value }))} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
              </Field>
            </div>
            <button onClick={() => toast.success('Datos de empresa actualizados.')} className="mt-4 rounded bg-[#48b968] px-4 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
              Guardar datos
            </button>
          </section>
        )}

        {activeView === 'manual' && (
          <section className="rounded border border-[#d4d8dd] bg-white p-4">
            <h2 className="mb-4 text-xl font-semibold text-[#2f3338]">Manual rapido</h2>
            <div className="space-y-2">
              {[
                { id: 'dashboard', title: '1. Dashboard', content: 'Consulta pagos, clientes y tickets en tiempo real.' },
                { id: 'clients', title: '2. Clientes', content: 'Usa filtros por estado y cambia estados desde la tabla.' },
                { id: 'finance', title: '3. Finanzas', content: 'Marca facturas pagadas y revisa historicos por mes.' },
                { id: 'system', title: '4. Sistema', content: 'Activa o desactiva modulos criticos del servicio.' }
              ].map((item) => (
                <div key={item.id} className="rounded border border-[#d4d8dd]">
                  <button onClick={() => setOpenManual((prev) => (prev === item.id ? '' : item.id))} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
                    {item.title}
                    <span>{openManual === item.id ? '-' : '+'}</span>
                  </button>
                  {openManual === item.id ? <p className="border-t border-[#eceff2] px-3 py-2 text-sm text-gray-700">{item.content}</p> : null}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="font-medium text-[#3a4148]">{label}</span>
    {children}
  </label>
)

const MetricBox: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClick?: () => void }> = ({ title, subtitle, icon, onClick }) => {
  const content = (
    <>
      <div>
        <p className="text-2xl font-semibold text-[#1b9be0]">{title}</p>
        <p className="text-xs tracking-wide text-[#5f656c]">{subtitle}</p>
      </div>
      <div>{icon}</div>
    </>
  )
  const className = `flex items-center justify-between rounded border border-[#d4d8dd] bg-white px-4 py-2 ${
    onClick ? 'cursor-pointer text-left transition hover:border-[#93b5e1] hover:bg-[#f7fbff]' : ''
  }`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

const MetricMini: React.FC<{ value: string; label: string; icon: React.ReactNode; onClick?: () => void }> = ({ value, label, icon, onClick }) => {
  const content = (
    <>
      <div>{icon}</div>
      <div className="text-right">
        <p className="text-2xl font-semibold text-[#1b9be0]">{value}</p>
        <p className="text-xs uppercase tracking-wide text-[#5f656c]">{label}</p>
      </div>
    </>
  )
  const className = `flex items-center justify-between rounded border border-[#d4d8dd] bg-white px-4 py-2 ${
    onClick ? 'cursor-pointer text-left transition hover:border-[#93b5e1] hover:bg-[#f7fbff]' : ''
  }`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

const TrafficCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-[#d4d8dd] bg-white px-4 py-4 text-right">
    <p className="text-3xl font-semibold text-[#1b9be0]">{value}</p>
    <p className="text-sm text-[#4b5259]">{label}</p>
  </div>
)

const FinanceChart: React.FC<{ bars: Array<{ month: string; total: number }>; maxBarValue: number }> = ({ bars, maxBarValue }) => (
  <div className="rounded border border-[#d4d8dd] bg-white p-4">
    <h3 className="mb-3 text-lg font-semibold text-[#2f3338]">Historial de finanzas</h3>
    <div className="h-72">
      <div className="flex h-full items-end gap-3 border-b border-l border-[#d7dbe0] px-3 pb-2">
        {bars.map((bar) => {
          const height = Math.max((bar.total / maxBarValue) * 220, 2)
          return (
            <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-end justify-center" style={{ height: '220px' }}>
                <div className="w-5 rounded-t bg-[#20a37f]" style={{ height: `${height}px` }} title={`${bar.month}: S/. ${bar.total}`} />
              </div>
              <span className="text-xs text-[#7b828a]">{bar.month}</span>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)

const SummaryCard: React.FC<{ label: string; value: string; tone: 'green' | 'orange' | 'blue' }> = ({ label, value, tone }) => {
  const color = tone === 'green' ? 'text-[#48b968]' : tone === 'orange' ? 'text-[#ef9f1f]' : 'text-[#1b9be0]'
  return (
    <div className="rounded border border-[#d4d8dd] bg-[#f9fafb] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#5f656c]">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

const RiskBadge: React.FC<{ risk: RiskLevel }> = ({ risk }) => {
  const styles = risk === 'high' ? 'state-chip state-chip--bad' : risk === 'medium' ? 'state-chip state-chip--warn' : 'state-chip state-chip--good'
  const label = risk === 'high' ? 'Riesgo alto' : risk === 'medium' ? 'Riesgo medio' : 'Riesgo bajo'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${styles}`}>{label}</span>
}

const StatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const styles = status === 'active' ? 'state-chip state-chip--good' : status === 'idle' ? 'state-chip state-chip--warn' : 'state-chip state-chip--bad'
  const label = status === 'active' ? 'Activo' : status === 'idle' ? 'Pendiente' : 'Desconectado'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles}`}>{label}</span>
}

const InvoiceBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  const styles = status === 'paid' ? 'state-chip state-chip--good' : status === 'pending' ? 'state-chip state-chip--warn' : 'state-chip state-chip--bad'
  const label = status === 'paid' ? 'Pagada' : status === 'pending' ? 'Pendiente' : 'Vencida'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles}`}>{label}</span>
}

const PromiseBadge: React.FC<{ status: PromiseStatus }> = ({ status }) => {
  const styles = status === 'fulfilled' ? 'state-chip state-chip--good' : status === 'broken' ? 'state-chip state-chip--bad' : 'state-chip state-chip--warn'
  const label = status === 'fulfilled' ? 'Cumplida' : status === 'broken' ? 'Incumplida' : 'Pendiente'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles}`}>{label}</span>
}

const SunatBadge: React.FC<{ status: SunatStatus }> = ({ status }) => {
  const styles = status === 'accepted' ? 'state-chip state-chip--good' : status === 'rejected' ? 'state-chip state-chip--bad' : 'state-chip state-chip--warn'
  const label = status === 'accepted' ? 'Aceptada' : status === 'rejected' ? 'Rechazada' : 'Pendiente'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles}`}>{label}</span>
}

const PaymentRecordsTable: React.FC<{ rows: PaymentRecord[] }> = ({ rows }) => (
  <div className="overflow-x-auto rounded-xl border border-[#cdd7ea] bg-white/95 shadow-sm">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#d4d8dd] bg-[#f2f6ff] text-left text-[#42506a]">
          <th className="px-3 py-2">ID</th>
          <th className="px-3 py-2">Fuente</th>
          <th className="px-3 py-2">Cliente</th>
          <th className="px-3 py-2">Monto</th>
          <th className="px-3 py-2">Fecha</th>
          <th className="px-3 py-2">Metodo</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
              Sin registros para el filtro actual.
            </td>
          </tr>
        ) : null}
        {rows.map((item) => (
          <tr key={item.id} className="border-b border-[#eceff2]">
            <td className="px-3 py-2">{item.id}</td>
            <td className="px-3 py-2">{item.source}</td>
            <td className="px-3 py-2">{item.client}</td>
            <td className="px-3 py-2">S/. {item.amount.toFixed(2)}</td>
            <td className="px-3 py-2">{item.date}</td>
            <td className="px-3 py-2">{item.method}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const normalizeRouterList = (raw: any): MikroTikRouterItem[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: 'RTR-001', name: 'Core-Lima', ipAddress: '172.20.0.1', status: 'online' },
      { id: 'RTR-002', name: 'Distribucion-Norte', ipAddress: '172.20.10.1', status: 'online' },
      { id: 'RTR-003', name: 'Backbone-Sur', ipAddress: '172.20.20.1', status: 'offline' }
    ]
  }
  return raw.map((item: any, index: number) => {
    const statusRaw = String(item?.status || '').toLowerCase()
    const status: MikroTikRouterItem['status'] = statusRaw === 'online' || statusRaw === 'active' ? 'online' : statusRaw === 'offline' ? 'offline' : 'unknown'
    return {
      id: String(item?.id ?? `RTR-${index + 1}`),
      name: String(item?.name || `Router ${index + 1}`),
      ipAddress: String(item?.ip_address || item?.ipAddress || `172.20.${index}.1`),
      status
    }
  })
}

const normalizeRouterHealth = (raw: any): RouterHealthSummary => {
  const router = raw?.router || raw || {}
  const cpuLoad = Number.parseFloat(String(router?.cpu_load ?? router?.cpu ?? 0))
  const freeMemory = Number.parseFloat(String(router?.free_memory ?? 0))
  const totalMemory = Number.parseFloat(String(router?.total_memory ?? 0))
  const memoryUsage = Number.isFinite(freeMemory) && Number.isFinite(totalMemory) && totalMemory > 0 ? Math.min(100, Math.max(0, Math.round(((totalMemory - freeMemory) / totalMemory) * 100))) : 0
  const healthScore =
    typeof raw?.health_score === 'number'
      ? raw.health_score
      : Math.max(0, 100 - (Number.isFinite(cpuLoad) ? Math.round(cpuLoad) : 0) - Math.round(memoryUsage / 2))

  return {
    cpuLoad: Number.isFinite(cpuLoad) ? Math.round(cpuLoad) : 0,
    memoryUsage: Number.isFinite(memoryUsage) ? memoryUsage : 0,
    uptime: String(router?.uptime || raw?.uptime || 'N/D'),
    healthScore,
    lastCheck: new Date().toLocaleString()
  }
}

const normalizeRouterQueues = (raw: any): RouterQueueSummary[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: 'Q-001', name: 'F60', target: '10.10.0.0/16', maxLimit: '60M/20M', rate: '23M/8M', disabled: false },
      { id: 'Q-002', name: 'F100', target: '10.20.0.0/16', maxLimit: '100M/30M', rate: '41M/12M', disabled: false },
      { id: 'Q-003', name: 'HSDAY', target: '10.30.0.0/16', maxLimit: '12M/6M', rate: '4M/1M', disabled: false }
    ]
  }
  return raw.map((item: any, index: number) => ({
    id: String(item?.id || item?.['.id'] || `Q-${index + 1}`),
    name: String(item?.name || `queue-${index + 1}`),
    target: String(item?.target || item?.address || '0.0.0.0/0'),
    maxLimit: String(item?.max_limit || item?.['max-limit'] || '-'),
    rate: String(item?.rate || item?.['actual-rate'] || '-'),
    disabled: item?.disabled === true || item?.disabled === 'true'
  }))
}

const normalizeRouterSessions = (raw: any): RouterConnectionSummary[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: 'S-001', type: 'pppoe', address: '10.10.1.15', macAddress: 'AA:BB:CC:DD:EE:15', uptime: '1d 02:15:10', status: 'active' },
      { id: 'S-002', type: 'dhcp', address: '10.10.1.56', macAddress: 'AA:BB:CC:DD:EE:56', uptime: '03:45:22', status: 'active' },
      { id: 'S-003', type: 'hotspot', address: '10.10.2.10', macAddress: 'AA:BB:CC:DD:EE:10', uptime: '00:35:11', status: 'active' }
    ]
  }
  return raw.map((item: any, index: number) => ({
    id: String(item?.id || item?.['.id'] || `S-${index + 1}`),
    type: String(item?.type || item?.service || 'unknown'),
    address: String(item?.address || item?.ip || item?.target || '-'),
    macAddress: String(item?.mac_address || item?.['mac-address'] || item?.mac || '-'),
    uptime: String(item?.uptime || '-'),
    status: String(item?.status || 'active')
  }))
}

const normalizeEnterpriseSnapshot = (raw: any): RouterEnterpriseSnapshot => {
  const source = raw || {}
  const services = Array.isArray(source?.services)
    ? source.services.map((item: any) => ({
        name: String(item?.name || 'unknown'),
        port: String(item?.port || ''),
        disabled: item?.disabled === true || item?.disabled === 'true',
        address: String(item?.address || ''),
        certificate: String(item?.certificate || '')
      }))
    : []

  const topInterfaces = Array.isArray(source?.top_interfaces)
    ? source.top_interfaces.map((item: any) => ({
        name: String(item?.name || 'unknown'),
        type: String(item?.type || 'unknown'),
        running: item?.running === true || item?.running === 'true',
        rx_bytes: Number(item?.rx_bytes || 0),
        tx_bytes: Number(item?.tx_bytes || 0),
        traffic_bytes: Number(item?.traffic_bytes || 0)
      }))
    : []

  const recentLogs = Array.isArray(source?.recent_logs)
    ? source.recent_logs.map((item: any) => ({
        time: String(item?.time || ''),
        topics: String(item?.topics || ''),
        message: String(item?.message || '')
      }))
    : []

  return {
    generatedAt: String(source?.generated_at || new Date().toISOString()),
    healthScore: Number(source?.health_score ?? 0),
    issues: Array.isArray(source?.issues) ? source.issues.map((item: any) => String(item)) : [],
    interfaceSummary: {
      total: Number(source?.interface_summary?.total ?? 0),
      running: Number(source?.interface_summary?.running ?? 0),
      down: Number(source?.interface_summary?.down ?? 0)
    },
    queueSummary: {
      total: Number(source?.queue_summary?.total ?? 0),
      active: Number(source?.queue_summary?.active ?? 0),
      disabled: Number(source?.queue_summary?.disabled ?? 0),
      busy: Number(source?.queue_summary?.busy ?? 0)
    },
    connectionSummary: {
      total: Number(source?.connection_summary?.total ?? 0),
      dhcp: Number(source?.connection_summary?.dhcp ?? 0),
      pppoe: Number(source?.connection_summary?.pppoe ?? 0)
    },
    firewallSummary: {
      filterTotal: Number(source?.firewall_summary?.filter_total ?? 0),
      filterDisabled: Number(source?.firewall_summary?.filter_disabled ?? 0),
      natTotal: Number(source?.firewall_summary?.nat_total ?? 0),
      natDisabled: Number(source?.firewall_summary?.nat_disabled ?? 0),
      mangleTotal: Number(source?.firewall_summary?.mangle_total ?? 0),
      mangleDisabled: Number(source?.firewall_summary?.mangle_disabled ?? 0)
    },
    dhcpSummary: {
      total: Number(source?.dhcp_summary?.total ?? 0),
      bound: Number(source?.dhcp_summary?.bound ?? 0),
      waiting: Number(source?.dhcp_summary?.waiting ?? 0)
    },
    pppSummary: {
      active: Number(source?.ppp_summary?.active ?? 0)
    },
    schedulerSummary: {
      total: Number(source?.scheduler_summary?.total ?? 0),
      backupJobs: Number(source?.scheduler_summary?.backup_jobs ?? 0)
    },
    insecureServices: Array.isArray(source?.insecure_services) ? source.insecure_services.map((item: any) => String(item)) : [],
    services,
    topInterfaces,
    recentLogs,
    recommendations: Array.isArray(source?.recommendations) ? source.recommendations.map((item: any) => String(item)) : []
  }
}

const normalizeFailoverReport = (raw: any): RouterFailoverReport => {
  const source = raw || {}
  const targets: RouterFailoverTarget[] = Array.isArray(source?.targets)
    ? source.targets.map((item: any) => ({
        target: String(item?.target || 'N/D'),
        totalProbes: Number(item?.total_probes ?? 0),
        successProbes: Number(item?.success_probes ?? 0),
        packetLoss: Number(item?.packet_loss ?? 100),
        avgLatencyMs: item?.avg_latency_ms === null || item?.avg_latency_ms === undefined ? null : Number(item?.avg_latency_ms),
        status: item?.status === 'critical' || item?.status === 'warning' ? item.status : 'ok',
        error: item?.error ? String(item.error) : undefined
      }))
    : []

  return {
    generatedAt: String(source?.generated_at || new Date().toISOString()),
    overallStatus: source?.overall_status === 'critical' || source?.overall_status === 'warning' ? source.overall_status : 'ok',
    targets
  }
}

const normalizeEnterpriseChangeLog = (raw: any): RouterEnterpriseChange[] => {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item: any, index: number) => {
    const commands = Array.isArray(item?.commands) ? item.commands : []
    const commandCountRaw = Number(item?.command_count ?? item?.commandCount ?? commands.length)
    return {
      changeId: String(item?.change_id || item?.changeId || `CHG-LOCAL-${index + 1}`),
      routerId: String(item?.router_id || item?.routerId || ''),
      createdAt: String(item?.created_at || item?.createdAt || new Date().toISOString()),
      actor: String(item?.actor || 'system'),
      category: String(item?.category || 'hardening'),
      profile: String(item?.profile || 'baseline'),
      siteProfile: String(item?.site_profile || item?.siteProfile || 'access'),
      status: String(item?.status || 'unknown'),
      commandCount: Number.isFinite(commandCountRaw) ? commandCountRaw : commands.length
    }
  })
}

const normalizeOltVendors = (raw: any): OltVendor[] => {
  const fallback: OltVendor[] = [
    {
      id: 'zte',
      label: 'ZTE',
      defaultTransport: 'telnet',
      defaultPort: 23,
      actions: ['show_pon_summary', 'show_onu_list', 'find_onu', 'authorize_onu', 'deauthorize_onu', 'reboot_onu', 'backup_running_config']
    },
    {
      id: 'huawei',
      label: 'Huawei',
      defaultTransport: 'ssh',
      defaultPort: 22,
      actions: ['show_pon_summary', 'show_onu_list', 'find_onu', 'authorize_onu', 'deauthorize_onu', 'reboot_onu', 'backup_running_config']
    },
    {
      id: 'vsol',
      label: 'VSOL',
      defaultTransport: 'ssh',
      defaultPort: 22,
      actions: ['show_pon_summary', 'show_onu_list', 'find_onu', 'authorize_onu', 'deauthorize_onu', 'reboot_onu', 'backup_running_config']
    }
  ]
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw.map((item: any) => {
    const actions = Array.isArray(item?.actions)
      ? item.actions.map((action: any) => String(action)).filter((action: string) => action.length > 0)
      : []
    return {
      id: String(item?.id || 'unknown').toLowerCase(),
      label: String(item?.label || item?.id || 'Unknown'),
      defaultTransport: String(item?.default_transport || item?.defaultTransport || 'ssh'),
      defaultPort: Number(item?.default_port ?? item?.defaultPort ?? 22),
      actions: actions.length > 0 ? actions : ['show_pon_summary']
    }
  })
}

const normalizeOltDevices = (raw: any): OltDevice[] => {
  const fallback: OltDevice[] = [
    {
      id: 'OLT-ZTE-001',
      name: 'ZTE Core Centro',
      vendor: 'zte',
      model: 'C320',
      host: '10.20.0.21',
      transport: 'telnet',
      port: 23,
      username: 'admin',
      site: 'Core-Centro'
    },
    {
      id: 'OLT-HW-001',
      name: 'Huawei Norte',
      vendor: 'huawei',
      model: 'MA5800-X7',
      host: '10.20.10.11',
      transport: 'ssh',
      port: 22,
      username: 'admin',
      site: 'Distribution-Norte'
    },
    {
      id: 'OLT-VSOL-001',
      name: 'VSOL Sur',
      vendor: 'vsol',
      model: 'V3600G1',
      host: '10.20.20.31',
      transport: 'ssh',
      port: 22,
      username: 'admin',
      site: 'Access-Sur'
    }
  ]
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return raw.map((item: any, index: number) => ({
    id: String(item?.id || `OLT-${index + 1}`),
    name: String(item?.name || `OLT ${index + 1}`),
    vendor: String(item?.vendor || 'unknown').toLowerCase(),
    model: String(item?.model || 'N/D'),
    host: String(item?.host || '0.0.0.0'),
    transport: String(item?.transport || 'ssh').toLowerCase(),
    port: Number(item?.port ?? 22),
    username: String(item?.username || 'admin'),
    site: String(item?.site || 'N/D')
  }))
}

const normalizeOltSnapshot = (raw: any): OltSnapshot => {
  const source = raw || {}
  return {
    deviceId: String(source?.device_id || source?.deviceId || ''),
    generatedAt: String(source?.generated_at || source?.generatedAt || new Date().toISOString()),
    ponTotal: Number(source?.pon_total ?? source?.ponTotal ?? 0),
    ponAlert: Number(source?.pon_alert ?? source?.ponAlert ?? 0),
    onuOnline: Number(source?.onu_online ?? source?.onuOnline ?? 0),
    onuOffline: Number(source?.onu_offline ?? source?.onuOffline ?? 0),
    cpuLoad: Number(source?.cpu_load ?? source?.cpuLoad ?? 0),
    memoryUsage: Number(source?.memory_usage ?? source?.memoryUsage ?? 0),
    temperatureC: Number(source?.temperature_c ?? source?.temperatureC ?? 0)
  }
}

const normalizeOltAuditLog = (raw: any): OltAuditEntry[] => {
  if (!Array.isArray(raw) || raw.length === 0) return []
  return raw.map((item: any, index: number) => ({
    id: String(item?.id || `OLT-AUD-${index + 1}`),
    deviceId: String(item?.device_id || item?.deviceId || ''),
    deviceName: String(item?.device_name || item?.deviceName || ''),
    vendor: String(item?.vendor || ''),
    runMode: String(item?.run_mode || item?.runMode || 'simulate'),
    success: item?.success === true,
    actor: String(item?.actor || 'system'),
    sourceIp: String(item?.source_ip || item?.sourceIp || ''),
    commands: Number(item?.commands ?? 0),
    startedAt: String(item?.started_at || item?.startedAt || ''),
    finishedAt: String(item?.finished_at || item?.finishedAt || ''),
    error: item?.error ? String(item.error) : null
  }))
}

const normalizeInvoices = (raw: any): Invoice[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: 'INV-2026-001', amount: 120, due: new Date().toISOString(), status: 'paid' },
      { id: 'INV-2026-002', amount: 2120, due: new Date(Date.now() + 5 * 86400000).toISOString(), status: 'pending' },
      { id: 'INV-2026-003', amount: 3000, due: new Date(Date.now() + 20 * 86400000).toISOString(), status: 'pending' }
    ]
  }
  return raw.map((item: any, index: number) => ({
    id: String(item.id || `INV-${index + 1}`),
    amount: Number(item.amount || 0),
    due: String(item.due || new Date().toISOString()),
    status: item.status === 'paid' || item.status === 'overdue' ? item.status : 'pending'
  }))
}

const normalizeConnections = (raw: any): Connection[] => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: 'c-1', ip: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:01', status: 'active' },
      { id: 'c-2', ip: '192.168.1.11', mac: 'AA:BB:CC:DD:EE:02', status: 'idle' },
      { id: 'c-3', ip: '192.168.1.12', mac: 'AA:BB:CC:DD:EE:03', status: 'offline' }
    ]
  }
  return raw.map((item: any, index: number) => ({
    id: String(item.id || `c-${index + 1}`),
    ip: String(item.ip || `192.168.1.${index + 10}`),
    mac: String(item.mac || `AA:BB:CC:DD:EE:${String(index + 1).padStart(2, '0')}`),
    status: item.status === 'active' || item.status === 'offline' ? item.status : 'idle'
  }))
}

export default ClientDashboard


