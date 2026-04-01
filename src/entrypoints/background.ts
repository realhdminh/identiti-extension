import { isSupportedWebUrl, originFromUrl } from "@/lib/page-credentials"
import { countProfilesForOrigin } from "@/lib/profiles"

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      browser.contextMenus?.create({
        id: "identiti-save-profile",
        title: browser.i18n.getMessage("ctxMenuSaveProfile"),
        contexts: ["page"],
      })
    }
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
        color: "#6366f1",
        tabId,
      })
    } catch {
      await browser.action.setBadgeText({ text: "", tabId })
    }
  }

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await browser.tabs.get(tabId)
      await updateBadgeForTab(tabId, tab.url)
    } catch {
      // tab may have been closed
    }
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      await updateBadgeForTab(tabId, tab.url)
    }
  })
})