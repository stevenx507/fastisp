import React, { useEffect, useState } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { apiClient } from "../../lib/apiClient"

interface ClientRow {
  id: number
  name: string
  ip_address?: string
  plan?: string
  status?: string
}

const SearchClients: React.FC = () => {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get("/admin/clients")
      .then((r) => setRows(r.items || []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter((c) =>
    (c.name || "").toLowerCase().includes(query.toLowerCase()) || String(c.id).includes(query)
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        <input
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por nombre, ID o IP"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Cargando...</td></tr>
            )}
            {!loading && filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-semibold">{c.id}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2">{c.ip_address || "—"}</td>
                <td className="px-3 py-2">{c.plan || "—"}</td>
                <td className="px-3 py-2 capitalize">{c.status || "—"}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SearchClients
