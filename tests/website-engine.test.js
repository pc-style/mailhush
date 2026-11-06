import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

// The website bundles copies of the engine (see website/why/src/lib/engine/README.md).
test.each(["engine.ts", "detectors.ts"])("website copy of %s matches the extension", (file) => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
  expect(read(`website/why/src/lib/engine/${file}`)).toBe(read(`src/lib/${file}`))
})
