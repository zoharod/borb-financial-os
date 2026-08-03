# TDR — Technical Design Requirements
## Sistema Financiero Personal (Borb Financial OS)

**Versión:** 1.0 — Aprobado
**Depende de:** PRD.md v1.0

---

## 1. Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (React, App Router) | Un solo código para web y móvil responsive; server components; convertible a PWA después |
| Estilos | Tailwind CSS | Consistencia visual (barras de progreso, colores semáforo, cards) |
| Backend / DB | Supabase (Postgres) | Postgres real, RLS nativo para multi-tenancy, Auth y Storage incluidos |
| Autenticación | Supabase Auth | Email/password para MVP; extensible a OAuth después |
| Hosting | Vercel (frontend) + Supabase Cloud | Encaja en presupuesto $20–50/mes, deploys automáticos |
| Estado / cache cliente | React Query (TanStack Query) + persistencia IndexedDB | Necesario para el modo offline simple |

## 2. Multi-tenancy (Household)

```
households
  id, name, base_currency_default, created_at

household_members
  id, household_id (FK), user_id (FK -> auth.users), role, joined_at
```

RLS en TODAS las tablas de datos, filtrando por `household_id`. No negociable desde el primer schema. **Detalle de implementación exacto (patrón real, con el fix de recursión de RLS encontrado en Fase 0) en `architecture.md` → "Multi-tenancy" — no usar la subquery ingenua directa contra `household_members`.**

## 3. Modelo de datos — Fase 1

```
accounts
  id, household_id (FK), name, currency (HNL|USD), type (checking|savings), created_at

categories
  id, household_id (FK), name, is_extra_default (bool), created_at

budgets
  id, household_id (FK), category_id (FK), month (date), planned_amount, currency

transactions
  id, household_id (FK), account_id (FK), category_id (FK, nullable),
  type (income|expense|transfer), amount, currency, description,
  transaction_date, created_by (user_id), status (confirmed|pending),
  created_at, updated_at
```

`transactions` es la tabla raíz (fuente única de verdad). Saldos de cuentas se derivan, nunca se editan directo.

**Campos reservados para fases futuras (no crear tablas vacías, solo dejar el campo):**
- `transactions.source` (manual|csv|email|ocr|sms), default `'manual'`.
- `transactions.card_id` (nullable, FK futura a `cards`).
- `transactions.reconciled_at` (nullable).

## 4. Moneda

HNL y USD como monedas independientes en Fase 1, sin conversión automática (igual que el Excel actual). Tabla `exchange_rates` reservada para cuando se necesite patrimonio consolidado.

## 5. Offline (Fase 1 = "offline simple")

- Lectura sin conexión vía React Query + persistencia IndexedDB (último dashboard/cuentas/transacciones vistas).
- Escritura requiere conexión activa; si no hay conexión, se bloquea el guardado con aviso claro.
- Diferido a fase futura: cola de escritura offline, resolución de conflictos, service worker con background sync.

## 6. Seguridad

- RLS activo desde el día 1 en todas las tablas.
- Auth gestionada por Supabase (no se implementa lógica propia).
- Service role key solo server-side, nunca expuesta al cliente.
- HTTPS end-to-end (Vercel + Supabase por defecto).

## 7. No-funcionales

- Dashboard <2s de carga con hasta ~5,000 transacciones por hogar.
- Modelo de datos debe soportar sin romper: tarjetas, cashback, metas, fondos anuales, reglas, fuentes automatizadas de captura.
- Costo dentro de $20–50 USD/mes en Fase 1.

## 8. Fuera de alcance técnico en Fase 1

Integraciones externas (Gmail, PDF, OCR, SMS), motor de reglas configurable, tablas `cards`/`goals`/`annual_funds`/`exchange_rates` (se crean cuando su fase inicie).
