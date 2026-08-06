# domain.md — Modelo de dominio: cuentas, tarjetas, transferencias, pagos

> Documento de diseño conceptual, complementario a `architecture.md` (que tiene el schema SQL exacto y las decisiones ya implementadas). Este archivo define **cómo se van a representar** cuentas, tarjetas, transferencias y pagos de tarjeta de cara a Fase 2 (Tarjetas y Cashback), para que esa fase extienda el modelo de Fase 1-C sin necesitar rediseñarlo. Nada de lo que dice "Fase 2" acá está implementado todavía — es la base para no improvisar el schema cuando esa fase arranque.

## Cuentas (`accounts`) — ya implementado (Fase 1-C)

Una cuenta es un contenedor de plata con un saldo que se **deriva** de `transactions` (nunca se edita directo — ver "Principio de diseño" en `architecture.md`). Tres tipos:

- `checking` / `savings`: saldo positivo = plata que tenés.
- `credit_card`: mismo mecanismo de cálculo, pero la lectura es distinta — **saldo negativo = lo que debés**, saldo positivo o cero = no debés nada (o tenés a favor). No hay un campo separado de "deuda"; es el mismo saldo derivado de `transactions`, con signo invertido en su interpretación.

Esto ya funciona hoy: una compra con tarjeta se puede cargar como `type='expense'` con `account_id` = la cuenta `credit_card` (la resta de esa transacción deja el saldo de la cuenta más negativo, reflejando más deuda), aunque todavía no hay UI que lo sugiera activamente ni cálculo de cashback sobre eso — ver "Fase 2" abajo.

**Cuentas vs. Tarjetas son módulos separados en la UI** (`/accounts` vs. `/cards`): una cuenta es un activo, una tarjeta es un pasivo, y mezclarlas en la misma lista es engañoso a simple vista aunque el mecanismo de cálculo por debajo sea el mismo `transactions`. `/accounts` filtra `type !== 'credit_card'`; `/cards` muestra cada tarjeta con sus cuentas vinculadas. Esto es solo una reorganización de presentación — el modelo de datos de esta sección no cambió.

## Estados de transacción

Una transacción no es un hecho binario "pasó o no pasó" — puede estar `pending` (vas a pagarla pero todavía no se debitó), `scheduled` (fecha futura conocida, ej. el salario del 15), `confirmed` (ya ocurrió de verdad), `reconciled` (ya coincide con el estado de cuenta del banco — usado por la conciliación de `/accounts`/`/cards`) o `cancelled` (se registró pero no va a pasar, se conserva como historial en vez de borrarse). **Regla de dominio:** solo `confirmed` y `reconciled` son "plata real" — cuentan para saldo de cuenta, deuda de tarjeta, e ingreso/gasto real del mes. `pending`/`scheduled` son la materia prima de la proyección de `/cashflow` (junto con `financial_commitments` y `expected_income`), nunca del saldo actual; `cancelled` no cuenta para nada. Ver `architecture.md` → "Estados de transacción" para el detalle de dónde se filtra esto y el bug que corrigió (el estado existía desde Fase 1 pero nunca se respetaba en ningún cálculo).

## Presupuesto: grupos y plantillas

Dos conceptos nuevos, puramente organizativos — no cambian la semántica financiera de `budgets`/`categories`:
- **Grupo** (`categories.group_name`): una categoría pertenece a una de 11 secciones fijas (Vivienda, Transporte, Salud, Comida, Suscripciones, Personal, Inversiones, Deuda, Ahorro, Extras, Fondos anuales) para que el presupuesto se pueda navegar como "áreas de la vida" en vez de una lista plana.
- **Plantilla** (`budget_templates`/`budget_template_items`): un conjunto de líneas categoría+monto+moneda reusable mes a mes (ej. "Conservador" vs. "Vacaciones") que se "activa" para un mes puntual, creando/actualizando los `budgets` de ese mes. Una plantilla en sí misma no afecta ningún cálculo — solo existe hasta que se activa.

Ver `architecture.md` → "Presupuesto: grupos y plantillas" para el schema y el fix de un bug real de recreación de presupuestos que se corrigió en el mismo cambio.

## Transferencias — ya implementado (Fase 1-C)

`type='transfer'`, con `to_account_id` (cuenta destino) obligatorio. Mueve saldo entre 2 cuentas del mismo household y la misma moneda (validado por trigger en la base, no solo en la app — ver `architecture.md` → "Transferencias y tipos de transacción"). No cuenta como ingreso ni gasto.

## Pagos de tarjeta — ya implementado (Fase 1-C)

`type='card_payment'`, se comporta exactamente como una transferencia (mismo mecanismo de `to_account_id`), pero la cuenta destino debe ser `type='credit_card'`. Reduce la deuda (el saldo de la cuenta tarjeta se vuelve menos negativo). No cuenta como gasto nuevo — la UI y los agregados ya lo tratan igual que `transfer` a propósito, evitando duplicar el gasto que ya se registró (o se registrará, ver Fase 2) cuando se hizo la compra.

## Tarjetas (`cards`) — implementada (onboarding refinado); cashback sigue siendo Fase 2

Una **tarjeta** es distinta de una **cuenta `credit_card`**: la cuenta es el libro contable (cuánto debés, ya funciona desde Fase 1-C); la tarjeta es la identidad física/virtual con sus reglas propias (límite, cashback, ciclo de facturación). La tabla `cards` se creó antes de lo previsto en este documento, como parte del onboarding refinado (no de Fase 2) — la relación terminó siendo **1:N, no 1:1** como se había propuesto acá originalmente:

```sql
-- YA IMPLEMENTADO (migración 20260804110528, cardholder_user_id agregado
-- después en 20260804163200 — ver "Tarjetahabiente" abajo)
cards (
  id uuid pk,
  household_id uuid fk,
  name text, -- "Visa Signature BAC"
  bank text null,
  cardholder_user_id uuid fk -> auth.users null,
  legacy_cardholder_name text null, -- ver "Tarjetahabiente"
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

### Tarjetahabiente — selector de miembro, no texto libre

`cards.cardholder` empezó como texto libre; pedido explícito del usuario para que sea un `household_member` real (poder saber a quién pertenece cada tarjeta, y eventualmente filtrar gastos/reportes por persona). Se migró a `cardholder_user_id` (FK a `auth.users`, igual patrón que `expected_income.household_member_user_id`), seleccionado en el onboarding desde `useHouseholdMembers()` (nombre + avatar/iniciales). Si el hogar tiene un solo miembro (caso normal al onboardear), la UI muestra un link contextual a "Invitá a alguien" en vez de bloquear el flujo — asignar el tarjetahabiente después de invitar es un caso de uso válido, no un error.

**Backfill de datos reales:** al migrar, `cardholder` ya tenía texto de producción (nombres de pila). Se intentó un match por prefijo (`profiles.full_name ILIKE cardholder || '%'`) contra los miembros del mismo household — lo que no matcheó (la persona todavía no se había unido al hogar) se conservó en `legacy_cardholder_name` en vez de perderse, mostrado en la UI como "(sin vincular)" hasta que alguien lo reemplace manualmente por un `cardholder_user_id` real.

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

El paso de onboarding de tarjetas incluye un input de archivo ("Subir tu último estado de cuenta") con estado real (`File` en memoria, Reemplazar/Quitar, aviso de "extracción no disponible") pero **todavía no parsea ni guarda el archivo en ningún lado** — es solo un apoyo visual mientras el usuario completa los campos a mano. El archivo se limpia automáticamente después de crear la tarjeta (nunca se arrastra a la tarjeta siguiente) y al tocar "Quitar" (nunca se guarda silenciosamente después de que el usuario lo saca — regla de producto explícita). Cuando se implemente la extracción real (fase de importación de estados de cuenta, todavía sin numerar en el roadmap):

- Todos los campos que un parser necesitaría llenar (banco, últimos 4, tarjetahabiente, período/día de corte, día de pago, saldo por moneda, pago mínimo, pago de contado, límite) **ya existen** en `cards`/`accounts` — no debería hacer falta otra migración de schema para el caso básico.
- **Regla de producto ya decidida (no reabrir sin razón nueva):** los datos extraídos se muestran siempre para revisión del usuario antes de guardar — nunca un guardado silencioso. El usuario debe poder Confirmar, Corregir, Completar campos faltantes, o Descartar (Skip) la extracción.
- Transacciones recientes extraídas del estado de cuenta (si el parser las soporta) seguirían insertándose como `transactions` normales — no necesitan una tabla nueva, mismo mecanismo que la importación CSV de Fase 1-B.

## Compromisos financieros (`financial_commitments`) — implementado

Un **compromiso financiero** es una obligación recurrente ya asumida (cuota de financiamiento, minicuota, préstamo, pago de colegiatura en cuotas) que **no es lo mismo que un gasto de categoría**: representa dinero que el usuario ya sabe que va a pagar, no una decisión de presupuesto mes a mes. Modelarlo aparte de `budgets`/`categories` evita dos problemas: (1) mezclarlo con presupuesto discrecional haría parecer "gasto planeado" algo que en realidad es una deuda fija, y (2) permite trackear cuotas restantes/fecha de fin, que una categoría de presupuesto no tiene forma de representar.

```sql
financial_commitments (
  id uuid pk,
  household_id uuid fk,
  name text,
  amount numeric, -- monto de LA CUOTA, no el total financiado
  currency text,
  start_date date,
  end_date date null,
  remaining_installments int null,
  frequency text, -- 'weekly' | 'biweekly' | 'monthly' | 'one_time'
  next_payment_date date null,
  account_id uuid fk -> accounts null, -- cuenta/tarjeta desde la que se paga
  category_id uuid fk -> categories null, -- opcional, para reportes
  status text default 'active', -- 'active' | 'completed'
  created_at timestamptz
)
```

**Cómo se paga sin duplicar la compra original:** cuando llega la fecha de pago, se registra una transacción `type='financing_installment'` con `commitment_id` apuntando a este compromiso. Esa transacción resta el saldo de la cuenta pagadora (plata real que sale) pero **no** cuenta como `expense` en el dashboard ni en presupuesto vs. real — si contara, la compra financiada se duplicaría (una vez al comprarla, otra vez en cada cuota). Ver architecture.md → "Dashboard: posición financiera".

**Avance automático — implementado en `/cashflow`** ("Marcar pagado"): crea la transacción `financing_installment` y en el mismo flujo decrementa `remaining_installments`, avanza `next_payment_date` según `frequency`, y pasa a `status='completed'` cuando ya no quedan cuotas (o la frecuencia es `one_time`). Antes de esto era manual (el usuario editaba el compromiso a mano); ya no.

## Ingreso esperado (`expected_income`) — implementado

Plata que el usuario **sabe** que va a entrar pero todavía no entró (salario, freelance, reembolso, bono, alquiler). Existe para alimentar la proyección de flujo de caja del dashboard sin contaminar el saldo real — la regla de producto explícita es **nunca contarlo como recibido hasta que se confirme o se convierta en una transacción real**.

```sql
expected_income (
  id uuid pk,
  household_id uuid fk,
  source text, -- "Salario", "Freelance", ...
  amount numeric,
  currency text,
  expected_date date,
  frequency text, -- 'weekly' | 'biweekly' | 'monthly' | 'one_time'
  household_member_user_id uuid fk -> auth.users null,
  destination_account_id uuid fk -> accounts null,
  status text default 'estimated', -- 'estimated' | 'confirmed'
  created_at timestamptz
)
```

`status` es informativo (confirmado vs. estimado) — **ninguno de los dos estados afecta el saldo real de ninguna cuenta**; ambos entran en `expectedIncomeThisMonth` de la proyección del dashboard por igual. Cuando la plata efectivamente entra, `/cashflow` tiene una acción "Confirmar recibido" que crea la transacción `type='income'` real (hacia `destination_account_id`) **y** pasa este registro a `status='confirmed'` en el mismo paso — a partir de ahí deja de contarse como "próximo" en cualquier pantalla, evitando el riesgo de contarlo dos veces (una como proyección, otra como transacción real). Sigue sin existir una conversión automática/desatendida — la confirmación siempre es una acción explícita del usuario.

## Compras con tarjeta — Fase 2, no implementado

Una compra con tarjeta sigue siendo `type='expense'` con `account_id` = la cuenta `credit_card` correspondiente (esto ya funciona, ver arriba). Lo que agrega Fase 2 es usar la columna `card_id` de `transactions` (reservada desde Fase 0, sin uso hasta ahora) para vincular la compra a una fila de `cards` específica — necesario para:

- Calcular cashback: `SUM(expense.amount * card_cashback_rules.cashback_pct)` por categoría, tope `monthly_cap`, filtrando `transactions.card_id = X`.
- Recomendar qué tarjeta usar: dada una categoría, comparar el cashback restante disponible (contra el `monthly_cap`) entre las tarjetas del household.

**Decisión pendiente para cuando arranque Fase 2:** ¿el cashback se calcula solo sobre gastos con `card_id` explícito, o se infiere de cualquier `expense` cuya `account_id` sea una cuenta `credit_card` sin `card_id`? Recomendación: exigir `card_id` explícito desde el día 1 de Fase 2 (más simple, sin ambigüedad) y no intentar inferencia retroactiva sobre datos viejos.

## Fuera de alcance explícito de este documento

- Múltiples tarjetas compartiendo el mismo cupo/cuenta (tarjetas adicionales/suplementarias) — no se modela, asumir 1 tarjeta = 1 cuenta.
- Intereses, moras, o fechas de corte con lógica de facturación real — Fase 2 solo cubre cashback y recomendación de tarjeta, no un motor de facturación bancaria completo.
- Conversión de moneda en pagos de tarjeta — sigue la misma regla que transferencias (misma moneda obligatoria, ver `architecture.md` → "Moneda").

## Roles de hogar e invitaciones — implementado (gestión de usuarios/hogar)

A diferencia de las secciones anteriores (modelo financiero), esto es modelo de **gobernanza del hogar**: quién puede hacer qué dentro de un household compartido. Se agregó junto con perfiles/invitaciones/configuración — ver `architecture.md` → "Usuarios, roles e invitaciones al hogar" para el schema y las policies exactas.

### Por qué 4 roles y no 2

El modelo original (`owner`/`member`, sin distinción real de permisos) alcanzaba mientras el hogar tenía como mucho 1-2 personas y ambas necesitaban gestionar todo. Al agregar invitaciones, hace falta poder sumar a alguien con acceso de **solo lectura** (por ejemplo, un contador o un familiar que solo quiere ver el estado de las cuentas sin poder tocar nada) sin exponerle la capacidad de crear/editar/borrar transacciones. De ahí los 4 niveles (`owner > admin > member > viewer`), pensados como una escalera donde cada nivel es un subconjunto estricto de permisos del anterior — ver la tabla completa en `architecture.md`.

### Por qué "1 hogar por usuario" sigue siendo una regla dura

El resto de la app (dashboard, cuentas, transacciones, presupuesto) asume implícitamente "el household del usuario actual" — ninguna pantalla tiene un selector de hogar. Permitir que un usuario pertenezca a 2+ hogares a la vez requeriría ese selector en todos lados, más decidir qué hogar es "el activo" en cada momento — un cambio de arquitectura transversal, no una migración puntual. Por eso `accept_household_invitation` bloquea explícitamente a cualquiera que ya pertenezca a un hogar distinto, con un mensaje claro en vez de dejarlo en un estado ambiguo. Si en el futuro hace falta soportar multi-hogar (ej. una persona que administra las finanzas de 2 hogares distintos), es un rediseño a propósito, no una extensión incremental de este modelo.

### Ciclo de vida de una invitación

`pending → accepted` (feliz) o `pending → cancelled` (quien invitó se arrepiente) o `pending → expired` (pasaron 7 días sin aceptar, se detecta de forma perezosa: la función `accept_household_invitation` chequea `expires_at` en el momento de aceptar y recién ahí marca `expired`, no hay un job periódico que barra invitaciones vencidas). "Reenviar" simplemente vuelve a poner `status='pending'` y extiende `expires_at`, reusando el mismo `token` — no se genera una invitación nueva, así que un link viejo que alguien haya guardado sigue sirviendo después de un reenvío.

### Qué pasa con los datos de alguien removido

Nada se borra de las tablas financieras (`transactions.created_by` sigue apuntando a ese usuario, por ejemplo) — remover a alguien de `household_members` solo le quita acceso de ahí en adelante, no reescribe el historial de quién cargó qué. Esto es consistente con el principio de que `transactions` es un registro histórico inmutable de hechos, no una vista que deba "limpiarse" cuando cambia la membresía del hogar.
