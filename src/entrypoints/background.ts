import { debounce } from "@/lib/debounce"
import { isSupportedWebUrl, originFromUrl } from "@/lib/page-credentials"
import { countProfilesForOrigin, watchProfileIndex } from "@/lib/profiles"

/** Matches popup `--primary` (dark zinc) for toolbar badge contrast. */
const ACTION_BADGE_BG = "#353539"

export default defineBackground(() => {
  const action =
    import.meta.env.MANIFEST_VERSION === 2
      ? browser.browserAction
      : browser.action

  const createContextMenu = async () => {
    try {
      await browser.contextMenus?.removeAll?.()
    } catch {
      /* ignore */
    }
    try {
      browser.contextMenus?.create({
        id: "identiti-save-profile",
        title: browser.i18n.getMessage("ctxMenuSaveProfile"),
        contexts: ["page"],
      })
    } catch {
      /* ignore duplicate */
    }
  }

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      void createContextMenu()
    }
  })

  browser.runtime.onStartup?.addListener(() => {
    void createContextMenu()
  })

  browser.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "identiti-save-profile") return
    if (!tab?.id || !tab.url || !isSupportedWebUrl(tab.url)) return

    try {
      if ("openPopup" in action && typeof action.openPopup === "function") {
        await action.openPopup()
      }
    } catch {
      // openPopup may not be available in all browsers
    }
  })

  async function updateBadgeForTab(
    tabId: number,
    url: string | undefined
  ): Promise<void> {
    if (!url || !isSupportedWebUrl(url)) {
      await action.setBadgeText({ text: "", tabId })
      return
    }
    try {
      const origin = originFromUrl(url)
      const count = await countProfilesForOrigin(origin)
      await action.setBadgeText({
        text: count > 0 ? String(count) : "",
        tabId,
      })
      await action.setBadgeBackgroundColor({
        color: ACTION_BADGE_BG,
        tabId,
      })
    } catch {
      await action.setBadgeText({ text: "", tabId })
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