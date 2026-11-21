export function PopupLoadingSkeleton() {
  return (
    <div
      className="flex h-[580px] max-h-[580px] w-[420px] flex-col gap-3 overflow-hidden p-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-full animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-md bg-muted/70" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="flex flex-col gap-2.5">
        {(["a", "b", "c", "d"] as const).map((key) => (
          <div
            key={key}
            className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/40"
          />
        ))}
      </div>
      <p className="sr-only">{browser.i18n.getMessage("loading")}</p>
    </div>
  )
}