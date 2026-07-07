import { IconCopy } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

export type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabUrl: string | undefined
  reloadHint: string
  onCopyJson: () => void | Promise<void>
}

export function SettingsDialog({
  open,
  onOpenChange,
  tabUrl,
  reloadHint,
  onCopyJson,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-sm">
            {browser.i18n.getMessage("advancedTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <section className="flex flex-col gap-2">
            <p className="font-medium text-xs">
              {browser.i18n.getMessage("advancedWhatCaptured")}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {browser.i18n.getMessage("advancedWhatCapturedBody")}
            </p>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {reloadHint}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={!tabUrl}
              onClick={() => void onCopyJson()}
            >
              <IconCopy className="size-3.5" />
              {browser.i18n.getMessage("advancedCopyJson")}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}