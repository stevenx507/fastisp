import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  WifiIcon,
  GlobeAltIcon,
  CreditCardIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
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
  download_speed?: number
  upload_speed?: number
}

interface Router {
  id: number
  name: string
  ip_address?: string
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
  const [routers, setRouters] = useState<Router[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'plan'>('name')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    plan_id: '',
    router_id: '',
    ip_address: '',
    connection_type: 'pppoe',
    pppoe_username: '',
    pppoe_password: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [cResp, pResp, rResp] = await Promise.allSettled([
        apiClient.get('/admin/clients'),
        apiClient.get('/plans'),
        apiClient.get('/mikrotik/routers'),
      ])
      if (cResp.status === 'fulfilled') setClients(cResp.value.items || [])
      if (pResp.status === 'fulfilled') setPlans(pResp.value.items || [])
      if (rResp.status === 'fulfilled') setRouters(rResp.value.routers || rResp.value.items || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
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

  const submitClient = async () => {
    if (!form.name || !form.plan_id) {
      toast.error('Nombre y plan son obligatorios')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        plan_id: Number(form.plan_id),
        router_id: form.router_id ? Number(form.router_id) : undefined,
        ip_address: form.ip_address || undefined,
        connection_type: form.connection_type,
        pppoe_username: form.pppoe_username || undefined,
        pppoe_password: form.pppoe_password || undefined,
      }
      const resp = await apiClient.post('/admin/clients', payload)
      setClients((prev) => [...prev, resp.client as Client])
      toast.success('Cliente creado')
      setShowModal(false)
      setForm({
        name: '',
        plan_id: '',
        router_id: '',
        ip_address: '',
        connection_type: 'pppoe',
        pppoe_username: '',
        pppoe_password: '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase font-semibold text-blue-600">Clientes</p>
            <h2 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h2>
            <p className="text-sm text-gray-500">Alta rápida, asignación de plan y router, suspensión/activación.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar nombre o ID..."
                className="pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <PlusIcon className="h-5 w-5" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="past_due">En mora</option>
            <option value="inactive">Inactivos</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'plan')}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
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
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
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

      {/* Modal create client */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-xs uppercase font-semibold text-blue-600">Nuevo cliente</p>
                <h3 className="text-xl font-bold text-gray-900">Datos rápidos</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Nombre completo</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                />

                <label className="block text-sm font-semibold text-gray-800 mt-4">Plan</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                >
                  <option value="">Seleccionar plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.download_speed ? `(${p.download_speed} / ${p.upload_speed} Mbps)` : ''}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-semibold text-gray-800 mt-4">Router</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={form.router_id}
                  onChange={(e) => setForm({ ...form, router_id: e.target.value })}
                >
                  <option value="">Sin router</option>
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.ip_address ? `(${r.ip_address})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800">Tipo de conexión</label>
                <div className="grid grid-cols-3 gap-2">
                  {['pppoe', 'dhcp', 'static'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, connection_type: type })}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                        form.connection_type === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      type="button"
                    >
                      {type === 'pppoe' ? <WifiIcon className="h-4 w-4" /> : <GlobeAltIcon className="h-4 w-4" />}
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-semibold text-gray-800 mt-4">IP del cliente</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={form.ip_address}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                  placeholder="10.0.0.51"
                />

                {form.connection_type === 'pppoe' && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800">Usuario PPPoE</label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        value={form.pppoe_username}
                        onChange={(e) => setForm({ ...form, pppoe_username: e.target.value })}
                        placeholder="cliente01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800">Password PPPoE</label>
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        value={form.pppoe_password}
                        onChange={(e) => setForm({ ...form, pppoe_password: e.target.value })}
                        placeholder="********"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                  <CreditCardIcon className="h-4 w-4" />
                  Facturación del cliente se configura desde el módulo de planes.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={submitClient}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default ClientsManagement
