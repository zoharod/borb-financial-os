import type { TransactionWithRelations } from "@/lib/hooks/use-transactions";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTransactionsToCsv(
  transactions: TransactionWithRelations[],
) {
  const header = [
    "fecha",
    "tipo",
    "monto",
    "moneda",
    "cuenta",
    "cuenta_destino",
    "categoria",
    "descripcion",
  ];
  const rows = transactions.map((t) =>
    [
      t.transaction_date,
      t.type,
      String(t.amount),
      t.currency,
      t.accounts?.name ?? "",
      t.to_account?.name ?? "",
      t.categories?.name ?? "",
      t.description ?? "",
    ].map(escapeCsvField),
  );

  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `borb-transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
