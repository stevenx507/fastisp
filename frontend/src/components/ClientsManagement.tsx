import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlassIcon, PlusIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Client {
  id: string
  name: string
  email: string
  phone: string
  plan: string
  status: 'active' | 'inactive' | 'suspended'
  balance: number
  joinDate: string
  bandwidth: string
}

const ClientsManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'balance'>('name')

  const [clients, setClients] = useState<Client[]>([
    { id: '1', name: 'Juan Pérez', email: 'juan@example.com', phone: '+57 310 123 4567', plan: '100 Mbps', status: 'active', balance: 50000, joinDate: '2024-01-15', bandwidth: '95%' },
    { id: '2', name: 'María García', email: 'maria@example.com', phone: '+57 320 987 6543', plan: '50 Mbps', status: 'active', balance: 0, joinDate: '2024-02-20', bandwidth: '72%' },
    { id: '3', name: 'Carlos López', email: 'carlos@example.com', phone: '+57 300 555 1234', plan: '200 Mbps', status: 'suspended', balance: -120000, joinDate: '2023-11-05', bandwidth: '0%' },
    { id: '4', name: 'Ana Martínez', email: 'ana@example.com', phone: '+57 315 777 8899', plan: '100 Mbps', status: 'active', balance: 100000, joinDate: '2024-01-10', bandwidth: '68%' },
    { id: '5', name: 'Roberto Sánchez', email: 'roberto@example.com', phone: '+57 305 444 2222', plan: '150 Mbps', status: 'active', balance: 25000, joinDate: '2024-03-01', bandwidth: '85%' }
  ])

  const filteredClients = useMemo(() => {
    return clients
      .filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             c.email.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date': return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime()
          case 'balance': return b.balance - a.balance
          case 'name': default: return a.name.localeCompare(b.name)
        }
      })
  }, [clients, searchTerm, filterStatus, sortBy])

  const statusConfig = {
    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activo' },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactivo' },
    suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' }
  }

  const createClient = () => {
    const nextIndex = clients.length + 1
    const newClient: Client = {
      id: String(Date.now()),
      name: `Cliente ${nextIndex}`,
      email: `cliente${nextIndex}@example.com`,
      phone: '+57 300 000 0000',
      plan: '80 Mbps',
      status: 'inactive',
      balance: 0,
      joinDate: new Date().toISOString().slice(0, 10),
      bandwidth: '0%'
    }
    setClients((prev) => [newClient, ...prev])
    toast.success(`Cliente ${newClient.name} agregado.`)
  }

  const rotateStatus = (status: Client['status']): Client['status'] => {
    if (status === 'active') return 'inactive'
    if (status === 'inactive') return 'suspended'
    return 'active'
  }

  const toggleClientStatus = (clientId: string) => {
    let updatedStatus: Client['status'] = 'active'
    setClients((prev) =>
      prev.map((client) => {
        if (client.id !== clientId) return client
        updatedStatus = rotateStatus(client.status)
        return { ...client, status: updatedStatus }
      })
    )
    toast.success(`Estado actualizado a ${statusConfig[updatedStatus].label}.`)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-lg shadow"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
          <button onClick={createClient} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <PlusIcon className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>
        
        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            aria-label="Filtrar por estado"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="suspended">Suspendidos</option>
          </select>
          <select
            aria-label="Ordenar por"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Ordenar por: Nombre</option>
            <option value="date">Ordenar por: Fecha</option>
            <option value="balance">Ordenar por: Balance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cliente</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Contacto</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Plan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Uso</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Balance</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredClients.length > 0 ? (
              filteredClients.map((client, i) => (
                <motion.tr
                  key={client.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{client.email}</div>
                    <div className="text-xs text-gray-500">{client.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{client.plan}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: client.bandwidth}}></div>
                      </div>
                      <span className="text-xs">{client.bandwidth}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <span className={client.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${client.balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[client.status].bg} ${statusConfig[client.status].text}`}>
                      {statusConfig[client.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button 
                      title="Opciones de cliente"
                      onClick={() => toggleClientStatus(client.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                    </button>
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No se encontraron clientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 grid grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-600">Total de Clientes</p>
          <p className="text-xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Clientes Activos</p>
          <p className="text-xl font-bold text-green-600">{clients.filter(c => c.status === 'active').length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Ingresos Potenciales</p>
          <p className="text-xl font-bold text-blue-600">${clients.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Tasa de Actividad</p>
          <p className="text-xl font-bold text-purple-600">{Math.round((clients.filter(c => c.status === 'active').length / clients.length) * 100)}%</p>
        </div>
      </div>
    </motion.div>
  )
}

export default ClientsManagement
