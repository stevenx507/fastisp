import React, { useState, Fragment, useEffect } from 'react'
import { Dialog, Transition, Menu } from '@headlessui/react'
import { 
  ChartBarIcon,
  UserGroupIcon,
  CreditCardIcon,
  WifiIcon,
  CogIcon,
  BellAlertIcon,
  MapIcon,
  ServerIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'
import ProfessionalDashboard from '../components/ProfessionalDashboard'
import ClientsManagement from '../components/ClientsManagement'
import MikroTikManagement from '../components/MikroTikManagement'
import NetworkMap from '../components/NetworkMap'
import BillingManagement from '../components/BillingManagement'
import MonitoringView from '../components/MonitoringView'
import AlertsView from '../components/AlertsView'
import SettingsView from '../components/SettingsView'
import NocDashboard from './NocDashboard'
import TicketsAdmin from './TicketsAdmin'
import PlanChangeModal from '../components/admin/PlanChangeModal'
import ManualPaymentModal from '../components/admin/ManualPaymentModal'

const AdminPanel: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const { logout } = useAuthStore()

  type NotificationType = 'error' | 'warning' | 'info';
  interface Notification {
    id: number;
    message: string;
    time: string;
    read: boolean;
    type: NotificationType;
  }

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, message: 'Router "Principal" tiene CPU alta (85%).', time: 'Hace 2 min', read: false, type: 'error' },
    { id: 2, message: 'Nuevo cliente "Juan Perez" necesita provisiÃ³n.', time: 'Hace 15 min', read: false, type: 'warning' },
    { id: 3, message: 'Backup del sistema completado.', time: 'Hace 1 hora', read: true, type: 'info' },
  ])

  // This useEffect is ready for when you connect to a real API
  useEffect(() => {
    // const fetchNotifications = async () => { ... };
    // fetchNotifications();
  }, [])

  const unreadNotificationsCount = notifications.filter(n => !n.read).length

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'clients', name: 'Clientes', icon: UserGroupIcon },
    { id: 'network', name: 'Gestión MikroTik', icon: WifiIcon },
    { id: 'maps', name: 'Mapa de Red', icon: MapIcon },
    { id: 'billing', name: 'Facturación', icon: CreditCardIcon },
    { id: 'monitoring', name: 'Monitoreo', icon: ServerIcon },
    { id: 'noc', name: 'NOC', icon: ServerIcon },
    { id: 'alerts', name: 'Alertas', icon: BellAlertIcon },
    { id: 'tickets', name: 'Tickets', icon: BellAlertIcon },
    { id: 'settings', name: 'Configuración', icon: CogIcon }
  ]

  const handleMarkAsRead = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const handleClearAll = () => {
    setNotifications([])
  }

  const notificationIcons: { [key in NotificationType]: React.ElementType } = {
    error: ExclamationTriangleIcon,
    warning: InformationCircleIcon,
    info: CheckCircleIcon,
  }

  const notificationIconColors: { [key in NotificationType]: string } = {
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-green-500',
  }

  const NavigationItems: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => (
    <nav className={`mt-5 ${isMobile ? 'px-2 space-y-1' : 'flex-1 px-4 space-y-1'}`}>
      {menuItems.map((item) => (
        <a
          key={item.id}
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setActiveView(item.id)
            if (isMobile) setSidebarOpen(false)
          }}
          className={`group flex items-center w-full rounded-md ${
            isMobile ? 'px-2 py-2 text-base font-medium' : 'px-3 py-2 text-sm font-medium'
          } ${
            activeView === item.id
              ? 'bg-white/10 text-cyan-200'
              : 'text-slate-200 hover:bg-white/5 hover:text-white'
          }`}
        >
          <item.icon className={`mr-3 h-6 w-6 ${isMobile ? '' : 'h-5 w-5'}`} />
          {item.name}
        </a>
      ))}
    </nav>
  )

  const viewComponents: { [key: string]: React.ReactNode } = {
    dashboard: <ProfessionalDashboard />,
    clients: <ClientsManagement />,
    network: <MikroTikManagement />,
    maps: <NetworkMap />,
    billing: (
      <div className="relative space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const idStr = window.prompt('ID del cliente para cambiar plan')
              const parsed = idStr ? parseInt(idStr, 10) : NaN
              if (!parsed) return
              setSelectedClientId(parsed)
              setShowPlanModal(true)
            }}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold hover:bg-cyan-400"
          >
            Cambiar plan
          </button>
        </div>
        <BillingManagement
          mode="admin"
          onSelectInvoice={(id) => {
            setSelectedInvoiceId(id)
            setShowPaymentModal(true)
          }}
        />
      </div>
    ),
    monitoring: <MonitoringView />,
    noc: <NocDashboard />,
    alerts: <AlertsView />,
    tickets: <TicketsAdmin />,
    settings: <SettingsView />,
  }

  return (
    <div className="enterprise-shell min-h-screen text-slate-100">
      {/* Sidebar for Mobile */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child as={Fragment} enter="transition-opacity ease-linear duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity ease-linear duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 z-40 flex">
            <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col enterprise-sidebar pt-5 pb-4 text-slate-100">
                <Transition.Child as={Fragment} enter="ease-in-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in-out duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button 
                      type="button" 
                      title="Cerrar menÃº"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" 
                      onClick={() => setSidebarOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6 text-white" />
                    </button>
                  </div>
                </Transition.Child>
                <div className="flex flex-shrink-0 items-center px-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-lg">IM</span></div>
                  <div className="ml-3"><h1 className="text-lg font-bold text-gray-900">ISPMAX</h1><p className="text-xs text-gray-600">Panel Admin</p></div>
                </div>
                <div className="mt-5 h-0 flex-1 overflow-y-auto">
                  <NavigationItems isMobile />
                </div>
              </Dialog.Panel>
            </Transition.Child>
            <div className="w-14 flex-shrink-0" />
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-grow flex-col overflow-y-auto enterprise-sidebar">
          <div className="flex flex-col flex-shrink-0 pt-5 pb-4">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-lg">IM</span></div>
              <div className="ml-3"><h1 className="text-lg font-bold text-gray-900">ISPMAX</h1><p className="text-xs text-gray-600">Panel Admin</p></div>
            </div>
            <NavigationItems />
          </div>
          <div className="flex-shrink-0 flex border-t border-white/10 p-4">
            <div className="flex items-center w-full">
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin ISP</p>
                <p className="text-xs text-gray-500">admin@ispmax.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col enterprise-main">
        {/* Top navbar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 enterprise-header border-b border-white/10">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Abrir menÃº</span>
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <h2 className="text-lg font-semibold text-gray-900 my-auto">
                {menuItems.find(item => item.id === activeView)?.name}
              </h2>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              {/* Notifications Dropdown */}
              <Menu as="div" className="relative">
                <Menu.Button className="relative p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg">
                  <span className="sr-only">Ver notificaciones</span>
                  <BellAlertIcon className="h-6 w-6" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Menu.Button>
                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-3 border-b flex justify-between items-center">
                      <p className="text-sm font-semibold">Alertas y Notificaciones</p>
                      <div className="flex items-center space-x-2">
                        <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:underline disabled:text-gray-400" disabled={unreadNotificationsCount === 0}>Marcar todas leÃ­das</button>
                        <button onClick={handleClearAll} className="text-xs text-gray-500 hover:underline disabled:text-gray-400" disabled={notifications.length === 0}>Limpiar</button>
                      </div>
                    </div>
                    <div className="py-1 max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? notifications.map(n => {
                      const Icon = notificationIcons[n.type]
                      return (
                        <Menu.Item key={n.id}>
                          {({ active }) => (
                            <a href="#" onClick={(e) => { e.preventDefault(); handleMarkAsRead(n.id); }} className={`${active ? 'bg-white/10' : ''} flex items-start px-4 py-3 text-sm text-slate-100`}>
                              {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-3 flex-shrink-0"></div>}
                              <Icon className={`w-5 h-5 ${notificationIconColors[n.type]} mr-3 flex-shrink-0 mt-0.5 ${n.read ? 'ml-5' : ''}`} />
                              <div className="flex-1">
                                <p className={`font-medium ${!n.read ? 'text-gray-800' : 'text-gray-600'}`}>{n.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{n.time}</p>
                              </div>
                            </a>
                          )}
                        </Menu.Item>
                      );
                    }) : (
                      <div className="text-center text-sm text-gray-500 py-6">No hay notificaciones</div>
                    )}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Profile Dropdown */}
              <Menu as="div" className="relative ml-3">
                <Menu.Button className="flex items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center"><span className="text-white font-bold">A</span></div>
                </Menu.Button>
                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      {({ active }) => (
                        <button onClick={logout} className={`${active ? 'bg-white/10' : ''} group flex w-full items-center px-4 py-2 text-sm text-red-300`}>
                          <ArrowLeftOnRectangleIcon className="mr-2 h-5 w-5 text-red-500" />Cerrar SesiÃ³n
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {viewComponents[activeView] || <div>Vista no encontrada</div>}
            </div>
          </div>
        </main>
      </div>
      <PlanChangeModal
        clientId={selectedClientId || 0}
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onChanged={() => setActiveView('billing')}
      />
      <ManualPaymentModal
        invoiceId={selectedInvoiceId}
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSaved={() => setActiveView('billing')}
      />
    </div>
  )
}

export default AdminPanel













