import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { apiClient } from '../lib/apiClient'

type ClientStatus = 'active' | 'inactive' | 'suspended' | 'past_due' | 'trial' | string

interface Client {
  id: number
  name: string
  ip_address?: string | null
  plan?: string | null
  plan_id?: number | null
  router_id?: number | null
  status: ClientStatus
}

interface Plan {
  id: number
  name: string
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activo' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactivo' },
  suspended: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' },
  past_due: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Mora' },
  trial: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Trial' },
}

const ClientsManagement: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'plan'>('name')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const resp = await apiClient.get('/admin/clients')
        setClients(resp.items || [])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los clientes')
      } finally {
        setLoading(false)
      }
    }
    const loadPlans = async () => {
      try {
        const resp = await apiClient.get('/plans')
        setPlans(resp.items || [])
      } catch {}
    }
    load()
    loadPlans()
  }, [])

  const filteredClients = useMemo(() => {
    return clients
      .filter((c) => {
        const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(c.id).includes(searchTerm)
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'plan':
            return (a.plan || '').localeCompare(b.plan || '')
          case 'name':
          default:
            return (a.name || '').localeCompare(b.name || '')
        }
      })
  }, [clients, searchTerm, filterStatus, sortBy])

  const suspend = async (id: number) => {
    try {
      await apiClient.post(`/admin/clients/${id}/suspend`)
      toast.success('Cliente suspendido')
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'suspended' } : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo suspender')
    }
  }

  const activate = async (id: number) => {
    try {
      await apiClient.post(`/admin/clients/${id}/activate`)
      toast.success('Cliente activado')
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'active' } : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo activar')
    }
  }

  const changeSpeed = async (id: number, planId: number) => {
    try {
      await apiClient.post(`/admin/clients/${id}/speed`, { plan_id: planId })
      const plan = plans.find((p) => p.id === planId)
      toast.success('Velocidad/plan actualizado')
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, plan: plan?.name, plan_id: planId } : c)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar la velocidad')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <PlusIcon className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="past_due">En mora</option>
            <option value="inactive">Inactivos</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Ordenar por: Nombre</option>
            <option value="plan">Ordenar por: Plan</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cliente</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">IP / Router</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Plan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-gray-500 text-sm">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && filteredClients.length > 0 ? (
              filteredClients.map((client, i) => (
                <motion.tr
                  key={client.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {client.name}
                    <div className="text-xs text-gray-500">ID: {client.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{client.ip_address || '—'}</div>
                    <div className="text-xs text-gray-500">Router: {client.router_id ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <select
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                      value={client.plan_id || ''}
                      onChange={(e) => {
                        const pid = Number(e.target.value)
                        if (pid) changeSpeed(client.id, pid)
                      }}
                    >
                      <option value="">{client.plan || 'Seleccionar plan'}</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        statusConfig[client.status]?.bg || 'bg-gray-100'
                      } ${statusConfig[client.status]?.text || 'text-gray-800'}`}
                    >
                      {statusConfig[client.status]?.label || client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => suspend(client.id)}
                      className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs hover:bg-amber-200"
                    >
                      Suspender
                    </button>
                    <button
                      onClick={() => activate(client.id)}
                      className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs hover:bg-emerald-200"
                    >
                      Activar
                    </button>
                  </td>
                </motion.tr>
              ))
            ) : (
              !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron clientes
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 grid grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-600">Total de Clientes</p>
          <p className="text-xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Clientes Activos</p>
          <p className="text-xl font-bold text-green-600">{clients.filter((c) => c.status === 'active').length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Suspendidos</p>
          <p className="text-xl font-bold text-red-600">{clients.filter((c) => c.status === 'suspended').length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Tasa de Actividad</p>
          <p className="text-xl font-bold text-purple-600">
            {clients.length ? Math.round((clients.filter((c) => c.status === 'active').length / clients.length) * 100) : 0}%
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default ClientsManagement
