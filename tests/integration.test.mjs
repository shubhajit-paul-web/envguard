import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const app = join(tmpdir(), `envguard-app-${process.pid}.mjs`);
const packageEntry = pathToFileURL(join(process.cwd(), "dist/index.js")).href;
writeFileSync(
    app,
    `import { envGuard } from '${packageEntry}';\nconst config = envGuard({ PORT: { type: 'number' }, SECRET: { type: 'string', minLength: 8 } });\nconsole.log('SERVER_STARTED', config.PORT);\n`,
);

test("invalid environment prevents application startup", () => {
    const result = spawnSync(process.execPath, [app], {
        encoding: "utf8",
        env: { ...process.env, PORT: "bad", SECRET: "short" },
    });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.includes("SERVER_STARTED"), false);
    assert.equal(result.stderr.includes("PORT"), true);
    assert.equal(result.stderr.includes("SECRET"), true);
});

test("valid environment allows application startup", () => {
    const result = spawnSync(process.execPath, [app], {
        encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0", PORT: "3000", SECRET: "long-enough-secret" },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "SERVER_STARTED 3000", `unexpected startup output: ${result.stderr}`);
});
