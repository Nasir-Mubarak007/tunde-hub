/**
 * Uploads the source maps the build left behind, so a stack trace names the
 * real file and line. A build must never fail because an upload failed, so
 * every refusal here prints a warning and exits zero.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const isWindows = process.platform === "win32";

const cliPath = path.join("node_modules", ".bin", isWindows ? "sentry-cli.cmd" : "sentry-cli");

/** Warns and stops. Takes a message, returns nothing. */
function warn(message) {
  console.warn(`[sourcemaps] ${message}`);
}

/** Reads a trimmed value. Takes a name, returns the value or undefined. */
function readEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

/** Runs the CLI. Takes the arguments, returns whether it succeeded. */
function runCli(args) {
  const result = spawnSync(cliPath, args, { stdio: "inherit", shell: isWindows });
  return result.status === 0;
}

const org = readEnv("SENTRY_ORG");
const project = readEnv("SENTRY_PROJECT");
const authToken = readEnv("SENTRY_AUTH_TOKEN");
const release = readEnv("SENTRY_RELEASE") ?? readEnv("VERCEL_GIT_COMMIT_SHA");

if (org === undefined || project === undefined || authToken === undefined || release === undefined) {
  warn("skipped: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN and a release name are all needed to upload.");
  process.exit(0);
}

const created = runCli([
  "releases",
  "new",
  release,
  "--finalize",
  "--org",
  org,
  "--project",
  project,
  "--auth-token",
  authToken,
]);

if (!created) {
  warn(`the release ${release} could not be created, so no source maps were uploaded.`);
  process.exit(0);
}

const uploaded = runCli([
  "sourcemaps",
  "upload",
  "./.next",
  "--release",
  release,
  "--org",
  org,
  "--project",
  project,
  "--auth-token",
  authToken,
  "--url-prefix",
  "~/",
  "--ignore-file",
  ".sentryclignore",
  "--ext",
  "js",
  "--ext",
  "map",
  "--wait",
]);

if (!uploaded) {
  warn(`the source maps for ${release} were not uploaded. Stack traces from this build stay unreadable.`);
  process.exit(0);
}

console.log(`[sourcemaps] uploaded the source maps for ${release}.`);
process.exit(0);