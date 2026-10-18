import * as Sentry from "@sentry/nextjs";

/**
 * The server registration hook. It runs once per runtime at boot, which is
 * why the monitor's settings are read through the lenient reader instead of
 * the strict validator: a local boot with no monitor configured is normal.
 *
 * `onRequestError` is what turns a failed server render or server action
 * into a captured event. Without it nothing on the server is ever captured.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;