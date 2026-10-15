export default function SkeletonCard() {
  return (
    <div className="bg-cinema-card rounded-xl overflow-hidden border border-cinema-border">
      <div className="aspect-[2/3] shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-4 shimmer rounded w-3/4" />
        <div className="h-3 shimmer rounded w-1/2" />
      </div>
    </div>
  );
}
