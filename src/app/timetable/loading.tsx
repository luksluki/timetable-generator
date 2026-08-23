export default function TimetableLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-pulse">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="h-8 w-72 rounded bg-muted" />
          <div className="mt-2 h-4 w-80 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded bg-muted" />
          <div className="h-10 w-28 rounded bg-muted" />
        </div>
      </div>
      <div className="mb-5 space-y-3 rounded-md border bg-muted/30 p-4">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md border bg-background" />
          ))}
        </div>
      </div>
      <div className="h-10 w-96 rounded bg-muted mb-4" />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-48 rounded-md border p-2">
            <div className="mb-2 h-5 w-16 rounded bg-muted" />
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: 9 }).map((_, j) => (
                <div key={j} className="grid grid-cols-5 gap-0.5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <div key={k} className="h-6 rounded bg-muted/40" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
