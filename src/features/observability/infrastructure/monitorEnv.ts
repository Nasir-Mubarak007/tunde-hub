import type { CaptureSide } from "../domain/repositories";

/**
 * The lenient environment reader for the monitor. It runs at boot inside
 * `instrumentation.ts`, before any request exists, so it must never fail
 * the way the strict validator in `src/core/env.ts` does: a local boot with
 * no monitor configured is normal, not an error.
 */

/** Everything the capture hooks read, already defaulted. */
export interface MonitorEnv {
  /** The project events go to, or undefined when reporting stays off. */
  readonly dsn: string | undefined;
  /** The environment name the monitor files events under. */
  readonly environment: string;
  /** The release a trace is matched against, or undefined on the browser. */
  readonly release: string | undefined;
  /** Share of performance transactions kept, so the threshold does the filtering. */
  readonly tracesSampleRate: number;
  /** Whether a preview deployment may report at all. */
  readonly sendInPreview: boolean;
}

const DEFAULT_TRACES_SAMPLE_RATE = 1;

/** Reads a number, falling back when the value is absent or unusable. Takes the raw text, returns the number. */
function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

/** Reads a trimmed non empty value. Takes the raw text, returns the value or undefined. */
function readText(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Picks the DSN for this side. The browser can only read a public name, so each side has its own pair. */
function readDsn(side: CaptureSide, sendInPreview: boolean): string | undefined {
  if (side === "browser") {
    return sendInPreview
      ? (readText(process.env.NEXT_PUBLIC_SENTRY_PREVIEW_DSN) ?? readText(process.env.NEXT_PUBLIC_SENTRY_DSN))
      : readText(process.env.NEXT_PUBLIC_SENTRY_DSN);
  }
  return sendInPreview
    ? (readText(process.env.SENTRY_PREVIEW_DSN) ?? readText(process.env.SENTRY_DSN))
    : readText(process.env.SENTRY_DSN);
}

/**
 * Reads the monitor's settings for one side. Takes the side, returns the
 * settings. Never throws and never validates: an absent value is simply off.
 */
export function readMonitorEnv(side: CaptureSide): MonitorEnv {
  const sendInPreview =
    (side === "browser"
      ? readText(process.env.NEXT_PUBLIC_SENTRY_SEND_IN_PREVIEW)
      : readText(process.env.SENTRY_SEND_IN_PREVIEW)) === "true";
  const deploymentEnvironment = readText(side === "browser" ? process.env.NEXT_PUBLIC_VERCEL_ENV : process.env.VERCEL_ENV);
  const namedEnvironment =
    readText(side === "browser" ? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT : process.env.SENTRY_ENVIRONMENT) ??
    deploymentEnvironment;
  return {
    dsn: readDsn(side, sendInPreview),
    environment: namedEnvironment ?? "production",
    release: side === "browser" ? undefined : (readText(process.env.SENTRY_RELEASE) ?? readText(process.env.VERCEL_GIT_COMMIT_SHA)),
    tracesSampleRate: readNumber(readText(process.env.SENTRY_TRACES_SAMPLE_RATE), DEFAULT_TRACES_SAMPLE_RATE),
    sendInPreview,
  };
}

/**
 * The one gate. Only a production build reports, and a preview deployment
 * stays silent until preview reporting is switched on. The same gate guards
 * the local write, so a preview run can never fill the tables. Takes the
 * side, returns whether anything is reported at all.
 */
export function reportingEnabled(side: CaptureSide): boolean {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }
  const deployment = readText(process.env.VERCEL_ENV);
  if (deployment === "preview" || deployment === "development") {
    const settings = readMonitorEnv(side);
    return settings.sendInPreview && settings.dsn !== undefined;
  }
  return true;
}