import { describe, expect, test } from "bun:test"

import { compileRule, createMasker } from "../src/lib/engine.ts"
import { normalizeSettings } from "../src/lib/settings.ts"

const only = (ids, patch = {}) => {
  const base = normalizeSettings({ rules: [] })
  for (const id of Object.keys(base.detectors)) {
    base.detectors[id].enabled = ids.includes(id)
  }
  return createMasker({ ...base, ...patch })
}

describe("detectors", () => {
  const all = createMasker(
    normalizeSettings({
      rules: [],
      detectors: Object.fromEntries(
        ["email", "phone", "creditCard", "iban", "ssn", "pesel", "ipv4", "ipv6", "mac", "secret", "crypto"].map(
          (id) => [id, { enabled: true }]
        )
      )
    })
  )

  test.each([
    ["Write to Jane.Doe+news@mail.example.co.uk today", "Write to [email] today"],
    ["Card 4111 1111 1111 1111 on file", "Card [card] on file"],
    ["Card 4111\u00a01111\u00a01111\u00a01111 on file", "Card [card] on file"],
    ["MT86MALT01100ABCDEFGHIJKLMNOPQR", "[IBAN]"],
    ["IBAN PL61 1090 1014 0000 0712 1981 2874 PLN", "IBAN [IBAN] PLN"],
    ["GB82WEST12345698765432.", "[IBAN]."],
    ["SSN 123-45-6789", "SSN [SSN]"],
    ["PESEL: 44051401359", "PESEL: [PESEL]"],
    ["host 192.168.10.254:8080", "host [IP]:8080"],
    ["addr 2001:db8:85a3::8a2e:370:7334 up", "addr [IPv6] up"],
    ["full fe80:0:0:0:202:b3ff:fe1e:8329", "full [IPv6]"],
    ["mapped ::ffff:192.0.2.128 here", "mapped [IPv6] here"],
    ["nat64 64:ff9b::192.0.2.33", "nat64 [IPv6]"],
    ["nic 00:1A:2B:3C:4D:5E", "nic [MAC]"],
    ["token ghp_1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWxYz end", "token [secret] end"],
    ["key AKIAIOSFODNN7EXAMPLE", "key [secret]"],
    ["sk-proj-abcdefghijklmnopqrstuvwxyz123456", "[secret]"],
    ["key sk-abcdefghijklmnopqrstuvwxyz", "key [secret]"],
    ["jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "jwt [secret]"],
    ["eth 0x742d35Cc6634C0532925a3b844Bc454e4438f44e", "eth [wallet]"],
    ["call +48 601 234 567 now", "call [phone] now"],
    ["call (555) 123-4567", "call [phone]"]
  ])("masks %p", (input, expected) => {
    expect(all.mask(input)).toBe(expected)
  })

  test.each([
    "Card 4111 1111 1111 1112 fails Luhn",
    "IBAN PL61 1090 1014 0000 0712 1981 2875 fails mod-97",
    "PESEL 44051401358 fails checksum",
    "PESEL 44023101353 has no February 31",
    "Released 2024-01-15 and 15.10.2024",
    "Version 1.2.3.4.5 and 999.1.1.1",
    "Meet at 10:30:00 and use std::vector",
    "Bad mapped ::ffff:192.0.2.300",
    "Order 000-12-3456 is not an SSN",
    "Plain text with numbers 42 and 1999"
  ])("leaves %p alone", (input) => {
    expect(all.mask(input)).toBe(input)
  })

  test("IPv6 alone masks the whole IPv4-mapped address", () => {
    expect(only(["ipv6"]).mask("from ::ffff:192.0.2.128.")).toBe("from [IPv6].")
  })

  test("disabled detectors do not mask", () => {
    expect(only(["email"]).mask("4111 1111 1111 1111 a@b.io")).toBe("4111 1111 1111 1111 [email]")
  })
})

describe("mask styles", () => {
  test("dots keep separators so the layout stays stable", () => {
    expect(only(["creditCard"], { maskStyle: "dots" }).mask("4111-1111-1111-1111")).toBe(
      "••••-••••-••••-••••"
    )
  })

  test("partial keeps the parts people use to recognise a value", () => {
    const masker = only(["creditCard", "email"], { maskStyle: "partial" })
    expect(masker.mask("4111 1111 1111 1111")).toBe("•••• •••• •••• 1111")
    expect(masker.mask("jane@example.com")).toBe("j•••@example.com")
  })

  test("per-detector style and label override the global style", () => {
    const settings = normalizeSettings({
      rules: [],
      maskStyle: "dots",
      detectors: { email: { enabled: true, style: "label", label: "<redacted>" } }
    })
    expect(createMasker(settings).mask("a@b.io 4111111111111111")).toBe("<redacted> ••••••••••••••••")
  })
})

describe("custom rules", () => {
  const withRules = (rules, patch = {}) => {
    const settings = normalizeSettings({ rules })
    for (const id of Object.keys(settings.detectors)) settings.detectors[id].enabled = false
    return createMasker({ ...settings, ...patch })
  }

  test("literal rules are case-insensitive and escape regex characters", () => {
    expect(withRules([{ pattern: "Acme (Inc.)", replacement: "Client" }]).mask("acme (inc.) and AcmeXInc")).toBe(
      "Client and AcmeXInc"
    )
  })

  test("literal rules keep surrounding spaces", () => {
    expect(withRules([{ pattern: " Ann ", replacement: " A. " }]).mask("Hi Ann and Annette")).toBe("Hi A. and Annette")
  })

  test("case-sensitive rules only match exact case", () => {
    expect(withRules([{ pattern: "Bob", replacement: "X", caseSensitive: true }]).mask("Bob bob")).toBe("X bob")
  })

  test("regex rules expand capture groups", () => {
    expect(
      withRules([{ pattern: "ORD-(\\d+)", replacement: "order #$1", regex: true }]).mask("see ORD-991 and ord-12")
    ).toBe("see order #991 and order #12")
  })

  test("empty replacement uses the global mask style", () => {
    expect(withRules([{ pattern: "secret", replacement: "" }], { maskStyle: "dots" }).mask("my secret")).toBe(
      "my ••••••"
    )
  })

  test("rules take priority over overlapping detectors", () => {
    const settings = normalizeSettings({ rules: [{ pattern: "hello@example.com", replacement: "me" }] })
    expect(createMasker(settings).mask("hello@example.com, other@example.com")).toBe("me, [email]")
  })

  test("invalid and empty-matching regexes are reported and skipped", () => {
    expect(compileRule({ pattern: "(", regex: true, caseSensitive: false }).error).toBeTruthy()
    expect(compileRule({ pattern: "a*", regex: true, caseSensitive: false }).error).toBe("Pattern matches empty text")
    expect(withRules([{ pattern: "(", regex: true, replacement: "x" }]).mask("a ( b")).toBe("a ( b")
  })

  test("disabled extension masks nothing", () => {
    expect(withRules([{ pattern: "x", replacement: "y" }], { enabled: false }).mask("x")).toBe("x")
  })
})
