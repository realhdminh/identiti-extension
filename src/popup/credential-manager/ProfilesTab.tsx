import {
  IconDeviceFloppy,
  IconDownload,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isSupportedWebUrl } from "@/lib/page-credentials"
import type { ProfileIndexEntry } from "@/lib/profiles"

export type ProfilesTabProps = {
  tabUrl: string | undefined
  tabId: number | undefined
  profiles: ProfileIndexEntry[]
  profileBusy: boolean
  onSave: (name: string) => void | Promise<void>
  onRestore: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, name: string) => void | Promise<void>
}

export function ProfilesTab({
  tabUrl,
  tabId,
  profiles,
  profileBusy,
  onSave,
  onRestore,
  onDelete,
  onRename,
}: ProfilesTabProps) {
  const [saveName, setSaveName] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const confirmDeleteProfile = profiles.find((p) => p.id === confirmDeleteId)
  const isWebUrl = isSupportedWebUrl(tabUrl)

  const handleSave = async () => {
    const name = saveName.trim()
    if (!name) return
    await onSave(name)
    setSaveName("")
  }

  const handleRenameSubmit = async (id: string) => {
    const name = renameValue.trim()
    if (!name) return
    await onRename(id, name)
    setRenamingId(null)
    setRenameValue("")
  }

  if (!isWebUrl) {
    return null
  }

  return (
    <>
      <Card size="sm" className="shrink-0 py-2">
        <CardHeader className="gap-1.5 pb-0">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <IconDeviceFloppy className="size-3.5 opacity-50" />
            {browser.i18n.getMessage("profileSaveCurrent")}
          </CardTitle>
          <div className="flex gap-1.5">
            <Input
              className="h-7 flex-1 text-xs"
              placeholder={browser.i18n.getMessage("profileNamePlaceholder")}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave()
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={profileBusy || !saveName.trim() || tabId == null}
              onClick={() => void handleSave()}
            >
              <IconDeviceFloppy className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {profiles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center text-muted-foreground">
          <p className="text-xs">{browser.i18n.getMessage("profilesEmpty")}</p>
          <p className="text-[10px]">
            {browser.i18n.getMessage("profilesEmptyHint")}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-1.5 pr-2">
            {profiles.map((p) => {
              const isRenaming = renamingId === p.id
              const savedDate = new Date(p.savedAt)
              const dateStr = savedDate.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              return (
                <li
                  key={p.id}
                  className="rounded-md border border-border/60 bg-card/50 px-2.5 py-2"
                >
                  {isRenaming ? (
                    <div className="flex gap-1.5">
                      <Input
                        className="h-6 flex-1 text-xs"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRenameSubmit(p.id)
                          if (e.key === "Escape") {
                            setRenamingId(null)
                            setRenameValue("")
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="xs"
                        disabled={profileBusy || !renameValue.trim()}
                        onClick={() => void handleRenameSubmit(p.id)}
                      >
                        OK
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setRenamingId(null)
                          setRenameValue("")
                        }}
                      >
                        {browser.i18n.getMessage("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium text-[12px]">
                          {p.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={browser.i18n.getMessage("profileRestore")}
                            disabled={profileBusy || tabId == null}
                            onClick={() => setConfirmRestoreId(p.id)}
                          >
                            <IconDownload className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={browser.i18n.getMessage("profileRename")}
                            disabled={profileBusy}
                            onClick={() => {
                              setRenamingId(p.id)
                              setRenameValue(p.name)
                            }}
                          >
                            <IconPencil className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={browser.i18n.getMessage("profileDelete")}
                            disabled={profileBusy}
                            onClick={() => setConfirmDeleteId(p.id)}
                          >
                            <IconTrash className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        {browser.i18n.getMessage("profileItemCounts", [
                          String(p.counts.cookies),
                          String(p.counts.localStorage),
                          String(p.counts.sessionStorage),
                          String(p.counts.indexedDB),
                        ])}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {browser.i18n.getMessage("profileSavedAt", dateStr)}
                      </p>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}

      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("profileConfirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage(
                "profileConfirmDeleteBody",
                confirmDeleteProfile?.name ?? ""
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId) void onDelete(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
            >
              {browser.i18n.getMessage("profileDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRestoreId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmRestoreId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("profileConfirmRestoreTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage("profileConfirmRestoreBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRestoreId) void onRestore(confirmRestoreId)
                setConfirmRestoreId(null)
              }}
            >
              {browser.i18n.getMessage("profileRestore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}