import { IconDownload, IconUpload } from "@tabler/icons-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isSupportedWebUrl } from "@/lib/page-credentials"
import { ExportTab } from "@/popup/credential-manager/ExportTab"
import { ImportTab } from "@/popup/credential-manager/ImportTab"
import { useCredentialManagerState } from "@/popup/credential-manager/useCredentialManagerState"

export function CredentialManager() {
  const s = useCredentialManagerState()

  if (s.loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-4 text-muted-foreground">
        {browser.i18n.getMessage("loading")}
      </div>
    )
  }

  return (
    <div className="flex max-h-[900px] w-[460px] flex-col gap-2 overflow-hidden p-3">
      <header className="shrink-0 space-y-0.5">
        <h1 className="font-heading font-semibold text-base tracking-tight">
          {browser.i18n.getMessage("heading")}
        </h1>
        {s.tabUrl && isSupportedWebUrl(s.tabUrl) && (
          <p className="break-all text-[11px] text-muted-foreground leading-snug">
            {browser.i18n.getMessage("currentSite", s.tabUrl)}
          </p>
        )}
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
        defaultValue="export"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
      >
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-stretch gap-0"
        >
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
          value="export"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden data-[state=inactive]:hidden"
        >
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
          />
        </TabsContent>

        <TabsContent
          value="import"
          className="mt-0 flex flex-col gap-2 overflow-hidden data-[state=inactive]:hidden"
        >
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
            originMismatch={s.originMismatch}
            origin={s.origin}
            onPickFile={s.onPickImportFile}
            onDecrypt={s.decryptAndLoadImport}
            onRequestApply={() => s.setConfirmOpen(true)}
          />
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