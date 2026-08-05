export type Period = 'today' | 'yesterday' | 'week' | 'month';

/** Convierte una fecha a 'YYYY-MM-DD' (hora local del navegador). */
export function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Calcula el rango [desde, hasta] (ambos inclusive) para un preset de período. */
export function datesForPeriod(p: Period): [string, string] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (p) {
    case 'today':
      return [toISO(today), toISO(today)];
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return [toISO(y), toISO(y)];
    }
    case 'week': {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      return [toISO(w), toISO(today)];
    }
    case 'month': {
      const m = new Date(today);
      m.setDate(m.getDate() - 29);
      return [toISO(m), toISO(today)];
    }
  }
}
