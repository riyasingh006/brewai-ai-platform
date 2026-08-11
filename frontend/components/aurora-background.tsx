export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="aurora-blob animate-blob -left-40 top-[-10%] size-[520px] bg-[#c98642]/25" />
      <div className="aurora-blob animate-blob-2 right-[-8%] top-[20%] size-[460px] bg-[#8a4f1f]/20" />
      <div className="aurora-blob animate-blob bottom-[-15%] left-[30%] size-[480px] bg-[#5a3a1e]/25 [animation-delay:-8s]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,134,66,0.12), transparent 60%)",
        }}
      />
    </div>
  );
}
