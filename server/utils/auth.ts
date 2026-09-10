import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import { createError, getCookie, setCookie, deleteCookie } from 'h3'

const COOKIE_NAME = 'tb_session'
// Companion, non-sensitive cookie: readable by client-side JS (unlike the
// real session cookie, which stays httpOnly for security) purely so the
// client-side route middleware can tell "probably logged in" without
// needing to decode a JWT in the browser. It carries no secret — the
// actual authorization on every API call still comes from the httpOnly
// cookie and server-side JWT verification.
const SESSION_FLAG_COOKIE = 'tb_has_session'
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days, "Remember me" checked
const SESSION_TTL_SECONDS = 60 * 60 * 24 // 1 day, default (unchecked)

export interface SessionPayload {
  userId: string
  businessId: string
  role: 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER'
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function getSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  return config.jwtSecret
}

export function signSession(event: H3Event, payload: SessionPayload, remember = true): string {
  const ttl = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS
  return jwt.sign(payload, getSecret(event), { expiresIn: ttl })
}

export function setSessionCookie(event: H3Event, token: string, remember = true) {
  // "Remember me" unchecked: omit maxAge entirely so the cookie is a true
  // browser-session cookie (cleared when the browser closes), with the
  // JWT's own expiry as a safety net. Checked: a real persistent maxAge.
  const maxAge = remember ? REMEMBER_TTL_SECONDS : undefined
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(maxAge ? { maxAge } : {})
  })
  setCookie(event, SESSION_FLAG_COOKIE, '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(maxAge ? { maxAge } : {})
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
  deleteCookie(event, SESSION_FLAG_COOKIE, { path: '/' })
}

export function getAuthSession(event: H3Event): SessionPayload | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null
  try {
    return jwt.verify(token, getSecret(event)) as SessionPayload
  } catch {
    return null
  }
}

/** Throws a 401 if there is no valid session. Use at the top of any
 *  authenticated API route. */
export function requireSession(event: H3Event): SessionPayload {
  const session = getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }
  return session
}

const ROLE_RANK: Record<SessionPayload['role'], number> = {
  VIEWER: 0,
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3
}

export function requireRole(event: H3Event, minRole: SessionPayload['role']): SessionPayload {
  const session = requireSession(event)
  if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }
  return session
}
