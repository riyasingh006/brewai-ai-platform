"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { api, setAuthToken } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { AuthCard, AuthShell, PasswordField, TextField } from "@/components/auth-ui";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Confirm your password.";
    else if (confirmPassword !== password) errs.confirmPassword = "Passwords do not match.";
    if (!adminKey.trim()) errs.adminKey = "The admin registration key is required.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.adminRegister(
        email,
        password,
        adminKey.trim(),
        fullName.trim() || undefined,
      );
      setAuthToken(result.token);
      router.replace("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the admin account.");
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
          Admin registration
        </p>
        <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
          Create an admin account
        </h2>
        <p className="mt-2 text-[14px] text-[#A7A3A0]">
          Admin accounts are created with a secret key held by the shop owner.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextField
            id="adminreg-fullname"
            label="Full Name"
            autoComplete="name"
            autoFocus
            placeholder="Jane Doe"
            value={fullName}
            onChange={setFullName}
            error={fieldErrors.fullName}
          />
          <TextField
            id="adminreg-email"
            label="Admin Email"
            type="email"
            autoComplete="email"
            placeholder="admin@coffeeshop.local"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
          />
          <PasswordField
            id="adminreg-password"
            label="Password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          <PasswordField
            id="adminreg-confirm"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
          />
          <TextField
            id="adminreg-key"
            label="Admin Registration Key"
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
            Create Admin Account
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#A7A3A0]">
          Already registered?{" "}
          <Link
            href="/admin/login"
            className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75"
          >
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
