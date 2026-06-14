// Helpers for the order forms, where unit values are typed as decimal strings
// (accepting both "." and "," as the separator) and subtotals are derived in
// integer cents to avoid floating-point drift.

export function parseAmount(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : n;
}

export function computeSubtotal(unitValue: string, quantity: number): number {
  const qty = Math.max(0, Math.floor(Number(quantity)));
  return (Math.round(parseAmount(unitValue) * 100) * qty) / 100;
}

// Formats a number as a pt-BR amount without a currency symbol (e.g. "1.250,00").
export function formatAmount(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
