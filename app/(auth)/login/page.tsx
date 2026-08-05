"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setGoogleLoading(false);
      setError(error.message);
    }
    // Si no hay error, el navegador redirige a Google — no hace falta más.
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm glass-panel rounded-lg p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center glow-active flex-shrink-0">
            <Icon name="dataset" className="text-on-primary-container" filled />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary tracking-tight leading-tight">
              Borb Financial OS
            </h1>
            <p className="text-xs text-on-surface-variant">
              Ingresá con tu cuenta del hogar
            </p>
          </div>
        </div>

        <Label>Email</Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4"
        />

        <Label>Contraseña</Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4"
        />

        {error && (
          <p className="text-sm text-error mb-4" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-outline-variant/20" />
          <span className="text-xs text-on-surface-variant">o</span>
          <div className="h-px flex-1 bg-outline-variant/20" />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full"
        >
          {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
        </Button>
      </form>
    </main>
  );
}
