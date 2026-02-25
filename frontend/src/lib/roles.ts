export type AppRole = 'platform_admin' | 'admin' | 'client'

export const normalizeRole = (rawRole: unknown): AppRole => {
  const token = String(rawRole || '')
    .trim()
    .toLowerCase()

  if (token === 'platform_admin' || token === 'platform-admin' || token === 'platformadmin') {
    return 'platform_admin'
  }

  if (token === 'admin' || token === 'admin_isp' || token === 'isp_admin' || token === 'administrator') {
    return 'admin'
  }

  return 'client'
}

export const roleHomePath = (rawRole: unknown): '/platform' | '/admin' | '/dashboard' => {
  const role = normalizeRole(rawRole)
  if (role === 'platform_admin') return '/platform'
  if (role === 'admin') return '/admin'
  return '/dashboard'
}

export const hasAllowedRole = (rawRole: unknown, allowedRoles: string[]): boolean => {
  const role = normalizeRole(rawRole)
  return allowedRoles.includes(role)
}

