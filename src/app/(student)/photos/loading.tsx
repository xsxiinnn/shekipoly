export default function PhotosLoading() {
  return (
    <div className="animate-pulse pb-4 pt-2" aria-label="照片牆載入中">
      <div className="h-3 w-28 rounded bg-border" />
      <div className="mt-3 h-8 w-44 rounded bg-border" />
      <div className="mt-5 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-11 rounded-2xl bg-border" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-[4/5] rounded-3xl bg-border" />
        ))}
      </div>
    </div>
  );
}
