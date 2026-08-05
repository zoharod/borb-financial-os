"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  useProfile,
  useUpdateProfile,
  useDeleteUserAccount,
  useCurrentUserEmail,
} from "@/lib/hooks/use-profile";
import { useCurrentHousehold } from "@/lib/hooks/use-current-household";
import {
  CURRENCIES,
  LANGUAGES,
  TIMEZONES,
  DATE_FORMATS,
  NUMBER_FORMATS,
  HOUSEHOLD_ROLES,
} from "@/lib/constants";

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const { data: household } = useCurrentHousehold();

  if (isLoading || !profile) {
    return <p className="text-on-surface-variant text-sm">Cargando...</p>;
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
        <Icon name="person" className="text-primary" filled />
        Tu perfil
      </h1>
      <ProfileForm profile={profile} />
      <EmailCard />
      <HouseholdSummaryCard household={household} />
      <DangerZone />
    </div>
  );
}

function ProfileForm({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useProfile>["data"]>;
}) {
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [language, setLanguage] = useState(profile.preferred_language);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [dateFormat, setDateFormat] = useState(profile.date_format);
  const [numberFormat, setNumberFormat] = useState(profile.number_format);
  const [preferredCurrency, setPreferredCurrency] = useState(
    profile.preferred_currency ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
        preferred_language: language,
        timezone,
        date_format: dateFormat,
        number_format: numberFormat,
        preferred_currency: preferredCurrency || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover border border-outline-variant/30"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant text-lg">
              {(fullName || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <Label>URL de foto de perfil (opcional)</Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <Label>Nombre completo</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Idioma</Label>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label>Zona horaria</Label>
            <Select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Formato de fecha</Label>
            <Select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label>Formato de número</Label>
            <Select
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value)}
            >
              {NUMBER_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Moneda preferida (para mostrar primero en el dashboard)</Label>
          <Select
            value={preferredCurrency}
            onChange={(e) => setPreferredCurrency(e.target.value)}
          >
            <option value="">Sin preferencia</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-sm text-secondary">Perfil actualizado.</p>
        )}

        <div>
          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EmailCard() {
  const { data: currentEmail } = useCurrentUserEmail();
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<
    { type: "error" | "success"; message: string } | null
  >(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setIsPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setStatus({
        type: "success",
        message:
          "Te mandamos un correo de confirmación a la dirección nueva (y un aviso a la anterior). El cambio se aplica recién cuando lo confirmés.",
      });
      setNewEmail("");
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo iniciar el cambio",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-2">
        Email
      </p>
      <p className="text-on-surface mb-4">{currentEmail ?? "..."}</p>
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1">
          <Label>Cambiar a</Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nuevo@email.com"
            required
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? "Enviando..." : "Actualizar email"}
        </Button>
      </form>
      {status && (
        <p
          className={`text-sm mt-3 ${status.type === "error" ? "text-error" : "text-secondary"}`}
          role="alert"
        >
          {status.message}
        </p>
      )}
    </Card>
  );
}

function HouseholdSummaryCard({
  household,
}: {
  household: ReturnType<typeof useCurrentHousehold>["data"];
}) {
  if (!household) return null;
  const householdRow = household.households as unknown as {
    name: string;
  } | null;
  const roleLabel =
    HOUSEHOLD_ROLES.find((r) => r.value === household.role)?.label ??
    household.role;

  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-2">
        Tu hogar
      </p>
      <p className="text-on-surface">{householdRow?.name}</p>
      <p className="text-on-surface-variant text-sm">Rol: {roleLabel}</p>
    </Card>
  );
}

function DangerZone() {
  const router = useRouter();
  const deleteUserAccount = useDeleteUserAccount();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteUserAccount.mutateAsync();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta");
    }
  }

  return (
    <Card className="border-error/40">
      <p className="font-mono text-xs uppercase tracking-wider text-error mb-2">
        Zona de riesgo
      </p>
      {!confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Eliminar mi cuenta
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-on-surface-variant">
            Esto elimina tu cuenta de forma permanente. Si sos la única
            persona del hogar, también se borran todos sus datos financieros.
            Escribí <span className="font-mono text-on-surface">ELIMINAR</span>{" "}
            para confirmar.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ELIMINAR"
          />
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== "ELIMINAR" || deleteUserAccount.isPending}
              onClick={handleDelete}
            >
              {deleteUserAccount.isPending
                ? "Eliminando..."
                : "Confirmar eliminación"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
