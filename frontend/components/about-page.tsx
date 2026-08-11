"use client";

import Image, { type StaticImageData } from "next/image";
import { Coffee, MapPin, ShieldCheck, Sparkles, Store } from "lucide-react";
import { motion } from "framer-motion";
import heroImg from "../../pictures/about-hero-coffee.png";
import missionImg from "../../pictures/about-mission-coffee.png";
import storyImg from "../../pictures/about-story-cafe.png";

const STATS = [
  { icon: Coffee, value: "50K+", label: "Happy Customers" },
  { icon: Store, value: "200+", label: "Partner Cafés" },
  { icon: Coffee, value: "25K+", label: "Cups Served Daily" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-Powered Recommendations",
    desc: "Smart suggestions tailored to your taste, mood, and the perfect moment.",
  },
  {
    icon: MapPin,
    title: "Discover Nearby Cafés",
    desc: "Find the best cafés around you with real-time local insights.",
  },
  {
    icon: Coffee,
    title: "Personalized Experience",
    desc: "A coffee journey crafted exclusively around your preferences.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted & Secure",
    desc: "Your data and privacy are always protected with confidence.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#F5A13A]">
      {children}
    </span>
  );
}

function BlendImage({
  src,
  alt,
  sizes,
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
}) {
  return (
    <div className="relative mt-8 w-full max-w-[460px] lg:mt-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-5 bg-[radial-gradient(circle,rgba(180,90,20,0.09),transparent_60%)] blur-[40px]"
      />
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[20px] ring-1 ring-[rgba(245,158,11,0.1)]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover object-center"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_50%,rgba(9,8,7,0.5)_100%)]"
        />
      </div>
    </div>
  );
}

export function AboutSection({
  onMenu,
}: {
  onMenu: () => void;
  onNotice: (text: string) => void;
}) {
  return (
    <section
      id="about"
      className="relative scroll-mt-24 overflow-hidden bg-[#090807] text-[#F5F5F5]"
    >
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] top-1/2 size-[720px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_70%_45%,rgba(180,90,20,0.08),transparent_55%)] blur-[60px]"
        />
        <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-6 pb-6 pt-10 sm:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:pb-8 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="flex w-full flex-col items-start"
          >
            <span className="inline-flex h-[36px] items-center gap-2.5 rounded-full border border-[rgba(245,161,58,0.25)] bg-[rgba(15,12,9,0.6)] px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#F5A13A]">
              <span className="size-1.5 rounded-full bg-[#F5A13A] shadow-[0_0_8px_rgba(245,161,58,0.8)]" />
              About BrewAI
            </span>

            <h1 className="mt-6 text-[clamp(40px,3.8vw,52px)] font-bold leading-[1.06] tracking-tight text-[#F5F5F5]">
              Our Passion,
              <br />
              Your{" "}
              <span className="bg-gradient-to-r from-[#F5A13A] to-[#D88932] bg-clip-text text-transparent">
                Perfect Brew.
              </span>
            </h1>

            <p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-[#A7A3A0] lg:text-[17px]">
              BrewAI blends cutting-edge artificial intelligence with a genuine
              love for coffee — creating a smarter way to discover cafés,
              personalize your drinks, and savor every single moment.
            </p>

            <div className="mt-7 grid w-full max-w-[580px] grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="flex min-h-[110px] items-center gap-3 rounded-[16px] border border-[rgba(245,158,11,0.18)] bg-[rgba(15,12,9,0.65)] px-4 py-3.5 text-left transition-colors duration-300 hover:border-[rgba(245,158,11,0.4)]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] text-[#F5A13A]">
                    <s.icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-[24px] font-bold leading-none text-[#F5F5F5] sm:text-[28px]">
                      {s.value}
                    </p>
                    <p className="mt-1.5 text-[12px] text-[#A7A3A0]">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative flex items-center justify-center"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[-12%] bg-[radial-gradient(circle,rgba(180,90,20,0.1),transparent_58%)] blur-[40px]"
            />
            <div className="relative aspect-[17/10] w-full max-w-[760px]">
              <Image
                src={heroImg}
                alt="BrewAI signature coffee"
                priority
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 760px"
                className="object-cover object-center [-webkit-mask-image:radial-gradient(ellipse_82%_78%_at_50%_50%,#000_28%,rgba(0,0,0,0.85)_54%,transparent_80%)] [mask-image:radial-gradient(ellipse_82%_78%_at_50%_50%,#000_28%,rgba(0,0,0,0.85)_54%,transparent_80%)]"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------- WHAT MAKES US ---------------------------- */}
      <section className="relative pt-8 lg:pt-9">
        <div className="mx-auto max-w-[1200px] px-6">
          <motion.div {...fadeUp} className="flex items-center gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(245,158,11,0.3)]" />
            <Eyebrow>What Makes Us Different</Eyebrow>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(245,158,11,0.3)]" />
          </motion.div>
          <motion.div {...fadeUp} className="mt-7 text-center">
            <h2 className="text-[clamp(28px,3vw,40px)] font-bold leading-[1.1] tracking-tight text-[#F5F5F5]">
              Intelligence in Every Sip
            </h2>
            <p className="mx-auto mt-3.5 max-w-[560px] text-[15px] leading-relaxed text-[#A7A3A0] lg:text-[16px]">
              We combine advanced AI with the craft of specialty coffee to
              deliver a truly unique experience in every single cup.
            </p>
          </motion.div>
        </div>
      </section>

      {/* --------------------------- FEATURE CARDS --------------------------- */}
      <section className="relative pt-9 lg:pt-11">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 px-6 pb-14 sm:grid-cols-2 lg:grid-cols-4 lg:pb-16">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              whileHover={{ y: -4 }}
              className="group flex h-full flex-col items-center rounded-[20px] border border-[rgba(245,158,11,0.16)] bg-[rgba(15,12,9,0.6)] px-6 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors duration-300 hover:border-[rgba(245,158,11,0.35)] hover:bg-[rgba(20,16,11,0.7)]"
            >
              <span className="grid size-12 place-items-center rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.1)] text-[#F5A13A]">
                <f.icon className="size-[22px]" />
              </span>
              <h3 className="mt-5 text-[16px] font-semibold text-[#F5F5F5]">
                {f.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#A7A3A0]">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --------------------------- MISSION / STORY -------------------------- */}
      <section className="relative pb-14 lg:pb-16">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:gap-0">
          <motion.div {...fadeUp} className="flex flex-col lg:pr-7">
            <Eyebrow>Our Mission</Eyebrow>
            <h3 className="mt-4 text-[clamp(26px,2.6vw,36px)] font-bold leading-[1.12] tracking-tight text-[#F5F5F5]">
              To Make Every Coffee Moment{" "}
              <span className="bg-gradient-to-r from-[#F5A13A] to-[#D88932] bg-clip-text text-transparent">
                Meaningful
              </span>
            </h3>
            <span className="mt-5 block h-[3px] w-11 rounded-full bg-gradient-to-r from-[#F5A13A] to-[#C97B24]" />
            <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-[#A7A3A0]">
              We believe technology should serve taste. Our mission is to help
              people discover cafés they’ll love, order with ease, and enjoy
              coffee that feels personal — every single time.
            </p>
            <BlendImage
              src={missionImg}
              alt="BrewAI mission coffee"
              sizes="(max-width: 640px) 100vw, 460px"
            />
          </motion.div>

          <motion.div
            {...fadeUp}
            className="flex flex-col lg:border-l lg:border-[rgba(245,158,11,0.12)] lg:pl-7"
          >
            <Eyebrow>Our Story</Eyebrow>
            <h3 className="mt-4 text-[clamp(26px,2.6vw,36px)] font-bold leading-[1.12] tracking-tight text-[#F5F5F5]">
              Brewed From a{" "}
              <span className="bg-gradient-to-r from-[#F5A13A] to-[#D88932] bg-clip-text text-transparent">
                Simple Dream
              </span>
            </h3>
            <span className="mt-5 block h-[3px] w-11 rounded-full bg-gradient-to-r from-[#F5A13A] to-[#C97B24]" />
            <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-[#A7A3A0]">
              BrewAI began with a small group of coffee lovers and
              technologists who believed great cafés deserved to be found.
              Today we partner with cafés worldwide to build the future of
              coffee.
            </p>
            <BlendImage
              src={storyImg}
              alt="BrewAI café interior"
              sizes="(max-width: 640px) 100vw, 460px"
            />
          </motion.div>
        </div>
      </section>

      {/* ------------------------------- CTA --------------------------------- */}
      <section className="relative pb-16 lg:pb-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <motion.div
            {...fadeUp}
            className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl border border-[rgba(245,158,11,0.15)] bg-[rgba(15,12,9,0.65)] px-7 py-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:px-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute right-[-6%] top-[-70%] size-[320px] rounded-full bg-[radial-gradient(circle,rgba(180,90,20,0.1),transparent_58%)] blur-[60px]"
            />
            <div className="relative flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.1)]">
                <Coffee className="size-6 text-[#F5A13A]" />
              </span>
              <div>
                <h2 className="text-[22px] font-bold leading-tight tracking-tight text-[#F5F5F5] sm:text-[24px]">
                  Brew Smarter.{" "}
                  <span className="text-[#F5A13A]">Live Better.</span>
                </h2>
                <p className="mt-1 text-[13px] text-[#A7A3A0]">
                  Thank you for being part of our coffee journey.
                </p>
              </div>
            </div>
            <button
              onClick={onMenu}
              className="relative inline-flex h-[50px] shrink-0 items-center gap-2 rounded-[14px] bg-gradient-to-br from-[#F0A34A] to-[#C97B24] px-7 text-[15px] font-semibold text-white shadow-[0_14px_36px_-12px_rgba(216,137,50,0.5)] transition-all hover:brightness-110 hover:shadow-[0_16px_44px_-10px_rgba(216,137,50,0.7)] active:scale-[0.98]"
            >
              <Coffee className="size-5" />
              Explore Menu
            </button>
          </motion.div>
        </div>
      </section>
    </section>
  );
}
