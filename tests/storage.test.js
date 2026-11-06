import { beforeEach, describe, expect, mock, test } from "bun:test"

// One in-memory store per storage area, in place of browser extension storage.
const areas = { local: new Map(), sync: new Map() }
mock.module("@plasmohq/storage", () => ({
  Storage: class {
    constructor({ area }) {
      this.area = areas[area]
    }
    async get(key) {
      return this.area.get(key)
    }
    async set(key, value) {
      this.area.set(key, structuredClone(value))
    }
  }
}))

// The query gives a fresh module instance, since other test files already
// loaded settings.ts with the real storage.
const { readSettings, settingsKey, writeSettings } = await import("../src/lib/settings.ts?storage-test")

describe("settings storage", () => {
  beforeEach(() => {
    areas.local.clear()
    areas.sync.clear()
  })

  test("reads version 1 settings from sync when local is empty", async () => {
    areas.sync.set(settingsKey, { enabled: false, rules: [{ email: "a@b.io", replacement: "x" }] })
    const settings = await readSettings()
    expect(settings.enabled).toBe(false)
    expect(settings.rules[0].pattern).toBe("a@b.io")
  })

  test("local settings win over sync", async () => {
    areas.sync.set(settingsKey, { enabled: false })
    areas.local.set(settingsKey, { enabled: true })
    expect((await readSettings()).enabled).toBe(true)
  })

  test("writes go to local and read back, leaving sync untouched", async () => {
    areas.sync.set(settingsKey, { enabled: false })
    const settings = await readSettings()
    await writeSettings({ ...settings, enabled: true, excludedSites: ["example.com"] })
    expect(await readSettings()).toMatchObject({ enabled: true, excludedSites: ["example.com"] })
    expect(areas.sync.get(settingsKey)).toEqual({ enabled: false })
  })
})
