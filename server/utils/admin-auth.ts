import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'
import { createError, getCookie, setCookie, deleteCookie } from 'h3'
import { prisma } from './prisma'

// Deliberately separate cookie name/JWT payload shape from the business
// user session (server/utils/auth.ts) — platform admins are a fully
// distinct identity space with no code path into a business User's
// session or password, by design.
const ADMIN_COOKIE_NAME = 'tb_admin_session'
const ADMIN_FLAG_COOKIE = 'tb_admin_has_session'
const ADMIN_TTL_SECONDS = 60 * 60 * 12 // 12 hours — shorter-lived than business sessions

export interface AdminSessionPayload {
  adminId: string
}

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyAdminPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function getSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  // Deliberately a different secret input (suffix) than the business JWT,
  // so a leaked business JWT_SECRET alone can't be used to forge an admin
  // session, and vice versa.
  return `${config.jwtSecret}::admin`
}

export function signAdminSession(event: H3Event, payload: AdminSessionPayload): string {
  return jwt.sign(payload, getSecret(event), { expiresIn: ADMIN_TTL_SECONDS })
}

export function setAdminSessionCookie(event: H3Event, token: string) {
  setCookie(event, ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // stricter than the business cookie — admin panel never needs cross-site navigation
    path: '/',
    maxAge: ADMIN_TTL_SECONDS
  })
  // Companion non-sensitive flag cookie, readable by client-side JS,
  // purely for the admin route middleware to decide whether to redirect
  // to /admin/login — mirrors the same pattern used for business
  // sessions (see server/utils/auth.ts) and for the same reason: the
  // real session cookie is httpOnly and invisible to client-side code by
  // design.
  setCookie(event, ADMIN_FLAG_COOKIE, '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_TTL_SECONDS
  })
}

export function clearAdminSessionCookie(event: H3Event) {
  deleteCookie(event, ADMIN_COOKIE_NAME, { path: '/' })
  deleteCookie(event, ADMIN_FLAG_COOKIE, { path: '/' })
}

export function getAdminSessionPayload(event: H3Event): AdminSessionPayload | null {
  const token = getCookie(event, ADMIN_COOKIE_NAME)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret(event)) as AdminSessionPayload
  } catch {
    return null
  }
}

export type AdminPermission = 'canViewUsers' | 'canManageUserStatus' | 'canDeleteUsers' | 'canGenerateCodes' | 'canManageSubAdmins'

/** Loads and validates the current admin session, throwing 401 if absent
 *  or the admin account has since been deactivated. */
export async function requireAdmin(event: H3Event) {
  const payload = getAdminSessionPayload(event)
  if (!payload) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

  const admin = await prisma.platformAdmin.findUnique({ where: { id: payload.adminId } })
  if (!admin || !admin.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'Admin account not found or deactivated' })
  }
  return admin
}

/** Throws 403 unless the current admin is SUPER_ADMIN or has the given
 *  permission flag. SUPER_ADMIN implicitly passes every check. */
export async function requirePermission(event: H3Event, permission: AdminPermission) {
  const admin = await requireAdmin(event)
  if (admin.role === 'SUPER_ADMIN') return admin
  if (!admin[permission]) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have permission to perform this action' })
  }
  return admin
}

export async function requireSuperAdmin(event: H3Event) {
  const admin = await requireAdmin(event)
  if (admin.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Only a super admin can perform this action' })
  }
  return admin
}
