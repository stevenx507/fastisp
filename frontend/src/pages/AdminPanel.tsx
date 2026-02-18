import React, { Fragment, useMemo, useState } from 'react'
import { Dialog, Menu, Transition } from '@headlessui/react'
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  BellAlertIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  UserGroupIcon,
  WifiIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

type AdminView = 'dashboard' | 'clients' | 'billing' | 'network' | 'monitoring' | 'alerts' | 'settings'
type AlertType = 'error' | 'warning' | 'info'
type ClientStatus = 'active' | 'inactive' | 'suspended'
type RouterStatus = 'online' | 'degraded' | 'offline'
type InvoiceStatus = 'paid' | 'pending' | 'overdue'

interface AlertItem {
  id: number
  type: AlertType
  message: string
  time: string
  read: boolean
}

interface ClientItem {
  id: string
  name: string
  email: string
  plan: string
  status: ClientStatus
}

interface InvoiceItem {
  id: string
  client: string
  amount: number
  dueDate: string
  status: InvoiceStatus
}

interface RouterItem {
  id: string
  name: string
  cpu: number
  memory: number
  status: RouterStatus
}

const menuItems: Array<{ id: AdminView; name: string; icon: React.ElementType }> = [
  { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
  { id: 'clients', name: 'Clientes', icon: UserGroupIcon },
  { id: 'billing', name: 'Facturacion', icon: CreditCardIcon },
  { id: 'network', name: 'Red', icon: WifiIcon },
  { id: 'monitoring', name: 'Monitoreo', icon: ServerIcon },
  { id: 'alerts', name: 'Alertas', icon: ExclamationTriangleIcon },
  { id: 'settings', name: 'Ajustes', icon: Cog6ToothIcon }
]

const AdminPanel: React.FC = () => {
  const { user, logout } = useAuthStore()
  const [activeView, setActiveView] = useState<AdminView>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchClient, setSearchClient] = useState('')
  const [clientFilter, setClientFilter] = useState<'all' | ClientStatus>('all')
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | InvoiceStatus>('all')
  const [settings, setSettings] = useState({
    autoBackup: true,
    notifications: true,
    maintenanceMode: false
  })

  const [alerts, setAlerts] = useState<AlertItem[]>([
    { id: 1, type: 'error', message: 'Router Core con CPU alta (92%).', time: 'Hace 2 min', read: false },
    { id: 2, type: 'warning', message: 'Factura INV-2026-212 vence hoy.', time: 'Hace 17 min', read: false },
    { id: 3, type: 'info', message: 'Backup automatico completado.', time: 'Hace 1 hora', read: true }
  ])

  const [clients, setClients] = useState<ClientItem[]>([
    { id: 'C-001', name: 'Juan Perez', email: 'juan@mail.com', plan: '100 Mbps', status: 'active' },
    { id: 'C-002', name: 'Maria Gomez', email: 'maria@mail.com', plan: '50 Mbps', status: 'inactive' },
    { id: 'C-003', name: 'Carlos Ruiz', email: 'carlos@mail.com', plan: '200 Mbps', status: 'suspended' },
    { id: 'C-004', name: 'Ana Torres', email: 'ana@mail.com', plan: '120 Mbps', status: 'active' }
  ])

  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    { id: 'INV-001', client: 'Juan Perez', amount: 120, dueDate: '2026-02-25', status: 'paid' },
    { id: 'INV-002', client: 'Maria Gomez', amount: 90, dueDate: '2026-02-19', status: 'pending' },
    { id: 'INV-003', client: 'Carlos Ruiz', amount: 180, dueDate: '2026-02-10', status: 'overdue' },
    { id: 'INV-004', client: 'Ana Torres', amount: 150, dueDate: '2026-03-01', status: 'pending' }
  ])

  const [routers, setRouters] = useState<RouterItem[]>([
    { id: 'R-CORE', name: 'Router Core', cpu: 92, memory: 76, status: 'degraded' },
    { id: 'R-NORTE', name: 'Router Norte', cpu: 45, memory: 58, status: 'online' },
    { id: 'R-SUR', name: 'Router Sur', cpu: 62, memory: 67, status: 'online' },
    { id: 'R-OESTE', name: 'Router Oeste', cpu: 15, memory: 31, status: 'offline' }
  ])

  const unreadAlerts = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts])
  const totalBilling = useMemo(() => invoices.reduce((sum, invoice) => sum + invoice.amount, 0), [invoices])
  const pendingBilling = useMemo(
    () => invoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0),
    [invoices]
  )
  const activeClients = useMemo(() => clients.filter((client) => client.status === 'active').length, [clients])
  const onlineRouters = useMemo(() => routers.filter((router) => router.status === 'online').length, [routers])

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchClient.toLowerCase()) ||
        client.email.toLowerCase().includes(searchClient.toLowerCase()) ||
        client.id.toLowerCase().includes(searchClient.toLowerCase())
      const matchesFilter = clientFilter === 'all' || client.status === clientFilter
      return matchesSearch && matchesFilter
    })
  }, [clientFilter, clients, searchClient])

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceFilter === 'all' || invoice.status === invoiceFilter),
    [invoiceFilter, invoices]
  )

  const addClient = () => {
    const next = clients.length + 1
    const newClient: ClientItem = {
      id: `C-${String(next).padStart(3, '0')}`,
      name: `Cliente ${next}`,
      email: `cliente${next}@mail.com`,
      plan: '80 Mbps',
      status: 'active'
    }
    setClients((prev) => [newClient, ...prev])
    toast.success('Cliente agregado.')
  }

  const updateClientStatus = (id: string, status: ClientStatus) => {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, status } : client)))
  }

  const markInvoicePaid = (id: string) => {
    setInvoices((prev) => prev.map((invoice) => (invoice.id === id ? { ...invoice, status: 'paid' } : invoice)))
    toast.success('Factura actualizada.')
  }

  const createInvoice = () => {
    const next = invoices.length + 1
    const newInvoice: InvoiceItem = {
      id: `INV-${String(next).padStart(3, '0')}`,
      client: clients[0]?.name || 'Cliente',
      amount: 120,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'pending'
    }
    setInvoices((prev) => [newInvoice, ...prev])
    toast.success('Factura creada.')
  }

  const toggleRouterStatus = (id: string) => {
    setRouters((prev) =>
      prev.map((router) => {
        if (router.id !== id) return router
        if (router.status === 'offline') return { ...router, status: 'online', cpu: 41, memory: 53 }
        if (router.status === 'online') return { ...router, status: 'degraded', cpu: 86, memory: 80 }
        return { ...router, status: 'offline', cpu: 0, memory: 0 }
      })
    )
  }

  const acknowledgeAlert = (id: number) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === id ? { ...alert, read: true } : alert)))
  }

  const markAllAlertsRead = () => {
    setAlerts((prev) => prev.map((alert) => ({ ...alert, read: true })))
  }

  const clearAlerts = () => {
    setAlerts([])
  }

  const addAlert = () => {
    const nextId = alerts.length + 1
    setAlerts((prev) => [
      {
        id: nextId,
        type: 'info',
        message: `Evento del sistema #${nextId}`,
        time: 'Ahora',
        read: false
      },
      ...prev
    ])
    toast.success('Alerta agregada.')
  }

  const refreshMetrics = () => {
    setRouters((prev) =>
      prev.map((router) => {
        if (router.status === 'offline') return router
        return {
          ...router,
          cpu: Math.max(10, Math.min(98, Math.round(router.cpu + (Math.random() - 0.5) * 18))),
          memory: Math.max(20, Math.min(96, Math.round(router.memory + (Math.random() - 0.5) * 14)))
        }
      })
    )
    toast.success('Metricas actualizadas.')
  }

  const saveSettings = () => {
    toast.success('Ajustes guardados.')
  }

  const handleLogout = () => {
    logout()
  }

  const NavigationItems: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => (
    <nav className={`${mobile ? 'px-2 py-4' : 'px-4 py-4'} space-y-1`}>
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            setActiveView(item.id)
            if (mobile) setSidebarOpen(false)
          }}
          className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition ${
            activeView === item.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <item.icon className="mr-3 h-5 w-5" />
          {item.name}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child as={Fragment} enter="transition-opacity duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>
          <div className="fixed inset-0 z-40 flex">
            <Transition.Child as={Fragment} enter="transition duration-200" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition duration-200" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-white pt-5 shadow-xl">
                <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100">
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center px-4">
                  <div className="h-10 w-10 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white grid place-items-center font-bold">IM</div>
                  <div className="ml-3">
                    <h1 className="text-lg font-bold text-gray-900">ISPMAX</h1>
                    <p className="text-xs text-gray-600">Panel Admin</p>
                  </div>
                </div>
                <NavigationItems mobile />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <aside className="fixed inset-y-0 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="px-4 py-5">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white grid place-items-center font-bold">IM</div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-gray-900">ISPMAX</h1>
              <p className="text-xs text-gray-600">Panel Admin</p>
            </div>
          </div>
        </div>
        <NavigationItems />
        <div className="mt-auto border-t border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">{user?.name || 'Admin ISP'}</p>
          <p className="text-xs text-gray-500">{user?.email || 'admin@ispmax.com'}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-black/10 bg-[#48b968] px-4 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="rounded bg-white/15 p-1.5 lg:hidden">
              <Bars3Icon className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold">{menuItems.find((item) => item.id === activeView)?.name}</p>
          </div>

          <div className="flex items-center gap-3">
            <Menu as="div" className="relative">
              <Menu.Button className="relative rounded p-1 hover:bg-white/10">
                <BellAlertIcon className="h-5 w-5" />
                {unreadAlerts > 0 ? (
                  <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold">{unreadAlerts}</span>
                ) : null}
              </Menu.Button>
              <Transition as={Fragment} enter="transition duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Menu.Items className="absolute right-0 mt-2 w-80 rounded-md bg-white text-gray-700 shadow-lg ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                    <span className="font-semibold text-gray-600">Alertas</span>
                    <div className="flex gap-2">
                      <button onClick={markAllAlertsRead} className="text-blue-600 hover:underline">Marcar todas</button>
                      <button onClick={clearAlerts} className="text-gray-500 hover:underline">Limpiar</button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="px-3 py-5 text-center text-xs text-gray-500">No hay alertas</p>
                    ) : (
                      alerts.map((alert) => (
                        <Menu.Item key={alert.id}>
                          {({ active }) => (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className={`w-full px-3 py-2 text-left ${active ? 'bg-gray-100' : ''}`}
                            >
                              <p className={`text-sm ${alert.read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>{alert.message}</p>
                              <p className="text-xs text-gray-500">{alert.time}</p>
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
              <Menu.Button className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">{user?.email || 'admin@ispmax.com'}</Menu.Button>
              <Transition as={Fragment} enter="transition duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Menu.Items className="absolute right-0 mt-2 w-44 rounded-md bg-white p-1 text-sm text-gray-700 shadow-lg ring-1 ring-black/5">
                  <Menu.Item>
                    {({ active }) => (
                      <button onClick={handleLogout} className={`flex w-full items-center rounded px-3 py-2 ${active ? 'bg-gray-100' : ''}`}>
                        <ArrowLeftOnRectangleIcon className="mr-2 h-4 w-4 text-red-500" />
                        Cerrar sesion
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </header>

        <main className="p-4">
          <div className="mb-4 rounded border border-[#b8d8b6] bg-[#d8ead1] px-4 py-3 text-sm text-[#356438]">
            Sesion iniciada correctamente como <strong>{user?.email || 'admin@ispmax.com'}</strong>.
          </div>

          {activeView === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Clientes activos" value={String(activeClients)} tone="blue" />
                <KpiCard title="Facturacion mensual" value={`$${totalBilling.toFixed(2)}`} tone="green" />
                <KpiCard title="Pendiente de cobro" value={`$${pendingBilling.toFixed(2)}`} tone="orange" />
                <KpiCard title="Routers online" value={`${onlineRouters}/${routers.length}`} tone="purple" />
              </div>

              <div className="rounded border border-[#d4d8dd] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#2f3338]">Acciones rapidas</h3>
                  <button onClick={refreshMetrics} className="rounded border border-[#c8cdd3] px-3 py-1 text-sm hover:bg-gray-50">Refrescar metricas</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <button onClick={addClient} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">Agregar cliente</button>
                  <button onClick={createInvoice} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">Generar factura</button>
                  <button onClick={addAlert} className="rounded bg-[#ef9f1f] px-3 py-2 text-sm font-medium text-white hover:bg-[#dd9012]">Crear alerta</button>
                  <button onClick={closePendingAlertSafe} className="rounded bg-[#f04747] px-3 py-2 text-sm font-medium text-white hover:bg-[#de3d3d]">Resolver alerta</button>
                </div>
              </div>
            </div>
          )}

          {activeView === 'clients' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <div className="mb-4 grid gap-2 md:grid-cols-3">
                <input value={searchClient} onChange={(e) => setSearchClient(e.target.value)} placeholder="Buscar cliente..." className="rounded border border-[#c8cdd3] px-3 py-2 text-sm" />
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value as any)} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm">
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                  <option value="suspended">Suspendidos</option>
                </select>
                <button onClick={addClient} className="rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">Nuevo cliente</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#d4d8dd] bg-[#f7f8f9] text-left text-[#525960]">
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="border-b border-[#eceff2]">
                        <td className="px-3 py-2">{client.id}</td>
                        <td className="px-3 py-2">{client.name}</td>
                        <td className="px-3 py-2">{client.email}</td>
                        <td className="px-3 py-2">{client.plan}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={client.status} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => updateClientStatus(client.id, 'active')} className="rounded border border-[#c8cdd3] px-2 py-1">Act</button>
                            <button onClick={() => updateClientStatus(client.id, 'inactive')} className="rounded border border-[#c8cdd3] px-2 py-1">Ina</button>
                            <button onClick={() => updateClientStatus(client.id, 'suspended')} className="rounded border border-[#c8cdd3] px-2 py-1">Sus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'billing' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-[#2f3338]">Facturas</h3>
                <div className="flex gap-2">
                  <select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value as any)} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm">
                    <option value="all">Todas</option>
                    <option value="paid">Pagadas</option>
                    <option value="pending">Pendientes</option>
                    <option value="overdue">Vencidas</option>
                  </select>
                  <button onClick={createInvoice} className="rounded bg-[#1b9be0] px-3 py-2 text-sm font-medium text-white hover:bg-[#128ace]">Nueva factura</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#d4d8dd] bg-[#f7f8f9] text-left text-[#525960]">
                      <th className="px-3 py-2">Factura</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Monto</th>
                      <th className="px-3 py-2">Vence</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-[#eceff2]">
                        <td className="px-3 py-2">{invoice.id}</td>
                        <td className="px-3 py-2">{invoice.client}</td>
                        <td className="px-3 py-2">${invoice.amount.toFixed(2)}</td>
                        <td className="px-3 py-2">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-3 py-2">
                          {invoice.status !== 'paid' ? (
                            <button onClick={() => markInvoicePaid(invoice.id)} className="rounded bg-[#48b968] px-2 py-1 text-xs font-medium text-white hover:bg-[#3da65b]">
                              Marcar pagada
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
            </div>
          )}

          {activeView === 'network' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold text-[#2f3338]">Estado de routers</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {routers.map((router) => (
                  <div key={router.id} className="rounded border border-[#d4d8dd] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold">{router.name}</p>
                      <StatusBadge status={router.status} />
                    </div>
                    <p className="text-xs text-gray-600">CPU: {router.cpu}%</p>
                    <p className="text-xs text-gray-600">Memoria: {router.memory}%</p>
                    <button onClick={() => toggleRouterStatus(router.id)} className="mt-2 rounded border border-[#c8cdd3] px-2 py-1 text-xs hover:bg-gray-50">
                      Cambiar estado
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'monitoring' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#2f3338]">Monitoreo</h3>
                <button onClick={refreshMetrics} className="rounded border border-[#c8cdd3] px-3 py-1 text-sm hover:bg-gray-50">Refrescar</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {routers.map((router) => (
                  <div key={router.id} className="rounded border border-[#d4d8dd] bg-[#fafbfc] p-3">
                    <p className="font-medium">{router.name}</p>
                    <p className="text-xs text-gray-600">CPU {router.cpu}%</p>
                    <p className="text-xs text-gray-600">MEM {router.memory}%</p>
                    <div className="mt-2 h-2 rounded bg-gray-200">
                      <div className="h-2 rounded bg-[#1b9be0]" style={{ width: `${router.cpu}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'alerts' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#2f3338]">Centro de alertas</h3>
                <div className="flex gap-2">
                  <button onClick={addAlert} className="rounded bg-[#ef9f1f] px-3 py-2 text-sm font-medium text-white hover:bg-[#dd9012]">Nueva alerta</button>
                  <button onClick={markAllAlertsRead} className="rounded border border-[#c8cdd3] px-3 py-2 text-sm hover:bg-gray-50">Marcar leidas</button>
                </div>
              </div>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between rounded border border-[#d4d8dd] p-3">
                    <div>
                      <p className={`text-sm ${alert.read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>{alert.message}</p>
                      <p className="text-xs text-gray-500">{alert.time}</p>
                    </div>
                    <button onClick={() => acknowledgeAlert(alert.id)} className="rounded border border-[#c8cdd3] px-2 py-1 text-xs hover:bg-gray-50">
                      OK
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="rounded border border-[#d4d8dd] bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold text-[#2f3338]">Ajustes del panel</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Toggle label="Auto backup" checked={settings.autoBackup} onChange={(checked) => setSettings((prev) => ({ ...prev, autoBackup: checked }))} />
                <Toggle label="Notificaciones" checked={settings.notifications} onChange={(checked) => setSettings((prev) => ({ ...prev, notifications: checked }))} />
                <Toggle label="Modo mantenimiento" checked={settings.maintenanceMode} onChange={(checked) => setSettings((prev) => ({ ...prev, maintenanceMode: checked }))} />
              </div>
              <button onClick={saveSettings} className="mt-4 rounded bg-[#48b968] px-3 py-2 text-sm font-medium text-white hover:bg-[#3da65b]">
                Guardar configuracion
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )

  function closePendingAlertSafe() {
    const pending = alerts.find((alert) => !alert.read)
    if (!pending) {
      toast('No hay alertas pendientes.')
      return
    }
    acknowledgeAlert(pending.id)
    toast.success('Alerta resuelta.')
  }
}

const KpiCard: React.FC<{ title: string; value: string; tone: 'blue' | 'green' | 'orange' | 'purple' }> = ({ title, value, tone }) => {
  const styles =
    tone === 'blue'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : tone === 'green'
      ? 'text-green-700 bg-green-50 border-green-200'
      : tone === 'orange'
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : 'text-purple-700 bg-purple-50 border-purple-200'
  return (
    <div className={`rounded border p-4 ${styles}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between rounded border border-[#d4d8dd] bg-[#fafbfc] px-3 py-2 text-sm">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>
)

const StatusBadge: React.FC<{ status: ClientStatus | RouterStatus | InvoiceStatus }> = ({ status }) => {
  const styles =
    status === 'active' || status === 'online' || status === 'paid'
      ? 'bg-green-100 text-green-700'
      : status === 'inactive' || status === 'degraded' || status === 'pending'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${styles}`}>{status}</span>
}

export default AdminPanel
