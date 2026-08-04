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
**Estado: ✅ completa (núcleo funcional), con 2 puntos a validar — ver notas**

Activa versión simple de: Capturar, Administrar, Analizar, Presentar.

- [x] CRUD de Cuentas.
- [x] CRUD de Categorías (con flag `is_extra_default`).
- [x] Registro manual de Transacciones (ingreso/gasto/transferencia). Nota: el saldo trata `transfer` como salida de la cuenta de origen — ver limitación en `project_state.md` (schema no tiene cuenta destino).
- [x] CRUD de Presupuesto mensual por categoría.
- [x] Dashboard: resumen del mes (ingresos/gastos/ahorro por moneda), presupuesto vs. real con barra de progreso.
- [~] Multi-usuario compartiendo el mismo household — el modelo de datos y RLS lo soportan (household_id compartido), pero se probó aislamiento **entre** households (test-a/Casa A vs. test-b/Casa B), no 2 usuarios **dentro del mismo** household viendo los mismos datos. "En tiempo real" (updates sin refresh entre pestañas) no está implementado — no hay suscripciones de Supabase Realtime, solo refetch de TanStack Query tras cada mutación local.
- [~] Offline simple (lectura sin conexión) — la infraestructura (TanStack Query + persistencia IndexedDB) está andando y se corrigió un bug real de serialización (ver `project_state.md`), pero no se probó explícitamente el escenario "sin conexión, ver datos cacheados".

**Criterio de salida (Definition of Done ligado al PRD):** el usuario puede ver su estado real de cuentas y presupuesto sin usar el Excel, con datos correctos. **✅ Cumplido** para un usuario por household — probado end-to-end en navegador con datos reales (cuenta, categoría, 2 transacciones, 1 presupuesto, dashboard con los montos correctos).

---

## Fase 1-B — Importación de datos
**Estado: ✅ completa**

- [x] Importación de CSV / estados de cuenta — formato simple de 3 columnas (fecha, descripción, monto), sin UI de mapeo de columnas. Ver `architecture.md` → "Importación CSV (Fase 1-B)".
- [x] Detección de duplicados básica (conciliación simple contra transacciones ya existentes) — compara fecha+monto+moneda exactos dentro de la cuenta elegida; filas que matchean quedan destildadas en la preview por defecto.

Probado en navegador: parseo, preview, un caso de duplicado detectado correctamente, import en bloque, error claro con un CSV de columnas equivocadas.

---

## Fase 1-C — Integridad Financiera
**Estado: técnicamente completa — quedan 2 puntos que dependen del usuario (1 y 7)**

Decisión explícita del usuario: antes de Fase 2 (Tarjetas/Cashback), cerrar esta fase para que los números del dashboard sean confiables al 100% con dinero real. Alcance:

1. [ ] Validar onboarding y Google Login con la cuenta real del usuario (pendiente del lado del usuario — no lo puedo completar yo).
2. [x] Implementar transferencias entre cuentas (columna `to_account_id`, antes solo existía `account_id`).
3. [x] Diferenciar 6 tipos de transacción: ingreso, gasto, transferencia, pago de tarjeta, devolución, ajuste.
4. [x] Confirmar que transferencias no alteran ingresos ni gastos del dashboard — probado en navegador.
5. [x] Confirmar que pagos de tarjeta no duplican el gasto (se tratan como transferencia, no como gasto nuevo) — probado en navegador.
6. [x] Agregar conciliación básica de saldos (saldo calculado vs. saldo real declarado → genera un ajuste) — probado en navegador.
7. [ ] Limpiar usuarios de prueba (`test-a`, `test-b`) cuando el usuario confirme que ya no los necesita.

Probado también: trigger de integridad a nivel de base de datos rechaza (con curl directo, bypaseando RLS y la UI) transferencias con moneda distinta entre origen/destino, `to_account_id` faltante o presente donde no corresponde, y cuentas de otro household — ver `project_state.md` para el detalle de cada caso.

**Decisiones de diseño (confirmadas con el usuario):**
- **Devolución:** resta del gasto neto (dashboard y presupuesto vs. real), no cuenta como ingreso nuevo.
- **Pago de tarjeta:** se agrega un tercer tipo de cuenta `credit_card` (junto a `checking`/`savings`). Un pago de tarjeta es una transferencia hacia una cuenta de ese tipo — mueve saldo, no es gasto. El seguimiento de compras/deuda de la tarjeta en sí (cashback, tope mensual) sigue siendo Fase 2; por ahora el saldo de una cuenta `credit_card` solo refleja los pagos hechos hacia ella.
- **Ajuste:** corrección manual de saldo (puede ser positivo o negativo), no cuenta como ingreso ni gasto. Es lo que genera la conciliación básica del punto 6.
- Ver `architecture.md` → "Transferencias y tipos de transacción (Fase 1-C)" para el diseño técnico completo (schema, validación de integridad, fórmulas de agregación).

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
