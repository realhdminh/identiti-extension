import { useEffect } from "react"
import { Toaster } from "@/components/ui/sonner"
import { CredentialManager } from "@/popup/CredentialManager"

export default function App() {
  useEffect(() => {
    const lang = browser.i18n.getUILanguage() || "en"
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
      <CredentialManager />
      <Toaster theme="system" richColors closeButton position="top-center" />
    </>
  )
}