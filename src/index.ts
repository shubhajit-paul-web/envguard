import { validate, validateSafe } from "./validate.js";
import { EnvGuardError } from "./errors.js";
import type { EnvGuardOptions, EnvSchema, InferSchema, SafeResult } from "./types.js";

/**
 * Validate environment variables and return their typed, normalized values.
 *
 * Schema errors throw a `TypeError`. Environment validation errors throw an
 * `EnvGuardError` containing every invalid or missing variable found.
 *
 * @param schema The schema describing the variables to read and validate.
 * @param options Optional validation settings, including a custom source object.
 * @returns A frozen object whose property types are inferred from `schema`.
 * @throws {TypeError} If the schema or validation source is malformed.
 * @throws {EnvGuardError} If one or more environment values are invalid.
 */
export function envGuard<S extends EnvSchema>(schema: S, options?: EnvGuardOptions): InferSchema<S> {
    return validate(schema, options);
}

/**
 * Validate environment variables without throwing for configuration errors.
 *
 * The returned discriminated union can be narrowed with `result.ok`. Malformed
 * schemas and sources still throw `TypeError` because they indicate a program
 * configuration problem rather than an invalid environment.
 *
 * @param schema The schema describing the variables to read and validate.
 * @param options Optional validation settings, including a custom source object.
 * @returns `{ ok: true, data }` on success or `{ ok: false, error }` on failure.
 * @throws {TypeError} If the schema or validation source is malformed.
 */
export function safeEnvGuard<S extends EnvSchema>(schema: S, options?: EnvGuardOptions): SafeResult<InferSchema<S>> {
    return validateSafe(schema, options) as SafeResult<InferSchema<S>>;
}

export { EnvGuardError };
export type {
    EnvGuardOptions,
    EnvIssue,
    EnvIssueCode,
    EnvSchema,
    EnvSchemaEntry,
    StringSchema,
    NumberSchema,
    BooleanSchema,
    UrlSchema,
    EnumSchema,
    InferEntry,
    InferEntryProperty,
    InferSchema,
    SafeResult,
} from "./types.js";
