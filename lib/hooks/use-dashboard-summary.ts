"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthUserId } from "@/lib/hooks/use-auth-user-id";
import { nextOccurrenceOfDay, todayISO } from "@/lib/date";

export function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndOf(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return `${year}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
}

export type CurrencyTotals = Record<string, number>;

export type DashboardSummary = {
  monthlyIncome: CurrencyTotals;
  monthlyExpense: CurrencyTotals;
  // Plata líquida (checking/savings) — antes "balance" mezclaba esto con la
  // deuda de tarjeta en un solo número engañoso. Ver domain.md "Dashboard".
  liquidBalance: CurrencyTotals;
  // Positivo = lo que debés en total en cada moneda (suma de |saldo negativo|
  // de cuentas type='credit_card'). Nunca se resta directo de liquidBalance.
  cardDebt: CurrencyTotals;
  // Compromisos activos (financial_commitments) cuyo próximo pago cae antes
  // de fin de mes.
  committedThisMonth: CurrencyTotals;
  // Ingreso esperado (todavía no recibido) con fecha esperada este mes.
  expectedIncomeThisMonth: CurrencyTotals;
  // Pagos de tarjeta con vencimiento este mes (full_payment_amount si está
  // cargado, si no minimum_payment) — atribuidos a la moneda de su única
  // cuenta vinculada, o a la moneda primaria si la tarjeta es dual-moneda.
  cardPaymentsDueThisMonth: CurrencyTotals;
  // liquidBalance + expectedIncomeThisMonth - committedThisMonth - cardPaymentsDueThisMonth
  projectedBalance: CurrencyTotals;
};

function addTo(totals: CurrencyTotals, currency: string, delta: number) {
  totals[currency] = (totals[currency] ?? 0) + delta;
}

// Ver architecture.md "Transferencias y tipos de transacción (Fase 1-C)" y
// "Dashboard: posición financiera" para la semántica completa de cada tipo.
export function useDashboardSummary(month: string, primaryCurrency: string) {
  const userId = useAuthUserId();

  return useQuery({
    // Ver use-current-household.ts: key con userId para no mezclar cache
    // entre usuarios distintos en el mismo navegador.
    queryKey: ["dashboard-summary", month, primaryCurrency, userId],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardSummary> => {
      const supabase = createClient();
      const [accountsRes, txRes, commitmentsRes, incomeRes, cardsRes] =
        await Promise.all([
          supabase.from("accounts").select("id, type, currency, card_id"),
          supabase
            .from("transactions")
            .select("account_id, to_account_id, type, amount, currency, transaction_date"),
          supabase
            .from("financial_commitments")
            .select("amount, currency, status, next_payment_date"),
          supabase
            .from("expected_income")
            .select("amount, currency, status, expected_date"),
          supabase
            .from("cards")
            .select("id, payment_due_day, minimum_payment, full_payment_amount"),
        ]);

      if (accountsRes.error) throw accountsRes.error;
      if (txRes.error) throw txRes.error;
      if (commitmentsRes.error) throw commitmentsRes.error;
      if (incomeRes.error) throw incomeRes.error;
      if (cardsRes.error) throw cardsRes.error;

      const accounts = accountsRes.data;
      const accountById = new Map(accounts.map((a) => [a.id, a]));

      const monthStart = month;
      const monthEnd = monthEndOf(month);
      const today = todayISO();

      const monthlyIncome: CurrencyTotals = {};
      const monthlyExpense: CurrencyTotals = {};
      // Saldo por cuenta (mismo cálculo que use-account-balances.ts) — se
      // necesita acá para poder agrupar por tipo de cuenta (líquido vs.
      // deuda de tarjeta), algo que un agregado directo por moneda no puede
      // distinguir.
      const accountBalance = new Map<string, number>();
      const addToAccount = (accountId: string, delta: number) =>
        accountBalance.set(accountId, (accountBalance.get(accountId) ?? 0) + delta);

      for (const row of txRes.data) {
        const amount = Number(row.amount);
        const inMonth =
          row.transaction_date >= monthStart && row.transaction_date <= monthEnd;

        switch (row.type) {
          case "income":
            addToAccount(row.account_id, amount);
            if (inMonth) addTo(monthlyIncome, row.currency, amount);
            break;
          case "expense":
          case "financing_installment":
            // La cuota resta plata real de la cuenta pagadora, pero solo
            // 'expense' cuenta como gasto — la cuota no duplica la compra
            // original (ver domain.md "Compromisos financieros").
            addToAccount(row.account_id, -amount);
            if (row.type === "expense" && inMonth) {
              addTo(monthlyExpense, row.currency, amount);
            }
            break;
          case "refund":
            addToAccount(row.account_id, amount);
            if (inMonth) addTo(monthlyExpense, row.currency, -amount);
            break;
          case "adjustment":
            addToAccount(row.account_id, amount);
            break;
          case "transfer":
          case "card_payment":
            addToAccount(row.account_id, -amount);
            if (row.to_account_id) addToAccount(row.to_account_id, amount);
            break;
        }
      }

      const liquidBalance: CurrencyTotals = {};
      const cardDebt: CurrencyTotals = {};
      for (const account of accounts) {
        const balance = accountBalance.get(account.id) ?? 0;
        if (account.type === "credit_card") {
          if (balance < 0) addTo(cardDebt, account.currency, -balance);
        } else {
          addTo(liquidBalance, account.currency, balance);
        }
      }

      const committedThisMonth: CurrencyTotals = {};
      for (const c of commitmentsRes.data) {
        if (c.status !== "active" || !c.next_payment_date) continue;
        if (c.next_payment_date >= monthStart && c.next_payment_date <= monthEnd) {
          addTo(committedThisMonth, c.currency, Number(c.amount));
        }
      }

      const expectedIncomeThisMonth: CurrencyTotals = {};
      for (const inc of incomeRes.data) {
        if (inc.expected_date >= monthStart && inc.expected_date <= monthEnd) {
          addTo(expectedIncomeThisMonth, inc.currency, Number(inc.amount));
        }
      }

      // Cuentas de una tarjeta, para poder atribuirle una moneda a su pago —
      // ver comentario en el tipo DashboardSummary sobre el caso dual-moneda.
      const accountsByCard = new Map<string, string[]>();
      for (const a of accounts) {
        if (!a.card_id) continue;
        accountsByCard.set(a.card_id, [...(accountsByCard.get(a.card_id) ?? []), a.id]);
      }

      const cardPaymentsDueThisMonth: CurrencyTotals = {};
      for (const card of cardsRes.data) {
        const amountDue = card.full_payment_amount ?? card.minimum_payment;
        if (!amountDue || !card.payment_due_day) continue;
        const dueDate = nextOccurrenceOfDay(card.payment_due_day);
        if (dueDate < today || dueDate > monthEnd) continue;
        const linkedAccountIds = accountsByCard.get(card.id) ?? [];
        const currency =
          linkedAccountIds.length === 1
            ? (accountById.get(linkedAccountIds[0])?.currency ?? primaryCurrency)
            : primaryCurrency;
        addTo(cardPaymentsDueThisMonth, currency, Number(amountDue));
      }

      const projectedBalance: CurrencyTotals = {};
      const currencies = new Set([
        ...Object.keys(liquidBalance),
        ...Object.keys(expectedIncomeThisMonth),
        ...Object.keys(committedThisMonth),
        ...Object.keys(cardPaymentsDueThisMonth),
      ]);
      for (const currency of currencies) {
        projectedBalance[currency] =
          (liquidBalance[currency] ?? 0) +
          (expectedIncomeThisMonth[currency] ?? 0) -
          (committedThisMonth[currency] ?? 0) -
          (cardPaymentsDueThisMonth[currency] ?? 0);
      }

      return {
        monthlyIncome,
        monthlyExpense,
        liquidBalance,
        cardDebt,
        committedThisMonth,
        expectedIncomeThisMonth,
        cardPaymentsDueThisMonth,
        projectedBalance,
      };
    },
  });
}
