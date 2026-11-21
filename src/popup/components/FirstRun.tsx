import {
  IconArrowRight,
  IconDatabase,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconSwitchHorizontal,
  IconWorldWww,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils"

export type FirstRunProps = {
  onSave: () => void
  onTransfer: () => void
  className?: string
}

export function FirstRun({ onSave, onTransfer, className }: FirstRunProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 overflow-y-auto p-1 text-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <IconDeviceFloppy className="size-6" />
        </div>
        <h1 className="font-heading text-base font-semibold tracking-tight">
          {browser.i18n.getMessage("welcomeTitle")}
        </h1>
        <p className="max-w-[320px] text-xs leading-relaxed text-muted-foreground">
          {browser.i18n.getMessage("welcomeBody")}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 text-left">
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <IconSwitchHorizontal className="size-4" />
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">
              {browser.i18n.getMessage("welcomeFeatSwitch")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <IconDatabase className="size-4" />
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">
              {browser.i18n.getMessage("welcomeFeatCheckpoint")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <IconWorldWww className="size-4" />
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">
              {browser.i18n.getMessage("welcomeFeatTransfer")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <Button
          type="button"
          size="lg"
          className="h-10 w-full gap-2 text-xs font-medium"
          onClick={() => onSave()}
        >
          <IconDeviceFloppy className="size-4" />
          {browser.i18n.getMessage("welcomeSave")}
          <IconArrowRight className="ml-auto size-3.5 opacity-70" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-10 w-full gap-2 text-xs font-medium"
          onClick={onTransfer}
        >
          <IconDeviceMobile className="size-4" />
          {browser.i18n.getMessage("welcomeTransfer")}
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground/80">
        {browser.i18n.getMessage("localFirstBadge")}
      </p>
    </div>
  )
}