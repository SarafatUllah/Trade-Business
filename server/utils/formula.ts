import Decimal from 'decimal.js'
import { add, subtract, multiply, divide, toMoney } from './money'

// ============================================================
// Dynamic Formula Engine
//
// Users build formulas like:  (gross_amount - truck_rent) / 2
// referencing other field `key`s. This module:
//   1. Tokenizes + parses the expression into an AST (no `eval`/`Function`
//      constructor — arbitrary code execution from user text is never safe).
//   2. Extracts field-key dependencies from a formula.
//   3. Topologically sorts a set of formula fields, detecting cycles.
//   4. Evaluates an AST given a map of field key -> current value.
// ============================================================

export type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'EOF'
export interface Token {
  type: TokenType
  value: string
}

export class FormulaError extends Error {}

const OPS = new Set(['+', '-', '*', '/'])

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const src = expr.trim()
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: ch }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ch }); i++; continue }
    if (OPS.has(ch)) { tokens.push({ type: 'OP', value: ch }); i++; continue }
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ type: 'NUMBER', value: src.slice(i, j) })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push({ type: 'IDENT', value: src.slice(i, j) })
      i = j
      continue
    }
    throw new FormulaError(`Unexpected character "${ch}" in formula`)
  }
  tokens.push({ type: 'EOF', value: '' })
  return tokens
}

export type AstNode =
  | { kind: 'num'; value: string }
  | { kind: 'ref'; key: string }
  | { kind: 'bin'; op: string; left: AstNode; right: AstNode }
  | { kind: 'neg'; value: AstNode }

// Recursive-descent parser implementing standard precedence:
//   expr := term (('+'|'-') term)*
//   term := factor (('*'|'/') factor)*
//   factor := NUMBER | IDENT | '(' expr ')' | '-' factor
class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek() { return this.tokens[this.pos] }
  private next() { return this.tokens[this.pos++] }

  parse(): AstNode {
    const node = this.parseExpr()
    if (this.peek().type !== 'EOF') {
      throw new FormulaError(`Unexpected token "${this.peek().value}"`)
    }
    return node
  }

  private parseExpr(): AstNode {
    let node = this.parseTerm()
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value
      node = { kind: 'bin', op, left: node, right: this.parseTerm() }
    }
    return node
  }

  private parseTerm(): AstNode {
    let node = this.parseFactor()
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.next().value
      node = { kind: 'bin', op, left: node, right: this.parseFactor() }
    }
    return node
  }

  private parseFactor(): AstNode {
    const tok = this.peek()
    if (tok.type === 'OP' && tok.value === '-') {
      this.next()
      return { kind: 'neg', value: this.parseFactor() }
    }
    if (tok.type === 'NUMBER') {
      this.next()
      return { kind: 'num', value: tok.value }
    }
    if (tok.type === 'IDENT') {
      this.next()
      return { kind: 'ref', key: tok.value }
    }
    if (tok.type === 'LPAREN') {
      this.next()
      const node = this.parseExpr()
      if (this.peek().type !== 'RPAREN') throw new FormulaError('Missing closing parenthesis')
      this.next()
      return node
    }
    throw new FormulaError(`Unexpected token "${tok.value}" in formula`)
  }
}

export function parseFormula(expr: string): AstNode {
  return new Parser(tokenize(expr)).parse()
}

/** Returns the set of field keys referenced by a formula expression. */
export function extractDependencies(expr: string): string[] {
  const ast = parseFormula(expr)
  const deps = new Set<string>()
  function walk(node: AstNode) {
    if (node.kind === 'ref') deps.add(node.key)
    else if (node.kind === 'bin') { walk(node.left); walk(node.right) }
    else if (node.kind === 'neg') walk(node.value)
  }
  walk(ast)
  return [...deps]
}

/** Evaluate a parsed AST given a map of field key -> value. Missing/null
 *  values are treated as 0 (never throw on incomplete rows). Division by
 *  zero safely resolves to 0 rather than Infinity/NaN. */
export function evaluate(ast: AstNode, values: Record<string, unknown>): Decimal {
  switch (ast.kind) {
    case 'num':
      return toMoney(ast.value)
    case 'ref':
      return toMoney(values[ast.key] as any)
    case 'neg':
      return evaluate(ast.value, values).negated()
    case 'bin': {
      const left = evaluate(ast.left, values)
      const right = evaluate(ast.right, values)
      switch (ast.op) {
        case '+': return add(left, right)
        case '-': return subtract(left, right)
        case '*': return multiply(left, right)
        case '/': return divide(left, right)
        default: throw new FormulaError(`Unknown operator "${ast.op}"`)
      }
    }
  }
}

export function evaluateFormula(expr: string, values: Record<string, unknown>): Decimal {
  return evaluate(parseFormula(expr), values)
}

// ------------------------------------------------------------
// Dependency resolution across a whole set of formula fields
// ------------------------------------------------------------

export interface FormulaFieldDef {
  key: string
  formula: string
}

export class CircularDependencyError extends FormulaError {
  constructor(public cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`)
  }
}

/**
 * Topologically sorts formula fields so each field is calculated only after
 * all fields it depends on. Throws CircularDependencyError if a cycle
 * exists (e.g. A = B + 1, B = A - 1).
 */
export function resolveCalculationOrder(fields: FormulaFieldDef[]): string[] {
  const byKey = new Map(fields.map(f => [f.key, f]))
  const deps = new Map<string, string[]>()
  for (const f of fields) {
    // Only track dependencies on other formula fields; plain input fields
    // are always "ready" and don't participate in the sort.
    deps.set(f.key, extractDependencies(f.formula).filter(k => byKey.has(k)))
  }

  const state = new Map<string, 'unvisited' | 'visiting' | 'done'>()
  for (const f of fields) state.set(f.key, 'unvisited')
  const order: string[] = []
  const path: string[] = []

  function visit(key: string) {
    const s = state.get(key)
    if (s === 'done') return
    if (s === 'visiting') {
      throw new CircularDependencyError([...path, key])
    }
    state.set(key, 'visiting')
    path.push(key)
    for (const dep of deps.get(key) ?? []) visit(dep)
    path.pop()
    state.set(key, 'done')
    order.push(key)
  }

  for (const f of fields) visit(f.key)
  return order
}

/** Validates a formula string without evaluating it: syntax + that every
 *  referenced field key exists in `knownKeys`. */
export function validateFormula(expr: string, knownKeys: string[]): { valid: boolean; error?: string } {
  try {
    const deps = extractDependencies(expr)
    const unknown = deps.filter(d => !knownKeys.includes(d))
    if (unknown.length) {
      return { valid: false, error: `Unknown field reference(s): ${unknown.join(', ')}` }
    }
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Invalid formula' }
  }
}

/**
 * Given all field definitions (input + formula) for an entity and a row's
 * raw input values, computes every formula field's value in dependency
 * order and returns a full key->Decimal map (inputs included, coerced).
 */
export function computeRow(
  fields: FormulaFieldDef[] & { }[],
  allFieldKeys: string[],
  formulaFields: FormulaFieldDef[],
  rawValues: Record<string, unknown>
): Record<string, Decimal> {
  const result: Record<string, Decimal> = {}
  for (const key of allFieldKeys) {
    if (!formulaFields.find(f => f.key === key)) {
      result[key] = toMoney(rawValues[key] as any)
    }
  }
  const order = resolveCalculationOrder(formulaFields)
  for (const key of order) {
    const def = formulaFields.find(f => f.key === key)!
    result[key] = evaluateFormula(def.formula, { ...rawValues, ...result })
  }
  return result
}
