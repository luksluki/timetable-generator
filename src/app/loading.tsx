export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 animate-pulse">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="h-9 w-56 rounded bg-muted" />
          <div className="mt-2 h-5 w-96 rounded bg-muted" />
        </div>
        <div className="h-11 w-40 rounded bg-muted" />
      </section>
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="flex items-center justify-between pb-2">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-4 rounded bg-muted" />
            </div>
            <div className="h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <div className="h-6 w-40 rounded bg-muted mb-3" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
        </div>
        <div className="rounded-lg border p-6">
          <div className="h-6 w-32 rounded bg-muted mb-3" />
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="mt-2 h-4 w-36 rounded bg-muted" />
        </div>
      </section>
    </div>
  );
}
