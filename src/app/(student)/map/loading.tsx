export default function MapLoading() {
  return (
    <div className="animate-pulse pb-4 pt-2" aria-label="同行地圖載入中" aria-busy="true">
      <div className="h-3 w-28 rounded bg-border" />
      <div className="mt-3 h-8 w-32 rounded-lg bg-border" />
      <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-10 rounded-xl bg-border" />)}
      </div>
      <div className="mt-4 aspect-square rounded-2xl bg-border" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-white" />)}
      </div>
    </div>
  );
}
