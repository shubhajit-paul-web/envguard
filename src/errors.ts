import type { EnvIssue } from "./types.js";

/**
 * Error thrown when one or more environment values fail validation.
 *
 * `issues` is frozen and contains aggregated, value-safe details suitable for
 * logging or displaying during application startup.
 */
export class EnvGuardError extends Error {
    /** Stable error code for programmatic error handling. */
    readonly code = "ENV_VALIDATION_ERROR" as const;
    /** All validation issues found during the same validation pass. */
    readonly issues: readonly EnvIssue[];

    constructor(issues: readonly EnvIssue[]) {
        super(formatError(issues));
        this.name = "EnvGuardError";
        this.issues = Object.freeze([...issues]);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

function formatError(issues: readonly EnvIssue[]): string {
    const lines = ["@shubhajit-paul-web/envguard: environment validation failed", ""];

    for (const issue of issues) {
        lines.push(`  ✖ ${issue.key}`);
        lines.push(`    ${issue.message}`);
        if (issue.description) lines.push(`    ${issue.description}`);
        lines.push("");
    }

    lines.push(`${issues.length} configuration error${issues.length === 1 ? "" : "s"} found.`);
    lines.push("Fix the environment configuration and restart the application.");
    return lines.join("\n");
}
