"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SignOutButton } from "@/components/sign-out-button";
import { useAuthProvider } from "@/lib/hooks/use-profile";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { exportTransactionsToCsv } from "@/lib/csv-export";
import { NotificationToggles } from "@/components/settings/notification-toggles";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-1">
        {title}
      </p>
      {description && (
        <p className="text-on-surface-variant text-sm mb-4">{description}</p>
      )}
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const { data: provider } = useAuthProvider();
  const { data: transactions } = useTransactions();

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
        <Icon name="settings" className="text-primary" filled />
        Configuración
      </h1>

      <SettingsSection
        title="Perfil"
        description="Nombre, avatar, idioma, zona horaria, formatos, email."
      >
        <Link href="/profile">
          <Button variant="secondary">Ir a tu perfil</Button>
        </Link>
      </SettingsSection>

      <SettingsSection
        title="Hogar"
        description="Miembros, invitaciones, roles, monedas, propiedad."
      >
        <Link href="/household">
          <Button variant="secondary">Ir a Hogar</Button>
        </Link>
      </SettingsSection>

      <SettingsSection
        title="Preferencias financieras"
        description="Monedas y ciclo del mes financiero se configuran en Hogar (son compartidas); formatos de fecha/número se configuran en tu Perfil (son personales)."
      >
        <div className="flex gap-3">
          <Link href="/household">
            <Button variant="secondary">Monedas y ciclo (Hogar)</Button>
          </Link>
          <Link href="/profile">
            <Button variant="secondary">Formatos (Perfil)</Button>
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Categorías"
        description="Crear, editar y organizar las categorías del presupuesto."
      >
        <Link href="/categories">
          <Button variant="secondary">Ir a Categorías</Button>
        </Link>
      </SettingsSection>

      <SettingsSection
        title="Cuentas y tarjetas"
        description="Cuentas bancarias y tarjetas de crédito (saldo, tipo, institución). La gestión de límites/fechas de corte de tarjetas llega con Fase 2."
      >
        <Link href="/accounts">
          <Button variant="secondary">Ir a Cuentas</Button>
        </Link>
      </SettingsSection>

      <SettingsSection title="Notificaciones">
        <NotificationToggles />
      </SettingsSection>

      <SettingsSection title="Datos e importación">
        <div className="flex flex-col gap-3">
          <Link href="/transactions/import">
            <Button variant="secondary">Importar CSV</Button>
          </Link>
          <Button
            variant="secondary"
            disabled={!transactions || transactions.length === 0}
            onClick={() => transactions && exportTransactionsToCsv(transactions)}
          >
            Exportar transacciones a CSV
          </Button>
          <p className="text-xs text-on-surface-variant">
            Historial de importaciones y reglas de duplicados configurables
            quedan para una fase posterior.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="Seguridad">
        <p className="text-on-surface-variant text-sm mb-3">
          Conectado con:{" "}
          <span className="text-on-surface">
            {provider === "google" ? "Google" : "Email y contraseña"}
          </span>
        </p>
        <p className="text-xs text-on-surface-variant mb-3">
          Ver sesiones activas y cerrar sesión en otros dispositivos todavía
          no está disponible — queda para una fase posterior.
        </p>
        <SignOutButton />
      </SettingsSection>

      <SettingsSection
        title="Apariencia"
        description="Borb usa un tema oscuro por ahora. Modo claro y densidad compacta quedan para una fase posterior."
      >
        <span className="text-sm text-on-surface-variant">Próximamente</span>
      </SettingsSection>

      <SettingsSection
        title="Integraciones"
        description="Conexión bancaria, Gmail, importación automática de estados de cuenta y permisos de automatización con IA."
      >
        <span className="text-sm text-on-surface-variant">Próximamente</span>
      </SettingsSection>
    </div>
  );
}
