import { storage } from "wxt/utils/storage"
import { debounce } from "@/lib/debounce"
import { isSupportedWebUrl, originFromUrl } from "@/lib/page-credentials"
import { countProfilesForOrigin, watchProfileIndex } from "@/lib/profiles"
import {
  applyUiMode,
  syncUiModeFromStorage,
  uiMode,
} from "@/lib/ui-preferences"

/** Matches popup `--primary` (dark zinc) for toolbar badge contrast. */
const ACTION_BADGE_BG = "#353539"

export default defineBackground(() => {
  void syncUiModeFromStorage()
  uiMode.watch((mode) => {
    void applyUiMode(mode)
  })

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      void syncUiModeFromStorage()
      browser.contextMenus?.create({
        id: "identiti-save-profile",
        title: browser.i18n.getMessage("ctxMenuSaveProfile"),
        contexts: ["page"],
      })
    }
  })

  browser.commands?.onCommand.addListener((command) => {
    if (command === "open-import") {
      void storage.setItem("session:openTab", "import")
    }
    void (async () => {
      const mode = await uiMode.getValue()
      if (mode === "sidebar" && typeof browser.sidePanel?.open === "function") {
        const win = await browser.windows.getLastFocused()
        if (win?.id != null) {
          await browser.sidePanel.open({ windowId: win.id })
          return
        }
      }
      try {
        await browser.action.openPopup()
      } catch {
        // openPopup may not be available in all browsers
      }
    })()
  })

  browser.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "identiti-save-profile") return
    if (!tab?.id || !tab.url || !isSupportedWebUrl(tab.url)) return

    try {
      await browser.action.openPopup()
    } catch {
      // openPopup may not be available in all browsers
    }
  })

  async function updateBadgeForTab(
    tabId: number,
    url: string | undefined
  ): Promise<void> {
    if (!url || !isSupportedWebUrl(url)) {
      await browser.action.setBadgeText({ text: "", tabId })
      return
    }
    try {
      const origin = originFromUrl(url)
      const count = await countProfilesForOrigin(origin)
      await browser.action.setBadgeText({
        text: count > 0 ? String(count) : "",
        tabId,
      })
      await browser.action.setBadgeBackgroundColor({
        color: ACTION_BADGE_BG,
        tabId,
      })
    } catch {
      await browser.action.setBadgeText({ text: "", tabId })
    }
  }

  const scheduleBadgeUpdate = debounce(
    (tabId: number, url: string | undefined) => {
      void updateBadgeForTab(tabId, url)
    },
    150
  )

  async function refreshActiveTabBadge(): Promise<void> {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (tab?.id) {
        await updateBadgeForTab(tab.id, tab.url)
      }
    } catch {
      // no active tab
    }
  }

  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) => scheduleBadgeUpdate(tabId, tab.url))
      .catch(() => {
        // tab may have been closed
      })
  })

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      scheduleBadgeUpdate(tabId, tab.url)
    }
  })

  watchProfileIndex(() => {
    void refreshActiveTabBadge()
  })
})