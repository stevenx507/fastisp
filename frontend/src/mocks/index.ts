// Lightweight mocks used when backend is unreachable to demo the UI
export async function mockRequest(endpoint: string, method = 'GET', body?: any) {
  // small routing by endpoint
  if (endpoint.startsWith('/health')) {
    return { status: 'healthy', service: 'ispmax-backend' }
  }

  if (endpoint.startsWith('/auth/login') && method === 'POST') {
    // accept any credentials for demo
    const email = String(body?.email || '')
    const isAdmin = /admin/i.test(email)
    return {
      token: 'demo-token',
      user: {
        id: isAdmin ? '99' : '1',
        name: isAdmin ? 'Admin Demo' : 'Demo User',
        email: email || 'demo@local',
        role: isAdmin ? 'admin' : 'client'
      }
    }
  }

  if (endpoint.startsWith('/user') || endpoint.startsWith('/me')) {
    return { id: '1', name: 'Demo User', email: 'demo@local', role: 'client', plan: 'Fiber 100' }
  }

  if (endpoint.startsWith('/dashboard')) {
    return {
      overview: {
        uptime: '99.98%',
        currentSpeed: '85 Mbps',
        dataUsed: '120 GB',
      },
      charts: {
        usage: Array.from({ length: 24 }, (_, i) => ({ hour: i, value: Math.round(40 + Math.random() * 120) }))
      }
    }
  }

  if (endpoint.startsWith('/billing')) {
    return {
      invoices: [
        { id: 'inv_1', amount: 29.99, due: '2026-03-01', status: 'due' },
        { id: 'inv_0', amount: 29.99, due: '2026-02-01', status: 'paid' }
      ]
    }
  }

  if (endpoint.startsWith('/connections')) {
    return {
      connections: [
        { id: 'c1', ip: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:01', status: 'active' },
        { id: 'c2', ip: '192.168.1.11', mac: 'AA:BB:CC:DD:EE:02', status: 'idle' }
      ]
    }
  }

  if (endpoint.startsWith('/notifications')) {
    return {
      notifications: [
        { id: 1, message: 'Demo: factura disponible', time: 'Hace 1 hora', read: false },
        { id: 2, message: 'Demo: mantenimiento programado', time: 'Ayer', read: true }
      ]
    }
  }

  // default fallback demo
  return { demo: true, endpoint }
}

export default mockRequest
