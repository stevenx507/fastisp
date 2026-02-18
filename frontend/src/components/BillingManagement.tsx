import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownTrayIcon, CalendarIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Invoice {
  id: string
  number: string
  client: string
  amount: number
  date: string
  dueDate: string
  status: 'paid' | 'pending' | 'overdue'
}

const BillingManagement: React.FC = () => {
  const [invoices] = useState<Invoice[]>([
    { id: '1', number: 'INV-2024-001', client: 'Juan Pérez', amount: 150000, date: '2024-02-01', dueDate: '2024-02-15', status: 'paid' },
    { id: '2', number: 'INV-2024-002', client: 'María García', amount: 75000, date: '2024-02-05', dueDate: '2024-02-20', status: 'pending' },
    { id: '3', number: 'INV-2024-003', client: 'Carlos López', amount: 200000, date: '2024-01-15', dueDate: '2024-02-01', status: 'overdue' },
    { id: '4', number: 'INV-2024-004', client: 'Ana Martínez', amount: 125000, date: '2024-02-10', dueDate: '2024-02-25', status: 'pending' }
  ])

  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filteredInvoices = invoices.filter(inv =>
    filterStatus === 'all' || inv.status === filterStatus
  )

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const paidRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
  const pendingRevenue = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)

  const statusConfig = {
    paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Pagado' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
    overdue: { bg: 'bg-red-100', text: 'text-red-800', label: 'Vencido' }
  }

  const exportCsv = (rows: Invoice[], fileName: string) => {
    if (typeof document === 'undefined') return
    const header = ['id', 'number', 'client', 'amount', 'date', 'dueDate', 'status']
    const content = rows.map((item) => [item.id, item.number, item.client, String(item.amount), item.date, item.dueDate, item.status].join(','))
    const csv = [header.join(','), ...content].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportFilteredInvoices = () => {
    exportCsv(filteredInvoices, `facturas-${filterStatus}.csv`)
    toast.success(`Exportadas ${filteredInvoices.length} facturas.`)
  }

  const downloadSingleInvoice = (invoice: Invoice) => {
    exportCsv([invoice], `${invoice.number}.csv`)
    toast.success(`Factura ${invoice.number} descargada.`)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-l-4 border-blue-600 shadow-sm"
        >
          <p className="text-sm font-medium text-blue-700">Ingresos Totales</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-blue-600 mt-2">4 facturas en el período</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-l-4 border-green-600 shadow-sm"
        >
          <p className="text-sm font-medium text-green-700">Pagos Recibidos</p>
          <p className="text-3xl font-bold text-green-900 mt-2">${paidRevenue.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-2">{invoices.filter(i => i.status === 'paid').length} facturas pagadas</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border-l-4 border-red-600 shadow-sm"
        >
          <p className="text-sm font-medium text-red-700">Pendiente de Cobranza</p>
          <p className="text-3xl font-bold text-red-900 mt-2">${pendingRevenue.toLocaleString()}</p>
          <p className="text-xs text-red-600 mt-2">{invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length} facturas pendientes</p>
        </motion.div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Facturas</h2>
            <button onClick={exportFilteredInvoices} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
              <ArrowDownTrayIcon className="w-5 h-5" />
              Exportar
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'paid', 'pending', 'overdue'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg transition ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Todas' : 
                 status === 'paid' ? 'Pagadas' :
                 status === 'pending' ? 'Pendientes' :
                 'Vencidas'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Factura</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cliente</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Monto</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fecha Emisión</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Fecha Vencimiento</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice, i) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{invoice.client}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">${invoice.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      {new Date(invoice.date).toLocaleDateString('es-ES')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      {new Date(invoice.dueDate).toLocaleDateString('es-ES')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[invoice.status].bg} ${statusConfig[invoice.status].text}`}>
                      {statusConfig[invoice.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button onClick={() => downloadSingleInvoice(invoice)} className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Descargar
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

export default BillingManagement
