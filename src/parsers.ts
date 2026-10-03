import type { EnvIssueCode, EnvSchemaEntry } from "./types.js";

export interface ParseFailure {
    readonly code: EnvIssueCode;
    readonly message: string;
}

export type ParseResult<T> =
    { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ParseFailure };

// Keep numeric syntax strict so values such as whitespace, hex, and Infinity are rejected
const STRICT_NUMBER = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

export function parseEntry(entry: EnvSchemaEntry, input: string): ParseResult<string | number | boolean> {
    switch (entry.type) {
        case "string":
            return { ok: true, value: input };
        case "number":
            return parseNumber(input);
        case "boolean":
            return parseBoolean(input);
        case "url":
            return parseUrl(entry, input);
        case "enum":
            return entry.values.includes(input)
                ? { ok: true, value: input }
                : failure("INVALID_ENUM", `Expected one of: ${entry.values.join(", ")}.`);
    }
}

function parseNumber(input: string): ParseResult<number> {
    if (!STRICT_NUMBER.test(input)) return failure("INVALID_NUMBER", "Expected a finite number.");
    const value = Number(input);
    return Number.isFinite(value) ? { ok: true, value } : failure("INVALID_NUMBER", "Expected a finite number.");
}

function parseBoolean(input: string): ParseResult<boolean> {
    if (input === "true") return { ok: true, value: true };
    if (input === "false") return { ok: true, value: false };
    return failure("INVALID_BOOLEAN", 'Expected "true" or "false".');
}

function parseUrl(entry: Extract<EnvSchemaEntry, { type: "url" }>, input: string): ParseResult<string> {
    let parsed: URL;
    try {
        parsed = new URL(input);
    } catch {
        return failure("INVALID_URL", "Expected a valid absolute URL.");
    }
    if (!parsed.protocol || !parsed.hostname) return failure("INVALID_URL", "Expected a valid absolute URL.");
    if (entry.protocols && !entry.protocols.includes(parsed.protocol))
        return failure("INVALID_URL", `Expected a URL using an allowed protocol.`);
    return { ok: true, value: input };
}

function failure(code: EnvIssueCode, message: string): { readonly ok: false; readonly error: ParseFailure } {
    return { ok: false, error: { code, message } };
}
