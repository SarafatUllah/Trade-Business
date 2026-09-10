import { describe, it, expect } from 'vitest'

// Mirrors findMissingRequiredFields in server/utils/fields.ts. Duplicated
// here (rather than imported) because that module also imports the Prisma
// client at module scope, which isn't available in this test environment;
// the logic itself is a pure predicate worth locking in with a regression
// test after the bug it fixes.
interface FieldDef { key: string; isRequired: boolean; type: string }

function findMissingRequiredFields(fields: FieldDef[], values: Record<string, unknown>): FieldDef[] {
  return fields.filter(f => {
    if (!f.isRequired || f.type === 'FORMULA') return false
    const v = values[f.key]
    if (f.type === 'BOOLEAN') return v === undefined || v === null
    return v === undefined || v === null || v === ''
  })
}

describe('required field validation (regression: empty string used to pass as "present")', () => {
  const fields: FieldDef[] = [
    { key: 'mill_name', isRequired: true, type: 'TEXT' },
    { key: 'amount', isRequired: true, type: 'CURRENCY' },
    { key: 'is_urgent', isRequired: true, type: 'BOOLEAN' },
    { key: 'notes', isRequired: false, type: 'LONG_TEXT' }
  ]

  it('flags a required field submitted as an empty string as missing', () => {
    // This is the exact bug: every dynamic-field form seeds inputs to ''
    // rather than leaving them undefined, so the OLD check
    // (`!(key in values)`) always saw the key present and let it through.
    const values = { mill_name: '', amount: '', is_urgent: false, notes: '' }
    const missing = findMissingRequiredFields(fields, values)
    expect(missing.map(f => f.key).sort()).toEqual(['amount', 'mill_name'])
  })

  it('flags a required field missing entirely from the payload', () => {
    const missing = findMissingRequiredFields(fields, { is_urgent: true })
    expect(missing.map(f => f.key).sort()).toEqual(['amount', 'mill_name'])
  })

  it('does not flag a required field with a real value', () => {
    const values = { mill_name: 'ABC Mill', amount: 1000, is_urgent: false }
    const missing = findMissingRequiredFields(fields, values)
    expect(missing).toEqual([])
  })

  it('treats boolean false as a valid, deliberate value — never "missing"', () => {
    const values = { mill_name: 'ABC Mill', amount: 1000, is_urgent: false }
    const missing = findMissingRequiredFields(fields, values)
    expect(missing.find(f => f.key === 'is_urgent')).toBeUndefined()
  })

  it('never flags optional fields regardless of value', () => {
    const values = { mill_name: 'ABC Mill', amount: 1000, is_urgent: true, notes: '' }
    const missing = findMissingRequiredFields(fields, values)
    expect(missing).toEqual([])
  })

  it('never flags formula fields (never user-entered, always derived)', () => {
    const withFormula: FieldDef[] = [...fields, { key: 'net_amount', isRequired: true, type: 'FORMULA' }]
    const values = { mill_name: 'ABC Mill', amount: 1000, is_urgent: false }
    const missing = findMissingRequiredFields(withFormula, values)
    expect(missing.find(f => f.key === 'net_amount')).toBeUndefined()
  })
})
