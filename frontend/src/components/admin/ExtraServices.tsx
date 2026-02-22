import React from "react"
import { CheckCircleIcon } from "@heroicons/react/24/outline"

const ExtraServices: React.FC = () => {
  const items = [
    "Servicios adicionales: TV, telefonía, IP fija",
    "Migraciones y upgrades de plan",
    "Bundles y descuentos programados"
  ]
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">➕</div>
        <div>
          <p className="text-xs font-semibold uppercase text-blue-600">Módulo</p>
          <h2 className="text-2xl font-bold text-gray-900">Servicios adicionales</h2>
          <p className="text-sm text-gray-500">Agregar/gestionar servicios extra (placeholder).</p>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((t, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 p-4 flex gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-1" />
            <div className="text-sm text-gray-700">{t}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExtraServices
