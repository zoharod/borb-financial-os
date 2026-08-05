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

## Usuarios, roles e invitaciones al hogar

Pedido explícito del usuario: hasta acá, "Borb" no tenía ninguna forma de agregar a la segunda persona del hogar más que crear un usuario de prueba a mano vía API — no había perfil, ni roles reales (`household_members.role` solo distinguía `owner`/`member` sin que la RLS tratara ambos distinto), ni invitaciones, ni configuración de ningún tipo. Se agregó todo esto sin tocar el modelo financiero (`transactions` sigue siendo la única fuente de verdad).

### Perfil (`profiles`)

Tabla 1:1 con `auth.users`, poblada automáticamente por un trigger `on auth.users insert` (`public.handle_new_user()`) — así cualquier camino de alta (Google OAuth, email/password, invitación aceptada) tiene fila desde el primer momento sin depender de que la app la cree a mano. Guarda solo preferencias propias de la app (`full_name`, `avatar_url`, `preferred_language`, `timezone`, `date_format`, `number_format`, `preferred_currency`) — **nunca duplica** email/password, que siguen siendo de Supabase Auth. Cambiar el email pasa por `supabase.auth.updateUser({email})`, que ya maneja la confirmación por correo nativamente (no hay lógica propia de confirmación).

### Roles de hogar

`household_members.role` amplía su check constraint de `owner|member` a **`owner | admin | member | viewer`**. Semántica (simplificada para el MVP, pero la RLS ya distingue los 4 niveles, no hace falta otra migración para endurecerla después):

| Rol | Lee datos financieros | Escribe datos financieros | Invita / gestiona miembros | Config. del hogar | Transferir propiedad / eliminar hogar |
|---|---|---|---|---|---|
| `owner` | Sí | Sí | Sí | Sí | Sí |
| `admin` | Sí | Sí | Sí | Sí | No |
| `member` | Sí | Sí | No | No | No |
| `viewer` | Sí | **No** | No | No | No |

**Función helper `public.user_household_role(household_id)`** (`SECURITY DEFINER`, mismo patrón que `user_household_ids()`): devuelve el rol del usuario actual en ese hogar, usada en las policies de escritura. Las policies `ALL` únicas de `accounts/categories/budgets/transactions/cards` (una por tabla, sin distinguir rol) se reemplazaron por 4 policies cada una: SELECT abierta a cualquier miembro, INSERT/UPDATE/DELETE que exigen `user_household_role(household_id) != 'viewer'`.

Cambiar el rol de otro miembro es un `UPDATE` declarativo sobre `household_members` (no una función): la policy exige que el que actúa sea `owner`/`admin`, que **no sea su propia fila** (nadie se auto-asciende) y que un `admin` no pueda ascender a otro a `admin` (sólo el `owner` puede asignar `admin`). Ninguna policy permite poner `role='owner'` — eso solo pasa vía `transfer_household_ownership`.

### Invitaciones (`household_invitations`)

Columnas: `email`, `role` (`admin|member|viewer`, nunca `owner`), `invited_by`, `message`, `token` (uuid único, es el link), `status` (`pending|accepted|cancelled|expired`), `expires_at` (7 días). RLS: solo `owner`/`admin` del hogar pueden ver/crear/cancelar/reenviar sus propias invitaciones — **no hay policy que exponga una invitación por token a alguien que no sea todavía miembro** (evita filtrar datos del hogar antes de aceptar); la pantalla de aceptación usa en cambio `get_invitation_preview(token)` (`SECURITY DEFINER`, `stable`, otorgado también a `anon`), que devuelve solo lo mínimo (nombre del hogar, rol, quién invitó, mensaje, estado) sin tocar ninguna tabla financiera.

**Funciones `SECURITY DEFINER` nuevas** (mismo patrón de siempre para resolver problemas de "huevo y gallina" de RLS):
- `create_household_invitation(household_id, email, role, message)`: valida que quien invita sea `owner`/`admin`, que el email no sea ya miembro del hogar, y que no haya ya una invitación pendiente sin vencer para ese email+hogar.
- `accept_household_invitation(token)`: valida invitación existe/no usada/no cancelada/no vencida, que el email coincide con el usuario logueado, y que **el usuario no pertenece ya a otro hogar** (el modelo sigue siendo 1 hogar por usuario, ver "Limitaciones" abajo) — recién ahí inserta en `household_members` con el rol de la invitación y marca la invitación `accepted`.
- `remove_household_member(member_id)`: `owner` puede remover a cualquiera menos a sí mismo; `admin` solo a `member`/`viewer` (no a otro `admin` ni al `owner`); nadie se remueve a sí mismo por acá (ver `leave_household`).
- `leave_household(household_id)`: el `owner` no puede usarla sin transferir la propiedad antes (previene un hogar sin dueño).
- `transfer_household_ownership(household_id, new_owner_user_id)`: mueve `role='owner'` al nuevo dueño y baja al dueño anterior a `admin`, en una sola transacción (evita el estado transitorio de "2 dueños" o "0 dueños" de hacerlo con 2 updates separados desde el cliente).
- `delete_household(household_id)`: solo `owner`; borra el hogar completo (todas las FKs a `households` son `on delete cascade`, incluida `household_members`, así que se lleva puesto todo el household de un tirón).

### Envío del email de invitación

`app/api/invitations/send/route.ts` (server-side, usa `lib/supabase/admin.ts` con la service role key): primero confirma autorización re-consultando `household_invitations` con el cliente de sesión del que invita (la policy de SELECT, solo owner/admin, hace de control de acceso — no hace falta reimplementarlo a mano). Después:
- **Email nuevo (sin cuenta Borb):** `admin.auth.admin.inviteUserByEmail(email, {redirectTo})` — usa el email nativo de "invitación" de Supabase Auth, sin infraestructura nueva. `redirectTo` apunta a `/auth/callback?next=/invite/{token}`, así que al confirmar el link quedan logueados y redirigidos directo a la pantalla de aceptación.
- **Email que ya es usuario Borb:** `inviteUserByEmail` rechaza (ya existe la cuenta) — no hay proveedor de email transaccional propio en este proyecto, así que en este caso se devuelve el link (`/invite/{token}`) para que quien invita lo comparta manualmente (WhatsApp, etc.). **Límite conocido, documentado a propósito**, no un bug: agregar un proveedor de email transaccional (Resend, Postmark, etc.) es una fase futura si hace falta automatizar esto.

### Emails de miembros del hogar (`get_household_member_emails`)

`auth.users` no se expone vía PostgREST (ni siquiera con la service role key desde el cliente), así que mostrar el email de cada miembro en `/household` no puede hacerse con un `select` normal. En vez de una API route con la service role key, una función `SECURITY DEFINER` (`get_household_member_emails(household_id)`) lee `auth.users` directamente en SQL (dentro de Postgres no hay restricción de schema como en PostgREST) y devuelve `(user_id, email)` para los miembros de un hogar al que el que llama pertenece.

### FK extra para permitir el embed de `profiles` desde `household_members`

PostgREST necesita una FK **directa** entre 2 tablas para poder hacer `select "*, profiles(...)" from household_members`. Ambas columnas (`household_members.user_id` y `profiles.id`) apuntan a `auth.users`, pero eso no alcanza — PostgREST no ve el schema `auth`, así que no infiere la relación indirecta. Se agregó una segunda FK `household_members_user_id_profiles_fkey` (mismo valor, otro destino) solo para que el embed funcione; no cambia ninguna regla de negocio (el valor siempre es el mismo, ya que `profiles.id` y `auth.users.id` están sincronizados por el trigger `handle_new_user`).

### Limpieza de cache al cerrar sesión / cambios de rol

`SignOutButton` ahora llama `queryClient.clear()` **y** borra la clave de IndexedDB (`REACT_QUERY_OFFLINE_CACHE`) además de `supabase.auth.signOut()` — mismo espíritu que el bug de cache cruzada de Fase 1 (ver "Reglas obligatorias" más abajo), pero esta vez aplicado también al momento de salir, no solo a las queryKeys. Las mutaciones de rol/remoción/transferencia/aceptación invalidan `["household-members"]`/`["current-household"]` o hacen `queryClient.clear()` completo (aceptar invitación, salir del hogar, eliminar hogar) ya que esas acciones cambian de qué hogar es "el mío".

### Limitaciones conocidas del MVP (documentadas a propósito, no son bugs)

- **1 hogar por usuario, sin excepción.** Si alguien invitado ya pertenece a otro hogar, `accept_household_invitation` lo bloquea con un mensaje claro. Un selector de "cambiar de hogar" para pertenecer a varios a la vez es un cambio grande (toda la app asume "el" hogar del usuario) — queda para una fase posterior si hace falta.
- **Sin expulsión en tiempo real.** RLS se evalúa en vivo en cada request, así que un miembro removido pierde acceso en su **próxima** consulta — pero si tenía la app abierta en ese momento, la UI no se actualiza sola hasta el próximo refetch/refresh (no hay Supabase Realtime conectado a `household_members` todavía).
- **Sin gestión de sesiones activas.** Supabase no expone listar/cerrar sesiones de otros dispositivos vía el SDK de cliente — Settings > Seguridad solo muestra el método de login actual (Google o email) y permite cerrar la sesión propia.
- **Notificaciones sin motor de envío.** `notification_preferences` guarda la preferencia del usuario (toggles en Settings), pero no hay ningún proveedor de push/email transaccional conectado todavía — es modelo de datos preparado, no una feature activa.
- **Apariencia e integraciones son placeholders.** La app sigue siendo 100% el sistema "Aura Finance" oscuro (sin modo claro) y no hay ninguna integración externa (bancos, Gmail, IA) implementada — ambas secciones de Settings solo dicen "Próximamente".

## Esquema de base de datos — Fase 1

```sql
households (
  id uuid pk,
  name text,
  base_currency_default text, -- moneda primaria
  secondary_currency text null, -- agregado en onboarding refinado: moneda secundaria opcional
  onboarding_step text default 'household', -- agregado en onboarding refinado, ver "Onboarding refinado"
    -- check: 'household' | 'accounts' | 'cards' | 'budget' | 'review' | 'done'
  avatar_url text null, -- agregado en gestión de usuarios/hogar
  financial_month_start_day int default 1, -- 1-28, agregado en gestión de usuarios/hogar
  default_budget_period text default 'monthly', -- 'monthly' | 'biweekly'
  created_at timestamptz
)

household_members (
  id uuid pk,
  household_id uuid fk -> households,
  user_id uuid fk -> auth.users AND fk -> profiles, -- 2 FKs sobre la misma columna: la 2da (a profiles) es solo para que PostgREST pueda embeder profiles (ver "Usuarios, roles e invitaciones")
  role text, -- 'owner' | 'admin' | 'member' | 'viewer' (admin/viewer agregados en gestión de usuarios/hogar)
  joined_at timestamptz
)

profiles (
  -- 1:1 con auth.users, creada por el trigger handle_new_user
  id uuid pk fk -> auth.users on delete cascade,
  full_name text null,
  avatar_url text null,
  preferred_language text default 'es',
  timezone text default 'America/Tegucigalpa',
  date_format text default 'DD/MM/YYYY', -- check: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  number_format text default 'es-HN',
  preferred_currency text null,
  created_at timestamptz,
  updated_at timestamptz
)

household_invitations (
  id uuid pk,
  household_id uuid fk -> households,
  email text,
  role text, -- check: 'admin' | 'member' | 'viewer' (nunca 'owner')
  invited_by uuid fk -> auth.users,
  message text null,
  token uuid unique, -- usado en el link de invitación
  status text default 'pending', -- check: 'pending' | 'accepted' | 'cancelled' | 'expired'
  expires_at timestamptz, -- default now() + 7 días
  accepted_at timestamptz null,
  accepted_by uuid fk -> auth.users null,
  created_at timestamptz
)

notification_preferences (
  -- sin motor de envío todavía, ver "Limitaciones conocidas"
  user_id uuid pk fk -> auth.users on delete cascade,
  payment_reminders boolean default true,
  budget_alerts boolean default true,
  unusual_transaction_alerts boolean default true,
  savings_milestones boolean default true,
  cashback_opportunities boolean default false,
  weekly_summary boolean default false,
  monthly_summary boolean default true,
  updated_at timestamptz
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
/proxy.ts                     ✅ sesión/redirect (ver "Sesión / Auth"; /invite es público)
/app
  /(auth)/login                ✅ email/password + botón Google (soporta ?next=)
  /auth/callback/route.ts      ✅ intercambia code OAuth por sesión (soporta ?next=)
  /invite/[token]              ✅ aceptar invitación (público, fuera de (dashboard))
  /api/invitations/send        ✅ envía/genera el link de invitación (service role)
  /api/account/delete          ✅ elimina la cuenta del usuario (service role)
  /(dashboard)/layout.tsx      ✅ (guard de auth + header + nav + OnboardingGuard)
  /(dashboard)/dashboard       ✅ Fase 1
  /(dashboard)/accounts        ✅ Fase 1 (CRUD + edición inline)
  /(dashboard)/transactions    ✅ Fase 1 (CRUD + edición inline)
  /(dashboard)/transactions/import ✅ Fase 1-B, importación CSV
  /(dashboard)/budgets         ✅ Fase 1
  /(dashboard)/categories      ✅ Fase 1 (CRUD + edición inline)
  /(dashboard)/profile         ✅ perfil personal, email, eliminar cuenta
  /(dashboard)/household       ✅ miembros, invitar, roles, configuración del hogar
  /(dashboard)/settings        ✅ hub de configuración (ver "Usuarios, roles e invitaciones")
/components
  sign-out-button.tsx          ✅ (limpia queryClient + IndexedDB)
  account-menu.tsx              ✅ menú de usuario (Perfil/Hogar/Configuración/Salir)
  sidebar.tsx                   ✅ nav principal desktop (refresh de UI, reemplaza nav-links.tsx)
  topbar.tsx                    ✅ buscador + notificaciones + AccountMenu (refresh de UI)
  mobile-nav.tsx                ✅ fallback mínimo de navegación en mobile (refresh de UI)
  global-search.tsx             ✅ buscador real sobre cuentas/categorías cacheadas (refresh de UI)
  onboarding-guard.tsx         ✅ wizard de 5 pasos para usuarios nuevos (ver "Onboarding refinado")
  /onboarding                  ✅ household/accounts/cards/budget/review-step.tsx + step-shell.tsx
  /household                   ✅ members-list/invite-form/pending-invitations/household-settings-form/ownership-actions
  /settings/notification-toggles.tsx ✅
  /ui                          ✅ Button, Input, Select, Card, Icon (refresh de UI en icon.tsx)
/lib
  constants.ts                  ✅ CURRENCIES, ACCOUNT_TYPES, CARD_NETWORKS, BUDGET_CATEGORIES, roles, idiomas, formatos
  csv-export.ts                 ✅ exportar transacciones a CSV
  /supabase                    ✅ client.ts / server.ts / middleware.ts / admin.ts (service role, solo server)
  /providers/query-provider.tsx ✅ TanStack Query + persistencia IndexedDB
  /hooks                       ✅ Fase 1, React Query hooks (uno por recurso + use-auth-user-id.ts)
  csv.ts                        ✅ Fase 1-B, parseo de CSV (papaparse)
/types
  supabase.ts                  ✅ generado con `supabase gen types typescript --linked`
/supabase
  /migrations                  ✅ una migración SQL por cambio de schema/RLS
```

## Sistema de diseño (refresh de UI, desktop)

Pedido explícito del usuario: "refrescar el UI de la app, en desktop inicialmente", a partir de un proyecto nuevo de Stitch ("Borb Financial OS", ID `10149068696168867474`) con 7 pantallas desktop. Reemplaza la paleta grisácea original "Aura Finance" de Fase 0.

**De dónde sale cada cosa:**
- **Tokens de color/tipografía** (`app/globals.css`): de la config de Tailwind embebida en el HTML de "Wealth Dashboard" — primary violeta (`#d2bbff`/`#7c3aed`), secondary menta (`#4edea3`/`#00a572`), tertiary naranja (`#ffb784`), fondo azul muy oscuro (`#0b1326`). Misma convención de nombres Material Design 3 que ya usaba el sistema anterior (`primary`/`on-primary`/`surface-container-*`), así que fue un reemplazo de valores, no de arquitectura de tokens.
- **Tipografía**: Inter/JetBrains Mono → **Outfit** (única fuente para todo, incluido lo que antes era `font-mono` — se re-apuntó la variable CSS `--font-mono` a Outfit en vez de cambiar cada uso de `font-mono` archivo por archivo, ver `app/globals.css`).
- **Íconos**: Material Symbols Outlined (variable font, cargada en `app/layout.tsx` vía `<link>` en el `<head>` — `next/font` no cubre esta fuente). Componente `components/ui/icon.tsx` (`<Icon name="..." filled? size? />`) para uso consistente.
- **Utilidades nuevas** (`app/globals.css`): `.glass-panel` (fondo + borde sutil de las tarjetas), `.glow-active` (sombra difusa violeta en elementos activos/CTA), `.chart-gradient`, scrollbar delgado.
- **Layout**: sidebar fijo izquierdo (`components/sidebar.tsx`, reemplaza el header con nav horizontal) + topbar (`components/topbar.tsx`: buscador + notificaciones + `AccountMenu`). El sidebar es `hidden md:flex` (desktop-first, como pidió el usuario) — `components/mobile-nav.tsx` es el mínimo indispensable para que mobile no se quede sin forma de navegar mientras no se hace la pasada responsive completa.
- **Buscador global** (`components/global-search.tsx`): filtra cuentas/categorías ya cacheadas por nombre y navega a su lista — deliberadamente **no** es una búsqueda con IA (eso es "Command Center", ver abajo).

**Qué NO se implementó como página, a propósito (decisión confirmada con el usuario):** de las 7 pantallas de Stitch, 4 representan funcionalidad que no existe y no es Fase 1:
- **Command Center** (asistente en lenguaje natural) y **Financial Brief** (insights generados por IA) — Fase 4/5 según `roadmap.md`/`project_state.md`.
- **Connect Accounts** y **Activation** (búsqueda de institución bancaria + animación de "análisis" tipo Plaid) — el onboarding sigue siendo 100% carga manual, por decisión explícita del usuario (ver "Decisiones clave" en `project_state.md`).

De esas 4 se tomó **solo el lenguaje visual** (colores, tipografía, glass-panel/glow) para refrescar las pantallas reales (Dashboard, onboarding) — no se creó ninguna página nueva ni funcionalidad simulada a partir de ellas. Si esas fases arrancan en el futuro, ese mismo proyecto de Stitch sigue siendo la referencia de diseño a usar.

**Alcance de esta pasada:** desktop (≥768px). El sidebar/topbar tienen un fallback mínimo para mobile (`MobileNav`, menú hamburguesa con los mismos links) para no dejarlo roto, pero no hubo una pasada de diseño responsive dedicada — queda pendiente si se prioriza.

## No-funcionales

- Dashboard: <2s con hasta ~5,000 transacciones/hogar.
- Costo objetivo: $20–50 USD/mes (Supabase + Vercel tiers).
