"use client";

export default function OnboardingError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center bg-background px-4 py-8">
      <section className="w-full rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-black text-foreground">頁面暫時無法開啟</p>
        <p className="mt-2 text-sm leading-6 text-muted">請檢查網路後再試一次。</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-11 w-full rounded-2xl bg-foreground text-sm font-bold text-white"
        >
          再試一次
        </button>
      </section>
    </main>
  );
}
