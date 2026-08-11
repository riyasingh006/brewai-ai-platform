"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Coffee } from "lucide-react";
import { api, setAuthToken } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { AuthCard, AuthShell, PasswordField, TextField } from "@/components/auth-ui";

const validEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

export default function CustomerLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setFieldErrors({});
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === "signup" && !fullName.trim()) errs.fullName = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!validEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (mode === "signup" && password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (mode === "signup") {
      if (!confirmPassword) errs.confirmPassword = "Confirm your password.";
      else if (confirmPassword !== password) errs.confirmPassword = "Passwords do not match.";
    }
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signin"
          ? await api.login(email, password)
          : await api.register(email, password, fullName.trim() || undefined);
      setAuthToken(result.token);
      router.replace(result.user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard showImage>
        <div className="mb-6 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
          <Coffee className="size-5 text-white" />
        </div>

        <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
          {mode === "signin" ? "Welcome back" : "Create your BrewAI account"}
        </h2>
        <p className="mt-2 text-[14px] text-[#A7A3A0]">
          {mode === "signin"
            ? "Sign in with your email and password to continue your coffee journey."
            : "Start your personalized coffee experience."}
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {mode === "signup" && (
            <TextField
              id="login-fullname"
              label="Full Name"
              autoComplete="name"
              autoFocus
              placeholder="Jane Doe"
              value={fullName}
              onChange={setFullName}
              error={fieldErrors.fullName}
            />
          )}
          <TextField
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus={mode === "signin"}
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
          />
          <PasswordField
            id="login-password"
            label="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          {mode === "signup" && (
            <PasswordField
              id="login-confirm"
              label="Confirm Password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={fieldErrors.confirmPassword}
            />
          )}
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
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#A7A3A0]">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>

        <p className="mt-3 text-center text-sm text-[#6B6662]">
          Are you staff?{" "}
          <Link
            href="/admin/login"
            className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75"
          >
            Sign in as admin
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
