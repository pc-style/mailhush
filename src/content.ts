import type { PlasmoCSConfig } from "plasmo"

import { readSettings, type EmailRule, type ExtensionSettings } from "~lib/settings"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

const blockedParents = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "OPTION",
  "TITLE"
])

let settings: ExtensionSettings | null = null
let scheduled = false
let applying = false
let applyingTitle = false
let rawDocumentTitle = ""
const originalText = new WeakMap<Text, string>()
const selfMutations = new WeakSet<Text>()
const originalControlValue = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>()
const appliedControlValue = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>()
const maskedControls = new WeakSet<HTMLInputElement | HTMLTextAreaElement>()

const hiddenEmailLabel = "[hidden email]"
const catchAllEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

const escapeForRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const getActiveRules = () =>
  (settings?.enabled ? settings.rules : []).filter(
    (rule) => rule.enabled && rule.email && rule.replacement
  )

const shouldMaskBlurredInputs = () => settings?.enabled === true && settings.blurMaskInputs

const getContentEditableRoot = (element: Element | null): HTMLElement | null => {
  let current = element as HTMLElement | null

  while (current) {
    if (current.isContentEditable) {
      const parent = current.parentElement as HTMLElement | null

      if (!parent?.isContentEditable) {
        return current
      }
    }

    current = current.parentElement
  }

  return null
}

const isActiveEditableRoot = (root: HTMLElement) => {
  const activeElement = document.activeElement
  return activeElement instanceof Element && root.contains(activeElement)
}

const getReplacementRules = () => ({
  rules: getActiveRules(),
  maskAllEmails: settings?.enabled === true && settings.maskAllEmails
})

const shouldSkipNode = (node: Text) => {
  const parent = node.parentElement

  if (!parent) {
    return true
  }

  if (blockedParents.has(parent.tagName)) {
    return true
  }

  const editableRoot = getContentEditableRoot(parent)

  if (editableRoot) {
    if (!shouldMaskBlurredInputs() && !originalText.has(node)) {
      return true
    }

    if (shouldMaskBlurredInputs() && isActiveEditableRoot(editableRoot)) {
      return true
    }
  }

  return !node.nodeValue || node.nodeValue.trim().length === 0
}

const replaceTextContent = (
  text: string,
  rules: EmailRule[],
  maskAllEmails: boolean
) => {
  let nextText = text

  for (const rule of rules) {
    const pattern = new RegExp(escapeForRegExp(rule.email), "gi")
    nextText = nextText.replace(pattern, rule.replacement)
  }

  if (maskAllEmails) {
    nextText = nextText.replace(catchAllEmailPattern, hiddenEmailLabel)
  }

  return nextText
}

const applyTextNodeValue = (node: Text, value: string) => {
  if ((node.nodeValue ?? "") === value) {
    return
  }

  applying = true
  selfMutations.add(node)
  node.nodeValue = value
  applying = false
}

const processTextNode = (node: Text) => {
  if (shouldSkipNode(node)) {
    return
  }

  const { rules, maskAllEmails } = getReplacementRules()
  const baseText = originalText.get(node) ?? node.nodeValue ?? ""

  if (!originalText.has(node)) {
    originalText.set(node, baseText)
  }

  const nextText =
    rules.length || maskAllEmails
      ? replaceTextContent(baseText, rules, maskAllEmails)
      : baseText

  applyTextNodeValue(node, nextText)
}

const restoreTextSubtree = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    const textNode = root as Text
    const baseText = originalText.get(textNode)

    if (typeof baseText === "string") {
      applyTextNodeValue(textNode, baseText)
    }

    return
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()

  while (current) {
    const textNode = current as Text
    const baseText = originalText.get(textNode)

    if (typeof baseText === "string") {
      applyTextNodeValue(textNode, baseText)
    }

    current = walker.nextNode()
  }
}

const processTextSubtree = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text)
    return
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()

  while (current) {
    processTextNode(current as Text)
    current = walker.nextNode()
  }
}

const isMaskableInput = (element: HTMLInputElement) => {
  const type = element.type.toLowerCase()
  return ["", "text", "search", "email", "url", "tel"].includes(type)
}

const isMaskableControl = (
  element: Element | null
): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return true
  }

  return element instanceof HTMLInputElement && isMaskableInput(element)
}

const restoreControlValue = (element: HTMLInputElement | HTMLTextAreaElement) => {
  const baseValue = originalControlValue.get(element)

  if (maskedControls.has(element) && typeof baseValue === "string") {
    element.value = baseValue
  } else if (!originalControlValue.has(element)) {
    originalControlValue.set(element, element.value)
  } else if (element.value !== baseValue) {
    originalControlValue.set(element, element.value)
  }

  appliedControlValue.set(element, element.value)
  maskedControls.delete(element)
}

const processControlElement = (element: HTMLInputElement | HTMLTextAreaElement) => {
  if (document.activeElement === element || !shouldMaskBlurredInputs()) {
    restoreControlValue(element)
    return
  }

  const currentValue = element.value
  const previousValue = originalControlValue.get(element)
  const previousAppliedValue = appliedControlValue.get(element)

  let baseValue = previousValue ?? currentValue

  if (!originalControlValue.has(element)) {
    baseValue = currentValue
  } else if (maskedControls.has(element)) {
    if (currentValue !== previousAppliedValue) {
      baseValue = currentValue
    }
  } else if (currentValue !== previousValue) {
    baseValue = currentValue
  }

  originalControlValue.set(element, baseValue)

  const { rules, maskAllEmails } = getReplacementRules()
  const nextValue =
    rules.length || maskAllEmails
      ? replaceTextContent(baseValue, rules, maskAllEmails)
      : baseValue

  if (currentValue !== nextValue) {
    element.value = nextValue
  }

  appliedControlValue.set(element, nextValue)

  if (nextValue === baseValue) {
    maskedControls.delete(element)
  } else {
    maskedControls.add(element)
  }
}

const processControlSubtree = (root: Node) => {
  if (root instanceof Element && isMaskableControl(root)) {
    processControlElement(root)
  }

  if (!(root instanceof Element || root instanceof DocumentFragment)) {
    return
  }

  root.querySelectorAll("input, textarea").forEach((element) => {
    if (isMaskableControl(element)) {
      processControlElement(element)
    }
  })
}

const processDocumentTitle = () => {
  const { rules, maskAllEmails } = getReplacementRules()
  const nextTitle =
    rules.length || maskAllEmails
      ? replaceTextContent(rawDocumentTitle, rules, maskAllEmails)
      : rawDocumentTitle

  if (document.title === nextTitle) {
    return
  }

  applyingTitle = true
  document.title = nextTitle
  applyingTitle = false
}

const queueFullScan = () => {
  if (scheduled) {
    return
  }

  scheduled = true

  requestAnimationFrame(() => {
    scheduled = false

    if (!document.body || applying) {
      return
    }

    processTextSubtree(document.body)
    processControlSubtree(document.body)
    processDocumentTitle()
  })
}

const startContentObserver = () => {
  const observer = new MutationObserver((mutations) => {
    if (applying) {
      return
    }

    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const target = mutation.target as Text

        if (selfMutations.has(target)) {
          selfMutations.delete(target)
          continue
        }

        originalText.set(target, target.nodeValue ?? "")
        processTextNode(target)
        continue
      }

      mutation.addedNodes.forEach((node) => {
        processTextSubtree(node)
        processControlSubtree(node)
      })
    }
  })

  observer.observe(document.documentElement, {
    characterData: true,
    childList: true,
    subtree: true
  })
}

const startTitleObserver = () => {
  rawDocumentTitle = document.title

  const observer = new MutationObserver(() => {
    if (applyingTitle) {
      return
    }

    rawDocumentTitle = document.title
    processDocumentTitle()
  })

  observer.observe(document.head ?? document.documentElement, {
    characterData: true,
    childList: true,
    subtree: true
  })
}

const handleFocusIn = (event: FocusEvent) => {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  if (isMaskableControl(target)) {
    restoreControlValue(target)
    return
  }

  const editableRoot = getContentEditableRoot(target)

  if (editableRoot) {
    restoreTextSubtree(editableRoot)
  }
}

const handleFocusOut = (event: FocusEvent) => {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  requestAnimationFrame(() => {
    if (isMaskableControl(target)) {
      processControlElement(target)
      return
    }

    const editableRoot = getContentEditableRoot(target)

    if (editableRoot) {
      processTextSubtree(editableRoot)
    }
  })
}

const handleInput = (event: Event) => {
  const target = event.target

  if (!(target instanceof Element) || !isMaskableControl(target)) {
    return
  }

  originalControlValue.set(target, target.value)
  appliedControlValue.set(target, target.value)
  maskedControls.delete(target)
}

const bootstrap = async () => {
  settings = await readSettings()
  queueFullScan()
  startContentObserver()
  startTitleObserver()
  document.addEventListener("focusin", handleFocusIn)
  document.addEventListener("focusout", handleFocusOut)
  document.addEventListener("input", handleInput)

  // Use browser API for Firefox (MV2) and fall back to chrome for Chromium
  const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome
  browserApi.storage.onChanged.addListener(async () => {
    settings = await readSettings()
    queueFullScan()
  })
}

void bootstrap()
