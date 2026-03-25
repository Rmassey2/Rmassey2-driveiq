"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1628]">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-[#111d33] p-10 shadow-2xl">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#c8a951]">Maco Transport</h1>
          <p className="mt-2 text-sm text-gray-400">
            DriveIQ — Driver Intelligence Platform
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-900/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-4 py-3 text-white placeholder-gray-500 focus:border-[#c8a951] focus:outline-none focus:ring-1 focus:ring-[#c8a951]"
                placeholder="you@macotr.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-600 bg-[#0a1628] px-4 py-3 text-white placeholder-gray-500 focus:border-[#c8a951] focus:outline-none focus:ring-1 focus:ring-[#c8a951]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#c8a951] px-4 py-3 font-semibold text-[#0a1628] transition hover:bg-[#b8993e] disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
