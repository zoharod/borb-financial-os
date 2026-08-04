export const CURRENCIES = ["HNL", "USD"] as const;

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Ahorro" },
  { value: "credit_card", label: "Tarjeta de crédito" },
] as const;

export const SUGGESTED_CATEGORIES = [
  "Comida",
  "Transporte",
  "Vivienda",
  "Servicios",
  "Salud",
  "Entretenimiento",
] as const;

// Ver architecture.md "Transferencias y tipos de transacción (Fase 1-C)"
// para la semántica completa de cada tipo (qué cuenta como ingreso/gasto).
export const TRANSACTION_TYPES = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
  { value: "card_payment", label: "Pago de tarjeta" },
  { value: "refund", label: "Devolución" },
  { value: "adjustment", label: "Ajuste" },
] as const;

// Tipos que mueven plata entre dos cuentas propias (requieren cuenta destino).
export const TRANSFER_LIKE_TYPES = ["transfer", "card_payment"] as const;
