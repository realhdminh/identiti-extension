import { fakeBrowser } from "wxt/testing/fake-browser"

// `wxt/browser` resolves to `globalThis.browser` when it exposes a runtime id,
// and to `globalThis.chrome` otherwise. Installing both keeps the test runtime
// aligned with the extension runtime, where `browser` is the WebExtension API.
if (!("browser" in globalThis)) {
  Object.defineProperty(globalThis, "browser", {
    value: fakeBrowser,
    writable: true,
    configurable: true,
  })
}

if (!("chrome" in globalThis)) {
  Object.defineProperty(globalThis, "chrome", {
    value: fakeBrowser,
    writable: true,
    configurable: true,
  })
}