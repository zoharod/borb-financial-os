# CLAUDE.md — Instrucciones para Claude Code en este repo

Este proyecto es **Borb Financial OS**, una app de finanzas personales para un hogar de 2 personas. Este archivo son las reglas de trabajo para cualquier sesión de Claude Code en este repo.

## Regla de oro

**No generar código sin antes leer `docs/project_state.md` y `docs/roadmap.md`.** Desarrollo iterativo por fases, nunca one-shot. Al terminar una sesión de trabajo, actualizar `docs/project_state.md` (secciones ✅ Hecho / 🔄 En progreso / ⏭️ Siguiente) antes de cerrar.

## Documentos de referencia (en orden de lectura)

1. `docs/PRD.md` — qué se construye y por qué (producto).
2. `docs/TDR.md` — requisitos técnicos de alto nivel.
3. `docs/architecture.md` — fuente de verdad técnica: stack, schema de base de datos, RLS, offline, moneda.
4. `docs/roadmap.md` — plan por fases (Fase 0 a Fase 5).
5. `docs/project_state.md` — backlog activo, qué está hecho, qué sigue, decisiones ya tomadas (no reabrir sin razón nueva).

## Principios no negociables

- **Multi-tenant desde el día 1:** todo dato cuelga de `household_id`. Ninguna tabla de datos de negocio se crea sin política RLS.
- **`transactions` es la fuente única de verdad.** Saldos, presupuesto vs. real, y todo cálculo futuro se derivan de ahí, nunca se editan en paralelo.
- **No construir features fuera de la fase actual.** Si algo suena a Fase 2+ (tarjetas, IA, importación, reportes avanzados), no se implementa aunque sea fácil de "meter de una vez" — se anota en `roadmap.md` si no está ya.
- **Columnas reservadas ya existen** (`transactions.source`, `card_id`, `reconciled_at`) para que fases futuras no requieran migraciones destructivas — no eliminarlas ni ignorarlas.
- **Offline es "simple" en Fase 1**: solo lectura cacheada. No implementar cola de sincronización ni resolución de conflictos salvo que `roadmap.md` lo indique explícitamente para la fase activa.

## Convenciones técnicas

- Next.js App Router + TypeScript estricto.
- Tailwind para estilos (sin CSS-in-JS adicional).
- Cliente de Supabase separado para server components y client components (`lib/supabase`).
- Tipos de base de datos generados desde el schema de Supabase, no escritos a mano cuando sea posible.
- Un commit lógico por unidad de trabajo pequeña — evitar PRs/commits gigantes que mezclen varias fases.

## Al empezar una sesión nueva

1. Leer `docs/project_state.md`.
2. Confirmar en qué fase estamos según `docs/roadmap.md`.
3. Proponer el siguiente paso concreto (no asumir "seguir con todo") y confirmar con el usuario si hay ambigüedad.
4. Al cerrar, actualizar `docs/project_state.md`.
