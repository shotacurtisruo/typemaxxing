import { useEffect, useRef, type ReactNode } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell: role="dialog" + aria-modal, focus trap, Escape to
 * close, backdrop click to close, and focus restored to the opener on close.
 * Matches the app's translucent-glass look via the `cz-*` classes.
 */
export default function Dialog({
  title,
  onClose,
  children,
  className = "",
  labelId = "dialog-title",
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  labelId?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // move focus into the dialog
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== "Tab" || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      )
      if (nodes.length === 0) return
      const firstEl = nodes[0]
      const lastEl = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      opener?.focus?.() // restore focus to whoever opened us
    }
  }, [onClose])

  return (
    <div className="cz-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={`cz-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
