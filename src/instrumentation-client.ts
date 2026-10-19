import * as Sentry from "@sentry/nextjs";
import { NO_DATA_COLLECTION, beforeSendScrubbed } from "@/features/observability/infrastructure/captureAdapters";
import { readMonitorEnv, reportingEnabled } from "@/features/observability/infrastructure/monitorEnv";

/**
 * The browser runtime options. A browser cannot reach the database, so a
 * browser capture is scrubbed and sent but writes no local row. Session
 * replay stays off: it is never added to the integrations on purpose.
 */
const settings = readMonitorEnv("browser");

Sentry.init({
  dsn: settings.dsn,
  enabled: reportingEnabled("browser"),
  environment: settings.environment,
  tracesSampleRate: settings.tracesSampleRate,
  dataCollection: NO_DATA_COLLECTION,
  beforeSend: beforeSendScrubbed,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;