/** Formatea un número como moneda MXN, ej. $1,234.50 */
export function formatCurrencyMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(n || 0);
}

/** Formato corto para ejes/etiquetas, ej. $1.2k */
export function formatCurrencyShort(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n || 0)}`;
}
