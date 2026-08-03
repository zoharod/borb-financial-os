# PRD — Sistema Financiero Personal (Household Finance OS)

**Versión:** 1.0 — Aprobado
**Última actualización:** 2026-08-02

---

## 1. Visión

Reemplazar el Excel de finanzas personales por un **centro de control financiero proactivo** para un hogar de 2 personas, que no solo registre lo que pasó, sino que indique qué hacer: qué tarjeta usar, cuánto se puede gastar, si se va bien con el presupuesto y las metas de ahorro.

Ciclo de vida de la información (modelo de dominio completo, se activa por fases):

```
Capturar → Normalizar → Clasificar → Administrar → Analizar →
Optimizar → Proyectar → Presentar → Alertar → Automatizar → Aprender → Gobernar
```

Este PRD cubre **Fase 1 (MVP)**: versión simple de Capturar, Administrar, Analizar y Presentar.

## 2. Problema a resolver

Excel manual hoy: comparación presupuesto vs. real, flujo de caja mensual y cálculo de ahorro a mano. No escala, no es compartible en tiempo real entre 2 personas, no avisa proactivamente, no proyecta el futuro.

## 3. Usuarios objetivo

**Hogar de 2 personas** (multi-tenant: "Household"). Ambos usuarios ven y editan las mismas cuentas, transacciones, presupuestos y metas, con aislamiento de datos entre hogares vía RLS (Supabase).

## 4. Objetivo de éxito

> "Puedo ver mi estado actual de cuentas y deudas en cualquier momento, de forma confiable, sin depender del Excel."

## 5. Alcance — Fase 1 (MVP)

| Módulo | Funcionalidad MVP |
|---|---|
| Autenticación | Login email/password, modelo multi-tenant "Household" (Supabase Auth + RLS) |
| Cuentas | CRUD de cuentas (Pagos L, Pagos $, Ahorro L, Ahorro $), saldo actual |
| Transacciones | Registro manual ingreso/gasto/transferencia: fecha, monto, moneda, cuenta, categoría |
| Categorías | CRUD de categorías, clasificación automática "Extras/Imprevistos" para gasto sin categoría presupuestada |
| Presupuesto | Presupuesto mensual por categoría, comparación vs. real con barra de progreso (rojo si excede) |
| Dashboard | Resumen del mes: ingresos, gastos, ahorro, saldo disponible por moneda (L y $) |
| Multi-moneda | HNL y USD como monedas independientes, sin conversión automática |
| Offline | Simple: ver datos cacheados sin conexión; crear/editar requiere conexión |
| Multi-usuario | 2 usuarios del hogar comparten datos en tiempo real |

### Fuera de alcance en Fase 1 (confirmado, no perdido — ver roadmap.md)

Importación CSV/estados de cuenta, lectura de correos/PDF/OCR/SMS, tarjetas y cashback, gastos anuales/fondos, metas de ahorro, reportes avanzados, alertas proactivas, IA/recomendaciones, simulaciones, offline completo, motor de reglas (Gobernar).

## 6. Historias de usuario — Fase 1

1. Crear cuentas para tener un punto de partida de saldos.
2. Registrar una transacción manual en segundos (cuenta, categoría, moneda).
3. Definir presupuesto mensual por categoría y compararlo con el gasto real.
4. Ver en el dashboard cuánto tengo, gasté, ahorré, y el estado del presupuesto.
5. Compartir en tiempo real las mismas cuentas con mi pareja.
6. Ver mis datos sin internet (modo consulta).

## 7. Restricciones

- Presupuesto de infraestructura: ~$20–50 USD/mes.
- Seguridad: aislamiento estricto de datos por hogar (RLS).
- El modelo de datos debe soportar sin rediseño los módulos de fases futuras.

## 8. Métricas

- % de meses donde el dashboard refleja el saldo real sin corrección manual.
- Tiempo promedio para registrar una transacción.
- Abandono del Excel como fuente de verdad (autoreportado).
