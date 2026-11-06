// Built-in PII detectors. Each detector finds candidates with a global regular
// expression, then optionally validates them (checksums, structure) so that
// random numbers on a page are not masked by accident.

export type DetectorId =
  | "email"
  | "phone"
  | "creditCard"
  | "iban"
  | "ssn"
  | "pesel"
  | "ipv4"
  | "ipv6"
  | "mac"
  | "secret"
  | "crypto"

export interface Detector {
  id: DetectorId
  name: string
  description: string
  example: string
  label: string
  defaultEnabled: boolean
  // Cheap gates checked before the pattern runs: most page text fails them,
  // so most text nodes never reach a regular expression.
  minLength: number
  minDigits?: number
  // At least one of these characters must appear.
  needs?: string
  // A cheap regular expression that must match.
  hint?: RegExp
  pattern: RegExp
  // Returns the length of the accepted match (which may be shorter than the
  // regex match), or 0 to reject it.
  accept?: (match: string) => number
  // Partial mask: which characters stay visible.
  partial?: (match: string) => string
}

const BULLET = "•"

const isAlnum = (char: string) => /[\p{L}\p{N}]/u.test(char)

/** Masks every letter and digit, keeping separators so the shape stays readable. */
export const dots = (value: string) =>
  Array.from(value, (char) => (isAlnum(char) ? BULLET : char)).join("")

/** Masks all but the last `keep` letters and digits. */
export const keepLast = (value: string, keep: number) => {
  const chars = Array.from(value)
  let visible = 0
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if (!isAlnum(chars[index])) continue
    if (visible < keep) {
      visible += 1
    } else {
      chars[index] = BULLET
    }
  }
  return chars.join("")
}

const digitsOf = (value: string) => value.replace(/\D/g, "")

const luhn = (digits: string) => {
  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

// IBAN lengths from the SWIFT IBAN registry.
const ibanLengths: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19,
  MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20
}

const acceptIban = (match: string) => {
  const expected = ibanLengths[match.slice(0, 2)]
  if (!expected) return 0

  // Walk the match until `expected` alphanumerics are consumed; the regex may
  // have run into a following uppercase word.
  let count = 0
  let end = 0
  while (end < match.length && count < expected) {
    if (match[end] !== " ") count += 1
    end += 1
  }
  if (count !== expected) return 0
  if (end < match.length && match[end] !== " ") return 0

  const compact = match.slice(0, end).replace(/ /g, "")
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const value = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1 ? end : 0
}

const acceptPesel = (match: string) => {
  const digits = Array.from(match, Number)
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  const sum = weights.reduce((total, weight, index) => total + weight * digits[index], 0)
  if ((10 - (sum % 10)) % 10 !== digits[10]) return 0

  // The month carries the century: +80 for 1800s, +0 for 1900s, +20 for 2000s, and so on.
  const encodedMonth = digits[2] * 10 + digits[3]
  const century = [1900, 2000, 2100, 2200, 1800][Math.floor(encodedMonth / 20)]
  const month = encodedMonth % 20
  const day = digits[4] * 10 + digits[5]
  if (month < 1 || month > 12 || day < 1) return 0
  const year = century + digits[0] * 10 + digits[1]
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate() ? match.length : 0
}

const acceptIpv6 = (match: string) => {
  // An embedded IPv4 address (::ffff:192.0.2.1) takes the place of two groups.
  const embedded = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(match)
  // Same octet rules as the IPv4 detector: 0–255, no leading zeros.
  if (embedded && embedded[1].split(".").some((octet) => Number(octet) > 255 || /^0\d/.test(octet))) return 0
  const address = embedded ? match.slice(0, embedded.index + 1) + "0:0" : match
  if (!embedded && match.includes(".")) return 0

  const halves = address.split("::")
  if (halves.length > 2) return 0
  const groups = halves.flatMap((half) => (half ? half.split(":") : []))
  if (groups.length === 0 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return 0
  if (halves.length === 2 ? groups.length > 7 : groups.length !== 8) return 0
  // A compressed address needs at least two groups to look like an address,
  // which keeps things like `a::b` in code samples unmasked.
  if (halves.length === 2 && groups.length < 2) return 0
  return match.length
}

const datePattern = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/

const acceptPhone = (match: string) => {
  const digitCount = digitsOf(match).length
  if (digitCount < 7 || digitCount > 15) return 0
  if (datePattern.test(match)) return 0
  return match.length
}

const acceptCard = (match: string) => {
  const digits = digitsOf(match)
  return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? match.length : 0
}

export const detectors: Detector[] = [
  {
    id: "email",
    name: "Email addresses",
    description: "Any address shaped like name@domain.tld.",
    example: "jane.doe@example.com",
    label: "[email]",
    defaultEnabled: true,
    minLength: 6,
    needs: "@",
    pattern: /(?<![\w.%+-])[\w.%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}(?![\w-])/gi,
    partial: (match) => {
      const at = match.indexOf("@")
      return match[0] + BULLET.repeat(Math.max(at - 1, 1)) + match.slice(at)
    }
  },
  {
    id: "secret",
    name: "API keys & tokens",
    description: "AWS, GitHub, Stripe, Slack, OpenAI, Anthropic, Google keys, JWTs and private keys.",
    example: "ghp_1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWxYz",
    label: "[secret]",
    defaultEnabled: true,
    minLength: 20,
    pattern: new RegExp(
      [
        String.raw`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`,
        String.raw`\bgh[pousr]_[A-Za-z0-9]{36,255}\b`,
        String.raw`\bgithub_pat_[A-Za-z0-9_]{22,255}\b`,
        String.raw`\b[rsp]k_(?:live|test)_[A-Za-z0-9]{16,}\b`,
        String.raw`\bxox[abposr]-[A-Za-z0-9-]{10,}`,
        String.raw`\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}`,
        String.raw`\bAIza[0-9A-Za-z_-]{35}`,
        String.raw`\bglpat-[A-Za-z0-9_-]{20,}`,
        String.raw`\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`,
        String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----`
      ].join("|"),
      "g"
    ),
    partial: (match) => match.slice(0, 4) + dots(match.slice(4))
  },
  {
    id: "iban",
    name: "Bank accounts (IBAN)",
    description: "International bank account numbers with a valid mod-97 checksum.",
    example: "PL61 1090 1014 0000 0712 1981 2874",
    label: "[IBAN]",
    defaultEnabled: true,
    minDigits: 2,
    minLength: 15,
    pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g,
    accept: acceptIban,
    partial: (match) => keepLast(match, 4)
  },
  {
    id: "creditCard",
    name: "Card numbers",
    description: "13–19 digit payment card numbers that pass the Luhn checksum.",
    example: "4111 1111 1111 1111",
    label: "[card]",
    defaultEnabled: true,
    minDigits: 13,
    // The leading \d lets the regex engine skip non-digits before running the lookbehind.
    minLength: 13,
    pattern: /\d(?<!\d[ \u00a0\u202f-]?\d)(?:[ \u00a0\u202f-]?\d){12,18}(?![ \u00a0\u202f-]?\d)/g,
    accept: acceptCard,
    partial: (match) => keepLast(match, 4)
  },
  {
    id: "ssn",
    name: "US Social Security numbers",
    description: "Numbers formatted as 123-45-6789.",
    example: "123-45-6789",
    label: "[SSN]",
    defaultEnabled: false,
    minDigits: 9,
    minLength: 11,
    needs: "-",
    hint: /\d-\d\d-\d/,
    pattern: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    partial: (match) => keepLast(match, 4)
  },
  {
    id: "pesel",
    name: "PESEL",
    description: "Polish national ID numbers with a valid checksum and birth date.",
    example: "44051401359",
    label: "[PESEL]",
    defaultEnabled: false,
    minDigits: 11,
    minLength: 11,
    pattern: /\b\d{11}\b/g,
    accept: acceptPesel,
    partial: (match) => keepLast(match, 3)
  },
  // Before IPv4, so an IPv4-mapped IPv6 address is masked whole.
  {
    id: "ipv6",
    name: "IPv6 addresses",
    description: "Full and compressed IPv6 addresses.",
    example: "2001:db8:85a3::8a2e:370:7334",
    label: "[IPv6]",
    defaultEnabled: false,
    minLength: 6,
    needs: ":",
    hint: /[0-9a-f]:[0-9a-f:]/i,
    pattern: /(?<![\w:.])[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}(?:\.\d{1,3}){0,3}(?![\w:]|\.\d)/gi,
    accept: acceptIpv6,
    partial: (match) => keepLast(match, 4)
  },
  {
    id: "ipv4",
    name: "IPv4 addresses",
    description: "Dotted addresses such as 192.168.1.20.",
    example: "203.0.113.42",
    label: "[IP]",
    defaultEnabled: false,
    minDigits: 4,
    minLength: 7,
    needs: ".",
    hint: /\d\.\d/,
    pattern:
      /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?!\.?\d)/g,
    partial: (match) => match.replace(/\.\d+\.\d+$/, (tail) => tail.replace(/\d/g, BULLET))
  },
  {
    id: "mac",
    name: "MAC addresses",
    description: "Hardware addresses such as 00:1A:2B:3C:4D:5E.",
    example: "00:1A:2B:3C:4D:5E",
    label: "[MAC]",
    defaultEnabled: false,
    minLength: 17,
    needs: ":-",
    hint: /[0-9a-f]{2}[:-][0-9a-f]{2}[:-]/i,
    pattern: /\b[0-9a-f]{2}([:-])[0-9a-f]{2}(?:\1[0-9a-f]{2}){4}\b/gi,
    partial: (match) => keepLast(match, 4)
  },
  {
    id: "crypto",
    name: "Crypto wallets",
    description: "Bitcoin and Ethereum wallet addresses.",
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    label: "[wallet]",
    defaultEnabled: false,
    minLength: 26,
    minDigits: 1,
    pattern: /\b(?:bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40})\b/g,
    partial: (match) => match.slice(0, 6) + dots(match.slice(6, -4)) + match.slice(-4)
  },
  {
    id: "phone",
    name: "Phone numbers",
    description: "International (+48 …) and grouped local numbers with 7–15 digits.",
    example: "+1 (555) 123-4567",
    label: "[phone]",
    defaultEnabled: false,
    minDigits: 7,
    minLength: 7,
    pattern:
      /(?<![\w+.-]|\d[ .-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?|\d{1,4}[ .-])(?:\d{2,4}[ .-]){1,4}\d{2,4}(?![\w-]|[ .-]\d)|(?<![\w+])\+\d{7,15}\b/g,
    accept: acceptPhone,
    partial: (match) => keepLast(match, 2)
  }
]

export const detectorIds = detectors.map((detector) => detector.id)
