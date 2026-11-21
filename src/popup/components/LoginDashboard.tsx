import {
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSwitchHorizontal,
  IconTrash,
  IconUpload,
  IconUserPlus,
  IconWorld,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useMemo, useState } from "react"
import { z } from "zod"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isSupportedWebUrl } from "@/lib/page-credentials"
import type { ProfileIndexEntry } from "@/lib/profiles"
import { cn } from "@/utils"

export type LoginDashboardProps = {
  tabUrl: string | undefined
  tabId: number | undefined
  profiles: ProfileIndexEntry[]
  allProfiles?: ProfileIndexEntry[]
  trashedProfiles?: ProfileIndexEntry[]
  activeProfileId?: string | null
  profileBusy: boolean
  canUndoRestore: boolean
  onSaveCurrent: (name: string) => void
  onRestore: (id: string) => void
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
  onDeleteAllOther?: () => void
  onRestoreTrashed?: (id: string) => void
  onDeleteTrashedForever?: (id: string) => void
  onPrepareNewLogin?: () => void
  onUndoRestore: () => void
  onOpenTransfer: () => void
}

function siteName(origin: string): string {
  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "ID"
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? ""
    const second = parts[1]?.[0] ?? ""
    return (first + second).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

const saveProfileSchema = z.object({
  name: z.string().max(100),
})

const renameProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export function LoginDashboard({
  tabUrl,
  tabId,
  profiles,
  allProfiles = [],
  trashedProfiles = [],
  activeProfileId,
  profileBusy,
  canUndoRestore,
  onSaveCurrent,
  onRestore,
  onRename,
  onDelete,
  onDeleteAllOther,
  onRestoreTrashed,
  onDeleteTrashedForever,
  onPrepareNewLogin,
  onUndoRestore,
  onOpenTransfer,
}: LoginDashboardProps) {
  const isWebUrl = isSupportedWebUrl(tabUrl)
  const origin = tabUrl && isWebUrl ? new URL(tabUrl).origin : null
  const [search, setSearch] = useState("")
  const [renamingProfile, setRenamingProfile] = useState<{
    id: string
    name: string
  } | null>(null)
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string
    forever?: boolean
  } | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  const deleteForever = deleteConfirmation?.forever
  const profilePendingDelete = deleteConfirmation
    ? deleteForever
      ? trashedProfiles.find((p) => p.id === deleteConfirmation.id)
      : (allProfiles.find((p) => p.id === deleteConfirmation.id) ??
        profiles.find((p) => p.id === deleteConfirmation.id))
    : undefined
  const hasSearch = search.length > 0

  const saveDisabled = !isWebUrl || tabId == null || profileBusy

  const saveForm = useForm({
    defaultValues: { name: "" },
    validators: { onChange: saveProfileSchema, onSubmit: saveProfileSchema },
    onSubmit: ({ value }) => {
      if (saveDisabled) return
      const finalName = value.name.trim() || (origin ? siteName(origin) : "")
      if (!finalName) return
      onSaveCurrent(finalName)
      saveForm.reset()
    },
  })

  const renameForm = useForm({
    defaultValues: { name: "" },
    validators: {
      onChange: renameProfileSchema,
      onSubmit: renameProfileSchema,
    },
    onSubmit: ({ value }) => {
      if (profileBusy || !renamingProfile) return
      const trimmed = value.name.trim()
      if (trimmed && trimmed !== renamingProfile.name) {
        onRename(renamingProfile.id, trimmed)
      }
      setRenamingProfile(null)
    },
  })

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingProfile({ id, name: currentName })
    renameForm.setFieldValue("name", currentName)
  }

  const otherProfiles = useMemo(() => {
    return allProfiles.filter((p) => p.origin !== origin)
  }, [allProfiles, origin])

  const [showOtherSites, setShowOtherSites] = useState(false)

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return profiles
    return profiles.filter((p) => p.name.toLowerCase().includes(query))
  }, [profiles, search])

  const filteredOtherProfiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return otherProfiles
    return otherProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.origin.toLowerCase().includes(query)
    )
  }, [otherProfiles, search])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {profiles.length === 0 ? (
        <Card className="shrink-0 border-border/70 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void saveForm.handleSubmit()
            }}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {browser.i18n.getMessage("saveCurrentLabel")}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {isWebUrl && origin
                  ? browser.i18n.getMessage("saveCurrentHint", [
                      siteName(origin),
                    ])
                  : browser.i18n.getMessage("restrictedPage")}
              </p>
            </div>
            <saveForm.Field name="name">
              {(field) => (
                <Field
                  data-invalid={
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  }
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    className="h-9 text-xs"
                    placeholder={
                      origin
                        ? `${browser.i18n.getMessage("profileNamePlaceholder")} (${siteName(origin)})`
                        : browser.i18n.getMessage("profileNamePlaceholder")
                    }
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </saveForm.Field>
            <saveForm.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="h-9 w-full gap-2 text-xs font-medium"
                  disabled={saveDisabled || !canSubmit || isSubmitting}
                >
                  <IconDeviceFloppy className="size-4" />
                  {browser.i18n.getMessage("saveCurrentLabel")}
                </Button>
              )}
            </saveForm.Subscribe>
          </form>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">
              {browser.i18n.getMessage("expandSaveAccount")}
            </p>
            {onPrepareNewLogin && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                disabled={!isWebUrl || tabId == null || profileBusy}
                title={browser.i18n.getMessage("prepareNewLoginHint")}
                onClick={onPrepareNewLogin}
              >
                <IconUserPlus className="size-3.5" />
                {browser.i18n.getMessage("prepareNewLogin")}
              </Button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void saveForm.handleSubmit()
            }}
          >
            <FieldGroup className="flex-row items-start gap-2">
              <saveForm.Field name="name">
                {(field) => {
                  const errors = field.state.meta.errors
                  const invalid = errors.length > 0
                  return (
                    <Field
                      className="min-w-0 flex-1 gap-1"
                      data-invalid={invalid}
                    >
                      <Input
                        id={field.name}
                        name={field.name}
                        className="h-8 text-xs"
                        placeholder={
                          origin
                            ? `${browser.i18n.getMessage("profileNamePlaceholder")} (${siteName(origin)})`
                            : browser.i18n.getMessage("profileNamePlaceholder")
                        }
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? "save-name-error" : undefined
                        }
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <FieldError id="save-name-error" errors={errors} />
                    </Field>
                  )
                }}
              </saveForm.Field>
              <saveForm.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-3 text-xs font-medium"
                    disabled={saveDisabled || !canSubmit || isSubmitting}
                  >
                    <IconPlus data-icon="inline-start" />
                    {browser.i18n.getMessage("saveCurrentLabel")}
                  </Button>
                )}
              </saveForm.Subscribe>
            </FieldGroup>
          </form>
        </div>
      )}

      {profiles.length === 0 && !hasSearch && otherProfiles.length > 0 && (
        <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <IconWorld className="size-3.5 text-muted-foreground" />
              {browser.i18n.getMessage("otherSitesAccounts")} (
              {otherProfiles.length})
            </div>
            {onDeleteAllOther && otherProfiles.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                disabled={profileBusy}
                onClick={() => setConfirmDeleteAllOpen(true)}
                title={browser.i18n.getMessage("deleteAllOtherSites")}
              >
                {browser.i18n.getMessage("deleteAll")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowOtherSites((v) => !v)}
            >
              {showOtherSites
                ? browser.i18n.getMessage("hideOtherSitesAccounts")
                : browser.i18n.getMessage("viewOtherSitesAccounts")}
            </Button>
          </div>
          {showOtherSites && (
            <ScrollArea className="max-h-48 min-h-0">
              <ul className="flex flex-col gap-2 pr-1">
                {otherProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 p-2"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {p.name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {siteName(p.origin)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      title={browser.i18n.getMessage("profileDelete")}
                      disabled={profileBusy}
                      onClick={() => setDeleteConfirmation({ id: p.id })}
                    >
                      <IconTrash />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}

      {(profiles.length > 0 || hasSearch) && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground">
              {browser.i18n.getMessage("dashboardTitle")} ({profiles.length})
            </p>
          </div>

          {(profiles.length >= 3 || hasSearch) && (
            <div className="relative shrink-0">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="h-8 pl-8 text-xs"
                placeholder={browser.i18n.getMessage(
                  "searchAccountsPlaceholder"
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1">
            {filteredProfiles.length === 0 &&
            filteredOtherProfiles.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {browser.i18n.getMessage("noAccountsFound")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5 pr-2">
                {filteredProfiles.map((p) => {
                  const isActive = p.id === activeProfileId
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "rounded-lg border p-3.5 transition-all",
                        isActive
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 bg-card/50 hover:border-border"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-xs select-none",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "border border-border/60 bg-muted/80 text-foreground/80"
                            )}
                          >
                            {getInitials(p.name)}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {p.name}
                              </p>
                              {isActive && (
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] font-normal text-primary"
                                >
                                  {browser.i18n.getMessage("activeBadge")}
                                </Badge>
                              )}
                            </div>
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
                        </div>

                        <div
                          className={cn(
                            "flex shrink-0 items-center gap-1",
                            !isWebUrl && "pointer-events-none opacity-40"
                          )}
                        >
                          {isActive ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-primary hover:bg-primary/15"
                              disabled={profileBusy || tabId == null}
                              title={browser.i18n.getMessage("reapplyHint")}
                              onClick={() => onRestore(p.id)}
                            >
                              <IconRefresh className="size-3.5" />
                              {browser.i18n.getMessage("reapply")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 gap-1 px-2.5 text-xs font-medium"
                              disabled={profileBusy || tabId == null}
                              title={browser.i18n.getMessage("switchAccount")}
                              onClick={() => onRestore(p.id)}
                            >
                              <IconSwitchHorizontal className="size-3.5" />
                              {browser.i18n.getMessage("switchAccount")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title={browser.i18n.getMessage("rename")}
                            disabled={profileBusy}
                            onClick={() => handleStartRename(p.id, p.name)}
                          >
                            <IconPencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            title={browser.i18n.getMessage("profileDelete")}
                            disabled={profileBusy}
                            onClick={() => setDeleteConfirmation({ id: p.id })}
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
                {!search.trim() && otherProfiles.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <IconWorld className="size-3.5 text-muted-foreground" />
                        {browser.i18n.getMessage("otherSitesAccounts")} (
                        {otherProfiles.length})
                      </div>
                      <div className="flex items-center gap-1">
                        {onDeleteAllOther && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                            disabled={profileBusy}
                            onClick={() => setConfirmDeleteAllOpen(true)}
                            title={browser.i18n.getMessage(
                              "deleteAllOtherSites"
                            )}
                          >
                            {browser.i18n.getMessage("deleteAll")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => setShowOtherSites((v) => !v)}
                        >
                          {showOtherSites
                            ? browser.i18n.getMessage("hideOtherSitesAccounts")
                            : browser.i18n.getMessage("viewOtherSitesAccounts")}
                        </Button>
                      </div>
                    </div>
                    {showOtherSites && (
                      <ul className="flex flex-col gap-2">
                        {otherProfiles.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 p-2"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="truncate text-xs font-medium text-foreground">
                                {p.name}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {siteName(p.origin)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                              title={browser.i18n.getMessage("profileDelete")}
                              disabled={profileBusy}
                              onClick={() =>
                                setDeleteConfirmation({ id: p.id })
                              }
                            >
                              <IconTrash />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {search.trim().length > 0 &&
                  filteredOtherProfiles.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {browser.i18n.getMessage("otherSitesAccounts")} (
                          {filteredOtherProfiles.length})
                        </p>
                        {onDeleteAllOther && otherProfiles.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                            disabled={profileBusy}
                            onClick={() => setConfirmDeleteAllOpen(true)}
                            title={browser.i18n.getMessage(
                              "deleteAllOtherSites"
                            )}
                          >
                            {browser.i18n.getMessage("deleteAll")}
                          </Button>
                        )}
                      </div>
                      {filteredOtherProfiles.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/40 p-2.5"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-xs font-medium text-foreground">
                              {p.name}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {siteName(p.origin)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            title={browser.i18n.getMessage("profileDelete")}
                            disabled={profileBusy}
                            onClick={() => setDeleteConfirmation({ id: p.id })}
                          >
                            <IconTrash />
                          </Button>
                        </li>
                      ))}
                    </div>
                  )}
              </ul>
            )}
          </ScrollArea>
        </div>
      )}

      {canUndoRestore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full shrink-0 gap-2 text-xs"
          disabled={profileBusy}
          onClick={onUndoRestore}
        >
          {browser.i18n.getMessage("undoLastRestore")}
        </Button>
      )}

      <div className="shrink-0 space-y-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full gap-2 text-xs font-medium"
          disabled={profileBusy}
          onClick={onOpenTransfer}
        >
          <IconUpload className="size-4" />
          {browser.i18n.getMessage("transferOpen")}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground/75">
          🛡️ {browser.i18n.getMessage("autoBackupReassurance")}
        </p>
      </div>

      {trashedProfiles.length > 0 && (
        <div className="shrink-0 rounded-lg border border-border/70 bg-card/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              {browser.i18n.getMessage("trashSectionTitle")} (
              {trashedProfiles.length})
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              aria-expanded={showTrash}
              onClick={() => setShowTrash((v) => !v)}
            >
              {showTrash
                ? browser.i18n.getMessage("trashHide")
                : browser.i18n.getMessage("trashShow")}
            </Button>
          </div>
          {showTrash && (
            <ScrollArea className="mt-2 [&>[data-slot=scroll-area-viewport]]:max-h-28">
              <ul className="flex flex-col gap-1.5 pr-2.5">
                {trashedProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                      {p.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {siteName(p.origin)}
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        disabled={profileBusy || !onRestoreTrashed}
                        onClick={() => onRestoreTrashed?.(p.id)}
                      >
                        <IconRefresh data-icon="inline-start" />
                        {browser.i18n.getMessage("trashRestore")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        disabled={profileBusy || !onDeleteTrashedForever}
                        title={browser.i18n.getMessage("trashDeleteForever")}
                        onClick={() =>
                          setDeleteConfirmation({ id: p.id, forever: true })
                        }
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      )}

      <Dialog
        open={renamingProfile !== null}
        onOpenChange={(open) => !open && setRenamingProfile(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-1.5rem)] max-w-[360px] p-5"
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {browser.i18n.getMessage("renameTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {browser.i18n.getMessage("renameDescription")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void renameForm.handleSubmit()
            }}
            className="flex flex-col gap-3 pt-2"
          >
            <renameForm.Field name="name">
              {(field) => (
                <Field
                  data-invalid={
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  }
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    aria-label={browser.i18n.getMessage(
                      "profileNamePlaceholder"
                    )}
                    className="h-9 text-xs"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    autoFocus
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </renameForm.Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRenamingProfile(null)}
              >
                {browser.i18n.getMessage("cancel")}
              </Button>
              <renameForm.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={profileBusy || !canSubmit || isSubmitting}
                  >
                    {browser.i18n.getMessage("renameSave")}
                  </Button>
                )}
              </renameForm.Subscribe>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmDeleteAllOpen}
        onOpenChange={setConfirmDeleteAllOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("deleteAllOtherSites")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage("deleteAllOtherSitesConfirm", [
                String(otherProfiles.length),
              ])}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={profileBusy || otherProfiles.length === 0}
              onClick={() => {
                setConfirmDeleteAllOpen(false)
                onDeleteAllOther?.()
              }}
            >
              {browser.i18n.getMessage("deleteAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={profilePendingDelete != null}
        onOpenChange={(open) => !open && setDeleteConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage(
                deleteForever ? "trashDeleteForeverTitle" : "profileDelete"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {profilePendingDelete &&
                browser.i18n.getMessage(
                  deleteForever
                    ? "trashDeleteForeverBody"
                    : "profileDeleteConfirm",
                  [profilePendingDelete.name]
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={profileBusy}
              onClick={() => {
                if (profileBusy || !profilePendingDelete) return
                setDeleteConfirmation(null)
                if (deleteForever) {
                  onDeleteTrashedForever?.(profilePendingDelete.id)
                } else {
                  onDelete(profilePendingDelete.id)
                }
              }}
            >
              {browser.i18n.getMessage(
                deleteForever ? "trashDeleteForever" : "profileDelete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}