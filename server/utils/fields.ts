import type { FieldDefinition, FieldEntity } from '@prisma/client'
import { prisma } from './prisma'
import { resolveCalculationOrder, evaluateFormula, type FormulaFieldDef } from './formula'
import { toApiNumber } from './money'

export async function getActiveFields(businessId: string, entity: FieldEntity): Promise<FieldDefinition[]> {
  return prisma.fieldDefinition.findMany({
    where: { businessId, entity, isArchived: false },
    orderBy: { sortOrder: 'asc' }
  })
}

/** Persist raw (non-formula) custom field values for a record. Formula
 *  fields are never written directly — they are always derived. */
export async function setFieldValues(
  fields: FieldDefinition[],
  recordId: string,
  rawValues: Record<string, unknown>
) {
  const writable = fields.filter(f => f.type !== 'FORMULA' && f.key in rawValues)
  await prisma.$transaction(
    writable.map(field => {
      const value = rawValues[field.key]
      const data: Record<string, unknown> = {}
      switch (field.type) {
        case 'NUMBER':
        case 'CURRENCY':
          data.numberValue = value === null || value === undefined || value === '' ? null : value.toString()
          break
        case 'DATE':
        case 'DATETIME':
          data.dateValue = value ? new Date(value as string) : null
          break
        case 'BOOLEAN':
          data.boolValue = value === null || value === undefined ? null : Boolean(value)
          break
        default:
          data.stringValue = value === null || value === undefined ? null : String(value)
      }
      return prisma.customFieldValue.upsert({
        where: { fieldId_recordId: { fieldId: field.id, recordId } },
        create: { fieldId: field.id, recordId, ...data },
        update: data
      })
    })
  )
}

/** Reads raw stored values for a record, keyed by field.key. */
export async function getRawFieldValues(fields: FieldDefinition[], recordId: string): Promise<Record<string, unknown>> {
  const values = await prisma.customFieldValue.findMany({
    where: { recordId, fieldId: { in: fields.map(f => f.id) } }
  })
  const byFieldId = new Map(values.map(v => [v.fieldId, v]))
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    const v = byFieldId.get(field.id)
    if (!v) { result[field.key] = null; continue }
    if (field.type === 'NUMBER' || field.type === 'CURRENCY') result[field.key] = v.numberValue ? toApiNumber(v.numberValue) : null
    else if (field.type === 'DATE' || field.type === 'DATETIME') result[field.key] = v.dateValue
    else if (field.type === 'BOOLEAN') result[field.key] = v.boolValue
    else result[field.key] = v.stringValue
  }
  return result
}

/** Reads raw values and computes every formula field in dependency order,
 *  returning a flat key -> display value map. Never throws on incomplete
 *  data or circular refs it hasn't already validated at save-time. */
export async function getComputedFieldValues(fields: FieldDefinition[], recordId: string): Promise<Record<string, unknown>> {
  const raw = await getRawFieldValues(fields, recordId)
  const formulaFields: FormulaFieldDef[] = fields
    .filter(f => f.type === 'FORMULA' && f.formula)
    .map(f => ({ key: f.key, formula: f.formula as string }))

  const order = resolveCalculationOrder(formulaFields)
  const result: Record<string, unknown> = { ...raw }
  for (const key of order) {
    const def = formulaFields.find(f => f.key === key)!
    const computed = evaluateFormula(def.formula, result)
    result[key] = toApiNumber(computed)
  }
  return result
}

/** A required field is "missing" if its value is absent, null, or an
 *  empty string — NOT merely if the key doesn't exist on the payload.
 *  (Bug fix: the previous check only looked at key presence, so a field
 *  explicitly submitted as '' — which every dynamic-field form does,
 *  since inputs are seeded to '' rather than left undefined — always
 *  passed as "present" even when genuinely empty.) BOOLEAN false is a
 *  valid, deliberate value and is never treated as missing. */
export function findMissingRequiredFields(fields: FieldDefinition[], values: Record<string, unknown>): FieldDefinition[] {
  return fields.filter(f => {
    if (!f.isRequired || f.type === 'FORMULA') return false
    const v = values[f.key]
    if (f.type === 'BOOLEAN') return v === undefined || v === null
    return v === undefined || v === null || v === ''
  })
}
