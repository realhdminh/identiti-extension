import type { AppLayout } from "@/popup/AppShell"

export type PopupLoadingSkeletonProps = {
  layout?: AppLayout
}

export function PopupLoadingSkeleton({
  layout = "popup",
}: PopupLoadingSkeletonProps) {
  const isSidepanel = layout === "sidepanel"

  return (
    <div
      className={
        isSidepanel
          ? "flex min-h-screen w-full flex-col gap-3 p-3"
          : "flex w-[460px] flex-col gap-3 p-3"
      }
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-full animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-muted/70" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="flex flex-col gap-2">
        {(["a", "b", "c", "d"] as const).map((key) => (
          <div
            key={key}
            className="h-14 animate-pulse rounded-lg border border-border/60 bg-muted/40"
          />
        ))}
      </div>
      <p className="sr-only">{browser.i18n.getMessage("loading")}</p>
    </div>
  )
}