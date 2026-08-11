"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Coffee,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DevAuthProvider, useAuth } from "@/lib/dev-auth";
import { api, setAuthToken } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { AuthCard, AuthShell, PasswordField, TextField } from "@/components/auth-ui";

type Role = "customer" | "admin";

const validEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function roleHome(role: string): string {
  return role === "admin" ? "/admin/dashboard" : "/dashboard";
}

export default function AuthGatewayPage() {
  return (
    <DevAuthProvider>
      <Suspense fallback={null}>
        <Gateway />
      </Suspense>
    </DevAuthProvider>
  );
}

function Gateway() {
  const { loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(next ?? roleHome(user.role));
  }, [loading, user, next, router]);

  if (loading) {
    return (
      <AuthShell>
        <div className="grid min-h-[40vh] place-items-center text-[#A7A3A0]">
          <Spinner className="size-6" />
        </div>
      </AuthShell>
    );
  }

  if (user) return null;

  return (
    <AuthShell contentWidth={role ? "sm" : "lg"}>
      <AnimatePresence mode="wait">
        {role === null ? (
          <motion.div
            key="roles"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <RoleSelect onSelect={setRole} />
          </motion.div>
        ) : role === "customer" ? (
          <motion.div
            key="customer"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <AuthCard>
              <CustomerForm next={next} onBack={() => setRole(null)} />
            </AuthCard>
          </motion.div>
        ) : (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <AuthCard>
              <AdminForm next={next} onBack={() => setRole(null)} />
            </AuthCard>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}

function RoleSelect({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <div>
      <div className="mb-6 text-center sm:mb-8">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#E79A3E]/30 bg-[#E79A3E]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#F0A34A]">
          <Sparkles className="size-3.5" />
          BrewAI Members &amp; Staff
        </p>
        <h2 className="text-[26px] font-bold tracking-tight sm:text-[32px]">
          How would you like to continue?
        </h2>
        <p className="mx-auto mt-2 max-w-[480px] text-[14px] leading-relaxed text-[#A7A3A0]">
          Choose your path — order coffee as a customer, or manage your BrewAI
          business as an administrator.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <RoleCard
          icon={Coffee}
          title="Customer"
          description="Order coffee, discover cafés & earn rewards."
          features={["Order & track coffee", "Discover nearby cafés", "Earn loyalty rewards"]}
          cta="Continue as Customer"
          onSelect={() => onSelect("customer")}
        />
        <RoleCard
          icon={ShieldCheck}
          title="Admin"
          description="Manage your BrewAI business & analytics."
          features={["Shop analytics & revenue", "Manage menu & orders", "Customer overview"]}
          cta="Continue as Admin"
          onSelect={() => onSelect("admin")}
        />
      </div>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  title,
  description,
  features,
  cta,
  onSelect,
}: {
  icon: typeof Coffee;
  title: string;
  description: string;
  features: string[];
  cta: string;
  onSelect: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex flex-col rounded-[24px] border border-[#2E2118]/70 bg-[#12110D]/95 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] transition-colors hover:border-[#E79A3E]/40 sm:p-7"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#E79A3E]/40 to-transparent"
      />
      <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
        <Icon className="size-6 text-white" />
      </span>
      <h3 className="mt-4 text-[20px] font-bold tracking-tight text-[#F5F5F5]">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#A7A3A0]">{description}</p>
      <ul className="mt-4 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-[13px] text-[#C9C5C2]">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#E79A3E]/15 text-[#F0A34A]">
              <Check className="size-3" />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        className="mt-6 inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[14px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
      >
        {cta}
        <ChevronRight className="size-4" />
      </button>
    </motion.div>
  );
}

function BackToRoles({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#A7A3A0] transition-colors hover:text-[#F0A34A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
    >
      <ArrowLeft className="size-4" />
      Change role
    </button>
  );
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[15px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#c98642]/35 hover:brightness-110 active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E] disabled:pointer-events-none disabled:opacity-70"
    >
      {submitting && <Spinner className="size-4" />}
      {label}
    </button>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] leading-snug text-red-300"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ModeToggle({
  mode,
  onSwitch,
  signInLabel,
  signUpLabel,
}: {
  mode: "signin" | "signup";
  onSwitch: () => void;
  signInLabel: string;
  signUpLabel: string;
}) {
  return (
    <p className="mt-5 text-center text-sm text-[#A7A3A0]">
      {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
      <button
        type="button"
        onClick={onSwitch}
        className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
      >
        {mode === "signin" ? signUpLabel : signInLabel}
      </button>
    </p>
  );
}

function CustomerForm({ next, onBack }: { next: string | null; onBack: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
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
      router.replace(next ?? roleHome(result.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <BackToRoles onClick={onBack} />
      <div className="mb-6 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
        <Coffee className="size-5 text-white" />
      </div>
      <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#E79A3E]/30 bg-[#E79A3E]/10 px-3 py-1 text-xs font-semibold text-[#F0A34A]">
        Customer access
      </p>
      <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
        {mode === "signin" ? "Welcome back" : "Create your BrewAI account"}
      </h2>
      <p className="mt-2 text-[14px] text-[#A7A3A0]">
        {mode === "signin"
          ? "Sign in to continue your coffee journey."
          : "Start your personalized coffee experience."}
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {mode === "signup" && (
          <TextField
            id="gateway-customer-fullname"
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
          id="gateway-customer-email"
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
          id="gateway-customer-password"
          label="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        {mode === "signup" && (
          <PasswordField
            id="gateway-customer-confirm"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
          />
        )}
        {error && <FormError message={error} />}
        <SubmitButton submitting={submitting} label={mode === "signin" ? "Sign In" : "Create Account"} />
      </form>

      <ModeToggle
        mode={mode}
        onSwitch={() => switchMode(mode === "signin" ? "signup" : "signin")}
        signInLabel="Sign in"
        signUpLabel="Create one"
      />
    </div>
  );
}

function AdminForm({ next, onBack }: { next: string | null; onBack: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
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
    if (!adminKey.trim()) errs.adminKey = "The admin key is required.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const key = adminKey.trim();
      const result =
        mode === "signin"
          ? await api.adminLogin(email, password, key)
          : await api.adminRegister(email, password, key, fullName.trim() || undefined);
      setAuthToken(result.token);
      router.replace(next ?? "/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <BackToRoles onClick={onBack} />
      <div className="mb-6 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
        <ShieldCheck className="size-5 text-white" />
      </div>
      <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#E79A3E]/30 bg-[#E79A3E]/10 px-3 py-1 text-xs font-semibold text-[#F0A34A]">
        Staff access
      </p>
      <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
        {mode === "signin" ? "Admin sign in" : "Create an admin account"}
      </h2>
      <p className="mt-2 text-[14px] text-[#A7A3A0]">
        {mode === "signin"
          ? "Sign in with your administrator credentials and shop owner key."
          : "Admin accounts are created with a secret key held by the shop owner."}
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {mode === "signup" && (
          <TextField
            id="gateway-admin-fullname"
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
          id="gateway-admin-email"
          label="Admin Email"
          type="email"
          autoComplete="email"
          autoFocus={mode === "signin"}
          placeholder="admin@coffeeshop.local"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <PasswordField
          id="gateway-admin-password"
          label="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        {mode === "signup" && (
          <PasswordField
            id="gateway-admin-confirm"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={fieldErrors.confirmPassword}
          />
        )}
        <TextField
          id="gateway-admin-key"
          label="Admin Key"
          type="password"
          autoComplete="off"
          placeholder="Secret key issued by the shop owner"
          value={adminKey}
          onChange={setAdminKey}
          error={fieldErrors.adminKey}
        />
        {error && <FormError message={error} />}
        <SubmitButton
          submitting={submitting}
          label={mode === "signin" ? "Sign In" : "Create Admin Account"}
        />
      </form>

      <ModeToggle
        mode={mode}
        onSwitch={() => switchMode(mode === "signin" ? "signup" : "signin")}
        signInLabel="Sign in"
        signUpLabel="Create an admin account"
      />
    </div>
  );
}
