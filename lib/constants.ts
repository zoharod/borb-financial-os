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
  { value: "financing_installment", label: "Cuota de financiamiento" },
] as const;

// Tipos que mueven plata entre dos cuentas propias (requieren cuenta destino).
export const TRANSFER_LIKE_TYPES = ["transfer", "card_payment"] as const;

export const CARD_NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "other", label: "Otra" },
] as const;

export const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
] as const;

export const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "31/12/2026" },
  { value: "MM/DD/YYYY", label: "12/31/2026" },
  { value: "YYYY-MM-DD", label: "2026-12-31" },
] as const;

export const NUMBER_FORMATS = [
  { value: "es-HN", label: "1.234,56 (Latinoamérica)" },
  { value: "en-US", label: "1,234.56 (EE. UU.)" },
] as const;

export const TIMEZONES = [
  { value: "America/Tegucigalpa", label: "Honduras (America/Tegucigalpa)" },
  { value: "America/Guatemala", label: "Guatemala (America/Guatemala)" },
  { value: "America/El_Salvador", label: "El Salvador (America/El_Salvador)" },
  { value: "America/New_York", label: "EE. UU. Este (America/New_York)" },
] as const;

export const HOUSEHOLD_ROLES = [
  {
    value: "owner",
    label: "Dueño",
    description: "Control total: hogar, miembros y datos financieros.",
  },
  {
    value: "admin",
    label: "Administrador",
    description: "Gestiona datos financieros e invita miembros.",
  },
  {
    value: "member",
    label: "Miembro",
    description: "Gestiona datos financieros compartidos.",
  },
  {
    value: "viewer",
    label: "Solo lectura",
    description: "Puede ver todo, no puede crear ni editar nada.",
  },
] as const;

export const INVITABLE_ROLES = HOUSEHOLD_ROLES.filter(
  (r) => r.value !== "owner",
);

export const BUDGET_PERIODS = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
] as const;
