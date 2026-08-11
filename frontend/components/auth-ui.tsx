"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Coffee,
  Eye,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "./ui";
import authImg from "../../pictures/brewai-hero-coffee.png";

export function BrewLogoMark({
  boxClass = "size-11",
  iconClass = "size-5",
}: {
  boxClass?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-2xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-lg shadow-[#c98642]/30",
        boxClass,
      )}
    >
      <Coffee className={cn("text-white", iconClass)} />
      <span className="absolute -top-1 left-1/2 flex -translate-x-1/2 gap-0.5">
        <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "0s" }} />
        <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "0.5s" }} />
        <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "1s" }} />
      </span>
    </div>
  );
}

export const AUTH_INPUT =
  "h-[52px] w-full rounded-xl border border-[#2E2118]/70 bg-[#0D0C0A] px-4 text-[15px] text-[#F5F5F5] placeholder:text-[#6B6662] transition-all duration-200 focus:border-[#E79A3E]/60 focus:outline-none focus:ring-4 focus:ring-[#E79A3E]/15 short:h-12";

export function AuthFieldError({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
      <AlertCircle className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  autoFocus,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-[#B9B9C1]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        className={cn(
          AUTH_INPUT,
          error && "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20",
        )}
      />
      {error && <AuthFieldError>{error}</AuthFieldError>}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-[#B9B9C1]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          className={cn(
            AUTH_INPUT,
            "pr-12",
            error && "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#6B6662] transition-colors hover:bg-white/5 hover:text-[#F0A34A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E79A3E]"
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {error && <AuthFieldError>{error}</AuthFieldError>}
    </div>
  );
}

const TRUST_POINTS = [
  { icon: Sparkles, label: "AI-Powered" },
  { icon: HeartHandshake, label: "Personalized" },
  { icon: ShieldCheck, label: "Secure" },
];

/** Full-screen premium auth page shell (BrewAI dark coffee theme). */
export function AuthShell({
  children,
  contentWidth = "sm",
}: {
  children: ReactNode;
  contentWidth?: "sm" | "lg";
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090807] text-[#F5F5F5]">
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

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center gap-3 px-6 py-6 sm:px-8">
          <BrewLogoMark boxClass="size-11" iconClass="size-5" />
          <div>
            <p className="text-[22px] font-bold leading-none tracking-tight">
              Brew<span className="text-[#e8a05a]">AI</span>
            </p>
            <p className="mt-1 text-[12px] text-[#A7A3A0]">AI Coffee Shop Assistant</p>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-12">
          <div
            className={cn(
              "w-full",
              contentWidth === "lg" ? "max-w-[760px]" : "max-w-[440px]",
            )}
          >
            {children}
          </div>
        </main>

        <footer className="flex items-center justify-center gap-7 pb-7">
          {TRUST_POINTS.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2.5 text-[13px] font-medium text-[#A7A3A0]"
            >
              <t.icon className="size-[18px] text-[#E79A3E]/80" />
              {t.label}
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}

/** Branded card that holds an auth form, with an optional brand image. */
export function AuthCard({
  children,
  showImage = false,
}: {
  children: ReactNode;
  showImage?: boolean;
}) {
  return (
    <div className="relative rounded-[24px] border border-[#2E2118]/70 bg-[#12110D]/95 p-6 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)] sm:p-8">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#E79A3E]/50 to-transparent"
      />
      {showImage && (
        <Image
          src={authImg}
          alt="A premium cup of coffee crafted by BrewAI"
          width={1383}
          height={1137}
          sizes="(max-width: 640px) 80vw, 380px"
          className="mb-4 h-auto max-h-[22vh] w-full object-contain mix-blend-screen [-webkit-mask-image:radial-gradient(115%_115%_at_50%_50%,#000_50%,transparent_86%)] [mask-image:radial-gradient(115%_115%_at_50%_50%,#000_50%,transparent_86%)]"
        />
      )}
      {children}
    </div>
  );
}
