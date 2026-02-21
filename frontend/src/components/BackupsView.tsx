import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { apiClient } from '../lib/apiClient'
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

type BackupFile = { name: string; size: number; modified: string }

const BackupsView: React.FC = () => {
  const [items, setItems] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const resp = await apiClient.get('/admin/backups/list')
      setItems(resp.items || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los backups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const triggerDb = async () => {
    try {
      await apiClient.post('/admin/backups/db')
      toast.success('Backup de DB generado')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar backup')
    }
  }

  const formatSize = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Backups</h2>
        <div className="flex gap-2">
          <button
            onClick={triggerDb}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400"
          >
            Backup DB ahora
          </button>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-white/10 text-slate-100 hover:bg-white/20"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/70 shadow-xl">
        <table className="w-full text-slate-100">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Tamaño</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Modificado</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-sm text-slate-300">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-slate-300 text-center">
                  No hay backups aún.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((f, i) => (
                <motion.tr key={f.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <td className="px-4 py-3 text-sm">{f.name}</td>
                  <td className="px-4 py-3 text-sm">{formatSize(f.size)}</td>
                  <td className="px-4 py-3 text-sm">{new Date(f.modified).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <a
                      href={`/api/admin/backups/download?name=${encodeURIComponent(f.name)}`}
                      className="inline-flex items-center gap-1 text-cyan-300 hover:text-white text-sm"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Descargar
                    </a>
                  </td>
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

export default BackupsView
