import type { EnvSchemaEntry, EnumSchema } from "./types.js";

const COMMON_KEYS = new Set(["type", "required", "default", "description"]);
const TYPE_KEYS: Record<EnvSchemaEntry["type"], Set<string>> = {
    string: new Set(["minLength", "maxLength", "pattern"]),
    number: new Set(["min", "max"]),
    boolean: new Set(),
    url: new Set(["protocols"]),
    enum: new Set(["values"]),
};

export interface NormalizedEntry {
    readonly key: string;
    readonly schema: EnvSchemaEntry;
}

export function validateAndNormalizeSchema(schema: unknown): readonly NormalizedEntry[] {
    if (!isPlainRecord(schema)) throw new TypeError("@shubhajit-paul-web/envguard: schema must be an object.");

    const entries: NormalizedEntry[] = [];
    // Preserve insertion order so aggregated schema and environment issues stay deterministic
    for (const key of Object.keys(schema)) {
        const entry = schema[key];
        validateEntry(key, entry);
        entries.push({ key, schema: entry as EnvSchemaEntry });
    }
    return entries;
}

function validateEntry(key: string, entry: unknown): asserts entry is EnvSchemaEntry {
    if (!isPlainRecord(entry)) throw schemaError(key, "schema entry must be an object.");
    if (typeof entry.type !== "string" || !(entry.type in TYPE_KEYS)) {
        throw schemaError(key, "type must be one of: string, number, boolean, url, enum.");
    }

    for (const option of Object.keys(entry)) {
        if (!COMMON_KEYS.has(option) && !TYPE_KEYS[entry.type as EnvSchemaEntry["type"]].has(option)) {
            throw schemaError(key, `unknown schema option "${option}".`);
        }
    }

    if ("required" in entry && typeof entry.required !== "boolean")
        throw schemaError(key, "required must be a boolean.");
    if ("description" in entry && typeof entry.description !== "string")
        throw schemaError(key, "description must be a string.");
    if ("default" in entry && entry.default === undefined)
        throw schemaError(key, "default must be defined when provided.");
    const typedEntry = entry as unknown as EnvSchemaEntry;
    if ("default" in typedEntry && !matchesDefault(typedEntry))
        throw schemaError(key, "default has the wrong type for the declared schema type.");
    if ("default" in typedEntry) validateDefaultConstraints(key, typedEntry);
    if (typedEntry.required === true && "default" in typedEntry)
        throw schemaError(key, "required and default cannot be used together.");

    switch (typedEntry.type) {
        case "string":
            validateStringSchema(key, typedEntry);
            break;
        case "number":
            validateNumberSchema(key, typedEntry);
            break;
        case "boolean":
            break;
        case "url":
            validateUrlSchema(key, typedEntry);
            break;
        case "enum":
            validateEnumSchema(key, typedEntry);
            break;
    }
}

function validateStringSchema(key: string, entry: Extract<EnvSchemaEntry, { type: "string" }>): void {
    if ("minLength" in entry && (!Number.isInteger(entry.minLength) || entry.minLength! < 0))
        throw schemaError(key, "minLength must be a non-negative integer.");
    if ("maxLength" in entry && (!Number.isInteger(entry.maxLength) || entry.maxLength! < 0))
        throw schemaError(key, "maxLength must be a non-negative integer.");
    if (entry.minLength !== undefined && entry.maxLength !== undefined && entry.minLength > entry.maxLength)
        throw schemaError(key, "minLength cannot be greater than maxLength.");
    if ("pattern" in entry && !(entry.pattern instanceof RegExp)) throw schemaError(key, "pattern must be a RegExp.");
}

function validateNumberSchema(key: string, entry: Extract<EnvSchemaEntry, { type: "number" }>): void {
    if ("min" in entry && !Number.isFinite(entry.min)) throw schemaError(key, "min must be a finite number.");
    if ("max" in entry && !Number.isFinite(entry.max)) throw schemaError(key, "max must be a finite number.");
    if (entry.min !== undefined && entry.max !== undefined && entry.min > entry.max)
        throw schemaError(key, "min cannot be greater than max.");
}

function validateUrlSchema(key: string, entry: Extract<EnvSchemaEntry, { type: "url" }>): void {
    if ("protocols" in entry) {
        if (
            !Array.isArray(entry.protocols) ||
            entry.protocols.length === 0 ||
            entry.protocols.some((p) => typeof p !== "string")
        ) {
            throw schemaError(key, "protocols must be a non-empty array of strings.");
        }
        if (new Set(entry.protocols).size !== entry.protocols.length)
            throw schemaError(key, "protocols must contain unique values.");
    }
}

function validateEnumSchema(key: string, entry: EnumSchema): void {
    if (!Array.isArray(entry.values) || entry.values.length === 0)
        throw schemaError(key, "values must contain at least one item.");
    if (entry.values.some((value) => typeof value !== "string"))
        throw schemaError(key, "values must contain only strings.");
    if (new Set(entry.values).size !== entry.values.length)
        throw schemaError(key, "values must contain unique strings.");
}

function validateDefaultConstraints(key: string, entry: EnvSchemaEntry): void {
    if (!("default" in entry) || entry.default === undefined) return;
    switch (entry.type) {
        case "string": {
            const value = entry.default;
            if (entry.minLength !== undefined && value.length < entry.minLength)
                throw schemaError(key, "default does not satisfy minLength.");
            if (entry.maxLength !== undefined && value.length > entry.maxLength)
                throw schemaError(key, "default does not satisfy maxLength.");
            if (entry.pattern) {
                entry.pattern.lastIndex = 0;
                const matched = entry.pattern.test(value);
                entry.pattern.lastIndex = 0;
                if (!matched) throw schemaError(key, "default does not satisfy pattern.");
            }
            break;
        }
        case "number": {
            const value = entry.default;
            if (entry.min !== undefined && value < entry.min) throw schemaError(key, "default is below min.");
            if (entry.max !== undefined && value > entry.max) throw schemaError(key, "default is above max.");
            break;
        }
        case "url": {
            const value = entry.default;
            let parsed: URL;
            try {
                parsed = new URL(value);
            } catch {
                throw schemaError(key, "default must be a valid absolute URL.");
            }
            if (!parsed.protocol || !parsed.hostname) throw schemaError(key, "default must be a valid absolute URL.");
            if (entry.protocols && !entry.protocols.includes(parsed.protocol))
                throw schemaError(key, "default uses a disallowed URL protocol.");
            break;
        }
        case "boolean":
        case "enum":
            break;
    }
}

function matchesDefault(entry: EnvSchemaEntry): boolean {
    if (!("default" in entry)) return true;
    const value = entry.default;
    switch (entry.type) {
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number" && Number.isFinite(value);
        case "boolean":
            return typeof value === "boolean";
        case "url":
            return typeof value === "string";
        case "enum":
            return typeof value === "string" && entry.values.includes(value);
    }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function schemaError(key: string, message: string): TypeError {
    return new TypeError(`@shubhajit-paul-web/envguard: invalid schema for ${key}: ${message}`);
}
