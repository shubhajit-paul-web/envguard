import test from "node:test";
import assert from "node:assert/strict";
import { envGuard as esmEnvGuard } from "../dist/index.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { envGuard: cjsEnvGuard } = require("../dist/cjs/index.js");

test("ESM entry works", () => {
    assert.equal(esmEnvGuard({ PORT: { type: "number" } }, { source: { PORT: "42" } }).PORT, 42);
});

test("CommonJS entry is a real CommonJS build", () => {
    assert.equal(cjsEnvGuard({ PORT: { type: "number" } }, { source: { PORT: "42" } }).PORT, 42);
});
