import { Storage } from "@plasmohq/storage"

export interface EmailRule {
  id: string
  email: string
  replacement: string
  enabled: boolean
}

export interface ExtensionSettings {
  enabled: boolean
  rules: EmailRule[]
}

const storage = new Storage()

export const settingsKey = "mailhush-settings"

export const defaultSettings: ExtensionSettings = {
  enabled: true,
  rules: [
    {
      id: "default-rule",
      email: "hello@example.com",
      replacement: "that's my fucking email",
      enabled: true
    }
  ]
}

const normalizeRule = (rule: Partial<EmailRule> | null | undefined): EmailRule | null => {
  const email =
    typeof rule?.email === "string" ? rule.email.trim().toLowerCase() : ""
  const replacement =
    typeof rule?.replacement === "string" ? rule.replacement.trim() : ""

  if (!email || !replacement) {
    return null
  }

  return {
    id:
      typeof rule?.id === "string" && rule.id.trim().length > 0
        ? rule.id
        : crypto.randomUUID(),
    email,
    replacement,
    enabled: rule?.enabled !== false
  }
}

export const normalizeSettings = (
  input?: Partial<ExtensionSettings> | null
): ExtensionSettings => {
  const rules = Array.isArray(input?.rules)
    ? input.rules
        .map((rule) => normalizeRule(rule))
        .filter((rule): rule is EmailRule => rule !== null)
    : defaultSettings.rules

  return {
    enabled: input?.enabled !== false,
    rules
  }
}

export const readSettings = async (): Promise<ExtensionSettings> => {
  const stored = await storage.get(settingsKey)
  return normalizeSettings(stored as Partial<ExtensionSettings> | null | undefined)
}

export const writeSettings = async (settings: ExtensionSettings) => {
  await storage.set(settingsKey, normalizeSettings(settings))
}

export const createEmptyRule = (): EmailRule => ({
  id: crypto.randomUUID(),
  email: "",
  replacement: "",
  enabled: true
})
