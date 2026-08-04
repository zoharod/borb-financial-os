# domain.md — Modelo de dominio: cuentas, tarjetas, transferencias, pagos

> Documento de diseño conceptual, complementario a `architecture.md` (que tiene el schema SQL exacto y las decisiones ya implementadas). Este archivo define **cómo se van a representar** cuentas, tarjetas, transferencias y pagos de tarjeta de cara a Fase 2 (Tarjetas y Cashback), para que esa fase extienda el modelo de Fase 1-C sin necesitar rediseñarlo. Nada de lo que dice "Fase 2" acá está implementado todavía — es la base para no improvisar el schema cuando esa fase arranque.

## Cuentas (`accounts`) — ya implementado (Fase 1-C)

Una cuenta es un contenedor de plata con un saldo que se **deriva** de `transactions` (nunca se edita directo — ver "Principio de diseño" en `architecture.md`). Tres tipos:

- `checking` / `savings`: saldo positivo = plata que tenés.
- `credit_card`: mismo mecanismo de cálculo, pero la lectura es distinta — **saldo negativo = lo que debés**, saldo positivo o cero = no debés nada (o tenés a favor). No hay un campo separado de "deuda"; es el mismo saldo derivado de `transactions`, con signo invertido en su interpretación.

Esto ya funciona hoy: una compra con tarjeta se puede cargar como `type='expense'` con `account_id` = la cuenta `credit_card` (la resta de esa transacción deja el saldo de la cuenta más negativo, reflejando más deuda), aunque todavía no hay UI que lo sugiera activamente ni cálculo de cashback sobre eso — ver "Fase 2" abajo.

## Transferencias — ya implementado (Fase 1-C)

`type='transfer'`, con `to_account_id` (cuenta destino) obligatorio. Mueve saldo entre 2 cuentas del mismo household y la misma moneda (validado por trigger en la base, no solo en la app — ver `architecture.md` → "Transferencias y tipos de transacción"). No cuenta como ingreso ni gasto.

## Pagos de tarjeta — ya implementado (Fase 1-C)

`type='card_payment'`, se comporta exactamente como una transferencia (mismo mecanismo de `to_account_id`), pero la cuenta destino debe ser `type='credit_card'`. Reduce la deuda (el saldo de la cuenta tarjeta se vuelve menos negativo). No cuenta como gasto nuevo — la UI y los agregados ya lo tratan igual que `transfer` a propósito, evitando duplicar el gasto que ya se registró (o se registrará, ver Fase 2) cuando se hizo la compra.

## Tarjetas (`cards`) — implementada (onboarding refinado); cashback sigue siendo Fase 2

Una **tarjeta** es distinta de una **cuenta `credit_card`**: la cuenta es el libro contable (cuánto debés, ya funciona desde Fase 1-C); la tarjeta es la identidad física/virtual con sus reglas propias (límite, cashback, ciclo de facturación). La tabla `cards` se creó antes de lo previsto en este documento, como parte del onboarding refinado (no de Fase 2) — la relación terminó siendo **1:N, no 1:1** como se había propuesto acá originalmente:

```sql
-- YA IMPLEMENTADO (migración 20260804110528)
cards (
  id uuid pk,
  household_id uuid fk,
  name text, -- "Visa Signature BAC"
  bank text null,
  cardholder text null,
  network text null, -- check: 'visa' | 'mastercard' | 'amex' | 'other'
  last4 text null,
  credit_limit numeric null,
  statement_closing_day int null, -- día del mes 1-31
  payment_due_day int null,
  minimum_payment numeric null,
  full_payment_amount numeric null,
  created_at timestamptz
)

-- accounts gana card_id (nullable, on delete set null) en vez de cards.account_id
```

**Por qué 1:N (hasta 2 cuentas por tarjeta) y no 1:1:** una tarjeta puede tener saldo/deuda en más de una moneda (ej. una tarjeta BAC con consumos en HNL y en USD) — modelarla como `accounts.card_id -> cards.id` (en vez de `cards.account_id -> accounts.id` único) permite que el wizard de onboarding cree **una fila de `accounts` (`type='credit_card'`) por cada moneda en la que el usuario cargó saldo**, todas apuntando a la misma tarjeta, sin forzar a combinar HNL y USD en un solo número ni a elegir una tarjeta "por moneda" artificialmente. El saldo de cada cuenta-tarjeta sigue siendo el mismo mecanismo de siempre (derivado de `transactions`, negativo = deuda) — `cards` solo agrega la metadata que no varía por moneda (nombre, banco, ciclo de facturación, límite, pagos).

**Todavía no implementado (sigue siendo Fase 2):** `card_cashback_rules` y el uso de `transactions.card_id` para vincular compras a una tarjeta específica — ver siguiente sección, sin cambios respecto al plan original.

```sql
-- Propuesta Fase 2, NO IMPLEMENTADO — revisar antes de migrar
card_cashback_rules (
  id uuid pk,
  card_id uuid fk -> cards,
  category_id uuid fk -> categories null, -- null = regla "default" (cualquier categoría sin regla específica)
  cashback_pct numeric, -- ej. 0.05 = 5%
  monthly_cap numeric null,
  created_at timestamptz
)
```

Por qué separar `cards` de `accounts` en vez de meterle más columnas a `accounts`: el saldo/deuda ya es un concepto genérico de cuenta (funciona igual para cualquier `credit_card` sin necesitar reglas de cashback), mientras que límite/ciclo/cashback son metadata específica de tarjeta que no aplica a `checking`/`savings`. Mantenerlos separados evita ensuciar `accounts` con columnas que están `null` para la mayoría de las filas.

## Subida de estado de cuenta (extracción) — preparado en el schema, no implementado

El paso de onboarding de tarjetas incluye un input de archivo ("Subir tu último estado de cuenta") que hoy solo muestra un mensaje de "próximamente" — no parsea nada ni guarda el archivo. Cuando se implemente (fase de importación de estados de cuenta, todavía sin numerar en el roadmap):

- Todos los campos que un parser necesitaría llenar (banco, últimos 4, tarjetahabiente, período/día de corte, día de pago, saldo por moneda, pago mínimo, pago de contado, límite) **ya existen** en `cards`/`accounts` — no debería hacer falta otra migración de schema para el caso básico.
- **Regla de producto ya decidida (no reabrir sin razón nueva):** los datos extraídos se muestran siempre para revisión del usuario antes de guardar — nunca un guardado silencioso. El usuario debe poder Confirmar, Corregir, Completar campos faltantes, o Descartar (Skip) la extracción.
- Transacciones recientes extraídas del estado de cuenta (si el parser las soporta) seguirían insertándose como `transactions` normales — no necesitan una tabla nueva, mismo mecanismo que la importación CSV de Fase 1-B.

## Compras con tarjeta — Fase 2, no implementado

Una compra con tarjeta sigue siendo `type='expense'` con `account_id` = la cuenta `credit_card` correspondiente (esto ya funciona, ver arriba). Lo que agrega Fase 2 es usar la columna `card_id` de `transactions` (reservada desde Fase 0, sin uso hasta ahora) para vincular la compra a una fila de `cards` específica — necesario para:

- Calcular cashback: `SUM(expense.amount * card_cashback_rules.cashback_pct)` por categoría, tope `monthly_cap`, filtrando `transactions.card_id = X`.
- Recomendar qué tarjeta usar: dada una categoría, comparar el cashback restante disponible (contra el `monthly_cap`) entre las tarjetas del household.

**Decisión pendiente para cuando arranque Fase 2:** ¿el cashback se calcula solo sobre gastos con `card_id` explícito, o se infiere de cualquier `expense` cuya `account_id` sea una cuenta `credit_card` sin `card_id`? Recomendación: exigir `card_id` explícito desde el día 1 de Fase 2 (más simple, sin ambigüedad) y no intentar inferencia retroactiva sobre datos viejos.

## Fuera de alcance explícito de este documento

- Múltiples tarjetas compartiendo el mismo cupo/cuenta (tarjetas adicionales/suplementarias) — no se modela, asumir 1 tarjeta = 1 cuenta.
- Intereses, moras, o fechas de corte con lógica de facturación real — Fase 2 solo cubre cashback y recomendación de tarjeta, no un motor de facturación bancaria completo.
- Conversión de moneda en pagos de tarjeta — sigue la misma regla que transferencias (misma moneda obligatoria, ver `architecture.md` → "Moneda").
