export type EnvValue = string | undefined;

/* Common options supported by every environment schema entry */
export interface SharedSchemaOptions<TDefault> {
    /* Whether the variable must be present, defaults to `true` when omitted */
    readonly required?: boolean;
    /* Value to use when the variable is missing. Cannot be combined with `required: true` */
    readonly default?: TDefault;
    /* Human-readable context copied to validation issues and error messages */
    readonly description?: string;
}

/* Schema for a string value, input is validated as-is and whitespace is not trimmed */
export interface StringSchema extends SharedSchemaOptions<string> {
    readonly type: "string";
    /* Inclusive minimum string length */
    readonly minLength?: number;
    /* Inclusive maximum string length */
    readonly maxLength?: number;
    /* Regular expression that the complete value must match */
    readonly pattern?: RegExp;
}

/* Schema for a finite numeric value parsed from strict numeric syntax */
export interface NumberSchema extends SharedSchemaOptions<number> {
    readonly type: "number";
    /* Inclusive minimum value */
    readonly min?: number;
    /* Inclusive maximum value */
    readonly max?: number;
}

/* Schema for a boolean value, only the strings "true" and "false" are accepted */
export interface BooleanSchema extends SharedSchemaOptions<boolean> {
    readonly type: "boolean";
}

/* Schema for an absolute URL, with optional protocol checks */
export interface UrlSchema extends SharedSchemaOptions<string> {
    readonly type: "url";
    /* Allowed URL protocols, including their trailing colon such as "https:" */
    readonly protocols?: readonly string[];
}

/* Schema for one exact, case-sensitive value from `values` */
export interface EnumSchema<T extends readonly string[] = readonly string[]> extends SharedSchemaOptions<T[number]> {
    readonly type: "enum";
    /* The allowed values and the source of the inferred union type */
    readonly values: T;
}

/* A single supported environment variable schema entry */
export type EnvSchemaEntry = StringSchema | NumberSchema | BooleanSchema | UrlSchema | EnumSchema;

/* A map from environment variable names to their validation schemas */
export type EnvSchema = Record<string, EnvSchemaEntry>;

/* Options that control where environment values are read from */
export interface EnvGuardOptions {
    /* Source object to validate instead of `process.env`; the source is never mutated */
    readonly source?: Record<string, string | undefined>;
}

/* The runtime type produced for a schema entry */
export type InferEntry<S extends EnvSchemaEntry> =
    S extends EnumSchema<infer V>
        ? V[number]
        : S extends NumberSchema
          ? number
          : S extends BooleanSchema
            ? boolean
            : S extends UrlSchema
              ? string
              : S extends StringSchema
                ? string
                : never;

type HasDefault<S extends EnvSchemaEntry> = "default" extends keyof S ? true : false;
type IsRequired<S extends EnvSchemaEntry> = S extends { readonly required: true } ? true : false;

/**
 * The inferred property type for one schema entry
 *
 * Entries with a default or `required: true` are non-optional while other
 * entries include `undefined`
 */
export type InferEntryProperty<S extends EnvSchemaEntry> =
    HasDefault<S> extends true ? InferEntry<S> : IsRequired<S> extends true ? InferEntry<S> : InferEntry<S> | undefined;

/* The readonly configuration object type inferred from an environment schema */
export type InferSchema<S extends EnvSchema> = {
    readonly [K in keyof S]: InferEntryProperty<S[K]>;
};

/* Stable codes identifying why an environment value failed validation */
export type EnvIssueCode =
    | "MISSING"
    | "EMPTY"
    | "INVALID_TYPE"
    | "INVALID_NUMBER"
    | "INVALID_BOOLEAN"
    | "INVALID_URL"
    | "INVALID_ENUM"
    | "TOO_SHORT"
    | "TOO_LONG"
    | "PATTERN_MISMATCH"
    | "OUT_OF_RANGE";

export interface EnvIssue {
    /* Environment variable name associated with the issue */
    readonly key: string;
    /* Machine-readable validation failure code */
    readonly code: EnvIssueCode;
    /* Safe human-readable explanation; raw environment values are never included */
    readonly message: string;
    /* Optional context supplied by the schema entry */
    readonly description?: string;
}

/** Result returned by {@link safeEnvGuard} */
export type SafeResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: import("./errors.js").EnvGuardError };
