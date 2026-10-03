import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const tsc = "node_modules/typescript/bin/tsc";

rmSync("dist", { recursive: true, force: true });
execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { stdio: "inherit" });
execFileSync(process.execPath, [tsc, "-p", "tsconfig.cjs.json"], { stdio: "inherit" });
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
