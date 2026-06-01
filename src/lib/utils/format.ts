export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  let d: Date
  if (typeof date === 'string') {
    // Date-only "YYYY-MM-DD" → add local time to avoid timezone shift
    d = date.length === 10 ? new Date(date + 'T00:00:00') : new Date(date)
  } else {
    d = date
  }
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate + 'T00:00:00') < new Date(today() + 'T00:00:00')
}
