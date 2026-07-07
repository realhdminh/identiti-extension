import { IconDeviceFloppy, IconTrash, IconUpload } from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isSupportedWebUrl } from "@/lib/page-credentials"
import type { ProfileIndexEntry } from "@/lib/profiles"
import { cn } from "@/utils"

export type LoginDashboardProps = {
  tabUrl: string | undefined
  tabId: number | undefined
  profiles: ProfileIndexEntry[]
  profileBusy: boolean
  onSaveCurrent: (name: string) => void
  onRestore: (id: string) => void
  onTrash: (id: string) => void
  onOpenTransfer: () => void
}

function siteName(origin: string): string {
  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}

export function LoginDashboard({
  tabUrl,
  tabId,
  profiles,
  profileBusy,
  onSaveCurrent,
  onRestore,
  onTrash,
  onOpenTransfer,
}: LoginDashboardProps) {
  const isWebUrl = isSupportedWebUrl(tabUrl)
  const origin = tabUrl && isWebUrl ? new URL(tabUrl).origin : null
  const [name, setName] = useState("")

  const saveDisabled = !isWebUrl || tabId == null || profileBusy
  const finalName = name.trim() || (origin ? siteName(origin) : "")

  const handleSave = () => {
    if (saveDisabled || !finalName) return
    onSaveCurrent(finalName)
    setName("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Card size="sm" className="shrink-0 py-3">
        <div className="flex flex-col gap-2 px-3">
          <Input
            className="h-8 text-xs"
            placeholder={
              origin
                ? `${browser.i18n.getMessage("profileNamePlaceholder")} (${siteName(origin)})`
                : browser.i18n.getMessage("profileNamePlaceholder")
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
            }}
          />
          <Button
            type="button"
            className="w-full gap-1.5"
            disabled={saveDisabled}
            onClick={handleSave}
          >
            <IconDeviceFloppy className="size-3.5" />
            {browser.i18n.getMessage("saveCurrentLabel")}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
            {isWebUrl && origin
              ? browser.i18n.getMessage("saveCurrentHint", [siteName(origin)])
              : browser.i18n.getMessage("restrictedPage")}
          </p>
        </div>
      </Card>

      {profiles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            {browser.i18n.getMessage("dashboardSavedEmpty")}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {browser.i18n.getMessage("dashboardSavedEmptyHint")}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <p className="px-1 pb-1.5 font-medium text-muted-foreground text-xs">
            {browser.i18n.getMessage("dashboardTitle")}
          </p>
          <ul className="flex flex-col gap-2 pr-2">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-border/60 bg-card/50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[13px] leading-tight">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {browser.i18n.getMessage("profileSavedAt", [
                        new Date(p.savedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      ])}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-0.5",
                      !isWebUrl && "pointer-events-none opacity-40"
                    )}
                  >
                    <Button
                      type="button"
                      size="xs"
                      disabled={profileBusy || tabId == null}
                      onClick={() => onRestore(p.id)}
                    >
                      {browser.i18n.getMessage("restore")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      title={browser.i18n.getMessage("trash")}
                      disabled={profileBusy}
                      onClick={() => onTrash(p.id)}
                    >
                      <IconTrash className="size-3" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full shrink-0 gap-1.5"
        onClick={onOpenTransfer}
      >
        <IconUpload className="size-3.5" />
        {browser.i18n.getMessage("transferOpen")}
      </Button>
    </div>
  )
}