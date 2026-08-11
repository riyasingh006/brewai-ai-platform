"use client";

import { Coffee, Quote, Star } from "lucide-react";
import { motion } from "framer-motion";

const TESTIMONIALS = [
  {
    name: "Ananya Sharma",
    role: "Coffee Enthusiast",
    rating: 5,
    text: "BrewAI completely changed how I discover coffee. The recommendations actually feel personal, and I've found some amazing cafés that I would never have discovered on my own.",
    avatar: "AS",
  },
  {
    name: "Arjun Mehta",
    role: "Regular Customer",
    rating: 5,
    text: "I love how simple the whole experience is. I can describe what I'm craving and BrewAI gives me recommendations that genuinely match my mood.",
    avatar: "AM",
  },
  {
    name: "Priya Verma",
    role: "Café Explorer",
    rating: 5,
    text: "The personalized recommendations are my favorite feature. It feels like having a coffee expert who already knows exactly what I like.",
    avatar: "PV",
  },
] as const;

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

export function Testimonials() {
  return (
    <section className="relative overflow-hidden bg-[#090807] py-16 lg:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12%] size-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(180,90,20,0.09),transparent_60%)] blur-[90px]"
      />

      <div className="relative mx-auto max-w-[1200px] px-6">
        {/* --------------------------- SECTION HEADER -------------------------- */}
        <div className="flex flex-col items-center text-center">
          <motion.div {...fadeUp} className="flex items-center gap-4">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[rgba(245,158,11,0.3)]" />
            <span className="inline-flex h-[36px] items-center gap-2.5 rounded-full border border-[rgba(245,161,58,0.25)] bg-[rgba(15,12,9,0.6)] px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#F5A13A]">
              <span className="size-1.5 rounded-full bg-[#F5A13A] shadow-[0_0_8px_rgba(245,161,58,0.8)]" />
              What Our Customers Say
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[rgba(245,158,11,0.3)]" />
          </motion.div>

          <motion.h2
            {...fadeUp}
            className="mt-6 text-[clamp(32px,3.6vw,46px)] font-bold leading-[1.1] tracking-tight text-[#F5F5F5]"
          >
            Made for{" "}
            <span className="bg-gradient-to-r from-[#F0A34A] to-[#D88932] bg-clip-text text-transparent">
              Coffee Lovers.
            </span>
          </motion.h2>

          <motion.p
            {...fadeUp}
            className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#A7A3A0] lg:text-[16px]"
          >
            Real experiences from people who made BrewAI part of their daily
            coffee ritual.
          </motion.p>
        </div>

        {/* --------------------------- TESTIMONIAL CARDS ------------------------ */}
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <motion.div key={t.name} {...fadeUp} className="h-full">
              <figure className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[rgba(245,158,11,0.16)] bg-[rgba(15,12,9,0.6)] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[rgba(245,158,11,0.4)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-18px_rgba(201,134,66,0.4)]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-[radial-gradient(circle,rgba(180,90,20,0.18),transparent_62%)] opacity-0 blur-[40px] transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-[#F0A34A] text-[#F0A34A]"
                      />
                    ))}
                  </div>
                  <Quote className="size-5 text-[#F0A34A]/50" />
                </div>

                <blockquote className="relative mt-5 flex-1 text-[14px] leading-[1.75] text-[#C9C5C0]">
                  “{t.text}”
                </blockquote>

                <figcaption className="relative mt-6 flex items-center gap-3 border-t border-[rgba(245,158,11,0.12)] pt-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.12)] text-[13px] font-bold tracking-wide text-[#F5A13A]">
                    {t.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight text-[#F5F5F5]">
                      {t.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#A7A3A0]">
                      {t.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </motion.div>
          ))}
        </div>

        {/* --------------------------- TRUST INDICATOR -------------------------- */}
        <motion.div
          {...fadeUp}
          className="mt-12 flex items-center justify-center gap-2.5 lg:mt-14"
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[rgba(245,158,11,0.25)]" />
          <span className="grid size-8 place-items-center rounded-full border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)]">
            <Coffee className="size-3.5 text-[#F0A34A]" />
          </span>
          <span className="text-[13px] font-medium text-[#A7A3A0]">
            Trusted by{" "}
            <span className="font-semibold text-[#F5F5F5]">50K+</span> coffee
            lovers
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[rgba(245,158,11,0.25)]" />
        </motion.div>
      </div>
    </section>
  );
}
