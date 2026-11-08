import { Storage } from "@plasmohq/storage"

import { detectors, type DetectorId } from "./detectors"

export type MaskStyle = "label" | "dots" | "partial"

export const maskStyles: { id: MaskStyle; name: string }[] = [
  { id: "label", name: "Label" },
  { id: "dots", name: "Dots" },
  { id: "partial", name: "Partial" }
]

export interface DetectorSettings {
  enabled: boolean
  // "default" follows the global mask style.
  style: MaskStyle | "default"
  label: string
}

export interface CustomRule {
  id: string
  pattern: string
  // Empty replacement uses the global mask style.
  replacement: string
  regex: boolean
  caseSensitive: boolean
  enabled: boolean
}

export interface ExtensionSettings {
  enabled: boolean
  maskStyle: MaskStyle
  detectors: Record<DetectorId, DetectorSettings>
  rules: CustomRule[]
  maskInputs: boolean
  maskAttributes: boolean
  maskTitle: boolean
  excludedSites: string[]
}

// Settings are written on every edit, which would exceed storage.sync's
// write quota, so they live in local storage. Version 1 used sync.
const storage = new Storage({ area: "local" })
const legacyStorage = new Storage({ area: "sync" })

export const settingsKey = "mailhush-settings"

const defaultDetectors = () =>
  Object.fromEntries(
    detectors.map((detector) => [
      detector.id,
      { enabled: detector.defaultEnabled, style: "default", label: detector.label }
    ])
  ) as Record<DetectorId, DetectorSettings>

export const defaultSettings: ExtensionSettings = {
  enabled: true,
  maskStyle: "label",
  detectors: defaultDetectors(),
  rules: [],
  maskInputs: true,
  maskAttributes: true,
  maskTitle: true,
  excludedSites: []
}

const isMaskStyle = (value: unknown): value is MaskStyle =>
  maskStyles.some((style) => style.id === value)

const text = (value: unknown) => (typeof value === "string" ? value : "")

type StoredRule = Partial<CustomRule> & { email?: unknown }

const normalizeRule = (rule: StoredRule | null | undefined): CustomRule | null => {
  if (!rule || typeof rule !== "object") return null

  // Version 1 stored literal email addresses in `email`.
  const legacy = typeof rule.email === "string" && rule.pattern === undefined
  const pattern = legacy ? text(rule.email).trim().toLowerCase() : text(rule.pattern)

  return {
    id: text(rule.id).trim() || crypto.randomUUID(),
    // Surrounding spaces are meaningful: " Ann " should not match "Annette".
    pattern,
    replacement: legacy ? text(rule.replacement).trim() : text(rule.replacement),
    regex: rule.regex === true,
    caseSensitive: rule.caseSensitive === true,
    enabled: rule.enabled !== false
  }
}

/** Accepts a hostname or URL and returns the bare hostname, or "". */
export const normalizeSite = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""
  try {
    const host = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname
    return host.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export const isSiteExcluded = (hostname: string, excludedSites: string[]) => {
  const host = hostname.toLowerCase()
  return excludedSites.some((site) => host === site || host.endsWith(`.${site}`))
}

// Matches the placeholder without spelling it out in the shipped bundle.
const isOldPlaceholderRule = (rule: CustomRule) =>
  rule.id === "default-rule" &&
  rule.pattern === "hello@example.com" &&
  rule.replacement.startsWith("that's my f") &&
  rule.replacement.endsWith(" email") &&
  rule.replacement.length === 23

type StoredSettings = Partial<Omit<ExtensionSettings, "detectors" | "rules">> & {
  detectors?: Partial<Record<DetectorId, Partial<DetectorSettings>>>
  rules?: StoredRule[]
  // Version 1 fields.
  maskAllEmails?: boolean
  blurMaskInputs?: boolean
}

export const normalizeSettings = (input?: StoredSettings | null): ExtensionSettings => {
  const stored = input && typeof input === "object" ? input : {}
  const storedDetectors = stored.detectors && typeof stored.detectors === "object" ? stored.detectors : {}

  const detectorSettings = Object.fromEntries(
    detectors.map((detector) => {
      const saved = storedDetectors[detector.id] ?? {}
      const legacyEnabled = detector.id === "email" ? stored.maskAllEmails : undefined
      const enabled =
        typeof saved.enabled === "boolean"
          ? saved.enabled
          : typeof legacyEnabled === "boolean"
            ? legacyEnabled
            : detector.defaultEnabled

      return [
        detector.id,
        {
          enabled,
          style: isMaskStyle(saved.style) ? saved.style : "default",
          label: text(saved.label).trim() || detector.label
        }
      ]
    })
  ) as Record<DetectorId, DetectorSettings>

  const rules = Array.isArray(stored.rules)
    ? stored.rules
        .map(normalizeRule)
        .filter((rule): rule is CustomRule => rule !== null)
        // 2.0.0 and 2.0.1 shipped a crude placeholder rule; drop it unless the user changed it.
        .filter((rule) => !isOldPlaceholderRule(rule))
    : defaultSettings.rules

  const excludedSites = Array.isArray(stored.excludedSites)
    ? [...new Set(stored.excludedSites.map((site) => normalizeSite(text(site))).filter(Boolean))]
    : []

  return {
    enabled: stored.enabled !== false,
    maskStyle: isMaskStyle(stored.maskStyle) ? stored.maskStyle : defaultSettings.maskStyle,
    detectors: detectorSettings,
    rules,
    maskInputs: (stored.maskInputs ?? stored.blurMaskInputs) !== false,
    maskAttributes: stored.maskAttributes !== false,
    maskTitle: stored.maskTitle !== false,
    excludedSites
  }
}

export const readSettings = async (): Promise<ExtensionSettings> => {
  const stored = (await storage.get(settingsKey)) ?? (await legacyStorage.get(settingsKey))
  return normalizeSettings(stored as StoredSettings | null | undefined)
}

export const writeSettings = async (settings: ExtensionSettings) => {
  await storage.set(settingsKey, normalizeSettings(settings))
}

export const createEmptyRule = (): CustomRule => ({
  id: crypto.randomUUID(),
  pattern: "",
  replacement: "",
  regex: false,
  caseSensitive: false,
  enabled: true
})
