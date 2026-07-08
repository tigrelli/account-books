export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paylens-main)] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight text-white">
            pay<span className="text-[var(--paylens-action)]">L</span>ens
          </div>
          <p className="mt-1 text-xs tracking-[0.2em] text-white/40 uppercase">
            Trusted Expense Analysis
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}
