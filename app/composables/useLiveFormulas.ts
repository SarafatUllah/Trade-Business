import { resolveCalculationOrder, evaluateFormula, type FormulaFieldDef } from '../../server/utils/formula'

export interface LiveFieldDef {
  key: string
  type: string
  formula?: string | null
}

/**
 * Computes formula field values live in the browser as the user types,
 * using the exact same engine as the server (same file, imported
 * directly — decimal.js formula/money logic has no server-only
 * dependencies). This is purely a live preview: the server always
 * recomputes and is the source of truth on save.
 */
export function useLiveFormulas(fields: Ref<LiveFieldDef[]>, values: Record<string, unknown>) {
  const computed_ = computed(() => {
    const formulaFields: FormulaFieldDef[] = fields.value
      .filter(f => f.type === 'FORMULA' && f.formula)
      .map(f => ({ key: f.key, formula: f.formula as string }))

    const result: Record<string, number> = {}
    try {
      const order = resolveCalculationOrder(formulaFields)
      for (const key of order) {
        const def = formulaFields.find(f => f.key === key)!
        result[key] = evaluateFormula(def.formula, { ...values, ...result }).toNumber()
      }
    } catch {
      // Invalid/circular formula config — leave preview blank rather than crash the form.
    }
    return result
  })

  return computed_
}
