# architecture.md — Borb Financial OS

> Fuente técnica de verdad. Basado en PRD.md v1.0 y TDR.md v1.0 (aprobados). Cualquier cambio de arquitectura debe reflejarse aquí antes de implementarse.

## Stack

- **Frontend/Full-stack:** Next.js 16 (App Router, TypeScript estricto, Turbopack)
- **Estilos:** Tailwind CSS v4 (theming vía `@theme` en `app/globals.css`, sin `tailwind.config.js`)
- **Backend/DB/Auth/Storage:** Supabase (Postgres + Auth + Storage, RLS)
- **Hosting:** Vercel (app) + Supabase Cloud (datos)
- **Cache/estado cliente:** TanStack Query + persistencia IndexedDB vía `idb-keyval` (soporte offline simple)

**Nota de versión (Next.js 16):** el archivo de sesión/edge ya no se llama `middleware.ts` sino `proxy.ts` (mismo propósito, convención renombrada). Ver "Sesión / Auth" más abajo.

## Principio de diseño

**Transacciones es la fuente única de verdad.** Todo lo demás (saldos, presupuesto vs. real, flujo de caja, futuros: cashback, metas, reportes) se **deriva** de `transactions`, nunca se edita en paralelo.

## Multi-tenancy (Household)

Cada dato pertenece a un `household_id`. Un hogar tiene 2+ `household_members` (usuarios). RLS obligatorio en toda tabla de datos.

**⚠️ Patrón real (no el ingenuo).** La subquery obvia —`household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())`— **falla con "infinite recursion detected in policy"** en cuanto se aplica como policy de `household_members` sobre sí misma (Postgres no permite que una policy dependa de una subquery sobre la misma tabla que protege, sin importar si hay una rama `OR` sin subquery). Se descubrió en Fase 0 al probar login con 2 households reales — ver `project_state.md`.

**Fix aplicado (usar siempre esta versión):** una función `SECURITY DEFINER`, propiedad de `postgres` (dueño de las tablas), que lee `household_members` sin volver a pasar por RLS:

```sql
create or replace function public.user_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

revoke all on function public.user_household_ids() from public;
grant execute on function public.user_household_ids() to authenticated;

-- Patrón de política RLS a replicar en TODA tabla nueva (incluida household_members)
household_id IN (SELECT public.user_household_ids())
```

Cualquier tabla nueva de una fase futura (`cards`, `goals`, `annual_funds`, etc.) debe usar `public.user_household_ids()` en su policy, no la subquery directa.

## Registro / Onboarding (crear household)

Fase 1 solo tenía login (los 2 households de prueba se crearon a mano vía API con `service_role`, no hay UI de registro). Para que un usuario real pueda entrar solo, se agrega:

- **Auth: Google OAuth** (en vez de email/password) — decisión explícita del usuario, evita además el problema de confirmación de email (Google ya lo verificó). Requiere un cliente OAuth de Google (Client ID + Secret) creado por el usuario en Google Cloud Console y configurado como provider en Supabase Auth.
- **Ruta de callback:** `app/auth/callback/route.ts` — intercambia el `code` del flujo OAuth por una sesión (`exchangeCodeForSession`) y redirige a `/dashboard`.
- **Creación de household al primer login:** mismo problema de "huevo y gallina" que ya resolvimos para RLS — un usuario recién autenticado no pertenece a ningún `household_members` todavía, así que no puede insertar su propio household ni membership desde el cliente (RLS lo bloquea, no hay policy de INSERT en `households` y la de `household_members` requiere ya pertenecer a un household). Se resuelve con otra función `SECURITY DEFINER`:

```sql
-- Firma actual (3 args) — ampliada en el onboarding refinado para setear
-- moneda secundaria y arrancar onboarding_step='accounts' de una vez.
create or replace function public.create_household_for_current_user(
  household_name text,
  primary_currency text default 'HNL',
  household_secondary_currency text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a household';
  end if;

  insert into households (name, base_currency_default, secondary_currency, onboarding_step)
  values (household_name, primary_currency, household_secondary_currency, 'accounts')
  returning id into new_household_id;
  insert into household_members (household_id, user_id, role) values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;
```

- **`use-current-household.ts` usa `.maybeSingle()`, no `.single()`** — con `.single()`, 0 filas es un error (`PGRST116`); un usuario recién logueado sin household todavía necesita que esto devuelva `null` limpiamente, no que explote.

### Onboarding refinado (5 pasos) — reemplaza al wizard de 3 pasos de Fase 1

El wizard original (household → 1 cuenta → categorías) asumía una sola cuenta y no dejaba lugar para tarjetas de crédito ni saldos iniciales. Pedido explícito del usuario para que el onboarding soporte **múltiples cuentas, tarjetas como paso propio (no como "cuenta" genérica), carga de saldo inicial, y que el paso de categorías se entienda como "armar tu presupuesto mensual"** en vez de solo "elegí categorías". `components/onboarding-guard.tsx` ahora es un wizard de **5 pasos**, cada uno su propio componente en `components/onboarding/`:

1. **Household** (`household-step.tsx`) — nombre del hogar, moneda primaria, moneda secundaria opcional (HNL/USD, independientes, sin conversión — ver "Moneda"). Llama a `create_household_for_current_user` (ver abajo, ahora recibe las 2 monedas).
2. **Cuentas** (`accounts-step.tsx`) — **repetible**: el usuario agrega cuentas una por una (nombre, tipo `checking`/`savings`, moneda, institución opcional, saldo actual opcional) con "Agregar cuenta" / "Continuar"; no asume 1 sola cuenta. Requiere ≥1 para avanzar. El saldo actual **no es una columna nueva** — sigue el principio de "transactions es la fuente de verdad": si el usuario carga un saldo, se crea la cuenta y después una transacción `type='adjustment'` por ese monto (mismo mecanismo que la conciliación de Fase 1-C), no un campo `balance` en `accounts`.
3. **Tarjetas de crédito** (`cards-step.tsx`) — paso separado a propósito (no se crean como cuenta `checking`/`savings` genérica). **Repetible** y **opcional** (0 tarjetas es válido, "Continuar" nunca se bloquea). Cada tarjeta crea una fila en la nueva tabla `cards` (nombre, banco, tarjetahabiente, red, últimos 4, límite, día de corte, día de pago, pago mínimo, pago de contado — todos menos nombre/red son opcionales) y **hasta 2 filas en `accounts`** (`type='credit_card'`, `card_id` apuntando a la tarjeta), una por cada moneda en la que el usuario cargó saldo (HNL y/o USD) — así una tarjeta con deuda en ambas monedas no fuerza a combinarlas. El saldo de cada cuenta-tarjeta se siembra igual que en el paso 2, con una transacción `adjustment` **negativa** (saldo negativo = deuda, convención ya establecida en `domain.md`).
   - **Subida de estado de cuenta:** input de archivo presente en la UI ("Subir tu último estado de cuenta"), pero **no hace extracción todavía** — muestra un mensaje de "función disponible próximamente" y no guarda nada. Es intencional para el MVP (ver más abajo); el modelo de datos de `cards` ya tiene todos los campos que un parser de PDF necesitaría llenar el día que se implemente, así que activarlo no va a requerir otra migración.
4. **Presupuesto mensual** (`budget-step.tsx`) — reemplaza al viejo paso de "Categorías". Reencuadrado a propósito: no es "elegí categorías" sino "decidí cuánto vas a gastar este mes en cada una". Chips de categorías sugeridas (`BUDGET_CATEGORIES` en `lib/constants.ts`) + categoría personalizada por texto libre; click en una categoría abre un mini-form inline de monto+moneda que crea la categoría **y** su `budget` del mes actual juntos. Opcional (0 categorías es válido).
5. **Revisión** (`review-step.tsx`) — resumen completo (hogar, cuentas con saldo, tarjetas con deuda por moneda, presupuesto con total por moneda), cada sección con botón "Editar" que vuelve a su paso (ver `editMode` abajo) sin perder lo ya guardado. Botón "Finalizar".

**Por qué el progreso se persiste en una columna (`households.onboarding_step`) y no se infiere de los datos:** a diferencia del wizard de 3 pasos (donde "¿tiene ≥1 cuenta?" alcanzaba para saber en qué paso estaba), acá tarjetas y presupuesto son **opcionales** — un household con 0 tarjetas puede estar legítimamente "ya terminado" o "todavía no llegó a ese paso", y no hay forma de distinguirlo mirando solo si existen filas en `cards`/`budgets`. `onboarding_step` (check constraint: `household`|`accounts`|`cards`|`budget`|`review`|`done`) se actualiza en cada "Continuar" (nunca en "Atrás", que es navegación local nomás). El componente separa `OnboardingGuard` (decide loading / sin household / wizard) de un `OnboardingWizard` interno **keyed por `household.household_id`** con `useState(() => ...)` como inicializador perezoso del paso local — necesario para pasar el lint de este proyecto (`react-hooks/refs` prohíbe leer/escribir `ref.current` durante el render; un `useEffect` para sincronizar el paso inicial también fue rechazado por `react-hooks/set-state-in-effect`).

`editMode` (flag local, no persistido) maneja "Editar desde Revisión": entrar a un paso mediante "Editar" no debe hacer que su "Continuar" avance la secuencia normal, sino volver derecho a Revisión.

**⚠️ Bug real encontrado y corregido (RLS faltante):** `households` solo tenía policy de **SELECT** desde su creación en Fase 0 — nunca había hecho falta un UPDATE desde el cliente hasta agregar `onboarding_step`. Al agregar `useUpdateOnboardingStep()` (un `.update().eq("id", householdId)` desde el cliente), **todas las escrituras eran bloqueadas en silencio por RLS** (deny-by-default, sin policy de UPDATE que las permita) — la app no mostraba ningún error porque nada esperaba/capturaba el resultado de la mutación, así que el wizard completaba los 5 pasos con éxito en la UI (cuentas/tarjetas/presupuesto sí se guardaban bien, esas tablas ya tenían sus policies) pero `onboarding_step` se quedaba pegado en el valor que le puso la función `SECURITY DEFINER` al crear el household (`'accounts'`) — un refresh de página completo volvía a mostrar el wizard desde el paso 2 aunque ya se hubiera hecho clic en "Finalizar". Fix (migración `20260804150341_households_update_policy.sql`): agregar policy de UPDATE con el mismo patrón de siempre (`id in (select public.user_household_ids())`). **Lección: cualquier tabla que empiece de solo-lectura y después gane una escritura desde el cliente necesita revisar explícitamente si ya tiene la policy correspondiente — Postgres RLS deniega por default, no avisa.**

`lib/constants.ts` centraliza `CURRENCIES`, `ACCOUNT_TYPES`, `CARD_NETWORKS` y `BUDGET_CATEGORIES` porque el wizard reutiliza los mismos valores que `/accounts`, `/budgets` y (para tarjetas) una futura `/cards` — evita que las opciones queden inconsistentes si se agrega una moneda o un tipo nuevo.

**MVP vs. diferido a la fase de importación de estados de cuenta:**
- **En el MVP (ya implementado):** los 5 pasos completos, cuentas y tarjetas repetibles, saldo inicial vía `adjustment`, tarjetas con soporte de 2 monedas, presupuesto con monto+moneda por categoría, revisión editable, persistencia de progreso.
- **Preparado en el schema pero sin UI de extracción todavía:** todos los campos de `cards` que un parser de estado de cuenta necesitaría (banco, últimos 4, tarjetahabiente, día de corte, día de pago, pago mínimo, pago de contado, límite) ya existen como columnas nullable — activar la extracción real (PDF/imagen → estos campos, mostrados siempre para revisión antes de guardar, nunca guardado silencioso) es una fase futura que **no requiere otra migración**, solo la lógica de parseo + una UI de confirmación/corrección.

## Esquema de base de datos — Fase 1

```sql
households (
  id uuid pk,
  name text,
  base_currency_default text, -- moneda primaria
  secondary_currency text null, -- agregado en onboarding refinado: moneda secundaria opcional
  onboarding_step text default 'household', -- agregado en onboarding refinado, ver "Onboarding refinado"
    -- check: 'household' | 'accounts' | 'cards' | 'budget' | 'review' | 'done'
  created_at timestamptz
)

household_members (
  id uuid pk,
  household_id uuid fk -> households,
  user_id uuid fk -> auth.users,
  role text, -- 'owner' | 'member'
  joined_at timestamptz
)

accounts (
  id uuid pk,
  household_id uuid fk,
  name text,
  currency text, -- 'HNL' | 'USD'
  type text, -- 'checking' | 'savings' | 'credit_card' (credit_card agregado en Fase 1-C)
  institution text null, -- agregado en onboarding refinado (ej. "BAC", "Ficohsa")
  card_id uuid fk -> cards null, -- agregado en onboarding refinado: presente solo si type='credit_card' y viene del wizard de tarjetas; on delete set null
  created_at timestamptz
)

cards (
  -- agregado en el onboarding refinado (antes solo existía como propuesta en domain.md
  -- para Fase 2). Una tarjeta puede tener hasta 2 filas de accounts vinculadas (una por
  -- moneda en la que tiene saldo) — ver "Onboarding refinado" y domain.md.
  id uuid pk,
  household_id uuid fk,
  name text,
  bank text null,
  cardholder text null,
  network text null, -- check: 'visa' | 'mastercard' | 'amex' | 'other'
  last4 text null,
  credit_limit numeric null,
  statement_closing_day int null, -- check 1-31
  payment_due_day int null, -- check 1-31
  minimum_payment numeric null,
  full_payment_amount numeric null,
  created_at timestamptz
)

categories (
  id uuid pk,
  household_id uuid fk,
  name text,
  is_extra_default boolean default false,
  created_at timestamptz
)

budgets (
  id uuid pk,
  household_id uuid fk,
  category_id uuid fk,
  month date, -- primer día del mes
  planned_amount numeric,
  currency text,
  unique(household_id, category_id, month)
)

transactions (
  id uuid pk,
  household_id uuid fk,
  account_id uuid fk,
  to_account_id uuid fk null, -- agregado en Fase 1-C: cuenta destino de transfer/card_payment
  category_id uuid fk null,
  type text, -- 'income' | 'expense' | 'transfer' | 'card_payment' | 'refund' | 'adjustment' (4 últimos agregados en Fase 1-C)
  amount numeric, -- siempre positivo, EXCEPTO 'adjustment' que puede ser negativo (ver "Transferencias y tipos de transacción")
  currency text,
  description text,
  transaction_date date,
  created_by uuid fk -> auth.users,
  status text default 'confirmed', -- 'confirmed' | 'pending'
  source text default 'manual', -- reservado: 'manual'|'csv'|'email'|'ocr'|'sms'
  card_id uuid null, -- reservado para Fase 2 (tarjetas)
  reconciled_at timestamptz null, -- se usa desde Fase 1-C en ajustes de conciliación
  created_at timestamptz,
  updated_at timestamptz
)
```

**Regla de evolución:** las columnas reservadas (`source`, `card_id`, `reconciled_at`) ya existen desde Fase 1 para evitar migraciones destructivas cuando se activen fases futuras. No crear tablas (`cards`, `goals`, `annual_funds`, `exchange_rates`) hasta que su fase correspondiente inicie.

## Saldo de cuenta

`accounts` no almacena saldo editable directamente. Se calcula:

```sql
saldo = SUM(transactions.amount donde account_id = X y currency = misma moneda,
            sumando income, restando expense, ajustando transfer)
```

(Decisión de implementación: calcular on-the-fly vs. cachear con trigger — evaluar en Fase 1 según performance real, no bloquea el diseño.)

## Transferencias y tipos de transacción (Fase 1-C)

Decisión del usuario: cerrar "integridad financiera" antes de Fase 2, para que el dashboard sea 100% confiable con dinero real. Cambios:

### Esquema

- `transactions.to_account_id` (uuid, null): cuenta destino. Requerido solo para `type in ('transfer', 'card_payment')`; debe ser `null` para el resto.
- `transactions.type` amplía su check constraint: `'income' | 'expense' | 'transfer' | 'card_payment' | 'refund' | 'adjustment'`.
- `accounts.type` amplía su check constraint: `'checking' | 'savings' | 'credit_card'`.
- **Trigger de integridad** (`public.validate_transaction_accounts()`, `before insert or update on transactions`): valida en la base, no solo en la app —
  - `account_id` pertenece a `household_id`.
  - si `to_account_id` no es null: pertenece al mismo `household_id`, es distinto de `account_id`, y su moneda coincide con `currency` (no se modela conversión, ver "Moneda").
  - `to_account_id` es obligatorio si `type in ('transfer','card_payment')`, y debe ser `null` en cualquier otro caso.

  Esto no depende de RLS ni la reemplaza — es una capa adicional para que un bug de la app (o un insert directo) no pueda dejar datos financieros inconsistentes.

### Semántica de cada tipo (confirmada con el usuario)

| Tipo | Afecta saldo de `account_id` | Afecta saldo de `to_account_id` | Cuenta como ingreso | Cuenta como gasto |
|---|---|---|---|---|
| `income` | + | — | Sí | No |
| `expense` | − | — | No | Sí |
| `transfer` | − | + | No | No |
| `card_payment` | − | + | No | No |
| `refund` | + | — | **No** | **Resta** del gasto neto |
| `adjustment` | + o − (signo del monto) | — | No | No |

- **`card_payment`** existe como tipo propio (no un `transfer` genérico) para que los reportes lo puedan distinguir, pero se comporta exactamente igual a `transfer` en los cálculos. El destino debe ser una cuenta `type='credit_card'` (la UI filtra el selector). **Limitación conocida:** todavía no existe el módulo de Tarjetas (Fase 2) que registre las compras/deuda de la tarjeta — el saldo calculado de una cuenta `credit_card` hoy solo refleja los pagos hechos hacia ella, no lo gastado con ella. Se revisa cuando Fase 2 arranque.
- **`refund`** no es un ingreso nuevo: resta de `monthlyExpense` (dashboard) y del "actual" de `useMonthlyActuals` (presupuesto vs. real) de su categoría — mismo criterio que un gasto que "no llegó a costar tanto". Sí aumenta el saldo de la cuenta (la plata vuelve de verdad).
- **`adjustment`** es la única categoría donde `amount` puede ser negativo (corrección hacia abajo) — en todos los demás tipos se sigue guardando siempre positivo, con `type` marcando la dirección. Es lo que genera la conciliación básica (ver abajo). No lleva `category_id`.

### Agregados (dashboard y presupuesto)

- **A nivel moneda del household** (`use-dashboard-summary.ts`): `transfer`/`card_payment` se **ignoran por completo** — mueven plata entre 2 cuentas de la misma moneda (forzado por el trigger), así que su efecto neto sobre "saldo total en esa moneda" es matemáticamente cero. Esto es lo que garantiza los puntos 4 y 5 del pedido del usuario (no alteran ingresos/gastos, no duplican gasto) sin necesitar lógica especial de "exclusión" — simplemente nunca se suman.
- `monthlyExpense[currency] = SUM(expense) - SUM(refund)` (ambos del mes).
- `balance[currency] = SUM(income) - SUM(expense) + SUM(refund) + SUM(adjustment con signo)`.
- **Por cuenta** (`use-account-balances.ts`, nuevo): sí necesita `to_account_id`, a diferencia del agregado por moneda — es la fórmula completa de la tabla de arriba, aplicada por cuenta. Se usa para mostrar el saldo en `/accounts` y para la conciliación.
- **Presupuesto vs. real** (`use-budgets.ts` → `useMonthlyActuals`): `SUM(expense) - SUM(refund)` por categoría+moneda (antes solo sumaba `expense`).

### Conciliación básica (punto 6)

En `/accounts`, cada cuenta tiene una acción "Conciliar": el usuario ingresa el saldo real (el que le dice el banco), se muestra la diferencia contra el saldo calculado, y un botón crea una transacción `type='adjustment'` por esa diferencia (con `reconciled_at = now()` y descripción "Conciliación de saldo"). No es conciliación transacción-por-transacción (eso excede "básica" del roadmap) — es una corrección puntual al saldo total de la cuenta.

## Importación CSV (Fase 1-B)

- **Formato esperado:** CSV con 3 columnas, encabezados case-insensitive (acentos opcionales): `fecha`/`date`, `descripcion`/`descripción`/`description`, `monto`/`amount`. No se construye UI de mapeo de columnas — si el CSV no trae esos encabezados, se muestra un error explicando el formato esperado. Mantiene el alcance "simple" del roadmap; un mapeo de columnas flexible queda para si se necesita más adelante.
- **Cuenta y moneda:** el usuario elige a qué `account_id` pertenece el archivo (un estado de cuenta es de una sola cuenta bancaria); la moneda de cada transacción importada es la de esa cuenta — igual que en el registro manual.
- **Signo → tipo:** `monto < 0` → `type='expense'` (se guarda `abs(monto)`); `monto > 0` → `type='income'`. No se infiere `transfer` desde CSV (un estado de cuenta no distingue transferencias de otros movimientos sin más contexto).
- **Categoría:** queda `null` en la importación — no se auto-categoriza. El usuario categoriza después con la edición inline que ya existe en Transacciones.
- **`source`:** se graba `'csv'` (columna reservada desde Fase 0/1, ver schema).
- **Detección de duplicados (básica, no perfecta):** antes de importar, se comparan las filas parseadas contra las transacciones ya existentes de esa cuenta por `(transaction_date, amount, currency)` exactos. Las filas que matchean se marcan como posible duplicado y aparecen desmarcadas en la preview (el usuario puede tildarlas igual si quiere forzar la importación). No usa `reconciled_at` todavía — esa columna queda reservada para una conciliación más robusta en una fase posterior.
- **Flujo:** subir archivo → parsear y mostrar preview con checkboxes (fila con posible duplicado empieza destildada) → confirmar → insert en bloque de las filas tildadas.
- **Parser:** `papaparse` (maneja comillas/comas embebidas de exports bancarios reales; no vale la pena un parser CSV a mano para este caso).

## Moneda

HNL y USD se tratan como monedas **independientes**, sin conversión automática en Fase 1. El dashboard reporta cada una por separado (igual que el Excel actual del usuario).

## Offline (Fase 1 = "simple")

- Lectura: cache local (TanStack Query + IndexedDB) de dashboard/cuentas/transacciones recientes.
- Escritura: requiere conexión; si no hay, se bloquea con mensaje claro (no se encola).
- Offline completo (cola + sync + resolución de conflictos) queda **explícitamente diferido**, ver roadmap.md.

**⚠️ Regla obligatoria para cualquier hook de TanStack Query (`lib/hooks/*`):** el resultado de `queryFn` debe ser JSON-safe (objetos planos, arrays, strings, numbers — nunca `Map`, `Set`, o `Date` como valor de retorno). El `PersistQueryClientProvider` (`lib/providers/query-provider.tsx`) serializa toda la cache a JSON para guardarla en IndexedDB; un `Map` se convierte silenciosamente en `{}` al guardarse, y al hidratar el componente que espera un `Map` explota en runtime (bug real encontrado en Fase 1 construyendo `use-budgets.ts` — devolvía un `Map` y crasheaba la página al recargar). Usar `Record<string, T>` en vez de `Map` para cualquier tabla de totales/agregados cacheados.

**⚠️ Regla obligatoria: toda queryKey debe incluir el userId (`useAuthUserId()` en `lib/hooks/use-auth-user-id.ts`), con `enabled: !!userId`.** Sin esto, si dos usuarios de households distintos usan el mismo navegador (común en desarrollo/testing, y posible en un dispositivo compartido), la cache persistida en IndexedDB de un usuario queda pegada bajo la misma queryKey y se le sirve al siguiente usuario que loguea — bug real encontrado en Fase 1 (household de un usuario mostrando datos vacíos/incorrectos heredados de otra sesión). El patrón: `queryKey: ["recurso", ...params, userId]` + `enabled: !!userId`. Ver cualquier hook en `lib/hooks/` como referencia.

**⚠️ Regla obligatoria: una mutación debe invalidar TODAS las queries derivadas de la tabla que toca, no solo la que "obviamente" corresponde.** `useCreateTransaction`/`useUpdateTransaction`/`useDeleteTransaction` solo invalidaban `["transactions"]` — `["dashboard-summary"]`, `["monthly-actuals"]` y `["account-balances"]` (todas calculadas a partir de `transactions`) se quedaban con datos viejos. En la práctica parecía funcionar porque cambiar de página remonta el componente y, si `staleTime` (60s) ya expiró, dispara un refetch solo — un timing casual, no un diseño correcto. Se detectó al probar la conciliación (Fase 1-C) sin navegar fuera de `/accounts`: el saldo no se actualizaba después de crear el ajuste. Fix: una función `invalidateTransactionDerivedQueries()` en `use-transactions.ts` que invalida las 4 keys juntas, usada por las 3 mutaciones (y también por `useBulkCreateTransactions` en `use-csv-import.ts`). Antes de agregar una nueva query que lea de `transactions`, agregarla ahí también.

## Seguridad

- RLS en todas las tablas desde el día 1 — ver patrón obligatorio en "Multi-tenancy" arriba.
- Auth vía Supabase Auth: email/password (usuarios de prueba) + Google OAuth (usuarios reales, ver "Registro / Onboarding").
- Service role key solo en server-side (env vars de Vercel), nunca en cliente.
- Supabase emite dos formatos de key equivalentes; usamos el nuevo (`sb_publishable_...` / `sb_secret_...`) en vez del legacy JWT (`anon` / `service_role`):
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = key `sb_publishable_...` (pública, cliente).
  - `SUPABASE_SERVICE_ROLE_KEY` = key `sb_secret_...` (secreta, solo server-side).

### Sesión / Auth (Next.js 16)

- `proxy.ts` en la raíz (reemplaza al `middleware.ts` de versiones anteriores de Next.js) llama a `lib/supabase/middleware.ts::updateSession()` en cada request: refresca la sesión y redirige a `/login` si no hay usuario autenticado.
- Clientes de Supabase separados (`lib/supabase/client.ts` para Client Components, `lib/supabase/server.ts` para Server Components) — ambos crean el cliente de forma perezosa (dentro del handler/evento, no en el top-level del componente) para no romper el build estático cuando las env vars todavía no están configuradas.

## Estructura de carpetas (Next.js)

`✅` = ya existe. Sin marcar = se crea cuando esa fase la necesite (no crear carpetas vacías por adelantado).

```
/proxy.ts                     ✅ sesión/redirect (ver "Sesión / Auth")
/app
  /(auth)/login                ✅ email/password + botón Google
  /auth/callback/route.ts      ✅ intercambia code OAuth por sesión
  /(dashboard)/layout.tsx      ✅ (guard de auth + header + nav + OnboardingGuard)
  /(dashboard)/dashboard       ✅ Fase 1
  /(dashboard)/accounts        ✅ Fase 1 (CRUD + edición inline)
  /(dashboard)/transactions    ✅ Fase 1 (CRUD + edición inline)
  /(dashboard)/transactions/import ✅ Fase 1-B, importación CSV
  /(dashboard)/budgets         ✅ Fase 1
  /(dashboard)/categories      ✅ Fase 1 (CRUD + edición inline)
/components
  sign-out-button.tsx          ✅
  nav-links.tsx                ✅
  onboarding-guard.tsx         ✅ wizard de 5 pasos para usuarios nuevos (ver "Onboarding refinado")
  /onboarding                  ✅ household/accounts/cards/budget/review-step.tsx + step-shell.tsx
  /ui                          ✅ Fase 1 (Button, Input, Select, Card)
/lib
  constants.ts                  ✅ CURRENCIES, ACCOUNT_TYPES, CARD_NETWORKS, BUDGET_CATEGORIES
  /supabase                    ✅ client.ts / server.ts / middleware.ts
  /providers/query-provider.tsx ✅ TanStack Query + persistencia IndexedDB
  /hooks                       ✅ Fase 1, React Query hooks (uno por recurso + use-auth-user-id.ts)
  csv.ts                        ✅ Fase 1-B, parseo de CSV (papaparse)
/types
  supabase.ts                  ✅ generado con `supabase gen types typescript --linked`
/supabase
  /migrations                  ✅ una migración SQL por cambio de schema/RLS
```

## No-funcionales

- Dashboard: <2s con hasta ~5,000 transacciones/hogar.
- Costo objetivo: $20–50 USD/mes (Supabase + Vercel tiers).
