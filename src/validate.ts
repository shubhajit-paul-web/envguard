import { EnvGuardError } from "./errors.js";
import { parseEntry } from "./parsers.js";
import { validateAndNormalizeSchema, type NormalizedEntry } from "./schema.js";
import type { EnvGuardOptions, EnvIssue, EnvSchema, InferSchema } from "./types.js";

export type ValidationResult<T> =
    { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: EnvGuardError };

export function validate<S extends EnvSchema>(schema: S, options: EnvGuardOptions = {}): InferSchema<S> {
    const result = validateSafe(schema, options);
    if (!result.ok) throw result.error;
    return result.data;
}

export function validateSafe<S extends EnvSchema>(
    schema: S,
    options: EnvGuardOptions = {},
): ValidationResult<InferSchema<S>> {
    const entries = validateAndNormalizeSchema(schema);
    const sourceRecord = resolveSource(options);
    const output: Record<string, unknown> = {};
    const issues: EnvIssue[] = [];

    for (const { key, schema: entry } of entries) {
        const resolved = readAndValidateEntry(sourceRecord, key, entry);
        if (resolved.kind === "issue") {
            issues.push(resolved.issue);
            continue;
        }

        Object.defineProperty(output, key, {
            configurable: true,
            enumerable: true,
            value: resolved.value,
            writable: true,
        });
    }

    if (issues.length > 0) return { ok: false, error: new EnvGuardError(issues) };
    return { ok: true, data: Object.freeze(output) as InferSchema<S> };
}

function resolveSource(options: EnvGuardOptions): Record<string, string | undefined> {
    const defaultSource = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } })
        .process.env;
    const source = options.source ?? defaultSource;
    validateSource(source);
    return source as Record<string, string | undefined>;
}

function readAndValidateEntry(
    source: Record<string, string | undefined>,
    key: string,
    entry: NormalizedEntry["schema"],
): { readonly kind: "value"; readonly value: unknown } | { readonly kind: "issue"; readonly issue: EnvIssue } {
    const supplied = Object.hasOwn(source, key) ? source[key] : undefined;

    if (supplied === undefined) {
        if ("default" in entry) return { kind: "value", value: entry.default };
        if (isRequired(entry))
            return issue(key, "MISSING", "Required environment variable is missing.", entry.description);
        return { kind: "value", value: undefined };
    }

    if (typeof supplied !== "string") {
        return issue(key, "INVALID_TYPE", "Expected an environment variable value to be a string.", entry.description);
    }

    if (supplied === "" && isRequired(entry)) {
        return issue(key, "EMPTY", "Required environment variable must not be empty.", entry.description);
    }

    const parsed = parseEntry(entry, supplied);
    if (!parsed.ok) {
        return issue(key, parsed.error.code, parsed.error.message, entry.description);
    }

    const constraint = checkConstraints(entry, parsed.value);
    if (constraint) {
        return issue(key, constraint.code, constraint.message, entry.description);
    }

    return { kind: "value", value: parsed.value };
}

function isRequired(entry: NormalizedEntry["schema"]): boolean {
    return entry.required === true || !("required" in entry);
}

function issue(
    key: string,
    code: EnvIssue["code"],
    message: string,
    description: string | undefined,
): { readonly kind: "issue"; readonly issue: EnvIssue } {
    const issueData: EnvIssue = { key, code, message };
    if (description !== undefined) return { kind: "issue", issue: { ...issueData, description } };
    return { kind: "issue", issue: issueData };
}

function validateSource(source: unknown): asserts source is Record<string, string | undefined> {
    if (source === null || typeof source !== "object" || Array.isArray(source))
        throw new TypeError("@shubhajit-paul-web/envguard: source must be an object.");
    for (const key of Object.keys(source)) {
        const value = (source as Record<string, string | undefined>)[key];
        if (value !== undefined && typeof value !== "string")
            throw new TypeError(`@shubhajit-paul-web/envguard: source value for ${key} must be a string or undefined.`);
    }
}

function checkConstraints(
    entry: NormalizedEntry["schema"],
    value: string | number | boolean,
): { code: EnvIssue["code"]; message: string } | undefined {
    switch (entry.type) {
        case "string": {
            const stringValue = value as string;
            if (entry.minLength !== undefined && stringValue.length < entry.minLength)
                return { code: "TOO_SHORT", message: `Expected at least ${entry.minLength} characters.` };
            if (entry.maxLength !== undefined && stringValue.length > entry.maxLength)
                return { code: "TOO_LONG", message: `Expected at most ${entry.maxLength} characters.` };
            if (entry.pattern) {
                entry.pattern.lastIndex = 0;
                const matched = entry.pattern.test(stringValue);
                entry.pattern.lastIndex = 0;
                if (!matched)
                    return { code: "PATTERN_MISMATCH", message: "Value does not match the required pattern." };
            }
            return undefined;
        }
        case "number": {
            const numberValue = value as number;
            if (entry.min !== undefined && numberValue < entry.min)
                return { code: "OUT_OF_RANGE", message: `Expected a value greater than or equal to ${entry.min}.` };
            if (entry.max !== undefined && numberValue > entry.max)
                return { code: "OUT_OF_RANGE", message: `Expected a value less than or equal to ${entry.max}.` };
            return undefined;
        }
        default:
            return undefined;
    }
}
