"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-surface-container p-8 border border-outline-variant/20"
      >
        <h1 className="text-2xl font-semibold text-on-surface mb-1">
          Borb Financial OS
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Ingresá con tu cuenta del hogar.
        </p>

        <label className="block text-sm text-on-surface-variant mb-1">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-sm bg-surface-container-lowest px-3 py-2 text-on-surface shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none focus:ring-2 focus:ring-secondary/30"
        />

        <label className="block text-sm text-on-surface-variant mb-1">
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-sm bg-surface-container-lowest px-3 py-2 text-on-surface shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] outline-none focus:ring-2 focus:ring-secondary/30"
        />

        {error && (
          <p className="text-sm text-error mb-4" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-secondary text-on-secondary-container font-medium py-2 disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
