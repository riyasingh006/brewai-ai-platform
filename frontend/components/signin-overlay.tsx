"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { AlertCircle, Coffee, HeartHandshake, ShieldCheck, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/dev-auth";
import { Spinner } from "./ui";
import { BrewLogoMark, PasswordField, TextField } from "./auth-ui";
import authImg from "../../pictures/brewai-hero-coffee.png";

export type AuthContext = { title: string; subtitle: string };

export function SignInOverlay({
  onClose,
  onSuccess,
  context,
}: {
  onClose?: () => void;
  onSuccess?: () => void;
  context?: AuthContext;
}) {
  const { signIn, error } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setFieldErrors({});
    setPassword("");
    setConfirmPassword("");
  };

  const validEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!validEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const ok = await signIn(email);
      if (ok) onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!validEmail(email)) errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Confirm your password.";
    else if (confirmPassword !== password) errs.confirmPassword = "Passwords do not match.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const ok = await signIn(email, fullName);
      if (ok) onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  const heading = context ? context.title : mode === "signin" ? "Welcome back" : "Create your BrewAI account";
  const subheading = context
    ? context.subtitle
    : mode === "signin"
      ? "Sign in to continue your coffee journey."
      : "Start your personalized coffee experience.";

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#090807] text-[#F5F5F5]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-[-18%] size-[560px] rounded-full bg-[#c98642]/[0.07] blur-[140px]" />
        <div className="absolute bottom-[-22%] right-[-8%] size-[620px] rounded-full bg-[#8a4f1f]/[0.09] blur-[160px]" />
        <div
          className="absolute left-1/2 top-0 h-[420px] w-[70%] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(201,134,66,0.08), transparent 65%)",
          }}
        />
      </div>

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-[#2E2118]/70 bg-[#12110D]/80 text-[#A7A3A0] transition-colors hover:border-[#E79A3E]/40 hover:text-[#F5F5F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
        >
          <X className="size-[18px]" />
        </button>
      )}

      <div className="relative flex min-h-full lg:h-full">
        <div className="relative w-full lg:h-full lg:grid lg:grid-cols-[48fr_52fr]">
          {/* ------------------------- LEFT BRAND PANEL ------------------------- */}
          <aside className="relative hidden flex-col px-8 py-8 lg:flex xl:px-12 xl:py-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-center gap-3.5"
            >
              <BrewLogoMark boxClass="size-12" iconClass="size-6" />
              <div>
                <p className="text-[30px] font-bold leading-none tracking-tight">
                  Brew<span className="text-[#e8a05a]">AI</span>
                </p>
                <p className="mt-1.5 text-[13px] text-[#A7A3A0]">AI Coffee Shop Assistant</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
              className="flex flex-1 flex-col justify-center py-2 lg:py-4"
            >
              <h2 className="max-w-[420px] text-[32px] font-bold leading-[1.1] tracking-tight xl:text-[40px]">
                Your perfect coffee,{" "}
                <span className="bg-gradient-to-r from-[#F0A34A] to-[#C97B24] bg-clip-text text-transparent">
                  powered by intelligence.
                </span>
              </h2>
              <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-[#A7A3A0] xl:text-[15px]">
                Discover cafés, personalize every order, and let BrewAI make every coffee moment
                feel made for you.
              </p>
              <div className="mt-4 flex w-full max-w-[420px] justify-center lg:mt-5">
                <Image
                  src={authImg}
                  alt="A premium cup of coffee crafted by BrewAI"
                  width={1383}
                  height={1137}
                  sizes="(max-width: 1536px) 40vw, 500px"
                  className="h-auto max-h-[38vh] w-full object-contain mix-blend-screen [-webkit-mask-image:radial-gradient(115%_115%_at_50%_50%,#000_50%,transparent_86%)] [mask-image:radial-gradient(115%_115%_at_50%_50%,#000_50%,transparent_86%)]"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex items-center gap-7 border-t border-[#2E2118]/60 pt-5"
            >
              <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#A7A3A0]">
                <Sparkles className="size-[18px] text-[#E79A3E]/80" />
                AI-Powered
              </div>
              <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#A7A3A0]">
                <HeartHandshake className="size-[18px] text-[#E79A3E]/80" />
                Personalized
              </div>
              <div className="flex items-center gap-2.5 text-[13px] font-medium text-[#A7A3A0]">
                <ShieldCheck className="size-[18px] text-[#E79A3E]/80" />
                Secure
              </div>
            </motion.div>
          </aside>

          {/* -------------------------- RIGHT AUTH PANEL ------------------------- */}
          <main className="relative flex flex-col items-center justify-center px-5 pb-12 pt-20 sm:px-8 lg:py-8 xl:py-12">
            <div className="w-full max-w-[440px]">
              <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
                <BrewLogoMark boxClass="size-11" iconClass="size-5" />
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  Brew<span className="text-[#e8a05a]">AI</span>
                </p>
                <p className="text-[13px] text-[#A7A3A0]">AI Coffee Shop Assistant</p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative rounded-[24px] border border-[#2E2118]/70 bg-[#12110D]/95 p-6 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)] sm:p-8 short:p-5"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#E79A3E]/50 to-transparent"
                />

                <div className="mb-5 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-md shadow-[#c98642]/30">
                  <Coffee className="size-5 text-white" />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="mb-5 short:mb-4"
                  >
                    <h2 className="text-[24px] font-bold tracking-tight sm:text-[26px]">
                      {heading}
                    </h2>
                    <p className="mt-2 text-[14px] text-[#A7A3A0]">{subheading}</p>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <motion.form
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-4 short:gap-3"
                    onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
                    noValidate
                  >
                    {mode === "signup" && (
                      <TextField
                        id="auth-fullname"
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
                      id="auth-email"
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
                      id="auth-password"
                      label="Password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                      value={password}
                      onChange={setPassword}
                      error={fieldErrors.password}
                    />
                    {mode === "signup" && (
                      <PasswordField
                        id="auth-confirm"
                        label="Confirm Password"
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        error={fieldErrors.confirmPassword}
                      />
                    )}
                    {mode === "signup" && (
                      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-[#A7A3A0]">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(e) => setAccepted(e.target.checked)}
                          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-[#E79A3E]"
                        />
                        <span>
                          I agree to the <span className="font-medium text-[#F0A34A]">Terms</span>{" "}
                          &amp;{" "}
                          <span className="font-medium text-[#F0A34A]">Privacy Policy</span>
                        </span>
                      </label>
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
                      className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[15px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#c98642]/35 hover:brightness-110 active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E] disabled:pointer-events-none disabled:opacity-70 short:h-12"
                    >
                      {submitting && <Spinner className="size-4" />}
                      {mode === "signin" ? "Sign In" : "Create Account"}
                    </button>
                  </motion.form>
                </AnimatePresence>

                <p className="mt-5 text-center text-sm text-[#A7A3A0] short:mt-4">
                  {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                    className="font-semibold text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
                  >
                    {mode === "signin" ? "Create one" : "Sign in"}
                  </button>
                </p>
              </motion.div>
            </div>
          </main>
        </div>
      </div>
    </motion.div>
  );
}
