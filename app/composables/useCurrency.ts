export function useCurrency() {
  const auth = useAuthStore()
  function format(value: number | null | undefined): string {
    const amount = value ?? 0
    const currency = auth.business?.currency ?? 'BDT'
    const symbols: Record<string, string> = { BDT: '৳', USD: '$', INR: '₹', EUR: '€', GBP: '£' }
    const symbol = symbols[currency] ?? currency + ' '
    return symbol + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return { format }
}
