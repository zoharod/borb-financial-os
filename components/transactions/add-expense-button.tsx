"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "@/components/transactions/transaction-form";
import type { TRANSACTION_TYPES } from "@/lib/constants";

type TxType = (typeof TRANSACTION_TYPES)[number]["value"];

// Acción rápida de transacción — pedida explícitamente para que registrar un
// movimiento no dependa de navegar a /transactions primero. Parametrizable
// por tipo para cubrir las 4 acciones rápidas del dashboard ("Agregar gasto",
// "Agregar ingreso", "Transferir", "Pagar tarjeta") con un solo componente.
export function AddExpenseButton({
  className = "",
  type = "expense",
  label = "Agregar gasto",
  icon = "add",
  variant = "primary",
}: {
  className?: string;
  type?: TxType;
  label?: string;
  icon?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={className}>
        <Icon name={icon} size={18} />
        {label}
      </Button>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <TransactionForm defaultType={type} onSuccess={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
