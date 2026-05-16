import fs from "node:fs";
import path from "node:path";

export function readEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  const values = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key) values[key] = value;
  }

  return values;
}

export function loadEnv() {
  const values = readEnvFile();
  for (const [key, value] of Object.entries(values)) {
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
