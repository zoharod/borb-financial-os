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
  type text, -- 'checking' | 'savings'
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
  category_id uuid fk null,
  type text, -- 'income' | 'expense' | 'transfer'
  amount numeric,
  currency text,
  description text,
  transaction_date date,
  created_by uuid fk -> auth.users,
  status text default 'confirmed', -- 'confirmed' | 'pending'
  source text default 'manual', -- reservado: 'manual'|'csv'|'email'|'ocr'|'sms'
  card_id uuid null, -- reservado para Fase 2 (tarjetas)
  reconciled_at timestamptz null, -- reservado para conciliación bancaria
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

## Moneda

HNL y USD se tratan como monedas **independientes**, sin conversión automática en Fase 1. El dashboard reporta cada una por separado (igual que el Excel actual del usuario).

## Offline (Fase 1 = "simple")

- Lectura: cache local (TanStack Query + IndexedDB) de dashboard/cuentas/transacciones recientes.
- Escritura: requiere conexión; si no hay, se bloquea con mensaje claro (no se encola).
- Offline completo (cola + sync + resolución de conflictos) queda **explícitamente diferido**, ver roadmap.md.

**⚠️ Regla obligatoria para cualquier hook de TanStack Query (`lib/hooks/*`):** el resultado de `queryFn` debe ser JSON-safe (objetos planos, arrays, strings, numbers — nunca `Map`, `Set`, o `Date` como valor de retorno). El `PersistQueryClientProvider` (`lib/providers/query-provider.tsx`) serializa toda la cache a JSON para guardarla en IndexedDB; un `Map` se convierte silenciosamente en `{}` al guardarse, y al hidratar el componente que espera un `Map` explota en runtime (bug real encontrado en Fase 1 construyendo `use-budgets.ts` — devolvía un `Map` y crasheaba la página al recargar). Usar `Record<string, T>` en vez de `Map` para cualquier tabla de totales/agregados cacheados.

**⚠️ Regla obligatoria: toda queryKey debe incluir el userId (`useAuthUserId()` en `lib/hooks/use-auth-user-id.ts`), con `enabled: !!userId`.** Sin esto, si dos usuarios de households distintos usan el mismo navegador (común en desarrollo/testing, y posible en un dispositivo compartido), la cache persistida en IndexedDB de un usuario queda pegada bajo la misma queryKey y se le sirve al siguiente usuario que loguea — bug real encontrado en Fase 1 (household de un usuario mostrando datos vacíos/incorrectos heredados de otra sesión). El patrón: `queryKey: ["recurso", ...params, userId]` + `enabled: !!userId`. Ver cualquier hook en `lib/hooks/` como referencia.

## Seguridad

- RLS en todas las tablas desde el día 1 — ver patrón obligatorio en "Multi-tenancy" arriba.
- Auth vía Supabase Auth (email/password en Fase 1).
- Service role key solo en server-side (env vars de Vercel), nunca en cliente.
- Supabase emite dos formatos de key equivalentes; usamos el nuevo (`sb_publishable_...` / `sb_secret_...`) en vez del legacy JWT (`anon` / `service_role`):
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = key `sb_publishable_...` (pública, cliente).
  - `SUPABASE_SERVICE_ROLE_KEY` = key `sb_secret_...` (secreta, solo server-side).

### Sesión / Auth (Next.js 16)

- `proxy.ts` en la raíz (reemplaza al `middleware.ts` de versiones anteriores de Next.js) llama a `lib/supabase/middleware.ts::updateSession()` en cada request: refresca la sesión y redirige a `/login` si no hay usuario autenticado.
- Clientes de Supabase separados (`lib/supabase/client.ts` para Client Components, `lib/supabase/server.ts` para Server Components) — ambos crean el cliente de forma perezosa (dentro del handler/evento, no en el top-level del componente) para no romper el build estático cuando las env vars todavía no están configuradas.

## Estructura de carpetas (Next.js)

`✅` = ya existe (Fase 0). Sin marcar = se crea cuando esa fase la necesite (no crear carpetas vacías por adelantado).

```
/proxy.ts                     ✅ sesión/redirect (ver "Sesión / Auth")
/app
  /(auth)/login                ✅
  /(dashboard)/layout.tsx      ✅ (guard de auth + header)
  /(dashboard)/dashboard       ✅
  /(dashboard)/accounts        — Fase 1
  /(dashboard)/transactions    — Fase 1
  /(dashboard)/budgets         — Fase 1
  /(dashboard)/categories      — Fase 1
/components
  sign-out-button.tsx          ✅
  /ui                          — Fase 1, componentes Tailwind reutilizables
  /dashboard                   — Fase 1
  /transactions                — Fase 1
/lib
  /supabase                    ✅ client.ts / server.ts / middleware.ts
  /providers/query-provider.tsx ✅ TanStack Query + persistencia IndexedDB
  /hooks                       — Fase 1, React Query hooks
/types
  supabase.ts                  ✅ generado con `supabase gen types typescript --linked`
/supabase
  /migrations                  ✅ una migración SQL por cambio de schema/RLS
```

## No-funcionales

- Dashboard: <2s con hasta ~5,000 transacciones/hogar.
- Costo objetivo: $20–50 USD/mes (Supabase + Vercel tiers).
