# project_state.md — Backlog y memoria activa

> Este archivo es la memoria de trabajo del proyecto. Se actualiza al final de cada sesión de desarrollo. Claude Code debe leer este archivo ANTES de escribir código en cualquier sesión.

**Última actualización:** 2026-08-04
**Fase actual:** Fase 1-C técnicamente completa ✅ — quedan 2 puntos que dependen del usuario (confirmar login real, borrar usuarios de prueba)

---

## ✅ Hecho

- [x] Entrevista de producto completa (problema, usuarios, MVP, restricciones).
- [x] PRD.md redactado y aprobado.
- [x] TDR.md redactado y aprobado.
- [x] architecture.md redactado (stack, modelo de datos, RLS, offline, moneda).
- [x] roadmap.md redactado (Fase 0 a Fase 5).
- [x] Decisión de stack confirmada: Next.js + Supabase + Tailwind + Vercel.
- [x] Proyecto renombrado a **Borb Financial OS**.
- [x] Screens de UI traídas de Google Stitch (proyecto "Borb Financial OS") a `docs/design/`: sistema de diseño (`design-system.md`), doc de arquitectura de experiencia (`experience-architecture.md`), y 4 screens con HTML+capturas en `docs/design/screens/`.
- [x] Repo Next.js 16 (App Router, TypeScript estricto, Turbopack) + Tailwind v4 inicializado, con paleta/tipografía del design system de Stitch aplicada en `app/globals.css`.
- [x] Estructura de carpetas de `architecture.md`: `app/(auth)/login`, `app/(dashboard)/dashboard`, `components/`, `lib/supabase` (client/server/middleware separados), `lib/providers` (TanStack Query + persistencia IndexedDB vía idb-keyval), `types/`.
- [x] Proyecto Supabase creado por el usuario ("Financial-OS", ref `ujjoiqevyhincfotcyoh`, región us-west-2) y **linkeado** vía Supabase CLI (`supabase link`), autenticada con Personal Access Token.
- [x] MCP de Supabase configurado en `.mcp.json` (scope proyecto, `read_only=true` por defecto) — pendiente que el usuario corra `/mcp` en una sesión interactiva para completar el login OAuth.
- [x] Schema aplicado a Supabase real vía `supabase db push` (households, household_members, accounts, categories, budgets, transactions) con RLS.
- [x] **Bug de RLS encontrado y corregido:** la policy de `household_members` usaba una subquery contra sí misma sin caso base → Postgres tiraba "infinite recursion detected in policy". Fix: función `public.user_household_ids()` `SECURITY DEFINER` (ver migraciones `20260803011339` y `20260803011546`). Todas las policies multi-tenant ahora pasan por esa función.
- [x] Tipos TypeScript generados desde el schema real (`types/supabase.ts`, reemplaza el placeholder).
- [x] Login con Supabase Auth probado end-to-end en navegador con 2 usuarios/households de prueba (`test-a@borb.test` → Casa Test A, `test-b@borb.test` → Casa Test B): cada uno ve únicamente su propio household. **Criterio de salida de Fase 0 cumplido** (login funciona, RLS aísla correctamente).
- [x] Repo subido a GitHub: [zoharod/borb-financial-os](https://github.com/zoharod/borb-financial-os) (privado).
- [x] Proyecto Vercel creado (`borb-a59f/borb-financial-os`) y conectado al repo de GitHub (rama `main` = producción, deploys automáticos en cada push).
- [x] Env vars de Supabase cargadas en Vercel (production/preview/development).
- [x] **Deploy inicial verificado en producción:** https://borb-financial-os.vercel.app — login + aislamiento de RLS probados ahí también con los mismos 2 usuarios de prueba. **Fase 0 100% completa.**
- [x] **Identidad de git corregida para este repo (local, no global):** el `user.email` global de esta máquina es la cuenta de trabajo (WeWorkRemotely), que en GitHub resuelve a una cuenta distinta sin acceso al proyecto de Vercel → Vercel bloqueaba los deploys automáticos por push con `TEAM_ACCESS_REQUIRED`. Se configuró `git config --local user.name/user.email` = `zoharod` / `zoharod@gmail.com` (coincide con la cuenta de GitHub/Vercel dueña del proyecto) **solo en este repo**, sin tocar la config global de trabajo. Los commits previos a este fix quedaron con el autor de trabajo (no se reescribió el historial); los commits nuevos ya deployan automáticamente.
- [x] **Fase 1 completa** — CRUD de Cuentas, Categorías, Transacciones (ingreso/gasto/transferencia) y Presupuesto mensual, más Dashboard real (ingresos/gastos/ahorro/saldo por moneda + presupuesto vs. real). Componentes UI base en `components/ui/` (Button, Input, Select, Card) siguiendo el design system de Stitch. Todo probado en navegador con datos reales y verificado con RLS entre `test-a`/Casa Test A y `test-b`/Casa Test B (households completamente aislados en las 4 tablas nuevas).
- [x] **Bug encontrado: `Map` no sobrevive la persistencia de TanStack Query a IndexedDB.** `useMonthlyActuals` devolvía un `Map`; el `PersistQueryClientProvider` (ver `lib/providers/query-provider.tsx`) serializa la cache a JSON para guardarla, y un `Map` se convierte en `{}` — al hidratar desde IndexedDB, el componente llamaba `.get()` sobre ese objeto plano y crasheaba toda la página. **Regla para código nuevo:** cualquier dato que devuelva un hook de TanStack Query debe ser JSON-safe (objetos planos/arrays/strings/numbers, nunca `Map`/`Set`/`Date` como valor de retorno de una query).
- [x] **Bug de timezone en cálculo de fin de mes:** `new Date("YYYY-MM-01")` parsea el string como medianoche UTC; con `getFullYear()/getMonth()` (locales) en un timezone detrás de UTC (ej. America/Guatemala/Honduras, UTC-6) el mes calculado corre hacia atrás un día, invirtiendo el rango `monthStart`/`monthEnd` y devolviendo 0 resultados. Fix: construir la fecha con `new Date(year, month, day)` (argumentos numéricos, sin parseo de string) — ver `lib/hooks/use-budgets.ts`. Aplicar el mismo cuidado en cualquier cálculo de fecha futuro.
- [x] **Limitación conocida (documentar, no bloquea Fase 1):** el saldo de cuentas trata `type='transfer'` como salida de la cuenta de origen (resta), porque el schema actual (`transactions.account_id`, sin cuenta destino) no permite saber si una fila de transferencia es el lado "entrada" o "salida". Revisar si hace falta un campo `to_account_id` o conciliación entre cuentas cuando se use `transfer` de verdad — ver `lib/hooks/use-dashboard-summary.ts`.
- [x] **Edición inline agregada a Cuentas, Categorías y Transacciones** (antes solo tenían crear+eliminar). Patrón: cada fila de la lista es su propio componente (`AccountRow`, `CategoryRow`, `TransactionRow`) con estado local `isEditing` que alterna entre vista y un mini-formulario precargado con los valores actuales; usan los `useUpdate*` de cada hook (`use-accounts.ts`, `use-categories.ts` ya tenía `useUpdateAccount`; se agregó `useUpdateCategory` y `useUpdateTransaction`).
- [x] **Bug encontrado y corregido: cache de TanStack Query no estaba scoped por usuario.** Las queryKeys (`["accounts"]`, `["categories"]`, etc.) no incluían el id del usuario autenticado. Al probar la edición inline cambiando entre `test-a` y `test-b` en el mismo navegador, la cache persistida en IndexedDB de un usuario (ej. "0 cuentas" de Casa Test A) se le quedó pegada al otro usuario (Casa Test B, que sí tenía una cuenta) — la página mostraba "no hay cuentas" aunque la cuenta existía en la base (confirmado con curl directo a la API). Fix sistémico: nuevo hook `lib/hooks/use-auth-user-id.ts` (`useAuthUserId()`, se suscribe a `onAuthStateChange`); **todos** los hooks de datos (`use-current-household`, `use-accounts`, `use-categories`, `use-transactions`, `use-budgets`, `use-dashboard-summary`) ahora incluyen `userId` en su queryKey y usan `enabled: !!userId` (también evita que la query dispare antes de que la sesión esté lista). Regla documentada en `architecture.md`. Verificado manualmente: test-b → test-a → test-b en el mismo navegador, cada uno ve sus datos correctos sin mezcla.
- [x] **Fase 1-B completa: importación de CSV.** Nueva página `/transactions/import`: elegir cuenta → subir CSV (columnas fecha/descripción/monto, parseado con `papaparse` en `lib/csv.ts`) → preview con checkboxes → importar en bloque (`useBulkCreateTransactions` en `lib/hooks/use-csv-import.ts`, graba `source='csv'`). Detección de duplicados básica: compara `(fecha, monto, moneda)` contra transacciones existentes de la cuenta elegida (`useExistingTransactionKeys`); las filas que matchean aparecen destildadas en la preview. Categoría queda `null` en la importación — se categoriza después con la edición inline. Probado en navegador: import exitoso de 2 filas + 1 duplicado detectado correctamente (coincidía con una transacción manual ya cargada), dashboard actualizado con los montos correctos, y error claro al subir un CSV con columnas equivocadas.

- [x] **Registro real con Google Auth + onboarding de household.** El usuario decidió usar Google OAuth en vez de email/password para su cuenta real (evita el problema de confirmación de email y no requiere manejar contraseñas). Agregado:
  - Botón "Continuar con Google" en `/login` (`supabase.auth.signInWithOAuth`), junto con el form de email/password existente (se mantiene para los usuarios de prueba).
  - `app/auth/callback/route.ts` — intercambia el code OAuth por sesión (`exchangeCodeForSession`), agregado a `PUBLIC_PATHS` en `lib/supabase/middleware.ts`.
  - Función `SECURITY DEFINER` `public.create_household_for_current_user(household_name)` (migración `20260803173240`) — resuelve el mismo problema de "huevo y gallina" de RLS que `user_household_ids()`, pero para el INSERT inicial de household+membership de un usuario que todavía no pertenece a ninguno.
  - `use-current-household.ts` cambiado de `.single()` a `.maybeSingle()` (0 filas ya no es un error) + nuevo `useCreateHousehold()`.
  - Cliente OAuth de Google creado por el usuario en Google Cloud Console, configurado en Supabase Auth (`external_google_enabled=true`) vía Management API.
  - **Probado:** login con `test-b` (ya tenía household) sigue funcionando sin pasar por el onboarding. El botón "Continuar con Google" redirige correctamente a la pantalla real de Google mostrando "continuar a Borb Financial OS" y la cuenta del usuario.
- [x] **Bug encontrado y corregido: login con Google terminaba en pantalla en blanco (`localhost:3000/?code=...`).** El `site_url` de Supabase estaba en `http://localhost:3000` y `uri_allow_list` vacío — Supabase solo permite redirigir a URLs en esa lista, así que rechazaba nuestro `redirectTo` (`/auth/callback`) y caía al `site_url` a secas, dejando el `code` colgado en la raíz sin que nadie lo consumiera. Fix: `site_url` → `https://borb-financial-os.vercel.app`, `uri_allow_list` → `http://localhost:3000/**,https://borb-financial-os.vercel.app/**` (vía Management API). Pendiente que el usuario confirme el login completo de punta a punta con su cuenta real (yo solo puedo verificar hasta la pantalla de selección de cuenta de Google, no debo completarlo con su contraseña).
- [x] **Onboarding ampliado a wizard de 3 pasos (feedback del usuario: "un mejor onboarding... para que sea intuitivo qué información ir subiendo").** `components/household-guard.tsx` (solo pedía nombre del hogar) reemplazado por `components/onboarding-guard.tsx`: Paso 1 hogar → Paso 2 primera cuenta → Paso 3 categorías (chips de sugeridas: Comida, Transporte, Vivienda, Servicios, Salud, Entretenimiento, Extras/Imprevistos, + input libre; al menos 1 para avanzar). Presupuesto queda fuera del wizard a propósito (no es prerequisito de nada, su propia página ya lo resuelve). Nuevo `lib/constants.ts` centraliza `CURRENCIES`/`ACCOUNT_TYPES`/`SUGGESTED_CATEGORIES` (reusado por `/accounts`, `/budgets` y el wizard). Probado de punta a punta con un usuario de prueba temporal: los 3 pasos crean los datos correctamente y termina en el dashboard normal.
- [x] **Fase 1-C — Integridad Financiera, pedida explícitamente por el usuario antes de arrancar Fase 2.** Alcance completo (puntos 2 al 6 del pedido; 1 y 7 dependen del usuario, ver abajo):
  - **Schema** (migración `20260804101156`): `accounts.type` ahora acepta `credit_card` (además de `checking`/`savings`); `transactions.to_account_id` (nuevo, cuenta destino de transfer/card_payment); `transactions.type` ahora acepta `card_payment`, `refund`, `adjustment` (además de `income`/`expense`/`transfer`).
  - **Trigger de integridad** `public.validate_transaction_accounts()`: valida en la base (no solo en la app) que `account_id`/`to_account_id` pertenezcan al `household_id` de la transacción, que sean cuentas distintas, que sus monedas coincidan, y que `to_account_id` esté presente solo cuando el tipo lo requiere. **Probado con curl directo (bypaseando RLS y la UI):** los 4 casos inválidos (moneda distinta, `to_account_id` faltante, `to_account_id` sobrando, cuenta de otro household) fueron rechazados correctamente por la base.
  - **Semántica confirmada con el usuario:** devolución resta del gasto neto (no es ingreso nuevo); pago de tarjeta se comporta como transferencia (no duplica gasto) hacia una cuenta `credit_card`; ajuste es la única transacción con monto potencialmente negativo, no cuenta como ingreso ni gasto.
  - **Nuevo hook `use-account-balances.ts`**: saldo real por cuenta (a diferencia de `use-dashboard-summary.ts`, que agrega por moneda a nivel household y por eso puede ignorar transfer/card_payment ya que se cancelan matemáticamente — el saldo por cuenta sí necesita `to_account_id`).
  - **`/accounts` ahora muestra el saldo calculado de cada cuenta** y tiene una acción "Conciliar": el usuario ingresa el saldo real (según el banco), ve la diferencia, y un botón crea una transacción `type='adjustment'` por esa diferencia con `reconciled_at = now()`.
  - **Bug encontrado y corregido: ninguna mutación de transacciones invalidaba `dashboard-summary`/`monthly-actuals`/`account-balances`, solo `transactions`.** Se detectó probando la conciliación sin navegar fuera de `/accounts` (sin remount de página no hay refetch automático, así que el saldo mostrado quedaba viejo después de crear el ajuste, aunque el ajuste sí se había guardado bien en la base). Los tests anteriores de transfer/card_payment/refund habían "pasado" por casualidad de timing (`staleTime` de 60s ya vencido al momento de revisar, después de navegar entre páginas), no porque la invalidación estuviera bien armada. Fix: `invalidateTransactionDerivedQueries()` en `use-transactions.ts`, usada por las 3 mutaciones y por `useBulkCreateTransactions` (CSV import). Ver regla nueva en `architecture.md`.
  - **Probado en navegador de punta a punta** con 3 cuentas (Ahorro L, Efectivo, Tarjeta Visa) en Casa Test B: transferencia (dashboard sin cambios ✓), pago de tarjeta (sin duplicar gasto ✓), devolución (resta 100 de "Gastos del mes" y del presupuesto de Comida ✓), ajuste vía conciliación (+20.50 y luego -50, saldo actualizado en vivo tras el fix ✓).

## 🔄 En progreso

- **Punto 1 (validar onboarding + Google Login):** pendiente que el usuario confirme el login completo de punta a punta con su cuenta real — no lo puedo completar yo.
- **Punto 7 (limpiar usuarios de prueba):** pendiente que el usuario confirme que ya no los necesita antes de borrarlos.

## ⏭️ Siguiente (próxima sesión)

1. Confirmar con el usuario que el login con Google + wizard de onboarding funcionan completo con su cuenta real (punto 1 de Fase 1-C).
2. Preguntarle al usuario si ya quiere que borre los usuarios de prueba (punto 7 de Fase 1-C) — con eso Fase 1-C queda 100% cerrada.
3. Decidir: ¿Fase 2 (Tarjetas y Cashback, ahora con más base real gracias a la cuenta `credit_card`) u otra cosa?
4. Los 2 usuarios/households de prueba (`test-a@borb.test` / `test-b@borb.test`, password `TestPass123!`) quedan en la base (local y producción). Casa Test B ahora tiene 3 cuentas (Ahorro L, Efectivo, Tarjeta Visa) y varias transacciones de los 6 tipos, usadas para probar Fase 1-C.

## 📌 Decisiones clave registradas (no reabrir sin razón nueva)

| Decisión | Valor | Razón |
|---|---|---|
| Plataforma | Web + móvil responsive (mismo código) | Definido por el usuario |
| Entrada de datos Fase 1 | Manual únicamente | CSV y captura automática (email/OCR/PDF/SMS) confirmados para fases futuras |
| Almacenamiento | Supabase (Postgres en la nube) | Elegido por el usuario |
| Multi-usuario | 2 personas, mismo hogar, datos compartidos | Requiere modelo "Household" desde el día 1 |
| Seguridad | Multi-tenant con RLS de Supabase | Confirmado explícitamente por el usuario |
| Offline | Simple (solo lectura sin conexión) | Offline completo evaluado y descartado para MVP por decisión explícita |
| Moneda | HNL y USD independientes, sin conversión automática | Igual que el Excel actual del usuario |
| Presupuesto infraestructura | $20–50 USD/mes | Definido por el usuario |
| Diseño UI | Screens de Stitch obtenidas (`docs/design/`): Command Center, Financial Brief, Wealth Dashboard, Set Budget + sistema de diseño "Aura Finance" (dark, glassmorphism, Inter+JetBrains Mono) | Ver nota "⚠️ Alcance del diseño UI vs. fase actual" abajo — **no implementar las 4 screens tal cual en Fase 1** |

## ⚠️ Alcance del diseño UI vs. fase actual

Las 4 screens traídas de Stitch (`docs/design/screens/`) representan la **visión completa del producto** (todas las fases), no solo el MVP de Fase 1:

| Screen | Corresponde a |
|---|---|
| Wealth Dashboard | Fase 1 (Dashboard) — usable como referencia directa |
| Set Budget | Fase 1 (Presupuesto) — usable como referencia directa |
| Financial Brief | Fase 4/5 (capa de "Inteligencia": resúmenes generados por IA, insights proactivos) |
| Command Center | Fase 4/5 (búsqueda/acciones en lenguaje natural, IA) |

`docs/design/experience-architecture.md` (doc de Stitch) describe navegación por tabs "Brief / Wealth / Flow / Vault", Command Bar global con IA, y optimización de tarjetas — todo esto excede el alcance de Fase 1 según `roadmap.md` y viola los principios no negociables de `CLAUDE.md` (no construir fuera de la fase actual).

**Cómo usarlo en Fase 1:** tomar el sistema de diseño (`design-system.md`: paleta, tipografía, radios, componentes) como guía visual para TODAS las pantallas, pero construir solo las pantallas y funcionalidades del alcance de Fase 1 (Cuentas, Transacciones, Categorías, Presupuesto, Dashboard simple — sin Command Bar ni Brief con IA). Adaptar "Wealth Dashboard" y "Set Budget" según haga falta; no implementar "Command Center" ni "Financial Brief" hasta que su fase corresponda.

## 🚫 Explícitamente fuera de alcance (no implementar sin re-abrir el PRD)

Importación CSV (hasta Fase 1-B), tarjetas/cashback (Fase 2), gastos anuales/fondos (Fase 2), metas de ahorro (Fase 3), reportes avanzados (Fase 3), lectura de correo/OCR/PDF/SMS (Fase 4), alertas proactivas/IA/simulaciones/motor de reglas (Fase 5), offline completo (no planeado, re-evaluar si se necesita).

## 🧭 Regla de oro para Claude Code

No generar código de una fase sin haber leído `roadmap.md` y sin haber actualizado este archivo al terminar. Iterativo, no one-shot. Cada sesión termina actualizando "✅ Hecho", "🔄 En progreso" y "⏭️ Siguiente".
