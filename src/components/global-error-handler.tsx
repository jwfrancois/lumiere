'use client'

import { useEffect } from 'react'

/**
 * Global error handler for unhandled promise rejections.
 *
 * Catches NotFoundError (and similar) that slip through component-level
 * try/catch — e.g. when a file is deleted mid-scan, or a folder is moved
 * between sessions. These are logged and swallowed so the UI stays stable.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      // Normalize to an Error-like object for inspection
      const name = reason?.name || ''
      const message = reason?.message || String(reason)

      // NotFoundError: file/folder moved or deleted since scan.
      // NotSupportedError / AbortError: media element couldn't decode source.
      // These are expected during normal use — log and swallow.
      const benignErrors = [
        'NotFoundError',
        'NotSupportedError',
        'AbortError',
        'EncodingError',
      ]
      if (benignErrors.includes(name)) {
        console.warn('Suppressed benign error:', name, message)
        event.preventDefault()
        return
      }

      // Unknown errors — log but don't crash the page.
      console.error('Unhandled rejection:', reason)
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () =>
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [])

  return null
}
