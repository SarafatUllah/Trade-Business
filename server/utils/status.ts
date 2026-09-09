import Decimal from 'decimal.js'
import { add, subtract, toMoney, isZero } from './money'

// Financial truth is always derived from actual amounts + dates, never from
// a manually-picked status flag alone. These helpers are the single source
// of truth for payable/receivable state across API responses, dashboard
// aggregates, reminders, and invoices.

export interface PayableLike {
  originalAmount: unknown
  dueDate: Date | string
  payments: { amount: unknown; reversedAt: Date | string | null }[]
}

export interface ReceivableLike {
  originalAmount: unknown
  expectedDate: Date | string
  collections: { amount: unknown; reversedAt: Date | string | null }[]
}

export type PayableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
export type ReceivableStatus = 'UNRECEIVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'OVERDUE'

function sumActive(entries: { amount: unknown; reversedAt: Date | string | null }[]): Decimal {
  return entries
    .filter(e => !e.reversedAt)
    .reduce((sum, e) => add(sum, e.amount), toMoney(0))
}

export function computePayablePaid(p: PayableLike): Decimal {
  return sumActive(p.payments)
}

export function computePayableRemaining(p: PayableLike): Decimal {
  const remaining = subtract(p.originalAmount, computePayablePaid(p))
  return remaining.isNegative() ? toMoney(0) : remaining
}

export function computePayableStatus(p: PayableLike, now: Date = new Date()): PayableStatus {
  const remaining = computePayableRemaining(p)
  const paid = computePayablePaid(p)
  if (isZero(remaining)) return 'PAID'
  const due = new Date(p.dueDate)
  if (due.getTime() < now.getTime()) return 'OVERDUE'
  if (paid.greaterThan(0)) return 'PARTIALLY_PAID'
  return 'UNPAID'
}

export function computeReceivableReceived(r: ReceivableLike): Decimal {
  return sumActive(r.collections)
}

export function computeReceivableRemaining(r: ReceivableLike): Decimal {
  const remaining = subtract(r.originalAmount, computeReceivableReceived(r))
  return remaining.isNegative() ? toMoney(0) : remaining
}

export function computeReceivableStatus(r: ReceivableLike, now: Date = new Date()): ReceivableStatus {
  const remaining = computeReceivableRemaining(r)
  const received = computeReceivableReceived(r)
  if (isZero(remaining)) return 'RECEIVED'
  const expected = new Date(r.expectedDate)
  if (expected.getTime() < now.getTime()) return 'OVERDUE'
  if (received.greaterThan(0)) return 'PARTIALLY_RECEIVED'
  return 'UNRECEIVED'
}

export function isPayableSettled(p: PayableLike): boolean {
  return isZero(computePayableRemaining(p))
}

export function isReceivableSettled(r: ReceivableLike): boolean {
  return isZero(computeReceivableRemaining(r))
}
