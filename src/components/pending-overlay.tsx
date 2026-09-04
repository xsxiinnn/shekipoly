"use client";

export function PendingOverlay({
  visible,
  message = "請稍等…",
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 px-6 backdrop-blur-[2px]"
    >
      <div className="flex min-w-40 items-center justify-center gap-3 rounded-2xl border border-white/70 bg-white px-5 py-4 text-sm font-black text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand"
        />
        <span>{message}</span>
      </div>
    </div>
  );
}
