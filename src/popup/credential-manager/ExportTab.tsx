import {
  IconCookie,
  IconDatabase,
  IconDeviceFloppy,
  IconDownload,
  IconLayersSubtract,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { z } from "zod"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  cookieRowId,
  type ExportedCookie,
  isSupportedWebUrl,
} from "@/lib/page-credentials"
import { truncate } from "@/popup/lib/format"
import { lsKeyId, ssKeyId } from "@/popup/lib/selection-ids"
import { StorageKeyListCard } from "./StorageKeyListCard"

export type ExportTabProps = {
  tabUrl: string | undefined
  filter: string
  setFilter: (v: string) => void
  onRefresh: () => void
  cookies: ExportedCookie[]
  lsEntries: Record<string, string>
  ssEntries: Record<string, string>
  filteredCookies: ExportedCookie[]
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
  selected: Set<string>
  toggleId: (id: string, on: boolean) => void
  selectAllIn: (ids: string[], on: boolean) => void
  encryptExport: boolean
  setEncryptExport: (v: boolean) => void
  exportPass: string
  setExportPass: (v: string) => void
  exportPass2: string
  setExportPass2: (v: string) => void
  onExport: () => void | Promise<void>
  onSaveAsProfile: (name: string) => void | Promise<void>
  profileBusy: boolean
}

export function ExportTab({
  tabUrl,
  filter,
  setFilter,
  onRefresh,
  cookies,
  lsEntries,
  ssEntries,
  filteredCookies,
  filteredLsKeys,
  filteredSsKeys,
  filteredIdbRows,
  idbRows,
  selected,
  toggleId,
  selectAllIn,
  encryptExport,
  setEncryptExport,
  exportPass,
  setExportPass,
  exportPass2,
  setExportPass2,
  onExport,
  onSaveAsProfile,
  profileBusy,
}: ExportTabProps) {
  const exportPasswordSchema = z
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

  const passwordForm = useForm({
    defaultValues: {
      exportPass,
      exportPass2,
    },
    validators: {
      onChange: exportPasswordSchema,
      onSubmit: exportPasswordSchema,
    },
    onSubmit: async () => {
      await onExport()
    },
  })

  const [cookiesOpen, setCookiesOpen] = useState(false)
  const [idbOpen, setIdbOpen] = useState(false)
  const [quickProfileName, setQuickProfileName] = useState("")

  if (!isSupportedWebUrl(tabUrl)) {
    return null
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          className="h-8 flex-1 text-xs"
          placeholder={browser.i18n.getMessage("searchPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void onRefresh()}
        >
          ↻
        </Button>
      </div>

      <p className="shrink-0 text-[11px] text-muted-foreground">
        {browser.i18n.getMessage("countSummaryFull", [
          String(cookies.length),
          String(Object.keys(lsEntries).length),
          String(Object.keys(ssEntries).length),
          String(idbRows.length),
        ])}
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden pr-0.5">
        <Card size="sm" className="flex flex-col py-2">
          <CardHeader className="gap-1 pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={
                    cookies.length > 0 &&
                    cookies.every((c) => selected.has(cookieRowId(c)))
                  }
                  disabled={cookies.length === 0}
                  onCheckedChange={(v) =>
                    selectAllIn(cookies.map(cookieRowId), v === true)
                  }
                />
                <CardTitle className="flex items-center gap-1.5 text-xs">
                  <IconCookie className="size-3.5 opacity-50" />
                  {browser.i18n.getMessage("sectionCookies")}
                </CardTitle>
              </div>
              <Dialog open={cookiesOpen} onOpenChange={setCookiesOpen}>
                <DialogTrigger
                  type="button"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
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
                            selectAllIn(filteredCookies.map(cookieRowId), true)
                          }
                        >
                          {browser.i18n.getMessage("selectAll")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            selectAllIn(filteredCookies.map(cookieRowId), false)
                          }
                        >
                          {browser.i18n.getMessage("selectNone")}
                        </Button>
                      </div>
                    )}
                    <ScrollArea className="h-[380px] pr-2">
                      {filteredCookies.length === 0 ? (
                        <div className="px-1 py-2 text-muted-foreground text-xs">
                          {browser.i18n.getMessage("emptyCookies")}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {filteredCookies.map((c) => {
                            const id = cookieRowId(c)
                            return (
                              <li key={id}>
                                <label
                                  htmlFor={id}
                                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 hover:bg-muted/60"
                                >
                                  <Checkbox
                                    id={id}
                                    checked={selected.has(id)}
                                    onCheckedChange={(v) =>
                                      toggleId(id, v === true)
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
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription className="text-[10px]">
              {cookies.length === 0
                ? browser.i18n.getMessage("emptyCookies")
                : browser.i18n.getMessage("countItems", [
                    String(cookies.length),
                  ])}
            </CardDescription>
          </CardHeader>
        </Card>

        <StorageKeyListCard
          heading={browser.i18n.getMessage("sectionLocalStorage")}
          icon={<IconDatabase className="size-3.5 opacity-50" />}
          emptyMessage={browser.i18n.getMessage("emptyLocalStorage")}
          filteredKeys={filteredLsKeys}
          allKeys={Object.keys(lsEntries)}
          entries={lsEntries}
          idFn={lsKeyId}
          selected={selected}
          onToggle={toggleId}
          onSelectAllIn={selectAllIn}
        />
        <StorageKeyListCard
          heading={browser.i18n.getMessage("sectionSessionStorage")}
          icon={<IconLayersSubtract className="size-3.5 opacity-50" />}
          emptyMessage={browser.i18n.getMessage("emptySessionStorage")}
          filteredKeys={filteredSsKeys}
          allKeys={Object.keys(ssEntries)}
          entries={ssEntries}
          idFn={ssKeyId}
          selected={selected}
          onToggle={toggleId}
          onSelectAllIn={selectAllIn}
        />

        <Card size="sm" className="flex flex-col py-2">
          <CardHeader className="gap-1 pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  checked={
                    idbRows.length > 0 &&
                    idbRows.every((r) => selected.has(r.id))
                  }
                  disabled={idbRows.length === 0}
                  onCheckedChange={(v) =>
                    selectAllIn(
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
              <Dialog open={idbOpen} onOpenChange={setIdbOpen}>
                <DialogTrigger
                  type="button"
                  className={buttonVariants({ variant: "ghost", size: "xs" })}
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
                            selectAllIn(
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
                            selectAllIn(
                              filteredIdbRows.map((r) => r.id),
                              false
                            )
                          }
                        >
                          {browser.i18n.getMessage("selectNone")}
                        </Button>
                      </div>
                    )}
                    <ScrollArea className="h-[380px] pr-2">
                      {filteredIdbRows.length === 0 ? (
                        <div className="px-1 py-2 text-muted-foreground text-xs">
                          {browser.i18n.getMessage("emptyIndexedDB")}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {filteredIdbRows.map((r, idx) => (
                            <li key={r.id}>
                              <label
                                htmlFor={`idb-row-${idx}`}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 hover:bg-muted/60"
                              >
                                <Checkbox
                                  id={`idb-row-${idx}`}
                                  checked={selected.has(r.id)}
                                  onCheckedChange={(v) =>
                                    toggleId(r.id, v === true)
                                  }
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="block font-medium text-[12px] leading-tight">
                                    {r.database} / {r.store}
                                  </span>
                                  <span className="block break-all font-mono text-[10px] text-muted-foreground">
                                    {truncate(JSON.stringify(r.key), 56)} ·{" "}
                                    {truncate(r.preview, 40)}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ScrollArea>
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

      <div className="flex shrink-0 flex-col gap-2 border-border border-t pt-2">
        <label
          htmlFor="export-encrypt-toggle"
          className="flex cursor-pointer items-center gap-2 text-[11px]"
        >
          <Checkbox
            id="export-encrypt-toggle"
            checked={encryptExport}
            onCheckedChange={(v) => setEncryptExport(v === true)}
          />
          {browser.i18n.getMessage("encryptFile")}
        </label>
        {encryptExport && (
          <div className="flex flex-col gap-1.5">
            <passwordForm.Field name="exportPass">
              {(field) => {
                const inputId = field.name
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={inputId}>
                      {browser.i18n.getMessage("exportPassword")}
                    </FieldLabel>
                    <Input
                      id={inputId}
                      type="password"
                      className="h-8 text-xs"
                      value={field.state.value}
                      onChange={(e) => {
                        const v = e.target.value
                        field.handleChange(v)
                        setExportPass(v)
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </passwordForm.Field>
            <passwordForm.Field name="exportPass2">
              {(field) => {
                const inputId = field.name
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={inputId}>
                      {browser.i18n.getMessage("exportPasswordConfirm")}
                    </FieldLabel>
                    <Input
                      id={inputId}
                      type="password"
                      className="h-8 text-xs"
                      value={field.state.value}
                      onChange={(e) => {
                        const v = e.target.value
                        field.handleChange(v)
                        setExportPass2(v)
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </passwordForm.Field>
          </div>
        )}
        <passwordForm.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="button"
              className="w-full gap-1.5"
              onClick={() => {
                if (encryptExport) void passwordForm.handleSubmit()
                else void onExport()
              }}
              disabled={isSubmitting || (encryptExport && !canSubmit)}
            >
              <IconDownload className="size-3.5" />
              {browser.i18n.getMessage("exportButton")}
            </Button>
          )}
        </passwordForm.Subscribe>
        <div className="flex items-center gap-1.5">
          <Input
            className="h-7 flex-1 text-xs"
            placeholder={browser.i18n.getMessage("profileNamePlaceholder")}
            value={quickProfileName}
            onChange={(e) => setQuickProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickProfileName.trim()) {
                void onSaveAsProfile(quickProfileName.trim())
                setQuickProfileName("")
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1"
            disabled={profileBusy || !quickProfileName.trim()}
            onClick={() => {
              void onSaveAsProfile(quickProfileName.trim())
              setQuickProfileName("")
            }}
          >
            <IconDeviceFloppy className="size-3.5" />
            {browser.i18n.getMessage("profileSaveAsProfile")}
          </Button>
        </div>
      </div>
    </>
  )
}