export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-neutral-200/80 dark:bg-white/10" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-neutral-200/70 dark:bg-white/10" />
        ))}
      </div>
      <div className="h-48 rounded-2xl bg-neutral-200/60 dark:bg-white/10" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-neutral-200/60 dark:bg-white/10" />
        <div className="h-64 rounded-2xl bg-neutral-200/60 dark:bg-white/10" />
      </div>
    </div>
  );
}
