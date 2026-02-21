import React, { useState, Fragment, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Dialog, Transition, Menu } from '@headlessui/react'
import {
  ChartBarIcon,
  CreditCardIcon,
  WifiIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  ArrowLeftOnRectangleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'

const tabs = [
  { id: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  { id: 'billing', name: 'Facturación', path: '/dashboard/billing', icon: CreditCardIcon },
  { id: 'usage', name: 'Uso Detallado', path: '/dashboard/usage', icon: WifiIcon },
  { id: 'support', name: 'Soporte', path: '/dashboard/support', icon: ChatBubbleLeftRightIcon },
  { id: 'profile', name: 'Mi Perfil', path: '/dashboard/profile', icon: UserCircleIcon }
]

const notifications = [
  { id: 1, message: 'Tu factura de Junio está lista para pagar.', time: 'Hace 5 minutos', read: false, href: '/dashboard/billing' },
  { id: 2, message: 'Mantenimiento programado para esta noche a las 2 AM.', time: 'Hace 2 horas', read: false, href: '#' },
  { id: 3, message: '¡Nueva promoción de velocidad disponible!', time: 'Ayer', read: true, href: '#' },
]

interface AppLayoutProps {
  children?: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [serviceActive, setServiceActive] = useState(false)
  const unreadNotifications = notifications.filter(n => !n.read).length

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavigationLinks: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => (
    <nav className={isMobile ? 'space-y-1 px-2' : 'flex-1 space-y-1 px-2 pb-4'}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.name}
          to={tab.path}
          end={tab.path === '/dashboard'}
          onClick={() => isMobile && setSidebarOpen(false)}
          className={({ isActive }) =>
            `group flex items-center rounded-md px-2 py-2 text-sm font-medium ${
              isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
              {tab.name}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const res = await fetch('/api/health')
        if (!mounted) return
        setServiceActive(res.ok)
      } catch (e) {
        if (mounted) setServiceActive(false)
      }
    }
    check()
    const id = setInterval(check, 15000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#071327,_#0b1221)] text-gray-100">
        {/* Mobile sidebar */}
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-40 md:hidden" onClose={setSidebarOpen}>
            <Transition.Child as={Fragment} enter="transition-opacity ease-linear duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity ease-linear duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </Transition.Child>
            <div className="fixed inset-0 z-40 flex">
              <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
                <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-[rgba(255,255,255,0.02)] pt-5 pb-4 card">
                  <Transition.Child as={Fragment} enter="ease-in-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in-out duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                      <button type="button" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick={() => setSidebarOpen(false)}>
                        <XMarkIcon className="h-6 w-6 text-white" />
                      </button>
                    </div>
                  </Transition.Child>
                  <div className="flex flex-shrink-0 items-center px-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">IM</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 ml-3">ISPMAX</h1>
                  </div>
                  <div className="mt-5 h-0 flex-1 overflow-y-auto">
                    <NavigationLinks isMobile />
                  </div>
                </Dialog.Panel>
              </Transition.Child>
              <div className="w-14 flex-shrink-0" />
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
          <div className="flex flex-grow flex-col overflow-y-auto border-r border-transparent bg-[rgba(255,255,255,0.02)] pt-5 card">
            <div className="flex flex-shrink-0 items-center px-4">
               <div className="w-10 h-10 bg-gradient-to-r from-neon-cyan to-violet rounded-xl flex items-center justify-center shadow-md">
                <span className="text-black font-extrabold text-lg">IM</span>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-extrabold text-white tracking-tight">ISPMAX</h1>
                <p className="text-sm text-gray-400">Panel del Cliente</p>
              </div>
            </div>
            <div className="mt-5 flex flex-grow flex-col">
              <NavigationLinks />
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col md:pl-64">
          <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-[rgba(255,255,255,0.02)] backdrop-blur-md shadow-sm">
            <button type="button" className="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden" onClick={() => setSidebarOpen(true)}>
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex flex-1 justify-between px-4">
              <div className="flex flex-1">
                <h1 className="my-auto text-lg font-semibold text-white">
                  {tabs.find(tab => window.location.pathname.includes(tab.path) && tab.path !== '/dashboard')?.name || 'Dashboard'}
                </h1>
              </div>
              <div className="ml-4 flex items-center md:ml-6">
                 <div className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
                  <div className={`${serviceActive ? 'w-2 h-2 bg-green-400 animate-pulse' : 'w-2 h-2 bg-gray-600'} rounded-full`}></div>
                  <span className={`text-sm font-medium ${serviceActive ? 'text-green-300' : 'text-gray-400'}`}>{serviceActive ? 'Servicio Activo' : 'Desconectado'}</span>
                </div>

                {/* Notifications dropdown */}
                <Menu as="div" className="relative ml-3">
                  <Menu.Button className="relative p-1 rounded-full text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:ring-offset-2">
                    <span className="sr-only">Ver notificaciones</span>
                    <BellIcon className="h-6 w-6" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </Menu.Button>
                  <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
                      </div>
                      <div className="py-1 max-h-80 overflow-y-auto">
                        {notifications.map(notification => (
                          <Menu.Item key={notification.id}>
                            {({ active }) => (
                              <a href={notification.href} className={`${active ? 'bg-gray-100' : ''} block px-4 py-3 text-sm text-gray-700`}>
                                <p className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>{notification.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                              </a>
                            )}
                          </Menu.Item>
                        ))}
                      </div>
                      <div className="px-4 py-2 border-t border-gray-200">
                        <a href="#" className="block text-center text-sm font-medium text-blue-600 hover:text-blue-500">
                          Ver todas
                        </a>
                      </div>
                    </Menu.Items>
                  </Transition>
                </Menu>

                {/* Profile dropdown */}
                <Menu as="div" className="relative ml-3">
                  <div>
                    <Menu.Button className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      <span className="sr-only">Abrir menú de usuario</span>
                      <div className="w-10 h-10 bg-gradient-to-r from-neon-cyan to-violet rounded-full flex items-center justify-center shadow-md">
                        <span className="text-gray-900 font-bold">{user && user.name ? user.name.charAt(0).toUpperCase() : ''}</span>
                      </div>
                    </Menu.Button>
                  </div>
                  <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <NavLink to="/dashboard/profile" className={({ isActive: navIsActive }) => `${active || navIsActive ? 'bg-gray-100' : ''} group flex w-full items-center px-4 py-2 text-sm text-gray-700`}>
                              <UserCircleIcon className="mr-2 h-5 w-5 text-gray-500" /> Mi Perfil
                            </NavLink>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button onClick={handleLogout} className={`${active ? 'bg-gray-100' : ''} group flex w-full items-center px-4 py-2 text-sm text-red-600`}>
                              <ArrowLeftOnRectangleIcon className="mr-2 h-5 w-5 text-red-500" />
                              Cerrar Sesión
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </div>

          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                {children || <Outlet />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default AppLayout
