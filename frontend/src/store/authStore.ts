import { create } from 'zustand'
import { persist, StorageValue } from 'zustand/middleware'
import { apiClient } from '../lib/apiClient'
import { safeStorage } from '../lib/storage'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'client'
  plan?: string
  client_id?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  updateProfile: (payload: Partial<User>) => Promise<void>
  logout: () => void
}

// Custom storage adapter that handles browser restrictions
const storage = {
  getItem: (name: string): StorageValue<AuthState> | null => {
    try {
      const item = safeStorage.getItem(name)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.warn(`[AuthStore] Failed to load state from storage:`, error)
      return null
    }
  },
  setItem: (name: string, value: StorageValue<AuthState>): void => {
    try {
      safeStorage.setItem(name, JSON.stringify(value))
    } catch (error) {
      console.warn(`[AuthStore] Failed to save state to storage:`, error)
    }
  },
  removeItem: (name: string): void => {
    try {
      safeStorage.removeItem(name)
    } catch (error) {
      console.warn(`[AuthStore] Failed to remove state from storage:`, error)
    }
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const data = await apiClient.post('/auth/login', { email, password })

        const token = data.token
        const user = data.user

        if (!token || !user) {
          throw new Error('Respuesta de autenticación inválida.')
        }

        set({ user, token, isAuthenticated: true })
      },
      updateProfile: async (payload) => {
        const current = (state: AuthState) => state.user
        set((state) => ({ user: state.user ? { ...state.user, ...payload } : state.user }))
        try {
          await apiClient.put('/auth/profile', payload).catch(() => null)
          const user = current as any
          if (!user) throw new Error()
        } catch (error) {
          // si falla, no revertimos pero notificamos via consola
          console.warn('[AuthStore] profile update fallback', error)
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      }
    }),
    {
      name: 'auth-storage',
      storage
    }
  )
)
