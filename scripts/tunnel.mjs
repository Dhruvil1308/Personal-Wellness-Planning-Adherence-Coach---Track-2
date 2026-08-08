#!/usr/bin/env node
/**
 * Starts the ngrok tunnel that Vobiz reaches this server through.
 *
 * Reads NGROK_DOMAIN / NGROK_AUTHTOKEN / VOICE_PORT / VOICE_HOST from
 * .env.local so the tunnel always matches what the app advertises to the
 * carrier — a mismatch there is silent and shows up only as a call to dead air.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnv(file) {
  try {
    const out = {};
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const root = process.cwd();
const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(path.join(root, ".env.local")), ...process.env };

const port = env.VOICE_PORT || env.PORT || "3000";
const host = env.VOICE_HOST && env.VOICE_HOST !== "0.0.0.0" ? env.VOICE_HOST : "localhost";
const domain = (env.NGROK_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");

if (!domain) {
  console.error(
    "NGROK_DOMAIN is not set in .env.local — add your reserved domain, e.g.\n" +
      "  NGROK_DOMAIN=https://your-name.ngrok-free.dev",
  );
  process.exit(1);
}

const args = ["http", `--domain=${domain}`, `${host}:${port}`];
if (env.NGROK_AUTHTOKEN) args.push(`--authtoken=${env.NGROK_AUTHTOKEN}`);

console.log(`▸ tunnelling https://${domain}  ->  http://${host}:${port}`);
console.log("▸ Vobiz answer URL:  " + `https://${domain}/telephony/answer`);
console.log("▸ Vobiz hangup URL:  " + `https://${domain}/telephony/hangup`);
console.log("");

const child = spawn("ngrok", args, { stdio: "inherit" });
child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error("ngrok is not installed or not on PATH. See https://ngrok.com/download");
    process.exit(1);
  }
  throw err;
});
child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
