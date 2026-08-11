"use client";

import Image from "next/image";
import { ChevronDown, Coffee, MapPin, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import heroImg from "../../pictures/brewai-hero-coffee.png";

const FEATURES = [
  { icon: Coffee, title: "Personalized", sub: "Recommendations" },
  { icon: Zap, title: "Smart", sub: "AI Assistant" },
  { icon: MapPin, title: "Nearby", sub: "Cafés" },
];

export function LandingHero({
  onMenu,
  onNearby,
  onDiscover,
}: {
  onMenu: () => void;
  onNearby?: () => void;
  onDiscover?: () => void;
}) {
  return (
    <section className="relative flex min-h-[calc(100vh-96px)] flex-col overflow-hidden bg-[#090807]">
      {/* single continuous near-black surface with one very subtle warm glow behind the image */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute right-[2vw] top-1/2 size-[720px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(100,55,20,0.12),transparent_60%)] blur-[90px]" />
      </div>

      <div className="relative mx-auto grid w-full flex-1 grid-cols-1 items-center gap-10 px-6 py-8 sm:px-10 lg:grid-cols-2 lg:gap-x-16 lg:px-[9vw] lg:py-4">
        {/* ------------------------------ LEFT ------------------------------ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex w-full max-w-[620px] flex-col items-start"
        >
          <span className="inline-flex h-[40px] items-center gap-2 rounded-full border border-[#E99A3D]/25 bg-[#2A1B12]/60 px-5 text-[12px] font-semibold tracking-wide text-[#F0A34A] shadow-[0_0_16px_rgba(230,150,60,0.12)] backdrop-blur">
            <Sparkles className="size-3.5" />
            Powered by Gemini AI
          </span>

          <h1 className="mt-7 text-[clamp(56px,5vw,82px)] font-extrabold leading-[1.0] tracking-tight text-[#F5F5F5]">
            Brew{" "}
            <span className="bg-gradient-to-r from-[#F0A34A] to-[#D88932] bg-clip-text text-transparent">
              Smarter.
            </span>
            <br />
            Live{" "}
            <span className="bg-gradient-to-r from-[#F0A34A] to-[#D88932] bg-clip-text text-transparent">
              Better.
            </span>
          </h1>

          <p className="mt-5 max-w-[620px] text-[clamp(17px,1.15vw,20px)] leading-[1.6] text-[#A7A7AD]">
            Your AI coffee companion that understands your cravings, recommends
            your perfect brew, and brings your café experience to life.
          </p>

          <div
            aria-hidden
            className="mt-7 flex w-full max-w-[620px] items-center gap-4"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#3E2B1A]/60" />
            <span className="size-1 rotate-45 border border-[#F0A34A]/40 bg-[#F0A34A]/20" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#3E2B1A]/60" />
          </div>

          <div className="mt-7 grid w-full max-w-[620px] grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#E99A3D]/20 bg-[#2A1B12]/60 text-[#F0A34A]">
                  <f.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug text-[#F5F5F5]">
                    {f.title}
                  </span>
                  <span className="block text-[12px] font-medium leading-snug text-[#A7A7AD]">
                    {f.sub}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex w-full max-w-[620px] flex-col gap-4 sm:flex-row">
            <button
              onClick={onMenu}
              className="inline-flex h-[58px] w-[240px] max-w-full items-center justify-center gap-2.5 rounded-[14px] bg-gradient-to-br from-[#F0A34A] to-[#C97B24] text-[15px] font-semibold text-white shadow-[0_14px_36px_-12px_rgba(216,137,50,0.5)] transition-all hover:shadow-[0_16px_44px_-10px_rgba(216,137,50,0.7)] hover:brightness-110 active:scale-[0.98]"
            >
              <Coffee className="size-5" />
              Explore Menu
            </button>
            <button
              onClick={onNearby}
              className="inline-flex h-[58px] w-[260px] max-w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#E99A3D]/35 bg-[#12110D]/60 text-[15px] font-semibold text-[#F5F5F5] transition-all hover:border-[#F0A34A]/70 hover:text-[#F0A34A]"
            >
              <MapPin className="size-[18px] text-[#F0A34A]" />
              Find Nearby Cafés
            </button>
          </div>
        </motion.div>

        {/* ------------------------------ RIGHT ----------------------------- */}
        {/* NOTE: no transform/opacity ancestors here, so mix-blend-screen always
            blends the PNG's black background into the page instead of boxing it */}
        <div className="relative flex items-center justify-center lg:-mr-4 lg:justify-end">
          <div className="relative flex w-full max-w-[650px] items-center justify-center">
            <div className="relative w-full max-w-[650px]">
              <Image
                src={heroImg}
                alt="A premium cup of coffee from BrewAI"
                width={1383}
                height={1137}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 650px"
                priority
                className="relative z-10 h-auto w-full max-w-[650px] object-contain mix-blend-screen [-webkit-mask-image:radial-gradient(120%_120%_at_50%_50%,#000_52%,transparent_84%)] [mask-image:radial-gradient(120%_120%_at_50%_50%,#000_52%,transparent_84%)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------- QUOTE -------------------------------- */}
      <div className="relative w-full px-6 pb-6 sm:px-10 lg:px-[9vw] lg:pb-7">
        <div className="mx-auto w-full max-w-[680px] text-center">
          <p className="text-[15px] font-medium leading-relaxed text-[#A7A7AD] lg:text-[16px]">
            <span className="text-[20px] font-bold leading-none text-[#F0A34A]">
              “
            </span>
            Coffee is not just a drink, it&apos;s a moment of clarity in a busy
            life.
            <span className="text-[20px] font-bold leading-none text-[#F0A34A]">
              ”
            </span>
          </p>
          <p className="mt-2.5 text-[13px] font-semibold tracking-wide text-[#F0A34A]">
            — BrewAI
          </p>
        </div>
      </div>

      {/* -------------------------- DISCOVER CUE ---------------------------- */}
      <div className="relative w-full px-6 pb-8 sm:px-10 lg:px-[9vw]">
        <button
          onClick={() => onDiscover?.()}
          className="group mx-auto flex flex-col items-center gap-1.5"
          aria-label="Discover our story"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#A7A7AD] transition-colors duration-200 group-hover:text-[#F0A34A]">
            Discover Our Story
          </span>
          <ChevronDown className="size-4 animate-bounce text-[#A7A7AD] transition-colors duration-200 group-hover:text-[#F0A34A]" />
        </button>
      </div>
    </section>
  );
}
