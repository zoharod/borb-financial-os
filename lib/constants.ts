export const CURRENCIES = ["HNL", "USD"] as const;

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Ahorro" },
  { value: "credit_card", label: "Tarjeta de crédito" },
] as const;

// Categorías sugeridas en el Paso 4 del onboarding ("Configurá tu
// presupuesto mensual") — a diferencia de Fase 1, acá el usuario les asigna
// un monto al elegirlas, no solo las crea para clasificar gasto futuro.
export const BUDGET_CATEGORIES = [
  "Renta o alquiler",
  "Electricidad",
  "Internet",
  "Supermercado",
  "Gasolina",
  "Farmacia",
  "Citas médicas",
  "Restaurantes",
  "Entretenimiento",
  "Suscripciones",
  "Gastos personales",
  "Inversiones",
] as const;

// Nombre exacto de la categoría "cajón de sastre" — ver architecture.md
// "Multi-tenancy" / categories.is_extra_default.
export const EXTRA_CATEGORY_NAME = "Extras o imprevistos";

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

export const CARD_NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "other", label: "Otra" },
] as const;
