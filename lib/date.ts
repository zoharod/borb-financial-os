export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Avanza una fecha ISO según la frecuencia de un compromiso financiero, para
// calcular el próximo next_payment_date después de marcar una cuota como
// pagada. "one_time" devuelve null (no hay próxima cuota).
export function advanceDate(dateISO: string, frequency: string): string | null {
  const [year, month, day] = dateISO.split("-").map(Number);
  // new Date(y, m, d) normaliza overflow de días/meses sola (ej. mes=13 pasa
  // a enero del año siguiente), así que sumar directo sobre los componentes
  // numéricos es seguro para las 3 frecuencias periódicas.
  switch (frequency) {
    case "weekly": {
      const d = new Date(year, month - 1, day + 7);
      return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    case "biweekly": {
      const d = new Date(year, month - 1, day + 14);
      return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    case "monthly": {
      const d = new Date(year, month, day);
      return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    case "one_time":
    default:
      return null;
  }
}

// Próxima fecha real para un "día del mes" (ej. día de pago de tarjeta = 15):
// si ese día ya pasó este mes, cae en el mes siguiente. Recorta al último día
// del mes cuando el día pedido no existe (ej. día 31 en febrero).
export function nextOccurrenceOfDay(day: number, from = new Date()): string {
  const year = from.getFullYear();
  const month = from.getMonth(); // 0-indexed
  const clampedThisMonth = Math.min(day, new Date(year, month + 1, 0).getDate());
  if (clampedThisMonth >= from.getDate()) {
    return isoDate(year, month + 1, clampedThisMonth);
  }
  const nextMonthDays = new Date(year, month + 2, 0).getDate();
  return isoDate(year, month + 2, Math.min(day, nextMonthDays));
}
