import { IconDeviceFloppy, IconDownload, IconUpload } from "@tabler/icons-react"
import { lazy, Suspense, useEffect, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isSupportedWebUrl } from "@/lib/page-credentials"
import type { AppLayout } from "@/popup/AppShell"
import { PopupLoadingSkeleton } from "@/popup/components/PopupLoadingSkeleton"
import { UiModeToggle } from "@/popup/components/UiModeToggle"
import { useCredentialManagerState } from "@/popup/credential-manager/useCredentialManagerState"

const ExportTab = lazy(() =>
  import("@/popup/credential-manager/ExportTab").then((m) => ({
    default: m.ExportTab,
  }))
)
const ImportTab = lazy(() =>
  import("@/popup/credential-manager/ImportTab").then((m) => ({
    default: m.ImportTab,
  }))
)
const ProfilesTab = lazy(() =>
  import("@/popup/credential-manager/ProfilesTab").then((m) => ({
    default: m.ProfilesTab,
  }))
)

function TabFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center text-muted-foreground text-xs">
      {browser.i18n.getMessage("loading")}
    </div>
  )
}

export type CredentialManagerProps = {
  layout?: AppLayout
}

export function CredentialManager({
  layout = "popup",
}: CredentialManagerProps) {
  const s = useCredentialManagerState()
  const [activeTab, setActiveTab] = useState(
    s.initialTab ?? (s.profiles.length > 0 ? "profiles" : "export")
  )

  useEffect(() => {
    if (s.initialTab) setActiveTab(s.initialTab)
  }, [s.initialTab])

  if (s.loading) {
    return <PopupLoadingSkeleton layout={layout} />
  }

  const isSidepanel = layout === "sidepanel"

  return (
    <div
      className={
        isSidepanel
          ? "flex min-h-screen w-full flex-col gap-2 overflow-hidden p-3"
          : "flex max-h-[900px] w-[460px] flex-col gap-2 overflow-hidden p-3"
      }
    >
      <header className="shrink-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h1 className="font-heading font-semibold text-base tracking-tight">
              {browser.i18n.getMessage("heading")}
            </h1>
            {s.tabUrl && isSupportedWebUrl(s.tabUrl) && (
              <p className="break-all text-[11px] text-muted-foreground leading-snug">
                {browser.i18n.getMessage("currentSite", s.tabUrl)}
              </p>
            )}
          </div>
          <UiModeToggle />
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

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
      >
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-stretch gap-0"
        >
          <TabsTrigger value="profiles" className="flex-1 gap-1">
            <IconDeviceFloppy className="size-3.5 opacity-70" />
            {browser.i18n.getMessage("tabProfiles")}
            {s.profiles.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[9px]"
              >
                {s.profiles.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="export" className="flex-1 gap-1">
            <IconDownload className="size-3.5 opacity-70" />
            {browser.i18n.getMessage("tabExport")}
          </TabsTrigger>
          <TabsTrigger value="import" className="flex-1 gap-1">
            <IconUpload className="size-3.5 opacity-70" />
            {browser.i18n.getMessage("tabImport")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="profiles"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden data-[state=inactive]:hidden"
        >
          <Suspense fallback={<TabFallback />}>
            <ProfilesTab
              tabUrl={s.tabUrl}
              tabId={s.tabId}
              profiles={s.profiles}
              trashedProfiles={s.trashedProfiles}
              profileBusy={s.profileBusy}
              onSave={s.saveCurrentAsProfile}
              onRestore={s.restoreProfile}
              onTrash={s.trashProfileById}
              onRestoreTrash={s.restoreTrashedProfileById}
              onDeleteTrash={s.permanentlyDeleteTrashedProfileById}
              onRename={s.renameProfileById}
              onExportAll={s.exportAllProfiles}
            />
          </Suspense>
        </TabsContent>

        <TabsContent
          value="export"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden data-[state=inactive]:hidden"
        >
          <Suspense fallback={<TabFallback />}>
            <ExportTab
              tabUrl={s.tabUrl}
              filter={s.filter}
              setFilter={s.setFilter}
              onRefresh={s.refresh}
              cookies={s.cookies}
              lsEntries={s.lsEntries}
              ssEntries={s.ssEntries}
              filteredCookies={s.filteredCookies}
              filteredLsKeys={s.filteredLsKeys}
              filteredSsKeys={s.filteredSsKeys}
              filteredIdbRows={s.filteredIdbRows}
              idbRows={s.idbRows}
              selected={s.selected}
              toggleId={s.toggleId}
              selectAllIn={s.selectAllIn}
              encryptExport={s.encryptExport}
              setEncryptExport={s.setEncryptExport}
              exportPass={s.exportPass}
              setExportPass={s.setExportPass}
              exportPass2={s.exportPass2}
              setExportPass2={s.setExportPass2}
              onExport={s.exportJson}
              onCopyJson={s.copyExportJson}
              onSaveAsProfile={s.saveCurrentAsProfile}
              profileBusy={s.profileBusy}
              cryptoBusy={s.cryptoBusy}
            />
          </Suspense>
        </TabsContent>

        <TabsContent
          value="import"
          className="mt-0 flex flex-col gap-2 overflow-hidden data-[state=inactive]:hidden"
        >
          <Suspense fallback={<TabFallback />}>
            <ImportTab
              fileInputRef={s.fileInputRef}
              tabUrl={s.tabUrl}
              tabId={s.tabId}
              importEnvelope={s.importEnvelope}
              importPayload={s.importPayload}
              importDecryptPass={s.importDecryptPass}
              setImportDecryptPass={s.setImportDecryptPass}
              importSelected={s.importSelected}
              setImportSelected={s.setImportSelected}
              importBusy={s.importBusy}
              cryptoBusy={s.cryptoBusy}
              importFilter={s.importFilter}
              setImportFilter={s.setImportFilter}
              filteredCookies={s.importFilteredCookies}
              filteredLsKeys={s.importFilteredLsKeys}
              filteredSsKeys={s.importFilteredSsKeys}
              filteredIdbRows={s.importFilteredIdbRows}
              idbRows={s.importIdbRows}
              originMismatch={s.originMismatch}
              origin={s.origin}
              onPickFile={s.onPickImportFile}
              onDecrypt={s.decryptAndLoadImport}
              onRequestApply={() => s.setConfirmOpen(true)}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

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