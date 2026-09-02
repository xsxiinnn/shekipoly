export function startPerformanceTimer(label: string) {
  if (process.env.NODE_ENV === "production") return () => undefined;

  const startedAt = performance.now();
  return () => {
    const duration = Math.round((performance.now() - startedAt) * 10) / 10;
    console.info(`[perf] ${label}: ${duration}ms`);
    return duration;
  };
}
