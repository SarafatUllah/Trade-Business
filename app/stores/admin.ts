import { defineStore } from 'pinia'

export interface AdminSession {
  id: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'SUB_ADMIN'
  canViewUsers: boolean
  canManageUserStatus: boolean
  canDeleteUsers: boolean
  canGenerateCodes: boolean
  canManageSubAdmins: boolean
}

export const useAdminStore = defineStore('admin', {
  state: () => ({
    admin: null as AdminSession | null,
    loaded: false
  }),
  getters: {
    isAuthenticated: (state) => !!state.admin,
    isSuperAdmin: (state) => state.admin?.role === 'SUPER_ADMIN',
    can: (state) => (permission: keyof Omit<AdminSession, 'id' | 'name' | 'email' | 'role'>) =>
      state.admin?.role === 'SUPER_ADMIN' || !!state.admin?.[permission]
  },
  actions: {
    async fetchSession() {
      const data = await $fetch('/api/admin/auth/me')
      this.admin = data.admin
      this.loaded = true
    },
    async login(email: string, password: string) {
      const data = await $fetch('/api/admin/auth/login', { method: 'POST', body: { email, password } })
      this.admin = data.admin
      this.loaded = true
    },
    async logout() {
      await $fetch('/api/admin/auth/logout', { method: 'POST' })
      this.admin = null
    }
  }
})
