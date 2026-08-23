export default function ScheduleLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-pulse">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="mt-2 h-4 w-96 rounded bg-muted" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-10 w-[90px] rounded bg-muted" />
          <div className="h-10 w-[170px] rounded bg-muted" />
          <div className="h-10 w-32 rounded bg-muted" />
          <div className="h-10 w-24 rounded bg-muted" />
          <div className="h-10 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="h-10 w-72 rounded bg-muted" />
        <div className="h-10 w-[260px] rounded bg-muted" />
      </div>
      <div className="rounded-lg border p-3">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-20"><div className="h-8 rounded bg-muted" /></th>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i}><div className="h-8 rounded bg-muted" /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 9 }).map((_, row) => (
              <tr key={row}>
                <td><div className="h-14 rounded-md bg-muted" /></td>
                {Array.from({ length: 5 }).map((_, col) => (
                  <td key={col}><div className="h-14 rounded-md bg-muted/60" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
