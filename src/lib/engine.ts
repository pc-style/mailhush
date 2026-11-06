import { detectors, dots, keepLast, type Detector } from "./detectors"
import type { CustomRule, ExtensionSettings, MaskStyle } from "./settings"

export interface Masker {
  /** Returns the masked text, or the same string when nothing matched. */
  mask: (text: string) => string
}

interface Matcher {
  pattern: RegExp
  minLength: number
  minDigits: number
  needs?: string
  hint?: RegExp
  accept?: (match: string) => number
  replace: (match: string, groups: RegExpExecArray) => string
}

interface Hit {
  start: number
  end: number
  replacement: string
}

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const styled = (style: MaskStyle, label: string, partial = (match: string) => keepLast(match, 4)) => {
  if (style === "dots") return dots
  if (style === "partial") return partial
  return () => label
}

/** Compiles a custom rule, or explains why it cannot be used. */
export const compileRule = (rule: Pick<CustomRule, "pattern" | "regex" | "caseSensitive">) => {
  if (!rule.pattern) return { error: "Empty pattern" }

  const source = rule.regex ? rule.pattern : escapeForRegExp(rule.pattern)
  try {
    const pattern = new RegExp(source, rule.caseSensitive ? "g" : "gi")
    if (pattern.test("")) return { error: "Pattern matches empty text" }
    return { pattern }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid pattern" }
  }
}

// Expands $& and $1–$9 in a rule's replacement.
const expand = (replacement: string, groups: RegExpExecArray) =>
  replacement.replace(/\$(&|\d)/g, (_, key: string) =>
    key === "&" ? groups[0] : groups[Number(key)] ?? ""
  )

const ruleMatcher = (rule: CustomRule, style: MaskStyle): Matcher | null => {
  const { pattern } = compileRule(rule)
  if (!pattern) return null

  const fallback = styled(style, "[hidden]")
  return {
    pattern,
    minLength: rule.regex ? 0 : rule.pattern.length,
    minDigits: 0,
    replace: rule.replacement
      ? (_, groups) => (rule.regex ? expand(rule.replacement, groups) : rule.replacement)
      : (match) => fallback(match)
  }
}

const detectorMatcher = (detector: Detector, settings: ExtensionSettings): Matcher => {
  const config = settings.detectors[detector.id]
  const style = config.style === "default" ? settings.maskStyle : config.style
  return {
    pattern: new RegExp(detector.pattern.source, detector.pattern.flags),
    minLength: detector.minLength,
    minDigits: detector.minDigits ?? 0,
    needs: detector.needs,
    hint: detector.hint,
    accept: detector.accept,
    replace: styled(style, config.label, detector.partial)
  }
}

const countDigits = (text: string) => {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code >= 48 && code <= 57) count += 1
  }
  return count
}

const hasAny = (text: string, chars: string) => {
  for (let index = 0; index < chars.length; index += 1) {
    if (text.includes(chars[index])) return true
  }
  return false
}

const overlaps = (hits: Hit[], start: number, end: number) =>
  hits.some((hit) => start < hit.end && end > hit.start)

/**
 * Builds a masker for the given settings. Custom rules win over detectors, and
 * detectors win in list order; a match that overlaps an earlier one is dropped.
 */
export const createMasker = (settings: ExtensionSettings): Masker => {
  const matchers: Matcher[] = []

  if (settings.enabled) {
    for (const rule of settings.rules) {
      const matcher = rule.enabled ? ruleMatcher(rule, settings.maskStyle) : null
      if (matcher) matchers.push(matcher)
    }
    for (const detector of detectors) {
      if (settings.detectors[detector.id].enabled) {
        matchers.push(detectorMatcher(detector, settings))
      }
    }
  }

  if (matchers.length === 0) {
    return { mask: (text) => text }
  }

  return {
    mask(text) {
      let hits: Hit[] | null = null
      let digits = -1

      for (const matcher of matchers) {
        if (text.length < matcher.minLength) continue
        if (matcher.minDigits) {
          if (digits < 0) digits = countDigits(text)
          if (digits < matcher.minDigits) continue
        }
        if (matcher.needs && !hasAny(text, matcher.needs)) continue
        if (matcher.hint && !matcher.hint.test(text)) continue

        const { pattern } = matcher
        pattern.lastIndex = 0
        let found: RegExpExecArray | null

        while ((found = pattern.exec(text))) {
          const start = found.index
          const length = matcher.accept ? matcher.accept(found[0]) : found[0].length

          if (length === 0) {
            pattern.lastIndex = start + 1
            continue
          }

          const end = start + length
          if (!hits) hits = []
          if (!overlaps(hits, start, end)) {
            hits.push({ start, end, replacement: matcher.replace(text.slice(start, end), found) })
          }
          pattern.lastIndex = end
        }
      }

      if (!hits) return text

      hits.sort((left, right) => left.start - right.start)
      let output = ""
      let cursor = 0
      for (const hit of hits) {
        output += text.slice(cursor, hit.start) + hit.replacement
        cursor = hit.end
      }
      return output + text.slice(cursor)
    }
  }
}
