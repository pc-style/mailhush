import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react"

import { detectors, type Detector, type DetectorId } from "~lib/detectors"
import { compileRule, createMasker } from "~lib/engine"
import {
  createEmptyRule,
  defaultSettings,
  isSiteExcluded,
  maskStyles,
  normalizeSettings,
  normalizeSite,
  readSettings,
  settingsKey,
  writeSettings,
  type CustomRule,
  type DetectorSettings,
  type ExtensionSettings,
  type MaskStyle
} from "~lib/settings"

import { styles } from "./styles"

const logoUrl = new URL("../../assets/logo.png", import.meta.url).href
const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome

const sampleText = `Contact jane.doe@example.com or +48 601 234 567.
Card 4111 1111 1111 1111, IBAN PL61 1090 1014 0000 0712 1981 2874.
Server 203.0.113.42, token ghp_1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWxYz`

const useActiveHost = () => {
  const [host, setHost] = useState("")
  useEffect(() => {
    void browserApi.tabs
      ?.query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => {
        const url = tab?.url ? new URL(tab.url) : null
        if (url && /^https?:$/.test(url.protocol)) setHost(url.hostname)
      })
      .catch(() => undefined)
  }, [])
  return host
}

const useShortcut = () => {
  const [shortcut, setShortcut] = useState("")
  useEffect(() => {
    void browserApi.commands
      ?.getAll()
      .then((commands) => setShortcut(commands.find((entry) => entry.name === "toggle-mailhush")?.shortcut ?? ""))
      .catch(() => undefined)
  }, [])
  return shortcut
}

export function SettingsApp({ page = false }: { page?: boolean }) {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings)
  const [toast, setToast] = useState("")
  const writes = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWritten = useRef("")
  // Edits made before stored settings load would overwrite them with defaults.
  const loaded = useRef(false)
  const host = useActiveHost()
  const shortcut = useShortcut()
  const version = browserApi.runtime?.getManifest?.().version ?? ""

  useEffect(() => {
    const load = async () => {
      const stored = await readSettings()
      loaded.current = true
      // Ignore echoes of this page's own writes so typing is not interrupted.
      if (writes.current > 0 || JSON.stringify(stored) === lastWritten.current) return
      setSettings(stored)
    }
    void load()
    const onChange = (changes: Record<string, unknown>) => {
      if (settingsKey in changes) void load()
    }
    browserApi.storage.onChanged.addListener(onChange)
    return () => browserApi.storage.onChanged.removeListener(onChange)
  }, [])

  const flash = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 1800)
  }

  // Every change is written at once, so closing the popup mid-edit loses
  // nothing; content scripts debounce their rescans instead.
  const save = async (next: ExtensionSettings, message?: string) => {
    if (!loaded.current) return
    setSettings(next)
    lastWritten.current = JSON.stringify(normalizeSettings(next))
    writes.current += 1
    try {
      await writeSettings(next)
      if (message) flash(message)
    } catch (error) {
      // Show what is actually stored, so the screen never claims an unsaved change.
      setSettings(await readSettings().catch(() => settings))
      flash(error instanceof Error ? error.message : "Could not save settings")
    } finally {
      writes.current -= 1
    }
  }

  const patch = (changes: Partial<ExtensionSettings>, message?: string) =>
    save({ ...settings, ...changes }, message)

  const patchDetector = (id: DetectorId, changes: Partial<DetectorSettings>) =>
    save({ ...settings, detectors: { ...settings.detectors, [id]: { ...settings.detectors[id], ...changes } } })

  const patchRule = (id: string, changes: Partial<CustomRule>) =>
    save({ ...settings, rules: settings.rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)) })

  // A skip can come from a parent domain, which also covers its other subdomains.
  const skippedBy = host ? settings.excludedSites.filter((entry) => isSiteExcluded(host, [entry])) : []
  const siteExcluded = skippedBy.length > 0
  const skippedViaParent = skippedBy.filter((entry) => entry !== normalizeSite(host))
  const toggleSite = () => {
    const site = normalizeSite(host)
    const unskipped = skippedViaParent.length
      ? `Masking ${skippedBy.join(", ")} and subdomains again`
      : `Masking ${site} again`
    patch(
      {
        excludedSites: siteExcluded
          ? settings.excludedSites.filter((entry) => !skippedBy.includes(entry))
          : [...settings.excludedSites, site]
      },
      siteExcluded ? unskipped : `Skipping ${site}`
    )
  }

  const enabledCount = detectors.filter((detector) => settings.detectors[detector.id].enabled).length

  const masterSwitch = (
    <Switch
      checked={settings.enabled}
      label="Enable MailHush"
      onChange={(enabled) => patch({ enabled }, enabled ? "Masking on" : "Masking paused everywhere")}
    />
  )

  const shortcutHint = shortcut ? (
    <>
      <kbd>{shortcut}</kbd> toggles masking
    </>
  ) : (
    "Set a toggle shortcut in your browser's extension settings"
  )

  const maskStyleContent = (
    <>
      <MaskStylePicker onChange={(maskStyle) => patch({ maskStyle })} value={settings.maskStyle} />
      <StylePreview settings={settings} />
    </>
  )

  const detectorContent = (
    <div className="list">
      {detectors.map((detector) => (
        <DetectorRow
          config={settings.detectors[detector.id]}
          detector={detector}
          key={detector.id}
          onChange={(changes) => patchDetector(detector.id, changes)}
          settings={settings}
        />
      ))}
    </div>
  )

  const ruleContent = (
    <>
      <p className="hint">
        Mask exact text or a regular expression. Rules run before detectors. Leave the replacement empty to use the
        mask style; regex replacements can use $1.
      </p>
      <div className="rules">
        {settings.rules.map((rule, index) => (
          <RuleRow
            key={rule.id}
            number={index + 1}
            onChange={(changes) => patchRule(rule.id, changes)}
            onRemove={() =>
              save({ ...settings, rules: settings.rules.filter((entry) => entry.id !== rule.id) }, "Rule removed")
            }
            rule={rule}
          />
        ))}
      </div>
      <button
        className="link add"
        onClick={() => save({ ...settings, rules: [...settings.rules, createEmptyRule()] })}
        type="button">
        + Add rule
      </button>
    </>
  )

  const behaviorContent = (
    <>
      <Toggle
        checked={settings.maskInputs}
        description="Mask text fields and editors until you focus them. Forms still submit what you typed."
        label="Form fields"
        onChange={(maskInputs) => patch({ maskInputs })}
      />
      <Toggle
        checked={settings.maskAttributes}
        description="Mask tooltips, image alt text, placeholders, and ARIA labels."
        label="Tooltips & labels"
        onChange={(maskAttributes) => patch({ maskAttributes })}
      />
      <Toggle
        checked={settings.maskTitle}
        description="Mask the tab title."
        label="Tab title"
        onChange={(maskTitle) => patch({ maskTitle })}
      />
    </>
  )

  const siteContent = (
    <SiteList onChange={(excludedSites) => patch({ excludedSites })} sites={settings.excludedSites} />
  )

  const toastRegion = (
    <div aria-live="polite" className={toast ? "toast visible" : "toast"}>
      {toast}
    </div>
  )

  if (page) {
    const tabs: PageTab[] = [
      {
        id: "general",
        name: "General",
        icon: "M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4",
        description: "How masked values look and which parts of a page MailHush covers.",
        body: (
          <>
            <Section title="Mask style">{maskStyleContent}</Section>
            <Section title="Where to mask">{behaviorContent}</Section>
          </>
        )
      },
      {
        id: "detectors",
        name: "Detectors",
        icon: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z",
        count: `${enabledCount}/${detectors.length}`,
        description: "Built-in detectors for common personal data. Expand one to give it its own style or label.",
        body: <Section>{detectorContent}</Section>
      },
      {
        id: "rules",
        name: "Custom rules",
        icon: "M8 6l-5 6 5 6M16 6l5 6-5 6",
        count: String(settings.rules.length),
        description: "Your own words and patterns to hide, such as names, project codes, or order numbers.",
        body: <Section>{ruleContent}</Section>
      },
      {
        id: "sites",
        name: "Skipped sites",
        icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8",
        count: String(settings.excludedSites.length),
        description: "MailHush does nothing on these sites and their subdomains.",
        body: <Section>{siteContent}</Section>
      },
      {
        id: "test",
        name: "Test",
        icon: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",
        description: "Paste any text to see what MailHush hides with your current settings.",
        body: (
          <Section>
            <TestBox settings={settings} />
          </Section>
        )
      },
      {
        id: "backup",
        name: "Backup",
        icon: "M12 4v11M7 10l5 5 5-5M5 20h14",
        description: "Save your settings to a file, or load them in another browser.",
        body: (
          <Section>
            <Backup onError={flash} onImport={(next) => save(next, "Settings imported")} settings={settings} />
          </Section>
        )
      }
    ]

    return (
      <>
        <style>{styles}</style>
        <SettingsPage
          masterSwitch={masterSwitch}
          enabled={settings.enabled}
          skippedCount={settings.excludedSites.length}
          shortcutHint={shortcutHint}
          tabs={tabs}
          version={version}
        />
        {toastRegion}
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>
      <main className="app">
        <header className="header">
          <img alt="" className="logo" src={logoUrl} />
          <div className="title">
            <h1>MailHush</h1>
            {version && <span className="version">v{version}</span>}
          </div>
          {!settings.enabled && <span className="paused-badge">Paused</span>}
          {masterSwitch}
        </header>

        {host && (
          <div className={`site ${!settings.enabled ? "site-paused" : siteExcluded ? "site-off" : ""}`}>
            <span className="dot" />
            <span className="site-host" title={host}>
              {host}
            </span>
            <span className="site-state">
              {!settings.enabled
                ? "paused everywhere"
                : skippedViaParent.length
                  ? `skipped via ${skippedViaParent[0]}`
                  : siteExcluded
                    ? "skipped"
                    : "masking"}
            </span>
            <button className="link" onClick={toggleSite} type="button">
              {siteExcluded ? "Stop skipping" : "Skip this site"}
            </button>
          </div>
        )}

        <div className="body">
          <Section title="Mask style">{maskStyleContent}</Section>
          <Section count={`${enabledCount}/${detectors.length}`} title="Detect">
            {detectorContent}
          </Section>
          <Section count={String(settings.rules.length)} title="Custom rules">
            {ruleContent}
          </Section>
          <Section title="Test">
            <TestBox settings={settings} />
          </Section>
          <Section title="Where to mask">{behaviorContent}</Section>
          <Section count={String(settings.excludedSites.length)} title="Skipped sites">
            {siteContent}
          </Section>
        </div>

        <footer className="footer">
          <span>{shortcutHint}</span>
          <button className="link" onClick={() => void browserApi.runtime.openOptionsPage()} type="button">
            Full settings ↗
          </button>
        </footer>

        {toastRegion}
      </main>
    </>
  )
}

interface PageTab {
  id: string
  name: string
  // SVG path data for a 24px stroked icon.
  icon: string
  count?: string
  description: string
  body: ReactNode
}

const initialTab = (tabs: PageTab[]) => {
  const id = location.hash.slice(1)
  return tabs.some((tab) => tab.id === id) ? id : tabs[0].id
}

// Full-window settings: a sidebar of tabs next to one panel at a time.
function SettingsPage({
  tabs,
  masterSwitch,
  enabled,
  skippedCount,
  shortcutHint,
  version
}: {
  tabs: PageTab[]
  masterSwitch: ReactNode
  enabled: boolean
  skippedCount: number
  shortcutHint: ReactNode
  version: string
}) {
  const [active, setActive] = useState(() => initialTab(tabs))
  const list = useRef<HTMLDivElement>(null)
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  // Follow links to another tab while the page is already open.
  useEffect(() => {
    const onHashChange = () => setActive(initialTab(tabs))
    addEventListener("hashchange", onHashChange)
    return () => removeEventListener("hashchange", onHashChange)
  }, [])

  const select = (id: string, focus = false) => {
    setActive(id)
    history.replaceState(null, "", `#${id}`)
    if (focus) list.current?.querySelector<HTMLButtonElement>(`#tab-${id}`)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const last = tabs.length - 1
    const targets: Record<string, number> = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowRight: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(tabs[next].id, true)
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img alt="" className="logo" src={logoUrl} />
          <h1>MailHush</h1>
          {version && <span className="version">v{version}</span>}
        </div>

        <div className={`master ${enabled ? "" : "master-off"}`}>
          <span className="dot" />
          <span className="master-text">
            <span className="row-name">Masking</span>
            <span className="row-desc">{!enabled
                ? "Paused everywhere"
                : skippedCount === 0
                  ? "On for every site"
                  : `On, except ${skippedCount} skipped ${skippedCount === 1 ? "site" : "sites"}`}</span>
          </span>
          {masterSwitch}
        </div>

        <div aria-label="Settings sections" className="tabs" onKeyDown={onKeyDown} ref={list} role="tablist">
          {tabs.map((tab) => (
            <button
              aria-controls={`panel-${tab.id}`}
              aria-selected={tab.id === active}
              className="tab"
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => select(tab.id)}
              role="tab"
              tabIndex={tab.id === active ? 0 : -1}
              type="button">
              <svg aria-hidden="true" className="tab-icon" viewBox="0 0 24 24">
                <path d={tab.icon} />
              </svg>
              <span className="tab-name">{tab.name}</span>
              {tab.count && <span className="count">{tab.count}</span>}
            </button>
          ))}
        </div>

        <p className="sidebar-foot">{shortcutHint}</p>
      </aside>

      <main className="panel">
        <div aria-labelledby={`tab-${current.id}`} id={`panel-${current.id}`} role="tabpanel" tabIndex={0}>
          <header className="panel-head">
            <h2>{current.name}</h2>
            <p>{current.description}</p>
          </header>
          <div className="panel-body">{current.body}</div>
        </div>
      </main>
    </div>
  )
}

// A radio group with arrow-key navigation and a single tab stop.
function MaskStylePicker({ value, onChange }: { value: MaskStyle; onChange: (style: MaskStyle) => void }) {
  const group = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: KeyboardEvent) => {
    const index = maskStyles.findIndex((style) => style.id === value)
    const last = maskStyles.length - 1
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(maskStyles[next].id)
    group.current?.querySelectorAll("button")[next]?.focus()
  }
  return (
    <div aria-label="Mask style" className="segmented" onKeyDown={onKeyDown} ref={group} role="radiogroup">
      {maskStyles.map((style) => (
        <button
          aria-checked={value === style.id}
          className={value === style.id ? "selected" : ""}
          key={style.id}
          onClick={() => onChange(style.id)}
          role="radio"
          tabIndex={value === style.id ? 0 : -1}
          type="button">
          {style.name}
        </button>
      ))}
    </div>
  )
}

function Section({ title, count, children }: { title?: string; count?: string; children: ReactNode }) {
  return (
    <section className="section">
      {title && (
        <h2>
          {title}
          {count && <span className="count">{count}</span>}
        </h2>
      )}
      {children}
    </section>
  )
}

function Switch({
  checked,
  label,
  onChange,
  small = false
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  small?: boolean
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`switch ${small ? "small" : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      title={label}
      type="button">
      <span className="knob" />
    </button>
  )
}

function Toggle({
  checked,
  description,
  label,
  onChange
}: {
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-name">{label}</span>
        <span className="row-desc">{description}</span>
      </div>
      <Switch checked={checked} label={label} onChange={onChange} small />
    </div>
  )
}

function StylePreview({ settings }: { settings: ExtensionSettings }) {
  const masker = useMemo(
    () =>
      createMasker({
        ...settings,
        enabled: true,
        rules: [],
        detectors: Object.fromEntries(
          detectors.map((detector) => [detector.id, { ...settings.detectors[detector.id], enabled: true, style: "default" }])
        ) as ExtensionSettings["detectors"]
      }),
    [settings.maskStyle, settings.detectors]
  )
  return (
    <div className="preview">
      {["jane.doe@example.com", "4111 1111 1111 1111"].map((value) => (
        <div className="preview-row" key={value}>
          <code>{value}</code>
          <span className="arrow">→</span>
          <code className="masked">{masker.mask(value)}</code>
        </div>
      ))}
    </div>
  )
}

function DetectorRow({
  detector,
  config,
  settings,
  onChange
}: {
  detector: Detector
  config: DetectorSettings
  settings: ExtensionSettings
  onChange: (changes: Partial<DetectorSettings>) => void
}) {
  const [open, setOpen] = useState(false)
  const effective: MaskStyle = config.style === "default" ? settings.maskStyle : config.style
  const preview = useMemo(
    () =>
      createMasker({
        ...settings,
        enabled: true,
        rules: [],
        detectors: Object.fromEntries(
          detectors.map((entry) => [
            entry.id,
            { ...settings.detectors[entry.id], enabled: entry.id === detector.id }
          ])
        ) as ExtensionSettings["detectors"]
      }).mask(detector.example),
    [settings.maskStyle, config.style, config.label]
  )

  return (
    <div className={`detector ${open ? "open" : ""}`}>
      <div className="row">
        <button
          aria-expanded={open}
          className="row-text expander"
          onClick={() => setOpen(!open)}
          type="button">
          <span className="row-name">
            {detector.name}
            {config.style !== "default" && <span className="tag">{config.style}</span>}
          </span>
          <span className="row-desc">{detector.description}</span>
        </button>
        <Switch checked={config.enabled} label={`Detect ${detector.name}`} onChange={(enabled) => onChange({ enabled })} small />
      </div>
      {open && (
        <div className="detector-options">
          <label className="field">
            <span>Style</span>
            <select
              onChange={(event) => onChange({ style: (event.target as HTMLSelectElement).value as DetectorSettings["style"] })}
              value={config.style}>
              <option value="default">Default ({maskStyles.find((style) => style.id === settings.maskStyle)?.name})</option>
              {maskStyles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </label>
          {effective === "label" && (
            <label className="field">
              <span>Label</span>
              <input
                onInput={(event) => onChange({ label: (event.target as HTMLInputElement).value })}
                placeholder={detector.label}
                spellCheck={false}
                value={config.label}
              />
            </label>
          )}
          <div className="preview-row">
            <code>{detector.example}</code>
            <span className="arrow">→</span>
            <code className="masked">{preview}</code>
          </div>
        </div>
      )}
    </div>
  )
}

function RuleRow({
  rule,
  number,
  onChange,
  onRemove
}: {
  rule: CustomRule
  number: number
  onChange: (changes: Partial<CustomRule>) => void
  onRemove: () => void
}) {
  const error = rule.pattern ? compileRule(rule).error : undefined
  const errorId = `rule-error-${rule.id}`

  return (
    <div className="rule">
      <div className="rule-line">
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          aria-label={`Rule ${number}: text to mask`}
          className={`mono ${error ? "invalid" : ""}`}
          onInput={(event) => onChange({ pattern: (event.target as HTMLInputElement).value })}
          placeholder={rule.regex ? "regular expression" : "text to mask"}
          spellCheck={false}
          value={rule.pattern}
        />
        <button
          aria-pressed={rule.regex}
          className={`chip ${rule.regex ? "on" : ""}`}
          onClick={() => onChange({ regex: !rule.regex })}
          aria-label={`Rule ${number}: regular expression`}
          title="Regular expression"
          type="button">
          .*
        </button>
        <button
          aria-pressed={rule.caseSensitive}
          className={`chip ${rule.caseSensitive ? "on" : ""}`}
          onClick={() => onChange({ caseSensitive: !rule.caseSensitive })}
          aria-label={`Rule ${number}: match case`}
          title="Match case"
          type="button">
          Aa
        </button>
      </div>
      <div className="rule-line">
        <span className="arrow">→</span>
        <input
          aria-label={`Rule ${number}: replacement`}
          className="mono"
          onInput={(event) => onChange({ replacement: (event.target as HTMLInputElement).value })}
          placeholder="replacement (empty = mask style)"
          spellCheck={false}
          value={rule.replacement}
        />
        <Switch checked={rule.enabled} label={`Enable rule ${number}`} onChange={(enabled) => onChange({ enabled })} small />
        <button aria-label={`Delete rule ${number}`} className="icon danger" onClick={onRemove} title="Delete rule" type="button">
          ×
        </button>
      </div>
      <div aria-live="polite" className="error" id={errorId}>
        {error}
      </div>
    </div>
  )
}

function TestBox({ settings }: { settings: ExtensionSettings }) {
  const [text, setText] = useState(sampleText)
  const masker = useMemo(() => createMasker({ ...settings, enabled: true }), [settings])
  return (
    <div className="test">
      <textarea
        aria-label="Text to test"
        onInput={(event) => setText((event.target as HTMLTextAreaElement).value)}
        rows={4}
        spellCheck={false}
        value={text}
      />
      <pre aria-label="Masked result" className="test-output">{masker.mask(text)}</pre>
    </div>
  )
}

function SiteList({ sites, onChange }: { sites: string[]; onChange: (sites: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const site = normalizeSite(draft)

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!site) return
    if (!sites.includes(site)) onChange([...sites, site])
    setDraft("")
  }

  return (
    <>
      {sites.length > 0 && (
        <ul className="sites">
          {sites.map((entry) => (
            <li key={entry}>
              <span className="mono">{entry}</span>
              <button
                aria-label={`Stop skipping ${entry}`}
                className="icon"
                onClick={() => onChange(sites.filter((item) => item !== entry))}
                type="button">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="add-site" onSubmit={add}>
        <input
          aria-label="Site to skip"
          className="mono"
          onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
          placeholder="example.com"
          spellCheck={false}
          value={draft}
        />
        <button className="button" disabled={!site} type="submit">
          Add
        </button>
      </form>
    </>
  )
}

function Backup({
  settings,
  onImport,
  onError
}: {
  settings: ExtensionSettings
  onImport: (settings: ExtensionSettings) => void
  onError: (message: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(normalizeSettings(settings), null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "mailhush-settings.json"
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const importSettings = async (event: FormEvent<HTMLInputElement>) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const known = ["enabled", "detectors", "rules", "excludedSites"]
      if (!data || typeof data !== "object" || Array.isArray(data) || !known.some((key) => key in data)) {
        throw new Error("Not a settings export")
      }
      onImport(normalizeSettings(data))
    } catch {
      onError("That file is not a MailHush settings export")
    }
  }

  return (
    <div className="backup">
      <button className="button" onClick={exportSettings} type="button">
        Export settings
      </button>
      <button className="button" onClick={() => fileInput.current?.click()} type="button">
        Import settings
      </button>
      <input accept="application/json,.json" hidden onChange={importSettings} ref={fileInput} type="file" />
    </div>
  )
}
