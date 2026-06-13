"use strict";
// Test environment bootstrap for component tests compiled to .tmp-tests/.
// Must be the FIRST import of any component test file:
//   1. installs a "@/" module alias pointing at the compiled output root
//   2. boots jsdom globals (window, document, etc.)
//   3. stubs network (fetch) so store side-effects never hit the wire
/* eslint-disable @typescript-eslint/no-require-imports */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
// ── 1. "@/" alias → compiled root (.tmp-tests/) ─────────────────────────────
// This file compiles to .tmp-tests/tests/helpers/, so the repo-equivalent
// root is two directories up.
const compiledRoot = path.join(__dirname, "..", "..");
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request.startsWith("@/")) {
        return originalResolve.call(this, path.join(compiledRoot, request.slice(2)), ...rest);
    }
    return originalResolve.call(this, request, ...rest);
};
// ── 2. jsdom globals ─────────────────────────────────────────────────────────
require("global-jsdom")(undefined, { url: "http://localhost:3000/" });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
// jsdom doesn't implement scrolling APIs — components like the TimeWheelPicker
// and Radix dialogs call them on mount.
if (!window.Element.prototype.scrollTo) {
    window.Element.prototype.scrollTo = () => { };
}
if (!window.Element.prototype.scrollIntoView) {
    window.Element.prototype.scrollIntoView = () => { };
}
// ── 3. Network stub ──────────────────────────────────────────────────────────
globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }));
