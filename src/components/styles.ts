export const styles = `
:root {
  --bg: #1b1a19;
  --card: #242322;
  --well: #2c2a29;
  --well-hover: #33312f;
  --line: rgba(255, 245, 235, 0.06);
  --text: #ece8e4;
  --text-2: #bcb6b0;
  --text-3: #a19b95;
  --accent: #8fd6b4;
  --accent-ink: #12261d;
  --accent-soft: rgba(143, 214, 180, 0.14);
  --accent-text: #8fd6b4;
  --segment: #46433f;
  --blue: #9cc3f5;
  --blue-soft: rgba(156, 195, 245, 0.14);
  --red: #f2a3a3;
  --amber: #f0cf8a;
  --amber-text: #f0cf8a;
  --track: #3a3836;
  --shadow: 0 0 0 1px rgba(255, 245, 235, 0.04), 0 1px 2px rgba(0, 0, 0, 0.25), 0 6px 16px -6px rgba(0, 0, 0, 0.35);
  --shadow-raised: 0 0 0 1px rgba(255, 245, 235, 0.06), 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.2);
  --font: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  --mono: "SF Mono", "Cascadia Code", "JetBrains Mono", Consolas, monospace;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  color-scheme: dark;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f3f0ec;
    --card: #fbfaf8;
    --well: #efebe6;
    --well-hover: #e8e3dd;
    --line: rgba(60, 40, 20, 0.07);
    --text: #2e2a27;
    --text-2: #4f4944;
    --text-3: #6b645e;
    --accent: #3f9d76;
    --accent-ink: #ffffff;
    --accent-soft: rgba(63, 157, 118, 0.12);
    --accent-text: #2a6e51;
    --segment: #ffffff;
    --blue: #3a6aa8;
    --blue-soft: rgba(63, 115, 184, 0.1);
    --red: #a84444;
    --amber: #c9922e;
    --amber-text: #8a5d12;
    --track: #dcd6cf;
    --shadow: 0 0 0 1px rgba(60, 40, 20, 0.05), 0 1px 2px rgba(60, 40, 20, 0.05), 0 8px 20px -10px rgba(60, 40, 20, 0.18);
    --shadow-raised: 0 0 0 1px rgba(60, 40, 20, 0.06), 0 1px 2px rgba(60, 40, 20, 0.08), 0 2px 6px rgba(60, 40, 20, 0.06);
    color-scheme: light;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

.app {
  width: 380px;
  padding: 10px;
  display: grid;
  gap: 8px;
  font: 12px/1.45 var(--font);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

.header { display: flex; align-items: center; gap: 10px; padding: 6px 6px 2px; }
.logo { width: 30px; height: 30px; border-radius: 9px; outline: 1px solid var(--line); outline-offset: -1px; }
.title { flex: 1; display: flex; align-items: baseline; gap: 7px; font-size: 15px; letter-spacing: -0.01em; text-wrap: balance; }
.title h1 { margin: 0; font: inherit; font-weight: 700; }
.version { font: 10px var(--mono); color: var(--text-3); }
.paused-badge { font-size: 11px; font-weight: 500; color: var(--amber-text); background: rgba(240, 207, 138, 0.14); padding: 2px 9px; border-radius: 999px; }

.site { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); }
.site .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); flex-shrink: 0; transition: background-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.site-off .dot { background: var(--amber); box-shadow: 0 0 0 3px rgba(240, 207, 138, 0.16); }
.site-paused .dot { background: var(--text-3); box-shadow: 0 0 0 3px var(--line); }
.site-host { font-family: var(--mono); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-state { color: var(--text-2); flex: 1; }
.site .link { padding: 4px 10px; border-radius: 999px; background: var(--blue-soft); }
.site .link:hover { text-decoration: none; filter: brightness(1.1); }

.body { display: grid; gap: 8px; max-height: 430px; overflow-y: auto; margin: 0 -10px; padding: 2px 10px 6px; scrollbar-width: thin; scrollbar-color: var(--track) transparent; }

.section { padding: 12px 14px 14px; border-radius: 16px; background: var(--card); box-shadow: var(--shadow); }
.section h2 { display: flex; justify-content: space-between; align-items: center; margin: 0 0 10px; font-size: 12px; font-weight: 600; color: var(--text); }
.count { font: 500 10px var(--mono); font-variant-numeric: tabular-nums; color: var(--text-2); background: var(--well); padding: 1px 7px; border-radius: 999px; }
.hint { margin: -4px 0 10px; color: var(--text-2); font-size: 11px; text-wrap: pretty; }

.segmented { display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; gap: 3px; background: var(--well); border-radius: 11px; }
.segmented button { border: 0; border-radius: 8px; padding: 6px 0; background: transparent; color: var(--text-2); font-weight: 500; transition: background-color 0.2s var(--ease), color 0.2s var(--ease), box-shadow 0.2s var(--ease), scale 0.1s var(--ease); }
.segmented button:hover { color: var(--text); }
.segmented button:active { scale: 0.96; }
.segmented button.selected { background: var(--segment); color: var(--text); box-shadow: var(--shadow-raised); }

.list, .rules, .preview, .test { grid-template-columns: minmax(0, 1fr); }
.preview { margin-top: 10px; display: grid; gap: 4px; padding: 8px 10px; border-radius: 10px; background: var(--well); }
.preview-row { display: flex; align-items: center; gap: 6px; min-width: 0; font: 11px var(--mono); }
.preview-row code { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
.preview-row .masked { color: var(--accent-text); }
.arrow { color: var(--text-3); flex-shrink: 0; }

.list { display: grid; gap: 2px; margin: 0 -8px; }
.row { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
.list .row { padding: 7px 8px; border-radius: 10px; transition: background-color 0.15s var(--ease); }
.list .detector:not(.open) .row:hover { background: var(--well); }
.row-text { flex: 1 1 0; min-width: 0; overflow: hidden; display: flex; flex-direction: column; gap: 1px; }
.row-name { font-weight: 500; display: flex; align-items: center; gap: 6px; }
.row-desc { color: var(--text-2); font-size: 11px; }
.expander { text-align: left; background: none; border: 0; padding: 0; }
.expander .row-name::after { content: "›" / ""; color: var(--text-3); transition: rotate 0.2s var(--ease); }
.detector.open .expander .row-name::after { rotate: 90deg; }
.tag { font: 9px var(--mono); text-transform: uppercase; color: var(--blue); background: var(--blue-soft); border-radius: 999px; padding: 1px 6px; }
.detector.open { margin: 2px 0 4px; border-radius: 12px; background: var(--well); }
.detector-options { display: grid; gap: 8px; padding: 2px 10px 10px; }
.field { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; color: var(--text-2); font-size: 11px; }
.detector-options input, .detector-options select { background: var(--card); }

input, select, textarea { background: var(--well); border: 0; border-radius: 9px; padding: 0 10px; height: 30px; min-width: 0; width: 100%; outline: none; box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow 0.15s var(--ease), background-color 0.15s var(--ease); }
input::placeholder, textarea::placeholder { color: var(--text-3); }
input:hover, select:hover, textarea:hover { background: var(--well-hover); }
input:focus, select:focus, textarea:focus { box-shadow: inset 0 0 0 1px var(--blue), 0 0 0 3px var(--blue-soft); }
select option { background: var(--card); }
.mono, textarea, .test-output { font: 11px var(--mono); }
input.invalid, input.invalid:focus { box-shadow: inset 0 0 0 1px var(--red), 0 0 0 3px rgba(242, 163, 163, 0.18); }

.switch { position: relative; flex-shrink: 0; width: 36px; height: 22px; padding: 0; border: 0; border-radius: 999px; background: var(--track); transition: background-color 0.2s var(--ease); }
.switch::before { content: ""; position: absolute; inset: -9px -4px; }
.switch .knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1); transition: translate 0.2s var(--ease), scale 0.1s var(--ease); }
.switch:active .knob { scale: 0.92; }
.switch[aria-checked="false"] { box-shadow: inset 0 0 0 1.5px var(--text-3); }
.switch[aria-checked="true"] { background: var(--accent); }
.switch[aria-checked="true"] .knob { translate: 14px 0; }
.switch.small { width: 30px; height: 18px; }
.switch.small .knob { top: 3px; left: 3px; width: 12px; height: 12px; }
.switch.small[aria-checked="true"] .knob { translate: 12px 0; }

.rules { display: grid; gap: 8px; }
.rule { display: grid; gap: 6px; padding: 8px; border-radius: 12px; background: var(--well); }
.rule input { background: var(--card); }
.rule-line { display: flex; align-items: center; gap: 6px; }
.chip { flex-shrink: 0; width: 30px; height: 30px; border: 0; border-radius: 9px; background: var(--card); color: var(--text-3); font: 11px var(--mono); box-shadow: inset 0 0 0 1px var(--line); transition: background-color 0.15s var(--ease), color 0.15s var(--ease), scale 0.1s var(--ease); }
.chip:active, .icon:active, .button:active { scale: 0.96; }
.chip.on { color: var(--blue); background: var(--blue-soft); box-shadow: none; }
.icon { position: relative; flex-shrink: 0; width: 28px; height: 28px; border: 0; border-radius: 999px; background: none; color: var(--text-3); font-size: 15px; line-height: 1; transition: background-color 0.15s var(--ease), color 0.15s var(--ease), scale 0.1s var(--ease); }
.icon:hover { background: var(--well-hover); color: var(--text); }
.icon.danger:hover { color: var(--red); background: rgba(242, 163, 163, 0.12); }
.error { color: var(--red); font-size: 11px; padding: 0 4px; }
.error:empty { display: none; }

.link { border: 0; background: none; padding: 0; color: var(--blue); font-weight: 500; }
.link:hover { text-decoration: underline; text-underline-offset: 2px; }
.add { margin-top: 10px; padding: 6px 12px; border-radius: 999px; background: var(--blue-soft); }
.add:hover { text-decoration: none; filter: brightness(1.1); }
.button { display: inline-flex; align-items: center; height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--well); color: var(--text); font-weight: 500; cursor: pointer; transition: background-color 0.15s var(--ease), scale 0.1s var(--ease), opacity 0.15s var(--ease); }
.button:hover { background: var(--well-hover); }
.button:disabled { color: var(--text-3); cursor: default; }
.button:disabled:hover { background: var(--well); }

.test { display: grid; gap: 6px; }
textarea { height: auto; padding: 8px 10px; resize: vertical; field-sizing: content; max-height: 240px; }
.test-output { margin: 0; padding: 8px 10px; white-space: pre-wrap; word-break: break-all; color: var(--accent-text); background: var(--accent-soft); border-radius: 9px; }

.sites { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.sites li { display: flex; align-items: center; gap: 2px; padding: 2px 2px 2px 10px; border-radius: 999px; background: var(--well); }
.sites .icon { width: 24px; height: 24px; font-size: 13px; }
.add-site { display: flex; gap: 6px; }
.backup { display: flex; gap: 8px; }

.footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 6px 0; color: var(--text-2); font-size: 11px; }
kbd { font: 10px var(--mono); padding: 2px 6px; border-radius: 6px; background: var(--card); color: var(--text); box-shadow: var(--shadow-raised); }

.toast { position: fixed; left: 50%; bottom: 8px; translate: -50% 6px; padding: 6px 12px; border-radius: 999px; background: var(--text); color: var(--bg); font-size: 11px; font-weight: 500; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); opacity: 0; pointer-events: none; transition: opacity 0.2s var(--ease), translate 0.2s var(--ease); }
.toast.visible { opacity: 1; translate: -50% 0; }

/* Full-window settings page */
.shell { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh; font: 13px/1.5 var(--font); color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased; }
.sidebar { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 18px; padding: 24px 16px; background: var(--card); box-shadow: 1px 0 0 var(--line); overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.brand h1 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.brand .version { margin-top: 2px; }
.master { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--well); }
.master .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.master-off .dot { background: var(--amber); box-shadow: 0 0 0 3px rgba(240, 207, 138, 0.16); }
.master-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.master-off .master-text .row-desc { color: var(--amber-text); }
.tabs { display: grid; gap: 2px; }
.tab { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; color: var(--text-2); font-weight: 500; text-align: left; transition: background-color 0.15s var(--ease), color 0.15s var(--ease); }
.tab:hover { background: var(--well); color: var(--text); }
.tab[aria-selected="true"] { background: var(--well); color: var(--text); box-shadow: inset 3px 0 0 var(--accent); }
.tab-icon { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tab-name { flex: 1; }
.tab .count { background: var(--well); }
.tab[aria-selected="true"] .count { background: var(--card); }
.sidebar-foot { margin: auto 0 0; padding: 0 6px; color: var(--text-2); font-size: 12px; }
.panel { padding: 40px 48px 64px; min-width: 0; }
.panel [role="tabpanel"]:focus-visible { outline: 2px solid var(--blue); outline-offset: 12px; border-radius: 12px; }
.panel-head { max-width: 760px; margin-bottom: 20px; }
.panel-head h2 { margin: 0 0 4px; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; text-wrap: balance; }
.panel-head p { margin: 0; color: var(--text-2); text-wrap: pretty; }
.panel-body { max-width: 760px; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.panel .section { padding: 18px 20px 20px; }
.panel .section h2 { font-size: 14px; margin-bottom: 12px; }
.panel .test textarea { min-height: 160px; }
@media (max-width: 720px) {
  .shell { grid-template-columns: minmax(0, 1fr); }
  .sidebar { position: static; height: auto; gap: 12px; padding: 16px; box-shadow: 0 1px 0 var(--line); }
  .tabs { display: flex; flex-wrap: wrap; gap: 4px; }
  .tab { width: auto; white-space: nowrap; }
  .tab[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--accent); }
  .sidebar-foot { margin: 0; }
  .panel { padding: 24px 16px 48px; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0s !important; }
}
`
