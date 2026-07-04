import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  isSidePanelSupported,
  switchUiMode,
  type UiMode,
  uiMode,
} from "@/lib/ui-preferences"

export function UiModeToggle() {
  const [mode, setMode] = useState<UiMode>("popup")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void uiMode.getValue().then(setMode)
    return uiMode.watch(setMode)
  }, [])

  if (!isSidePanelSupported()) return null

  const next: UiMode = mode === "popup" ? "sidebar" : "popup"

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="shrink-0 text-[10px]"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void switchUiMode(next)
          .then(() => setMode(next))
          .finally(() => setBusy(false))
      }}
    >
      {mode === "popup"
        ? browser.i18n.getMessage("uiModeUseSidebar")
        : browser.i18n.getMessage("uiModeUsePopup")}
    </Button>
  )
}