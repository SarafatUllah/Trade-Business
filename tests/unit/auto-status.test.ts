import { describe, it, expect } from 'vitest'
import { computeAutoPaymentStatus } from '../../server/utils/formula'

describe('computeAutoPaymentStatus (AUTO_STATUS field type)', () => {
  it('returns UNPAID when nothing has been paid', () => {
    expect(computeAutoPaymentStatus(1000, 0)).toBe('UNPAID')
  })

  it('returns UNPAID when paid is null/undefined', () => {
    expect(computeAutoPaymentStatus(1000, null)).toBe('UNPAID')
    expect(computeAutoPaymentStatus(1000, undefined)).toBe('UNPAID')
  })

  it('returns PARTIALLY_PAID when paid is between 0 and the total', () => {
    expect(computeAutoPaymentStatus(1000, 500)).toBe('PARTIALLY_PAID')
    expect(computeAutoPaymentStatus(1000, 999.99)).toBe('PARTIALLY_PAID')
  })

  it('returns PAID when paid meets or exceeds the total', () => {
    expect(computeAutoPaymentStatus(1000, 1000)).toBe('PAID')
    expect(computeAutoPaymentStatus(1000, 1200)).toBe('PAID') // overpayment still counts as fully paid
  })

  it('returns null when there is no total to compare against', () => {
    expect(computeAutoPaymentStatus(null, 500)).toBeNull()
    expect(computeAutoPaymentStatus(undefined, 500)).toBeNull()
    expect(computeAutoPaymentStatus(NaN, 500)).toBeNull()
  })
})
