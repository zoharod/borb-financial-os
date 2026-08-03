# project_state.md — Backlog y memoria activa

> Este archivo es la memoria de trabajo del proyecto. Se actualiza al final de cada sesión de desarrollo. Claude Code debe leer este archivo ANTES de escribir código en cualquier sesión.

**Última actualización:** 2026-08-03
**Fase actual:** Fase 1 completa ✅ — lista para Fase 1-B o para pulir Fase 1

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

## 🔄 En progreso

- Nada — Fase 1 cerrada.

## ⏭️ Siguiente (próxima sesión)

1. Decidir: ¿Fase 1-B (importación CSV) o pulir Fase 1 (ej. resolver semántica de `transfer` con 2 cuentas, agregar edición inline de cuentas/categorías/transacciones que hoy solo tienen crear+eliminar, no editar)?
2. Deploy de Fase 1 a producción (push a `main` ya dispara el deploy automático — confirmar que la Vercel corrida con las nuevas rutas funciona igual que en local).
3. Los 2 usuarios/households de prueba (`test-a@borb.test` / `test-b@borb.test`, password `TestPass123!`) quedan en la base (local y producción), ahora con datos de ejemplo en Casa Test B (cuenta "Ahorro L", categoría "Comida", 2 transacciones, 1 presupuesto) — borrarlos antes de invitar usuarios reales.

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
