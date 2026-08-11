"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { api, setAuthToken } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { AuthCard, AuthShell, PasswordField, TextField } from "@/components/auth-ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    if (!adminKey.trim()) errs.adminKey = "The admin sign-in key is required.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.adminLogin(email, password, adminKey.trim());
      setAuthToken(result.token);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/admin/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sign in.";
      setError(message);
      if (message === "You don't have administrator access.") {
        window.setTimeout(() => router.replace("/dashboard"), 1600);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
          <ShieldCheck className="size-5 text-white" />
        </div>

        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#E79A3E]/30 bg-[#E79A3E]/10 px-3 py-1 text-xs font-semibold text-[#F0A34A]">
          Staff access
        </p>
        <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
          Admin sign in
        </h2>
        <p className="mt-2 text-[14px] text-[#A7A3A0]">
          Sign in with an administrator account to manage the coffee shop.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="admin-email"
            label="Admin Email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="admin@coffeeshop.local"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
          />
          <PasswordField
            id="admin-password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          <TextField
            id="admin-key"
            label="Admin Sign-in Key"
            type="password"
            autoComplete="off"
            placeholder="Secret key issued by the shop owner"
            value={adminKey}
            onChange={setAdminKey}
            error={fieldErrors.adminKey}
          />
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] leading-snug text-red-300"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[15px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#c98642]/35 hover:brightness-110 active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E] disabled:pointer-events-none disabled:opacity-70"
          >
            {submitting && <Spinner className="size-4" />}
            Sign In
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#A7A3A0]">
          Need an admin account?{" "}
          <Link
            href="/admin/register"
            className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75"
          >
            Register as admin
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-[#6B6662]">
          Not staff?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75"
          >
            Customer sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
