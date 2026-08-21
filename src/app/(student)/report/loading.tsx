export default function ReportLoading() {
  return (
    <div className="pb-4 pt-2" aria-busy="true">
      <div className="h-3 w-32 animate-pulse rounded bg-border" />
      <div className="mt-3 h-8 w-28 animate-pulse rounded-lg bg-border" />
      <div className="mt-5 h-48 animate-pulse rounded-3xl bg-brand-soft" />
      <div className="mt-7 h-36 animate-pulse rounded-3xl bg-white" />
      <div className="mt-7 h-44 animate-pulse rounded-3xl bg-white" />
      <div className="mt-7 h-80 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}
