# @shubhajit-paul-web/envguard

Validate your Node.js environment before the application starts.

Environment variables arrive as strings. `@shubhajit-paul-web/envguard` checks those strings against a small schema, converts supported values to useful JavaScript types, applies safe defaults, and returns one typed configuration object.

```text
Define the configuration your app needs
                |
                v
Validate it once at startup
                |
                v
Use the resulting config everywhere
```

## Why use it?

Without validation, configuration problems often appear later and in less helpful ways:

- a required variable is missing;
- a number contains invalid text;
- `false` is treated as the string `"false"`;
- a URL is malformed;
- an enum contains an unsupported value;
- a value is outside its allowed range.

`@shubhajit-paul-web/envguard` moves these failures to one predictable point: application startup. It reports all configuration errors together and never includes raw environment values in its validation errors.

## Install

```bash
npm install @shubhajit-paul-web/envguard
```

Node.js `>=22` is supported. The package has no runtime dependencies and is intended for Node.js server environments, workers, CLIs, and other backend applications.

## Quick start

```ts
import { envGuard } from "@shubhajit-paul-web/envguard";

const config = envGuard({
    PORT: {
        type: "number",
        default: 3000,
        min: 1,
        max: 65535,
    },
    DATABASE_URL: {
        type: "url",
        required: true,
        protocols: ["postgresql:", "postgres:"],
    },
    JWT_SECRET: {
        type: "string",
        required: true,
        minLength: 32,
    },
    DEBUG: {
        type: "boolean",
        default: false,
    },
    NODE_ENV: {
        type: "enum",
        values: ["development", "test", "production"] as const,
        default: "development",
    },
});

// Values are converted before your application uses them.
console.log(config.PORT); // number
console.log(config.DEBUG); // boolean
console.log(config.NODE_ENV); // 'development' | 'test' | 'production'
```

Call `envGuard()` during application setup, before creating servers, database clients, or workers. After that, pass `config` to the parts of your application that need it instead of reading `process.env` throughout the codebase.

## Supported types

| Type      | Environment input             | Result               | Options                             |
| --------- | ----------------------------- | -------------------- | ----------------------------------- |
| `string`  | Any string                    | `string`             | `minLength`, `maxLength`, `pattern` |
| `number`  | Strict numeric text           | `number`             | `min`, `max`                        |
| `boolean` | Exactly `"true"` or `"false"` | `boolean`            | None                                |
| `url`     | An absolute URL               | Original URL string  | `protocols`                         |
| `enum`    | One exact allowed value       | String literal union | `values`                            |

### Strings

Strings are returned as supplied. They are not trimmed or changed to another case.

```ts
const config = envGuard({
    API_KEY: {
        type: "string",
        required: true,
        minLength: 20,
        maxLength: 200,
        pattern: /^[a-z0-9_-]+$/,
    },
});
```

`pattern` must be a regular expression. It is checked against the complete supplied value.

### Numbers

Numbers use strict numeric syntax and must be finite. Whitespace, hexadecimal values, `Infinity`, and arbitrary text are rejected.

```ts
const config = envGuard({
    PORT: { type: "number", required: true, min: 1, max: 65535 },
    TIMEOUT_MS: { type: "number", default: 5000, min: 0 },
});
```

### Booleans

Only these two values are accepted:

```env
DEBUG=true
DEBUG=false
```

Values such as `1`, `0`, `yes`, and `TRUE` are rejected. This keeps configuration explicit and avoids surprising coercion.

### URLs

URLs must be valid absolute URLs. `@shubhajit-paul-web/envguard` checks their syntax only; it does not contact the host.

```ts
const config = envGuard({
    API_URL: {
        type: "url",
        required: true,
        protocols: ["https:"],
    },
});
```

Protocol names must include the trailing colon, such as `https:` or `postgresql:`. The original URL string is returned after validation.

### Enums

Enums accept one exact, case-sensitive value from `values`.

```ts
const config = envGuard({
    LOG_LEVEL: {
        type: "enum",
        values: ["debug", "info", "warn", "error"] as const,
        default: "info",
    },
});
```

Using `as const` preserves the literal union in TypeScript.

## Required values and defaults

Only `undefined` means that a variable is missing.

- A missing variable uses its `default`, when one is provided.
- A missing variable without a default is required unless `required: false` is set.
- An empty string is a supplied value. It is not replaced by a default.
- An empty string is invalid for a required variable.
- `required: true` and `default` cannot be used together.

Be explicit when you want a value to be optional:

```ts
const config = envGuard({
    OPTIONAL_LABEL: {
        type: "string",
        required: false,
    },
    RETRIES: {
        type: "number",
        default: 3,
    },
});
```

Defaults must have the correct type and satisfy the schema constraints. Invalid defaults are reported as schema errors before environment values are read.

## Handling errors

### Throwing API

`envGuard()` throws `EnvGuardError` when one or more environment values are missing or invalid.

```ts
import { EnvGuardError, envGuard } from "@shubhajit-paul-web/envguard";

try {
    const config = envGuard(schema);
    startApplication(config);
} catch (error) {
    if (error instanceof EnvGuardError) {
        console.error(error.message);
        process.exitCode = 1;
    } else {
        throw error;
    }
}
```

The formatted message looks like this:

```text
@shubhajit-paul-web/envguard: environment validation failed

  ✖ DATABASE_URL
    Required environment variable is missing.

  ✖ PORT
    Expected a finite number.

2 configuration errors found.
Fix the environment configuration and restart the application.
```

The error includes every problem found in the same validation pass. It does not print raw values, defaults, URL credentials, query strings, or arbitrary invalid input.

`EnvGuardError` exposes:

- `code`: the stable value `ENV_VALIDATION_ERROR`;
- `issues`: a frozen list of structured issues;
- `message`: a readable summary suitable for startup logs.

Each issue includes `key`, `code`, and `message`. It may also include the schema entry's `description`.

### Non-throwing API

Use `safeEnvGuard()` when handling a validation result is more convenient than catching an exception.

```ts
import { safeEnvGuard } from "@shubhajit-paul-web/envguard";

const result = safeEnvGuard(schema);

if (result.ok) {
    startApplication(result.data);
} else {
    console.error(result.error.message);
}
```

Both APIs still throw `TypeError` for malformed schemas or malformed custom sources. Those are programming errors, not bad deployment environment values.

## Adding descriptions

Use `description` to add safe context to an issue without exposing the value itself.

```ts
const config = envGuard({
    DATABASE_URL: {
        type: "url",
        required: true,
        description: "The primary application database",
    },
});
```

The description is included in the formatted error and in the corresponding structured issue.

## Testing with a custom source

By default, values are read from `process.env`. For tests and tooling, provide a source object instead.

```ts
import { safeEnvGuard } from "@shubhajit-paul-web/envguard";

const result = safeEnvGuard(
    {
        PORT: { type: "number", required: true },
        DATABASE_URL: { type: "url", required: true },
    },
    {
        source: {
            PORT: "3000",
            DATABASE_URL: "postgresql://localhost/test",
        },
    },
);
```

The source is never mutated. `process.env` is only the default source.

## TypeScript inference

The returned object is readonly and its property types are inferred from the schema.

```ts
const config = envGuard({
    PORT: { type: "number", required: true },
    DEBUG: { type: "boolean", default: false },
    NODE_ENV: {
        type: "enum",
        values: ["development", "production"] as const,
        default: "development",
    },
});

config.PORT satisfies number;
config.DEBUG satisfies boolean;
config.NODE_ENV satisfies "development" | "production";
```

Use `required: true` or a `default` when the value must be non-optional in the inferred type. Values declared with `required: false` or without an explicit `required: true` may include `undefined` in their TypeScript type.

The returned object is shallow-frozen. Its properties cannot be reassigned, but nested values are not part of the supported schema.

## What @shubhajit-paul-web/envguard does not do

`@shubhajit-paul-web/envguard` is deliberately focused. It does not:

- load `.env` files;
- manage or store secrets;
- contact databases, APIs, or other external services;
- check whether credentials actually work;
- call `process.exit()`;
- mutate `process.env`;
- validate arbitrary application data;
- watch for environment changes after startup.

Load environment files with your runtime, Node.js `--env-file`, or a dedicated loader. Then validate the resulting environment with `@shubhajit-paul-web/envguard`.

## API reference

### `envGuard(schema, options?)`

Validates the source, applies defaults, converts values, checks constraints, freezes the result, and throws `EnvGuardError` when environment values are invalid.

### `safeEnvGuard(schema, options?)`

Returns `{ ok: true, data }` for valid configuration or `{ ok: false, error }` for invalid environment values.

### `EnvGuardError`

A structured error with a stable `code`, readonly `issues`, and a formatted `message`.

### `options.source`

An optional `Record<string, string | undefined>` to validate instead of `process.env`. The source is never changed.

## Development

Run the checks locally with:

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
```

## License

MIT
