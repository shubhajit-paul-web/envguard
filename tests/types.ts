import { envGuard } from "../src/index.js";

const config = envGuard({
    REQUIRED_STRING: { type: "string", required: true },
    OPTIONAL_STRING: { type: "string", required: false },
    PORT: { type: "number", default: 3000 },
    DEBUG: { type: "boolean", default: false },
    MODE: { type: "enum", values: ["development", "test", "production"] as const, default: "development" },
    URL: { type: "url" },
});

config.REQUIRED_STRING satisfies string;
config.OPTIONAL_STRING satisfies string | undefined;
config.PORT satisfies number;
config.DEBUG satisfies boolean;
config.MODE satisfies "development" | "test" | "production";
config.URL satisfies string | undefined;

const acceptsNumber = (value: number) => value;
acceptsNumber(config.PORT);
