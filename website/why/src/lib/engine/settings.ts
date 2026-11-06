// Types from the extension's src/lib/settings.ts that engine.ts needs. The real
// module also sets up extension storage, which the website must not bundle.
import type { DetectorId } from "./detectors"

export type MaskStyle = "label" | "dots" | "partial"
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
