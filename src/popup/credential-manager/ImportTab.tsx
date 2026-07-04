import {
  IconCookie,
  IconDatabase,
  IconLayersSubtract,
  IconUpload,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import type { Dispatch, RefObject, SetStateAction } from "react"
import { useState } from "react"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { IdentitiEncryptedEnvelope } from "@/lib/export-crypto"
import {
  type CredentialExportFile,
  cookieRowId,
  isSupportedWebUrl,
} from "@/lib/page-credentials"
import { VirtualizedList } from "@/popup/components/VirtualizedList"
import { truncate } from "@/popup/lib/format"
import { lsKeyId, ssKeyId } from "@/popup/lib/selection-ids"
import { StorageKeyListCard } from "./StorageKeyListCard"

const decryptPasswordSchema = z.object({
  importDecryptPass: z.string().min(1, {
    message: browser.i18n.getMessage("importPassword"),
  }),
})

export type ImportTabProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  tabUrl: string | undefined
  tabId: number | undefined
  importEnvelope: IdentitiEncryptedEnvelope | null
  importPayload: CredentialExportFile | null
  importDecryptPass: string
  setImportDecryptPass: (v: string) => void
  importSelected: Set<string>
  setImportSelected: Dispatch<SetStateAction<Set<string>>>
  importBusy: boolean
  cryptoBusy: boolean
  importFilter: string
  setImportFilter: (v: string) => void
  filteredCookies: CredentialExportFile["cookies"]
  filteredLsKeys: string[]
  filteredSsKeys: string[]
  filteredIdbRows: {
    id: string
    database: string
    store: string
    key: unknown
    preview: string
  }[]
  idbRows: { id: string }[]
  originMismatch: boolean
  origin: string | null
  onPickFile: (f: File | null) => void | Promise<void>
  onDecrypt: () => void | Promise<void>
  onRequestApply: () => void
}

export function ImportTab({
  fileInputRef,
  tabUrl,
  tabId,
  importEnvelope,
  importPayload,
  importDecryptPass,
  setImportDecryptPass,
  importSelected,
  setImportSelected,
  importBusy,
  cryptoBusy,
  importFilter,
  setImportFilter,
  filteredCookies,
  filteredLsKeys,
  filteredSsKeys,
  filteredIdbRows,
  idbRows,
  originMismatch,
  origin,
  onPickFile,
  onDecrypt,
  onRequestApply,
}: ImportTabProps) {
  const toggleImport = (id: string, on: boolean) => {
    setImportSelected((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }

  const selectAllImportIn = (ids: string[], on: boolean) => {
    setImportSelected((prev) => {
      const n = new Set(prev)
      for (const id of ids) {
        if (on) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }

  const [cookiesDetailsOpen, setCookiesDetailsOpen] = useState(false)
  const [idbDetailsOpen, setIdbDetailsOpen] = useState(false)

  const decryptForm = useForm({
    defaultValues: { importDecryptPass },
    validators: {
      onChange: decryptPasswordSchema,
      onSubmit: decryptPasswordSchema,
    },
    onSubmit: async () => {
      await onDecrypt()
    },
  })

  return (
    <>
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
        className="w-full gap-1.5"
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload className="size-3.5" />
        {browser.i18n.getMessage("importPickFile")}
      </Button>

      {importEnvelope && !importPayload && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-2.5">
          <p className="text-[11px] text-muted-foreground">
            {browser.i18n.getMessage("encryptedFileHelp")}
          </p>
          <decryptForm.Field name="importDecryptPass">
            {(field) => {
              const inputId = field.name
              return (
                <Field
                  data-invalid={
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  }
                >
                  <FieldLabel htmlFor={inputId}>
                    {browser.i18n.getMessage("importPassword")}
                  </FieldLabel>
                  <Input
                    id={inputId}
                    type="password"
                    className="h-8 text-xs"
                    placeholder={browser.i18n.getMessage("importPassword")}
                    value={field.state.value}
                    onChange={(e) => {
                      const v = e.target.value
                      field.handleChange(v)
                      setImportDecryptPass(v)
                    }}
                    onBlur={field.handleBlur}
                    aria-invalid={
                      field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0
                    }
                    autoComplete="current-password"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </decryptForm.Field>
          <decryptForm.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="button"
                className="w-full"
                onClick={() => void decryptForm.handleSubmit()}
                disabled={
                  importBusy || cryptoBusy || isSubmitting || !canSubmit
                }
              >
                {cryptoBusy
                  ? browser.i18n.getMessage("decrypting")
                  : browser.i18n.getMessage("decryptImport")}
              </Button>
            )}
          </decryptForm.Subscribe>
        </div>
      )}

      {importPayload && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-2.5">
          {originMismatch && (
            <Alert variant="destructive">
              <AlertTitle className="text-[11px]">
                {browser.i18n.getMessage("originMismatchTitle")}
              </AlertTitle>
              <AlertDescription className="text-[10px]">
                {browser.i18n.getMessage("originMismatchBody", [
                  importPayload.origin,
                  origin ?? browser.i18n.getMessage("originUnknown"),
                ])}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">
              v{importPayload.identitiVersion}
            </Badge>
            <span className="break-all">{importPayload.origin}</span>
          </div>

          <Separator />

          <Input
            className="h-8 text-xs"
            placeholder={browser.i18n.getMessage("searchPlaceholder")}
            value={importFilter}
            onChange={(e) => setImportFilter(e.target.value)}
          />

          <div className="flex flex-col gap-2 pr-1">
            <Card size="sm" className="flex flex-col py-2">
              <CardHeader className="gap-1 pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={
                        importPayload.cookies.length > 0 &&
                        importPayload.cookies.every((c) =>
                          importSelected.has(cookieRowId(c))
                        )
                      }
                      disabled={importPayload.cookies.length === 0}
                      onCheckedChange={(v) =>
                        selectAllImportIn(
                          importPayload.cookies.map(cookieRowId),
                          v === true
                        )
                      }
                    />
                    <CardTitle className="flex items-center gap-1.5 text-xs">
                      <IconCookie className="size-3.5 opacity-50" />
                      {browser.i18n.getMessage("sectionCookies")}
                    </CardTitle>
                  </div>
                  <Dialog
                    open={cookiesDetailsOpen}
                    onOpenChange={setCookiesDetailsOpen}
                  >
                    <DialogTrigger
                      type="button"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "xs",
                      })}
                    >
                      {browser.i18n.getMessage("viewDetails")}
                    </DialogTrigger>
                    <DialogContent className="max-w-[460px] p-0">
                      <DialogHeader className="px-4 pt-4">
                        <DialogTitle className="flex items-center gap-1.5 text-sm">
                          <IconCookie className="size-3.5 opacity-50" />
                          {browser.i18n.getMessage("sectionCookies")}
                        </DialogTitle>
                        <DialogDescription>
                          {filteredCookies.length === 0
                            ? browser.i18n.getMessage("emptyCookies")
                            : browser.i18n.getMessage("countItems", [
                                String(filteredCookies.length),
                              ])}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="px-4 pt-3 pb-4">
                        {filteredCookies.length > 0 && (
                          <div className="flex gap-1 pb-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                selectAllImportIn(
                                  filteredCookies.map(cookieRowId),
                                  true
                                )
                              }
                            >
                              {browser.i18n.getMessage("selectAll")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                selectAllImportIn(
                                  filteredCookies.map(cookieRowId),
                                  false
                                )
                              }
                            >
                              {browser.i18n.getMessage("selectNone")}
                            </Button>
                          </div>
                        )}
                        {filteredCookies.length === 0 ? (
                          <div className="px-1 py-2 text-muted-foreground text-xs">
                            {browser.i18n.getMessage("emptyCookies")}
                          </div>
                        ) : (
                          <VirtualizedList
                            className="h-[360px] overflow-auto pr-2"
                            items={filteredCookies}
                            getKey={(c) => cookieRowId(c)}
                            renderItem={(c) => {
                              const id = cookieRowId(c)
                              const checkboxId = `im-${id}`
                              return (
                                <label
                                  htmlFor={checkboxId}
                                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 hover:bg-muted/60"
                                >
                                  <Checkbox
                                    id={checkboxId}
                                    checked={importSelected.has(id)}
                                    onCheckedChange={(v) =>
                                      toggleImport(id, v === true)
                                    }
                                  />
                                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="block break-all font-medium text-[12px] leading-tight">
                                      {browser.i18n.getMessage("cookieLabel", [
                                        c.name,
                                        c.domain,
                                      ])}
                                    </span>
                                    <span className="block break-all font-mono text-[10px] text-muted-foreground">
                                      {truncate(c.value, 64)}
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
                  {importPayload.cookies.length === 0
                    ? browser.i18n.getMessage("emptyCookies")
                    : browser.i18n.getMessage("countItems", [
                        String(importPayload.cookies.length),
                      ])}
                </CardDescription>
              </CardHeader>
            </Card>

            <StorageKeyListCard
              heading={browser.i18n.getMessage("sectionLocalStorage")}
              icon={<IconDatabase className="size-3.5 opacity-50" />}
              emptyMessage={browser.i18n.getMessage("emptyLocalStorage")}
              filteredKeys={filteredLsKeys}
              allKeys={Object.keys(importPayload.localStorage).sort((a, b) =>
                a.localeCompare(b)
              )}
              entries={importPayload.localStorage}
              idFn={lsKeyId}
              selected={importSelected}
              onToggle={toggleImport}
              onSelectAllIn={selectAllImportIn}
            />

            <StorageKeyListCard
              heading={browser.i18n.getMessage("sectionSessionStorage")}
              icon={<IconLayersSubtract className="size-3.5 opacity-50" />}
              emptyMessage={browser.i18n.getMessage("emptySessionStorage")}
              filteredKeys={filteredSsKeys}
              allKeys={Object.keys(importPayload.sessionStorage).sort((a, b) =>
                a.localeCompare(b)
              )}
              entries={importPayload.sessionStorage}
              idFn={ssKeyId}
              selected={importSelected}
              onToggle={toggleImport}
              onSelectAllIn={selectAllImportIn}
            />

            <Card size="sm" className="flex flex-col py-2">
              <CardHeader className="gap-1 pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={
                        idbRows.length > 0 &&
                        idbRows.every((r) => importSelected.has(r.id))
                      }
                      disabled={idbRows.length === 0}
                      onCheckedChange={(v) =>
                        selectAllImportIn(
                          idbRows.map((r) => r.id),
                          v === true
                        )
                      }
                    />
                    <CardTitle className="flex items-center gap-1.5 text-xs">
                      <IconDatabase className="size-3.5 opacity-50" />
                      {browser.i18n.getMessage("sectionIndexedDB")}
                    </CardTitle>
                  </div>
                  <Dialog
                    open={idbDetailsOpen}
                    onOpenChange={setIdbDetailsOpen}
                  >
                    <DialogTrigger
                      type="button"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "xs",
                      })}
                    >
                      {browser.i18n.getMessage("viewDetails")}
                    </DialogTrigger>
                    <DialogContent className="max-w-[460px] p-0">
                      <DialogHeader className="px-4 pt-4">
                        <DialogTitle className="flex items-center gap-1.5 text-sm">
                          <IconDatabase className="size-3.5 opacity-50" />
                          {browser.i18n.getMessage("sectionIndexedDB")}
                        </DialogTitle>
                        <DialogDescription>
                          {filteredIdbRows.length === 0
                            ? browser.i18n.getMessage("emptyIndexedDB")
                            : browser.i18n.getMessage("countItems", [
                                String(filteredIdbRows.length),
                              ])}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="px-4 pt-3 pb-4">
                        {filteredIdbRows.length > 0 && (
                          <div className="flex gap-1 pb-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                selectAllImportIn(
                                  filteredIdbRows.map((r) => r.id),
                                  true
                                )
                              }
                            >
                              {browser.i18n.getMessage("selectAll")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                selectAllImportIn(
                                  filteredIdbRows.map((r) => r.id),
                                  false
                                )
                              }
                            >
                              {browser.i18n.getMessage("selectNone")}
                            </Button>
                          </div>
                        )}
                        {filteredIdbRows.length === 0 ? (
                          <div className="px-1 py-2 text-muted-foreground text-xs">
                            {browser.i18n.getMessage("emptyIndexedDB")}
                          </div>
                        ) : (
                          <VirtualizedList
                            className="h-[360px] overflow-auto pr-2"
                            items={filteredIdbRows}
                            getKey={(r) => r.id}
                            renderItem={(r, idx) => (
                              <label
                                htmlFor={`im-idb-${idx}`}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 hover:bg-muted/60"
                              >
                                <Checkbox
                                  id={`im-idb-${idx}`}
                                  checked={importSelected.has(r.id)}
                                  onCheckedChange={(v) =>
                                    toggleImport(r.id, v === true)
                                  }
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="block font-medium text-[12px] leading-tight">
                                    {r.database} / {r.store}
                                  </span>
                                  <span className="block break-all font-mono text-[10px] text-muted-foreground">
                                    {truncate(JSON.stringify(r.key), 40)} ·{" "}
                                    {truncate(r.preview, 40)}
                                  </span>
                                </span>
                              </label>
                            )}
                          />
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription className="text-[10px]">
                  {idbRows.length === 0
                    ? browser.i18n.getMessage("emptyIndexedDB")
                    : browser.i18n.getMessage("countItems", [
                        String(idbRows.length),
                      ])}
                </CardDescription>
                <p className="shrink-0 text-[10px] text-muted-foreground leading-snug">
                  {browser.i18n.getMessage("idbBlobNote")}
                </p>
              </CardHeader>
            </Card>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={importBusy || !isSupportedWebUrl(tabUrl) || tabId == null}
            onClick={onRequestApply}
          >
            {browser.i18n.getMessage("importApply")}
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            {browser.i18n.getMessage("reloadSuggestion")}
          </p>
        </div>
      )}
    </>
  )
}