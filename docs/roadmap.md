# roadmap.md — Borb Financial OS

> Roadmap dinámico. Se actualiza a medida que se completan fases. Estado detallado turno-a-turno vive en `project_state.md`; aquí vive la vista de planificación.

Modelo de dominio completo (referencia para todas las fases):

```
Capturar → Normalizar → Clasificar → Administrar → Analizar →
Optimizar → Proyectar → Presentar → Alertar → Automatizar → Aprender → Gobernar
```

---

## Fase 0 — Setup del proyecto
**Estado: ✅ completa**

- [x] Inicializar repo Next.js + TypeScript + Tailwind.
- [x] Crear proyecto Supabase, configurar variables de entorno.
- [x] Crear schema inicial (`households`, `household_members`, `accounts`, `categories`, `budgets`, `transactions`) con RLS.
- [x] Configurar Supabase Auth (email/password).
- [x] Deploy inicial a Vercel (esqueleto, "Hello World" autenticado) — https://borb-financial-os.vercel.app, conectado a GitHub (`zoharod/borb-financial-os`, rama `main`) para deploys automáticos.

**Criterio de salida:** login funciona, RLS probado con 2 hogares de prueba que NO se ven datos entre sí. **✅ Cumplido** — probado en navegador con `test-a@borb.test` / `test-b@borb.test` (ver `project_state.md`). Detalle técnico del bug de RLS encontrado y su fix en `architecture.md` ("Multi-tenancy").

---

## Fase 1 — MVP (núcleo)
**Estado: pendiente — arranca después de Fase 0**

Activa versión simple de: Capturar, Administrar, Analizar, Presentar.

- CRUD de Cuentas.
- CRUD de Categorías (con flag `is_extra_default`).
- Registro manual de Transacciones (ingreso/gasto/transferencia).
- CRUD de Presupuesto mensual por categoría.
- Dashboard: resumen del mes (ingresos/gastos/ahorro por moneda), presupuesto vs. real con barra de progreso.
- Multi-usuario compartiendo el mismo household en tiempo real.
- Offline simple (lectura sin conexión).

**Criterio de salida (Definition of Done ligado al PRD):** el usuario puede ver su estado real de cuentas y presupuesto sin usar el Excel, con datos correctos.

---

## Fase 1-B — Importación de datos
**Estado: no iniciada**

- Importación de CSV / estados de cuenta.
- Detección de duplicados básica (conciliación simple contra transacciones ya existentes).

---

## Fase 2 — Tarjetas y Cashback
**Estado: no iniciada**

- Módulo de Tarjetas: reglas de cashback por categoría, tope mensual, cashback acumulado/restante.
- Recomendación de qué tarjeta usar según categoría y tope disponible.
- Gastos anuales: definir gasto anual, división automática entre 12, fondo acumulado visible.

---

## Fase 3 — Metas y Reportes
**Estado: no iniciada**

- Metas de ahorro (objetivo, ahorro actual, % avance, fecha estimada).
- Reportes históricos (gasto por categoría, tendencia anual, cashback generado).
- Timeline financiero por cuenta.

---

## Fase 4 — Automatización (Captura inteligente)
**Estado: no iniciada**

- Lectura de correos (Gmail) para detectar transacciones.
- OCR de fotos de facturas / capturas de pantalla.
- Lectura de PDFs de estados de cuenta.
- Normalización automática (comercio, monto, fecha, banco, tarjeta) + clasificación automática con confirmación cuando hay duda.

---

## Fase 5 — Inteligencia (Optimizar / Proyectar / Alertar / Aprender / Gobernar)
**Estado: no iniciada**

- Recomendaciones proactivas (alertas de sobrepresupuesto, cashback por vencer, pagos próximos).
- Proyección de ahorro y cierre de mes.
- Simulaciones "qué pasa si".
- Motor de reglas configurable (módulo Gobernar: monedas, tipos de cambio, permisos, automatizaciones).
- Aprendizaje de patrones de categorización y hábitos.

---

## Notas de alcance

- **Offline completo** (registrar sin conexión + sync automático) fue evaluado y **descartado para Fase 1** por decisión explícita del producto — se reconsiderará como parte de una fase posterior si se vuelve necesario.
- Cada fase nueva debe re-evaluar `architecture.md` antes de escribir código, no asumir que el schema de la fase anterior alcanza.
