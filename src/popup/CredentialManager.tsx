import { IconSettings } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { storage } from "wxt/utils/storage"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { EXPORT_SCHEMA_VERSION } from "@/lib/page-credentials"
import { FirstRun } from "@/popup/components/FirstRun"
import { LoginDashboard } from "@/popup/components/LoginDashboard"
import { PopupLoadingSkeleton } from "@/popup/components/PopupLoadingSkeleton"
import { SettingsDialog } from "@/popup/components/SettingsDialog"
import { TransferDialog } from "@/popup/components/TransferDialog"
import { useCredentialManagerState } from "@/popup/credential-manager/useCredentialManagerState"

function defaultNameForOrigin(origin: string | null): string {
  if (!origin) return browser.i18n.getMessage("saveCurrentLabel")
  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}

export function CredentialManager() {
  const s = useCredentialManagerState()
  const [transferOpen, setTransferOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newLoginOpen, setNewLoginOpen] = useState(false)
  const [seenWelcome, setSeenWelcome] = useState<boolean | null>(null)

  useEffect(() => {
    void storage
      .getItem<boolean>("local:seenWelcome")
      .then((v) => {
        setSeenWelcome(v === true)
      })
      .catch(() => {
        setSeenWelcome(false)
      })
  }, [])

  const finishWelcome = () => {
    if (seenWelcome) return
    setSeenWelcome(true)
    void storage.setItem("local:seenWelcome", true).catch(() => {})
  }

  if (s.loading || seenWelcome === null) {
    return <PopupLoadingSkeleton />
  }

  const showFirstRun = !seenWelcome

  const saveCurrentNamed = (name?: string) => {
    finishWelcome()
    const finalName = name?.trim() || defaultNameForOrigin(s.origin)
    void s.saveCurrentAsProfile(finalName)
  }

  return (
    <div className="flex h-[580px] max-h-[580px] w-[420px] flex-col gap-3 overflow-hidden p-4">
      <header className="shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-base font-semibold tracking-tight">
                {browser.i18n.getMessage("heading")}
              </h1>
              <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                {browser.i18n.getMessage("localFirstBadge")}
              </Badge>
            </div>
            {s.origin && (
              <p className="text-xs leading-relaxed break-all text-muted-foreground">
                {browser.i18n.getMessage("currentSite", s.origin)}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 shrink-0"
            title={browser.i18n.getMessage("advancedOpen")}
            aria-label={browser.i18n.getMessage("advancedOpen")}
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings className="size-4" />
          </Button>
        </div>
      </header>

      {s.error && (
        <Alert
          variant="destructive"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
        >
          <AlertDescription className="text-xs leading-relaxed">
            {s.error}
          </AlertDescription>
        </Alert>
      )}

      {s.siteBusy && (
        <p role="status" className="shrink-0 text-xs text-muted-foreground">
          {browser.i18n.getMessage("siteWorking")}
        </p>
      )}

      {showFirstRun ? (
        <FirstRun
          className="min-h-0 flex-1"
          onSave={saveCurrentNamed}
          onTransfer={() => {
            finishWelcome()
            setTransferOpen(true)
          }}
        />
      ) : (
        <LoginDashboard
          tabUrl={s.tabUrl}
          tabId={s.tabId}
          profiles={s.profiles}
          allProfiles={s.allProfiles}
          trashedProfiles={s.trashedProfiles}
          activeProfileId={s.activeProfileId}
          profileBusy={s.profileBusy}
          canUndoRestore={s.canUndoRestore}
          onSaveCurrent={saveCurrentNamed}
          onRestore={(id) => void s.restoreProfile(id)}
          onRename={(id, newName) => void s.renameProfileById(id, newName)}
          onDelete={(id) => void s.deleteProfileById(id)}
          onDeleteAllOther={() => void s.deleteAllOtherProfiles()}
          onRestoreTrashed={(id) => void s.restoreTrashedProfileById(id)}
          onDeleteTrashedForever={(id) =>
            void s.deleteTrashedProfileForever(id)
          }
          onPrepareNewLogin={() => setNewLoginOpen(true)}
          onUndoRestore={() => void s.undoLastRestore()}
          onOpenTransfer={() => setTransferOpen(true)}
        />
      )}

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tabUrl={s.tabUrl}
        tabId={s.tabId}
        cryptoBusy={s.cryptoBusy}
        onExport={s.exportJson}
        fileInputRef={s.fileInputRef}
        importEnvelope={s.importEnvelope}
        importPayload={s.importPayload}
        importBusy={s.importBusy}
        originMismatch={s.originMismatch}
        origin={s.origin}
        onPickFile={(f) => void s.onPickImportFile(f)}
        onDecrypt={s.decryptAndLoadImport}
        onApply={() => {
          setTransferOpen(false)
          s.setConfirmOpen(true)
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tabUrl={s.tabUrl}
        reloadHint={browser.i18n.getMessage("advancedReloadHint")}
        onCopyJson={() => void s.copyExportJson()}
        onExportAllProfiles={() => void s.exportAllProfiles()}
        exportAllBusy={s.profileBusy}
      />

      <AlertDialog open={s.confirmOpen} onOpenChange={s.setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("confirmImportTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage(
                s.importPayload?.identitiVersion === EXPORT_SCHEMA_VERSION
                  ? "confirmImportBody"
                  : "confirmLegacyImportBody"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={s.importBusy}
              onClick={() => void s.runImport()}
            >
              {browser.i18n.getMessage("transferApply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={newLoginOpen} onOpenChange={setNewLoginOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("prepareNewLogin")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage("prepareNewLoginConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={s.profileBusy}
              onClick={() => {
                setNewLoginOpen(false)
                void s.prepareNewLogin()
              }}
            >
              {browser.i18n.getMessage("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}