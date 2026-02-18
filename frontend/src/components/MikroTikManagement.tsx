// frontend/src/components/MikroTikManagement.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ServerIcon,
  WifiIcon,
  ChartBarIcon,
  UserGroupIcon,
  CogIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { RouterItem, RouterStats, Toast } from './types';
import AIDiagnosis from './AIDiagnosis';
import ActionsHeader from './ActionsHeader';
import OverviewTab from './OverviewTab';
import QueuesTab from './QueuesTab';
import { useAuthStore } from '../store/authStore';
import config from '../lib/config';
import ConnectionsTab from './ConnectionsTab';
import SidePanels from './SidePanels';

const MikroTikManagement: React.FC = () => {
  // Core State
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [selectedRouter, setSelectedRouter] = useState<RouterItem | null>(null);
  const [routerStats, setRouterStats] = useState<RouterStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'queues' | 'connections' | 'config' | 'security'>('overview');
  
  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(false); // For main content
  const [actionLoading, setActionLoading] = useState<boolean>(false); // For individual button actions
  
  // AI Diagnosis State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // UI State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [sidePanel, setSidePanel] = useState<'none' | 'logs' | 'dhcp' | 'wifi'>('none');
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  // Helper Functions
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const openConfirm = (message: string, onConfirm: () => void) => {
    setConfirmMessage(message);
    confirmActionRef.current = onConfirm;
    setConfirmOpen(true);
  };
  
  // API Fetching
  const authHeaders = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const API_BASE = config.API_BASE_URL;

  const safeJson = useCallback(async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const apiFetch = useCallback((path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    const auth = authHeaders();
    Object.entries(auth).forEach(([key, value]) => headers.set(key, value));
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    return fetch(url, { ...options, headers }).then(async (res) => {
      if (res.status === 401) {
        logout();
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      return res;
    });
  }, [API_BASE, authHeaders, logout]);

  // Data Loading Functions
  const loadRouters = useCallback(async () => {
    try {
      const response = await apiFetch('/api/mikrotik/routers');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await safeJson(response)) || { success: false, routers: [] };
      if (data.success && Array.isArray(data.routers)) {
        setRouters(data.routers as RouterItem[]);
        if (data.routers.length > 0) {
          setSelectedRouter((current) => current || (data.routers[0] as RouterItem));
        }
      }
    } catch (error) {
      console.error('Error loading routers:', error);
      addToast('error', 'No se pudieron cargar los routers.');
    }
  }, [addToast, apiFetch, safeJson]);

  const loadRouterStats = useCallback(async (routerId: string) => {
    setIsLoading(true);
    try {
      const [healthRes, queuesRes, connectionsRes] = await Promise.all([
        apiFetch(`/api/mikrotik/routers/${routerId}/health`),
        apiFetch(`/api/mikrotik/routers/${routerId}/queues`),
        apiFetch(`/api/mikrotik/routers/${routerId}/connections`),
      ]);

      const healthData = healthRes.ok ? (await safeJson(healthRes)) : { success: false, error: `HTTP ${healthRes.status}` };
      const queuesData = queuesRes.ok ? (await safeJson(queuesRes)) : { success: false, error: `HTTP ${queuesRes.status}` };
      const connectionsData = connectionsRes.ok ? (await safeJson(connectionsRes)) : { success: false, error: `HTTP ${connectionsRes.status}` };
      
      const nextStats: RouterStats = {
        health: healthData.success ? healthData.health : null,
        queues: queuesData.success && Array.isArray(queuesData.queues) ? queuesData.queues : [],
        connections: connectionsData.success && Array.isArray(connectionsData.connections) ? connectionsData.connections : [],
      };
      setRouterStats(nextStats);

    } catch (error) {
      console.error('Error loading router stats:', error);
      setRouterStats({ health: null, queues: [], connections: [] });
      addToast('error', 'Error de red al cargar estadísticas del router.');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, apiFetch, safeJson]);

  // Effects
  useEffect(() => {
    loadRouters();
  }, [loadRouters]);

  useEffect(() => {
    if (selectedRouter) {
      loadRouterStats(selectedRouter.id);
      // Clear AI analysis on router change
      setAiAnalysis(null);
      setAiError(null);
    }
  }, [selectedRouter, loadRouterStats]);

  // Action Handlers
  const rebootRouter = async () => {
    if (!selectedRouter) return;
    setActionLoading(true);
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/reboot`, { method: 'POST' });
      const data = await response.json().catch(() => ({ success: false }));
      if (response.ok && data.success) addToast('success', 'Reinicio solicitado correctamente');
      else addToast('error', 'Error reiniciando router');
    } catch (error) {
      addToast('error', 'Error de red reiniciando router');
    } finally {
      setActionLoading(false);
    }
  };

  const backupRouter = async () => {
    if (!selectedRouter) return;
    setActionLoading(true);
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `backup_${new Date().toISOString()}` }),
      });
      const data = await response.json();
      if (response.ok && data.success) addToast('success', 'Backup creado exitosamente');
      else addToast('error', 'Error creando backup');
    } catch (error) {
      console.error('Error backing up router:', error);
    } finally {
      setActionLoading(false);
    }
  };
  
  const testConnection = async () => {
      if (!selectedRouter) return;
      setActionLoading(true);
      try {
        const res = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/test-connection`);
        const data = await res.json().catch(() => ({ success: false }));
        if (res.ok && data.success) addToast('success', 'Conexión al router exitosa');
        else addToast('error', 'No se pudo conectar al router');
      } catch (e) {
        addToast('error', 'Error de red al probar conexión');
      } finally {
        setActionLoading(false);
      }
  };

  const runAiDiagnosis = async () => {
    if (!selectedRouter) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    setAiError(null);
    try {
      const response = await apiFetch(`/api/mikrotik/routers/${selectedRouter.id}/ai-diagnose`);
      const data = await response.json();
      if (response.ok && data.success) {
        setAiAnalysis(data.diagnosis.analysis);
      } else {
        throw new Error(data.error || 'Failed to get AI analysis');
      }
    } catch (error: any) {
      setAiError(error.message || 'An unknown error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ActionsHeader
        actionLoading={actionLoading}
        isAiLoading={isAiLoading}
        isLoading={isLoading}
        selectedRouter={selectedRouter}
        onTestConnection={testConnection}
        onBackupRouter={backupRouter}
        onRebootClick={() => openConfirm(`¿Reiniciar el router ${selectedRouter?.name}?`, rebootRouter)}
        onRunAiDiagnosis={runAiDiagnosis}
        onRefreshStats={() => selectedRouter && loadRouterStats(selectedRouter.id)}
        onShowLogs={() => setSidePanel('logs')}
        onShowDhcpLeases={() => setSidePanel('dhcp')}
        onShowWifiClients={() => setSidePanel('wifi')}
      />

      {/* Router Selection */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Seleccionar Router</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {routers.map((router) => (
            <button
              key={router.id}
              onClick={() => setSelectedRouter(router)}
              className={`p-4 rounded-lg border transition-all ${
                selectedRouter?.id === router.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ServerIcon className="w-6 h-6 text-green-500" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{router.name}</div>
                  <div className="text-sm text-gray-600">{router.ip_address}</div>
                  <div className="text-xs text-gray-500">{router.model}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedRouter && (
        <>
          <div className="my-4">
            <AIDiagnosis isLoading={isAiLoading} analysis={aiAnalysis} error={aiError} />
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', name: 'Resumen', icon: ChartBarIcon },
                { id: 'queues', name: 'Colas', icon: UserGroupIcon },
                { id: 'connections', name: 'Conexiones', icon: WifiIcon },
                { id: 'config', name: 'Configuración', icon: CogIcon },
                { id: 'security', name: 'Seguridad', icon: ShieldCheckIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando información del router...</p>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewTab routerStats={routerStats} />}
                {activeTab === 'queues' && (
                  <QueuesTab
                    routerStats={routerStats}
                    setRouterStats={setRouterStats}
                    selectedRouter={selectedRouter}
                    apiFetch={apiFetch}
                    addToast={addToast}
                    openConfirm={openConfirm}
                  />
                )}
                {activeTab === 'connections' && (
                  <ConnectionsTab
                    routerStats={routerStats}
                    setRouterStats={setRouterStats}
                    selectedRouter={selectedRouter}
                    apiFetch={apiFetch}
                    addToast={addToast}
                    openConfirm={openConfirm}
                  />
                )}
                 {activeTab === 'config' && <div className="text-center py-10 text-gray-500">La configuración no está implementada aún.</div>}
                 {activeTab === 'security' && <div className="text-center py-10 text-gray-500">La seguridad no está implementada aún.</div>}
              </>
            )}
          </div>
        </>
      )}

      <SidePanels
        sidePanel={sidePanel}
        onClose={() => setSidePanel('none')}
        selectedRouterId={selectedRouter?.id || null}
        apiFetch={apiFetch}
        addToast={addToast}
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-2 rounded shadow text-white ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-700'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)}></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Confirmar acción</h4>
              <p className="text-gray-700 mb-4">{confirmMessage}</p>
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300" onClick={() => setConfirmOpen(false)}>Cancelar</button>
                <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => { setConfirmOpen(false); confirmActionRef.current && confirmActionRef.current(); }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MikroTikManagement;
