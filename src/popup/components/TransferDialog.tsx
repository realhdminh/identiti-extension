import {
  IconDownload,
  IconLock,
  IconShieldCheck,
  IconUpload,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { IdentitiEncryptedEnvelope } from "@/lib/export-crypto"
import {
  type CredentialExportFile,
  isSupportedWebUrl,
} from "@/lib/page-credentials"

export type TransferDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Export (create backup file from current tab)
  tabUrl: string | undefined
  tabId: number | undefined
  encryptExport: boolean
  setEncryptExport: (v: boolean) => void
  exportPass: string
  setExportPass: (v: string) => void
  exportPass2: string
  setExportPass2: (v: string) => void
  cryptoBusy: boolean
  onExport: () => void | Promise<void>

  // Import (restore from file)
  fileInputRef: React.RefObject<HTMLInputElement | null>
  importEnvelope: IdentitiEncryptedEnvelope | null
  importPayload: CredentialExportFile | null
  importDecryptPass: string
  setImportDecryptPass: (v: string) => void
  importBusy: boolean
  originMismatch: boolean
  origin: string | null
  onPickFile: (f: File | null) => void | Promise<void>
  onDecrypt: () => void | Promise<void>
  onApply: () => void
}

const passwordSchema = z
  .object({
    exportPass: z.string().min(1, {
      message: browser.i18n.getMessage("exportPassword"),
    }),
    exportPass2: z.string().min(1, {
      message: browser.i18n.getMessage("exportPasswordConfirm"),
    }),
  })
  .refine((v) => v.exportPass === v.exportPass2, {
    path: ["exportPass2"],
    message: browser.i18n.getMessage("passwordMismatch"),
  })

export function TransferDialog({
  open,
  onOpenChange,
  tabUrl,
  tabId,
  encryptExport,
  setEncryptExport,
  exportPass,
  setExportPass,
  exportPass2,
  setExportPass2,
  cryptoBusy,
  onExport,
  fileInputRef,
  importEnvelope,
  importPayload,
  importDecryptPass,
  setImportDecryptPass,
  importBusy,
  originMismatch,
  origin,
  onPickFile,
  onDecrypt,
  onApply,
}: TransferDialogProps) {
  const form = useForm({
    defaultValues: { exportPass, exportPass2 },
    validators: { onChange: passwordSchema, onSubmit: passwordSchema },
    onSubmit: async () => {
      await onExport()
    },
  })

  const canExport = isSupportedWebUrl(tabUrl) && tabId != null
  const showDecrypt = Boolean(importEnvelope && !importPayload)
  const showApply = Boolean(importPayload)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <IconUpload className="size-3.5 opacity-50" />
            {browser.i18n.getMessage("transferTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {browser.i18n.getMessage("transferIntro")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 pb-5">
          <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-card/50 p-3">
            <p className="font-medium text-xs">
              {browser.i18n.getMessage("transferExportFile")}
            </p>
            <label
              htmlFor="transfer-encrypt"
              className="flex cursor-pointer items-center gap-2 text-xs"
            >
              <input
                id="transfer-encrypt"
                type="checkbox"
                className="size-4 accent-primary"
                checked={encryptExport}
                disabled={!canExport}
                onChange={(e) => setEncryptExport(e.target.checked)}
              />
              <IconLock className="size-3.5 opacity-60" />
              {browser.i18n.getMessage("transferProtectPass")}
            </label>
            {encryptExport && (
              <div className="flex flex-col gap-2">
                <form.Field name="exportPass">
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name} className="text-[11px]">
                        {browser.i18n.getMessage("exportPassword")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="password"
                        className="h-9 text-xs"
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value)
                          setExportPass(e.target.value)
                        }}
                        autoComplete="new-password"
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="exportPass2">
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name} className="text-[11px]">
                        {browser.i18n.getMessage("exportPasswordConfirm")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="password"
                        className="h-9 text-xs"
                        value={field.state.value}
                        onChange={(e) => {
                          field.handleChange(e.target.value)
                          setExportPass2(e.target.value)
                        }}
                        autoComplete="new-password"
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {browser.i18n.getMessage("transferProtectHelp")}
                </p>
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full gap-1.5"
              disabled={
                !canExport || cryptoBusy || (encryptExport && !exportPass)
              }
              onClick={() => {
                if (encryptExport) void form.handleSubmit()
                else void onExport()
              }}
            >
              <IconDownload className="size-3.5" />
              {cryptoBusy
                ? browser.i18n.getMessage("encrypting")
                : browser.i18n.getMessage("transferExportFile")}
            </Button>
            {!canExport && (
              <p className="text-[11px] text-muted-foreground">
                {browser.i18n.getMessage("restrictedPage")}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-card/50 p-3">
            <p className="font-medium text-xs">
              {browser.i18n.getMessage("transferImportFile")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickFile(f)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload className="size-3.5" />
              {browser.i18n.getMessage("transferPickFile")}
            </Button>

            {showDecrypt && (
              <div className="flex flex-col gap-2.5 border-border border-t pt-3">
                <p className="text-[11px] text-muted-foreground">
                  {browser.i18n.getMessage("encryptedFileHelp")}
                </p>
                <Input
                  type="password"
                  className="h-9 text-xs"
                  placeholder={browser.i18n.getMessage("importPassword")}
                  value={importDecryptPass}
                  onChange={(e) => setImportDecryptPass(e.target.value)}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={importBusy || cryptoBusy || !importDecryptPass}
                  onClick={() => void onDecrypt()}
                >
                  {cryptoBusy
                    ? browser.i18n.getMessage("decrypting")
                    : browser.i18n.getMessage("decryptImport")}
                </Button>
              </div>
            )}

            {showApply && (
              <div className="flex flex-col gap-2.5 border-border border-t pt-3">
                {originMismatch && (
                  <Alert variant="destructive">
                    <AlertTitle className="text-xs">
                      {browser.i18n.getMessage("transferWrongSiteTitle")}
                    </AlertTitle>
                    <AlertDescription className="text-[11px]">
                      {browser.i18n.getMessage("transferWrongSiteBody", [
                        importPayload?.origin ?? "",
                        origin ?? browser.i18n.getMessage("originUnknown"),
                      ])}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="break-all text-[11px] text-muted-foreground">
                  {importPayload?.origin}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={
                    importBusy || !isSupportedWebUrl(tabUrl) || tabId == null
                  }
                  onClick={onApply}
                >
                  <IconShieldCheck className="size-3.5" />
                  {browser.i18n.getMessage("transferApply")}
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}