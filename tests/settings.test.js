import { describe, expect, test } from "bun:test"

import { defaultSettings, isSiteExcluded, normalizeSettings, normalizeSite } from "../src/lib/settings.ts"

describe("normalizeSettings", () => {
  test("migrates version 1 settings", () => {
    const settings = normalizeSettings({
      enabled: false,
      maskAllEmails: false,
      blurMaskInputs: false,
      rules: [{ id: "work", email: "  User@Example.com ", replacement: "  hidden  ", enabled: false }]
    })

    expect(settings.enabled).toBe(false)
    expect(settings.maskInputs).toBe(false)
    expect(settings.detectors.email.enabled).toBe(false)
    expect(settings.detectors.creditCard.enabled).toBe(true)
    expect(settings.rules).toEqual([
      {
        id: "work",
        pattern: "user@example.com",
        replacement: "hidden",
        regex: false,
        caseSensitive: false,
        enabled: false
      }
    ])
  })

  test("keeps rules that are still being written and fixes invalid values", () => {
    const settings = normalizeSettings({
      maskStyle: "sparkles",
      detectors: { phone: { enabled: true, style: "nope", label: " " } },
      rules: [{ id: "draft", pattern: "", replacement: "" }, null],
      excludedSites: ["https://www.Example.com/path", "example.com", "", "mail.google.com"]
    })

    expect(settings.maskStyle).toBe("label")
    expect(settings.detectors.phone).toEqual({ enabled: true, style: "default", label: "[phone]" })
    expect(settings.rules.map((rule) => rule.id)).toEqual(["draft"])
    expect(settings.excludedSites).toEqual(["example.com", "mail.google.com"])
  })

  test("uses defaults when settings are absent", () => {
    expect(normalizeSettings()).toEqual(defaultSettings)
    expect(defaultSettings.rules).toEqual([])
  })

  test("drops the old placeholder rule unless the user edited it", () => {
    const placeholder = { id: "default-rule", pattern: "hello@example.com", replacement: "that's my fucking email" }
    const edited = { ...placeholder, replacement: "me" }
    expect(normalizeSettings({ rules: [placeholder] }).rules).toEqual([])
    expect(normalizeSettings({ rules: [edited] }).rules.map((rule) => rule.replacement)).toEqual(["me"])
  })
})

describe("site exclusions", () => {
  test("match the site and its subdomains only", () => {
    expect(normalizeSite("Docs.Example.com")).toBe("docs.example.com")
    expect(isSiteExcluded("app.example.com", ["example.com"])).toBe(true)
    expect(isSiteExcluded("example.com", ["example.com"])).toBe(true)
    expect(isSiteExcluded("notexample.com", ["example.com"])).toBe(false)
  })
})
