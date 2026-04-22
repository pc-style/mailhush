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
  let changed = false

  for (const rule of rules) {
    const pattern = new RegExp(escapeForRegExp(rule.email), "gi")
    const replaced = nextText.replace(pattern, rule.replacement)

    if (replaced !== nextText) {
      nextText = replaced
      changed = true
    }
  }

  return changed ? nextText : null
}

const processTextNode = (node: Text) => {
  const rules = getActiveRules()

  if (!rules.length || shouldSkipNode(node)) {
    return
  }

  const nextText = replaceTextContent(node.nodeValue ?? "", rules)

  if (nextText === null) {
    return
  }

  applying = true
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
    if (applying || !getActiveRules().length) {
      return
    }

    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        processTextNode(mutation.target as Text)
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
