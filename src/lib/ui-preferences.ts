import { storage } from "wxt/utils/storage"

export type UiMode = "popup" | "sidebar"

export const uiMode = storage.defineItem<UiMode>("local:uiMode", {
  fallback: "popup",
})

export async function applyUiMode(mode: UiMode): Promise<void> {
  if (typeof browser.sidePanel?.setPanelBehavior !== "function") return
  await browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: mode === "sidebar",
  })
}

export async function syncUiModeFromStorage(): Promise<UiMode> {
  const mode = await uiMode.getValue()
  await applyUiMode(mode)
  return mode
}

export function isSidePanelSupported(): boolean {
  return typeof browser.sidePanel?.setPanelBehavior === "function"
}

export async function switchUiMode(mode: UiMode): Promise<void> {
  await uiMode.setValue(mode)
  await applyUiMode(mode)

  if (mode === "sidebar") {
    const win = window.location.pathname.endsWith("/popup.html")
      ? await browser.windows.getCurrent()
      : await browser.windows.getLastFocused()
    if (win?.id != null && typeof browser.sidePanel?.open === "function") {
      await browser.sidePanel.open({ windowId: win.id })
    }
    if (window.location.pathname.endsWith("/popup.html")) {
      window.close()
    }
    return
  }

  try {
    await browser.action.openPopup()
  } catch {
    // openPopup unavailable outside user gesture or unsupported context
  }
}