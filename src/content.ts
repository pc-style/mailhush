import type { PlasmoCSConfig } from "plasmo"

import { createMasker, type Masker } from "~lib/engine"
import {
  defaultSettings,
  isSiteExcluded,
  readSettings,
  settingsKey,
  type ExtensionSettings
} from "~lib/settings"

export const config: PlasmoCSConfig & { match_about_blank: boolean } = {
  matches: ["<all_urls>"],
  run_at: "document_start",
  all_frames: true,
  // about:blank and srcdoc frames inherit their parent's origin and content.
  match_about_blank: true
}

type Control = HTMLInputElement | HTMLTextAreaElement

// What MailHush wrote, and the page's value underneath it.
interface Masked {
  original: string
  applied: string
}

// Text inside these elements is code, styling, or form values that the page
// submits; <title> is handled through document.title.
const skippedParents = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION", "TITLE", "TEMPLATE"])
const maskedAttributes = ["title", "alt", "placeholder", "aria-label"]
const attributeSelector = maskedAttributes.map((name) => `[${name}]`).join(",")
const maskableInputTypes = new Set(["", "text", "search", "email", "url", "tel"])
const editableSelector = '[contenteditable]:not([contenteditable="false"])'
const veilId = "mailhush-startup-veil"

let settings: ExtensionSettings = defaultSettings
let masker: Masker = { mask: (text) => text }
let active = false

const maskedText = new WeakMap<Text, Masked>()
const maskedControls = new WeakMap<Control, Masked>()
const maskedAttrs = new WeakMap<Element, Map<string, Masked>>()
const shadowRoots = new Set<ShadowRoot>()
let maskedTitle: Masked | null = null
let shownTitle = ""

const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome

// Returns the value MailHush should show for a node whose current value is
// `current`. If the page changed the value since MailHush masked it, the new
// value becomes the original.
const nextValue = (record: Masked | undefined | null, current: string, enabled: boolean) => {
  const original = record && record.applied === current ? record.original : current
  const masked = enabled ? masker.mask(original) : original
  return { original, masked }
}

// --- Text nodes -----------------------------------------------------------

// document.activeElement stops at shadow hosts; follow it into open roots.
const deepActiveElement = () => {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

const isEditable = (element: Element) => {
  const root = element.closest(editableSelector)
  return root !== null && (!settings.maskInputs || root.contains(deepActiveElement()))
}

const processText = (node: Text) => {
  const parent = node.parentElement
  const record = maskedText.get(node)
  const current = node.data
  // Text placed directly in a shadow root has no parent element.
  const enabled = active && (parent ? !skippedParents.has(parent.nodeName) : node.parentNode instanceof ShadowRoot)
  const { original, masked } = nextValue(record, current, enabled)

  // Editable content is only checked when something would change, which keeps
  // the common no-match path free of selector matching.
  if (masked !== original && !(parent && isEditable(parent))) {
    maskedText.set(node, { original, applied: masked })
    if (current !== masked) node.data = masked
    return
  }

  if (record) {
    maskedText.delete(node)
    if (current !== original) node.data = original
  }
}

// --- Form controls ----------------------------------------------------------

const isMaskableControl = (element: Element): element is Control =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && maskableInputTypes.has(element.type.toLowerCase()))

const processControl = (control: Control) => {
  const record = maskedControls.get(control)
  const current = control.value
  const enabled = active && settings.maskInputs && deepActiveElement() !== control
  const { original, masked } = nextValue(record, current, enabled)

  if (masked !== original) {
    maskedControls.set(control, { original, applied: masked })
    if (current !== masked) control.value = masked
  } else if (record) {
    maskedControls.delete(control)
    if (current !== original) control.value = original
  }
}

const unmaskControl = (control: Control) => {
  const record = maskedControls.get(control)
  if (!record) return
  maskedControls.delete(control)
  if (control.value === record.applied) control.value = record.original
}

// --- Attributes -----------------------------------------------------------

const processAttribute = (element: Element, name: string) => {
  const current = element.getAttribute(name)
  const records = maskedAttrs.get(element)
  const record = records?.get(name)

  if (current === null) {
    records?.delete(name)
    return
  }

  const { original, masked } = nextValue(record, current, active && settings.maskAttributes)

  if (masked !== original) {
    if (records) records.set(name, { original, applied: masked })
    else maskedAttrs.set(element, new Map([[name, { original, applied: masked }]]))
    if (current !== masked) element.setAttribute(name, masked)
  } else if (record) {
    records!.delete(name)
    if (current !== original) element.setAttribute(name, original)
  }
}

const processAttributes = (element: Element) => {
  for (const name of maskedAttributes) {
    if (element.hasAttribute(name)) processAttribute(element, name)
  }
}

// --- Title ------------------------------------------------------------------

const processTitle = () => {
  const current = document.title
  const { original, masked } = nextValue(maskedTitle, current, active && settings.maskTitle)
  maskedTitle = masked !== original ? { original, applied: masked } : null
  if (current !== masked) document.title = masked
  shownTitle = document.title
}

// --- Tree scanning ----------------------------------------------------------

// Visits every text node, form control, and open shadow root below `root` in
// one native TreeWalker pass, skipping script and style subtrees.
const scan = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    processText(root as Text)
    return
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node: Node | null = root

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processText(node as Text)
    } else {
      const element = node as Element
      const tag = element.nodeName

      if (element.shadowRoot) {
        observeRoot(element.shadowRoot)
        scan(element.shadowRoot)
      } else if (tag.includes("-")) {
        watchHost(element)
      }

      // Compare tag names first; instanceof checks on every element are slow.
      if ((tag === "INPUT" || tag === "TEXTAREA") && isMaskableControl(element)) {
        processControl(element)
      }

      if (skippedParents.has(tag) && node !== root) {
        // Skip the subtree: move to the next sibling of this node or an ancestor.
        node = null
        while (!node && walker.currentNode !== root) {
          node = walker.nextSibling()
          if (!node && !walker.parentNode()) break
        }
        continue
      }
    }

    node = walker.nextNode()
  }

  if (root instanceof Element || root instanceof DocumentFragment || root instanceof Document) {
    if (root instanceof Element) processAttributes(root)
    root.querySelectorAll(attributeSelector).forEach(processAttributes)
  }
}

// The walk reaches every connected shadow root through its host.
const scanEverything = () => {
  for (const root of shadowRoots) {
    if (!root.host.isConnected) shadowRoots.delete(root)
  }
  scan(document.documentElement)
  processTitle()
}

// --- Observation ------------------------------------------------------------

const handleMutations = (records: MutationRecord[]) => {
  for (const record of records) {
    const { target } = record

    if (record.type === "characterData") {
      processText(target as Text)
    } else if (record.type === "attributes") {
      if (record.attributeName !== "value") {
        processAttribute(target as Element, record.attributeName!)
      } else if (target instanceof Element && isMaskableControl(target)) {
        processControl(target)
      }
    } else {
      for (const node of record.addedNodes) {
        if (node.isConnected) scan(node)
      }
    }
  }

  // Comparing strings is cheaper than tracking how <title> was replaced.
  if (document.title !== shownTitle) processTitle()
}

const observer = new MutationObserver(handleMutations)
const observerOptions: MutationObserverInit = {
  characterData: true,
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [...maskedAttributes, "value"]
}

function observeRoot(root: ShadowRoot) {
  if (shadowRoots.has(root)) return
  shadowRoots.add(root)
  if (active) observer.observe(root, observerOptions)
  // Focus moves inside one shadow root never reach the document.
  root.addEventListener("focusin", handleFocusIn as EventListener, true)
  root.addEventListener("focusout", handleFocusOut as EventListener, true)
}

// Custom elements often upgrade, and attach their shadow root, after the
// parser inserted them. Attaching a root causes no mutation, and content
// scripts cannot hook attachShadow, so recheck new custom elements briefly.
const pendingHosts = new Map<Element, number>()
let hostTimer = 0

function watchHost(element: Element) {
  if (pendingHosts.has(element)) return
  pendingHosts.set(element, 0)
  if (!hostTimer) hostTimer = window.setInterval(checkHosts, 500)
}

function checkHosts() {
  for (const [element, checks] of pendingHosts) {
    if (element.shadowRoot) {
      pendingHosts.delete(element)
      if (active && element.isConnected) {
        observeRoot(element.shadowRoot)
        scan(element.shadowRoot)
      }
    } else if (checks >= 20 || !element.isConnected) {
      pendingHosts.delete(element)
    } else {
      pendingHosts.set(element, checks + 1)
    }
  }
  if (pendingHosts.size === 0) {
    clearInterval(hostTimer)
    hostTimer = 0
  }
}

// --- Focus and forms --------------------------------------------------------

const handleFocusIn = (event: FocusEvent) => {
  const target = event.composedPath()[0]
  if (!(target instanceof Element)) return

  if (isMaskableControl(target)) {
    unmaskControl(target)
    return
  }

  const editable = target.closest(editableSelector)
  if (editable) scan(editable)
}

const handleFocusOut = (event: FocusEvent) => {
  const target = event.composedPath()[0]
  if (!(target instanceof Element)) return

  requestAnimationFrame(() => {
    if (isMaskableControl(target)) {
      processControl(target)
      return
    }

    const editable = target.closest(editableSelector)
    if (editable) scan(editable)
  })
}

// Typing replaces whatever MailHush stored for the control.
const handleInput = (event: Event) => {
  const target = event.composedPath()[0]
  if (!(target instanceof Element) || !isMaskableControl(target)) return
  if (target.value !== maskedControls.get(target)?.applied) maskedControls.delete(target)
}

// Forms must validate and submit what the user typed, not the masked text.
// Validation runs before the submit event, so unmask when the user starts a
// submission (a submit button click or Enter in a field), then mask again.
const unmaskForm = (form: HTMLFormElement | null) => {
  if (!form) return
  for (const element of form.elements) {
    if (isMaskableControl(element)) unmaskControl(element)
  }
  // form.elements includes controls outside the form that use form="id".
  setTimeout(() => {
    for (const element of form.elements) {
      if (element.isConnected && isMaskableControl(element)) processControl(element)
    }
  })
}

const handleSubmit = (event: Event) => {
  if (event.target instanceof HTMLFormElement) unmaskForm(event.target)
}

const handleClick = (event: MouseEvent) => {
  const target = event.composedPath()[0]
  const button = target instanceof Element ? target.closest("button, input") : null
  if (button instanceof HTMLButtonElement && button.type === "submit") unmaskForm(button.form)
  if (button instanceof HTMLInputElement && (button.type === "submit" || button.type === "image")) unmaskForm(button.form)
}

const handleKeyDown = (event: KeyboardEvent) => {
  const target = event.composedPath()[0]
  if (event.key === "Enter" && target instanceof HTMLInputElement) unmaskForm(target.form)
}

// --- Lifecycle --------------------------------------------------------------

const isPageExcluded = () => {
  const hosts = [location.hostname]
  const ancestors = location.ancestorOrigins
  if (ancestors?.length) {
    try {
      hosts.push(new URL(ancestors[ancestors.length - 1]).hostname)
    } catch {
      // Opaque origins have no hostname.
    }
  }
  return hosts.some((host) => isSiteExcluded(host, settings.excludedSites))
}

const apply = (next: ExtensionSettings) => {
  settings = next
  const shouldRun = next.enabled && !isPageExcluded()
  masker = createMasker(next)

  if (shouldRun) {
    if (!active) {
      active = true
      observer.observe(document, observerOptions)
      for (const root of shadowRoots) observer.observe(root, observerOptions)
    }
    scanEverything()
    return
  }

  // Restore everything once, then stop observing so the page pays nothing.
  if (active) {
    active = false
    observer.disconnect()
    scanEverything()
  }
}

// Hide the page until the first scan so masked values never flash on screen.
const veil = document.createElement("style")
veil.id = veilId
veil.textContent = "html, html * { visibility: hidden !important; }"
if (document instanceof HTMLDocument && !document.getElementById(veilId)) {
  document.documentElement?.prepend(veil)
}

const bootstrap = async () => {
  try {
    apply(await readSettings())
  } catch {
    apply(defaultSettings)
  } finally {
    veil.remove()
  }

  document.addEventListener("focusin", handleFocusIn, true)
  document.addEventListener("focusout", handleFocusOut, true)
  document.addEventListener("input", handleInput, true)
  document.addEventListener("submit", handleSubmit, true)
  document.addEventListener("click", handleClick, true)
  document.addEventListener("keydown", handleKeyDown, true)

  // Settings save on every keystroke; rescan once typing pauses.
  let reload = 0
  browserApi.storage.onChanged.addListener((changes) => {
    if (!(settingsKey in changes)) return
    clearTimeout(reload)
    reload = window.setTimeout(() => void readSettings().then(apply), 150)
  })
}

void bootstrap()
