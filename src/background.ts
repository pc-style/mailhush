import { readSettings, writeSettings } from "~lib/settings"

const toggleCommand = "toggle-mailhush"

const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome

browserApi.commands.onCommand.addListener(async (command) => {
  if (command !== toggleCommand) {
    return
  }

  const settings = await readSettings()

  await writeSettings({
    ...settings,
    enabled: !settings.enabled
  })
})

// Frames in Firefox before 148 cannot read the top-level origin themselves;
// they need it to honour skipped sites.
browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "mailhush:top-host") return
  try {
    sendResponse(new URL(sender.tab?.url ?? "").hostname)
  } catch {
    sendResponse("")
  }
})

export {}
