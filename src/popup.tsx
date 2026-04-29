import { useEffect, useRef, useState } from "react"

import {
  createEmptyRule,
  defaultSettings,
  type EmailRule,
  type ExtensionSettings,
  readSettings,
  writeSettings
} from "~lib/settings"

const logoUrl = new URL("../assets/logo.png", import.meta.url).href

const BG = "#1e1e1e"
const SURFACE = "#252525"
const SURFACE_HOVER = "#2a2a2a"
const BORDER = "rgba(255,255,255,0.07)"
const TEXT = "#d4d4d4"
const TEXT_SECONDARY = "#888"
const TEXT_DIM = "#555"
const GREEN = "#4ade80"
const BLUE = "#60a5fa"
const RED = "#f87171"
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const MONO = "'SF Mono', 'Cascadia Code', 'Consolas', monospace"

function IndexPopup() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings)
  const [toast, setToast] = useState("")
  const [saving, setSaving] = useState(false)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => setSettings(await readSettings())
    void load()
    const onChange = () => void load()
    // Use browser API for Firefox (MV2) and fall back to chrome for Chromium
    const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome
    browserApi.storage.onChanged.addListener(onChange)
    return () => browserApi.storage.onChanged.removeListener(onChange)
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(""), 2000)
  }

  const save = async (next: ExtensionSettings, msg?: string) => {
    setSettings(next)
    setSaving(true)
    try {
      await writeSettings(next)
      if (msg) flash(msg)
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (id: string, patch: Partial<EmailRule>) => {
    void save(
      { ...settings, rules: settings.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) },
      "Saved"
    )
  }

  const addRule = () =>
    void save({ ...settings, rules: [...settings.rules, createEmptyRule()] }, "Added")

  const removeRule = (id: string) =>
    void save({ ...settings, rules: settings.rules.filter((r) => r.id !== id) }, "Removed")

  return (
    <main style={{ background: BG, color: TEXT, fontFamily: FONT, minWidth: 370, padding: 8 }}>
      <div style={{ background: SURFACE, borderRadius: 10, border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                alt="MailHush logo"
                src={logoUrl}
                style={{ width: 26, height: 26, borderRadius: 8, objectFit: "cover" }}
              />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                MailHush
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: MONO,
                  color: TEXT_DIM,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase"
                }}>
                v0.0.1
              </span>
            </div>
            <button
              onClick={() =>
                void save(
                  { ...settings, enabled: !settings.enabled },
                  settings.enabled ? "Paused" : "Enabled"
                )
              }
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 0",
                color: TEXT_SECONDARY,
                fontFamily: FONT,
                fontSize: 12
              }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: settings.enabled ? GREEN : TEXT_DIM
                }}
              />
              {settings.enabled ? "Active" : "Paused"}
            </button>
          </div>
          <p style={{ color: TEXT_SECONDARY, fontSize: 12, margin: "8px 0 0", lineHeight: 1.4 }}>
            Swap email addresses for custom phrases on any site.
          </p>
        </div>

        {/* Rules */}
        <div style={{ padding: "10px 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10
            }}>
            <span style={{ fontSize: 11, color: TEXT_DIM, fontWeight: 500 }}>
              RULES
            </span>
            <span style={{ fontSize: 11, color: TEXT_DIM }}>
              {settings.rules.length}
            </span>
          </div>

          {settings.rules.length === 0 ? (
            <div
              style={{
                color: TEXT_DIM,
                fontSize: 12,
                textAlign: "center",
                padding: "20px 0"
              }}>
              No rules yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {settings.rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onUpdate={(patch) => updateRule(rule.id, patch)}
                  onRemove={() => removeRule(rule.id)}
                />
              ))}
            </div>
          )}

          <button
            onClick={addRule}
            style={{
              background: "none",
              border: "none",
              color: BLUE,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 500,
              marginTop: 10,
              padding: "4px 0"
            }}>
            + Add rule
          </button>
        </div>

        {/* Footer */}
        {toast && (
          <div
            style={{
              borderTop: `1px solid ${BORDER}`,
              padding: "6px 16px",
              fontSize: 11,
              color: TEXT_SECONDARY,
              fontFamily: MONO
            }}>
            {toast}
          </div>
        )}
      </div>
    </main>
  )
}

function RuleRow({
  rule,
  onUpdate,
  onRemove
}: {
  rule: EmailRule
  onUpdate: (patch: Partial<EmailRule>) => void
  onRemove: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? SURFACE_HOVER : "transparent",
        borderRadius: 6,
        padding: "8px 10px",
        margin: "0 -10px",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: rule.enabled ? GREEN : TEXT_DIM,
            flexShrink: 0
          }}
        />
        <input
          value={rule.email}
          onChange={(e) => onUpdate({ email: e.target.value })}
          placeholder="email@example.com"
          spellCheck={false}
          style={{ ...input, flex: 1 }}
        />
        <span style={{ color: TEXT_DIM, fontSize: 11, flexShrink: 0 }}>→</span>
        <input
          value={rule.replacement}
          onChange={(e) => onUpdate({ replacement: e.target.value })}
          placeholder="replacement"
          spellCheck={false}
          style={{ ...input, flex: 1 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingLeft: 14,
          opacity: hover ? 1 : 0,
          height: hover ? 20 : 0,
          overflow: "hidden",
          transition: "opacity 0.15s, height 0.15s"
        }}>
        <button
          onClick={() => onUpdate({ enabled: !rule.enabled })}
          style={actionBtn}>
          {rule.enabled ? "Mute" : "Enable"}
        </button>
        <button
          onClick={onRemove}
          style={{ ...actionBtn, color: RED }}>
          Delete
        </button>
      </div>
    </div>
  )
}

const input: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  color: TEXT,
  fontFamily: MONO,
  fontSize: 11,
  height: 28,
  outline: "none",
  padding: "0 8px",
  width: "100%",
  boxSizing: "border-box"
}

const actionBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: TEXT_SECONDARY,
  cursor: "pointer",
  fontFamily: FONT,
  fontSize: 11,
  padding: 0
}

export default IndexPopup
