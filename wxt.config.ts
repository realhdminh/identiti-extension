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
  manifest: {
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    permissions: ["storage", "tabs", "cookies", "scripting", "contextMenus"],
    host_permissions: ["<all_urls>"],
    incognito: "spanning",
    action: {},
    commands: {
      "open-import": {
        description: "__MSG_cmdOpenImport__",
        suggested_key: {
          default: "Ctrl+Shift+I",
          mac: "Command+Shift+I",
        },
      },
    },
  },
})