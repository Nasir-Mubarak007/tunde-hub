import * as Sentry from "@sentry/nextjs";
import { NO_DATA_COLLECTION, beforeSendScrubbed } from "@/features/observability/infrastructure/captureAdapters";
import { readMonitorEnv, reportingEnabled } from "@/features/observability/infrastructure/monitorEnv";

/**
 * The edge runtime options. The edge cannot reach the database, so it sends
 * scrubbed events and writes no local row.
 */
const settings = readMonitorEnv("server");

Sentry.init({
  dsn: settings.dsn,
  enabled: reportingEnabled("server"),
  environment: settings.environment,
  tracesSampleRate: settings.tracesSampleRate,
  dataCollection: NO_DATA_COLLECTION,
  beforeSend: beforeSendScrubbed,
});