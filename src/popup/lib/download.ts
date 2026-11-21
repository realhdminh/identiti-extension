/**
 * Triggers a browser download for `text`.
 *
 * The anchor is attached to the document before clicking because Firefox only
 * honours the `download` attribute for connected elements, and the object URL
 * is revoked on the next tick — revoking it synchronously can cancel the
 * download before it starts.
 */
export function downloadTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}