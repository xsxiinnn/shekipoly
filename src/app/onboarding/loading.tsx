export default function OnboardingLoading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 py-6" aria-busy="true">
      <div className="size-12 animate-pulse rounded-2xl bg-brand-soft" />
      <div className="mt-7 h-3 w-32 animate-pulse rounded bg-border" />
      <div className="mt-3 h-9 w-56 animate-pulse rounded-xl bg-border" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-border/70" />
      <div className="mt-10 space-y-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item}>
            <div className="mb-2 h-4 w-16 animate-pulse rounded bg-border" />
            <div className="h-12 animate-pulse rounded-2xl bg-white" />
          </div>
        ))}
      </div>
    </main>
  );
}
