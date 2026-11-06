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

export {}
