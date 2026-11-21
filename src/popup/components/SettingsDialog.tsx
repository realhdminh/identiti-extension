import {
  IconAlertTriangle,
  IconCopy,
  IconDownload,
  IconSettings,
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { isSupportedWebUrl } from "@/lib/page-credentials"

export type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabUrl: string | undefined
  reloadHint: string
  onCopyJson: () => void | Promise<void>
  onExportAllProfiles: () => void | Promise<void>
  exportAllBusy?: boolean
}

export function SettingsDialog({
  open,
  onOpenChange,
  tabUrl,
  reloadHint,
  onCopyJson,
  onExportAllProfiles,
  exportAllBusy = false,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[480px] w-[calc(100%-1.5rem)] max-w-[380px] flex-col overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <IconSettings className="size-4 opacity-70" />
            {browser.i18n.getMessage("advancedTitle")}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          <div className="flex flex-col gap-3.5">
            <Alert variant="destructive">
              <IconAlertTriangle aria-hidden="true" />
              <AlertDescription>
                {browser.i18n.getMessage("profilesPlaintextWarning")}
              </AlertDescription>
            </Alert>

            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-foreground">
                {browser.i18n.getMessage("advancedWhatCaptured")}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {browser.i18n.getMessage("advancedWhatCapturedBody")}
              </p>
            </section>

            <Separator />

            <section className="flex flex-col gap-2.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {reloadHint}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full gap-2 text-xs font-medium"
                disabled={!isSupportedWebUrl(tabUrl) || exportAllBusy}
                onClick={() => void onCopyJson()}
              >
                <IconCopy className="size-4" />
                {browser.i18n.getMessage("advancedCopyJson")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full gap-2 text-xs font-medium"
                disabled={exportAllBusy}
                onClick={() => void onExportAllProfiles()}
              >
                <IconDownload className="size-4" />
                {browser.i18n.getMessage("exportAllProfiles")}
              </Button>
            </section>
          </div>
        </ScrollArea>
        <div className="flex shrink-0 justify-end border-t px-4 py-2">
          <DialogClose render={<Button variant="outline" size="sm" />}>
            {browser.i18n.getMessage("close")}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}