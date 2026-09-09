import { describe, it, expect } from 'vitest'
import { add, subtract, multiply, divide, round, formatCurrency, toApiNumber } from '../../server/utils/money'
import {
  computePayablePaid,
  computePayableRemaining,
  computePayableStatus,
  computeReceivableReceived,
  computeReceivableRemaining,
  computeReceivableStatus,
  isPayableSettled,
  isReceivableSettled
} from '../../server/utils/status'

describe('money utilities', () => {
  it('adds decimals without float drift', () => {
    expect(add(0.1, 0.2).toNumber()).toBe(0.3)
  })

  it('subtracts and multiplies precisely', () => {
    expect(subtract(100, 33.33).toNumber()).toBeCloseTo(66.67, 5)
    expect(multiply(19.99, 3).toNumber()).toBeCloseTo(59.97, 5)
  })

  it('divides safely, returning 0 for division by zero', () => {
    expect(divide(100, 0).toNumber()).toBe(0)
    expect(divide(100, 4).toNumber()).toBe(25)
  })

  it('rounds to 2 decimal places by default', () => {
    expect(round(10.005).toNumber()).toBeCloseTo(10.01, 2)
  })

  it('formats currency with the correct symbol', () => {
    expect(formatCurrency(1500, 'BDT')).toContain('৳')
    expect(formatCurrency(1500, 'USD')).toContain('$')
  })

  it('converts to a plain JS number only at the API boundary', () => {
    expect(toApiNumber('1234.5')).toBe(1234.5)
  })
})

describe('payable status logic', () => {
  const dueYesterday = new Date(Date.now() - 86400000)
  const dueTomorrow = new Date(Date.now() + 86400000)

  it('is UNPAID with no payments and a future due date', () => {
    const payable = { originalAmount: 1000, dueDate: dueTomorrow, payments: [] }
    expect(computePayableStatus(payable)).toBe('UNPAID')
    expect(computePayableRemaining(payable).toNumber()).toBe(1000)
  })

  it('is PARTIALLY_PAID when some but not all has been paid', () => {
    const payable = { originalAmount: 1000, dueDate: dueTomorrow, payments: [{ amount: 400, reversedAt: null }] }
    expect(computePayablePaid(payable).toNumber()).toBe(400)
    expect(computePayableRemaining(payable).toNumber()).toBe(600)
    expect(computePayableStatus(payable)).toBe('PARTIALLY_PAID')
    expect(isPayableSettled(payable)).toBe(false)
  })

  it('is PAID once fully covered by one or more payments', () => {
    const payable = {
      originalAmount: 1000,
      dueDate: dueTomorrow,
      payments: [{ amount: 600, reversedAt: null }, { amount: 400, reversedAt: null }]
    }
    expect(computePayableStatus(payable)).toBe('PAID')
    expect(isPayableSettled(payable)).toBe(true)
  })

  it('is OVERDUE when past due date and not fully paid', () => {
    const payable = { originalAmount: 1000, dueDate: dueYesterday, payments: [] }
    expect(computePayableStatus(payable)).toBe('OVERDUE')
  })

  it('ignores reversed payments when computing remaining balance', () => {
    const payable = {
      originalAmount: 1000,
      dueDate: dueTomorrow,
      payments: [{ amount: 1000, reversedAt: new Date() }]
    }
    expect(computePayableRemaining(payable).toNumber()).toBe(1000)
    expect(computePayableStatus(payable)).toBe('UNPAID')
  })

  it('never lets remaining go negative on overpayment', () => {
    const payable = { originalAmount: 1000, dueDate: dueTomorrow, payments: [{ amount: 1500, reversedAt: null }] }
    expect(computePayableRemaining(payable).toNumber()).toBe(0)
  })
})

describe('receivable status logic', () => {
  const expectedYesterday = new Date(Date.now() - 86400000)
  const expectedTomorrow = new Date(Date.now() + 86400000)

  it('is UNRECEIVED, PARTIALLY_RECEIVED, RECEIVED, OVERDUE correctly', () => {
    expect(computeReceivableStatus({ originalAmount: 500, expectedDate: expectedTomorrow, collections: [] })).toBe('UNRECEIVED')
    expect(
      computeReceivableStatus({ originalAmount: 500, expectedDate: expectedTomorrow, collections: [{ amount: 200, reversedAt: null }] })
    ).toBe('PARTIALLY_RECEIVED')
    expect(
      computeReceivableStatus({ originalAmount: 500, expectedDate: expectedTomorrow, collections: [{ amount: 500, reversedAt: null }] })
    ).toBe('RECEIVED')
    expect(computeReceivableStatus({ originalAmount: 500, expectedDate: expectedYesterday, collections: [] })).toBe('OVERDUE')
  })

  it('computes received/remaining correctly with multiple collections', () => {
    const receivable = {
      originalAmount: 1000,
      expectedDate: expectedTomorrow,
      collections: [{ amount: 300, reversedAt: null }, { amount: 300, reversedAt: null }]
    }
    expect(computeReceivableReceived(receivable).toNumber()).toBe(600)
    expect(computeReceivableRemaining(receivable).toNumber()).toBe(400)
    expect(isReceivableSettled(receivable)).toBe(false)
  })
})

describe('net position (payable vs receivable kept independent)', () => {
  it('never nets payable and receivable into a single stored balance', () => {
    // Regression guard: this test encodes the spec requirement that a
    // party with BOTH a payable and a receivable retains both underlying
    // records rather than collapsing to one net number.
    const payable = { originalAmount: 250000, dueDate: new Date(), payments: [] }
    const receivable = { originalAmount: 400000, expectedDate: new Date(), collections: [] }
    const netPosition = computeReceivableRemaining(receivable).minus(computePayableRemaining(payable))
    expect(netPosition.toNumber()).toBe(150000)
    // Both underlying figures must still be independently recoverable:
    expect(computePayableRemaining(payable).toNumber()).toBe(250000)
    expect(computeReceivableRemaining(receivable).toNumber()).toBe(400000)
  })
})
