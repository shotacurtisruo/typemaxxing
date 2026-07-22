import { act, createElement, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import Dialog from "./Dialog"
import TypingInput from "./TypingInput"
import { useGame } from "../game/store"

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

describe("Dialog focus management", () => {
  it("does not reset focus when a parent render replaces onClose", () => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)

    function Harness() {
      const [enabled, setEnabled] = useState(false)
      return createElement(
        Dialog,
        { title: "Settings", onClose: () => undefined },
        createElement(
          "button",
          {
            type: "button",
            "aria-label": "camera shake",
            "aria-pressed": enabled,
            onClick: () => setEnabled((value) => !value),
          },
          "camera shake",
        ),
        createElement("button", { type: "button", "aria-label": "shadows" }, "shadows"),
      )
    }

    act(() => root?.render(createElement(Harness)))
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="camera shake"]')!
    const other = host.querySelector<HTMLButtonElement>('[aria-label="shadows"]')!

    other.focus()
    expect(document.activeElement).toBe(other)

    act(() => toggle.click())

    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(document.activeElement).toBe(other)

    act(() => toggle.click())

    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(document.activeElement).toBe(other)
  })

  it("returns focus to gameplay after the dialog closes", async () => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)

    function Harness() {
      const [open, setOpen] = useState(false)
      const inputRef = useRef<HTMLTextAreaElement>(null)
      return createElement(
        "div",
        null,
        createElement("button", { type: "button", onClick: () => setOpen(true) }, "open settings"),
        open
          ? createElement(
              Dialog,
              { title: "Settings", onClose: () => setOpen(false) },
              createElement("button", { type: "button", onClick: () => setOpen(false) }, "close settings"),
            )
          : null,
        createElement(TypingInput, { inputRef, suppressed: open, onStarted: () => undefined }),
      )
    }

    await act(async () => {
      root?.render(createElement(Harness))
      await new Promise(requestAnimationFrame)
    })
    const open = host.querySelector<HTMLButtonElement>("button")!
    act(() => {
      open.focus()
      open.click()
    })

    const close = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "close settings")!
    await act(async () => {
      close.click()
      await new Promise(requestAnimationFrame)
    })

    expect(document.activeElement).toBe(host.querySelector("textarea"))
  })

  it("can leave focus restoration to a game-specific close handler", () => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    const gameplay = document.createElement("textarea")
    document.body.appendChild(gameplay)

    act(() => {
      root?.render(
        createElement(
          Dialog,
          {
            title: "Settings",
            restoreFocus: false,
            onClose: () => gameplay.focus(),
          },
          createElement("button", { type: "button" }, "setting"),
        ),
      )
    })

    const backdrop = host.querySelector<HTMLDivElement>(".cz-backdrop")!
    act(() => backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })))
    expect(document.activeElement).toBe(gameplay)
    gameplay.remove()
  })

  it("recovers a lost-focus typing key even when audio is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    useGame.getState().newRun()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)

    function Harness() {
      const inputRef = useRef<HTMLTextAreaElement>(null)
      return createElement(
        "div",
        null,
        createElement("button", { type: "button" }, "toolbar"),
        createElement(TypingInput, { inputRef, suppressed: false, onStarted: () => undefined }),
      )
    }

    await act(async () => {
      root?.render(createElement(Harness))
      await new Promise(requestAnimationFrame)
    })
    const toolbar = host.querySelector<HTMLButtonElement>("button")!
    const input = host.querySelector<HTMLTextAreaElement>("textarea")!
    const before = useGame.getState().ci
    const key = useGame.getState().words[0][before]

    act(() => {
      toolbar.focus()
      toolbar.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })

    expect(document.activeElement).toBe(input)
    expect(useGame.getState().ci).toBe(before + 1)
  })
})
