import { defineStore } from 'pinia'

export interface SessionUser { id: string; name: string; email: string }
export interface SessionBusiness { id: string; name: string; currency?: string }

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as SessionUser | null,
    business: null as SessionBusiness | null,
    role: null as string | null,
    loaded: false
  }),
  getters: {
    isAuthenticated: (state) => !!state.user
  },
  actions: {
    async fetchSession() {
      const data = await $fetch('/api/auth/me')
      this.user = data.user as SessionUser | null
      this.business = data.business as SessionBusiness | null
      this.role = (data as any).role ?? null
      this.loaded = true
    },
    async login(email: string, password: string) {
      const data = await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
      this.user = data.user
      this.business = data.business
      this.loaded = true
    },
    async register(payload: { name: string; email: string; password: string; businessName: string }) {
      const data = await $fetch('/api/auth/register', { method: 'POST', body: payload })
      this.user = data.user
      this.business = data.business
      this.loaded = true
    },
    async logout() {
      await $fetch('/api/auth/logout', { method: 'POST' })
      this.user = null
      this.business = null
    }
  }
})
