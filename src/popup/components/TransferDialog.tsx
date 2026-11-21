import {
  IconDownload,
  IconLock,
  IconShieldCheck,
  IconSwitchHorizontal,
  IconUpload,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  onExport: (password?: string) => Promise<void>
  cryptoBusy: boolean

  // Import (restore from file)
  fileInputRef: React.RefObject<HTMLInputElement | null>
  importEnvelope: IdentitiEncryptedEnvelope | null
  importPayload: CredentialExportFile | null
  importBusy: boolean
  originMismatch: boolean
  origin: string | null
  onPickFile: (f: File | null) => void | Promise<void>
  onDecrypt: (password: string) => void | Promise<void>
  onApply: () => void
}

// The schemas are built lazily: `browser.i18n` is only available inside the
// extension runtime, not when this module is imported elsewhere.
function passwordSchema() {
  return z
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
}

function decryptSchema() {
  return z.object({
    decryptPass: z.string().min(1, {
      message: browser.i18n.getMessage("importPassword"),
    }),
  })
}

export function TransferDialog({
  open,
  onOpenChange,
  tabUrl,
  tabId,
  cryptoBusy,
  onExport,
  fileInputRef,
  importEnvelope,
  importPayload,
  importBusy,
  originMismatch,
  origin,
  onPickFile,
  onDecrypt,
  onApply,
}: TransferDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("export")
  const [encryptExport, setEncryptExport] = useState(false)

  useEffect(() => {
    if (importEnvelope || importPayload) {
      setActiveTab("import")
    }
  }, [importEnvelope, importPayload])

  const form = useForm({
    defaultValues: { exportPass: "", exportPass2: "" },
    validators: { onChange: passwordSchema(), onSubmit: passwordSchema() },
    onSubmit: async ({ value }) => {
      await onExport(value.exportPass)
      form.reset()
    },
  })

  const decryptForm = useForm({
    defaultValues: { decryptPass: "" },
    validators: { onChange: decryptSchema(), onSubmit: decryptSchema() },
    onSubmit: async ({ value }) => {
      await onDecrypt(value.decryptPass)
    },
  })

  useEffect(() => {
    decryptForm.reset()
  }, [decryptForm])

  useEffect(() => {
    if (!open) form.reset()
  }, [form, open])

  const canExport = isSupportedWebUrl(tabUrl) && tabId != null
  const showDecrypt = Boolean(importEnvelope && !importPayload)
  const showApply = Boolean(importPayload)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[500px] w-[calc(100%-1.5rem)] max-w-[390px] flex-col overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <IconSwitchHorizontal className="size-4 opacity-70" />
            {browser.i18n.getMessage("transferTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {browser.i18n.getMessage("transferIntro")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="shrink-0 px-4 pb-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export" className="gap-1.5 text-xs">
                <IconDownload className="size-3.5" />
                {browser.i18n.getMessage("transferExportFile")}
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-1.5 text-xs">
                <IconUpload className="size-3.5" />
                {browser.i18n.getMessage("transferImportFile")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <TabsContent
              value="export"
              className="mt-0 flex flex-col gap-3"
              render={
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!canExport || cryptoBusy || importBusy) return
                    if (encryptExport) void form.handleSubmit()
                    else void onExport()
                  }}
                />
              }
            >
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">
                  {browser.i18n.getMessage("transferExportFile")}
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {browser.i18n.getMessage("transferExportIncludesIdb")}
                </p>
              </div>

              <label
                htmlFor="transfer-encrypt"
                className="flex cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <input
                  id="transfer-encrypt"
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={encryptExport}
                  disabled={!canExport || importBusy || cryptoBusy}
                  onChange={(event) => {
                    setEncryptExport(event.target.checked)
                    if (!event.target.checked) form.reset()
                  }}
                />
                <IconLock className="size-3.5 opacity-70" />
                {browser.i18n.getMessage("transferProtectPass")}
              </label>

              {encryptExport && (
                <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3">
                  <form.Field name="exportPass">
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-[11px]"
                        >
                          {browser.i18n.getMessage("exportPassword")}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          className="h-8 text-xs"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-[11px]"
                        >
                          {browser.i18n.getMessage("exportPasswordConfirm")}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          className="h-8 text-xs"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="new-password"
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {browser.i18n.getMessage("transferProtectHelp")}
                  </p>
                </div>
              )}

              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 w-full gap-2 text-xs font-medium"
                    disabled={
                      !canExport ||
                      cryptoBusy ||
                      importBusy ||
                      isSubmitting ||
                      (encryptExport && !canSubmit)
                    }
                  >
                    <IconDownload className="size-4" />
                    {cryptoBusy
                      ? browser.i18n.getMessage("encrypting")
                      : browser.i18n.getMessage("transferExportFile")}
                  </Button>
                )}
              </form.Subscribe>

              {!encryptExport && canExport && (
                <Alert>
                  <AlertDescription>
                    {browser.i18n.getMessage("transferPlaintextWarning")}
                  </AlertDescription>
                </Alert>
              )}
              {!canExport && (
                <p className="text-[11px] text-muted-foreground">
                  {browser.i18n.getMessage("restrictedPage")}
                </p>
              )}
            </TabsContent>

            <TabsContent value="import" className="mt-0 flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                disabled={importBusy || cryptoBusy}
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
                className="h-9 w-full gap-2 text-xs font-medium"
                disabled={importBusy || cryptoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload className="size-4" />
                {browser.i18n.getMessage("transferPickFile")}
              </Button>

              {showDecrypt && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void decryptForm.handleSubmit()
                  }}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/50 p-3"
                >
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {browser.i18n.getMessage("encryptedFileHelp")}
                  </p>
                  <decryptForm.Field name="decryptPass">
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-[11px]"
                        >
                          {browser.i18n.getMessage("importPassword")}
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          className="h-8 text-xs"
                          placeholder={browser.i18n.getMessage(
                            "importPassword"
                          )}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="current-password"
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </decryptForm.Field>
                  <decryptForm.Subscribe
                    selector={(s) => [s.canSubmit, s.isSubmitting]}
                  >
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 w-full text-xs font-medium"
                        disabled={
                          !canSubmit || isSubmitting || importBusy || cryptoBusy
                        }
                      >
                        {cryptoBusy
                          ? browser.i18n.getMessage("decrypting")
                          : browser.i18n.getMessage("decryptImport")}
                      </Button>
                    )}
                  </decryptForm.Subscribe>
                </form>
              )}

              {showApply && (
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
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
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      {browser.i18n.getMessage("backupWebsite")}
                    </p>
                    <p className="font-mono text-xs break-all text-foreground">
                      {importPayload?.origin}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 w-full gap-2 text-xs font-medium"
                    disabled={
                      importBusy ||
                      originMismatch ||
                      !isSupportedWebUrl(tabUrl) ||
                      tabId == null
                    }
                    onClick={onApply}
                  >
                    <IconShieldCheck className="size-4" />
                    {browser.i18n.getMessage("transferApply")}
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex shrink-0 justify-end border-t px-4 py-2">
          <DialogClose render={<Button variant="outline" size="sm" />}>
            {browser.i18n.getMessage("close")}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}