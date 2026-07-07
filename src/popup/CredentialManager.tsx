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
import { isSupportedWebUrl } from "@/lib/page-credentials"
import type { AppLayout } from "@/popup/AppShell"
import { FirstRun } from "@/popup/components/FirstRun"
import { LoginDashboard } from "@/popup/components/LoginDashboard"
import { SettingsDialog } from "@/popup/components/SettingsDialog"
import { TransferDialog } from "@/popup/components/TransferDialog"
import { UiModeToggle } from "@/popup/components/UiModeToggle"
import { useCredentialManagerState } from "@/popup/credential-manager/useCredentialManagerState"

function defaultNameForOrigin(origin: string | null): string {
  if (!origin) return browser.i18n.getMessage("saveCurrentLabel")
  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}

export type CredentialManagerProps = {
  layout?: AppLayout
}

export function CredentialManager({
  layout = "popup",
}: CredentialManagerProps) {
  const s = useCredentialManagerState()
  const [transferOpen, setTransferOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [seenWelcome, setSeenWelcome] = useState<boolean | null>(null)

  useEffect(() => {
    void storage.getItem<boolean>("local:seenWelcome").then((v) => {
      setSeenWelcome(v === true)
    })
  }, [])

  const finishWelcome = () => {
    setSeenWelcome(true)
    void storage.setItem("local:seenWelcome", true)
  }

  if (s.loading || seenWelcome === null) {
    return null
  }

  const isSidepanel = layout === "sidepanel"
  const showFirstRun = !seenWelcome

  const saveCurrentNamed = (name?: string) => {
    finishWelcome()
    const finalName = name?.trim() || defaultNameForOrigin(s.origin)
    void s.saveCurrentAsProfile(finalName)
  }

  return (
    <div
      className={
        isSidepanel
          ? "flex min-h-screen w-full flex-col gap-3 overflow-hidden p-4"
          : "flex max-h-[680px] w-[480px] flex-col gap-3 overflow-hidden p-4"
      }
    >
      <header className="shrink-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading font-semibold text-base tracking-tight">
              {browser.i18n.getMessage("heading")}
            </h1>
            {s.tabUrl && isSupportedWebUrl(s.tabUrl) && (
              <p className="break-all text-muted-foreground text-xs leading-snug">
                {browser.i18n.getMessage("currentSite", s.tabUrl)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={browser.i18n.getMessage("advancedOpen")}
              onClick={() => setSettingsOpen(true)}
            >
              <IconSettings className="size-3.5" />
            </Button>
            <UiModeToggle />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {browser.i18n.getMessage("localFirstBadge")}
          </Badge>
        </div>
      </header>

      {s.error && (
        <Alert
          variant="destructive"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2"
        >
          <AlertDescription className="text-[11px]">{s.error}</AlertDescription>
        </Alert>
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
          profileBusy={s.profileBusy}
          onSaveCurrent={saveCurrentNamed}
          onRestore={(id) => void s.restoreProfile(id)}
          onTrash={(id) => void s.trashProfileById(id)}
          onOpenTransfer={() => setTransferOpen(true)}
        />
      )}

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tabUrl={s.tabUrl}
        tabId={s.tabId}
        encryptExport={s.encryptExport}
        setEncryptExport={s.setEncryptExport}
        exportPass={s.exportPass}
        setExportPass={s.setExportPass}
        exportPass2={s.exportPass2}
        setExportPass2={s.setExportPass2}
        cryptoBusy={s.cryptoBusy}
        onExport={() => void s.exportJson()}
        fileInputRef={s.fileInputRef}
        importEnvelope={s.importEnvelope}
        importPayload={s.importPayload}
        importDecryptPass={s.importDecryptPass}
        setImportDecryptPass={s.setImportDecryptPass}
        importBusy={s.importBusy}
        originMismatch={s.originMismatch}
        origin={s.origin}
        onPickFile={(f) => void s.onPickImportFile(f)}
        onDecrypt={() => void s.decryptAndLoadImport()}
        onApply={() => s.setConfirmOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tabUrl={s.tabUrl}
        reloadHint={browser.i18n.getMessage("advancedReloadHint")}
        onCopyJson={() => void s.copyExportJson()}
      />

      <AlertDialog open={s.confirmOpen} onOpenChange={s.setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {browser.i18n.getMessage("confirmImportTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {browser.i18n.getMessage("confirmImportBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {browser.i18n.getMessage("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void s.runImport()}>
              {browser.i18n.getMessage("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}