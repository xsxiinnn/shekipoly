export default function RulesLoading() {
  return (
    <div className="animate-pulse pb-4 pt-2" aria-label="遊戲規則載入中" aria-busy="true">
      <div className="h-3 w-28 rounded bg-border" />
      <div className="mt-3 h-9 w-36 rounded-lg bg-border" />
      <div className="mt-3 h-5 w-44 rounded bg-border/70" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-18 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="mt-9 space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-52 rounded-3xl bg-white" />
        ))}
      </div>
    </div>
  );
}
