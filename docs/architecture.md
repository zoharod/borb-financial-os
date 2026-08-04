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
create or replace function public.create_household_for_current_user(household_name text)
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

  insert into households (name) values (household_name) returning id into new_household_id;
  insert into household_members (household_id, user_id, role) values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

revoke all on function public.create_household_for_current_user(text) from public;
grant execute on function public.create_household_for_current_user(text) to authenticated;
```

- **`use-current-household.ts` usa `.maybeSingle()`, no `.single()`** — con `.single()`, 0 filas es un error (`PGRST116`); un usuario recién logueado sin household todavía necesita que esto devuelva `null` limpiamente, no que explote.
- **`components/onboarding-guard.tsx`** (client component, envuelve `{children}` en `app/(dashboard)/layout.tsx`) es un wizard de 3 pasos, no solo "crear household" — dejar a un usuario nuevo en un dashboard completamente vacío sin pistas de qué cargar primero resultó confuso (feedback real del usuario). Orden de los pasos sigue las dependencias reales del modelo de datos (una transacción necesita cuenta; un presupuesto necesita categoría):
  1. **Household** — nombre del hogar → `create_household_for_current_user`.
  2. **Primera cuenta** — mismo form que `/accounts`, pero mínimo (sin lista).
  3. **Categorías** — chips de sugeridas (`SUGGESTED_CATEGORIES` en `lib/constants.ts`: Comida, Transporte, Vivienda, Servicios, Salud, Entretenimiento, + Extras/Imprevistos marcada `is_extra_default`) más un input libre; un click por chip la crea al toque. Requiere al menos 1 para avanzar.
  4. Con household + ≥1 cuenta + ≥1 categoría, renderiza `{children}` (la app normal).

  Presupuesto queda afuera del wizard a propósito — no es prerequisito de nada más y su propia página (`/budgets`) ya lo resuelve bien; forzarlo acá sería fricción sin beneficio.

  `lib/constants.ts` centraliza `CURRENCIES`, `ACCOUNT_TYPES` y `SUGGESTED_CATEGORIES` porque el wizard reutiliza los mismos valores que `/accounts` y `/budgets` — evita que las opciones queden inconsistentes si se agrega una moneda o un tipo de cuenta nuevo.

## Esquema de base de datos — Fase 1

```sql
households (
  id uuid pk,
  name text,
  base_currency_default text,
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
  onboarding-guard.tsx         ✅ wizard de 3 pasos para usuarios nuevos
  /ui                          ✅ Fase 1 (Button, Input, Select, Card)
/lib
  constants.ts                  ✅ CURRENCIES, ACCOUNT_TYPES, SUGGESTED_CATEGORIES
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
