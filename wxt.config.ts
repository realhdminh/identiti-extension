import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    developmentIndicator: "overlay",
  },
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
    disabled: true,
  },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 1000,
    },
  }),
  manifest: ({ browser, manifestVersion }) => ({
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    ...(browser === "chrome" ? { minimum_chrome_version: "130" } : {}),
    permissions: [
      "storage",
      "tabs",
      "cookies",
      "contextMenus",
      "unlimitedStorage",
    ],
    host_permissions: ["<all_urls>"],
    incognito: "spanning",
    browser_specific_settings: {
      gecko: {
        id: "identiti@identiti.local",
        strict_min_version: "132.0",
        // Firefox requires an explicit data-collection declaration for new
        // add-ons. Identiti never collects or transmits anything.
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
    commands: {
      [manifestVersion === 2 ? "_execute_browser_action" : "_execute_action"]: {
        description: "__MSG_cmdOpenImport__",
        suggested_key: {
          default: "Alt+Shift+Y",
        },
      },
    },
  }),
})
