import test from "node:test";
import assert from "node:assert/strict";
import { envGuard, safeEnvGuard, EnvGuardError } from "../dist/index.js";

const source = (values = {}) => ({ ...values });

test("required and defaults", () => {
    const config = envGuard(
        {
            PORT: { type: "number", default: 3000 },
            REQUIRED: { type: "string" },
            OPTIONAL: { type: "string", required: false },
        },
        { source: source({ REQUIRED: "ok" }) },
    );
    assert.equal(config.PORT, 3000);
    assert.equal(config.REQUIRED, "ok");
    assert.equal(config.OPTIONAL, undefined);
    assert.equal(Object.isFrozen(config), true);
});

test("required empty value is invalid and does not fall back to default", () => {
    const result = safeEnvGuard({ PORT: { type: "number", default: 3000 } }, { source: source({ PORT: "" }) });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.issues[0].code, "EMPTY");
});

test("all environment errors are aggregated in schema order", () => {
    assert.throws(
        () =>
            envGuard(
                {
                    A: { type: "number" },
                    B: { type: "boolean" },
                    C: { type: "url" },
                },
                { source: source({ A: "x", B: "yes", C: "not-url" }) },
            ),
        (error) => {
            assert(error instanceof EnvGuardError);
            assert.deepEqual(
                error.issues.map((i) => i.key),
                ["A", "B", "C"],
            );
            return true;
        },
    );
});

test("strict number parsing", () => {
    const config = envGuard(
        { A: { type: "number" }, B: { type: "number" }, C: { type: "number" }, D: { type: "number" } },
        { source: source({ A: "3.14", B: ".5", C: "1e3", D: "-10" }) },
    );
    assert.deepEqual(config, { A: 3.14, B: 0.5, C: 1000, D: -10 });
    for (const value of ["", " ", "0x10", "0b101", "Infinity", "NaN", "hello"]) {
        const result = safeEnvGuard({ X: { type: "number" } }, { source: source({ X: value }) });
        assert.equal(result.ok, false, value);
    }
});

test("strict boolean parsing", () => {
    assert.equal(
        envGuard({ A: { type: "boolean" }, B: { type: "boolean" } }, { source: source({ A: "true", B: "false" }) }).A,
        true,
    );
    for (const value of ["TRUE", "False", "1", "0", "yes", "no"])
        assert.equal(safeEnvGuard({ X: { type: "boolean" } }, { source: source({ X: value }) }).ok, false);
});

test("URL validation is syntax-only and preserves string", () => {
    const config = envGuard(
        { DB: { type: "url", protocols: ["postgres:", "postgresql:"] } },
        { source: source({ DB: "postgresql://user:password@example.test/db?secret=value" }) },
    );
    assert.equal(config.DB, "postgresql://user:password@example.test/db?secret=value");
    assert.equal(safeEnvGuard({ DB: { type: "url" } }, { source: source({ DB: "localhost:5432" }) }).ok, false);
});

test("enum is exact and case-sensitive", () => {
    const config = envGuard(
        { MODE: { type: "enum", values: ["development", "production"] } },
        { source: source({ MODE: "production" }) },
    );
    assert.equal(config.MODE, "production");
    assert.equal(
        safeEnvGuard(
            { MODE: { type: "enum", values: ["development", "production"] } },
            { source: source({ MODE: "PRODUCTION" }) },
        ).ok,
        false,
    );
});

test("string constraints and regex state are deterministic", () => {
    const pattern = /^abc$/gy;
    const schema = { NAME: { type: "string", minLength: 3, maxLength: 5, pattern } };
    assert.equal(envGuard(schema, { source: source({ NAME: "abc" }) }).NAME, "abc");
    assert.equal(envGuard(schema, { source: source({ NAME: "abc" }) }).NAME, "abc");
    assert.equal(
        safeEnvGuard({ NAME: { type: "string", minLength: 4 } }, { source: source({ NAME: "abc" }) }).ok,
        false,
    );
});

test("number range boundaries are inclusive", () => {
    const schema = { PORT: { type: "number", min: 1, max: 65535 } };
    assert.equal(envGuard(schema, { source: source({ PORT: "1" }) }).PORT, 1);
    assert.equal(envGuard(schema, { source: source({ PORT: "65535" }) }).PORT, 65535);
    assert.equal(safeEnvGuard(schema, { source: source({ PORT: "0" }) }).ok, false);
    assert.equal(safeEnvGuard(schema, { source: source({ PORT: "65536" }) }).ok, false);
});

test("schema errors are not environment errors", () => {
    assert.throws(() => envGuard({ X: { type: "string", required: true, default: "x" } }), TypeError);
    assert.throws(() => envGuard({ X: { type: "number", min: 10, max: 1 } }), TypeError);
    assert.throws(() => envGuard({ X: { type: "enum", values: [] } }), TypeError);
    assert.throws(() => envGuard({ X: { type: "string", typo: true } }), TypeError);
});

test("invalid defaults are rejected as schema errors", () => {
    assert.throws(() => envGuard({ X: { type: "url", default: "not-url" } }), TypeError);
    assert.throws(() => envGuard({ X: { type: "number", default: 100, max: 10 } }), TypeError);
    assert.throws(() => envGuard({ X: { type: "string", default: "x", minLength: 2 } }), TypeError);
});

test("custom source is never mutated and inherited values are ignored", () => {
    const proto = { INHERITED: "bad" };
    const source = Object.assign(Object.create(proto), { VALUE: "ok" });
    const config = envGuard({ INHERITED: { type: "string", required: false }, VALUE: { type: "string" } }, { source });
    assert.equal(config.INHERITED, undefined);
    assert.equal(config.VALUE, "ok");
    assert.deepEqual(source.VALUE, "ok");
});

test("non-string source values are rejected", () => {
    assert.throws(() => envGuard({ X: { type: "string" } }, { source: { X: 123 } }), TypeError);
});

test("returned config is a snapshot", () => {
    const source = { PORT: "3000" };
    const config = envGuard({ PORT: { type: "number" } }, { source });
    source.PORT = "4000";
    assert.equal(config.PORT, 3000);
});

test("errors never contain raw values or URL secrets", () => {
    const secret = "super-secret-value";
    const result = safeEnvGuard(
        { TOKEN: { type: "number" }, DB: { type: "url" } },
        { source: source({ TOKEN: secret, DB: "https://user:password@example.test/path?token=top-secret#frag" }) },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.error.message.includes(secret), false);
        assert.equal(result.error.message.includes("password"), false);
        assert.equal(result.error.message.includes("top-secret"), false);
    }
});

test("empty schema returns a frozen empty object", () => {
    const config = envGuard({}, { source: source({ UNUSED: "x" }) });
    assert.deepEqual(config, {});
    assert.equal(Object.isFrozen(config), true);
});

test("unsafe schema keys remain own properties without changing the config prototype", () => {
    const schema = Object.create(null);
    schema.__proto__ = { type: "string" };
    const source = Object.create(null);
    source.__proto__ = "safe-value";

    const config = envGuard(schema, { source });

    assert.equal(Object.hasOwn(config, "__proto__"), true);
    assert.equal(config.__proto__, "safe-value");
    assert.equal(Object.getPrototypeOf(config), Object.prototype);
});

test("safe validation preserves issue descriptions and freezes issue collections", () => {
    const result = safeEnvGuard(
        { TOKEN: { type: "string", minLength: 8, description: "deployment token" } },
        { source: { TOKEN: "short" } },
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.error.code, "ENV_VALIDATION_ERROR");
        assert.deepEqual(result.error.issues, [
            {
                key: "TOKEN",
                code: "TOO_SHORT",
                message: "Expected at least 8 characters.",
                description: "deployment token",
            },
        ]);
        assert.equal(Object.isFrozen(result.error.issues), true);
        assert.throws(() => result.error.issues.push({ key: "X", code: "MISSING", message: "bad" }), TypeError);
    }
});

test("explicit undefined uses the default while null and arrays are invalid sources", () => {
    assert.equal(envGuard({ MODE: { type: "string", default: "test" } }, { source: { MODE: undefined } }).MODE, "test");
    assert.throws(() => envGuard({}, { source: [] }), TypeError);
});

test("URL protocol allowlists reject otherwise valid disallowed protocols", () => {
    const result = safeEnvGuard(
        { CALLBACK: { type: "url", protocols: ["https:"] } },
        { source: { CALLBACK: "http://example.test/callback" } },
    );

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.issues[0].code, "INVALID_URL");
});
