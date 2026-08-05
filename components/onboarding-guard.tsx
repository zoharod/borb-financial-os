"use client";

import { useState } from "react";
import {
  useCurrentHousehold,
  useUpdateOnboardingStep,
  type OnboardingStep,
} from "@/lib/hooks/use-current-household";
import { HouseholdStep } from "@/components/onboarding/household-step";
import { AccountsStep } from "@/components/onboarding/accounts-step";
import { CardsStep } from "@/components/onboarding/cards-step";
import { BudgetStep } from "@/components/onboarding/budget-step";
import { CommitmentsStep } from "@/components/onboarding/commitments-step";
import { IncomeStep } from "@/components/onboarding/income-step";
import { ReviewStep } from "@/components/onboarding/review-step";

const STEP_ORDER: OnboardingStep[] = [
  "household",
  "accounts",
  "cards",
  "budget",
  "commitments",
  "income",
  "review",
  "done",
];

type HouseholdData = NonNullable<ReturnType<typeof useCurrentHousehold>["data"]>;

function getPersistedStep(household: HouseholdData): OnboardingStep {
  const step = (household.households as unknown as { onboarding_step?: string } | null)
    ?.onboarding_step;
  return (STEP_ORDER as string[]).includes(step ?? "")
    ? (step as OnboardingStep)
    : "household";
}

// Onboarding guiado de 7 pasos: household → cuentas → tarjetas → presupuesto
// → compromisos → ingreso esperado → revisión. Cuentas/tarjetas son
// repetibles ("agregar otra") y tarjetas/presupuesto/compromisos/ingreso son
// opcionales (0 está permitido), así que no alcanza con inferir el paso
// actual solo mirando si hay datos — se persiste en households.onboarding_step.
// Ver architecture.md "Onboarding refinado".
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: household, isLoading } = useCurrentHousehold();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-on-surface-variant text-sm">Cargando...</p>
      </div>
    );
  }

  if (!household) {
    return <HouseholdStep onCreated={() => {}} />;
  }

  // key=household_id: si cambia el usuario/household en el mismo navegador
  // (ver bug de cache cruzada en Fase 1), esto fuerza un remount limpio del
  // wizard en vez de arrastrar el estado del household anterior.
  return (
    <OnboardingWizard key={household.household_id} household={household}>
      {children}
    </OnboardingWizard>
  );
}

function OnboardingWizard({
  household,
  children,
}: {
  household: HouseholdData;
  children: React.ReactNode;
}) {
  const updateStep = useUpdateOnboardingStep();
  const householdId = household.household_id;
  const persistedStep = getPersistedStep(household);

  // Lazy initializer: corre una sola vez, con household ya garantizado (no
  // puede ser null acá). Households con onboarding_step="household" pero
  // que ya existen de verdad (creados antes de este cambio, o con el valor
  // por defecto de la columna) arrancan directo en "accounts", no vuelven a
  // ver el formulario de "nombrá tu hogar".
  const [localStep, setLocalStep] = useState<OnboardingStep>(() =>
    persistedStep === "household" ? "accounts" : persistedStep,
  );
  // true cuando se entró a un paso desde "Editar" en la Revisión — el botón
  // Continuar de ese paso debe volver a Revisión, no seguir la secuencia.
  const [editMode, setEditMode] = useState(false);

  function advanceTo(step: OnboardingStep) {
    if (editMode) {
      setEditMode(false);
      setLocalStep("review");
      return;
    }
    setLocalStep(step);
    // Solo persiste avances (nunca retrocesos) — "Atrás" y "Editar" son
    // navegación local nomás, para no perder el progreso ya guardado.
    if (STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(persistedStep)) {
      updateStep.mutate({ householdId, step });
    }
  }

  function editFromReview(step: OnboardingStep) {
    setEditMode(true);
    setLocalStep(step);
  }

  // Ir "Atrás" nunca borra nada: cuentas/tarjetas/presupuesto/compromisos/
  // ingreso ya están guardados en la base apenas se crean (no en estado local
  // del componente), así que cambiar de paso solo cambia qué formulario se
  // ve — los datos ya cargados siguen ahí al volver.
  function goBackFrom(step: OnboardingStep) {
    if (editMode) {
      setLocalStep("review");
      return;
    }
    const prevStep = STEP_ORDER[STEP_ORDER.indexOf(step) - 1];
    setLocalStep(prevStep);
  }

  const householdRow = household.households as unknown as {
    name: string;
    base_currency_default: "HNL" | "USD";
    secondary_currency: "HNL" | "USD" | null;
  } | null;

  switch (localStep) {
    case "household":
      return (
        <HouseholdStep
          onCreated={() => {}}
          existing={{
            householdId,
            name: householdRow?.name ?? "",
            primaryCurrency: householdRow?.base_currency_default ?? "HNL",
            secondaryCurrency: householdRow?.secondary_currency ?? null,
          }}
          onContinue={() => advanceTo("accounts")}
        />
      );
    case "accounts":
      return (
        <AccountsStep
          householdId={householdId}
          onBack={() => goBackFrom("accounts")}
          onContinue={() => advanceTo("cards")}
        />
      );
    case "cards":
      return (
        <CardsStep
          householdId={householdId}
          onBack={() => goBackFrom("cards")}
          onContinue={() => advanceTo("budget")}
        />
      );
    case "budget":
      return (
        <BudgetStep
          householdId={householdId}
          onBack={() => goBackFrom("budget")}
          onContinue={() => advanceTo("commitments")}
        />
      );
    case "commitments":
      return (
        <CommitmentsStep
          householdId={householdId}
          onBack={() => goBackFrom("commitments")}
          onContinue={() => advanceTo("income")}
        />
      );
    case "income":
      return (
        <IncomeStep
          householdId={householdId}
          onBack={() => goBackFrom("income")}
          onContinue={() => advanceTo("review")}
        />
      );
    case "review":
      return (
        <ReviewStep
          onEditStep={editFromReview}
          onBack={() => goBackFrom("review")}
          onFinish={() => advanceTo("done")}
          isFinishing={updateStep.isPending}
        />
      );
    case "done":
    default:
      return <>{children}</>;
  }
}
