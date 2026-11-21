import { useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { CredentialManager } from "@/popup/CredentialManager"
import { ErrorBoundary } from "@/popup/components/ErrorBoundary"

export default function AppShell() {
  useEffect(() => {
    const lang = browser.i18n.getUILanguage()
    document.documentElement.lang = lang

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => {
      document.documentElement.classList.toggle("dark", mq.matches)
    }
    syncTheme()
    mq.addEventListener("change", syncTheme)
    return () => mq.removeEventListener("change", syncTheme)
  }, [])

  return (
    <>
      <ErrorBoundary>
        <CredentialManager />
      </ErrorBoundary>
      <Toaster
        theme="system"
        richColors
        closeButton
        toastOptions={{
          closeButtonAriaLabel: browser.i18n.getMessage("close"),
        }}
        containerAriaLabel={browser.i18n.getMessage("notifications")}
        position="top-center"
      />
    </>
  )
}