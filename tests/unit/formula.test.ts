import { describe, it, expect } from 'vitest'
import {
  evaluateFormula,
  extractDependencies,
  resolveCalculationOrder,
  validateFormula,
  CircularDependencyError,
  computeRow
} from '../../server/utils/formula'

describe('formula engine: parsing & evaluation', () => {
  it('evaluates basic arithmetic with correct precedence', () => {
    expect(evaluateFormula('2 + 3 * 4', {}).toNumber()).toBe(14)
    expect(evaluateFormula('(2 + 3) * 4', {}).toNumber()).toBe(20)
  })

  it('resolves field references from a value map', () => {
    const result = evaluateFormula('weight * rate', { weight: 1000, rate: 25 })
    expect(result.toNumber()).toBe(25000)
  })

  it('computes gross/net/due formula chain like the spec example', () => {
    const values = { weight: 1000, rate: 30, truck_rent: 500, paid_amount: 20000 }
    const gross = evaluateFormula('weight * rate', values).toNumber()
    const net = evaluateFormula('gross_amount - truck_rent', { ...values, gross_amount: gross }).toNumber()
    const due = evaluateFormula('net_amount - paid_amount', { ...values, net_amount: net }).toNumber()
    expect(gross).toBe(30000)
    expect(net).toBe(29500)
    expect(due).toBe(9500)
  })

  it('treats missing/null field values as 0 instead of throwing', () => {
    const result = evaluateFormula('weight * rate', { weight: null, rate: undefined })
    expect(result.toNumber()).toBe(0)
  })

  it('handles division by zero safely, returning 0', () => {
    const result = evaluateFormula('gross_amount / weight', { gross_amount: 5000, weight: 0 })
    expect(result.toNumber()).toBe(0)
  })

  it('preserves decimal precision (no float drift)', () => {
    const result = evaluateFormula('a + b', { a: 0.1, b: 0.2 })
    expect(result.toNumber()).toBe(0.3)
  })

  it('supports unary negation', () => {
    expect(evaluateFormula('-5 + 10', {}).toNumber()).toBe(5)
  })

  it('throws FormulaError on invalid syntax', () => {
    expect(() => evaluateFormula('2 + * 3', {})).toThrow()
    expect(() => evaluateFormula('(2 + 3', {})).toThrow()
  })
})

describe('formula engine: dependency extraction', () => {
  it('extracts unique field references', () => {
    const deps = extractDependencies('(weight * rate) - truck_rent + weight')
    expect(deps.sort()).toEqual(['rate', 'truck_rent', 'weight'])
  })
})

describe('formula engine: dependency ordering & cycle detection', () => {
  it('orders formula fields so dependencies compute first', () => {
    const order = resolveCalculationOrder([
      { key: 'due', formula: 'net_amount - paid_amount' },
      { key: 'net_amount', formula: 'gross_amount - truck_rent' },
      { key: 'gross_amount', formula: 'weight * rate' }
    ])
    expect(order.indexOf('gross_amount')).toBeLessThan(order.indexOf('net_amount'))
    expect(order.indexOf('net_amount')).toBeLessThan(order.indexOf('due'))
  })

  it('detects a direct circular dependency', () => {
    expect(() =>
      resolveCalculationOrder([
        { key: 'a', formula: 'b + 1' },
        { key: 'b', formula: 'a - 1' }
      ])
    ).toThrow(CircularDependencyError)
  })

  it('detects a self-referencing formula', () => {
    expect(() => resolveCalculationOrder([{ key: 'a', formula: 'a + 1' }])).toThrow(CircularDependencyError)
  })

  it('detects an indirect (3-node) cycle', () => {
    expect(() =>
      resolveCalculationOrder([
        { key: 'a', formula: 'b + 1' },
        { key: 'b', formula: 'c + 1' },
        { key: 'c', formula: 'a + 1' }
      ])
    ).toThrow(CircularDependencyError)
  })
})

describe('formula engine: validation', () => {
  it('rejects formulas referencing unknown fields', () => {
    const result = validateFormula('unknown_field * 2', ['weight', 'rate'])
    expect(result.valid).toBe(false)
  })

  it('accepts formulas referencing only known fields', () => {
    const result = validateFormula('weight * rate', ['weight', 'rate'])
    expect(result.valid).toBe(true)
  })
})

describe('field key rename cascade (word-boundary safety)', () => {  // Mirrors the regex used in server/api/fields/[id].patch.ts when a
  // field's key is renamed: dependent formulas must be updated safely,
  // without accidentally matching a key that is a substring of another
  // (e.g. renaming "w" must not corrupt a formula using "weight").
  function cascadeRename(formula: string, oldKey: string, newKey: string): string {
    const wordBoundary = new RegExp(`\\b${oldKey}\\b`, 'g')
    return formula.replace(wordBoundary, newKey)
  }

  it('replaces a whole-word key reference', () => {
    expect(cascadeRename('w * r', 'w', 'weight')).toBe('weight * r')
  })

  it('does not corrupt a longer key that contains the renamed key as a substring', () => {
    expect(cascadeRename('weight * r', 'w', 'weight_2')).toBe('weight * r')
  })

  it('replaces every occurrence of the key in a formula', () => {
    expect(cascadeRename('w + w - r', 'w', 'weight')).toBe('weight + weight - r')
  })
})

describe('formula engine: full row computation', () => {
  it('computes an entire row of formula fields in the correct order', () => {
    const formulaFields = [
      { key: 'due', formula: 'net_amount - paid_amount' },
      { key: 'net_amount', formula: 'gross_amount - truck_rent' },
      { key: 'gross_amount', formula: 'weight * rate' }
    ]
    const result = computeRow(
      [],
      ['weight', 'rate', 'truck_rent', 'paid_amount', 'gross_amount', 'net_amount', 'due'],
      formulaFields,
      { weight: 1000, rate: 30, truck_rent: 500, paid_amount: 20000 }
    )
    expect(result.gross_amount.toNumber()).toBe(30000)
    expect(result.net_amount.toNumber()).toBe(29500)
    expect(result.due.toNumber()).toBe(9500)
  })
})
