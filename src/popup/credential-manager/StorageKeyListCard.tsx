import type { ReactNode } from "react"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VirtualizedList } from "@/popup/components/VirtualizedList"
import { truncate } from "@/popup/lib/format"

export type StorageKeyListCardProps = {
  heading: string
  icon: ReactNode
  emptyMessage: string
  filteredKeys: string[]
  allKeys: string[]
  entries: Record<string, string>
  idFn: (k: string) => string
  selected: Set<string>
  onToggle: (id: string, on: boolean) => void
  onSelectAllIn: (ids: string[], on: boolean) => void
}

export function StorageKeyListCard({
  heading,
  icon,
  emptyMessage,
  filteredKeys,
  allKeys,
  entries,
  idFn,
  selected,
  onToggle,
  onSelectAllIn,
}: StorageKeyListCardProps) {
  const [open, setOpen] = useState(false)
  const count = filteredKeys.length
  const groupCount = allKeys.length
  const groupIds = allKeys.map(idFn)
  const groupAllSelected =
    groupCount > 0 && groupIds.every((id) => selected.has(id))

  return (
    <Card size="sm" className="flex flex-col overflow-hidden py-2">
      <CardHeader className="gap-1 pb-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Checkbox
              checked={groupAllSelected}
              disabled={groupCount === 0}
              onCheckedChange={(v) => onSelectAllIn(groupIds, v === true)}
            />
            <CardTitle className="flex items-center gap-1.5 text-xs">
              {icon}
              {heading}
            </CardTitle>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              type="button"
              className={buttonVariants({ variant: "ghost", size: "xs" })}
            >
              {browser.i18n.getMessage("viewDetails")}
            </DialogTrigger>
            <DialogContent className="max-w-[460px] p-0">
              <DialogHeader className="px-4 pt-4">
                <DialogTitle className="flex items-center gap-1.5 text-sm">
                  {icon}
                  {heading}
                </DialogTitle>
                <DialogDescription>
                  {count === 0
                    ? emptyMessage
                    : browser.i18n.getMessage("countItems", [String(count)])}
                </DialogDescription>
              </DialogHeader>
              <div className="px-4 pt-3 pb-4">
                {count > 0 && (
                  <div className="flex gap-1 pb-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        onSelectAllIn(filteredKeys.map(idFn), true)
                      }
                    >
                      {browser.i18n.getMessage("selectAll")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        onSelectAllIn(filteredKeys.map(idFn), false)
                      }
                    >
                      {browser.i18n.getMessage("selectNone")}
                    </Button>
                  </div>
                )}
                {count === 0 ? (
                  <div className="px-1 py-2 text-muted-foreground text-xs">
                    {emptyMessage}
                  </div>
                ) : (
                  <VirtualizedList
                    className="h-[380px] overflow-auto pr-2"
                    items={filteredKeys}
                    getKey={(k) => idFn(k)}
                    renderItem={(k) => {
                      const id = idFn(k)
                      const v = entries[k] ?? ""
                      return (
                        <label
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 hover:bg-muted/60"
                        >
                          <Checkbox
                            id={id}
                            checked={selected.has(id)}
                            onCheckedChange={(vv) => onToggle(id, vv === true)}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="block break-all font-medium text-[12px] leading-tight">
                              {k}
                            </span>
                            <span className="block break-all font-mono text-[10px] text-muted-foreground">
                              {truncate(v, 48)}
                            </span>
                          </span>
                        </label>
                      )
                    }}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription className="text-[10px]">
          {groupCount === 0
            ? emptyMessage
            : browser.i18n.getMessage("countItems", [String(groupCount)])}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}