#!/usr/bin/env node
/**
 * Post-build manifest patch.
 *
 * Plasmo 0.90.5 has a regression where `run_at: "document_start"` declared in a
 * PlasmoCSConfig (see src/content.ts) is silently emitted as `"document_idle"`
 * in the generated manifest. That breaks the startup veil in content.ts
 * (installStartupVeil) which relies on running before the page paints to avoid a
 * flash of un-masked email addresses.
 *
 * This script rewrites every built manifest so all content scripts run at
 * `document_start`. It runs after `plasmo build`/`plasmo package` and is a
 * no-op if the build directory does not exist.
 */
const { readFileSync, writeFileSync, existsSync, readdirSync } = require("fs")
const { join } = require("path")

const BUILD_DIR = join(__dirname, "..", "build")
const RUN_AT = "document_start"

function patchManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
    return false
  }

  let changed = false
  for (const cs of manifest.content_scripts) {
    if (cs.run_at !== RUN_AT) {
      cs.run_at = RUN_AT
      changed = true
    }
  }

  if (changed) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
    console.log(`[fix-run-at] patched run_at -> ${RUN_AT}: ${manifestPath}`)
  }
  return changed
}

function main() {
  if (!existsSync(BUILD_DIR)) {
    console.log("[fix-run-at] no build directory, skipping")
    return
  }

  let patchedAny = false
  for (const entry of readdirSync(BUILD_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(BUILD_DIR, entry.name, "manifest.json")
    if (existsSync(manifestPath)) {
      patchedAny = patchManifest(manifestPath) || patchedAny
    }
  }

  if (!patchedAny) {
    console.log("[fix-run-at] nothing to patch (already correct or no manifests found)")
  }
}

main()
