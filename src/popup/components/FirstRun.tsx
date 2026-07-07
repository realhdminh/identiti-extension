import {
  IconArrowRight,
  IconDeviceFloppy,
  IconDeviceMobile,
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
        "flex flex-col gap-4 overflow-y-auto p-4 text-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <IconDeviceFloppy className="size-5" />
        </div>
        <h1 className="font-heading font-semibold text-base tracking-tight">
          {browser.i18n.getMessage("welcomeTitle")}
        </h1>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {browser.i18n.getMessage("welcomeBody")}
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full gap-1.5"
        onClick={onSave}
      >
        <IconDeviceFloppy className="size-4" />
        {browser.i18n.getMessage("welcomeSave")}
        <IconArrowRight className="size-3.5 opacity-70" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-1.5"
        onClick={onTransfer}
      >
        <IconDeviceMobile className="size-4" />
        {browser.i18n.getMessage("welcomeTransfer")}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        {browser.i18n.getMessage("localFirstBadge")}
      </p>
    </div>
  )
}