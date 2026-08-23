"use client";

export default function StudentError({ reset }: { reset: () => void }) {
  return (
    <section className="mt-8 rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm" role="alert">
      <h1 className="text-lg font-black">頁面暫時無法開啟</h1>
      <p className="mt-2 text-sm leading-6 text-muted">網路好像有點不穩，請再試一次。</p>
      <button type="button" onClick={reset} className="mt-6 h-11 w-full rounded-2xl bg-foreground text-sm font-black text-white">
        再試一次
      </button>
    </section>
  );
}
