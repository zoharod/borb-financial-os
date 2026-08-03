import Papa from "papaparse";

export type ParsedCsvRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
};

export type ParseCsvResult =
  | { ok: true; rows: ParsedCsvRow[] }
  | { ok: false; error: string };

const DATE_HEADERS = ["fecha", "date"];
const DESCRIPTION_HEADERS = ["descripcion", "descripción", "description", "concepto"];
const AMOUNT_HEADERS = ["monto", "amount"];

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.find((h) => candidates.includes(normalizeHeader(h)));
}

export function parseCsv(text: string): ParseCsvResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    return { ok: false, error: result.errors[0].message };
  }

  const headers = result.meta.fields ?? [];
  const dateCol = findColumn(headers, DATE_HEADERS);
  const descCol = findColumn(headers, DESCRIPTION_HEADERS);
  const amountCol = findColumn(headers, AMOUNT_HEADERS);

  if (!dateCol || !descCol || !amountCol) {
    return {
      ok: false,
      error:
        'El CSV debe tener columnas "fecha", "descripcion" y "monto" (en español o inglés). Encontradas: ' +
        (headers.join(", ") || "ninguna"),
    };
  }

  const rows: ParsedCsvRow[] = [];
  for (const row of result.data) {
    const rawDate = row[dateCol]?.trim();
    const rawAmount = row[amountCol]?.trim();
    const description = row[descCol]?.trim() ?? "";

    if (!rawDate || !rawAmount) continue;

    const amount = Number(rawAmount.replace(/,/g, ""));
    if (Number.isNaN(amount)) {
      return { ok: false, error: `Monto inválido: "${rawAmount}" (fila con fecha ${rawDate})` };
    }

    const date = normalizeDate(rawDate);
    if (!date) {
      return { ok: false, error: `Fecha inválida: "${rawDate}"` };
    }

    rows.push({ date, description, amount });
  }

  return { ok: true, rows };
}

// Acepta YYYY-MM-DD o DD/MM/YYYY (formato común de exports bancarios).
function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}
