import { runDailyHealthJob } from "@/features/observability/presentation/dailyHealthJob";

/**
 * The daily health route. Pings the monitor and prunes rows older than the
 * retention window. It reads the authorization header, which is what makes
 * it dynamic, so nothing about it is ever cached. Takes the request, returns
 * the report with a 200, or a 401 when the bearer secret is missing or
 * wrong. A prune failure throws and surfaces as a server error, which is what
 * a failed job should look like.
 */
export async function GET(request: Request): Promise<Response> {
  const outcome = await runDailyHealthJob(request.headers.get("authorization"));
  if (!outcome.authorized) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, pinged: outcome.pinged, pruned: outcome.pruned });
}