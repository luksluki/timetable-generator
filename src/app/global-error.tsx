"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-900">
        <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
          <h2 className="text-2xl font-bold">Application Error</h2>
          <p className="text-neutral-600">
            {error.message || "A critical error occurred. Please reload the page."}
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
