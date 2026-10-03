import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,ts}"],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            "no-console": "off",
        },
    },
    eslintConfigPrettier,
];
