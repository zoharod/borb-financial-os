# project_state.md — Backlog y memoria activa

> Este archivo es la memoria de trabajo del proyecto. Se actualiza al final de cada sesión de desarrollo. Claude Code debe leer este archivo ANTES de escribir código en cualquier sesión.

**Última actualización:** 2026-08-02
**Fase actual:** Fase 0 — Setup del proyecto (no iniciada aún)

---

## ✅ Hecho

- [x] Entrevista de producto completa (problema, usuarios, MVP, restricciones).
- [x] PRD.md redactado y aprobado.
- [x] TDR.md redactado y aprobado.
- [x] architecture.md redactado (stack, modelo de datos, RLS, offline, moneda).
- [x] roadmap.md redactado (Fase 0 a Fase 5).
- [x] Decisión de stack confirmada: Next.js + Supabase + Tailwind + Vercel.

## 🔄 En progreso

- Nada en desarrollo activo todavía. Este es el punto de partida para Claude Code.

## ⏭️ Siguiente (próxima sesión)

1. Ejecutar Fase 0: inicializar repo Next.js + TypeScript + Tailwind.
2. Crear proyecto Supabase y aplicar el schema de `architecture.md` (households, household_members, accounts, categories, budgets, transactions) con políticas RLS.
3. Configurar Supabase Auth (email/password).
4. Probar RLS con 2 households ficticios para confirmar aislamiento de datos.
5. Deploy esqueleto a Vercel.
6. **No avanzar a Fase 1 hasta que el criterio de salida de Fase 0 esté cumplido** (ver roadmap.md).

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
| Diseño UI | Pendiente — Google Stitch mencionado pero sin integración disponible; el usuario proveerá screens/export manualmente cuando estén listas | No bloquea Fase 0/1 (backend y lógica no dependen del UI final) |

## 🚫 Explícitamente fuera de alcance (no implementar sin re-abrir el PRD)

Importación CSV (hasta Fase 1-B), tarjetas/cashback (Fase 2), gastos anuales/fondos (Fase 2), metas de ahorro (Fase 3), reportes avanzados (Fase 3), lectura de correo/OCR/PDF/SMS (Fase 4), alertas proactivas/IA/simulaciones/motor de reglas (Fase 5), offline completo (no planeado, re-evaluar si se necesita).

## 🧭 Regla de oro para Claude Code

No generar código de una fase sin haber leído `roadmap.md` y sin haber actualizado este archivo al terminar. Iterativo, no one-shot. Cada sesión termina actualizando "✅ Hecho", "🔄 En progreso" y "⏭️ Siguiente".
