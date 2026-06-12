// Test environment bootstrap for component tests compiled to .tmp-tests/.
// Must be the FIRST import of any component test file:
//   1. installs a "@/" module alias pointing at the compiled output root
//   2. boots jsdom globals (window, document, etc.)
//   3. stubs network (fetch) so store side-effects never hit the wire
/* eslint-disable @typescript-eslint/no-require-imports */

import * as path from "path"

// ── 1. "@/" alias → compiled root (.tmp-tests/) ─────────────────────────────
// This file compiles to .tmp-tests/tests/helpers/, so the repo-equivalent
// root is two directories up.
const compiledRoot = path.join(__dirname, "..", "..")

const Module = require("module") as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string
}
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(compiledRoot, request.slice(2)), ...rest)
  }
  return originalResolve.call(this, request, ...rest)
}

// ── 2. jsdom globals ─────────────────────────────────────────────────────────
require("global-jsdom")(undefined, { url: "http://localhost:3000/" })

// React's act() warns unless this flag is set.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Node 22 ships its own global Event/CustomEvent, which global-jsdom doesn't
// override — libraries (e.g. Radix) then construct events from the wrong realm
// and jsdom's dispatchEvent rejects them. Force jsdom's constructors.
;(globalThis as Record<string, unknown>).Event = window.Event
;(globalThis as Record<string, unknown>).CustomEvent = window.CustomEvent

// jsdom doesn't implement scrolling APIs — components like the TimeWheelPicker
// and Radix dialogs call them on mount.
/* eslint-disable @typescript-eslint/no-empty-function */
if (!window.Element.prototype.scrollTo) {
  window.Element.prototype.scrollTo = () => {}
}
if (!window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = () => {}
}
/* eslint-enable @typescript-eslint/no-empty-function */

// ── 3. Network stub ──────────────────────────────────────────────────────────
globalThis.fetch = (async () =>
  new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch
