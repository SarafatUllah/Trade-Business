import Decimal from 'decimal.js'

// ============================================================
// Decimal-safe money utilities.
// NEVER use native JS `number` arithmetic (+ - * /) for monetary values —
// floating point cannot represent amounts like 0.1 + 0.2 exactly, which is
// unacceptable for financial ledgers. Everything here goes through
// decimal.js, and Prisma's `Decimal` columns already round-trip as
// decimal.js-compatible values.
// ============================================================

// 2 decimal places is the default for currency display/storage; adjust per
// business.currency if you introduce multi-currency with different minor
// units (e.g. JPY has 0 decimal places).
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

export type Moneyish = Decimal | string | number | null | undefined

export function toMoney(value: Moneyish): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  try {
    return new Decimal(value.toString())
  } catch {
    return new Decimal(0)
  }
}

export function add(a: Moneyish, b: Moneyish): Decimal {
  return toMoney(a).plus(toMoney(b))
}

export function subtract(a: Moneyish, b: Moneyish): Decimal {
  return toMoney(a).minus(toMoney(b))
}

export function multiply(a: Moneyish, b: Moneyish): Decimal {
  return toMoney(a).times(toMoney(b))
}

// Safe division: returns 0 instead of throwing/Infinity/NaN on division by
// zero, since ledger formulas must never crash on incomplete rows.
export function divide(a: Moneyish, b: Moneyish): Decimal {
  const divisor = toMoney(b)
  if (divisor.isZero()) return new Decimal(0)
  return toMoney(a).dividedBy(divisor)
}

export function round(value: Moneyish, decimalPlaces = 2): Decimal {
  return toMoney(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP)
}

export function isZero(value: Moneyish): boolean {
  return toMoney(value).isZero()
}

export function isNegative(value: Moneyish): boolean {
  return toMoney(value).isNegative()
}

export function max(a: Moneyish, b: Moneyish): Decimal {
  const da = toMoney(a)
  const db = toMoney(b)
  return da.greaterThan(db) ? da : db
}

export function formatCurrency(value: Moneyish, currency = 'BDT'): string {
  const amount = round(value).toNumber()
  const symbols: Record<string, string> = { BDT: '৳', USD: '$', INR: '₹', EUR: '€', GBP: '£' }
  const symbol = symbols[currency] ?? currency + ' '
  return symbol + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function toApiNumber(value: Moneyish): number {
  // Only for transport to the client for display; all server-side
  // calculation must stay in Decimal until this final boundary.
  return round(value).toNumber()
}
