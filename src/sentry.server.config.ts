import * as Sentry from "@sentry/nextjs";
import { NO_DATA_COLLECTION } from "@/features/observability/infrastructure/captureAdapters";
import { readMonitorEnv, reportingEnabled } from "@/features/observability/infrastructure/monitorEnv";
import {
  beforeSendSlowRequestWithLocalRow,
  beforeSendWithLocalRow,
} from "@/features/observability/infrastructure/serverCapture";

/**
 * The Node.js runtime options. The local row is written from the before send
 * stage on both hooks, so a refused send still leaves a record behind.
 */
const settings = readMonitorEnv("server");

Sentry.init({
  dsn: settings.dsn,
  enabled: reportingEnabled("server"),
  environment: settings.environment,
  release: settings.release,
  tracesSampleRate: settings.tracesSampleRate,
  dataCollection: NO_DATA_COLLECTION,
  beforeSend: beforeSendWithLocalRow,
  beforeSendSpan: beforeSendSlowRequestWithLocalRow,
});