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
const originalText = new WeakMap<Text, string>()
const selfMutations = new WeakSet<Text>()

const escapeForRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const getActiveRules = () =>
  (settings?.enabled ? settings.rules : []).filter(
    (rule) => rule.enabled && rule.email && rule.replacement
  )

const isEditable = (element: Element | null) =>
  Boolean(
    element &&
      ((element as HTMLElement).isContentEditable ||
        element.closest("[contenteditable='true']"))
  )

const shouldSkipNode = (node: Text) => {
  const parent = node.parentElement

  if (!parent) {
    return true
  }

  if (blockedParents.has(parent.tagName) || isEditable(parent)) {
    return true
  }

  return !node.nodeValue || node.nodeValue.trim().length === 0
}

const replaceTextContent = (text: string, rules: EmailRule[]) => {
  let nextText = text

  for (const rule of rules) {
    const pattern = new RegExp(escapeForRegExp(rule.email), "gi")
    nextText = nextText.replace(pattern, rule.replacement)
  }

  return nextText
}

const processTextNode = (node: Text) => {
  if (shouldSkipNode(node)) {
    return
  }

  const rules = getActiveRules()
  const baseText = originalText.get(node) ?? node.nodeValue ?? ""

  if (!originalText.has(node)) {
    originalText.set(node, baseText)
  }

  const nextText = rules.length ? replaceTextContent(baseText, rules) : baseText

  if ((node.nodeValue ?? "") === nextText) {
    return
  }

  applying = true
  selfMutations.add(node)
  node.nodeValue = nextText
  applying = false
}

const processSubtree = (root: Node) => {
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

    processSubtree(document.body)
  })
}

const startObserver = () => {
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
        processSubtree(node)
      })
    }
  })

  observer.observe(document.documentElement, {
    characterData: true,
    childList: true,
    subtree: true
  })
}

const bootstrap = async () => {
  settings = await readSettings()
  queueFullScan()
  startObserver()

  chrome.storage.onChanged.addListener(async () => {
    settings = await readSettings()
    queueFullScan()
  })
}

void bootstrap()
