import { envGuard } from "@shubhajit-paul-web/envguard";

const config = envGuard({
    PORT: { type: "number", default: 3000 },
    DEBUG: { type: "boolean", default: false },
    NODE_ENV: {
        type: "enum",
        values: ["development", "test", "production"] as const,
        default: "development",
    },
});

config.PORT satisfies number;
config.DEBUG satisfies boolean;
config.NODE_ENV satisfies "development" | "test" | "production";
