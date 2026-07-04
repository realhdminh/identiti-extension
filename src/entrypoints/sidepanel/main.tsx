import React from "react"
import ReactDOM from "react-dom/client"
import AppShell from "@/popup/AppShell"
import "../popup/style.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppShell layout="sidepanel" />
  </React.StrictMode>
)