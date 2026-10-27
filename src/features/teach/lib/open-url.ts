/**
 * Hands an app link (`whatsapp://`) to the operating system from this tab: no empty new tab is left
 * behind, and the page stays where it is.
 */
export function openApp(url: string): boolean {
  return window.open(url, '_self') !== null
}

/** Opens a link in a new tab without handing it this window (`noopener`). */
export function openInNewTab(url: string): boolean {
  const tab = window.open(url, '_blank', 'noopener,noreferrer')
  return tab !== null
}

/**
 * Opens a URL that is only known after a request (a signed download URL): the tab is opened on
 * the click itself, before the request, so popup blockers let it through; it loses its opener,
 * since it ends on the storage's origin. `fail` closes it again when the request did not work.
 */
export function openDeferred(): { show: (url: string) => void; fail: () => void } {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  return {
    show: (url) => {
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
    },
    fail: () => tab?.close(),
  }
}
