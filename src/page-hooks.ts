// Runs in the page's own JavaScript world, where it can see what page scripts
// do that causes no DOM mutation. It only signals the isolated content script
// (src/content.ts), which owns all masking state; nothing sensitive passes
// through here. It is declared in package.json's manifest rather than through
// Plasmo, which would register it at runtime with an API Firefox's MV2
// `chrome` namespace does not support.

// Non-bubbling but composed: the content script sees it in the capture phase
// on document, page bubble listeners never do.
const signal = (target: EventTarget, type: string) =>
  target.dispatchEvent(new Event(`mailhush:${type}`, { composed: true }))

// Attaching a shadow root causes no mutation the content script can observe.
const attachShadow = Element.prototype.attachShadow
Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
  const root = attachShadow.call(this, init)
  if (init.mode === "open") signal(this, "shadow")
  return root
}

// Validation and serialization read field values natively, so masked fields
// must hold what the user typed while a page script submits or reads a form.
const formMethods = ["requestSubmit", "submit", "checkValidity", "reportValidity"] as const
for (const name of formMethods) {
  const method = HTMLFormElement.prototype[name] as (...args: unknown[]) => unknown
  Object.defineProperty(HTMLFormElement.prototype, name, {
    configurable: true,
    writable: true,
    value: function (this: HTMLFormElement, ...args: unknown[]) {
      signal(this, "form")
      return method.apply(this, args)
    }
  })
}

window.FormData = new Proxy(FormData, {
  construct(target, args, newTarget) {
    // Forms from same-origin frames fail instanceof against this realm's class.
    if (Object.prototype.toString.call(args[0]) === "[object HTMLFormElement]") signal(args[0], "form")
    return Reflect.construct(target, args, newTarget)
  }
})

// Setting .value from script changes no attribute, so it is invisible to
// MutationObserver.
for (const prototype of [HTMLInputElement.prototype, HTMLTextAreaElement.prototype]) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")!
  Object.defineProperty(prototype, "value", {
    ...descriptor,
    set(this: HTMLInputElement | HTMLTextAreaElement, value: string) {
      descriptor.set!.call(this, value)
      // Mask after the page's current code finishes, still before paint, so
      // the script can read back what it just wrote.
      queueMicrotask(() => signal(this, "value"))
    }
  })
}

export {}
