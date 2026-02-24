import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient } from '../lib/apiClient'

type RunMode = 'simulate' | 'dry-run' | 'live'

interface OltVendor {
  id: string
  label: string
  actions: string[]
}

interface OltDevice {
  id: string
  name: string
  vendor: string
  model?: string
  host?: string
  transport?: string
  site?: string
}

interface OltAuditEntry {
  id: string
  device_id: string
  run_mode: string
  success: boolean
  started_at: string
  finished_at: string
  commands: number
  error?: string | null
}

const OltManagement: React.FC = () => {
  const [vendors, setVendors] = useState<OltVendor[]>([])
  const [devices, setDevices] = useState<OltDevice[]>([])
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [runMode, setRunMode] = useState<RunMode>('simulate')
  const [liveConfirm, setLiveConfirm] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [busy, setBusy] = useState(false)

  const [serial, setSerial] = useState('')
  const [frame, setFrame] = useState('0')
  const [slot, setSlot] = useState('1')
  const [pon, setPon] = useState('1')
  const [onu, setOnu] = useState('1')
  const [vlan, setVlan] = useState('120')
  const [lineProfile, setLineProfile] = useState('')
  const [srvProfile, setSrvProfile] = useState('')

  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null)
  const [connection, setConnection] = useState<Record<string, unknown> | null>(null)
  const [lastResponse, setLastResponse] = useState<any>(null)
  const [auditEntries, setAuditEntries] = useState<OltAuditEntry[]>([])
  const [customAction, setCustomAction] = useState('show_pon_summary')
  const [customPayload, setCustomPayload] = useState('{\n  "frame": 0,\n  "slot": 1,\n  "pon": 1\n}')
  const [quickScript, setQuickScript] = useState('')

  const filteredDevices = useMemo(
    () => (selectedVendor ? devices.filter((d) => d.vendor === selectedVendor) : devices),
    [devices, selectedVendor]
  )

  const selectedDevice = useMemo(
    () => filteredDevices.find((d) => d.id === selectedDeviceId) || null,
    [filteredDevices, selectedDeviceId]
  )

  const selectedVendorData = useMemo(
    () => vendors.find((v) => v.id === (selectedDevice?.vendor || selectedVendor)) || null,
    [vendors, selectedDevice?.vendor, selectedVendor]
  )

  const liveModeBlocked = runMode === 'live' && !liveConfirm

  const buildBasePayload = () => {
    const payload: Record<string, unknown> = {
      serial: serial.trim(),
      frame: Number(frame || 0),
      slot: Number(slot || 1),
      pon: Number(pon || 1),
      onu: Number(onu || 1),
      vlan: Number(vlan || 120),
    }
    if (lineProfile.trim()) payload.line_profile = lineProfile.trim()
    if (srvProfile.trim()) payload.srv_profile = srvProfile.trim()
    return payload
  }

  const withRunMode = (payload: Record<string, unknown> = {}) => {
    const merged: Record<string, unknown> = { ...payload, run_mode: runMode }
    if (runMode === 'live') merged.live_confirm = liveConfirm
    return merged
  }

  const buildRunModeParams = () => {
    const params = new URLSearchParams()
    params.set('run_mode', runMode)
    if (runMode === 'live' && liveConfirm) params.set('live_confirm', 'true')
    return params
  }

  const loadCatalog = async () => {
    setLoadingCatalog(true)
    try {
      const [vendorsResp, devicesResp] = await Promise.all([
        apiClient.get('/olt/vendors') as Promise<{ vendors: OltVendor[] }>,
        apiClient.get('/olt/devices') as Promise<{ devices: OltDevice[] }>,
      ])
      const nextVendors = vendorsResp.vendors || []
      const nextDevices = devicesResp.devices || []
      setVendors(nextVendors)
      setDevices(nextDevices)

      const defaultVendor = nextVendors[0]?.id || ''
      const defaultDevice = nextDevices[0]?.id || ''
      setSelectedVendor((prev) => prev || defaultVendor)
      setSelectedDeviceId((prev) => prev || defaultDevice)
      if (!nextDevices.length) toast.error('No hay OLTs configuradas en backend.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar catálogo OLT'
      toast.error(msg)
    } finally {
      setLoadingCatalog(false)
    }
  }

  const loadAudit = async () => {
    try {
      const resp = await apiClient.get('/olt/audit-log?limit=15') as { entries: OltAuditEntry[] }
      setAuditEntries(resp.entries || [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar auditoría OLT'
      toast.error(msg)
    }
  }

  useEffect(() => {
    loadCatalog()
    loadAudit()
  }, [])

  useEffect(() => {
    if (!filteredDevices.length) {
      setSelectedDeviceId('')
      return
    }
    if (!selectedDeviceId || !filteredDevices.some((d) => d.id === selectedDeviceId)) {
      setSelectedDeviceId(filteredDevices[0].id)
    }
  }, [filteredDevices, selectedDeviceId])

  const runAction = async (label: string, task: () => Promise<any>) => {
    if (!selectedDeviceId) {
      toast.error('Selecciona una OLT')
      return
    }
    if (liveModeBlocked) {
      toast.error('Confirma ejecución live para continuar')
      return
    }

    setBusy(true)
    try {
      const response = await task()
      setLastResponse(response)
      await loadAudit()
      toast.success(`${label} ejecutado`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Error en ${label}`
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const testConnection = () =>
    runAction('Test conexión', async () => {
      const resp = await apiClient.post('/olt/devices/test-connection', {
        device_id: selectedDeviceId,
        timeout: 2.5,
      })
      setConnection(resp)
      return resp
    })

  const refreshSnapshot = () =>
    runAction('Snapshot', async () => {
      const resp = await apiClient.get(`/olt/devices/${selectedDeviceId}/snapshot`)
      setSnapshot(resp.snapshot || null)
      return resp
    })

  const discoverOnu = () =>
    runAction('Descubrir ONU', async () => {
      const params = buildRunModeParams()
      params.set('frame', frame)
      params.set('slot', slot)
      params.set('pon', pon)
      if (serial.trim()) params.set('serial', serial.trim())
      return apiClient.get(`/olt/devices/${selectedDeviceId}/autofind-onu?${params.toString()}`)
    })

  const checkOpticalPower = () =>
    runAction('Potencia óptica', async () => {
      const params = buildRunModeParams()
      params.set('frame', frame)
      params.set('slot', slot)
      params.set('pon', pon)
      params.set('onu', onu)
      return apiClient.get(`/olt/devices/${selectedDeviceId}/pon-power?${params.toString()}`)
    })

  const runOnuAction = (action: 'authorize' | 'suspend' | 'activate' | 'reboot') =>
    runAction(`ONU ${action}`, async () => {
      const payload = withRunMode(buildBasePayload())
      const path =
        action === 'authorize'
          ? `/olt/devices/${selectedDeviceId}/authorize-onu`
          : action === 'suspend'
            ? `/olt/devices/${selectedDeviceId}/onu/suspend`
            : action === 'activate'
              ? `/olt/devices/${selectedDeviceId}/onu/activate`
              : `/olt/devices/${selectedDeviceId}/onu/reboot`
      return apiClient.post(path, payload)
    })

  const runCustomScript = () =>
    runAction('Script OLT', async () => {
      let payload: Record<string, unknown> = {}
      if (customPayload.trim()) {
        try {
          payload = JSON.parse(customPayload)
        } catch {
          throw new Error('Payload JSON inválido para script')
        }
      }

      const generated = await apiClient.post(`/olt/devices/${selectedDeviceId}/script/generate`, {
        action: customAction,
        payload,
      })
      if (!generated?.success || !Array.isArray(generated?.commands)) {
        throw new Error(generated?.error || 'No se pudo generar script')
      }

      const executed = await apiClient.post(`/olt/devices/${selectedDeviceId}/script/execute`, {
        commands: generated.commands,
        run_mode: runMode,
        live_confirm: runMode === 'live' ? liveConfirm : undefined,
      })
      return { generated, executed }
    })

  const generateQuickScript = () =>
    runAction('Quick script', async () => {
      let payload: Record<string, unknown> = {}
      if (customPayload.trim()) {
        try {
          payload = JSON.parse(customPayload)
        } catch {
          throw new Error('Payload JSON inválido para quick script')
        }
      }

      const resp = await apiClient.post(`/olt/devices/${selectedDeviceId}/quick-connect-script`, {
        action: customAction,
        payload,
        platform: 'windows',
      })
      setQuickScript(String(resp?.script || ''))
      return resp
    })

  const runTr064Probe = () =>
    runAction('TR-064 probe', async () => {
      if (!selectedDevice?.host) {
        throw new Error('La OLT seleccionada no tiene host configurado')
      }
      return apiClient.post('/olt/tr064/test', {
        host: selectedDevice.host,
        port: 7547,
        timeout: 2.5,
      })
    })

  return (
    <div className="enterprise-dashboard space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
          <label className="text-xs text-slate-300">Vendor</label>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm"
          >
            {!vendors.length && <option value="">Sin vendors</option>}
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
          <label className="text-xs text-slate-300">OLT</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm"
          >
            {!filteredDevices.length && <option value="">Sin OLTs</option>}
            {filteredDevices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">
            {selectedDevice?.host || '-'} • {selectedDevice?.transport || '-'} • {selectedDevice?.site || '-'}
          </p>
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
          <label className="text-xs text-slate-300">Modo de ejecución</label>
          <select
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as RunMode)}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm"
          >
            <option value="simulate">simulate</option>
            <option value="dry-run">dry-run</option>
            <option value="live">live</option>
          </select>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={liveConfirm}
              onChange={(e) => setLiveConfirm(e.target.checked)}
            />
            Confirmar ejecución live
          </label>
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 flex flex-col justify-center gap-2">
          <button
            onClick={loadCatalog}
            disabled={loadingCatalog || busy}
            className="w-full rounded-lg bg-cyan-500 text-slate-900 font-semibold px-3 py-2 disabled:opacity-60"
          >
            {loadingCatalog ? 'Cargando...' : 'Recargar catálogo'}
          </button>
          <button
            onClick={loadAudit}
            disabled={busy}
            className="w-full rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 disabled:opacity-60"
          >
            Recargar auditoría
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-semibold text-white">Operaciones ONU</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial ONU" className="col-span-2 rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={frame} onChange={(e) => setFrame(e.target.value)} placeholder="Frame" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Slot" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={pon} onChange={(e) => setPon(e.target.value)} placeholder="PON" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={onu} onChange={(e) => setOnu(e.target.value)} placeholder="ONU ID" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={vlan} onChange={(e) => setVlan(e.target.value)} placeholder="VLAN" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={lineProfile} onChange={(e) => setLineProfile(e.target.value)} placeholder="Line profile" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
            <input value={srvProfile} onChange={(e) => setSrvProfile(e.target.value)} placeholder="Srv profile" className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={discoverOnu} disabled={busy} className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm disabled:opacity-60">Autofind</button>
            <button onClick={checkOpticalPower} disabled={busy} className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm disabled:opacity-60">Potencia</button>
            <button onClick={runTr064Probe} disabled={busy} className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm disabled:opacity-60">TR-064</button>
            <button onClick={refreshSnapshot} disabled={busy} className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm disabled:opacity-60">Snapshot</button>
            <button onClick={testConnection} disabled={busy} className="rounded-lg bg-cyan-500 text-slate-900 font-semibold px-3 py-2 text-sm disabled:opacity-60">Test conexión</button>
            <button onClick={() => runOnuAction('authorize')} disabled={busy} className="rounded-lg bg-emerald-500 text-slate-900 font-semibold px-3 py-2 text-sm disabled:opacity-60">Autorizar</button>
            <button onClick={() => runOnuAction('suspend')} disabled={busy} className="rounded-lg bg-amber-500 text-slate-900 font-semibold px-3 py-2 text-sm disabled:opacity-60">Suspender</button>
            <button onClick={() => runOnuAction('activate')} disabled={busy} className="rounded-lg bg-green-500 text-slate-900 font-semibold px-3 py-2 text-sm disabled:opacity-60">Activar</button>
            <button onClick={() => runOnuAction('reboot')} disabled={busy} className="rounded-lg bg-rose-500 text-white font-semibold px-3 py-2 text-sm disabled:opacity-60">Reiniciar ONU</button>
          </div>

          {liveModeBlocked && (
            <p className="text-xs text-amber-300">Modo live activo: marca confirmación para habilitar ejecución.</p>
          )}
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-semibold text-white">Scripts OLT</h3>
          <select
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm"
          >
            {(selectedVendorData?.actions || ['show_pon_summary']).map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <textarea
            value={customPayload}
            onChange={(e) => setCustomPayload(e.target.value)}
            rows={8}
            className="w-full rounded-lg bg-slate-950 border border-white/10 text-slate-100 px-3 py-2 text-xs font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={runCustomScript} disabled={busy} className="rounded-lg bg-cyan-500 text-slate-900 font-semibold px-3 py-2 text-sm disabled:opacity-60">
              Generar + Ejecutar
            </button>
            <button onClick={generateQuickScript} disabled={busy} className="rounded-lg bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-sm disabled:opacity-60">
              Quick script
            </button>
          </div>
          {quickScript && (
            <pre className="text-xs overflow-auto max-h-52 p-3 rounded-lg">{quickScript}</pre>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold text-white">Estado actual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-slate-800/70 p-3">
              <p className="text-slate-300 text-xs uppercase">Conexión</p>
              <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 rounded">{JSON.stringify(connection, null, 2)}</pre>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-800/70 p-3">
              <p className="text-slate-300 text-xs uppercase">Snapshot</p>
              <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 rounded">{JSON.stringify(snapshot, null, 2)}</pre>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-800/70 p-3">
            <p className="text-slate-300 text-xs uppercase">Última ejecución</p>
            <pre className="mt-2 text-xs overflow-auto max-h-80 p-2 rounded">{JSON.stringify(lastResponse, null, 2)}</pre>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-white/10 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Auditoría OLT</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-100">
              <thead className="text-xs text-slate-300 border-b border-white/10">
                <tr>
                  <th className="text-left py-2">Dispositivo</th>
                  <th className="text-left py-2">Modo</th>
                  <th className="text-left py-2">Comandos</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-left py-2">Inicio</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5">
                    <td className="py-2">{entry.device_id}</td>
                    <td className="py-2">{entry.run_mode}</td>
                    <td className="py-2">{entry.commands}</td>
                    <td className="py-2">
                      <span className={entry.success ? 'text-emerald-300' : 'text-rose-300'}>
                        {entry.success ? 'ok' : 'error'}
                      </span>
                    </td>
                    <td className="py-2">{entry.started_at?.replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!auditEntries.length && <p className="text-sm text-slate-300 mt-3">Sin registros aún.</p>}
        </div>
      </div>
    </div>
  )
}

export default OltManagement
