const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
    const envPath = path.join(__dirname, ".env");

    if (!fs.existsSync(envPath)) return;

    fs.readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return;

            const separator = trimmed.indexOf("=");
            if (separator === -1) return;

            const name = trimmed.slice(0, separator).trim();
            const value = trimmed.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "");

            if (!process.env[name]) process.env[name] = value;
        });
}

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured.");
}

const config = `// Generated during the build. Do not edit or commit this file.\nwindow.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};\n`;

fs.writeFileSync(path.join(__dirname, "supabase-config.js"), config);
console.log("Generated supabase-config.js");
