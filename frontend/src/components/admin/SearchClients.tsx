import React, { useEffect, useMemo, useState } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { apiClient } from "../../lib/apiClient"

interface ClientRow {
  id: number
  name: string
  ip_address?: string
  plan?: string
  status?: string
  email?: string
  portal_access?: boolean
}

const SearchClients: React.FC = () => {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [runningBulk, setRunningBulk] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [feedback, setFeedback] = useState("")

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      const endpoint = params.toString() ? `/admin/clients?${params.toString()}` : "/admin/clients"
      const response = (await apiClient.get(endpoint)) as { items?: ClientRow[] }
      setRows((response.items || []) as ClientRow[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [statusFilter])

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        const token = query.toLowerCase().trim()
        if (!token) return true
        return (
          (c.name || "").toLowerCase().includes(token) ||
          String(c.id).includes(token) ||
          (c.ip_address || "").toLowerCase().includes(token) ||
          (c.email || "").toLowerCase().includes(token)
        )
      }),
    [rows, query]
  )

  const allFilteredSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id))

  const toggleRow = (clientId: number) => {
    setSelectedIds((prev) => (prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]))
  }

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filtered.some((row) => row.id === id))
      }
      const merged = new Set(prev)
      filtered.forEach((row) => merged.add(row.id))
      return Array.from(merged.values())
    })
  }

  const runBulkAction = async (action: "suspend" | "activate") => {
    if (selectedIds.length === 0) {
      setFeedback("Selecciona al menos un cliente.")
      return
    }
    setRunningBulk(true)
    setFeedback("")
    try {
      const response = (await apiClient.post("/admin/clients/bulk-action", {
        action,
        client_ids: selectedIds,
      })) as { success_count?: number; failed_count?: number }
      await loadRows()
      setSelectedIds([])
      setFeedback(
        `${action === "suspend" ? "Suspension" : "Reactivacion"} masiva completada: ${Number(
          response.success_count || 0
        )} OK, ${Number(response.failed_count || 0)} fallidos.`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo ejecutar la accion masiva."
      setFeedback(message)
    } finally {
      setRunningBulk(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    setFeedback("")
    try {
      const params = new URLSearchParams({ format: "csv" })
      if (query.trim()) params.set("q", query.trim())
      if (statusFilter) params.set("status", statusFilter)
      const csv = (await apiClient.get(`/admin/clients/export?${params.toString()}`)) as string
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `clientes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
      setFeedback("Exportacion CSV lista.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo exportar CSV."
      setFeedback(message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            <input
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar por nombre, ID, IP o email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="past_due">Mora</option>
            <option value="suspended">Suspendidos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runBulkAction("suspend")}
            disabled={runningBulk || selectedIds.length === 0}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Suspender seleccionados ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={() => runBulkAction("activate")}
            disabled={runningBulk || selectedIds.length === 0}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reactivar seleccionados ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || loading}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar CSV
          </button>
          {feedback && <span className="text-sm text-slate-600">{feedback}</span>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
              </th>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Portal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleRow(c.id)} />
                  </td>
                  <td className="px-3 py-2 font-semibold">{c.id}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.email || "-"}</td>
                  <td className="px-3 py-2">{c.ip_address || "-"}</td>
                  <td className="px-3 py-2">{c.plan || "-"}</td>
                  <td className="px-3 py-2 capitalize">{c.status || "-"}</td>
                  <td className="px-3 py-2">{c.portal_access ? "Si" : "No"}</td>
                </tr>
              ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SearchClients
