"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select, Label } from "@/components/ui/input";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import { useAccounts } from "@/lib/hooks/use-accounts";
import {
  useBulkCreateTransactions,
  useExistingTransactionKeys,
} from "@/lib/hooks/use-csv-import";
import { parseCsv, type ParsedCsvRow } from "@/lib/csv";

type PreviewRow = ParsedCsvRow & { selected: boolean; isDuplicate: boolean };

export default function ImportCsvPage() {
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts();
  const bulkCreate = useBulkCreateTransactions();

  const [accountId, setAccountId] = useState("");
  const { data: existingKeys } = useExistingTransactionKeys(accountId || null);
  const existingKeySet = useMemo(() => new Set(existingKeys ?? []), [existingKeys]);

  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setImportError(null);
    setImportedCount(null);
    setRows(null);

    const text = await file.text();
    const result = parseCsv(text);

    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    if (result.rows.length === 0) {
      setParseError("El CSV no tiene filas válidas.");
      return;
    }

    setRows(
      result.rows.map((row) => {
        const key = `${row.date}:${Math.abs(row.amount).toFixed(2)}:${selectedAccount?.currency ?? ""}`;
        const isDuplicate = existingKeySet.has(key);
        return { ...row, isDuplicate, selected: !isDuplicate };
      }),
    );
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev
        ? prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
        : prev,
    );
  }

  async function handleImport() {
    setImportError(null);
    if (!household || !selectedAccount || !rows) return;

    const toImport = rows.filter((r) => r.selected);
    if (toImport.length === 0) {
      setImportError("No hay filas seleccionadas para importar.");
      return;
    }

    try {
      await bulkCreate.mutateAsync(
        toImport.map((row) => ({
          household_id: household.household_id,
          account_id: selectedAccount.id,
          category_id: null,
          type: row.amount < 0 ? "expense" : "income",
          amount: Math.abs(row.amount),
          currency: selectedAccount.currency,
          description: row.description || null,
          transaction_date: row.date,
          source: "csv",
        })),
      );
      setImportedCount(toImport.length);
      setRows(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Error al importar las transacciones",
      );
    }
  }

  const duplicateCount = rows?.filter((r) => r.isDuplicate).length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Icon name="upload_file" className="text-primary" filled />
          Importar CSV
        </h1>
        <button
          onClick={() => router.push("/transactions")}
          className="text-xs text-on-surface-variant hover:text-on-surface underline"
        >
          Volver a Transacciones
        </button>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <Label>Cuenta</Label>
            <Select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setRows(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <option value="">Elegir...</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
            <p className="text-on-surface-variant text-xs mt-1">
              El archivo se importa como movimientos de esta cuenta, en su
              moneda.
            </p>
          </div>

          <div>
            <Label>Archivo CSV</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={!accountId}
              onChange={handleFileChange}
              className="block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-on-secondary-container file:font-medium disabled:opacity-50"
            />
            <p className="text-on-surface-variant text-xs mt-1">
              Columnas esperadas: fecha, descripción, monto (negativo = gasto,
              positivo = ingreso).
            </p>
          </div>

          {!accountId && (
            <p className="text-sm text-on-surface-variant">
              Elegí una cuenta antes de subir el archivo.
            </p>
          )}
          {parseError && (
            <p className="text-sm text-error" role="alert">
              {parseError}
            </p>
          )}
          {importedCount !== null && (
            <p className="text-sm text-secondary">
              {importedCount} transacciones importadas correctamente.
            </p>
          )}
        </div>
      </Card>

      {rows && rows.length > 0 && (
        <>
          {duplicateCount > 0 && (
            <p className="text-on-surface-variant text-sm mb-3">
              {duplicateCount} fila(s) parecen ya existir en esta cuenta
              (misma fecha, monto y moneda) — quedaron destildadas, tildalas
              si igual querés importarlas.
            </p>
          )}

          <Card className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant font-mono text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-2"></th>
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Descripción</th>
                  <th className="pb-2 pr-4 text-right">Monto</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-outline-variant/10">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(i)}
                      />
                    </td>
                    <td className="py-2 pr-4 text-on-surface font-mono">
                      {row.date}
                    </td>
                    <td className="py-2 pr-4 text-on-surface">
                      {row.description}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right font-mono ${
                        row.amount < 0 ? "text-on-surface" : "text-secondary"
                      }`}
                    >
                      {row.amount.toFixed(2)}
                    </td>
                    <td className="py-2 text-xs text-error">
                      {row.isDuplicate ? "posible duplicado" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {importError && (
            <p className="text-sm text-error mb-3" role="alert">
              {importError}
            </p>
          )}

          <Button onClick={handleImport} disabled={bulkCreate.isPending}>
            {bulkCreate.isPending
              ? "Importando..."
              : `Importar ${rows.filter((r) => r.selected).length} transacciones`}
          </Button>
        </>
      )}
    </div>
  );
}
