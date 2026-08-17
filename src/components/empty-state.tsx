type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="flex min-h-[55dvh] flex-col justify-center py-8">
      <p className="mb-2 text-sm font-bold tracking-[0.18em] text-brand">
        青年關懷大富翁
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 max-w-sm text-base leading-7 text-muted">{description}</p>
      <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface/60 px-5 py-12 text-center text-sm font-medium text-muted">
        此功能將於下一階段建置
      </div>
    </section>
  );
}
