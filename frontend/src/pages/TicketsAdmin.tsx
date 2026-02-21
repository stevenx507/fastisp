import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { apiClient } from '../lib/apiClient'

interface Ticket {
  id: number
  subject: string
  description: string
  status: string
  priority: string
  assigned_to?: string
  sla_due_at?: string
  created_at?: string
}

interface Comment {
  id: number
  ticket_id: number
  comment: string
  author?: string
  created_at?: string
}

const statusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
}

const TicketsAdmin: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [newComment, setNewComment] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/tickets')
      setTickets(res.items || [])
    } catch (err) {
      toast.error('No se pudieron cargar tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const loadComments = async (ticketId: number) => {
    try {
      // Backend no tiene endpoint de list; usamos los que tenemos
      // placeholder: comments se cargan cuando se crean
      setComments((prev) => ({ ...prev, [ticketId]: prev[ticketId] || [] }))
    } catch (err) {
      console.error(err)
    }
  }

  const updateTicket = async (updates: Partial<Ticket>) => {
    if (!selected) return
    try {
      const res = await apiClient.patch(`/tickets/${selected.id}`, updates)
      toast.success('Ticket actualizado')
      setSelected(res.ticket)
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)))
    } catch (err) {
      toast.error('No se pudo actualizar ticket')
    }
  }

  const addComment = async () => {
    if (!selected || !newComment.trim()) return
    try {
      const res = await apiClient.post(`/tickets/${selected.id}/comments`, { comment: newComment })
      setComments((prev) => ({
        ...prev,
        [selected.id]: [res.comment, ...(prev[selected.id] || [])],
      }))
      setNewComment('')
      toast.success('Comentario agregado')
    } catch (err) {
      toast.error('No se pudo agregar comentario')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600">Administra SLA, estados y asignaciones.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-6 px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">
            <span>ID</span>
            <span>Asunto</span>
            <span>Prioridad</span>
            <span>Estado</span>
            <span>SLA</span>
            <span>Asignado</span>
          </div>
          <div className="divide-y divide-gray-100">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelected(t); loadComments(t.id) }}
                className="w-full text-left"
              >
                <motion.div className="grid grid-cols-6 px-4 py-3 hover:bg-gray-50">
                  <span className="font-mono text-sm text-gray-900">{t.id}</span>
                  <span className="text-sm text-gray-900 truncate">{t.subject}</span>
                  <span className="text-xs font-semibold text-gray-700">{t.priority}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[t.status] || 'bg-gray-100 text-gray-700'}`}>{t.status}</span>
                  <span className="text-xs text-gray-600">{t.sla_due_at ? t.sla_due_at.split('T')[0] : '-'}</span>
                  <span className="text-sm text-gray-700">{t.assigned_to || '-'}</span>
                </motion.div>
              </button>
            ))}
            {!tickets.length && <div className="px-4 py-6 text-center text-gray-500">Sin tickets</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
          {selected ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ticket #{selected.id}</h3>
              <p className="text-sm text-gray-700 mb-2">{selected.subject}</p>
              <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{selected.description}</p>

              <div className="space-y-2 mb-4">
                <label className="text-xs text-gray-600">Estado</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={selected.status}
                  onChange={(e) => updateTicket({ status: e.target.value })}
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </select>
                <label className="text-xs text-gray-600">Prioridad</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={selected.priority}
                  onChange={(e) => updateTicket({ priority: e.target.value })}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <label className="text-xs text-gray-600">Asignado a</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="técnico@isp.com"
                  value={selected.assigned_to || ''}
                  onChange={(e) => updateTicket({ assigned_to: e.target.value })}
                />
                <label className="text-xs text-gray-600">SLA (ISO)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="2026-02-22T12:00:00"
                  value={selected.sla_due_at || ''}
                  onChange={(e) => updateTicket({ sla_due_at: e.target.value })}
                />
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Comentarios</h4>
                <div className="space-y-2 max-h-40 overflow-auto mb-2">
                  {(comments[selected.id] || []).map((c) => (
                    <div key={c.id} className="text-sm text-gray-700 border rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-500 mb-1">{c.author || 'usuario'} · {c.created_at?.replace('T', ' ').slice(0,16)}</div>
                      <div>{c.comment}</div>
                    </div>
                  ))}
                  {!comments[selected.id]?.length && <div className="text-xs text-gray-500">Sin comentarios</div>}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2"
                    placeholder="Agregar comentario"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button onClick={addComment} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Enviar</button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">Selecciona un ticket para ver detalles.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketsAdmin
