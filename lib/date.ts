export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
