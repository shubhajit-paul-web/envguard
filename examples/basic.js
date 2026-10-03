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
    },
});

console.log(config);
