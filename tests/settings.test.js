import { describe, expect, test } from "bun:test"

import { defaultSettings, normalizeSettings } from "../src/lib/settings.ts"

describe("normalizeSettings", () => {
  test("normalizes valid rules and removes incomplete rules", () => {
    const settings = normalizeSettings({
      enabled: false,
      maskAllEmails: false,
      blurMaskInputs: false,
      rules: [
        {
          id: "work",
          email: "  User@Example.com ",
          replacement: "  hidden  ",
          enabled: false
        },
        { id: "missing-replacement", email: "other@example.com", replacement: "", enabled: true }
      ]
    })

    expect(settings).toEqual({
      enabled: false,
      maskAllEmails: false,
      blurMaskInputs: false,
      rules: [
        {
          id: "work",
          email: "user@example.com",
          replacement: "hidden",
          enabled: false
        }
      ]
    })
  })

  test("uses defaults when settings are absent", () => {
    expect(normalizeSettings()).toEqual(defaultSettings)
  })
})
